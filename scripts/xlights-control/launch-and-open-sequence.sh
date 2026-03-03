#!/usr/bin/env bash
set -euo pipefail

# Launch xLights test/debug binary first, then open a sequence via automation API.
# This avoids macOS file-open startup flows that can trigger modal prompts.

XLIGHTS_BIN="${XLIGHTS_BIN:-/Users/robterry/xLights/macOS/build/Debug/xLights.app/Contents/MacOS/xLights}"
LIBDBG_DIR="${LIBDBG_DIR:-/Users/robterry/xLights/macOS/dependencies/libdbg}"
XLIGHTS_LAUNCH_COMMAND="${XLIGHTS_LAUNCH_COMMAND:-/Users/robterry/Desktop/Show/Launch xLights Test.command}"
LAUNCH_VIA_TERMINAL="${LAUNCH_VIA_TERMINAL:-0}"
ALLOW_HEADLESS_DIRECT_LAUNCH="${ALLOW_HEADLESS_DIRECT_LAUNCH:-0}"
SEQUENCE_PATH="${1:-/Users/robterry/Desktop/Show/HolidayRoad/HolidayRoad.xsq}"
PREFERRED_PORT="${PREFERRED_PORT:-49914}"
FALLBACK_PORT="${FALLBACK_PORT:-49913}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CRASH_REPORTER="${SCRIPT_DIR}/report-latest-crash.sh"

if [[ ! -x "${XLIGHTS_BIN}" ]]; then
  echo "Missing xLights binary: ${XLIGHTS_BIN}" >&2
  exit 2
fi

if [[ ! -d "${LIBDBG_DIR}" ]]; then
  echo "Missing libdbg directory: ${LIBDBG_DIR}" >&2
  exit 2
fi

if [[ ! -f "${SEQUENCE_PATH}" ]]; then
  echo "Missing sequence file: ${SEQUENCE_PATH}" >&2
  exit 2
fi

# Mark launcher start time so crash lookup can ignore stale reports.
date +%s > /tmp/xlights-crash-since.epoch

# If xLights is already listening, reuse that instance.
port="$(lsof -nP -iTCP -sTCP:LISTEN 2>/dev/null | rg -i 'xlights.*4991[34]' | sed -E 's/.*:([0-9]+) .*/\1/' | head -n1 || true)"

if [[ -z "${port}" ]]; then
  headless_session=false
  if [[ -z "${TERM_PROGRAM:-}" && -z "${DISPLAY:-}" ]]; then
    headless_session=true
  fi

  launched=false
  if [[ "${LAUNCH_VIA_TERMINAL}" == "1" && -x "${XLIGHTS_LAUNCH_COMMAND}" ]]; then
    launch_cmd_escaped="${XLIGHTS_LAUNCH_COMMAND//\\/\\\\}"
    launch_cmd_escaped="${launch_cmd_escaped//\"/\\\"}"
    if osascript -e "tell application \"Terminal\" to do script \"${launch_cmd_escaped}\"" >/tmp/xlights-launcher.out 2>&1; then
      launched=true
    fi
  fi
  if [[ "${launched}" != "true" ]]; then
    if [[ "${headless_session}" == "true" && "${ALLOW_HEADLESS_DIRECT_LAUNCH}" != "1" ]]; then
      echo "No GUI terminal context detected; skipping direct xLights launch to avoid startup aborts." >&2
      echo "Start xLights manually (e.g. Launch xLights Test.command), then rerun this script." >&2
      exit 3
    fi
    # Fallback: start xLights detached and wait for listener.
    env DYLD_LIBRARY_PATH="${LIBDBG_DIR}" "${XLIGHTS_BIN}" >/tmp/xlights-debug.log 2>&1 &
  fi

  for _ in {1..90}; do
    port="$(lsof -nP -iTCP -sTCP:LISTEN 2>/dev/null | rg -i 'xlights.*4991[34]' | sed -E 's/.*:([0-9]+) .*/\1/' | head -n1 || true)"
    if [[ -n "${port}" ]]; then
      break
    fi
    sleep 1
  done
fi

if [[ -z "${port}" ]]; then
  echo "xLights listener not detected on ports 49913/49914." >&2
  if [[ -x "${CRASH_REPORTER}" ]]; then
    "${CRASH_REPORTER}" --since-epoch "$(cat /tmp/xlights-crash-since.epoch 2>/dev/null || echo 0)" >&2 || true
  fi
  exit 1
fi

if [[ "${port}" != "${PREFERRED_PORT}" && "${port}" != "${FALLBACK_PORT}" ]]; then
  echo "Unexpected listener port detected: ${port}" >&2
fi

base_url="http://127.0.0.1:${port}"
payload="$(jq -nc --arg f "${SEQUENCE_PATH}" '{apiVersion:2,cmd:"sequence.open",params:{file:$f,force:true}}')"
resp="$(curl -sS -X POST "${base_url}/xlDoAutomation" -H "Content-Type: application/json" -d "${payload}")"
res="$(printf "%s" "${resp}" | jq -r '.res // empty' 2>/dev/null || true)"

if [[ "${res}" != "200" ]]; then
  echo "Failed to open sequence via API on ${base_url}." >&2
  echo "${resp}" >&2
  if [[ -x "${CRASH_REPORTER}" ]]; then
    "${CRASH_REPORTER}" --since-epoch "$(cat /tmp/xlights-crash-since.epoch 2>/dev/null || echo 0)" >&2 || true
  fi
  exit 1
fi

echo "xLights ready on ${base_url}"
echo "Opened: ${SEQUENCE_PATH}"
