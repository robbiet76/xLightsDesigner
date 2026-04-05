#!/usr/bin/env bash
set -euo pipefail

LEFT_RECORD=""
RIGHT_RECORD=""
CRITERION=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --left-record)
      LEFT_RECORD="$2"
      shift 2
      ;;
    --right-record)
      RIGHT_RECORD="$2"
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

[[ -n "${LEFT_RECORD}" ]] || { echo "--left-record is required" >&2; exit 1; }
[[ -f "${LEFT_RECORD}" ]] || { echo "Left record not found: ${LEFT_RECORD}" >&2; exit 1; }
[[ -n "${RIGHT_RECORD}" ]] || { echo "--right-record is required" >&2; exit 1; }
[[ -f "${RIGHT_RECORD}" ]] || { echo "Right record not found: ${RIGHT_RECORD}" >&2; exit 1; }
[[ -n "${CRITERION}" ]] || { echo "--criterion is required" >&2; exit 1; }

left_sample_id="$(jq -r '.sampleId' "${LEFT_RECORD}")"
right_sample_id="$(jq -r '.sampleId' "${RIGHT_RECORD}")"

left_obs_file="$(mktemp)"
right_obs_file="$(mktemp)"
trap 'rm -f "${left_obs_file}" "${right_obs_file}"' EXIT

jq '.observations' "${LEFT_RECORD}" > "${left_obs_file}"
jq '.observations' "${RIGHT_RECORD}" > "${right_obs_file}"

bash "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/build-comparison.sh" \
  --left-sample-id "${left_sample_id}" \
  --right-sample-id "${right_sample_id}" \
  --left-observations "${left_obs_file}" \
  --right-observations "${right_obs_file}" \
  --criterion "${CRITERION}"
