#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
source "${ROOT_DIR}/tooling/lib.sh"

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

log_step() {
  printf '[run-sample] %s\n' "$*" >&2
}

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
expected_model_type="$(jq -r '.modelType // empty' <<<"${fixture_json}")"
fixture_start_ms="$(jq -r '.startMs' <<<"${fixture_json}")"
fixture_end_ms="$(jq -r '.endMs' <<<"${fixture_json}")"
fixture_duration_class="$(jq -r '.durationClass // "short"' <<<"${fixture_json}")"
sequence_dir="$(cd "$(dirname "${sequence_path}")" && pwd)"
show_dir="$(resolve_show_dir_for_sequence "${sequence_path}")"
model_metadata_json="$(python3 "${ROOT_DIR}/tooling/get-model-fseq-metadata.py" --show-dir "${show_dir}" --model-name "${model_name}")"
resolved_model_type="$(jq -r '.resolvedModelType' <<<"${model_metadata_json}")"
resolved_geometry_profile="$(jq -r '.resolvedGeometryProfile' <<<"${model_metadata_json}")"
source_sequence_path="${sequence_path}"
sequence_base_name="$(basename "${sequence_path}" .xsq)"

effect_name="$(jq -r '.effectName' <<<"${sample_json}")"
shared_settings_json="$(jq -c '.sharedSettings // {}' <<<"${sample_json}")"
effect_settings_json="$(jq -c '.effectSettings // {}' <<<"${sample_json}")"
palette_json="$(jq -c '.sharedSettings.palette // {}' <<<"${sample_json}")"
export_mode="$(jq -r '.export.mode' <<<"${sample_json}")"
export_format="$(jq -r '.export.format // "gif"' <<<"${sample_json}")"
start_ms="$(jq -r --argjson fixture "${fixture_json}" '(.timingWindow.startMs // $fixture.startMs)' <<<"${sample_json}")"
end_ms="$(jq -r --argjson fixture "${fixture_json}" '(.timingWindow.endMs // $fixture.endMs)' <<<"${sample_json}")"
duration_class="$(jq -r --argjson fixture "${fixture_json}" '(.timingWindow.durationClass // $fixture.durationClass // "short")' <<<"${sample_json}")"
duration_ms="$((end_ms - start_ms))"

[[ "${duration_ms}" -gt 0 ]] || {
  echo "Resolved timing window is invalid for sample ${SAMPLE_ID}: start=${start_ms} end=${end_ms}" >&2
  exit 1
}

if [[ "${export_mode}" != "model_with_render" ]]; then
  echo "Initial harness only supports export.mode=model_with_render" >&2
  exit 1
fi

settings_json="$(settings_json_for_effect "${effect_name}" "${effect_settings_json}" "${shared_settings_json}")"
settings_string="$(jq -r 'to_entries | map("\(.key)=\(.value)") | join(",")' <<<"${settings_json}")"
palette_string="$(jq -r 'to_entries | map("\(.key)=\(.value)") | join(",")' <<<"${palette_json}")"

artifact_path="${OUT_DIR}/${SAMPLE_ID}.${export_format}"
staging_dir="${sequence_dir}"
staged_artifact_path="${staging_dir}/${SAMPLE_ID}.${export_format}"
working_sequence_path="${staging_dir}/${sequence_base_name}.render-training-${SAMPLE_ID}-$$.xsq"
record_path="${OUT_DIR}/${SAMPLE_ID}.record.json"
features_path="${OUT_DIR}/${SAMPLE_ID}.features.json"
observations_path="${OUT_DIR}/${SAMPLE_ID}.observations.json"

mkdir -p "${staging_dir}"
cp "${source_sequence_path}" "${working_sequence_path}"
cleanup_working_sequence() {
  rm -f "${working_sequence_path}"
}
trap cleanup_working_sequence EXIT

opened_sequence=0
if [[ "${XLIGHTS_RECYCLE_BEFORE_SAMPLE}" == "1" ]]; then
  log_step "recycle-before-sample sampleId=${SAMPLE_ID}"
  restart_xlights_app >/dev/null
else
  log_step "ensure-ready sampleId=${SAMPLE_ID}"
  ensure_xlights_ready >/dev/null
fi

if [[ "${XLIGHTS_RECYCLE_BEFORE_SAMPLE}" != "1" ]]; then
  log_step "close-any-open-sequence sampleId=${SAMPLE_ID}"
  post_cmd '{"cmd":"closeSequence","quiet":"true","force":"true"}' >/dev/null 2>&1 || true
  sleep 1
  ensure_xlights_ready >/dev/null
fi

log_step "change-show-folder sampleId=${SAMPLE_ID} folder=${show_dir}"
run_and_require_ok "$(jq -cn --arg folder "${show_dir}" '{cmd:"changeShowFolder",folder:$folder}')" >/dev/null

log_step "open-sequence sampleId=${SAMPLE_ID} sequence=${working_sequence_path}"
open_sequence_payload="$(jq -cn --arg file "${working_sequence_path}" '{apiVersion:2,cmd:"sequence.open",params:{file:$file,force:true,promptIssues:false}}')"
if run_allowing_already_open "${open_sequence_payload}" >/dev/null; then
  opened_sequence=1
