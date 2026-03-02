#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib.sh"

ok=true
track_name="AgentRev_$(date +%s)"
revision_token=""
new_revision_token=""

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

get_revision() {
  local body
  body="$(post_cmd '{"apiVersion":2,"cmd":"sequence.getRevision","params":{}}')"
  body="$(normalize_json_body "${body}")"
  if ! json_has_res_200 "${body}"; then
    ok=false
    step_fail "sequence.getRevision"
    return
  fi
  revision_token="$(echo "${body}" | jq -r '.data.revisionToken // empty')"
  if [[ -z "${revision_token}" ]]; then
    ok=false
    step_fail "sequence.getRevision.token"
    return
  fi
  step_ok "sequence.getRevision"
}

expect_conflict_on_stale_revision() {
  local stale payload body
  stale="${revision_token}-stale"
  payload="$(jq -cn --arg track "${track_name}" --arg rev "${stale}" \
    '{apiVersion:2,cmd:"timing.createTrack",params:{trackName:$track,replaceIfExists:true,expectedRevision:$rev}}')"
  body="$(post_cmd "${payload}")"
  body="$(normalize_json_body "${body}")"
  if [[ "${body}" == *'"code":"REVISION_CONFLICT"'* ]]; then
    step_ok "revision.conflict.stale"
  else
    ok=false
    step_fail "revision.conflict.stale"
  fi
}

apply_with_current_revision() {
  local payload body
  payload="$(jq -cn --arg track "${track_name}" --arg rev "${revision_token}" \
    '{apiVersion:2,cmd:"timing.createTrack",params:{trackName:$track,replaceIfExists:true,expectedRevision:$rev}}')"
  body="$(post_cmd "${payload}")"
  body="$(normalize_json_body "${body}")"
  if json_has_res_200 "${body}"; then
    step_ok "revision.apply.current"
  else
    ok=false
    step_fail "revision.apply.current"
  fi
}

verify_revision_advanced() {
  local body
  body="$(post_cmd '{"apiVersion":2,"cmd":"sequence.getRevision","params":{}}')"
  body="$(normalize_json_body "${body}")"
  if ! json_has_res_200 "${body}"; then
    ok=false
    step_fail "sequence.getRevision.after"
    return
  fi
  new_revision_token="$(echo "${body}" | jq -r '.data.revisionToken // empty')"
  if [[ -n "${new_revision_token}" && "${new_revision_token}" != "${revision_token}" ]]; then
    step_ok "revision.advanced"
  else
    ok=false
    step_fail "revision.advanced"
  fi
}

cleanup_track() {
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
get_revision
expect_conflict_on_stale_revision
apply_with_current_revision
verify_revision_advanced
cleanup_track

if [[ "${ok}" == "true" ]]; then
  emit_report "10-revision-conflict-smoke" true
  exit 0
fi

emit_report "10-revision-conflict-smoke" false
exit 1
