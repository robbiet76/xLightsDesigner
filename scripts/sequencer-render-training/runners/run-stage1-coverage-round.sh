#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

BACKLOG="/tmp/render-training-stage1-coverage-backlog.v1.json"
CYCLE_LIMIT=40
POLL_SECONDS=300
MINUTES=60
RUN_ROOT=""
SEED_LEDGER=""
STAMP="$(date -u +"%Y%m%dT%H%M%SZ")"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --backlog)
      BACKLOG="$2"
      shift 2
      ;;
    --cycle-limit)
      CYCLE_LIMIT="$2"
      shift 2
      ;;
    --minutes)
      MINUTES="$2"
      shift 2
      ;;
    --poll-seconds)
      POLL_SECONDS="$2"
      shift 2
      ;;
    --out-dir)
      RUN_ROOT="$2"
      shift 2
      ;;
    --seed-ledger)
      SEED_LEDGER="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

[[ -f "$BACKLOG" ]] || { echo "Backlog not found: $BACKLOG" >&2; exit 1; }

if [[ -z "$RUN_ROOT" ]]; then
  RUN_ROOT="/tmp/render-training-stage1-coverage-${STAMP}"
fi

mkdir -p "$RUN_ROOT"
HEALTH_LOG="$RUN_ROOT/health.log"
HEALTH_JSONL="$RUN_ROOT/health.jsonl"
MAIN_LOG="$RUN_ROOT/runner.log"
LEDGER_PATH="$RUN_ROOT/completed-ledger.json"
STATE_PATH="$RUN_ROOT/controller-state.json"
: > "$HEALTH_LOG"
: > "$HEALTH_JSONL"
: > "$MAIN_LOG"
if [[ -n "$SEED_LEDGER" ]]; then
  [[ -f "$SEED_LEDGER" ]] || { echo "Seed ledger not found: $SEED_LEDGER" >&2; exit 1; }
  cp "$SEED_LEDGER" "$LEDGER_PATH"
else
  printf '{"version":"1.0","items":[]}' > "$LEDGER_PATH"
fi
printf '{"version":"1.0","cycles":[]}' > "$STATE_PATH"

START_EPOCH="$(date +%s)"
DEADLINE_EPOCH=$((START_EPOCH + (MINUTES * 60)))

log() {
  printf '[stage1-coverage] %s\n' "$*" | tee -a "$MAIN_LOG" >/dev/null
}

completed_count() {
  python3 - <<'PY' "$LEDGER_PATH"
import json, sys
with open(sys.argv[1]) as f:
    ledger=json.load(f)
print(sum(1 for item in ledger.get('items', []) if item.get('status') == 'completed'))
PY
}

snapshot_health() {
  local cycle="$1"
  local now summary_path pack_count passed_count failed_count done_count
  now="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  summary_path="$RUN_ROOT/cycle-${cycle}/run/registry-run-summary.json"
  done_count="$(completed_count)"
  if [[ -f "$summary_path" ]]; then
    pack_count="$(jq -r '.packCount // 0' "$summary_path")"
    passed_count="$(jq -r '.passedCount // 0' "$summary_path")"
    failed_count="$(jq -r '.failedCount // 0' "$summary_path")"
    jq -cn \
      --arg ts "$now" \
      --argjson cycle "$cycle" \
      --argjson packCount "$pack_count" \
      --argjson passedCount "$passed_count" \
      --argjson failedCount "$failed_count" \
      --argjson completedItems "$done_count" \
      '{timestamp:$ts,cycle:$cycle,healthy:true,packCount:$packCount,passedCount:$passedCount,failedCount:$failedCount,completedItems:$completedItems}' \
      >> "$HEALTH_JSONL"
    printf '[stage1-coverage-health] %s cycle=%s packCount=%s passed=%s failed=%s completedItems=%s\n' \
      "$now" "$cycle" "$pack_count" "$passed_count" "$failed_count" "$done_count" >> "$HEALTH_LOG"
  else
    jq -cn \
      --arg ts "$now" \
      --argjson cycle "$cycle" \
      --argjson completedItems "$done_count" \
      '{timestamp:$ts,cycle:$cycle,healthy:true,packCount:0,passedCount:0,failedCount:0,completedItems:$completedItems,summaryMissing:true}' \
      >> "$HEALTH_JSONL"
    printf '[stage1-coverage-health] %s cycle=%s summary=pending completedItems=%s\n' "$now" "$cycle" "$done_count" >> "$HEALTH_LOG"
  fi
}

