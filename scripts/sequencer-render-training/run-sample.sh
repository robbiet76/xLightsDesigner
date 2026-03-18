#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib.sh"

MANIFEST_FILE=""
OUT_DIR=""
SAMPLE_ID=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --manifest)
      MANIFEST_FILE="$2"
      shift 2
      ;;
    --out-dir)
      OUT_DIR="$2"
      shift 2
      ;;
    --sample-id)
      SAMPLE_ID="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

require_cmd jq

[[ -n "${MANIFEST_FILE}" ]] || { echo "--manifest is required" >&2; exit 1; }
[[ -f "${MANIFEST_FILE}" ]] || { echo "Manifest not found: ${MANIFEST_FILE}" >&2; exit 1; }
[[ -n "${OUT_DIR}" ]] || { echo "--out-dir is required" >&2; exit 1; }

mkdir -p "${OUT_DIR}"

if [[ -z "${SAMPLE_ID}" ]]; then
  SAMPLE_ID="$(jq -r '.samples[0].sampleId // empty' "${MANIFEST_FILE}")"
fi
[[ -n "${SAMPLE_ID}" ]] || { echo "No sampleId resolved from manifest" >&2; exit 1; }

fixture_json="$(jq -c '.fixture' "${MANIFEST_FILE}")"
sample_json="$(jq -c --arg sid "${SAMPLE_ID}" '.samples[] | select(.sampleId == $sid)' "${MANIFEST_FILE}")"
[[ -n "${sample_json}" ]] || { echo "Sample not found: ${SAMPLE_ID}" >&2; exit 1; }

sequence_path="$(jq -r '.sequencePath' <<<"${fixture_json}")"
model_name="$(jq -r '.modelName' <<<"${fixture_json}")"
model_type="$(jq -r '.modelType' <<<"${fixture_json}")"
start_ms="$(jq -r '.startMs' <<<"${fixture_json}")"
end_ms="$(jq -r '.endMs' <<<"${fixture_json}")"
sequence_dir="$(cd "$(dirname "${sequence_path}")" && pwd)"

effect_name="$(jq -r '.effectName' <<<"${sample_json}")"
shared_settings_json="$(jq -c '.sharedSettings // {}' <<<"${sample_json}")"
effect_settings_json="$(jq -c '.effectSettings // {}' <<<"${sample_json}")"
palette_json="$(jq -c '.sharedSettings.palette // {}' <<<"${sample_json}")"
export_mode="$(jq -r '.export.mode' <<<"${sample_json}")"
export_format="$(jq -r '.export.format // "gif"' <<<"${sample_json}")"

if [[ "${export_mode}" != "model_with_render" ]]; then
  echo "Initial harness only supports export.mode=model_with_render" >&2
  exit 1
fi

settings_json="$(settings_json_for_effect "${effect_name}" "${effect_settings_json}" "${shared_settings_json}")"
settings_string="$(jq -r 'to_entries | map("\(.key)=\(.value)") | join(",")' <<<"${settings_json}")"
palette_string="$(jq -r 'to_entries | map("\(.key)=\(.value)") | join(",")' <<<"${palette_json}")"

artifact_path="${OUT_DIR}/${SAMPLE_ID}.${export_format}"
staging_dir="${sequence_dir}/RenderTraining"
staged_artifact_path="${staging_dir}/${SAMPLE_ID}.${export_format}"
record_path="${OUT_DIR}/${SAMPLE_ID}.record.json"

mkdir -p "${staging_dir}"

opened_sequence=0
if run_allowing_already_open "$(jq -cn --arg seq "${sequence_path}" '{cmd:"openSequence",seq:$seq,promptIssues:"false",force:"true"}')" >/dev/null; then
  opened_sequence=1
fi

run_and_require_ok "$(jq -cn \
  --arg target "${model_name}" \
  --arg effect "${effect_name}" \
  --arg settings "${settings_string}" \
  --arg palette "${palette_string}" \
  --arg start "${start_ms}" \
  --arg end "${end_ms}" \
  '{cmd:"addEffect",target:$target,effect:$effect,settings:$settings,palette:$palette,layer:"0",startTime:$start,endTime:$end}')"

run_and_require_ok '{"cmd":"renderAll","highdef":"false"}' >/dev/null

run_and_require_ok "$(jq -cn \
  --arg model "${model_name}" \
  --arg file "${staged_artifact_path}" \
  --arg format "${export_format}" \
  '{cmd:"exportModelWithRender",model:$model,filename:$file,highdef:"false",format:$format}')" >/dev/null

cp "${staged_artifact_path}" "${artifact_path}"

if [[ "${opened_sequence}" == "1" ]]; then
  run_and_require_ok '{"cmd":"closeSequence","quiet":"true","force":"true"}' >/dev/null
fi

jq -cn \
  --arg version "1.0" \
  --arg sampleId "${SAMPLE_ID}" \
  --arg effectName "${effect_name}" \
  --arg sequencePath "${sequence_path}" \
  --arg modelName "${model_name}" \
  --arg modelType "${model_type}" \
  --arg mode "${export_mode}" \
  --arg format "${export_format}" \
  --arg path "${artifact_path}" \
  --argjson startMs "${start_ms}" \
  --argjson endMs "${end_ms}" \
  --argjson sharedSettings "${shared_settings_json}" \
  --argjson effectSettings "${effect_settings_json}" \
  '{
    recordVersion: $version,
    sampleId: $sampleId,
    effectName: $effectName,
    fixture: {
      sequencePath: $sequencePath,
      modelName: $modelName,
      modelType: $modelType,
      startMs: $startMs,
      endMs: $endMs
    },
    sharedSettings: $sharedSettings,
    effectSettings: $effectSettings,
    artifact: {
      mode: $mode,
      format: $format,
      path: $path
    },
    observations: {
      labels: [],
      scores: {},
      notes: "Initial harness capture. Interpretation pending."
    },
    features: {},
    comparisons: []
  }' > "${record_path}"

printf '%s\n' "${record_path}"
