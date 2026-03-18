#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

iterations=6
baseline_live_every=1
extended_live_every=2
sleep_seconds=0
continue_on_failure=0

usage() {
  cat <<USAGE
usage: bash scripts/designer-training/run-overnight-training.sh [options]

options:
  --iterations N             Number of loop iterations to run. Default: 6
  --baseline-live-every N    Run promoted baseline live suite every N iterations. Default: 1
  --extended-live-every N    Run extended live suite every N iterations. Default: 2
  --sleep-seconds N          Sleep between iterations. Default: 0
  --continue-on-failure      Keep going after a failed step
  --help                     Show this help
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --iterations)
      iterations="$2"; shift 2 ;;
    --baseline-live-every)
      baseline_live_every="$2"; shift 2 ;;
    --extended-live-every)
      extended_live_every="$2"; shift 2 ;;
    --sleep-seconds)
      sleep_seconds="$2"; shift 2 ;;
    --continue-on-failure)
      continue_on_failure=1; shift ;;
    --help)
      usage; exit 0 ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2 ;;
  esac
done

log_root="$repo_root/logs/designer-training-runs"
run_id="$(date '+%Y%m%d-%H%M%S')"
run_dir="$log_root/$run_id"
mkdir -p "$run_dir"
ln -sfn "$run_dir" "$log_root/latest"

summary_file="$run_dir/summary.md"
status_file="$run_dir/status.json"
queue_file="$run_dir/pending-followups.md"
run_log="$run_dir/run.log"
touch "$queue_file" "$run_log"

cat > "$summary_file" <<SUMMARY
# Overnight Designer Training Run

- run id: $run_id
- started: $(date '+%Y-%m-%d %H:%M:%S %Z')
- repo: $repo_root
- git head: $(git rev-parse --short HEAD)
- iterations: $iterations
- baseline live cadence: every $baseline_live_every
- extended live cadence: every $extended_live_every
- continue on failure: $( [[ "$continue_on_failure" -eq 1 ]] && echo true || echo false )

Artifacts:
- run log: [run.log]($run_dir/run.log)
- follow-up queue: [pending-followups.md]($run_dir/pending-followups.md)
- latest status: [status.json]($run_dir/status.json)
SUMMARY

json_escape() {
  python3 - <<'PY' "$1"
import json, sys
print(json.dumps(sys.argv[1]))
PY
}

record_status() {
  local state="$1"
  local iteration="$2"
  local message="$3"
  printf '{\n  "state": %s,\n  "iteration": %s,\n  "message": %s,\n  "updatedAt": %s\n}\n' \
    "$(json_escape "$state")" \
    "$iteration" \
    "$(json_escape "$message")" \
    "$(json_escape "$(date '+%Y-%m-%d %H:%M:%S %Z')")" > "$status_file"
}

run_step() {
  local iteration="$1"
  local label="$2"
  shift 2
  local step_dir="$run_dir/iteration-$iteration"
  mkdir -p "$step_dir"
  local safe_label
  safe_label="$(printf '%s' "$label" | tr ' /' '__')"
  local out_file="$step_dir/$safe_label.json"

  echo "[$(date '+%Y-%m-%d %H:%M:%S')] iteration=$iteration step=$label" | tee -a "$run_log"
  if "$@" > "$out_file" 2>> "$run_log"; then
    echo "  status=passed output=$out_file" | tee -a "$run_log"
    return 0
  fi

  echo "  status=failed output=$out_file" | tee -a "$run_log"
  if [[ "$continue_on_failure" -eq 1 ]]; then
    return 1
  fi
  return 2
}

record_status "running" 0 "Run started"

echo >> "$summary_file"
echo "## Iterations" >> "$summary_file"

for iteration in $(seq 1 "$iterations"); do
  if [[ -f "$run_dir/STOP" ]]; then
    record_status "stopped" "$iteration" "STOP file detected"
    echo "- iteration $iteration: stopped by STOP file" >> "$summary_file"
    break
  fi

  iteration_dir="$run_dir/iteration-$iteration"
  mkdir -p "$iteration_dir"
  echo "- iteration $iteration" >> "$summary_file"

  if ! run_step "$iteration" "offline-eval" node apps/xlightsdesigner-ui/eval/run-designer-eval.mjs; then
    rc=$?
    echo "  - offline eval failed" >> "$summary_file"
    if [[ "$rc" -eq 2 ]]; then
      record_status "failed" "$iteration" "Offline eval failed"
      exit 1
    fi
  else
    offline_summary="$(jq -c '.summary' "$iteration_dir/offline-eval.json" 2>/dev/null || true)"
    if [[ -n "$offline_summary" ]]; then
      echo "  - offline: $offline_summary" >> "$summary_file"
    fi
  fi

  if [[ "$baseline_live_every" -gt 0 ]] && (( iteration % baseline_live_every == 0 )); then
    baseline_payload="$(cat apps/xlightsdesigner-ui/eval/live-design-validation-suite-v1.json)"
    if ! run_step "$iteration" "baseline-live-suite" node scripts/desktop/automation.mjs run-live-design-validation-suite "$baseline_payload"; then
      rc=$?
      echo "  - baseline live suite failed" >> "$summary_file"
      if [[ "$rc" -eq 2 ]]; then
        record_status "failed" "$iteration" "Baseline live suite failed"
        exit 1
      fi
    else
      baseline_summary="$(jq -c '{ok, passedScenarios, totalScenarios}' "$iteration_dir/baseline-live-suite.json" 2>/dev/null || true)"
      if [[ -n "$baseline_summary" ]]; then
        echo "  - baseline live: $baseline_summary" >> "$summary_file"
      fi
    fi
  fi

  if [[ "$extended_live_every" -gt 0 ]] && (( iteration % extended_live_every == 0 )); then
    extended_payload="$(cat apps/xlightsdesigner-ui/eval/live-design-validation-suite-extended-v1.json)"
    if ! run_step "$iteration" "extended-live-suite" node scripts/desktop/automation.mjs run-live-design-validation-suite "$extended_payload"; then
      rc=$?
      echo "  - extended live suite failed" >> "$summary_file"
      if [[ "$rc" -eq 2 ]]; then
        record_status "failed" "$iteration" "Extended live suite failed"
        exit 1
      fi
    else
      extended_summary="$(jq -c '{ok, passedScenarios, totalScenarios}' "$iteration_dir/extended-live-suite.json" 2>/dev/null || true)"
      if [[ -n "$extended_summary" ]]; then
        echo "  - extended live: $extended_summary" >> "$summary_file"
      fi
    fi
  fi

  record_status "running" "$iteration" "Iteration $iteration complete"
  if (( sleep_seconds > 0 && iteration < iterations )); then
    sleep "$sleep_seconds"
  fi
done

if [[ -f "$run_dir/STOP" ]]; then
  echo >> "$summary_file"
  echo "Stopped: $(date '+%Y-%m-%d %H:%M:%S %Z')" >> "$summary_file"
  exit 0
fi

record_status "completed" "$iterations" "Run completed"
echo >> "$summary_file"
echo "Completed: $(date '+%Y-%m-%d %H:%M:%S %Z')" >> "$summary_file"
