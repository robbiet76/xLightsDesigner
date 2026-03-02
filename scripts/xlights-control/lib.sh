#!/usr/bin/env bash
set -euo pipefail

XLIGHTS_BASE_URL="${XLIGHTS_BASE_URL:-http://127.0.0.1:49914}"
AUTOMATION_URL="${XLIGHTS_BASE_URL}/xlDoAutomation"

TMP_REPORT_STEPS=()

post_cmd() {
  local payload="$1"
  curl -sS -X POST "${AUTOMATION_URL}" -H "Content-Type: application/json" -d "${payload}"
}

step_ok() {
  local name="$1"
  TMP_REPORT_STEPS+=("{\"name\":\"${name}\",\"passed\":true}")
}

step_fail() {
  local name="$1"
  local code="${2:-UNKNOWN}"
  TMP_REPORT_STEPS+=("{\"name\":\"${name}\",\"passed\":false,\"error\":\"${code}\"}")
}

json_has_res_200() {
  local body="$1"
  [[ "${body}" == *'"res":200'* ]]
}

emit_report() {
  local suite="$1"
  local passed="$2"
  local joined
  joined="$(IFS=,; echo "${TMP_REPORT_STEPS[*]:-}")"
  echo "{\"suite\":\"${suite}\",\"passed\":${passed},\"steps\":[${joined}]}"
}
