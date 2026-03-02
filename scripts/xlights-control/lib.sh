#!/usr/bin/env bash
set -euo pipefail

XLIGHTS_BASE_URL="${XLIGHTS_BASE_URL:-http://127.0.0.1:49914}"
AUTOMATION_URL="${XLIGHTS_BASE_URL}/xlDoAutomation"
CURL_MAX_TIME="${CURL_MAX_TIME:-20}"

TMP_REPORT_STEPS=()

post_cmd() {
  local payload="$1"
  curl --max-time "${CURL_MAX_TIME}" -sS -X POST "${AUTOMATION_URL}" -H "Content-Type: application/json" -d "${payload}"
}

normalize_json_body() {
  local body="$1"
  printf "%s" "${body}" | sed -n 's/^[^{]*//;p'
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

step_skip() {
  local name="$1"
  local reason="${2:-SKIPPED}"
  TMP_REPORT_STEPS+=("{\"name\":\"${name}\",\"passed\":true,\"skipped\":true,\"reason\":\"${reason}\"}")
}

extract_error_code() {
  local body="$1"
  local code=""
  if command -v jq >/dev/null 2>&1; then
    code="$(printf "%s" "${body}" | jq -r '.error.code // .code // empty' 2>/dev/null || true)"
  fi
  if [[ -z "${code}" ]]; then
    code="$(printf "%s" "${body}" | sed -n 's/.*"code":"\([^"]*\)".*/\1/p' | head -n1)"
  fi
  if [[ -z "${code}" ]]; then
    code="UNKNOWN"
  fi
  printf "%s" "${code}"
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
