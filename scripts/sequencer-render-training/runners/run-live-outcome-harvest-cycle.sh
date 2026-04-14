#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

SOURCE=""
OUT_DIR="${ROOT_DIR}/catalog/effect-family-outcomes"
TRAINING_SET_PATH="${ROOT_DIR}/catalog/sequencer-unified-training-set-v1.json"
PARAMETER_BUNDLE_PATH="$(cd "${ROOT_DIR}/../.." && pwd)/apps/xlightsdesigner-ui/agent/sequence-agent/generated/derived-parameter-priors-bundle.js"
SHARED_SETTINGS_BUNDLE_PATH="$(cd "${ROOT_DIR}/../.." && pwd)/apps/xlightsdesigner-ui/agent/sequence-agent/generated/cross-effect-shared-settings-bundle.js"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source)
      SOURCE="$2"
      shift 2
      ;;
    --out-dir)
      OUT_DIR="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "${SOURCE}" ]]; then
  echo "usage: bash scripts/sequencer-render-training/runners/run-live-outcome-harvest-cycle.sh --source <project.xdproj|effect-outcomes-dir> [--out-dir <dir>]" >&2
  exit 1
fi

node "${ROOT_DIR}/tooling/harvest-effect-outcome-records.mjs" \
  --source "${SOURCE}" \
  --out-dir "${OUT_DIR}"

node "${ROOT_DIR}/tooling/build-unified-training-set.mjs" \
  "${TRAINING_SET_PATH}" \
  "${OUT_DIR}" \
  "${ROOT_DIR}/catalog/effect-screening-records"

node "${ROOT_DIR}/tooling/export-derived-parameter-priors-bundle.mjs" \
  --input "${TRAINING_SET_PATH}" \
  --output "${PARAMETER_BUNDLE_PATH}"

node "${ROOT_DIR}/tooling/export-cross-effect-shared-settings-bundle.mjs" \
  --input "${TRAINING_SET_PATH}" \
  --output "${SHARED_SETTINGS_BUNDLE_PATH}"

printf '[live-outcome-harvest] source=%s out=%s training=%s parameterBundle=%s sharedSettingsBundle=%s\n' \
  "${SOURCE}" "${OUT_DIR}" "${TRAINING_SET_PATH}" "${PARAMETER_BUNDLE_PATH}" "${SHARED_SETTINGS_BUNDLE_PATH}"
