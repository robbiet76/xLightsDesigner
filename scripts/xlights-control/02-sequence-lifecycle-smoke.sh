#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib.sh"

TEST_SEQUENCE_PATH="${TEST_SEQUENCE_PATH:-}"
TEST_MEDIA_PATH="${TEST_MEDIA_PATH:-}"
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

run "sequence.getOpen" '{"apiVersion":2,"cmd":"sequence.getOpen","params":{}}'

if [[ -n "${TEST_SEQUENCE_PATH}" ]]; then
  run "sequence.open" "{\"apiVersion\":2,\"cmd\":\"sequence.open\",\"params\":{\"file\":\"${TEST_SEQUENCE_PATH}\"}}"
fi

if [[ -n "${TEST_MEDIA_PATH}" ]]; then
  run "media.set" "{\"apiVersion\":2,\"cmd\":\"media.set\",\"params\":{\"mediaFile\":\"${TEST_MEDIA_PATH}\"}}"
  run "media.getMetadata" '{"apiVersion":2,"cmd":"media.getMetadata","params":{}}'
fi

run "sequence.save.dryRun" '{"apiVersion":2,"cmd":"sequence.save","params":{},"options":{"dryRun":true}}'

if [[ "${ok}" == "true" ]]; then
  emit_report "02-sequence-lifecycle-smoke" true
  exit 0
fi

emit_report "02-sequence-lifecycle-smoke" false
exit 1
