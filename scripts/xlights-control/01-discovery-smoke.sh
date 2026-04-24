#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib.sh"

ok=true

run() {
  local name="$1"
  local payload="$2"
  local body
  body="$(post_cmd "${payload}")"
  body="$(normalize_json_body "${body}")"
  if json_has_res_200 "${body}"; then
    step_ok "${name}"
  else
    ok=false
    step_fail "${name}"
  fi
}

run_or_sequence_not_open() {
  local name="$1"
  local payload="$2"
  local body
  body="$(post_cmd "${payload}")"
  body="$(normalize_json_body "${body}")"
  if json_has_res_200 "${body}" || [[ "${body}" == *'"code":"SEQUENCE_NOT_OPEN"'* ]]; then
    step_ok "${name}"
  else
    ok=false
    step_fail "${name}"
  fi
}

check_capabilities_wp9() {
  local body
  body="$(post_cmd '{"apiVersion":2,"cmd":"system.getCapabilities","params":{}}')"
  body="$(normalize_json_body "${body}")"
  if ! json_has_res_200 "${body}"; then
    ok=false
    step_fail "system.getCapabilities"
    return
  fi
  step_ok "system.getCapabilities"

  if echo "${body}" | jq -e '
      (.data.commands | index("effects.listDefinitions") != null) and
      (.data.commands | index("effects.getDefinition") != null) and
      (.data.commands | index("system.executePlan") != null) and
      (.data.commands | index("jobs.get") != null) and
      (.data.commands | index("jobs.cancel") != null) and
      (.data.commands | index("sequence.getRevision") != null) and
      ((.data.features.executePlanAvailable // false) == true) and
      ((.data.features.asyncJobsAvailable // false) == true) and
      ((.data.features.effectDefinitionIntrospectionAvailable // false) == true)
    ' >/dev/null 2>&1; then
    step_ok "system.getCapabilities.wp9-surface"
  else
    ok=false
    step_fail "system.getCapabilities.wp9-surface"
  fi
}

check_capabilities_wp9
run "layout.getModels" '{"apiVersion":2,"cmd":"layout.getModels","params":{}}'
run_or_sequence_not_open "layout.getViews" '{"apiVersion":2,"cmd":"layout.getViews","params":{}}'
run_or_sequence_not_open "layout.getDisplayElements" '{"apiVersion":2,"cmd":"layout.getDisplayElements","params":{}}'

if [[ "${ok}" == "true" ]]; then
  emit_report "01-discovery-smoke" true
  exit 0
fi

emit_report "01-discovery-smoke" false
exit 1
