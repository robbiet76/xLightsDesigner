#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib.sh"

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

standards_path="${SCRIPT_DIR}/training-standards.json"
normalized_manifest_path="${OUT_DIR}/manifest.normalized.json"
python3 "${SCRIPT_DIR}/normalize-manifest.py" \
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
model_metadata_json="$(python3 "${SCRIPT_DIR}/get-model-fseq-metadata.py" --show-dir "${show_dir}" --model-name "${model_name}")"
resolved_model_type="$(jq -r '.resolvedModelType' <<<"${model_metadata_json}")"
expected_model_type_args=()
if [[ -n "${expected_model_type}" ]]; then
  expected_model_type_args=(--model-type "${expected_model_type}")
fi
model_start_channel_zero="$(jq -r '.startChannelZero' <<<"${model_metadata_json}")"
model_channel_count="$(jq -r '.channelCount' <<<"${model_metadata_json}")"
model_node_count="$(jq -r '.nodeCount' <<<"${model_metadata_json}")"
model_channels_per_node="$(jq -r '.channelsPerNode' <<<"${model_metadata_json}")"
decoder_bin="$("${SCRIPT_DIR}/build-fseq-window-decoder.sh")"
pack_id="$(jq -r '.packId // "packed-batch"' "${MANIFEST_FILE}")"
training_working_dir="${RENDER_TRAINING_ROOT}/working"
training_fseq_dir="${RENDER_TRAINING_ROOT}/fseq"
training_records_dir="${RENDER_TRAINING_ROOT}/records"
training_manifests_dir="${RENDER_TRAINING_ROOT}/manifests"
mkdir -p "${training_working_dir}" "${training_fseq_dir}" "${training_records_dir}" "${training_manifests_dir}"
run_stamp="$(date -u +"%Y%m%dT%H%M%SZ")"
working_sequence_path="${training_working_dir}/${pack_id}.${run_stamp}.xsq"
batch_artifact_staged="$(resolve_fseq_path_for_sequence "${working_sequence_path}")"
batch_artifact_path="${training_fseq_dir}/${pack_id}.${run_stamp}.fseq"
batch_features_path="${OUT_DIR}/batch-export.features.json"
batch_manifest_copy="${training_manifests_dir}/${pack_id}.manifest.json"

cp "${sequence_path}" "${working_sequence_path}"
jq '.' "${MANIFEST_FILE}" > "${batch_manifest_copy}"

sample_ids=()
while IFS= read -r sample_id; do
  [[ -n "${sample_id}" ]] || continue
  sample_ids+=("${sample_id}")
done < <(jq -r '.samples[].sampleId' "${MANIFEST_FILE}")
[[ "${#sample_ids[@]}" -gt 0 ]] || { echo "Manifest contains no samples" >&2; exit 1; }

log_batch "ensure-ready-begin manifest=${MANIFEST_FILE}"
ensure_xlights_ready >>"${log_path}" 2>&1
log_batch "ensure-ready-complete manifest=${MANIFEST_FILE}"

log_batch "close-any-open-sequence"
post_cmd '{"cmd":"closeSequence","quiet":"true","force":"true"}' >/dev/null 2>&1 || true
sleep 1
ensure_xlights_ready >>"${log_path}" 2>&1

warmup_payload="$(jq -cn --arg seq "${sequence_path}" '{cmd:"openSequence",seq:$seq,promptIssues:"false",force:"true"}')"
log_batch "warmup-open-sequence sequence=${sequence_path}"
if CURL_MAX_TIME=10 run_allowing_already_open "${warmup_payload}" >/dev/null; then
  log_batch "warmup-close-sequence"
  post_cmd '{"cmd":"closeSequence","quiet":"true","force":"true"}' >/dev/null 2>&1 || true
  sleep 1
  ensure_xlights_ready >>"${log_path}" 2>&1
