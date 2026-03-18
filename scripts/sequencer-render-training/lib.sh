#!/usr/bin/env bash
set -euo pipefail

XLIGHTS_BASE_URL="${XLIGHTS_BASE_URL:-http://127.0.0.1:49914}"
AUTOMATION_URL="${XLIGHTS_BASE_URL}/xlDoAutomation"
CURL_MAX_TIME="${CURL_MAX_TIME:-60}"

post_cmd() {
  local payload="$1"
  curl --max-time "${CURL_MAX_TIME}" -sS -X POST "${AUTOMATION_URL}" \
    -H "Content-Type: application/json" \
    -d "${payload}"
}

normalize_json_body() {
  local body="$1"
  printf "%s" "${body}" | sed -n 's/^[^{]*//;p'
}

json_has_res_200() {
  local body="$1"
  [[ "${body}" == *'"res":200'* || \
     "${body}" == *'"worked":"true"'* || \
     "${body}" == *'"msg":"Rendered."'* || \
     "${body}" == *'"msg":"Sequence closed."'* || \
     "${body}" == *'"msg":"Model exported."'* || \
     "${body}" == *'"msg":"Exported"'* ]]
}

require_cmd() {
  local cmd="$1"
  command -v "${cmd}" >/dev/null 2>&1 || {
    echo "Missing required command: ${cmd}" >&2
    exit 1
  }
}

json_string() {
  jq -Rn --arg v "$1" '$v'
}

build_palette_json() {
  local palette_json="${1:-{}}"
  printf "%s" "${palette_json}" | jq -c '.'
}

merge_settings_json() {
  local a="${1:-{}}"
  local b="${2:-{}}"
  jq -cn --argjson a "${a}" --argjson b "${b}" '$a * $b'
}

on_effect_settings_json() {
  local effect_settings_json="$1"
  local shared_settings_json="$2"

  jq -cn \
    --argjson eff "${effect_settings_json}" \
    --argjson shared "${shared_settings_json}" '
      {
        E_TEXTCTRL_Eff_On_Start: (($eff.startLevel // 100) | tostring),
        E_TEXTCTRL_Eff_On_End: (($eff.endLevel // 100) | tostring),
        E_CHECKBOX_On_Shimmer: ((if ($eff.shimmer // false) then "1" else "0" end)),
        E_TEXTCTRL_On_Cycles: (($eff.cycles // 1) | tostring)
      }
      + (if ($eff.transparency // 0) != 0 then {E_TEXTCTRL_On_Transparency: (($eff.transparency // 0) | tostring)} else {} end)
      + (if (($shared.renderStyle // "") | length) > 0 then {B_CHOICE_BufferStyle: ($shared.renderStyle)} else {} end)
      + ($shared.settingsOverrides // {})
    '
}

settings_json_for_effect() {
  local effect_name="$1"
  local effect_settings_json="$2"
  local shared_settings_json="$3"

  case "${effect_name}" in
    "On")
      on_effect_settings_json "${effect_settings_json}" "${shared_settings_json}"
      ;;
    *)
      echo "Unsupported effect in initial harness: ${effect_name}" >&2
      exit 1
      ;;
  esac
}

run_and_require_ok() {
  local payload="$1"
  local body
  body="$(post_cmd "${payload}")"
  body="$(normalize_json_body "${body}")"
  if ! json_has_res_200 "${body}"; then
    echo "${body}" >&2
    exit 1
  fi
  printf "%s" "${body}"
}

run_allowing_already_open() {
  local payload="$1"
  local body
  body="$(post_cmd "${payload}")"
  body="$(normalize_json_body "${body}")"
  if json_has_res_200 "${body}"; then
    printf '%s' "${body}"
    return 0
  fi
  if [[ "${body}" == *'"msg":"Sequence already open."'* ]]; then
    printf '%s' "${body}"
    return 10
  fi
  echo "${body}" >&2
  exit 1
}
