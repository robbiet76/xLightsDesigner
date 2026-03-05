#!/usr/bin/env bash
set -euo pipefail

APP_PATH="${1:-/Applications/xLightsDesigner.app}"
LOG_PREFIX="[xld-nondev-validate]"

say() {
  echo "$LOG_PREFIX $*"
}

fail() {
  echo "$LOG_PREFIX FAIL: $*" >&2
  exit 1
}

say "Checking app bundle at: $APP_PATH"
[[ -d "$APP_PATH" ]] || fail "App bundle not found"
[[ -x "$APP_PATH/Contents/MacOS/xLightsDesigner" ]] || fail "Executable missing"

say "Launching app..."
open "$APP_PATH"

sleep 3
if ! pgrep -f "/xLightsDesigner.app/Contents/MacOS/xLightsDesigner" >/dev/null 2>&1; then
  fail "App process not detected after launch"
fi
say "App process detected"

say "Attempting graceful quit"
osascript -e 'tell application "xLightsDesigner" to quit' >/dev/null 2>&1 || true
sleep 2

if pgrep -f "/xLightsDesigner.app/Contents/MacOS/xLightsDesigner" >/dev/null 2>&1; then
  say "Process still running; forcing termination"
  pkill -f "/xLightsDesigner.app/Contents/MacOS/xLightsDesigner" || true
fi

say "PASS: install + launch baseline check complete"
