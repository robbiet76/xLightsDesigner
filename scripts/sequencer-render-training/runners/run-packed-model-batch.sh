#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
source "${ROOT_DIR}/tooling/effect-settings.sh"
RENDER_TRAINING_ROOT="${RENDER_TRAINING_ROOT:-/Users/robterry/Projects/xLightsDesigner/render-training}"

require_cmd() {
  local cmd="$1"
  command -v "${cmd}" >/dev/null 2>&1 || {
    echo "Missing required command: ${cmd}" >&2
    exit 1
  }
}

wait_owned_ready() {
  local attempts="${1:-30}"
  local delay="${2:-2}"
  local idx
  for idx in $(seq 1 "${attempts}"); do
    if curl --max-time 10 -fsS "http://127.0.0.1:49915/xlightsdesigner/api/health" \
      | jq -e '.ok == true and (((.data.state // "") | ascii_downcase) == "ready" or ((.data.state // "") == "")) and (((.data.modalState.observed // true) == false) or ((.data.modalState.blocked // false) == false))' >/dev/null; then
      return 0
    fi
    sleep "${delay}"
  done
  echo "Owned xLights API is not ready after ${attempts} attempts." >&2
  exit 1
}

MANIFEST_FILE=""
OUT_DIR=""
WINDOW_GAP_MS="${WINDOW_GAP_MS:-500}"

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
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

require_cmd jq
require_cmd python3

resolve_show_dir_for_sequence() {
  local xsq_path="$1"
  local probe
  probe="$(cd "$(dirname "${xsq_path}")" && pwd)"
  while [[ "${probe}" != "/" ]]; do
    if [[ -f "${probe}/xlights_networks.xml" && -f "${probe}/xlights_rgbeffects.xml" ]]; then
      printf '%s\n' "${probe}"
      return 0
    fi
    probe="$(dirname "${probe}")"
  done
  echo "Unable to resolve show directory for sequence: ${xsq_path}" >&2
  exit 1
}

[[ -n "${MANIFEST_FILE}" ]] || { echo "--manifest is required" >&2; exit 1; }
[[ -f "${MANIFEST_FILE}" ]] || { echo "Manifest not found: ${MANIFEST_FILE}" >&2; exit 1; }
[[ -n "${OUT_DIR}" ]] || { echo "--out-dir is required" >&2; exit 1; }

mkdir -p "${OUT_DIR}"

run_started_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
summary_path="${OUT_DIR}/run-summary.json"
log_path="${OUT_DIR}/run.log"
: > "${log_path}"

log_batch() {
  printf '[run-packed-model-batch] %s\n' "$*" >>"${log_path}"
}

compact_features_json() {
  local file_path="$1"
  jq 'del(.frames, .decoded)' "${file_path}"
}

standards_path="${ROOT_DIR}/catalog/training-standards.json"
normalized_manifest_path="${OUT_DIR}/manifest.normalized.json"
python3 "${ROOT_DIR}/tooling/normalize-manifest.py" \
  --manifest "${MANIFEST_FILE}" \
  --standards "${standards_path}" \
  --out-file "${normalized_manifest_path}"
MANIFEST_FILE="${normalized_manifest_path}"
decoder_frame_mode="$(jq -r '.interpretationFramework.decodePolicy.frameMode // "auto"' "${standards_path}")"
decoder_max_frame_cells="$(jq -r '.interpretationFramework.decodePolicy.maxFrameCells // 250000' "${standards_path}")"

fixture_json="$(jq -c '.fixture' "${MANIFEST_FILE}")"
sequence_path="$(jq -r '.sequencePath' <<<"${fixture_json}")"
model_name="$(jq -r '.modelName' <<<"${fixture_json}")"
expected_model_type="$(jq -r '.modelType // empty' <<<"${fixture_json}")"
fixture_start_ms="$(jq -r '.startMs' <<<"${fixture_json}")"
show_dir="$(resolve_show_dir_for_sequence "${sequence_path}")"
model_metadata_json="$(python3 "${ROOT_DIR}/tooling/get-model-fseq-metadata.py" --show-dir "${show_dir}" --model-name "${model_name}")"
resolved_model_type="$(jq -r '.resolvedModelType' <<<"${model_metadata_json}")"
resolved_geometry_profile="$(jq -r '.resolvedGeometryProfile' <<<"${model_metadata_json}")"
expected_model_type_args=()
if [[ -n "${expected_model_type}" ]]; then
  expected_model_type_args=(--model-type "${expected_model_type}")
