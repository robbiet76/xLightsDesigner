#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib.sh"

ok=true
tx_id=""
track_name="AgentTx_$(date +%s)"

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

begin_tx() {
  local body
  body="$(post_cmd '{"apiVersion":2,"cmd":"transactions.begin","params":{}}')"
  body="$(normalize_json_body "${body}")"
  if ! json_has_res_200 "${body}"; then
    ok=false
    step_fail "transactions.begin"
    return
  fi
  tx_id="$(echo "${body}" | jq -r '.data.transactionId // empty')"
  if [[ -z "${tx_id}" ]]; then
    ok=false
    step_fail "transactions.begin.id"
    return
  fi
  step_ok "transactions.begin"
}

stage_tx_changes() {
  if [[ -z "${tx_id}" ]]; then
    ok=false
    step_fail "transactions.stage" "NO_TX"
    return
  fi

  local payload body
  payload="$(jq -cn --arg tx "${tx_id}" --arg name "${track_name}" \
    '{apiVersion:2,cmd:"timing.createTrack",params:{transactionId:$tx,trackName:$name}}')"
  body="$(post_cmd "${payload}")"
  body="$(normalize_json_body "${body}")"
  if ! json_has_res_200 "${body}"; then
    ok=false
    step_fail "transactions.stage.createTrack"
    return
  fi

  payload="$(jq -cn --arg tx "${tx_id}" --arg name "${track_name}" \
    '{apiVersion:2,cmd:"timing.insertMarks",params:{transactionId:$tx,trackName:$name,marks:[{startMs:0,endMs:500,label:"A"},{startMs:500,endMs:1000,label:"B"}]}}')"
  body="$(post_cmd "${payload}")"
  body="$(normalize_json_body "${body}")"
  if json_has_res_200 "${body}"; then
    step_ok "transactions.stage.mutations"
  else
    ok=false
    step_fail "transactions.stage.mutations"
  fi
}

verify_track_absent() {
  local body
  body="$(post_cmd '{"apiVersion":2,"cmd":"timing.getTracks","params":{}}')"
  body="$(normalize_json_body "${body}")"
  if ! json_has_res_200 "${body}"; then
    ok=false
    step_fail "timing.getTracks"
    return
  fi
  if echo "${body}" | jq -e --arg name "${track_name}" '.data.tracks | map(.name) | index($name) | not' >/dev/null 2>&1; then
    step_ok "transactions.rollback.state"
  else
    ok=false
    step_fail "transactions.rollback.state"
  fi
}

verify_track_present() {
  local body
  body="$(post_cmd '{"apiVersion":2,"cmd":"timing.getTracks","params":{}}')"
  body="$(normalize_json_body "${body}")"
  if ! json_has_res_200 "${body}"; then
    ok=false
    step_fail "timing.getTracks.after-commit"
    return
  fi
  if echo "${body}" | jq -e --arg name "${track_name}" '.data.tracks | map(.name) | index($name) != null' >/dev/null 2>&1; then
    step_ok "transactions.commit.state"
  else
    ok=false
    step_fail "transactions.commit.state"
  fi
}

rollback_tx() {
  local payload body
  payload="$(jq -cn --arg tx "${tx_id}" '{apiVersion:2,cmd:"transactions.rollback",params:{transactionId:$tx}}')"
  body="$(post_cmd "${payload}")"
  body="$(normalize_json_body "${body}")"
  if json_has_res_200 "${body}"; then
    step_ok "transactions.rollback"
  else
    ok=false
    step_fail "transactions.rollback"
  fi
}

commit_tx() {
  local payload body
  payload="$(jq -cn --arg tx "${tx_id}" '{apiVersion:2,cmd:"transactions.commit",params:{transactionId:$tx}}')"
  body="$(post_cmd "${payload}")"
  body="$(normalize_json_body "${body}")"
  if json_has_res_200 "${body}"; then
    step_ok "transactions.commit"
  else
    ok=false
    step_fail "transactions.commit"
  fi
}

cleanup_track() {
  local payload body
  payload="$(jq -cn --arg name "${track_name}" '{apiVersion:2,cmd:"timing.deleteTrack",params:{trackName:$name}}')"
  body="$(post_cmd "${payload}")"
  body="$(normalize_json_body "${body}")"
  if json_has_res_200 "${body}" || [[ "${body}" == *'"code":"TRACK_NOT_FOUND"'* ]]; then
    step_ok "transactions.cleanup"
  else
    ok=false
    step_fail "transactions.cleanup"
  fi
}

ensure_sequence_open
begin_tx
stage_tx_changes
rollback_tx
verify_track_absent

begin_tx
stage_tx_changes
commit_tx
verify_track_present
cleanup_track

if [[ "${ok}" == "true" ]]; then
  emit_report "07-transactions-smoke" true
  exit 0
fi

emit_report "07-transactions-smoke" false
exit 1
