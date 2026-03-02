#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib.sh"

ok=true

validate_payload='{
  "apiVersion": 2,
  "cmd": "system.validateCommands",
  "params": {
    "commands": [
      { "cmd": "system.getCapabilities", "params": {} },
      { "cmd": "sequence.open", "params": {} }
    ]
  }
}'

body="$(post_cmd "${validate_payload}")"

if [[ "${body}" == *'"res":200'* && "${body}" == *'"cmd":"system.validateCommands"'* ]]; then
  step_ok "system.validateCommands.response"
else
  ok=false
  step_fail "system.validateCommands.response"
fi

if [[ "${body}" == *'"results":'* && "${body}" == *'"index":0'* && "${body}" == *'"index":1'* ]]; then
  step_ok "system.validateCommands.results"
else
  ok=false
  step_fail "system.validateCommands.results"
fi

if [[ "${body}" == *'"valid":false'* && "${body}" == *'"error"'* ]]; then
  step_ok "system.validateCommands.invalid-detection"
else
  ok=false
  step_fail "system.validateCommands.invalid-detection"
fi

if [[ "${ok}" == "true" ]]; then
  emit_report "04-validation-gate-smoke" true
  exit 0
fi

emit_report "04-validation-gate-smoke" false
exit 1
