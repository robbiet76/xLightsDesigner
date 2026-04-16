#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
STAMP="$(date -u +"%Y%m%dT%H%M%SZ")"
RUN_ROOT="/tmp/sequencer-training-reset-${STAMP}"
HARVEST_SOURCE=""
REQUIRE_CLEAN_READY=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --out-dir)
      RUN_ROOT="$2"
      shift 2
      ;;
    --harvest-source)
      HARVEST_SOURCE="$2"
      shift 2
      ;;
    --require-clean-ready)
      REQUIRE_CLEAN_READY=1
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

mkdir -p "$RUN_ROOT/artifacts"
LOG_PATH="$RUN_ROOT/runner.log"
exec > >(tee -a "$LOG_PATH") 2>&1

SETTINGS_COVERAGE="$RUN_ROOT/artifacts/effect-settings-coverage-report-v1.json"
AUTOMATION_PLAN="$RUN_ROOT/artifacts/effect-training-automation-plan-v1.json"
SCREENING_PLAN="$RUN_ROOT/artifacts/effect-parameter-screening-plan-v1.json"
INTERACTION_COVERAGE="$RUN_ROOT/artifacts/effect-setting-interaction-coverage-report-v1.json"
DOSSIER_DIR="$RUN_ROOT/artifacts/effect-training-dossiers"
BEHAVIOR_RECORD_DIR="$RUN_ROOT/artifacts/behavior-capability-records"
PARAMETER_RECORD_DIR="$RUN_ROOT/artifacts/parameter-semantics-records"
SHARED_RECORD_DIR="$RUN_ROOT/artifacts/shared-setting-semantics-records"
INTERACTION_RECORD_DIR="$RUN_ROOT/artifacts/parameter-interaction-semantics-records"
LEARNINGS_SUMMARY="$RUN_ROOT/effect-training-learnings-summary.md"
RESET_REPORT="$RUN_ROOT/sequencer-training-reset-report.json"
HARVEST_SUMMARY="$RUN_ROOT/artifacts/harvest-summary.json"
SCREENING_RECORDS_DIR="$ROOT_DIR/catalog/effect-screening-records"

printf '[training-reset] run-root=%s\n' "$RUN_ROOT"

if [[ -n "$HARVEST_SOURCE" ]]; then
  printf '[training-reset] harvesting screening records from %s\n' "$HARVEST_SOURCE"
  node "$ROOT_DIR/tooling/harvest-screening-records.mjs" \
    --source "$HARVEST_SOURCE" \
    --out-dir "$RUN_ROOT/harvested-screening-records" | tee "$HARVEST_SUMMARY"
  SCREENING_RECORDS_DIR="$RUN_ROOT/harvested-screening-records"
fi

printf '[training-reset] refreshing transitional planning artifacts\n'
node "$ROOT_DIR/tooling/build-unified-training-set.mjs" \
  "$ROOT_DIR/catalog/sequencer-unified-training-set-v1.json" \
  "$ROOT_DIR/catalog/effect-family-outcomes" \
  "$SCREENING_RECORDS_DIR"
node "$ROOT_DIR/tooling/build-effect-settings-coverage-report.mjs" "$SETTINGS_COVERAGE"
node "$ROOT_DIR/tooling/build-effect-training-automation-plan.mjs" "$AUTOMATION_PLAN"
node "$ROOT_DIR/tooling/build-effect-parameter-screening-plan.mjs" "$SCREENING_PLAN"
node "$ROOT_DIR/tooling/build-effect-setting-interaction-coverage-report.mjs" "$AUTOMATION_PLAN" "$INTERACTION_COVERAGE"
node "$ROOT_DIR/tooling/build-behavior-capability-records.mjs" "$BEHAVIOR_RECORD_DIR"
node "$ROOT_DIR/tooling/build-parameter-semantics-records.mjs" "$PARAMETER_RECORD_DIR"
node "$ROOT_DIR/tooling/build-shared-setting-semantics-records.mjs" "$SHARED_RECORD_DIR"
node "$ROOT_DIR/tooling/build-parameter-interaction-semantics-records.mjs" "$INTERACTION_RECORD_DIR"
node "$ROOT_DIR/tooling/build-effect-training-dossiers.mjs" \
  "$DOSSIER_DIR" \
  "$ROOT_DIR/catalog/sequencer-unified-training-set-v1.json" \
  "$SETTINGS_COVERAGE" \
  "$INTERACTION_COVERAGE" \
  "$ROOT_DIR/catalog/effective-effect-parameter-registry.json"
node "$ROOT_DIR/tooling/build-effect-training-learnings-summary.mjs" "$DOSSIER_DIR" "$LEARNINGS_SUMMARY"

printf '[training-reset] building consolidated reset report\n'
REPORT_ARGS=(
  --settings-coverage "$SETTINGS_COVERAGE"
  --automation-plan "$AUTOMATION_PLAN"
  --screening-plan "$SCREENING_PLAN"
  --interaction-coverage "$INTERACTION_COVERAGE"
  --behavior-record-dir "$BEHAVIOR_RECORD_DIR"
  --parameter-record-dir "$PARAMETER_RECORD_DIR"
  --shared-record-dir "$SHARED_RECORD_DIR"
  --interaction-record-dir "$INTERACTION_RECORD_DIR"
  --output "$RESET_REPORT"
)
if [[ -f "$HARVEST_SUMMARY" ]]; then
  REPORT_ARGS+=(--harvest-summary "$HARVEST_SUMMARY")
fi
node "$ROOT_DIR/tooling/build-sequencer-training-reset-report.mjs" "${REPORT_ARGS[@]}"

python3 - <<'PY' "$RESET_REPORT" "$REQUIRE_CLEAN_READY"
import json, sys
report_path = sys.argv[1]
require_clean = sys.argv[2] == '1'
with open(report_path) as f:
    report = json.load(f)
print('[training-reset] cleanRegenerationAllowed=%s blockers=%s' % (
    str(report['summary']['cleanRegenerationAllowed']).lower(),
    ','.join(report.get('blockers', [])) or 'none'
))
if require_clean and not report['summary']['cleanRegenerationAllowed']:
    sys.exit(2)
PY
