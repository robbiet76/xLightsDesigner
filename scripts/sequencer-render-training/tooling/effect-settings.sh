#!/usr/bin/env bash
set -euo pipefail

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
          E_CHOICE_Skips_Direction: ($eff.direction // "Left"),
          E_TEXTCTRL_Skips_Advance: (($eff.advance // 1.0) | tostring)
        };

      def effect_type: ($eff.effectType // "Chase");

      if effect_type == "Skips" then skips_defaults + shared_render else chase_defaults + shared_render end
    '
}

shimmer_effect_settings_json() {
  local effect_settings_json="$1"
  local shared_settings_json="$2"

  jq -cn \
    --argjson eff "${effect_settings_json}" \
    --argjson shared "${shared_settings_json}" '
      {
        E_SLIDER_Shimmer_Duty_Factor: (($eff.dutyFactor // 50) | tostring),
        E_TEXTCTRL_Shimmer_Cycles: (($eff.cycles // 5) | tostring)
      }
      + (if ($eff.useAllColors // false) then {E_CHECKBOX_Shimmer_Use_All_Colors: "1"} else {} end)
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
        E_TEXTCTRL_ColorWash_Count: (($eff.cycles // 1.0) | tostring),
        E_SLIDER_ColorWash_VFade: (($eff.vFade // 0) | tostring),
        E_SLIDER_ColorWash_HFade: (($eff.hFade // 0) | tostring)
      }
      + (if ($eff.reverseFades // false) then {E_CHECKBOX_ColorWash_Reverse_Fades: "1"} else {} end)
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
        E_SLIDER_Bars_Bar_Count: (($eff.barCount // 3) | tostring),
        E_CHOICE_Bars_Direction: ($eff.direction // "up"),
        E_TEXTCTRL_Bars_Cycles: (($eff.cycles // 1.0) | tostring)
      }
      + (if ($eff.highlight // false) then {E_CHECKBOX_Bars_Highlight: "1"} else {} end)
      + (if ($eff.gradient // false) then {E_CHECKBOX_Bars_Gradient: "1"} else {} end)
      + (if ($eff["3D"] // false) then {E_CHECKBOX_Bars_3D: "1"} else {} end)
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
        E_TEXTCTRL_Spirals_Count: (($eff.count // 3) | tostring),
        E_CHOICE_Spirals_Movement: ($eff.movement // "left"),
        E_CHOICE_Spirals_Rotation: ($eff.rotation // "counterclockwise"),
        E_SLIDER_Spirals_Thickness: (($eff.thickness // 50) | tostring)
      }
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
        E_TEXTCTRL_Marquee_Band_Size: (($eff.bandSize // 1) | tostring),
        E_TEXTCTRL_Marquee_Skip_Size: (($eff.skipSize // 1) | tostring),
        E_TEXTCTRL_Marquee_Thickness: (($eff.thickness // 100) | tostring),
        E_TEXTCTRL_Marquee_Stagger: (($eff.stagger // 0) | tostring),
        E_TEXTCTRL_Marquee_Speed: (($eff.speed // 1.0) | tostring)
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
        E_SLIDER_Pinwheel_Arms: (($eff.arms // 4) | tostring),
        E_SLIDER_Pinwheel_Arm_Size: (($eff.armSize // 25) | tostring),
        E_SLIDER_Pinwheel_Thickness: (($eff.thickness // 50) | tostring),
        E_SLIDER_Pinwheel_Twist: (($eff.twist // 0) | tostring),
        E_SLIDER_Pinwheel_Speed: (($eff.speed // 10) | tostring),
        E_SLIDER_Pinwheel_Rotation: (($eff.rotation // 0) | tostring)
      }
      + (if (($eff["3DMode"] // "") | length) > 0 then {E_CHOICE_Pinwheel_3D: ($eff["3DMode"])} else {} end)
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
        E_SLIDER_Shockwave_Center_X: (($eff.centerX // 0) | tostring),
        E_SLIDER_Shockwave_Center_Y: (($eff.centerY // 0) | tostring),
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

twinkle_effect_settings_json() {
  local effect_settings_json="$1"
  local shared_settings_json="$2"

  jq -cn \
    --argjson eff "${effect_settings_json}" \
    --argjson shared "${shared_settings_json}" '
      {
        E_CHOICE_Twinkle_Style: ($eff.style // "New Render Method"),
        E_SLIDER_Twinkle_Count: (($eff.count // 5) | tostring),
        E_SLIDER_Twinkle_Steps: (($eff.steps // 50) | tostring)
      }
      + (if ($eff.strobe // false) then {E_CHECKBOX_Twinkle_Strobe: "1"} else {} end)
      + (if ($eff.reRandomize // false) then {E_CHECKBOX_Twinkle_ReRandomize: "1"} else {} end)
      + (if (($shared.renderStyle // "") | length) > 0 then {B_CHOICE_BufferStyle: ($shared.renderStyle)} else {} end)
      + ($shared.settingsOverrides // {})
    '
}

generic_registry_effect_settings_json() {
  local effect_name="$1"
  local effect_settings_json="$2"
  local shared_settings_json="$3"
  local registry_path
  registry_path="${XLD_EFFECT_REGISTRY_PATH:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/catalog/effective-effect-parameter-registry.json}"

  jq -cn \
    --arg effect "${effect_name}" \
    --argjson eff "${effect_settings_json}" \
    --argjson shared "${shared_settings_json}" \
    --slurpfile registry "${registry_path}" '
      def as_string(v):
        if (v | type) == "boolean" then (if v then "1" else "0" end)
        else (v | tostring)
        end;

      def slider_scaled(v; p):
        if ((p.upstream.divisor // 1) | tonumber) != 1
        then (((v | tonumber) * ((p.upstream.divisor // 1) | tonumber)) | round | tostring)
        else (v | tostring)
        end;

      def param_settings(name; value; param):
        if (param | type) != "object" or ((param.upstream.id // "") | length) == 0 then
          {}
        elif (param.upstream.controlType // "") == "checkbox" then
          {("E_CHECKBOX_" + param.upstream.id): (if value then "1" else "0" end)}
        elif (param.upstream.controlType // "") == "choice" then
          {("E_CHOICE_" + param.upstream.id): (value | tostring)}
        elif (param.upstream.controlType // "") == "slider" and (param.upstream.type // "") == "float" then
          {
            ("E_TEXTCTRL_" + param.upstream.id): (value | tostring),
            ("E_SLIDER_" + param.upstream.id): slider_scaled(value; param)
          }
        elif (param.upstream.controlType // "") == "slider" then
          {
            ("E_SLIDER_" + param.upstream.id): (value | tostring)
          }
        else
          {}
        end;

      ($registry[0].effects[$effect] // {}) as $effectRegistry
      | ($effectRegistry.parameters // {}) as $params
      | (
          reduce ($eff | to_entries[]) as $entry
            ({};
             . + param_settings($entry.key; $entry.value; ($params[$entry.key] // {})))
        )
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
    "Twinkle")
      twinkle_effect_settings_json "${effect_settings_json}" "${shared_settings_json}"
      ;;
    *)
      generic_registry_effect_settings_json "${effect_name}" "${effect_settings_json}" "${shared_settings_json}"
      ;;
  esac
}
