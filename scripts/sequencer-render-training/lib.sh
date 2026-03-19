#!/usr/bin/env bash
set -euo pipefail

XLIGHTS_BASE_URL="${XLIGHTS_BASE_URL:-http://127.0.0.1:49914}"
AUTOMATION_URL="${XLIGHTS_BASE_URL}/xlDoAutomation"
CURL_MAX_TIME="${CURL_MAX_TIME:-60}"
XLIGHTS_APP_PATH="${XLIGHTS_APP_PATH:-}"
XLIGHTS_RECYCLE_BEFORE_SAMPLE="${XLIGHTS_RECYCLE_BEFORE_SAMPLE:-0}"
XLIGHTS_STARTUP_WAIT_SECONDS="${XLIGHTS_STARTUP_WAIT_SECONDS:-180}"
RENDER_TRAINING_ROOT="${RENDER_TRAINING_ROOT:-/Users/robterry/Projects/xLightsDesigner/render-training}"

post_cmd() {
  local payload="$1"
  curl --max-time "${CURL_MAX_TIME}" -sS -X POST "${AUTOMATION_URL}" \
    -H "Content-Type: application/json" \
    -d "${payload}"
}

resolve_xlights_app_path() {
  if [[ -n "${XLIGHTS_APP_PATH}" && -d "${XLIGHTS_APP_PATH}" ]]; then
    printf '%s\n' "${XLIGHTS_APP_PATH}"
    return 0
  fi

  local running_binary running_app
  running_binary="$(ps -ax -o command= | awk '/xLights\.app\/Contents\/MacOS\/xLights$/ && $0 !~ /awk/ {print; exit}')"
  if [[ -n "${running_binary}" ]]; then
    running_app="${running_binary%/Contents/MacOS/xLights}"
    if [[ -d "${running_app}" ]]; then
      printf '%s\n' "${running_app}"
      return 0
    fi
  fi

  if [[ -d "/Applications/xLights.app" ]]; then
    printf '%s\n' "/Applications/xLights.app"
    return 0
  fi

  local derived_app
  derived_app="$(find /Users/robterry/Library/Developer/Xcode/DerivedData -path '*/Build/Products/Debug/xLights.app' -type d 2>/dev/null | head -n 1 || true)"
  if [[ -n "${derived_app}" && -d "${derived_app}" ]]; then
    printf '%s\n' "${derived_app}"
    return 0
  fi

  echo "Unable to resolve xLights app path." >&2
  return 1
}

normalize_json_body() {
  local body="$1"
  printf "%s" "${body}" | sed -n 's/^[^{]*//;p'
}