update_ledger() {
  local cycle="$1"
  local plan_summary="$RUN_ROOT/cycle-${cycle}/stage1-coverage-plan-summary.json"
  local run_summary="$RUN_ROOT/cycle-${cycle}/run/registry-run-summary.json"
  python3 - <<'PY' "$LEDGER_PATH" "$plan_summary" "$run_summary" "$cycle"
import json, sys
ledger_path, plan_summary_path, run_summary_path, cycle = sys.argv[1:5]
with open(ledger_path) as f:
    ledger = json.load(f)
with open(plan_summary_path) as f:
    plan_summary = json.load(f)
with open(run_summary_path) as f:
    run_summary = json.load(f)
results_by_plan = {}
for row in run_summary.get('results', []):
    results_by_plan.setdefault(row['planId'], []).append(row)
index = {(item['effect'], item['geometryProfile'], item['coverageType']): item for item in ledger.get('items', [])}
for row in plan_summary.get('plans', []):
    key = (row['effect'], row['geometryProfile'], row['coverageType'])
    plan_results = results_by_plan.get(row['planId'], [])
    status = 'completed' if plan_results and all(r.get('status') == 'passed' for r in plan_results) else 'failed'
    payload = {
        'effect': row['effect'],
        'geometryProfile': row['geometryProfile'],
        'coverageType': row['coverageType'],
        'priority': row['priority'],
        'recommendedDepth': row['recommendedDepth'],
        'status': status,
        'cycle': int(cycle),
        'planId': row['planId'],
        'parameterCount': len(row.get('parameters', [])),
    }
    index[key] = payload
ledger['items'] = sorted(index.values(), key=lambda x: (x['effect'], x['geometryProfile'], x['coverageType']))
with open(ledger_path, 'w') as f:
    json.dump(ledger, f, indent=2)
    f.write('\n')
PY
}

append_cycle_state() {
  local cycle="$1"
  local cycle_dir="$RUN_ROOT/cycle-${cycle}"
  python3 - <<'PY' "$STATE_PATH" "$cycle" "$cycle_dir/stage1-coverage-plan-summary.json" "$cycle_dir/run/registry-run-summary.json" "$LEDGER_PATH"
import json, sys
state_path, cycle, plan_summary_path, run_summary_path, ledger_path = sys.argv[1:6]
with open(state_path) as f:
    state = json.load(f)
with open(plan_summary_path) as f:
    plan_summary = json.load(f)
with open(run_summary_path) as f:
    run_summary = json.load(f)
with open(ledger_path) as f:
    ledger = json.load(f)
state['cycles'].append({
    'cycle': int(cycle),
    'selectedPlanCount': plan_summary.get('selectedPlanCount', 0),
    'packCount': run_summary.get('packCount', 0),
    'passedCount': run_summary.get('passedCount', 0),
    'failedCount': run_summary.get('failedCount', 0),
    'completedItemCount': sum(1 for item in ledger.get('items', []) if item.get('status') == 'completed'),
})
with open(state_path, 'w') as f:
    json.dump(state, f, indent=2)
    f.write('\n')
PY
}

cycle=1
while [[ "$(date +%s)" -lt "$DEADLINE_EPOCH" ]]; do
  cycle_dir="$RUN_ROOT/cycle-${cycle}"
  mkdir -p "$cycle_dir/generated-base-manifests"
  plan_path="$cycle_dir/stage1-coverage-plan.json"
  plan_summary_path="$cycle_dir/stage1-coverage-plan-summary.json"

  python3 "$SCRIPT_DIR/generate-stage1-coverage-plan.py" \
    --backlog "$BACKLOG" \
    --completed-ledger "$LEDGER_PATH" \
    --out-plan "$plan_path" \
    --out-manifest-dir "$cycle_dir/generated-base-manifests" \
    --summary-out "$plan_summary_path" \
    --limit "$CYCLE_LIMIT"

  selected_plan_count="$(jq -r '.selectedPlanCount // 0' "$plan_summary_path")"
  if [[ "$selected_plan_count" == "0" ]]; then
    log "cycle=$cycle no-remaining-work"
    break
  fi

  log "cycle=$cycle plan-generated selectedPlans=$selected_plan_count"
  bash "$SCRIPT_DIR/run-registry-plan.sh" \
    --plan "$plan_path" \
    --registry "$SCRIPT_DIR/effect-parameter-registry.json" \
    --out-dir "$cycle_dir/run" >>"$MAIN_LOG" 2>&1 &
  run_pid=$!
  log "cycle=$cycle run-start pid=$run_pid"

  while kill -0 "$run_pid" >/dev/null 2>&1; do
    sleep "$POLL_SECONDS"
    snapshot_health "$cycle"
    log "cycle=$cycle health-snapshot"
  done

  wait "$run_pid"
  exit_code=$?
  snapshot_health "$cycle"
  log "cycle=$cycle run-finished exit=$exit_code"
  [[ "$exit_code" == "0" ]] || break

  update_ledger "$cycle"
  append_cycle_state "$cycle"
  log "cycle=$cycle ledger-updated completedItems=$(completed_count)"

  cycle=$((cycle + 1))
done

log "controller-finished cycles=$((cycle - 1)) completedItems=$(completed_count)"
