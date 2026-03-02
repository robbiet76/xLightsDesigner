#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib.sh"

TEST_SEQUENCE_PATH="${TEST_SEQUENCE_PATH:-}"
CURL_MAX_TIME="${CURL_MAX_TIME:-20}"
LEGACY_ENABLE_SAVE_SEQUENCE="${LEGACY_ENABLE_SAVE_SEQUENCE:-false}"
ok=true
LEGACY_TEST_SEQUENCE_PATH=""

LEGACY_BODY=""
LEGACY_CODE=""
LEGACY_RC=0

call_legacy() {
  local payload="$1"
  local raw
  set +e
  raw="$(curl --max-time "${CURL_MAX_TIME}" -sS -w $'\n%{http_code}' -X POST "${AUTOMATION_URL}" -H "Content-Type: application/json" -d "${payload}")"
  LEGACY_RC=$?
  set -e

  if [[ ${LEGACY_RC} -ne 0 ]]; then
    LEGACY_BODY="${raw}"
    LEGACY_CODE="000"
    return
  fi

  LEGACY_CODE="${raw##*$'\n'}"
  LEGACY_BODY="${raw%$'\n'*}"
}

run_expect_http_200() {
  local name="$1"
  local payload="$2"
  call_legacy "${payload}"
  if [[ ${LEGACY_RC} -eq 0 && "${LEGACY_CODE}" == "200" ]]; then
    step_ok "${name}"
  else
    ok=false
    step_fail "${name}"
  fi
}

run_expect_code_with_substring() {
  local name="$1"
  local payload="$2"
  local code="$3"
  local text="$4"
  call_legacy "${payload}"
  if [[ ${LEGACY_RC} -eq 0 && "${LEGACY_CODE}" == "${code}" && "${LEGACY_BODY}" == *"${text}"* ]]; then
    step_ok "${name}"
  else
    ok=false
    step_fail "${name}"
  fi
}

run_expect_http_200 "legacy.getVersion" '{"cmd":"getVersion"}'
run_expect_http_200 "legacy.getModels" '{"cmd":"getModels","models":"true","groups":"true"}'
run_expect_http_200 "legacy.closeSequence.quiet" '{"cmd":"closeSequence","quiet":"true","force":"true"}'
run_expect_code_with_substring "legacy.getOpenSequence.no-open" '{"cmd":"getOpenSequence"}' 503 'Sequence not open.'

if [[ -n "${TEST_SEQUENCE_PATH}" ]]; then
  LEGACY_TEST_SEQUENCE_PATH="${TEST_SEQUENCE_PATH}"
  if [[ "${LEGACY_ENABLE_SAVE_SEQUENCE}" == "true" ]]; then
    tmp_dir="$(mktemp -d /tmp/xlights-legacy-seq.XXXXXX)"
    tmp_seq="${tmp_dir}/$(basename "${TEST_SEQUENCE_PATH}")"
    cp "${TEST_SEQUENCE_PATH}" "${tmp_seq}"
    LEGACY_TEST_SEQUENCE_PATH="${tmp_seq}"
  fi
  run_expect_http_200 "legacy.openSequence" "{\"cmd\":\"openSequence\",\"seq\":\"${LEGACY_TEST_SEQUENCE_PATH}\",\"promptIssues\":\"false\"}"
  run_expect_http_200 "legacy.getViews" '{"cmd":"getViews"}'
  if [[ "${LEGACY_ENABLE_SAVE_SEQUENCE}" == "true" ]]; then
    run_expect_http_200 "legacy.saveSequence" '{"cmd":"saveSequence"}'
  fi
  run_expect_http_200 "legacy.closeSequence.after-open" '{"cmd":"closeSequence","quiet":"true","force":"true"}'
fi

if [[ "${ok}" == "true" ]]; then
  emit_report "05-legacy-regression-smoke" true
  exit 0
fi

emit_report "05-legacy-regression-smoke" false
exit 1
