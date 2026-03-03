#!/usr/bin/env bash
set -euo pipefail

XLIGHTS_BASE_URL="${XLIGHTS_BASE_URL:-http://127.0.0.1:49914}"
AUTOMATION_URL="${XLIGHTS_BASE_URL}/xlDoAutomation"
SHOW_ROOT="${SHOW_ROOT:-/Users/robterry/Desktop/Show}"
TEST_ROOT="${TEST_ROOT:-${SHOW_ROOT}/Tests}"
SOURCE_SEQ="${SOURCE_SEQ:-${SHOW_ROOT}/HolidayRoad/HolidayRoad.xsq}"
SOURCE_FSEQ="${SOURCE_FSEQ:-${SHOW_ROOT}/HolidayRoad/HolidayRoad.fseq}"
REPORT_PATH="${REPORT_PATH:-/tmp/xlights-control-reports/sequence-session-scenarios-$(date +%Y%m%d-%H%M%S).json}"

mkdir -p "${TEST_ROOT}"
mkdir -p "$(dirname "${REPORT_PATH}")"

if [[ ! -f "${SOURCE_SEQ}" ]]; then
  echo "Missing SOURCE_SEQ: ${SOURCE_SEQ}" >&2
  exit 2
fi

seed_existing_test_copy() {
  cp "${SOURCE_SEQ}" "${TEST_ROOT}/HolidayRoad-TestCopy.xsq"
  if [[ -f "${SOURCE_FSEQ}" ]]; then
    cp "${SOURCE_FSEQ}" "${TEST_ROOT}/HolidayRoad-TestCopy.fseq"
  fi
}

post_cmd() {
  local payload="$1"
  curl --max-time 20 -sS -X POST "${AUTOMATION_URL}" -H "Content-Type: application/json" -d "${payload}"
}

normalize_json_body() {
  local body="$1"
  printf "%s" "${body}" | sed -n 's/^[^{]*//;p'
}

json_res() {
  local body="$1"
  printf "%s" "${body}" | jq -r '.res // empty' 2>/dev/null || true
}

json_code() {
  local body="$1"
  printf "%s" "${body}" | jq -r '.error.code // empty' 2>/dev/null || true
}

step_ok() {
  local name="$1"
  STEPS+=("{\"name\":\"${name}\",\"passed\":true}")
}

step_fail() {
  local name="$1"
  local code="${2:-UNKNOWN}"
  STEPS+=("{\"name\":\"${name}\",\"passed\":false,\"error\":\"${code}\"}")
  OVERALL=false
}

expect_200() {
  local name="$1"
  local body="$2"
  body="$(normalize_json_body "${body}")"
  local res
  res="$(json_res "${body}")"
  if [[ "${res}" == "200" ]]; then
    step_ok "${name}"
  else
    step_fail "${name}" "$(json_code "${body}")"
  fi
}

expect_open_path_contains() {
  local name="$1"
  local body="$2"
  local needle="$3"
  body="$(normalize_json_body "${body}")"
  local res
  local path
  res="$(json_res "${body}")"
  path="$(printf "%s" "${body}" | jq -r '.data.sequence.path // .data.path // empty' 2>/dev/null || true)"
  if [[ "${res}" == "200" && "${path}" == *"${needle}"* ]]; then
    step_ok "${name}"
  else
    step_fail "${name}" "$(json_code "${body}")"
  fi
}

expect_is_open_value() {
  local name="$1"
  local body="$2"
  local expected="$3"
  body="$(normalize_json_body "${body}")"
  local res
  local actual
  res="$(json_res "${body}")"
  actual="$(printf "%s" "${body}" | jq -r '.data.isOpen // empty' 2>/dev/null || true)"
  if [[ "${res}" == "200" && "${actual}" == "${expected}" ]]; then
    step_ok "${name}"
  else
    step_fail "${name}" "$(json_code "${body}")"
  fi
}

expect_no_open_with_retry() {
  local name="$1"
  local attempts="${2:-10}"
  local delay_secs="${3:-0.2}"
  local body
  local i
  for ((i=1; i<=attempts; i++)); do
    body="$(post_cmd '{"apiVersion":2,"cmd":"sequence.getOpen","params":{}}')"
    body="$(normalize_json_body "${body}")"
    if [[ "$(json_res "${body}")" == "200" ]]; then
      if [[ "$(printf "%s" "${body}" | jq -r '.data.isOpen // empty' 2>/dev/null || true)" == "false" ]]; then
        step_ok "${name}"
        return
      fi
    fi
    sleep "${delay_secs}"
  done
  step_fail "${name}" "NO_OPEN_STATE_NOT_REACHED"
}

mutate_unsaved() {
  local track="$1"
  local body
  body="$(post_cmd "{\"apiVersion\":2,\"cmd\":\"timing.createTrack\",\"params\":{\"trackName\":\"${track}\",\"replaceIfExists\":true}}")"
  expect_200 "mutate.${track}.createTrack" "${body}"
  body="$(post_cmd "{\"apiVersion\":2,\"cmd\":\"timing.insertMarks\",\"params\":{\"trackName\":\"${track}\",\"marks\":[{\"startMs\":1000,\"label\":\"A\"},{\"startMs\":2000,\"label\":\"B\"}]}}")"
  expect_200 "mutate.${track}.insertMarks" "${body}"
}

