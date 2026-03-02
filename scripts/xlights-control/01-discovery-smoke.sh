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
  if json_has_res_200 "${body}"; then
    step_ok "${name}"
  else
    ok=false
    step_fail "${name}"
  fi
}

run "system.getCapabilities" '{"apiVersion":2,"cmd":"system.getCapabilities","params":{}}'
run "layout.getModels" '{"apiVersion":2,"cmd":"layout.getModels","params":{}}'
run "layout.getViews" '{"apiVersion":2,"cmd":"layout.getViews","params":{}}'
run "layout.getDisplayElements" '{"apiVersion":2,"cmd":"layout.getDisplayElements","params":{}}'

if [[ "${ok}" == "true" ]]; then
  emit_report "01-discovery-smoke" true
  exit 0
fi

emit_report "01-discovery-smoke" false
exit 1