fi
model_start_channel_zero="$(jq -r '.startChannelZero' <<<"${model_metadata_json}")"
model_channel_count="$(jq -r '.channelCount' <<<"${model_metadata_json}")"
model_node_count="$(jq -r '.nodeCount' <<<"${model_metadata_json}")"
model_channels_per_node="$(jq -r '.channelsPerNode' <<<"${model_metadata_json}")"
decoder_bin="$("${ROOT_DIR}/tooling/build-fseq-window-decoder.sh")"
geometry_artifact_path="${GEOMETRY_ARTIFACT_PATH:-${ROOT_DIR}/proofs/preview-scene-geometry-render-training-live.json}"
preview_window_frame_offsets="${PREVIEW_WINDOW_FRAME_OFFSETS:-8,10,12}"
pack_id="$(jq -r '.packId // "packed-batch"' "${MANIFEST_FILE}")"
training_working_dir="${RENDER_TRAINING_ROOT}/working"
training_fseq_dir="${RENDER_TRAINING_ROOT}/fseq"
training_records_dir="${RENDER_TRAINING_ROOT}/records"
training_manifests_dir="${RENDER_TRAINING_ROOT}/manifests"
mkdir -p "${training_working_dir}" "${training_fseq_dir}" "${training_records_dir}" "${training_manifests_dir}"
run_stamp="$(date -u +"%Y%m%dT%H%M%SZ")"
working_sequence_path="${training_working_dir}/${pack_id}.${run_stamp}.xsq"
batch_artifact_path="${training_fseq_dir}/${pack_id}.${run_stamp}.fseq"
batch_features_path="${OUT_DIR}/batch-export.features.json"
batch_manifest_copy="${training_manifests_dir}/${pack_id}.manifest.json"
batch_payload_path="${OUT_DIR}/owned-batch-plan.json"
batch_execution_path="${OUT_DIR}/owned-batch-execution.json"

cp "${sequence_path}" "${working_sequence_path}"
jq '.' "${MANIFEST_FILE}" > "${batch_manifest_copy}"

sample_ids=()
while IFS= read -r sample_id; do
  [[ -n "${sample_id}" ]] || continue
  sample_ids+=("${sample_id}")
done < <(jq -r '.samples[].sampleId' "${MANIFEST_FILE}")
[[ "${#sample_ids[@]}" -gt 0 ]] || { echo "Manifest contains no samples" >&2; exit 1; }

log_batch "owned-health-begin manifest=${MANIFEST_FILE}"
wait_owned_ready
log_batch "owned-health-complete manifest=${MANIFEST_FILE}"

sample_plan_json='[]'
marks_json='[]'
effects_json='[]'
current_start_ms="${fixture_start_ms}"

