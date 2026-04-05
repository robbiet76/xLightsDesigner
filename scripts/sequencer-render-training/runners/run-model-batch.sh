#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
source "${ROOT_DIR}/lib.sh"

MANIFEST_FILE=""
OUT_DIR=""
FORCE_RECYCLE="${XLIGHTS_FORCE_RECYCLE_BEFORE_BATCH:-0}"

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
    --recycle)
      FORCE_RECYCLE="1"
      shift 1
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

run_started_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
summary_path="${OUT_DIR}/run-summary.json"
log_path="${OUT_DIR}/run.log"
: > "${log_path}"

log_batch() {
  printf '[run-model-batch] %s\n' "$*" >>"${log_path}"
}

sample_ids=()
while IFS= read -r sample_id; do
  [[ -n "${sample_id}" ]] || continue
  sample_ids+=("${sample_id}")
done < <(jq -r '.samples[].sampleId' "${MANIFEST_FILE}")
[[ "${#sample_ids[@]}" -gt 0 ]] || { echo "Manifest contains no samples" >&2; exit 1; }

# One fresh xLights session per manifest.
if [[ "${FORCE_RECYCLE}" == "1" ]]; then
  log_batch "restart-begin manifest=${MANIFEST_FILE}"
  restart_xlights_app >>"${log_path}" 2>&1
  log_batch "restart-complete manifest=${MANIFEST_FILE}"
else
  log_batch "ensure-ready-begin manifest=${MANIFEST_FILE}"
  ensure_xlights_ready >>"${log_path}" 2>&1
  log_batch "ensure-ready-complete manifest=${MANIFEST_FILE}"
fi

results_json='[]'
passed=0
failed=0

for sample_id in "${sample_ids[@]}"; do
  log_batch "sample-begin sampleId=${sample_id}"
  sample_started_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  sample_dir="${OUT_DIR}/${sample_id}"
  mkdir -p "${sample_dir}"

  status="passed"
  error_message=""
  record_path=""

  if output="$(XLIGHTS_RECYCLE_BEFORE_SAMPLE=0 bash "${SCRIPT_DIR}/run-sample.sh" \
      --manifest "${MANIFEST_FILE}" \
      --sample-id "${sample_id}" \
      --out-dir "${sample_dir}" 2>>"${log_path}")"; then
    record_path="$(printf '%s\n' "${output}" | tail -n 1)"
    passed=$((passed + 1))
    log_batch "sample-pass sampleId=${sample_id} record=${record_path}"
  else
    status="failed"
    failed=$((failed + 1))
    error_message="$(tail -n 20 "${log_path}" | tail -n 1)"
    log_batch "sample-fail sampleId=${sample_id} error=${error_message}"
  fi

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
      recordPath: (if ($recordPath | length) > 0 then $recordPath else null end),
      error: (if ($error | length) > 0 then $error else null end)
    }')"
  results_json="$(jq -cn --argjson rows "${results_json}" --argjson row "${result_row}" '$rows + [$row]')"
done

run_finished_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

jq -cn \
  --arg manifest "${MANIFEST_FILE}" \
  --arg mode "model_batch" \
  --arg startedAt "${run_started_at}" \
  --arg finishedAt "${run_finished_at}" \
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
