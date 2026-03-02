#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib.sh"

TEST_SEQUENCE_PATH="${TEST_SEQUENCE_PATH:-}"
ok=true

run_expect_200() {
  local name="$1"
  local payload="$2"
  local body
  body="$(post_cmd "${payload}")"
  if json_has_res_200 "${body}"; then
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
  local body
  body="$(post_cmd "${payload}")"
  if [[ "${body}" == *"\"res\":${code}"* && "${body}" == *"${text}"* ]]; then
    step_ok "${name}"
  else
    ok=false
    step_fail "${name}"
  fi
}

run_expect_200 "legacy.getVersion" '{"cmd":"getVersion"}'
run_expect_200 "legacy.getModels" '{"cmd":"getModels","models":"true","groups":"true"}'
run_expect_200 "legacy.closeSequence.quiet" '{"cmd":"closeSequence","quiet":"true"}'
run_expect_code_with_substring "legacy.getOpenSequence.no-open" '{"cmd":"getOpenSequence"}' 503 'Sequence not open.'

if [[ -n "${TEST_SEQUENCE_PATH}" ]]; then
  run_expect_200 "legacy.openSequence" "{\"cmd\":\"openSequence\",\"seq\":\"${TEST_SEQUENCE_PATH}\",\"promptIssues\":\"false\"}"
  run_expect_200 "legacy.getViews" '{"cmd":"getViews"}'
  run_expect_200 "legacy.saveSequence" '{"cmd":"saveSequence"}'
  run_expect_200 "legacy.closeSequence.after-open" '{"cmd":"closeSequence","quiet":"true"}'
fi

if [[ "${ok}" == "true" ]]; then
  emit_report "05-legacy-regression-smoke" true
  exit 0
fi

emit_report "05-legacy-regression-smoke" false
exit 1
