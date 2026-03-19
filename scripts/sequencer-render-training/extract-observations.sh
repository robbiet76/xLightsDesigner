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

  ($sample.effectName // "") as $effect
  | ($sample.effectSettings // {}) as $settings
  | ($sample.sharedSettings // {}) as $shared
  | ($sample.labelHints // []) as $labelHints
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
              elif ($modelType == "outline" or $modelType == "single_line") then ["linear_hold"]
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
              elif $modelType == "single_line" then ["linear_pattern_fit"]
              elif $modelType == "matrix" then ["matrix_pattern_fit"]
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
              elif ($modelType == "outline" or $modelType == "single_line" or $modelType == "cane") then ["linear_sparkle_fit"]
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
        )
      else
        unique_labels(
          $labelHints
          + [("effect:" + ($effect | ascii_downcase)), ("model:" + $modelType)]
        )
      end
    ) as $labels
  | (
      if $effect == "On" then
        {
          readability:
            (
              (if $modelType == "matrix" then 0.92
               elif ($modelType == "outline" or $modelType == "single_line") then 0.9
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
            (if ($modelType == "matrix" or $modelType == "outline" or $modelType == "single_line") then 0.92 else 0.78 end)
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
            (if ($modelType == "cane" or $modelType == "single_line") then 0.9
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
            (if ($modelType == "outline" or $modelType == "single_line" or $modelType == "cane") then 0.84
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
