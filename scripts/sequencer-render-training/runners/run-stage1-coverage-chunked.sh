#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

RUN_ROOT=""
MINUTES_PER_CHUNK=180
POLL_SECONDS=300
SEED_LEDGER=""
CHUNK_BY="geometry-profile"
RECORD_ROOTS=()
STAMP="$(date -u +"%Y%m%dT%H%M%SZ")"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --out-dir)
      RUN_ROOT="$2"
      shift 2
      ;;
    --minutes-per-chunk)
      MINUTES_PER_CHUNK="$2"
      shift 2
      ;;
    --poll-seconds)
      POLL_SECONDS="$2"
      shift 2
      ;;
    --seed-ledger)
      SEED_LEDGER="$2"
      shift 2
      ;;
    --record-root)
      RECORD_ROOTS+=("$2")
      shift 2
      ;;
    --chunk-by)
      CHUNK_BY="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

[[ "$CHUNK_BY" == "geometry-profile" ]] || {
  echo "Unsupported chunk mode: $CHUNK_BY" >&2
  exit 1
}

if [[ -z "$RUN_ROOT" ]]; then
  RUN_ROOT="/tmp/render-training-stage1-chunked-${STAMP}"
fi

mkdir -p "$RUN_ROOT"
STATE_PATH="$RUN_ROOT/chunked-state.json"
MAIN_LOG="$RUN_ROOT/chunked-runner.log"
AUDIT_PATH="$RUN_ROOT/stage1-coverage-audit.json"
BACKLOG_PATH="$RUN_ROOT/stage1-coverage-backlog.json"
VALIDATION_DIR="$RUN_ROOT/preflight-validation"
CURRENT_LEDGER_PATH="$RUN_ROOT/current-ledger.json"
CHUNK_RESULTS_PATH="$RUN_ROOT/chunk-results.ndjson"

: > "$MAIN_LOG"
: > "$CHUNK_RESULTS_PATH"

log() {
  printf '[stage1-chunked] %s\n' "$*" | tee -a "$MAIN_LOG" >/dev/null
}

if [[ -n "$SEED_LEDGER" ]]; then
  cp "$SEED_LEDGER" "$CURRENT_LEDGER_PATH"
else
  printf '{"version":"1.0","items":[]}\n' > "$CURRENT_LEDGER_PATH"
fi

record_root_args=()
for root in "${RECORD_ROOTS[@]}"; do
  record_root_args+=(--record-root "$root")
done

python3 "$ROOT_DIR/generators/generate-stage1-coverage-audit.py" \
  "${record_root_args[@]}" \
  --completed-ledger "$CURRENT_LEDGER_PATH" \
  --out "$AUDIT_PATH"

validation_args=("$VALIDATION_DIR" "$ROOT_DIR/catalog/stage1-effect-model-scope.json" "$ROOT_DIR/catalog/effective-effect-parameter-registry.json")
for root in "${RECORD_ROOTS[@]}"; do
  validation_args+=("$root")
done
if [[ "${#RECORD_ROOTS[@]}" -gt 0 ]]; then
  node "$ROOT_DIR/tooling/build-stage1-validation-report.mjs" "${validation_args[@]}" >/dev/null
fi

backlog_args=(--audit "$AUDIT_PATH" --out "$BACKLOG_PATH")
if [[ -f "$VALIDATION_DIR/stage1-validation-report.json" ]]; then
  backlog_args+=(--validation-report "$VALIDATION_DIR/stage1-validation-report.json")
fi
python3 "$ROOT_DIR/generators/generate-stage1-coverage-backlog.py" \
  "${backlog_args[@]}"

GEOMETRY_PROFILES=()
while IFS= read -r profile; do
  [[ -n "$profile" ]] || continue
  GEOMETRY_PROFILES+=("$profile")
done < <(jq -r '.items[].geometryProfile' "$BACKLOG_PATH" | awk '!seen[$0]++')

printf '{"version":"1.0","chunks":[]}\n' > "$STATE_PATH"

