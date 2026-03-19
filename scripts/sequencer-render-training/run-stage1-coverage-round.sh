#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

BACKLOG="/tmp/render-training-stage1-coverage-backlog.v1.json"
LIMIT=40
POLL_SECONDS=300
RUN_ROOT=""
STAMP="$(date -u +"%Y%m%dT%H%M%SZ")"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --backlog)
      BACKLOG="$2"
      shift 2
      ;;
    --limit)
      LIMIT="$2"
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

mkdir -p "$RUN_ROOT/generated-base-manifests"
PLAN_PATH="$RUN_ROOT/stage1-coverage-plan.json"
PLAN_SUMMARY_PATH="$RUN_ROOT/stage1-coverage-plan-summary.json"
HEALTH_LOG="$RUN_ROOT/health.log"
HEALTH_JSONL="$RUN_ROOT/health.jsonl"
MAIN_LOG="$RUN_ROOT/runner.log"
: > "$HEALTH_LOG"
: > "$HEALTH_JSONL"
: > "$MAIN_LOG"

log() {
  printf '[stage1-coverage] %s\n' "$*" | tee -a "$MAIN_LOG" >/dev/null
}

python3 "$SCRIPT_DIR/generate-stage1-coverage-plan.py" \
  --backlog "$BACKLOG" \
  --out-plan "$PLAN_PATH" \
  --out-manifest-dir "$RUN_ROOT/generated-base-manifests" \
  --summary-out "$PLAN_SUMMARY_PATH" \
  --limit "$LIMIT"

log "plan-generated plan=$PLAN_PATH summary=$PLAN_SUMMARY_PATH"

bash "$SCRIPT_DIR/run-registry-plan.sh" \
  --plan "$PLAN_PATH" \
  --registry "$SCRIPT_DIR/effect-parameter-registry.json" \
  --out-dir "$RUN_ROOT/run" >>"$MAIN_LOG" 2>&1 &
RUN_PID=$!
log "run-start pid=$RUN_PID"

snapshot_health() {
  local now summary_path
  now="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  summary_path="$RUN_ROOT/run/registry-run-summary.json"
  if [[ -f "$summary_path" ]]; then
    jq -cn \
      --arg ts "$now" \
      --slurpfile summary "$summary_path" \
      '{timestamp:$ts,healthy:true,packCount:($summary[0].packCount // 0),passedCount:($summary[0].passedCount // 0),failedCount:($summary[0].failedCount // 0)}' \
      | tee -a "$HEALTH_JSONL" >/dev/null
    printf '[stage1-coverage-health] %s packCount=%s passed=%s failed=%s\n' \
      "$now" \
      "$(jq -r '.packCount // 0' "$summary_path")" \
      "$(jq -r '.passedCount // 0' "$summary_path")" \
      "$(jq -r '.failedCount // 0' "$summary_path")" >>"$HEALTH_LOG"
  else
    jq -cn --arg ts "$now" '{timestamp:$ts,healthy:true,packCount:0,passedCount:0,failedCount:0,summaryMissing:true}' \
      | tee -a "$HEALTH_JSONL" >/dev/null
    printf '[stage1-coverage-health] %s summary=pending\n' "$now" >>"$HEALTH_LOG"
  fi
}

while kill -0 "$RUN_PID" >/dev/null 2>&1; do
  sleep "$POLL_SECONDS"
  snapshot_health
  log "health-snapshot"
done

wait "$RUN_PID"
EXIT_CODE=$?
snapshot_health
log "run-finished exit=$EXIT_CODE"
exit "$EXIT_CODE"
