#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNNER_SCRIPT="$SCRIPT_DIR/run-stage1-coverage-chunked.sh"

ACTION="${1:-}"
[[ -n "$ACTION" ]] || {
  echo "Usage: $0 <start|resume|status|tail|stop> --out-dir <run-root> [runner args...]" >&2
  exit 1
}
shift || true

RUN_ROOT=""
RUNNER_ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --out-dir)
      RUN_ROOT="$2"
      RUNNER_ARGS+=("$1" "$2")
      shift 2
      ;;
    *)
      RUNNER_ARGS+=("$1")
      shift
      ;;
  esac
done

[[ -n "$RUN_ROOT" ]] || {
  echo "--out-dir is required" >&2
  exit 1
}

PID_PATH="$RUN_ROOT/chunked-runner.pid"
MAIN_LOG="$RUN_ROOT/chunked-runner.log"
LAUNCHER_LOG="$RUN_ROOT/launcher.log"
SESSION_PATH="$RUN_ROOT/chunked-runner.session"

is_running() {
  [[ -f "$PID_PATH" ]] || return 1
  local pid
  pid="$(cat "$PID_PATH" 2>/dev/null || true)"
  [[ -n "$pid" ]] || return 1
  ps -p "$pid" >/dev/null 2>&1
}

case "$ACTION" in
  start|resume)
    mkdir -p "$RUN_ROOT"
    if is_running; then
      echo "Runner already active for $RUN_ROOT (pid $(cat "$PID_PATH"))" >&2
      exit 1
    fi
    if [[ "$ACTION" == "resume" ]]; then
      RUNNER_ARGS+=(--resume)
    fi
    : > "$LAUNCHER_LOG"
    if command -v screen >/dev/null 2>&1; then
      session_name="stage1_$(basename "$RUN_ROOT" | tr -cs 'A-Za-z0-9_-' '_')"
      printf '%s\n' "$session_name" > "$SESSION_PATH"
      runner_cmd="cd $(pwd) && bash \"$RUNNER_SCRIPT\""
      for arg in "${RUNNER_ARGS[@]}"; do
        runner_cmd+=" $(printf '%q' "$arg")"
      done
      runner_cmd+=" >> $(printf '%q' "$LAUNCHER_LOG") 2>&1"
      screen -dmS "$session_name" bash -lc "$runner_cmd"
    else
      nohup bash "$RUNNER_SCRIPT" "${RUNNER_ARGS[@]}" >"$LAUNCHER_LOG" 2>&1 < /dev/null &
      echo "$!" > "$PID_PATH"
    fi
    sleep 2
    if [[ -f "$SESSION_PATH" ]]; then
      echo "session=$(cat "$SESSION_PATH")"
    fi
    if [[ -f "$PID_PATH" ]]; then
      echo "pid=$(cat "$PID_PATH")"
    fi
    if [[ -f "$MAIN_LOG" ]]; then
      tail -n 20 "$MAIN_LOG" || true
    fi
    ;;
  status)
    if is_running; then
      pid="$(cat "$PID_PATH")"
      ps -p "$pid" -o pid=,ppid=,stat=,etime=,command=
    elif [[ -f "$SESSION_PATH" ]]; then
      session_name="$(cat "$SESSION_PATH")"
      if screen -ls | grep -q "[[:space:]]${session_name}[[:space:]]"; then
        echo "screen session active: $session_name"
        if [[ -f "$PID_PATH" ]]; then
          pid="$(cat "$PID_PATH" 2>/dev/null || true)"
          [[ -n "$pid" ]] && ps -p "$pid" -o pid=,ppid=,stat=,etime=,command= || true
        fi
      else
        echo "not running"
        exit 1
      fi
    else
      echo "not running"
      exit 1
    fi
    ;;
  tail)
    tail -n 80 "$MAIN_LOG"
    ;;
  stop)
    if is_running; then
      pid="$(cat "$PID_PATH")"
      kill "$pid"
      echo "stopped pid=$pid"
    elif [[ -f "$SESSION_PATH" ]]; then
      session_name="$(cat "$SESSION_PATH")"
      if screen -ls | grep -q "[[:space:]]${session_name}[[:space:]]"; then
        screen -S "$session_name" -X quit
        echo "stopped session=$session_name"
      else
        echo "not running"
        exit 1
      fi
    else
      echo "not running"
      exit 1
    fi
    ;;
  *)
    echo "Unknown action: $ACTION" >&2
    exit 1
    ;;
esac
