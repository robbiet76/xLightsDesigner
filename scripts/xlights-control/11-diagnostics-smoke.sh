#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib.sh"

ok=true

assert_diag_fields() {
  local body="$1"
  local step="$2"
  if echo "${body}" | jq -e '.error.code and .error.message and .error.class and (.error.retryable|type=="boolean")' >/dev/null 2>&1; then
    step_ok "${step}"
  else
    ok=false
    step_fail "${step}"
  fi
}

check_open_missing_sequence() {
  local missing payload body
  missing="/tmp/xlights-missing-$(date +%s)-$$.xsq"
  payload="$(jq -cn --arg file "${missing}" '{apiVersion:2,cmd:"sequence.open",params:{file:$file,force:true,promptIssues:false}}')"
  body="$(post_cmd "${payload}")"
  body="$(normalize_json_body "${body}")"
  if [[ "${body}" == *'"code":"SEQUENCE_NOT_FOUND"'* ]]; then
    step_ok "sequence.open.not-found.code"
  else
    ok=false
    step_fail "sequence.open.not-found.code"
  fi
  assert_diag_fields "${body}" "sequence.open.not-found.diagnostics"
}

check_save_validation_diagnostics() {
  local body
  body="$(post_cmd '{"apiVersion":2,"cmd":"sequence.close","params":{"force":true,"quiet":true}}')"
  body="$(normalize_json_body "${body}")"
  if [[ "${body}" != *'"res":200'* ]]; then
    ok=false
    step_fail "sequence.close.pre-save"
    return
  fi

  body="$(post_cmd '{"apiVersion":2,"cmd":"sequence.save","params":{}}')"
  body="$(normalize_json_body "${body}")"
  if [[ "${body}" == *'"code":"SEQUENCE_NOT_OPEN"'* ]]; then
    assert_diag_fields "${body}" "sequence.save.diagnostics"
  else
    ok=false
    step_fail "sequence.save.diagnostics"
  fi
}

check_analysis_validation_diagnostics() {
  local payload body
  payload='{"apiVersion":2,"cmd":"timing.createFromAudio","params":{"trackName":"AgentDiag","analysisProvider":"local"}}'
  body="$(post_cmd "${payload}")"
  body="$(normalize_json_body "${body}")"
  if [[ "${body}" == *'"code":"UNSUPPORTED_PROVIDER"'* || "${body}" == *'"code":"MEDIA_NOT_AVAILABLE"'* || "${body}" == *'"code":"SEQUENCE_NOT_OPEN"'* ]]; then
    assert_diag_fields "${body}" "timing.createFromAudio.diagnostics"
  else
    ok=false
    step_fail "timing.createFromAudio.diagnostics"
  fi
}

check_open_missing_sequence
check_save_validation_diagnostics
check_analysis_validation_diagnostics

if [[ "${ok}" == "true" ]]; then
  emit_report "11-diagnostics-smoke" true
  exit 0
fi

emit_report "11-diagnostics-smoke" false
exit 1