OVERALL=true
STEPS=()

seed_existing_test_copy

# 1) Open xLights but don't open or create a sequence.
body="$(post_cmd '{"apiVersion":2,"cmd":"sequence.close","params":{"force":true,"quiet":true}}')"
expect_200 "s1.closeAnyOpen" "${body}"
expect_no_open_with_retry "s1.verifyNoOpenSequence"

# 2) Open xLights and open existing sequence (HolidayRoad).
body="$(post_cmd "{\"apiVersion\":2,\"cmd\":\"sequence.open\",\"params\":{\"file\":\"${SOURCE_SEQ}\",\"force\":true}}")"
expect_open_path_contains "s2.openHolidayRoad" "${body}" "HolidayRoad.xsq"

# 3) Open xLights and create a new sequence.
body="$(post_cmd '{"apiVersion":2,"cmd":"sequence.create","params":{"durationMs":30000,"frameMs":50,"force":true}}')"
expect_200 "s3.createNewSequence" "${body}"
body="$(post_cmd '{"apiVersion":2,"cmd":"sequence.getOpen","params":{}}')"
expect_is_open_value "s3.verifyOpenAfterCreate" "${body}" "true"
body="$(post_cmd "{\"apiVersion\":2,\"cmd\":\"sequence.save\",\"params\":{\"file\":\"${TEST_ROOT}/Scenario3-SaveAs.xsq\"}}")"
expect_200 "s3.saveAsSequence" "${body}"
mutate_unsaved "Scenario3SaveChecks"
body="$(post_cmd '{"apiVersion":2,"cmd":"sequence.save","params":{}}')"
expect_200 "s3.saveCurrentSequence" "${body}"

# 4) Open existing sequence while xLights is already open.
# 4a) Save previous sequence (save as), then open existing.
body="$(post_cmd '{"apiVersion":2,"cmd":"sequence.create","params":{"durationMs":30000,"frameMs":50,"force":true}}')"
expect_200 "s4a.setupCreateSequence" "${body}"
mutate_unsaved "Scenario4A"
body="$(post_cmd "{\"apiVersion\":2,\"cmd\":\"sequence.save\",\"params\":{\"file\":\"${TEST_ROOT}/Scenario4A-SavedBeforeOpen.xsq\"}}")"
expect_200 "s4a.saveAsBeforeOpen" "${body}"
body="$(post_cmd "{\"apiVersion\":2,\"cmd\":\"sequence.open\",\"params\":{\"file\":\"${TEST_ROOT}/HolidayRoad-TestCopy.xsq\",\"force\":true}}")"
expect_open_path_contains "s4a.openExistingWhileOpen" "${body}" "HolidayRoad-TestCopy.xsq"

# 4b) Don't save previous sequence, then open existing.
body="$(post_cmd '{"apiVersion":2,"cmd":"sequence.create","params":{"durationMs":30000,"frameMs":50,"force":true}}')"
expect_200 "s4b.setupCreateSequence" "${body}"
mutate_unsaved "Scenario4B"
body="$(post_cmd "{\"apiVersion\":2,\"cmd\":\"sequence.open\",\"params\":{\"file\":\"${TEST_ROOT}/HolidayRoad-TestCopy.xsq\",\"force\":true}}")"
expect_open_path_contains "s4b.openExistingWithoutSave" "${body}" "HolidayRoad-TestCopy.xsq"

# 5) Create new sequence while xLights is already open.
# 5a) Save previous sequence (save as), then create new.
body="$(post_cmd "{\"apiVersion\":2,\"cmd\":\"sequence.open\",\"params\":{\"file\":\"${TEST_ROOT}/HolidayRoad-TestCopy.xsq\",\"force\":true}}")"
expect_open_path_contains "s5a.setupOpenExisting" "${body}" "HolidayRoad-TestCopy.xsq"
mutate_unsaved "Scenario5A"
body="$(post_cmd "{\"apiVersion\":2,\"cmd\":\"sequence.save\",\"params\":{\"file\":\"${TEST_ROOT}/Scenario5A-SavedBeforeCreate.xsq\"}}")"
expect_200 "s5a.saveAsBeforeCreate" "${body}"
body="$(post_cmd '{"apiVersion":2,"cmd":"sequence.create","params":{"durationMs":45000,"frameMs":50,"force":true}}')"
expect_200 "s5a.createNewAfterSave" "${body}"

# 5b) Don't save previous sequence, then create new.
mutate_unsaved "Scenario5B"
body="$(post_cmd '{"apiVersion":2,"cmd":"sequence.create","params":{"durationMs":45000,"frameMs":50,"force":true}}')"
expect_200 "s5b.createNewWithoutSave" "${body}"

joined="$(IFS=,; echo "${STEPS[*]}")"
printf '{"suite":"12-sequence-session-scenarios","passed":%s,"baseUrl":"%s","showRoot":"%s","testRoot":"%s","steps":[%s]}\n' \
  "${OVERALL}" "${XLIGHTS_BASE_URL}" "${SHOW_ROOT}" "${TEST_ROOT}" "${joined}" | tee "${REPORT_PATH}"

if [[ "${OVERALL}" == "true" ]]; then
  exit 0
fi
exit 1