for sample_id in "${sample_ids[@]}"; do
  sample_json="$(jq -c --arg sid "${sample_id}" '.samples[] | select(.sampleId == $sid)' "${MANIFEST_FILE}")"
  effect_name="$(jq -r '.effectName' <<<"${sample_json}")"
  placement_id="$(jq -r '.placementId // empty' <<<"${sample_json}")"
  shared_settings_json="$(jq -c '.sharedSettings // {}' <<<"${sample_json}")"
  effect_settings_json="$(jq -c '.effectSettings // {}' <<<"${sample_json}")"
  palette_json="$(jq -c '.sharedSettings.palette // {}' <<<"${sample_json}")"
  duration_ms="$(jq -r --argjson fixture "${fixture_json}" '((.timingWindow.endMs // ($fixture.startMs + (($fixture.endMs - $fixture.startMs)))) - (.timingWindow.startMs // $fixture.startMs))' <<<"${sample_json}")"
  duration_class="$(jq -r --argjson fixture "${fixture_json}" '(.timingWindow.durationClass // $fixture.durationClass // "short")' <<<"${sample_json}")"
  start_ms="${current_start_ms}"
  end_ms=$((start_ms + duration_ms))
  current_start_ms=$((end_ms + WINDOW_GAP_MS))

  settings_json="$(settings_json_for_effect "${effect_name}" "${effect_settings_json}" "${shared_settings_json}")"
  settings_string="$(jq -r 'to_entries | map("\(.key)=\(.value)") | join(",")' <<<"${settings_json}")"
  palette_string="$(jq -r 'to_entries | map("\(.key)=\(.value)") | join(",")' <<<"${palette_json}")"

  log_batch "queue-effect sampleId=${sample_id} effect=${effect_name} start=${start_ms} end=${end_ms}"

  marks_json="$(jq -cn \
    --argjson rows "${marks_json}" \
    --arg label "${sample_id}" \
    --argjson startMs "${start_ms}" \
    --argjson endMs "${end_ms}" \
    '$rows + [{label:$label,startMs:$startMs,endMs:$endMs}]')"

  effects_json="$(jq -cn \
    --argjson rows "${effects_json}" \
    --arg element "${model_name}" \
    --arg effectName "${effect_name}" \
    --arg settings "${settings_string}" \
    --arg palette "${palette_string}" \
    --argjson startMs "${start_ms}" \
    --argjson endMs "${end_ms}" \
    '$rows + [{element:$element,layer:0,effectName:$effectName,startMs:$startMs,endMs:$endMs,settings:$settings,palette:$palette,clearExisting:false}]')"

  plan_row="$(jq -cn \
    --arg sampleId "${sample_id}" \
    --argjson sample "${sample_json}" \
    --argjson startMs "${start_ms}" \
    --argjson endMs "${end_ms}" \
    --arg durationClass "${duration_class}" \
    '{sampleId:$sampleId,sample:$sample,assignedWindow:{startMs:$startMs,endMs:$endMs,durationMs:($endMs-$startMs),durationClass:$durationClass}}')"
  sample_plan_json="$(jq -cn --argjson rows "${sample_plan_json}" --argjson row "${plan_row}" '$rows + [$row]')"
done

jq -cn \
  --arg track "XD: Training Samples" \
  --argjson marks "${marks_json}" \
  --argjson effects "${effects_json}" \
  '{track:$track,replaceExistingMarks:true,marks:$marks,effects:$effects}' \
  > "${batch_payload_path}"

log_batch "owned-batch-apply sequence=${working_sequence_path}"
node "${ROOT_DIR}/tooling/run-owned-packed-batch.mjs" \
  --sequence "${working_sequence_path}" \
  --payload-file "${batch_payload_path}" \
  --result-file "${batch_execution_path}" >>"${log_path}" 2>&1

rendered_fseq_path="$(jq -r '.fseqPath' "${batch_execution_path}")"
[[ -n "${rendered_fseq_path}" ]] || { echo "Owned batch execution returned no fseqPath" >&2; exit 1; }
[[ -s "${rendered_fseq_path}" ]] || { echo "Rendered fseq missing: ${rendered_fseq_path}" >&2; exit 1; }
[[ -s "${batch_artifact_path}" ]] || cp "${rendered_fseq_path}" "${batch_artifact_path}"
[[ -s "${batch_artifact_path}" ]] || { echo "Batch artifact copy failed: ${batch_artifact_path}" >&2; exit 1; }
bash "${ROOT_DIR}/tooling/extract-artifact-features.sh" --artifact "${batch_artifact_path}" > "${batch_features_path}"

results_json='[]'
passed=0
failed=0

