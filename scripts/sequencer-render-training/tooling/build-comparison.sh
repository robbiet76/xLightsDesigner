#!/usr/bin/env bash
set -euo pipefail

LEFT_SAMPLE_ID=""
RIGHT_SAMPLE_ID=""
LEFT_OBSERVATIONS=""
RIGHT_OBSERVATIONS=""
CRITERION=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --left-sample-id)
      LEFT_SAMPLE_ID="$2"
      shift 2
      ;;
    --right-sample-id)
      RIGHT_SAMPLE_ID="$2"
      shift 2
      ;;
    --left-observations)
      LEFT_OBSERVATIONS="$2"
      shift 2
      ;;
    --right-observations)
      RIGHT_OBSERVATIONS="$2"
      shift 2
      ;;
    --criterion)
      CRITERION="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

command -v jq >/dev/null 2>&1 || {
  echo "Missing required command: jq" >&2
  exit 1
}

[[ -n "${LEFT_SAMPLE_ID}" ]] || { echo "--left-sample-id is required" >&2; exit 1; }
[[ -n "${RIGHT_SAMPLE_ID}" ]] || { echo "--right-sample-id is required" >&2; exit 1; }
[[ -n "${LEFT_OBSERVATIONS}" ]] || { echo "--left-observations is required" >&2; exit 1; }
[[ -f "${LEFT_OBSERVATIONS}" ]] || { echo "Left observations not found: ${LEFT_OBSERVATIONS}" >&2; exit 1; }
[[ -n "${RIGHT_OBSERVATIONS}" ]] || { echo "--right-observations is required" >&2; exit 1; }
[[ -f "${RIGHT_OBSERVATIONS}" ]] || { echo "Right observations not found: ${RIGHT_OBSERVATIONS}" >&2; exit 1; }
[[ -n "${CRITERION}" ]] || { echo "--criterion is required" >&2; exit 1; }

case "${CRITERION}" in
  usefulness|readability|restraint|patternClarity|propSuitability)
    ;;
  *)
    echo "Unsupported criterion: ${CRITERION}" >&2
    exit 1
    ;;
esac

left_score="$(jq -r --arg k "${CRITERION}" '.scores[$k] // empty' "${LEFT_OBSERVATIONS}")"
right_score="$(jq -r --arg k "${CRITERION}" '.scores[$k] // empty' "${RIGHT_OBSERVATIONS}")"
[[ -n "${left_score}" ]] || { echo "Left score missing for criterion: ${CRITERION}" >&2; exit 1; }
[[ -n "${right_score}" ]] || { echo "Right score missing for criterion: ${CRITERION}" >&2; exit 1; }

winner_side="$(python3 - <<'PY' "${left_score}" "${right_score}"
import sys
left = float(sys.argv[1])
right = float(sys.argv[2])
if left > right:
    print("left")
elif right > left:
    print("right")
else:
    print("tie")
PY
)"

margin="$(python3 - <<'PY' "${left_score}" "${right_score}"
import sys
left = float(sys.argv[1])
right = float(sys.argv[2])
print(f"{abs(left-right):.4f}")
PY
)"

if [[ "${winner_side}" == "tie" ]]; then
  jq -cn \
    --arg criterion "${CRITERION}" \
    --arg leftSampleId "${LEFT_SAMPLE_ID}" \
    --arg rightSampleId "${RIGHT_SAMPLE_ID}" \
    --argjson leftScore "${left_score}" \
    --argjson rightScore "${right_score}" \
    --arg margin "${margin}" \
    '{
      preferredSampleId: null,
      comparison: null,
      tie: {
        criterion: $criterion,
        leftSampleId: $leftSampleId,
        rightSampleId: $rightSampleId,
        leftScore: $leftScore,
        rightScore: $rightScore,
        margin: ($margin | tonumber)
      }
    }'
  exit 0
fi

if [[ "${winner_side}" == "left" ]]; then
  preferred_sample_id="${LEFT_SAMPLE_ID}"
  other_sample_id="${RIGHT_SAMPLE_ID}"
  preferred_score="${left_score}"
  other_score="${right_score}"
else
  preferred_sample_id="${RIGHT_SAMPLE_ID}"
  other_sample_id="${LEFT_SAMPLE_ID}"
  preferred_score="${right_score}"
  other_score="${left_score}"
fi

jq -cn \
  --arg preferredSampleId "${preferred_sample_id}" \
  --arg otherSampleId "${other_sample_id}" \
  --arg criterion "${CRITERION}" \
  --argjson preferredScore "${preferred_score}" \
  --argjson otherScore "${other_score}" \
  --arg margin "${margin}" \
  '{
    preferredSampleId: $preferredSampleId,
    comparison: {
      otherSampleId: $otherSampleId,
      preferredFor: $criterion,
      notes: ("preferredScore="
        + ($preferredScore | tostring)
        + ", otherScore="
        + ($otherScore | tostring)
        + ", margin="
        + $margin)
    }
  }'
