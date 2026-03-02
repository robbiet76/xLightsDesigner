#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib.sh"

ok=true
job_id=""
source_track="AgentJobBeats_$(date +%s)"
target_track="AgentJobBars_$(date +%s)"

ensure_sequence_open() {
  local body is_open
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

  body="$(post_cmd '{"apiVersion":2,"cmd":"sequence.create","params":{"durationMs":12000,"frameMs":50,"force":true}}')"
  body="$(normalize_json_body "${body}")"
  if json_has_res_200 "${body}"; then
    step_ok "sequence.create"
  else
    ok=false
    step_fail "sequence.create"
  fi
}

create_source_track() {
  local payload body
  payload="$(jq -cn --arg track "${source_track}" \
    '{apiVersion:2,cmd:"timing.createTrack",params:{trackName:$track,replaceIfExists:true}}')"
  body="$(post_cmd "${payload}")"
  body="$(normalize_json_body "${body}")"
  if ! json_has_res_200 "${body}"; then
    ok=false
    step_fail "timing.createTrack.source"
    return
  fi

  payload="$(jq -cn --arg track "${source_track}" \
    '{apiVersion:2,cmd:"timing.insertMarks",params:{trackName:$track,marks:[{startMs:0,endMs:500,label:"beat-1"},{startMs:500,endMs:1000,label:"beat-2"},{startMs:1000,endMs:1500,label:"beat-3"},{startMs:1500,endMs:2000,label:"beat-4"},{startMs:2000,endMs:2500,label:"beat-5"}]}}')"
  body="$(post_cmd "${payload}")"
  body="$(normalize_json_body "${body}")"
  if json_has_res_200 "${body}"; then
    step_ok "timing.insertMarks.source"
  else
    ok=false
    step_fail "timing.insertMarks.source"
  fi
}

start_async_job() {
  local payload body
  payload="$(jq -cn --arg src "${source_track}" --arg dst "${target_track}" \
    '{apiVersion:2,cmd:"timing.createBarsFromBeats",params:{sourceTrackName:$src,trackName:$dst,beatsPerBar:4,replaceIfExists:true,async:true}}')"
  body="$(post_cmd "${payload}")"
  body="$(normalize_json_body "${body}")"
  if [[ "${body}" != *'"res":202'* ]]; then
    ok=false
    step_fail "timing.createBarsFromBeats.async"
    return
  fi

  job_id="$(echo "${body}" | jq -r '.data.jobId // empty')"
  if [[ -z "${job_id}" ]]; then
    ok=false
    step_fail "timing.createBarsFromBeats.jobId"
    return
  fi
  step_ok "timing.createBarsFromBeats.async"
}

poll_job() {
  if [[ -z "${job_id}" ]]; then
    ok=false
    step_fail "jobs.get" "NO_JOB_ID"
    return
  fi
  local payload body status
  payload="$(jq -cn --arg job "${job_id}" '{apiVersion:2,cmd:"jobs.get",params:{jobId:$job}}')"
  body="$(post_cmd "${payload}")"
  body="$(normalize_json_body "${body}")"
  if ! json_has_res_200 "${body}"; then
    ok=false
    step_fail "jobs.get"
    return
  fi
  status="$(echo "${body}" | jq -r '.data.status // empty')"
  if [[ "${status}" == "succeeded" || "${status}" == "running" || "${status}" == "queued" ]]; then
    step_ok "jobs.get"
  else
    ok=false
    step_fail "jobs.get.status"
  fi
}

cancel_job() {
  if [[ -z "${job_id}" ]]; then
    ok=false
    step_fail "jobs.cancel" "NO_JOB_ID"
    return
  fi
  local payload body reason
  payload="$(jq -cn --arg job "${job_id}" '{apiVersion:2,cmd:"jobs.cancel",params:{jobId:$job}}')"
  body="$(post_cmd "${payload}")"
  body="$(normalize_json_body "${body}")"
  if ! json_has_res_200 "${body}"; then
    ok=false
    step_fail "jobs.cancel"
    return
  fi
  reason="$(echo "${body}" | jq -r '.data.cancelReason // empty')"
  if [[ "${reason}" == "not_cancellable" || "${reason}" == "already_terminal" || "${reason}" == "cancelled" ]]; then
    step_ok "jobs.cancel"
  else
    ok=false
    step_fail "jobs.cancel.reason"
  fi
}

cleanup_tracks() {
  local payload body
  payload="$(jq -cn --arg track "${target_track}" '{apiVersion:2,cmd:"timing.deleteTrack",params:{trackName:$track}}')"
  body="$(post_cmd "${payload}")"
  body="$(normalize_json_body "${body}")"
  if json_has_res_200 "${body}" || [[ "${body}" == *'"code":"TRACK_NOT_FOUND"'* ]]; then
    step_ok "cleanup.targetTrack"
  else
    ok=false
    step_fail "cleanup.targetTrack"
  fi

  payload="$(jq -cn --arg track "${source_track}" '{apiVersion:2,cmd:"timing.deleteTrack",params:{trackName:$track}}')"
  body="$(post_cmd "${payload}")"
  body="$(normalize_json_body "${body}")"
  if json_has_res_200 "${body}" || [[ "${body}" == *'"code":"TRACK_NOT_FOUND"'* ]]; then
    step_ok "cleanup.sourceTrack"
  else
    ok=false
    step_fail "cleanup.sourceTrack"
  fi
}

ensure_sequence_open
create_source_track
start_async_job
poll_job
cancel_job
cleanup_tracks

if [[ "${ok}" == "true" ]]; then
  emit_report "09-async-jobs-smoke" true
  exit 0
fi

emit_report "09-async-jobs-smoke" false
exit 1