else
  log_batch "warmup-open-sequence-retry sequence=${sequence_path}"
  post_cmd '{"cmd":"closeSequence","quiet":"true","force":"true"}' >/dev/null 2>&1 || true
  sleep 2
  if ensure_xlights_ready >>"${log_path}" 2>&1 && CURL_MAX_TIME=10 run_allowing_already_open "${warmup_payload}" >/dev/null; then
    log_batch "warmup-close-sequence"
    post_cmd '{"cmd":"closeSequence","quiet":"true","force":"true"}' >/dev/null 2>&1 || true
    sleep 1
    ensure_xlights_ready >>"${log_path}" 2>&1
  else
    log_batch "warmup-skip sequence=${sequence_path}"
  fi
fi

open_sequence_payload="$(jq -cn --arg seq "${working_sequence_path}" '{cmd:"openSequence",seq:$seq,promptIssues:"false",force:"true"}')"
log_batch "open-batch-sequence sequence=${working_sequence_path}"
if ! run_allowing_already_open "${open_sequence_payload}" >/dev/null; then
  log_batch "open-batch-sequence-retry sequence=${working_sequence_path}"
  post_cmd '{"cmd":"closeSequence","quiet":"true","force":"true"}' >/dev/null 2>&1 || true
  sleep 2
  ensure_xlights_ready >>"${log_path}" 2>&1
  if ! run_allowing_already_open "${open_sequence_payload}" >/dev/null; then
    echo "Failed to open packed batch sequence after retry: ${working_sequence_path}" >&2
    exit 1
  fi
fi

sample_plan_json='[]'
current_start_ms="${fixture_start_ms}"

for sample_id in "${sample_ids[@]}"; do
  sample_json="$(jq -c --arg sid "${sample_id}" '.samples[] | select(.sampleId == $sid)' "${MANIFEST_FILE}")"
  effect_name="$(jq -r '.effectName' <<<"${sample_json}")"
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

  log_batch "add-effect sampleId=${sample_id} effect=${effect_name} start=${start_ms} end=${end_ms}"
  run_and_require_ok "$(jq -cn \
    --arg target "${model_name}" \
    --arg effect "${effect_name}" \
    --arg settings "${settings_string}" \
    --arg palette "${palette_string}" \
    --arg start "${start_ms}" \
    --arg end "${end_ms}" \
    '{cmd:"addEffect",target:$target,effect:$effect,settings:$settings,palette:$palette,layer:"0",startTime:$start,endTime:$end}')" >/dev/null

  plan_row="$(jq -cn \
    --arg sampleId "${sample_id}" \
    --argjson sample "${sample_json}" \
    --argjson startMs "${start_ms}" \
    --argjson endMs "${end_ms}" \
    --arg durationClass "${duration_class}" \
    '{sampleId:$sampleId,sample:$sample,assignedWindow:{startMs:$startMs,endMs:$endMs,durationMs:($endMs-$startMs),durationClass:$durationClass}}')"
  sample_plan_json="$(jq -cn --argjson rows "${sample_plan_json}" --argjson row "${plan_row}" '$rows + [$row]')"
done

log_batch "save-sequence sequence=${working_sequence_path}"
run_and_require_ok "$(jq -cn --arg seq "${working_sequence_path}" '{cmd:"saveSequence",seq:$seq}')" >/dev/null

log_batch "close-batch-sequence-before-render"
run_and_require_ok '{"cmd":"closeSequence","quiet":"true","force":"true"}' >/dev/null

log_batch "batch-render sequence=${working_sequence_path}"
run_and_require_ok "$(jq -cn --arg seq "${working_sequence_path}" '{cmd:"batchRender",seqs_0:$seq,promptIssues:"false",highdef:"false"}')" >/dev/null

