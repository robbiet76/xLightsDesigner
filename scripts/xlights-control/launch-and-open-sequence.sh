#!/usr/bin/env bash
set -euo pipefail

# Launch xLights test/debug binary first, then open a sequence via automation API.
# This avoids macOS file-open startup flows that can trigger modal prompts.

XLIGHTS_BIN="${XLIGHTS_BIN:-/Users/robterry/xLights/macOS/build/Debug/xLights.app/Contents/MacOS/xLights}"
LIBDBG_DIR="${LIBDBG_DIR:-/Users/robterry/xLights/macOS/dependencies/libdbg}"
SEQUENCE_PATH="${1:-/Users/robterry/Desktop/Show/HolidayRoad/HolidayRoad.xsq}"
PREFERRED_PORT="${PREFERRED_PORT:-49914}"
FALLBACK_PORT="${FALLBACK_PORT:-49913}"

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

# If xLights is already listening, reuse that instance.
port="$(lsof -nP -iTCP -sTCP:LISTEN 2>/dev/null | rg -i 'xlights.*4991[34]' | sed -E 's/.*:([0-9]+) .*/\1/' | head -n1 || true)"

if [[ -z "${port}" ]]; then
  # Start xLights detached and wait for listener.
  env DYLD_LIBRARY_PATH="${LIBDBG_DIR}" "${XLIGHTS_BIN}" >/tmp/xlights-debug.log 2>&1 &
  disown
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
  exit 1
fi

echo "xLights ready on ${base_url}"
echo "Opened: ${SEQUENCE_PATH}"
