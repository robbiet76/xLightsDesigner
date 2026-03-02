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
    step_fail "${name}"
  fi
}

run "timing.createTrack" "{\"apiVersion\":2,\"cmd\":\"timing.createTrack\",\"params\":{\"trackName\":\"${TEST_TIMING_TRACK}\",\"replaceIfExists\":true}}"
run "timing.insertMarks" "{\"apiVersion\":2,\"cmd\":\"timing.insertMarks\",\"params\":{\"trackName\":\"${TEST_TIMING_TRACK}\",\"marks\":[{\"startMs\":1000,\"label\":\"A\"},{\"startMs\":2000,\"label\":\"B\"}]}}"
run "timing.getTrackSummary" "{\"apiVersion\":2,\"cmd\":\"timing.getTrackSummary\",\"params\":{\"trackName\":\"${TEST_TIMING_TRACK}\"}}"

if [[ -n "${TEST_MODEL_NAME}" ]]; then
  run "effects.create" "{\"apiVersion\":2,\"cmd\":\"effects.create\",\"params\":{\"modelName\":\"${TEST_MODEL_NAME}\",\"layerIndex\":0,\"effectName\":\"On\",\"startMs\":1000,\"endMs\":2000}}"
  run "effects.list" "{\"apiVersion\":2,\"cmd\":\"effects.list\",\"params\":{\"modelName\":\"${TEST_MODEL_NAME}\",\"layerIndex\":0}}"
fi

run "sequencer.getDisplayElementOrder" '{"apiVersion":2,"cmd":"sequencer.getDisplayElementOrder","params":{}}'

if [[ "${ok}" == "true" ]]; then
  emit_report "03-sequencer-mutation-smoke" true
  exit 0
fi

emit_report "03-sequencer-mutation-smoke" false
exit 1
