#!/usr/bin/env bash
set -euo pipefail

ARTIFACT_PATH=""
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --artifact)
      ARTIFACT_PATH="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

[[ -n "${ARTIFACT_PATH}" ]] || { echo "--artifact is required" >&2; exit 1; }
[[ -f "${ARTIFACT_PATH}" ]] || { echo "Artifact not found: ${ARTIFACT_PATH}" >&2; exit 1; }

bytes="$(stat -f%z "${ARTIFACT_PATH}")"
sha256="$(shasum -a 256 "${ARTIFACT_PATH}" | awk '{print $1}')"
mime_type="$(file -b --mime-type "${ARTIFACT_PATH}")"

width=""
height=""
if sips_output="$(sips -g pixelWidth -g pixelHeight "${ARTIFACT_PATH}" 2>/dev/null)"; then
  width="$(printf '%s\n' "${sips_output}" | awk '/pixelWidth:/ {print $2}' | tail -n 1)"
  height="$(printf '%s\n' "${sips_output}" | awk '/pixelHeight:/ {print $2}' | tail -n 1)"
fi

derived_features='{}'
if [[ "${mime_type}" == "image/gif" ]]; then
  tmpdir="$(mktemp -d)"
  trap 'rm -rf "${tmpdir}"' EXIT
  first_frame_png="${tmpdir}/first-frame.png"
  if sips -s format png "${ARTIFACT_PATH}" --out "${first_frame_png}" >/dev/null 2>&1 && [[ -f "${first_frame_png}" ]]; then
    derived_features="$(python3 "${SCRIPT_DIR}/extract-gif-features.py" --gif "${ARTIFACT_PATH}" --first-frame-png "${first_frame_png}")"
    sampled_frame_features="$(osascript -l JavaScript "${SCRIPT_DIR}/extract-gif-sampled-frame-features.js" "${ARTIFACT_PATH}")"
    derived_features="$(jq -cn --argjson base "${derived_features}" --argjson sampled "${sampled_frame_features}" '$base + $sampled')"
  fi
fi

jq -cn \
  --arg path "${ARTIFACT_PATH}" \
  --arg mimeType "${mime_type}" \
  --arg sha256 "${sha256}" \
  --argjson bytes "${bytes}" \
  --arg width "${width}" \
  --arg height "${height}" \
  --argjson derived "${derived_features}" \
  '{
    artifactPath: $path,
    fileSizeBytes: $bytes,
    mimeType: $mimeType,
    sha256: $sha256
  }
  + (if ($width | length) > 0 then {pixelWidth: ($width | tonumber)} else {} end)
  + (if ($height | length) > 0 then {pixelHeight: ($height | tonumber)} else {} end)
  + $derived'