while IFS= read -r planned_row; do
  [[ -n "${planned_row}" ]] || continue
  sample_id="$(jq -r '.sampleId' <<<"${planned_row}")"
  sample_json="$(jq -c '.sample' <<<"${planned_row}")"
  start_ms="$(jq -r '.assignedWindow.startMs' <<<"${planned_row}")"
  end_ms="$(jq -r '.assignedWindow.endMs' <<<"${planned_row}")"
  duration_class="$(jq -r '.assignedWindow.durationClass' <<<"${planned_row}")"
  sample_dir="${OUT_DIR}/${sample_id}"
  mkdir -p "${sample_dir}"
  record_path="${sample_dir}/${sample_id}.record.json"
  features_path="${sample_dir}/${sample_id}.features.json"
  preview_window_path="${sample_dir}/${sample_id}.preview-window.json"
  render_observation_path="${sample_dir}/${sample_id}.render-observation.json"
  sample_started_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

  status="passed"
  error_message=""

  cp "${batch_features_path}" "${features_path}"
  decoded_features_path="${sample_dir}/${sample_id}.decoded-features.json"
  analysis_path="${sample_dir}/${sample_id}.analysis.json"
  "${decoder_bin}" \
    --fseq "${batch_artifact_path}" \
    --start-channel "${model_start_channel_zero}" \
    --channel-count "${model_channel_count}" \
    --window-start-ms "${start_ms}" \
    --window-end-ms "${end_ms}" \
    --node-count "${model_node_count}" \
    --channels-per-node "${model_channels_per_node}" \
    --frame-mode "${decoder_frame_mode}" \
    --max-frame-cells "${decoder_max_frame_cells}" \
    > "${decoded_features_path}"
  python3 "${ROOT_DIR}/analysis/analyze_decoded_window.py" \
    --decoded-window "${decoded_features_path}" \
    --model-metadata <(printf '%s' "${model_metadata_json}") \
    "${expected_model_type_args[@]}" \
    --effect-name "$(jq -r '.effectName' <<<"${sample_json}")" \
    --effect-settings "$(jq -c '.effectSettings // {}' <<<"${sample_json}")" \
    --shared-settings "$(jq -c '.sharedSettings // {}' <<<"${sample_json}")" \
    --out-file "${analysis_path}"
  jq -s '.[0] + .[1] + {analysis: .[2]}' \
    "${features_path}" \
    "${decoded_features_path}" \
    "${analysis_path}" > "${features_path}.tmp"
  mv "${features_path}.tmp" "${features_path}"
  observations_json="$(
    bash "${ROOT_DIR}/tooling/extract-observations.sh" \
      --sample-json "${sample_json}" \
      --model-type "${resolved_model_type}" \
      --features-file "${features_path}"
  )"
  python3 "${ROOT_DIR}/tooling/reconstruct-preview-scene-window.py" \
    --geometry "${geometry_artifact_path}" \
    --fseq "${batch_artifact_path}" \
    --window-start-ms "${start_ms}" \
    --window-end-ms "${end_ms}" \
    --frame-offsets "${preview_window_frame_offsets}" \
    --out "${preview_window_path}" >>"${log_path}" 2>&1
  python3 "${ROOT_DIR}/tooling/extract-render-observation.py" \
    --window "${preview_window_path}" \
    --out "${render_observation_path}" >>"${log_path}" 2>&1
  jq -cn \
    --arg version "1.0" \
    --arg sampleId "${sample_id}" \
    --arg placementId "${placement_id}" \
    --arg effectName "$(jq -r '.effectName' <<<"${sample_json}")" \
    --arg sequencePath "${sequence_path}" \
    --arg workingSequencePath "${working_sequence_path}" \
    --arg modelName "${model_name}" \
    --arg modelType "${resolved_model_type}" \
    --arg geometryProfile "${resolved_geometry_profile}" \
    --arg expectedModelType "${expected_model_type}" \
    --arg mode "packed_fseq_window" \
    --arg format "fseq" \
    --arg path "${batch_artifact_path}" \
    --arg batchPath "${batch_artifact_path}" \
    --arg batchManifestPath "${batch_manifest_copy}" \
    --arg previewSceneWindowRef "${preview_window_path}" \
    --arg renderObservationRef "${render_observation_path}" \
    --argjson startMs "${start_ms}" \
    --argjson endMs "${end_ms}" \
    --argjson durationMs "$((end_ms-start_ms))" \
    --arg durationClass "${duration_class}" \
    --argjson sharedSettings "$(jq -c '.sharedSettings // {}' <<<"${sample_json}")" \
    --argjson effectSettings "$(jq -c '.effectSettings // {}' <<<"${sample_json}")" \
    --argjson observations "${observations_json}" \
    --argjson modelMetadata "${model_metadata_json}" \
    --slurpfile featuresFile "${features_path}" \
    --slurpfile analysisFile "${analysis_path}" \
    '{
      recordVersion: $version,
      sampleId: $sampleId,
      placementId: (if ($placementId | length) > 0 then $placementId else null end),
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
        path: $path,
        batchArtifactPath: $batchPath,
        batchManifestPath: $batchManifestPath,
        previewSceneWindowRef: $previewSceneWindowRef,
        renderObservationRef: $renderObservationRef,
        windowStartMs: $startMs,
        windowEndMs: $endMs
      },
      modelMetadata: $modelMetadata,
      analysis: $analysisFile[0],
      observations: $observations,
      features: $featuresFile[0],
      comparisons: []
    }' > "${record_path}"
  compact_features_json "${features_path}" > "${features_path}.compact"
  mv "${features_path}.compact" "${features_path}"
  rm -f "${decoded_features_path}" "${analysis_path}"
  passed=$((passed + 1))

  sample_finished_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  result_row="$(jq -cn \
    --arg sampleId "${sample_id}" \
    --arg status "${status}" \
    --arg startedAt "${sample_started_at}" \
    --arg finishedAt "${sample_finished_at}" \
    --arg outDir "${sample_dir}" \
    --arg recordPath "${record_path}" \
    --arg error "${error_message}" \
    '{
      sampleId: $sampleId,
      status: $status,
      startedAt: $startedAt,
      finishedAt: $finishedAt,
      outDir: $outDir,
      recordPath: (if $status == "passed" then $recordPath else null end),
      error: (if ($error | length) > 0 then $error else null end)
    }')"
  results_json="$(jq -cn --argjson rows "${results_json}" --argjson row "${result_row}" '$rows + [$row]')"