json_has_res_200() {
  local body="$1"
  [[ "${body}" == *'"res":200'* || \
     "${body}" == *'"worked":"true"'* || \
     "${body}" == *'"fullseq"'* || \
     "${body}" == *'"msg":"Rendered."'* || \
     "${body}" == *'"msg":"Sequence Saved."'* || \
     "${body}" == *'"msg":"Sequence batch rendered."'* || \
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

json_get_string_field() {
  local payload="$1"
  local key="$2"
  printf '%s' "${payload}" | jq -r --arg key "${key}" '.[$key] // empty'
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
  local app_path
  app_path="$(resolve_xlights_app_path)" || return 1

  pkill -9 -f "${app_path}/Contents/MacOS/xLights" || true
  local i
  for i in $(seq 1 10); do
    if ! pgrep -f "${app_path}/Contents/MacOS/xLights" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
  sleep 2
  open "${app_path}"

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

get_show_folder() {
  local body
  body="$(post_cmd '{"cmd":"getShowFolder"}')"
  body="$(normalize_json_body "${body}")"
  json_get_string_field "${body}" "folder"
}

get_fseq_directory() {
  local body
  body="$(post_cmd '{"cmd":"getFseqDirectory"}')"
  body="$(normalize_json_body "${body}")"
  json_get_string_field "${body}" "folder"
}

resolve_show_dir_for_sequence() {
  local xsq_path="$1"
  local probe
  probe="$(cd "$(dirname "${xsq_path}")" && pwd)"

  while [[ "${probe}" != "/" ]]; do
    if [[ -f "${probe}/xlights_networks.xml" && -f "${probe}/xlights_rgbeffects.xml" ]]; then
      printf '%s\n' "${probe}"
      return 0
    fi
    probe="$(dirname "${probe}")"
  done

  echo "Unable to resolve show directory for sequence: ${xsq_path}" >&2
  return 1
}

resolve_fseq_path_for_sequence() {
  local xsq_path="$1"
  local show_folder fseq_dir xsq_dir xsq_base

  show_folder="$(get_show_folder)"
  fseq_dir="$(get_fseq_directory)"
  xsq_dir="$(cd "$(dirname "${xsq_path}")" && pwd)"
  xsq_base="$(basename "${xsq_path}" .xsq)"

  if [[ -n "${fseq_dir}" && -n "${show_folder}" && "${fseq_dir}" != "${show_folder}" ]]; then
    printf '%s/%s.fseq\n' "${fseq_dir}" "${xsq_base}"
  else
    printf '%s/%s.fseq\n' "${xsq_dir}" "${xsq_base}"
  fi
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

shimmer_effect_settings_json() {
  local effect_settings_json="$1"
  local shared_settings_json="$2"

  jq -cn \
    --argjson eff "${effect_settings_json}" \
    --argjson shared "${shared_settings_json}" '
      {
        E_TEXTCTRL_Shimmer_Duty_Factor: (($eff.dutyFactor // 50) | tostring),
        E_TEXTCTRL_Shimmer_Cycles: (($eff.cycles // 1.0) | tostring),
        E_CHECKBOX_Shimmer_Use_All_Colors: (if ($eff.useAllColors // false) then "1" else "0" end)
      }
      + (if ($eff.pre2017 // false) then {E_CHECKBOX_PRE_2017_7: "1"} else {} end)
      + (if (($shared.renderStyle // "") | length) > 0 then {B_CHOICE_BufferStyle: ($shared.renderStyle)} else {} end)
      + ($shared.settingsOverrides // {})
    '
}

color_wash_effect_settings_json() {
  local effect_settings_json="$1"
  local shared_settings_json="$2"

  jq -cn \
    --argjson eff "${effect_settings_json}" \
    --argjson shared "${shared_settings_json}" '
      {
        E_TEXTCTRL_ColorWash_Cycles: (($eff.cycles // 1.0) | tostring)
      }
      + (if ($eff.vFade // false) then {E_CHECKBOX_ColorWash_VFade: "1"} else {} end)
      + (if ($eff.hFade // false) then {E_CHECKBOX_ColorWash_HFade: "1"} else {} end)
      + (if ($eff.reverseFades // false) then {E_CHECKBOX_ColorWash_ReverseFades: "1"} else {} end)
      + (if ($eff.shimmer // false) then {E_CHECKBOX_ColorWash_Shimmer: "1"} else {} end)
      + (if ($eff.circularPalette // false) then {E_CHECKBOX_ColorWash_CircularPalette: "1"} else {} end)
      + (if (($shared.renderStyle // "") | length) > 0 then {B_CHOICE_BufferStyle: ($shared.renderStyle)} else {} end)
      + ($shared.settingsOverrides // {})
    '
}

bars_effect_settings_json() {
  local effect_settings_json="$1"
  local shared_settings_json="$2"

  jq -cn \
    --argjson eff "${effect_settings_json}" \
    --argjson shared "${shared_settings_json}" '
      {
        E_SLIDER_Bars_BarCount: (($eff.barCount // 1) | tostring),
        E_TEXTCTRL_Bars_Cycles: (($eff.cycles // 10) | tostring),
        E_TEXTCTRL_Bars_Center: (($eff.center // 0) | tostring),
        E_CHOICE_Bars_Direction: ($eff.direction // "up")
      }
      + (if ($eff.highlight // false) then {E_CHECKBOX_Bars_Highlight: "1"} else {} end)
      + (if ($eff.useFirstColorForHighlight // false) then {E_CHECKBOX_Bars_UseFirstColorForHighlight: "1"} else {} end)
      + (if ($eff["3D"] // false) then {E_CHECKBOX_Bars_3D: "1"} else {} end)
      + (if ($eff.gradient // false) then {E_CHECKBOX_Bars_Gradient: "1"} else {} end)
      + (if (($shared.renderStyle // "") | length) > 0 then {B_CHOICE_BufferStyle: ($shared.renderStyle)} else {} end)
      + ($shared.settingsOverrides // {})
    '
}

spirals_effect_settings_json() {
  local effect_settings_json="$1"
  local shared_settings_json="$2"

  jq -cn \
    --argjson eff "${effect_settings_json}" \
    --argjson shared "${shared_settings_json}" '
      {
        E_SLIDER_Spirals_Count: (($eff.count // 1) | tostring),
        E_TEXTCTRL_Spirals_Movement: (($eff.movement // 10) | tostring),
        E_SLIDER_Spirals_Rotation: (($eff.rotation // 20) | tostring),
        E_SLIDER_Spirals_Thickness: (($eff.thickness // 50) | tostring)
      }
      + (if ($eff.blend // false) then {E_CHECKBOX_Spirals_Blend: "1"} else {} end)
      + (if ($eff["3D"] // false) then {E_CHECKBOX_Spirals_3D: "1"} else {} end)
      + (if ($eff.grow // false) then {E_CHECKBOX_Spirals_Grow: "1"} else {} end)
      + (if ($eff.shrink // false) then {E_CHECKBOX_Spirals_Shrink: "1"} else {} end)
      + (if (($shared.renderStyle // "") | length) > 0 then {B_CHOICE_BufferStyle: ($shared.renderStyle)} else {} end)
      + ($shared.settingsOverrides // {})
    '
}

marquee_effect_settings_json() {
  local effect_settings_json="$1"
  local shared_settings_json="$2"

  jq -cn \
    --argjson eff "${effect_settings_json}" \
    --argjson shared "${shared_settings_json}" '
      {
        E_SLIDER_Marquee_Band_Size: (($eff.bandSize // 3) | tostring),
        E_SLIDER_Marquee_Skip_Size: (($eff.skipSize // 0) | tostring),
        E_SLIDER_Marquee_Thickness: (($eff.thickness // 2) | tostring),
        E_SLIDER_Marquee_Stagger: (($eff.stagger // 0) | tostring),
        E_SLIDER_Marquee_Speed: (($eff.speed // 5) | tostring),
        E_SLIDER_Marquee_Start: (($eff.start // 0) | tostring)
      }
      + (if ($eff.reverse // false) then {E_CHECKBOX_Marquee_Reverse: "1"} else {} end)
      + (if (($shared.renderStyle // "") | length) > 0 then {B_CHOICE_BufferStyle: ($shared.renderStyle)} else {} end)
      + ($shared.settingsOverrides // {})
    '
}

pinwheel_effect_settings_json() {
  local effect_settings_json="$1"
  local shared_settings_json="$2"

  jq -cn \
    --argjson eff "${effect_settings_json}" \
    --argjson shared "${shared_settings_json}" '
      {
        E_SLIDER_Pinwheel_Arms: (($eff.arms // 3) | tostring),
        E_SLIDER_Pinwheel_ArmSize: (($eff.armSize // 50) | tostring),
        E_SLIDER_Pinwheel_Twist: (($eff.twist // 0) | tostring),
        E_SLIDER_Pinwheel_Thickness: (($eff.thickness // 40) | tostring),
        E_SLIDER_Pinwheel_Speed: (($eff.speed // 10) | tostring),
        E_CHOICE_Pinwheel_Style: ($eff.style // "New Render Method"),
        E_CHOICE_Pinwheel_3D: ($eff["3DMode"] // "None")
      }
      + (if ($eff.rotation // false) then {E_CHECKBOX_Pinwheel_Rotation: "1"} else {} end)
      + (if (($shared.renderStyle // "") | length) > 0 then {B_CHOICE_BufferStyle: ($shared.renderStyle)} else {} end)
      + ($shared.settingsOverrides // {})
    '
}

shockwave_effect_settings_json() {
  local effect_settings_json="$1"
  local shared_settings_json="$2"

  jq -cn \
    --argjson eff "${effect_settings_json}" \
    --argjson shared "${shared_settings_json}" '
      {
        E_SLIDER_Shockwave_CenterX: (($eff.centerX // 50) | tostring),
        E_SLIDER_Shockwave_CenterY: (($eff.centerY // 50) | tostring),
        E_SLIDER_Shockwave_Start_Radius: (($eff.startRadius // 1) | tostring),
        E_SLIDER_Shockwave_End_Radius: (($eff.endRadius // 10) | tostring),
        E_SLIDER_Shockwave_Start_Width: (($eff.startWidth // 5) | tostring),
        E_SLIDER_Shockwave_End_Width: (($eff.endWidth // 10) | tostring),
        E_SLIDER_Shockwave_Accel: (($eff.accel // 0) | tostring),
        E_SLIDER_Shockwave_Cycles: (($eff.cycles // 1) | tostring)
      }
      + (if ($eff.blendEdges // true) then {E_CHECKBOX_Shockwave_Blend_Edges: "1"} else {} end)
      + (if ($eff.scale // true) then {E_CHECKBOX_Shockwave_Scale: "1"} else {} end)
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
    "SingleStrand")
      single_strand_effect_settings_json "${effect_settings_json}" "${shared_settings_json}"
      ;;
    "Shimmer")
      shimmer_effect_settings_json "${effect_settings_json}" "${shared_settings_json}"
      ;;
    "Color Wash")
      color_wash_effect_settings_json "${effect_settings_json}" "${shared_settings_json}"
      ;;
    "Bars")
      bars_effect_settings_json "${effect_settings_json}" "${shared_settings_json}"
      ;;
    "Spirals")
      spirals_effect_settings_json "${effect_settings_json}" "${shared_settings_json}"
      ;;
    "Marquee")
      marquee_effect_settings_json "${effect_settings_json}" "${shared_settings_json}"
      ;;
    "Pinwheel")
      pinwheel_effect_settings_json "${effect_settings_json}" "${shared_settings_json}"
      ;;
    "Shockwave")
      shockwave_effect_settings_json "${effect_settings_json}" "${shared_settings_json}"
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
  return 1
}
