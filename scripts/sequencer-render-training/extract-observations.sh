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
  | ($features.pixelWidth // 0) as $w
  | ($features.pixelHeight // 0) as $h
  | ($w * $h) as $pixelCount
  | ($features.representativeSampledFrameActivePixelRatio
      // $features.firstFrameActivePixelRatio
      // 0) as $activeRatio
  | ($features.representativeSampledFrameAverageBrightness
      // $features.firstFrameAverageBrightness
      // 0) as $repBrightness
  | ($features.representativeSampledFrameUniqueColorCount
      // $features.firstFrameUniqueColorCount
      // 0) as $repUniqueColors
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
        ("Initial heuristic interpretation from manifest intent, model class, and render-derived geometry. pixelCount="
          + ($pixelCount | tostring))
    }'