for profile in "${GEOMETRY_PROFILES[@]}"; do
  chunk_slug="${profile//_/-}"
  chunk_dir="$RUN_ROOT/chunks/$chunk_slug"
  chunk_backlog="$chunk_dir/backlog.json"
  chunk_validation_dir="$chunk_dir/validation"
  mkdir -p "$chunk_dir"

  python3 "$ROOT_DIR/generators/build-stage1-backlog-subset.py" \
    --backlog "$BACKLOG_PATH" \
    --geometry-profile "$profile" \
    --out "$chunk_backlog"

  chunk_items="$(jq -r '.totalBacklogItems // 0' "$chunk_backlog")"
  if [[ "$chunk_items" == "0" ]]; then
    log "chunk=$profile skipped empty"
    continue
  fi

  log "chunk=$profile start items=$chunk_items"

  bash "$SCRIPT_DIR/run-stage1-coverage-round.sh" \
    --backlog "$chunk_backlog" \
    --seed-ledger "$CURRENT_LEDGER_PATH" \
    --out-dir "$chunk_dir/run" \
    --minutes "$MINUTES_PER_CHUNK" \
    --poll-seconds "$POLL_SECONDS" \
    --cycle-limit 999

  cp "$chunk_dir/run/completed-ledger.json" "$CURRENT_LEDGER_PATH"

  reanalyze_output="$(python3 "$ROOT_DIR/tooling/reanalyze-records.py" "$chunk_dir/run")"

  node "$ROOT_DIR/tooling/build-stage1-validation-report.mjs" \
    "$chunk_validation_dir" \
    "$ROOT_DIR/catalog/stage1-effect-model-scope.json" \
    "$ROOT_DIR/catalog/effective-effect-parameter-registry.json" \
    --geometry-profile "$profile" \
    "$chunk_dir/run"

  report_ok="$(jq -r '.ok' "$chunk_validation_dir/stage1-validation-report.json")"
  node "$ROOT_DIR/tooling/build-model-training-evidence-report.mjs" \
    "$chunk_dir/run" \
    "$chunk_dir/model-evidence" >/dev/null

  python3 - <<'PY' \
    "$CHUNK_RESULTS_PATH" \
    "$profile" \
    "$chunk_dir/run/cycle-1/run/registry-run-summary.json" \
    "$chunk_validation_dir/stage1-validation-report.json" \
    "$chunk_dir/model-evidence/model-training-evidence-report.json" \
    "$reanalyze_output"
import json, sys
results_path, profile, run_summary_path, validation_path, evidence_path, reanalyze_output = sys.argv[1:7]
run_summary = json.load(open(run_summary_path))
validation = json.load(open(validation_path))
evidence = json.load(open(evidence_path))
reanalyze = json.loads(reanalyze_output)
payload = {
    'geometryProfile': profile,
    'packCount': run_summary.get('packCount', 0),
    'passedCount': run_summary.get('passedCount', 0),
    'failedCount': run_summary.get('failedCount', 0),
    'validationOk': validation.get('ok', False),
    'missingCoverageCount': len(validation.get('missingCoverage', [])),
    'paletteGapCount': len(validation.get('paletteGaps', [])),
    'parameterGapCount': len(validation.get('parameterGaps', [])),
    'patternFamilyGapCount': len(validation.get('patternFamilyGaps', [])),
    'recordCount': evidence.get('recordCount', 0),
    'modelCount': evidence.get('modelCount', 0),
    'paletteProfiles': sorted(evidence.get('paletteProfiles', [])),
    'reanalyzedRecords': reanalyze.get('recordCount', 0),
    'reanalyzeChangedCount': reanalyze.get('changedCount', 0),
}
with open(results_path, 'a') as fh:
    fh.write(json.dumps(payload) + '\n')
PY

  chunk_summary="$(tail -n 1 "$CHUNK_RESULTS_PATH")"
  log "chunk=$profile result=$chunk_summary"

  python3 - <<'PY' "$STATE_PATH" "$profile" "$chunk_dir/run/controller-state.json" "$chunk_validation_dir/stage1-validation-report.json" "$chunk_items"
import json, sys
state_path, profile, controller_path, validation_path, chunk_items = sys.argv[1:6]
state = json.load(open(state_path))
controller = json.load(open(controller_path))
validation = json.load(open(validation_path))
state['chunks'].append({
    'geometryProfile': profile,
    'requestedItemCount': int(chunk_items),
    'controllerCycles': controller.get('cycles', []),
    'validationOk': validation.get('ok', False),
    'missingCoverageCount': len(validation.get('missingCoverage', [])),
    'paletteGapCount': len(validation.get('paletteGaps', [])),
    'parameterGapCount': len(validation.get('parameterGaps', [])),
    'patternFamilyGapCount': len(validation.get('patternFamilyGaps', [])),
})
with open(state_path, 'w') as f:
    json.dump(state, f, indent=2)
    f.write('\n')
PY

  if [[ "$report_ok" != "true" ]]; then
    log "chunk=$profile failed-validation"
    exit 1
  fi

  log "chunk=$profile completed"
done

log "chunked-run-complete"
