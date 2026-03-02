#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib.sh"

TEST_TIMING_TRACK="${TEST_TIMING_TRACK:-AgentTiming}"
TEST_MODEL_NAME="${TEST_MODEL_NAME:-}"
ok=true

run() {
  local name="$1"
  local payload="$2"
  local body
  body="$(post_cmd "${payload}")"
  if json_has_res_200 "${body}"; then
    step_ok "${name}"
  else
    ok=false
    step_fail "${name}" "$(extract_error_code "${body}")"
  fi
}

resolve_effect_model_name() {
  local body
  body="$(post_cmd '{"apiVersion":2,"cmd":"layout.getDisplayElements","params":{}}')"
  if ! json_has_res_200 "${body}"; then
    printf "%s" "${TEST_MODEL_NAME}"
    return 0
  fi

  if ! command -v jq >/dev/null 2>&1; then
    printf "%s" "${TEST_MODEL_NAME}"
    return 0
  fi

  local resolved=""
  if [[ -n "${TEST_MODEL_NAME}" ]]; then
    resolved="$(printf "%s" "${body}" | jq -r --arg n "${TEST_MODEL_NAME}" \
      '.data.elements[]? | select((.type != "timing") and (.name == $n or .id == $n)) | .name' | head -n1)"
  fi
  if [[ -z "${resolved}" ]]; then
    resolved="$(printf "%s" "${body}" | jq -r '.data.elements[]? | select(.type != "timing") | .name' | head -n1)"
  fi

  printf "%s" "${resolved}"
}

run "timing.createTrack" "{\"apiVersion\":2,\"cmd\":\"timing.createTrack\",\"params\":{\"trackName\":\"${TEST_TIMING_TRACK}\",\"replaceIfExists\":true}}"
run "timing.insertMarks" "{\"apiVersion\":2,\"cmd\":\"timing.insertMarks\",\"params\":{\"trackName\":\"${TEST_TIMING_TRACK}\",\"marks\":[{\"startMs\":1000,\"label\":\"A\"},{\"startMs\":2000,\"label\":\"B\"}]}}"
run "timing.getTrackSummary" "{\"apiVersion\":2,\"cmd\":\"timing.getTrackSummary\",\"params\":{\"trackName\":\"${TEST_TIMING_TRACK}\"}}"

EFFECT_MODEL_NAME="$(resolve_effect_model_name)"
if [[ -n "${EFFECT_MODEL_NAME}" ]]; then
  run "effects.create" "{\"apiVersion\":2,\"cmd\":\"effects.create\",\"params\":{\"modelName\":\"${EFFECT_MODEL_NAME}\",\"layerIndex\":0,\"effectName\":\"On\",\"startMs\":1000,\"endMs\":2000}}"
  run "effects.list" "{\"apiVersion\":2,\"cmd\":\"effects.list\",\"params\":{\"modelName\":\"${EFFECT_MODEL_NAME}\",\"layerIndex\":0}}"
else
  step_skip "effects.create" "NO_NON_TIMING_MODEL"
  step_skip "effects.list" "NO_NON_TIMING_MODEL"
fi

run "sequencer.getDisplayElementOrder" '{"apiVersion":2,"cmd":"sequencer.getDisplayElementOrder","params":{}}'

if [[ "${ok}" == "true" ]]; then
  emit_report "03-sequencer-mutation-smoke" true
  exit 0
fi

emit_report "03-sequencer-mutation-smoke" false
exit 1