else
  log_step "open-sequence-retry sampleId=${SAMPLE_ID}"
  if [[ "${XLIGHTS_RECYCLE_BEFORE_SAMPLE}" == "1" ]]; then
    restart_xlights_app >/dev/null
  else
    post_cmd '{"cmd":"closeSequence","quiet":"true","force":"true"}' >/dev/null 2>&1 || true
    sleep 2
    ensure_xlights_ready >/dev/null
  fi
  if run_allowing_already_open "${open_sequence_payload}" >/dev/null; then
    opened_sequence=1
  else
    echo "Failed to open working sequence after retry: ${working_sequence_path}" >&2
    exit 1
  fi
fi

log_step "add-effect sampleId=${SAMPLE_ID} effect=${effect_name} model=${model_name} start=${start_ms} end=${end_ms}"
run_and_require_ok "$(jq -cn \
  --arg target "${model_name}" \
  --arg effect "${effect_name}" \
  --arg settings "${settings_string}" \
  --arg palette "${palette_string}" \
  --arg start "${start_ms}" \
  --arg end "${end_ms}" \
  '{cmd:"addEffect",target:$target,effect:$effect,settings:$settings,palette:$palette,layer:"0",startTime:$start,endTime:$end}')" >/dev/null

log_step "render-all sampleId=${SAMPLE_ID}"
run_and_require_ok '{"cmd":"renderAll","highdef":"false"}' >/dev/null

log_step "export-model sampleId=${SAMPLE_ID} artifact=${staged_artifact_path}"
run_and_require_ok "$(jq -cn \
  --arg model "${model_name}" \
  --arg file "${staged_artifact_path}" \
  --arg format "${export_format}" \
  '{cmd:"exportModelWithRender",model:$model,filename:$file,highdef:"false",format:$format}')" >/dev/null

[[ -s "${staged_artifact_path}" ]] || {
  echo "xLights reported export success but no staged artifact was created: ${staged_artifact_path}" >&2
  exit 1
}

cp "${staged_artifact_path}" "${artifact_path}"

[[ -s "${artifact_path}" ]] || {
  echo "Artifact copy failed: ${artifact_path}" >&2
  exit 1
}

bash "${ROOT_DIR}/tooling/extract-artifact-features.sh" --artifact "${artifact_path}" > "${features_path}"
bash "${ROOT_DIR}/tooling/extract-observations.sh" \
  --sample-json "${sample_json}" \
  --model-type "${resolved_model_type}" \
  --features-json "$(cat "${features_path}")" > "${observations_path}"

if [[ "${opened_sequence}" == "1" && "${XLIGHTS_RECYCLE_BEFORE_SAMPLE}" != "1" ]]; then
  log_step "close-sequence sampleId=${SAMPLE_ID}"
  run_and_require_ok '{"cmd":"closeSequence","quiet":"true","force":"true"}' >/dev/null
fi

log_step "record-written sampleId=${SAMPLE_ID} record=${record_path}"

jq -cn \
  --arg version "1.0" \
  --arg sampleId "${SAMPLE_ID}" \
  --arg effectName "${effect_name}" \
  --arg sequencePath "${source_sequence_path}" \
  --arg workingSequencePath "${working_sequence_path}" \
  --arg modelName "${model_name}" \
  --arg modelType "${resolved_model_type}" \
  --arg geometryProfile "${resolved_geometry_profile}" \
  --arg expectedModelType "${expected_model_type}" \
  --argjson modelMetadata "${model_metadata_json}" \
  --arg mode "${export_mode}" \
  --arg format "${export_format}" \
  --arg path "${artifact_path}" \
  --argjson startMs "${start_ms}" \
  --argjson endMs "${end_ms}" \
  --argjson durationMs "${duration_ms}" \
  --arg durationClass "${duration_class}" \
  --argjson sharedSettings "${shared_settings_json}" \
  --argjson effectSettings "${effect_settings_json}" \
  --argjson observations "$(cat "${observations_path}")" \
  --argjson features "$(cat "${features_path}")" \
  '{
    recordVersion: $version,
    sampleId: $sampleId,
    effectName: $effectName,
    fixture: {
      sequencePath: $sequencePath,
      workingSequencePath: $workingSequencePath,
      modelName: $modelName,
      modelType: $modelType,
      geometryProfile: $geometryProfile,
      expectedModelType: (if $expectedModelType == "" then null else $expectedModelType end),
      startMs: $startMs,
      endMs: $endMs,
      durationMs: $durationMs,
      durationClass: $durationClass
    },
    sharedSettings: $sharedSettings,
    effectSettings: $effectSettings,
    artifact: {
      mode: $mode,
      format: $format,
      path: $path
    },
    modelMetadata: $modelMetadata,
    observations: $observations,
    features: $features,
    comparisons: []
  }' > "${record_path}"

printf '%s\n' "${record_path}"
