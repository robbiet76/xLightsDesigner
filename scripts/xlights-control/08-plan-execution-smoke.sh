#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib.sh"

ok=true
track_name="AgentPlan_$(date +%s)"
fail_track="AgentPlanFail_$(date +%s)"

ensure_sequence_open() {
  local body is_open payload
  body="$(post_cmd '{"apiVersion":2,"cmd":"sequence.getOpen","params":{}}')"
  body="$(normalize_json_body "${body}")"
  if ! json_has_res_200 "${body}"; then
    ok=false
    step_fail "sequence.getOpen"
    return
  fi
  is_open="$(echo "${body}" | jq -r '.data.isOpen // false')"
  if [[ "${is_open}" == "true" ]]; then
    step_ok "sequence.getOpen"
    return
  fi
  if [[ -z "${TEST_SEQUENCE_PATH:-}" ]]; then
    ok=false
    step_fail "sequence.open" "TEST_SEQUENCE_PATH_REQUIRED"
    return
  fi
  payload="$(jq -cn --arg file "${TEST_SEQUENCE_PATH}" '{apiVersion:2,cmd:"sequence.open",params:{file:$file,force:true,promptIssues:false}}')"
  body="$(post_cmd "${payload}")"
  body="$(normalize_json_body "${body}")"
  if json_has_res_200 "${body}"; then
    step_ok "sequence.open"
  else
    ok=false
    step_fail "sequence.open"
  fi
}

run_execute_plan_success() {
  local payload body
  payload="$(jq -cn --arg track "${track_name}" '{
    apiVersion:2,
    cmd:"system.executePlan",
    params:{
      atomic:true,
      commands:[
        {cmd:"timing.createTrack",params:{trackName:$track,replaceIfExists:true}},
        {cmd:"timing.insertMarks",params:{trackName:$track,marks:[{startMs:0,endMs:500,label:"A"},{startMs:500,endMs:1000,label:"B"}]}}
      ]
    }
  }')"
  body="$(post_cmd "${payload}")"
  body="$(normalize_json_body "${body}")"
  if json_has_res_200 "${body}" && echo "${body}" | jq -e '.data.executedCount >= 2' >/dev/null 2>&1; then
    step_ok "system.executePlan.success"
  else
    ok=false
    step_fail "system.executePlan.success"
  fi
}

verify_plan_results() {
  local payload body
  payload="$(jq -cn --arg track "${track_name}" '{apiVersion:2,cmd:"timing.getMarks",params:{trackName:$track}}')"
  body="$(post_cmd "${payload}")"
  body="$(normalize_json_body "${body}")"
  if json_has_res_200 "${body}" && echo "${body}" | jq -e '.data.marks | length == 2' >/dev/null 2>&1; then
    step_ok "system.executePlan.state"
  else
    ok=false
    step_fail "system.executePlan.state"
  fi
}

run_execute_plan_validation_fail() {
  local payload body
  payload="$(jq -cn --arg track "${fail_track}" '{
    apiVersion:2,
    cmd:"system.executePlan",
    params:{
      atomic:true,
      commands:[
        {cmd:"timing.createTrack",params:{trackName:$track,replaceIfExists:true}},
        {cmd:"timing.noSuchCommand",params:{}}
      ]
    }
  }')"
  body="$(post_cmd "${payload}")"
  body="$(normalize_json_body "${body}")"
  if [[ "${body}" == *'"code":"UNKNOWN_COMMAND"'* || "${body}" == *'"code":"VALIDATION_ERROR"'* ]]; then
    step_ok "system.executePlan.validation-fail"
  else
    ok=false
    step_fail "system.executePlan.validation-fail"
  fi
}

verify_validation_fail_no_side_effect() {
  local payload body
  payload="$(jq -cn --arg track "${fail_track}" '{apiVersion:2,cmd:"timing.getTracks",params:{}}')"
  body="$(post_cmd "${payload}")"
  body="$(normalize_json_body "${body}")"
  if json_has_res_200 "${body}" && echo "${body}" | jq -e --arg name "${fail_track}" '.data.tracks | map(.name) | index($name) | not' >/dev/null 2>&1; then
    step_ok "system.executePlan.validation-fail.no-side-effect"
  else
    ok=false
    step_fail "system.executePlan.validation-fail.no-side-effect"
  fi
}

cleanup_tracks() {
  local payload body
  payload="$(jq -cn --arg track "${track_name}" '{apiVersion:2,cmd:"timing.deleteTrack",params:{trackName:$track}}')"
  body="$(post_cmd "${payload}")"
  body="$(normalize_json_body "${body}")"
  if json_has_res_200 "${body}" || [[ "${body}" == *'"code":"TRACK_NOT_FOUND"'* ]]; then
    step_ok "cleanup.track"
  else
    ok=false
    step_fail "cleanup.track"
  fi
}

ensure_sequence_open
run_execute_plan_success
verify_plan_results
run_execute_plan_validation_fail
verify_validation_fail_no_side_effect
cleanup_tracks

if [[ "${ok}" == "true" ]]; then
  emit_report "08-plan-execution-smoke" true
  exit 0
fi

emit_report "08-plan-execution-smoke" false
exit 1
