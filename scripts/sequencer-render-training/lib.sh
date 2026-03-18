#!/usr/bin/env bash
set -euo pipefail

XLIGHTS_BASE_URL="${XLIGHTS_BASE_URL:-http://127.0.0.1:49914}"
AUTOMATION_URL="${XLIGHTS_BASE_URL}/xlDoAutomation"
CURL_MAX_TIME="${CURL_MAX_TIME:-60}"
XLIGHTS_APP_PATH="${XLIGHTS_APP_PATH:-/Users/robterry/Library/Developer/Xcode/DerivedData/xLights-abdssfsqgzefmgebylgtlxhcrlae/Build/Products/Debug/xLights.app}"
XLIGHTS_RECYCLE_BEFORE_SAMPLE="${XLIGHTS_RECYCLE_BEFORE_SAMPLE:-0}"
XLIGHTS_STARTUP_WAIT_SECONDS="${XLIGHTS_STARTUP_WAIT_SECONDS:-180}"

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

xlights_ping() {
  local body
  body="$(curl --max-time 3 -sS -X POST "${AUTOMATION_URL}" \
    -H "Content-Type: application/json" \
    -d '{"cmd":"getModels"}' || true)"
  body="$(normalize_json_body "${body}")"
  [[ "${body}" == *'"models"'* || "${body}" == *'"msg":"OK"'* || "${body}" == *'"res":200'* ]]
}

xlights_listener_ready() {
  curl --max-time 2 -sS -X POST "${AUTOMATION_URL}" \
    -H "Content-Type: application/json" \
    -d '{"cmd":"getModels"}' >/dev/null 2>&1
}

xlights_wait_until_ready() {
  local max_wait="${1:-${XLIGHTS_STARTUP_WAIT_SECONDS}}"
  local i

  for i in $(seq 1 "${max_wait}"); do
    if xlights_ping; then
      return 0
    fi
    sleep 1
  done

  return 1
}

restart_xlights_app() {
  [[ -d "${XLIGHTS_APP_PATH}" ]] || {
    echo "xLights app path not found: ${XLIGHTS_APP_PATH}" >&2
    return 1
  }

  pkill -9 -f "${XLIGHTS_APP_PATH}/Contents/MacOS/xLights" || true
  local i
  for i in $(seq 1 10); do
    if ! pgrep -f "${XLIGHTS_APP_PATH}/Contents/MacOS/xLights" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
  sleep 2
  open "${XLIGHTS_APP_PATH}"

  for i in $(seq 1 45); do
    if xlights_listener_ready; then
      break
    fi
    sleep 1
  done

  if xlights_wait_until_ready "${XLIGHTS_STARTUP_WAIT_SECONDS}"; then
    return 0
  fi

  echo "xLights did not become healthy after restart" >&2
  return 1
}

ensure_xlights_ready() {
  if xlights_wait_until_ready 30; then
    return 0
  fi

  echo "xLights automation is not healthy." >&2
  return 1
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

single_strand_effect_settings_json() {
  local effect_settings_json="$1"
  local shared_settings_json="$2"

  jq -cn \
    --argjson eff "${effect_settings_json}" \
    --argjson shared "${shared_settings_json}" '
      def shared_render:
        (if (($shared.renderStyle // "") | length) > 0 then {B_CHOICE_BufferStyle: ($shared.renderStyle)} else {} end)
        + ($shared.settingsOverrides // {});

      def chase_defaults:
        {
          E_NOTEBOOK_SSEFFECT_TYPE: "Chase",
          E_CHOICE_SingleStrand_Colors: ($eff.colors // "Palette"),
          E_SLIDER_Number_Chases: (($eff.numberChases // 1) | tostring),
          E_SLIDER_Color_Mix1: (($eff.chaseSize // 10) | tostring),
          E_TEXTCTRL_Chase_Rotations: (($eff.cycles // 1.0) | tostring),
          E_TEXTCTRL_Chase_Offset: (($eff.offset // 0.0) | tostring),
          E_CHOICE_Chase_Type1: ($eff.chaseType // "Left-Right"),
          E_CHOICE_Fade_Type: ($eff.fadeType // "None"),
          E_CHECKBOX_Chase_Group_All: (if ($eff.groupAllStrands // false) then "1" else "0" end)
        };

      def skips_defaults:
        {
          E_NOTEBOOK_SSEFFECT_TYPE: "Skips",
          E_SLIDER_Skips_BandSize: (($eff.bandSize // 1) | tostring),
          E_SLIDER_Skips_SkipSize: (($eff.skipSize // 1) | tostring),
          E_SLIDER_Skips_StartPos: (($eff.startPos // 1) | tostring),
          E_SLIDER_Skips_Advance: (($eff.advances // 0) | tostring),
          E_CHOICE_Skips_Direction: ($eff.direction // "Left")
        };

      def fx_defaults:
        {
          E_NOTEBOOK_SSEFFECT_TYPE: "FX",
          E_CHOICE_SingleStrand_FX: ($eff.fxName // "Fireworks 1D"),
          E_CHOICE_SingleStrand_FX_Palette: ($eff.fxPalette // "* Colors Only"),
          E_SLIDER_FX_Intensity: (($eff.intensity // 128) | tostring),
          E_SLIDER_FX_Speed: (($eff.speed // 128) | tostring)
        };

      (
        if (($eff.mode // "Chase") == "Skips") then skips_defaults
        elif (($eff.mode // "Chase") == "FX") then fx_defaults
        else chase_defaults
        end
      ) + shared_render
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
    "SingleStrand")
      single_strand_effect_settings_json "${effect_settings_json}" "${shared_settings_json}"
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
