#!/usr/bin/env bash
set -euo pipefail

SAMPLE_JSON=""
MODEL_TYPE=""
FEATURES_JSON=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --sample-json)
      SAMPLE_JSON="$2"
      shift 2
      ;;
    --model-type)
      MODEL_TYPE="$2"
      shift 2
      ;;
    --features-json)
      FEATURES_JSON="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

[[ -n "${SAMPLE_JSON}" ]] || { echo "--sample-json is required" >&2; exit 1; }
[[ -n "${MODEL_TYPE}" ]] || { echo "--model-type is required" >&2; exit 1; }
[[ -n "${FEATURES_JSON}" ]] || { echo "--features-json is required" >&2; exit 1; }

jq -cn \
  --argjson sample "${SAMPLE_JSON}" \
  --arg modelType "${MODEL_TYPE}" \
  --argjson features "${FEATURES_JSON}" '
  def clamp01:
    if . < 0 then 0
    elif . > 1 then 1
    else .
    end;

  def mean4(a; b; c; d):
    ((a + b + c + d) / 4);

  def unique_labels(xs):
    xs
    | map(select(type == "string" and length > 0))
    | unique;

  def normalized_label_hints(xs):
    if (xs | index("registry_generated")) != null then
      xs | map(select(. == "registry_generated" or . == "range_sample" or . == "derived_from_registry"))
    else
      xs
    end;

  ($sample.effectName // "") as $effect
  | ($sample.effectSettings // {}) as $settings
  | ($sample.sharedSettings // {}) as $shared
  | (normalized_label_hints($sample.labelHints // [])) as $labelHints
  | ($features.averageActiveNodeRatio // null) as $fseqActiveNodeRatio
  | ($features.averageActiveChannelRatio // null) as $fseqActiveChannelRatio
  | ($features.temporalChangeMean // null) as $fseqTemporalChangeMean
  | ($features.averageLongestRunRatio // null) as $fseqLongestRunRatio
  | ($features.pixelWidth // 0) as $w
  | ($features.pixelHeight // 0) as $h
  | ($w * $h) as $pixelCount
  | ($features.representativeSampledFrameActivePixelRatio
      // $features.firstFrameActivePixelRatio
      // $fseqActiveNodeRatio
      // $fseqActiveChannelRatio
      // 0) as $activeRatio
  | ($features.representativeSampledFrameAverageBrightness
      // $features.firstFrameAverageBrightness
      // $features.averageNodeBrightness
      // $features.averageChannelLevel
      // 0) as $repBrightness
  | ($features.representativeSampledFrameUniqueColorCount
      // $features.firstFrameUniqueColorCount
      // 0) as $repUniqueColors
  | ($fseqTemporalChangeMean // 0) as $temporalChange
  | ($fseqLongestRunRatio // 0) as $longestRunRatio
  | ($features.analysis // {}) as $analysis
  | ($analysis.patternFamily // null) as $patternFamily
  | ($analysis.intentCandidates // []) as $analysisIntents
  | ($analysis.patternSignals.directionality // null) as $analysisDirection
  | ($analysis.geometryProfile // null) as $geometryProfile
  | ($shared.renderStyle // "Default") as $renderStyle
  | (
      if $effect == "On" then
        unique_labels(
          $labelHints
          + ["effect:on", ("model:" + $modelType), ("render_style:" + ($renderStyle | ascii_downcase | gsub("[^a-z0-9]+"; "_")))]
          + (if ($settings.shimmer // false) then ["shimmer"] else ["steady"] end)
          + (if ($settings.shimmer // false) then ["shimmer_hold"] else ["static_hold"] end)
          + (
              if (($settings.startLevel // 0) > ($settings.endLevel // 0)) then ["ramp_down"]
              elif (($settings.startLevel // 0) < ($settings.endLevel // 0)) then ["ramp_up"]
              else ["flat_level"]
              end
            )
          + (
              if $modelType == "matrix" then ["matrix_fill"]
              elif $modelType == "arch" then ["arch_fill"]
              elif ($modelType == "outline" or $modelType == "single_line" or $modelType == "icicles") then ["linear_hold"]
              elif ($modelType == "tree_flat" or $modelType == "tree_360") then ["tree_fill"]
              elif $modelType == "star" then ["star_fill"]
              else []
              end
            )
          + (
              if $activeRatio >= 0.95 then ["full_coverage"]
              elif $activeRatio > 0 then ["partial_coverage"]
              else ["blank_sampled_frame"]
              end
            )
          + (if ($features.decoded // false) then ["decoded_fseq"] else [] end)
          + (if $patternFamily != null then [("pattern_family:" + ($patternFamily | ascii_downcase | gsub("[^a-z0-9]+"; "_")))] else [] end)
          + ($analysisIntents | map("intent:" + (. | ascii_downcase | gsub("[^a-z0-9]+"; "_"))))
          + (
              if $temporalChange >= 0.12 then ["high_motion_window"]
              elif $temporalChange > 0.02 then ["subtle_motion_window"]
              else ["stable_window"]
              end
            )
        )
      elif $effect == "SingleStrand" then
        unique_labels(
          $labelHints
          + ["effect:singlestrand", ("model:" + $modelType), ("render_style:" + ($renderStyle | ascii_downcase | gsub("[^a-z0-9]+"; "_")))]
          + (
              if ($settings.mode // "") == "Chase" then ["chase_pattern"]
              elif ($settings.mode // "") == "Skips" then ["skip_pattern"]
              elif ($settings.mode // "") == "FX" then ["fx_texture"]
              else ["unclassified_pattern"]
              end
            )
          + (
              if (($settings.chaseType // "") | ascii_downcase | test("bounce")) then ["bounce_motion"]
              elif (($settings.direction // "") | ascii_downcase) == "left" then ["left_motion"]
              elif (($settings.direction // "") | ascii_downcase) == "right" then ["right_motion"]
              else []
              end
            )
          + (
              if $modelType == "cane" then ["cane_pattern_fit"]
              elif $modelType == "arch" then ["arch_pattern_fit"]
              elif $modelType == "single_line" then ["linear_pattern_fit"]
              elif $modelType == "matrix" then ["matrix_pattern_fit"]
              elif ($modelType == "tree_flat" or $modelType == "tree_360") then ["tree_pattern_fit"]
              elif $modelType == "star" then ["star_pattern_fit"]
              else []
              end
            )
          + (
              if $activeRatio >= 0.5 then ["dense_sampled_motion"]
              elif $activeRatio > 0 then ["sparse_sampled_motion"]
              else ["blank_sampled_frame"]
              end
            )
          + (if ($features.decoded // false) then ["decoded_fseq"] else [] end)
          + (if $patternFamily != null then [("pattern_family:" + ($patternFamily | ascii_downcase | gsub("[^a-z0-9]+"; "_")))] else [] end)
          + (if $analysisDirection != null then [("directionality:" + ($analysisDirection | ascii_downcase | gsub("[^a-z0-9]+"; "_")))] else [] end)
          + ($analysisIntents | map("intent:" + (. | ascii_downcase | gsub("[^a-z0-9]+"; "_"))))
          + (
              if $longestRunRatio >= 0.7 then ["long_contiguous_pattern"]
              elif $longestRunRatio >= 0.25 then ["segmented_pattern"]
              else ["fragmented_pattern"]
              end
            )
        )
      elif $effect == "Shimmer" then
        unique_labels(
          $labelHints
          + ["effect:shimmer", ("model:" + $modelType), ("render_style:" + ($renderStyle | ascii_downcase | gsub("[^a-z0-9]+"; "_")))]
          + ["sparkle_texture"]
          + (if ($settings.useAllColors // false) then ["all_colors"] else ["palette_limited"] end)
          + (
              if (($settings.dutyFactor // 50) <= 35) then ["restrained_shimmer"]
              elif (($settings.dutyFactor // 50) >= 70) then ["heavy_shimmer"]
              else ["balanced_shimmer"]
              end
            )
          + (
              if $modelType == "matrix" then ["matrix_sparkle_fit"]
              elif ($modelType == "outline" or $modelType == "single_line" or $modelType == "cane" or $modelType == "arch" or $modelType == "icicles") then ["linear_sparkle_fit"]
              elif ($modelType == "tree_flat" or $modelType == "tree_360") then ["tree_sparkle_fit"]
              elif $modelType == "star" then ["star_sparkle_fit"]
              else []
              end
            )
          + (
              if $activeRatio >= 0.5 then ["dense_sampled_motion"]
              elif $activeRatio > 0 then ["sparse_sampled_motion"]
              else ["blank_sampled_frame"]
              end
            )
          + (if ($features.decoded // false) then ["decoded_fseq"] else [] end)
          + (if $patternFamily != null then [("pattern_family:" + ($patternFamily | ascii_downcase | gsub("[^a-z0-9]+"; "_")))] else [] end)
          + ($analysisIntents | map("intent:" + (. | ascii_downcase | gsub("[^a-z0-9]+"; "_"))))
        )
      elif $effect == "Color Wash" then
        unique_labels(
          $labelHints
          + ["effect:color_wash", ("model:" + $modelType), ("render_style:" + ($renderStyle | ascii_downcase | gsub("[^a-z0-9]+"; "_")))]
          + ["wash_fill"]
          + (if ($settings.shimmer // false) then ["shimmer_wash"] else ["steady_wash"] end)
          + (if ($settings.circularPalette // false) then ["circular_palette"] else ["linear_palette"] end)
          + (
              if ($settings.hFade // false) and ($settings.vFade // false) then ["two_axis_fade"]
              elif ($settings.hFade // false) then ["horizontal_fade"]
              elif ($settings.vFade // false) then ["vertical_fade"]
              else ["flat_fill"]
              end
            )
          + (
              if $modelType == "matrix" then ["matrix_fill"]
              elif ($modelType == "outline" or $modelType == "single_line") then ["linear_fill"]
              else []
              end
            )
          + (
              if $activeRatio >= 0.95 then ["full_coverage"]
              elif $activeRatio > 0 then ["partial_coverage"]
              else ["blank_sampled_frame"]
              end
            )
          + (if ($features.decoded // false) then ["decoded_fseq"] else [] end)
          + (if $patternFamily != null then [("pattern_family:" + ($patternFamily | ascii_downcase | gsub("[^a-z0-9]+"; "_")))] else [] end)
          + ($analysisIntents | map("intent:" + (. | ascii_downcase | gsub("[^a-z0-9]+"; "_"))))
        )
      elif $effect == "Bars" then
        unique_labels(
          $labelHints
          + ["effect:bars", ("model:" + $modelType), ("render_style:" + ($renderStyle | ascii_downcase | gsub("[^a-z0-9]+"; "_")))]
          + ["bar_pattern"]
          + (
              if (($settings.direction // "") | ascii_downcase) == "left" then ["left_motion"]
              elif (($settings.direction // "") | ascii_downcase) == "right" then ["right_motion"]
              elif (($settings.direction // "") | ascii_downcase) == "expand" then ["expand_motion"]
              elif (($settings.direction // "") | ascii_downcase) == "compress" then ["compress_motion"]
              else []
              end
            )
          + (
              if $modelType == "arch" then ["arch_pattern_fit"]
              elif $modelType == "single_line" then ["linear_pattern_fit"]
              elif ($modelType == "tree_flat" or $modelType == "tree_360") then ["tree_pattern_fit"]
              else []
              end
            )
          + (
              if (($settings.barCount // 1) >= 4) then ["dense_bars"]
              elif (($settings.barCount // 1) >= 2) then ["multi_bar"]
              else ["single_bar"]
              end
            )
          + (if ($features.decoded // false) then ["decoded_fseq"] else [] end)
          + (if $patternFamily != null then [("pattern_family:" + ($patternFamily | ascii_downcase | gsub("[^a-z0-9]+"; "_")))] else [] end)
          + ($analysisIntents | map("intent:" + (. | ascii_downcase | gsub("[^a-z0-9]+"; "_"))))
        )
      elif $effect == "Spirals" then
        unique_labels(
          $labelHints
          + ["effect:spirals", ("model:" + $modelType), ("render_style:" + ($renderStyle | ascii_downcase | gsub("[^a-z0-9]+"; "_")))]
          + ["spiral_pattern"]
          + (
              if (($settings.movement // 0) < 0) then ["reverse_motion"]
              elif (($settings.movement // 0) > 0) then ["forward_motion"]
              else ["static_spiral"]
              end
            )
          + (
              if (($settings.rotation // 0) < 0) then ["reverse_rotation"]
              elif (($settings.rotation // 0) > 0) then ["forward_rotation"]
              else ["neutral_rotation"]
              end
            )
          + (
              if $modelType == "star" then ["star_pattern_fit"]
              elif ($modelType == "tree_flat" or $modelType == "tree_360") then ["tree_pattern_fit"]
              else []
              end
            )
          + (
              if (($settings.count // 1) >= 3) then ["dense_spirals"]
              elif (($settings.count // 1) >= 2) then ["multi_spiral"]
              else ["single_spiral"]
              end
            )
          + (
              if (($settings.thickness // 50) >= 70) then ["thick_spiral"]
              elif (($settings.thickness // 50) <= 20) then ["thin_spiral"]
              else ["medium_spiral"]
              end
            )
          + (
              if (($settings.movement // 0) != 0 and ($settings.rotation // 0) != 0) then ["spiral_flow"]
              elif (($settings.movement // 0) != 0) then ["spiral_drift"]
              elif (($settings.rotation // 0) != 0) then ["spiral_rotation"]
              else ["spiral_bands"]
              end
            )
          + (if $geometryProfile == "tree_360_spiral" then ["geometry_coupled_spiral"] else [] end)
          + (if ($features.decoded // false) then ["decoded_fseq"] else [] end)
          + (if $patternFamily != null then [("pattern_family:" + ($patternFamily | ascii_downcase | gsub("[^a-z0-9]+"; "_")))] else [] end)
          + ($analysisIntents | map("intent:" + (. | ascii_downcase | gsub("[^a-z0-9]+"; "_"))))
        )
      elif $effect == "Marquee" then
        unique_labels(
          $labelHints
          + ["effect:marquee", ("model:" + $modelType), ("render_style:" + ($renderStyle | ascii_downcase | gsub("[^a-z0-9]+"; "_")))]
          + ["marquee_pattern"]
          + (if ($settings.reverse // false) then ["reverse_motion"] else ["forward_motion"] end)
          + (
              if $modelType == "arch" then ["arch_pattern_fit"]
              elif ($modelType == "single_line" or $modelType == "icicles") then ["linear_pattern_fit"]
              elif ($modelType == "tree_flat" or $modelType == "tree_360") then ["tree_pattern_fit"]
              else []
              end
            )
          + (
              if (($settings.skipSize // 0) >= 4) then ["segmented_marquee"]
              elif (($settings.bandSize // 1) >= 6) then ["wide_marquee"]
              else ["tight_marquee"]
              end
            )
          + (if ($features.decoded // false) then ["decoded_fseq"] else [] end)
          + (if $patternFamily != null then [("pattern_family:" + ($patternFamily | ascii_downcase | gsub("[^a-z0-9]+"; "_")))] else [] end)
          + ($analysisIntents | map("intent:" + (. | ascii_downcase | gsub("[^a-z0-9]+"; "_"))))
        )
      elif $effect == "Pinwheel" then
        unique_labels(
          $labelHints
          + ["effect:pinwheel", ("model:" + $modelType), ("render_style:" + ($renderStyle | ascii_downcase | gsub("[^a-z0-9]+"; "_")))]
          + ["pinwheel_pattern"]
          + (if ($settings.rotation // false) then ["rotating_pinwheel"] else ["static_pinwheel"] end)
          + (
              if $modelType == "star" then ["star_pattern_fit"]
              elif ($modelType == "tree_flat" or $modelType == "tree_360") then ["tree_pattern_fit"]
              elif $modelType == "spinner" then ["radial_pattern_fit"]
              else []
              end
            )
          + (
              if (($settings.arms // 2) >= 6) then ["dense_pinwheel"]
              elif (($settings.arms // 2) >= 4) then ["multi_arm_pinwheel"]
              else ["few_arm_pinwheel"]
              end
            )
          + (if (($settings["3DMode"] // "None") | ascii_downcase) != "none" then ["depth_mode"] else [] end)
          + (if ($features.decoded // false) then ["decoded_fseq"] else [] end)
          + (if $patternFamily != null then [("pattern_family:" + ($patternFamily | ascii_downcase | gsub("[^a-z0-9]+"; "_")))] else [] end)
          + ($analysisIntents | map("intent:" + (. | ascii_downcase | gsub("[^a-z0-9]+"; "_"))))
        )
      elif $effect == "Shockwave" then
        unique_labels(
          $labelHints
          + ["effect:shockwave", ("model:" + $modelType), ("render_style:" + ($renderStyle | ascii_downcase | gsub("[^a-z0-9]+"; "_")))]
          + ["shockwave_pattern"]
          + (
              if $modelType == "star" or $modelType == "spinner" then ["radial_pattern_fit"]
              elif ($modelType == "tree_flat" or $modelType == "tree_360") then ["tree_pattern_fit"]
              elif ($modelType == "matrix") then ["matrix_pattern_fit"]
              else []
              end
            )
          + (
              if (($settings.centerX // 50) == 50 and ($settings.centerY // 50) == 50) then ["centered_shockwave"]
              else ["offset_shockwave"]
              end
            )
          + (
              if (($settings.endRadius // 10) - ($settings.startRadius // 1)) >= 40 then ["large_shockwave"]
              else ["compact_shockwave"]
              end
            )
          + (if ($settings.blendEdges // true) then ["blended_shockwave"] else ["hard_edge_shockwave"] end)
          + (if ($settings.scale // true) then ["scaled_shockwave"] else [] end)
          + (if ($features.decoded // false) then ["decoded_fseq"] else [] end)
          + (if $patternFamily != null then [("pattern_family:" + ($patternFamily | ascii_downcase | gsub("[^a-z0-9]+"; "_")))] else [] end)
          + ($analysisIntents | map("intent:" + (. | ascii_downcase | gsub("[^a-z0-9]+"; "_"))))
        )
      else
        unique_labels(
          $labelHints
          + [("effect:" + ($effect | ascii_downcase)), ("model:" + $modelType)]
          + (if $patternFamily != null then [("pattern_family:" + ($patternFamily | ascii_downcase | gsub("[^a-z0-9]+"; "_")))] else [] end)
          + ($analysisIntents | map("intent:" + (. | ascii_downcase | gsub("[^a-z0-9]+"; "_"))))
        )
      end
    ) as $labels
  | (
      if $effect == "On" then
        {
          readability:
            (
              (if $modelType == "matrix" then 0.92
               elif ($modelType == "outline" or $modelType == "single_line" or $modelType == "arch" or $modelType == "icicles") then 0.9
               elif ($modelType == "tree_flat" or $modelType == "tree_360") then 0.86
               elif $modelType == "star" then 0.88
               else 0.82 end)
              * (if $activeRatio > 0 then 1 else 0.55 end)
            ),
          restraint:
            (if ($settings.shimmer // false) then 0.62
             elif (($settings.startLevel // 100) <= 60 or ($settings.endLevel // 100) <= 60) then 0.88
             else 0.82 end),
          patternClarity:
            (
              (if ($settings.shimmer // false) then 0.7 else 0.95 end)
              * (if $activeRatio > 0 then 1 else 0.35 end)
            ),
          propSuitability:
            (if ($modelType == "matrix" or $modelType == "outline" or $modelType == "single_line" or $modelType == "arch" or $modelType == "icicles") then 0.92
             elif ($modelType == "tree_flat" or $modelType == "tree_360") then 0.88
             elif $modelType == "star" then 0.9
             else 0.78 end)
        }
      elif $effect == "SingleStrand" then
        {
          readability:
            (
              (if (($settings.mode // "") == "FX") then 0.58
               elif (($settings.mode // "") == "Skips") then 0.8
               elif (($settings.chaseType // "") | ascii_downcase | test("bounce")) then 0.74
               else 0.84 end)
              * (if $activeRatio > 0 then 1 else 0.4 end)
            ),
          restraint:
            (if (($settings.mode // "") == "FX") then 0.42
             elif (($settings.numberChases // 1) > 1) then 0.6
             else 0.72 end),
          patternClarity:
            (
              (if (($settings.mode // "") == "FX") then 0.5
               elif (($settings.mode // "") == "Skips") then 0.82
               elif (($settings.chaseType // "") | ascii_downcase | test("bounce")) then 0.78
               else 0.86 end)
              * (if $activeRatio > 0 then 1 else 0.3 end)
            ),
          propSuitability:
            (if ($modelType == "cane" or $modelType == "single_line" or $modelType == "arch" or $modelType == "icicles") then 0.9
             elif ($modelType == "tree_flat" or $modelType == "tree_360") then 0.84
             elif $modelType == "star" then 0.72
             elif $modelType == "matrix" then 0.6
             else 0.72 end)
        }
      elif $effect == "Shimmer" then
        {
          readability:
            (
              (if (($settings.useAllColors // false)) then 0.62
               elif (($settings.dutyFactor // 50) >= 70) then 0.68
               else 0.82 end)
              * (if $activeRatio > 0 then 1 else 0.4 end)
            ),
          restraint:
            (if (($settings.useAllColors // false)) then 0.38
             elif (($settings.dutyFactor // 50) <= 35 and ($settings.cycles // 1.0) <= 1.5) then 0.84
             elif (($settings.dutyFactor // 50) >= 70 or ($settings.cycles // 1.0) >= 4.0) then 0.48
             else 0.66 end),
          patternClarity:
            (
              (if (($settings.cycles // 1.0) >= 4.0 and ($settings.useAllColors // false)) then 0.52
               elif (($settings.cycles // 1.0) >= 4.0) then 0.66
               else 0.78 end)
              * (if $activeRatio > 0 then 1 else 0.35 end)
            ),
          propSuitability:
            (if ($modelType == "outline" or $modelType == "single_line" or $modelType == "cane" or $modelType == "arch" or $modelType == "icicles") then 0.84
             elif ($modelType == "tree_flat" or $modelType == "tree_360") then 0.86
             elif $modelType == "star" then 0.82
             elif $modelType == "matrix" then 0.8
             else 0.72 end)
        }
      elif $effect == "Color Wash" then
        {
          readability:
            (
              (if (($settings.hFade // false) and ($settings.vFade // false)) then 0.76
               elif ($settings.shimmer // false) then 0.72
               else 0.86 end)
              * (if $activeRatio > 0 then 1 else 0.45 end)
            ),
          restraint:
            (if (($settings.shimmer // false)) then 0.52
             elif (($settings.hFade // false) or ($settings.vFade // false)) then 0.74
             else 0.8 end),
          patternClarity:
            (
              (if (($settings.hFade // false) and ($settings.vFade // false)) then 0.7
               elif (($settings.circularPalette // false)) then 0.74
               else 0.82 end)
              * (if $activeRatio > 0 then 1 else 0.4 end)
            ),
          propSuitability:
            (if ($modelType == "matrix") then 0.9
             elif ($modelType == "outline" or $modelType == "single_line") then 0.82
             else 0.74 end)
        }
      elif $effect == "Bars" then
        {
          readability:
            (
              (if (($settings.barCount // 1) >= 4) then 0.72 else 0.84 end)
              * (if $activeRatio > 0 then 1 else 0.45 end)
            ),
          restraint:
            (if (($settings.gradient // false) or ($settings["3D"] // false)) then 0.64
             elif (($settings.barCount // 1) >= 4) then 0.52
             else 0.74 end),
          patternClarity:
            (
              (if (($settings.direction // "") | ascii_downcase | test("expand|compress")) then 0.82 else 0.86 end)
              * (if $activeRatio > 0 then 1 else 0.4 end)
            ),
          propSuitability:
            (if ($modelType == "single_line" or $modelType == "arch") then 0.9
             elif ($modelType == "tree_flat" or $modelType == "tree_360") then 0.84
             elif $modelType == "matrix" then 0.78
             else 0.72 end)
        }
      elif $effect == "Spirals" then
        {
          readability:
            (
              (if (($settings.count // 1) >= 3) then 0.72 else 0.82 end)
              * (if $activeRatio > 0 then 1 else 0.45 end)
            ),
          restraint:
            (if (($settings.blend // false) or ($settings["3D"] // false)) then 0.56
             elif (($settings.thickness // 50) >= 70) then 0.5
             else 0.72 end),
          patternClarity:
            (
              (if (($settings.count // 1) >= 3 and ($settings.thickness // 50) >= 60) then 0.72 else 0.84 end)
              * (if $activeRatio > 0 then 1 else 0.4 end)
            ),
          propSuitability:
            (if ($modelType == "tree_flat" or $modelType == "tree_360") then 0.92
             elif $modelType == "star" then 0.86
             elif $modelType == "spinner" then 0.88
             else 0.68 end)
        }
      elif $effect == "Marquee" then
        {
          readability:
            (
              (if (($settings.skipSize // 0) >= 4) then 0.78 else 0.86 end)
              * (if $activeRatio > 0 then 1 else 0.45 end)
            ),
          restraint:
            (if (($settings.bandSize // 1) >= 6 or ($settings.stagger // 0) >= 4) then 0.56
             else 0.72 end),
          patternClarity:
            (
              (if (($settings.skipSize // 0) >= 4 and ($settings.thickness // 1) >= 4) then 0.74 else 0.86 end)
              * (if $activeRatio > 0 then 1 else 0.4 end)
            ),
          propSuitability:
            (if ($modelType == "single_line" or $modelType == "arch" or $modelType == "icicles") then 0.92
             elif ($modelType == "tree_flat" or $modelType == "tree_360") then 0.82
             else 0.68 end)
        }
      elif $effect == "Pinwheel" then
        {
          readability:
            (
              (if (($settings.arms // 2) >= 6) then 0.74 else 0.84 end)
              * (if $activeRatio > 0 then 1 else 0.45 end)
            ),
          restraint:
            (if (($settings["3DMode"] // "None") | ascii_downcase) != "none" then 0.5
             elif (($settings.thickness // 40) >= 60) then 0.56
             else 0.72 end),
          patternClarity:
            (
              (if (($settings.rotation // false) and (($settings.twist // 0) | tonumber) != 0) then 0.8 else 0.86 end)
              * (if $activeRatio > 0 then 1 else 0.4 end)
            ),
          propSuitability:
            (if ($modelType == "star" or $modelType == "spinner") then 0.92
             elif ($modelType == "tree_flat" or $modelType == "tree_360") then 0.86
             else 0.68 end)
        }
      elif $effect == "Shockwave" then
        {
          readability:
            (
              (if (($settings.blendEdges // true)) then 0.84 else 0.78 end)
              * (if $activeRatio > 0 then 1 else 0.45 end)
            ),
          restraint:
            (if ((($settings.endRadius // 10) - ($settings.startRadius // 1)) >= 40) then 0.58
             elif (($settings.blendEdges // true)) then 0.72
             else 0.64 end),
          patternClarity:
            (
              (if (($settings.centerX // 50) == 50 and ($settings.centerY // 50) == 50) then 0.86 else 0.78 end)
              * (if $activeRatio > 0 then 1 else 0.4 end)
            ),
          propSuitability:
            (if ($modelType == "spinner" or $modelType == "star") then 0.9
             elif ($modelType == "tree_flat" or $modelType == "tree_360") then 0.88
             elif ($modelType == "matrix") then 0.92
             else 0.66 end)
        }
      else
        {
          readability: 0.5,
          restraint: 0.5,
          patternClarity: 0.5,
          propSuitability: 0.5
        }
      end
    ) as $baseScores
  | ($baseScores + {
      usefulness: mean4(
        ($baseScores.readability // 0.5);
        ($baseScores.restraint // 0.5);
        ($baseScores.patternClarity // 0.5);
        ($baseScores.propSuitability // 0.5)
      ) | clamp01
    }) as $scores
  | {
      labels: $labels,
      scores: $scores,
      notes:
        ("Heuristic interpretation from manifest intent plus render-derived features."
          + " pixelCount=" + ($pixelCount | tostring)
          + " decoded=" + (($features.decoded // false) | tostring))
    }'