[[ -s "${batch_artifact_staged}" ]] || { echo "Batch artifact missing: ${batch_artifact_staged}" >&2; exit 1; }
[[ -s "${batch_artifact_path}" ]] || cp "${batch_artifact_staged}" "${batch_artifact_path}"
[[ -s "${batch_artifact_path}" ]] || { echo "Batch artifact copy failed: ${batch_artifact_path}" >&2; exit 1; }
bash "${SCRIPT_DIR}/extract-artifact-features.sh" --artifact "${batch_artifact_path}" > "${batch_features_path}"

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
  python3 "${SCRIPT_DIR}/analysis/analyze_decoded_window.py" \
    --decoded-window "${decoded_features_path}" \
    --model-metadata <(printf '%s' "${model_metadata_json}") \
    "${expected_model_type_args[@]}" \
    --effect-name "$(jq -r '.effectName' <<<"${sample_json}")" \
    --effect-settings "$(jq -c '.effectSettings // {}' <<<"${sample_json}")" \
    --shared-settings "$(jq -c '.sharedSettings // {}' <<<"${sample_json}")" \
    --out-file "${analysis_path}"
  jq -cn \
    --argjson base "$(cat "${features_path}")" \
    --argjson decoded "$(cat "${decoded_features_path}")" \
    --argjson analysis "$(cat "${analysis_path}")" \
    '$base + $decoded + {analysis: $analysis}' > "${features_path}"
  observations_json="$(
    bash "${SCRIPT_DIR}/extract-observations.sh" \
      --sample-json "${sample_json}" \
      --model-type "${resolved_model_type}" \
      --features-json "$(cat "${features_path}")"
  )"
  jq -cn \
    --arg version "1.0" \
    --arg sampleId "${sample_id}" \
    --arg effectName "$(jq -r '.effectName' <<<"${sample_json}")" \
    --arg sequencePath "${sequence_path}" \
    --arg workingSequencePath "${working_sequence_path}" \
    --arg modelName "${model_name}" \
    --arg modelType "${resolved_model_type}" \
    --arg expectedModelType "${expected_model_type}" \
    --arg mode "packed_fseq_window" \
    --arg format "fseq" \
    --arg path "${batch_artifact_path}" \
    --arg batchPath "${batch_artifact_path}" \
    --arg batchManifestPath "${batch_manifest_copy}" \
    --argjson startMs "${start_ms}" \
    --argjson endMs "${end_ms}" \
    --argjson durationMs "$((end_ms-start_ms))" \
    --arg durationClass "${duration_class}" \
    --argjson sharedSettings "$(jq -c '.sharedSettings // {}' <<<"${sample_json}")" \
    --argjson effectSettings "$(jq -c '.effectSettings // {}' <<<"${sample_json}")" \
    --argjson features "$(cat "${features_path}")" \
    --argjson observations "${observations_json}" \
    --argjson modelMetadata "${model_metadata_json}" \
    --argjson analysis "$(cat "${analysis_path}")" \
    '{
      recordVersion: $version,
      sampleId: $sampleId,
      effectName: $effectName,
      fixture: {
        sequencePath: $sequencePath,
        workingSequencePath: $workingSequencePath,
        modelName: $modelName,
        modelType: $modelType,
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
        windowStartMs: $startMs,
        windowEndMs: $endMs
      },
      modelMetadata: $modelMetadata,
      analysis: $analysis,
      observations: $observations,
      features: $features,
      comparisons: []
    }' > "${record_path}"
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

log_batch "close-batch-sequence-final"
run_and_require_ok '{"cmd":"closeSequence","quiet":"true","force":"true"}' >/dev/null || true

run_finished_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
jq -cn \
  --arg manifest "${MANIFEST_FILE}" \
  --arg mode "packed_model_batch" \
  --arg startedAt "${run_started_at}" \
  --arg finishedAt "${run_finished_at}" \
  --arg batchArtifactPath "${batch_artifact_path}" \
  --arg batchFeaturesPath "${batch_features_path}" \
  --arg batchManifestPath "${batch_manifest_copy}" \
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
