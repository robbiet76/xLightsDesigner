#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib.sh"

ok=true
effect_name=""

run_list_definitions() {
  local body
  body="$(post_cmd '{"apiVersion":2,"cmd":"effects.listDefinitions","params":{}}')"
  body="$(normalize_json_body "${body}")"

  if ! json_has_res_200 "${body}"; then
    ok=false
    step_fail "effects.listDefinitions"
    return
  fi

  if ! echo "${body}" | jq -e '.data.effects | type=="array" and length > 0' >/dev/null 2>&1; then
    ok=false
    step_fail "effects.listDefinitions.non-empty"
    return
  fi

  effect_name="$(echo "${body}" | jq -r '.data.effects[0].effectName // empty')"
  if [[ -z "${effect_name}" ]]; then
    ok=false
    step_fail "effects.listDefinitions.effectName"
    return
  fi

  step_ok "effects.listDefinitions"
}

run_get_definition() {
  if [[ -z "${effect_name}" ]]; then
    ok=false
    step_fail "effects.getDefinition" "NO_EFFECT_NAME"
    return
  fi

  local payload body
  payload="$(jq -cn --arg name "${effect_name}" '{apiVersion:2,cmd:"effects.getDefinition",params:{effectName:$name}}')"
  body="$(post_cmd "${payload}")"
  body="$(normalize_json_body "${body}")"

  if ! json_has_res_200 "${body}"; then
    ok=false
    step_fail "effects.getDefinition"
    return
  fi

  if ! echo "${body}" | jq -e '.data.effect.effectName == "'"${effect_name}"'" and (.data.effect.params | type=="array")' >/dev/null 2>&1; then
    ok=false
    step_fail "effects.getDefinition.shape"
    return
  fi

  step_ok "effects.getDefinition"
}

run_missing_effect_name_validation() {
  local body
  body="$(post_cmd '{"apiVersion":2,"cmd":"effects.getDefinition","params":{}}')"
  body="$(normalize_json_body "${body}")"
  if [[ "${body}" == *'"code":"VALIDATION_ERROR"'* ]]; then
    step_ok "effects.getDefinition.validation"
  else
    ok=false
    step_fail "effects.getDefinition.validation"
  fi
}

run_list_definitions
run_get_definition
run_missing_effect_name_validation

if [[ "${ok}" == "true" ]]; then
  emit_report "06-effects-definition-smoke" true
  exit 0
fi

emit_report "06-effects-definition-smoke" false
exit 1