done < <(jq -c '.[]' <<<"${sample_plan_json}")

run_finished_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
jq -cn \
  --arg manifest "${MANIFEST_FILE}" \
  --arg mode "packed_model_batch" \
  --arg startedAt "${run_started_at}" \
  --arg finishedAt "${run_finished_at}" \
  --arg batchArtifactPath "${batch_artifact_path}" \
  --arg batchFeaturesPath "${batch_features_path}" \
  --arg batchManifestPath "${batch_manifest_copy}" \
  --arg batchExecutionPath "${batch_execution_path}" \
  --arg batchPayloadPath "${batch_payload_path}" \
  --arg workingSequencePath "${working_sequence_path}" \
  --argjson total "${#sample_ids[@]}" \
  --argjson passed "${passed}" \
  --argjson failed "${failed}" \
  --arg logPath "${log_path}" \
  --argjson results "${results_json}" \
  '{
    manifestPath: $manifest,
    mode: $mode,
    startedAt: $startedAt,
    finishedAt: $finishedAt,
    batchArtifactPath: $batchArtifactPath,
    batchFeaturesPath: $batchFeaturesPath,
    batchManifestPath: $batchManifestPath,
    batchExecutionPath: $batchExecutionPath,
    batchPayloadPath: $batchPayloadPath,
    workingSequencePath: $workingSequencePath,
    totalSamples: $total,
    passedSamples: $passed,
    failedSamples: $failed,
    logPath: $logPath,
    results: $results
  }' > "${summary_path}"

printf '%s\n' "${summary_path}"

if [[ "${failed}" -gt 0 ]]; then
  exit 1
fi
