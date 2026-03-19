#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib.sh"

DEBUG_APP_DEFAULT="/Users/robterry/Library/Developer/Xcode/DerivedData/xLights-ewiqueswvnjesbbydtiylmstqbkg/Build/Products/Debug/xLights.app"
export XLIGHTS_APP_PATH="${XLIGHTS_APP_PATH:-${DEBUG_APP_DEFAULT}}"

PLAN_FILE="${SCRIPT_DIR}/registry-planning-phase1.json"
REGISTRY_FILE="${SCRIPT_DIR}/effect-parameter-registry.json"
RUN_ROOT=""
STAMP="$(date -u +"%Y%m%dT%H%M%SZ")"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --plan)
      PLAN_FILE="$2"
      shift 2
      ;;
    --registry)
      REGISTRY_FILE="$2"
      shift 2
      ;;
    --out-dir)
      RUN_ROOT="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

[[ -f "${PLAN_FILE}" ]] || { echo "Plan not found: ${PLAN_FILE}" >&2; exit 1; }
[[ -f "${REGISTRY_FILE}" ]] || { echo "Registry not found: ${REGISTRY_FILE}" >&2; exit 1; }

if [[ -z "${RUN_ROOT}" ]]; then
  RUN_ROOT="/tmp/render-training-registry-plan-${STAMP}"
fi

mkdir -p "${RUN_ROOT}"
SUMMARY_PATH="${RUN_ROOT}/registry-run-summary.json"
LOG_PATH="${RUN_ROOT}/registry-run.log"
GENERATED_DIR="${RUN_ROOT}/generated-manifests"
GENERATED_SUMMARY="${GENERATED_DIR}/summary.json"
: > "${LOG_PATH}"

log() {
  printf '[registry-plan] %s\n' "$*" | tee -a "${LOG_PATH}" >/dev/null
}

ensure_xlights_ready >>"${LOG_PATH}" 2>&1

python3 "${SCRIPT_DIR}/generate-registry-plan-manifests.py" \
  --registry "${REGISTRY_FILE}" \
  --plan "${PLAN_FILE}" \
  --out-dir "${GENERATED_DIR}" \
  --summary-out "${GENERATED_SUMMARY}"

results='[]'

while IFS= read -r row; do
  [[ -n "${row}" ]] || continue
  plan_id="$(jq -r '.planId' <<<"${row}")"
  effect="$(jq -r '.effect' <<<"${row}")"
  parameter="$(jq -r '.parameter' <<<"${row}")"
  geometry_profile="$(jq -r '.geometryProfile // ""' <<<"${row}")"
  manifest="$(jq -r '.outFile' <<<"${row}")"
  pack_id="$(jq -r '.packId' <<<"${row}")"
  run_dir="${RUN_ROOT}/${pack_id}"
  started_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  mkdir -p "${run_dir}"
  log "pack-begin ${pack_id}"
  status="passed"
  error_message=""

  if bash "${SCRIPT_DIR}/run-packed-model-batch.sh" --manifest "${manifest}" --out-dir "${run_dir}" >>"${LOG_PATH}" 2>&1; then
    python3 "${SCRIPT_DIR}/generate-range-transition-report.py" \
      --run-dir "${run_dir}" \
      --param "${parameter}" \
      --out-file "${run_dir}/range-transition.json" >>"${LOG_PATH}" 2>&1 || status="failed"
    python3 "${SCRIPT_DIR}/generate-parameter-region-summary.py" \
      --transition-report "${run_dir}/range-transition.json" \
      --out-file "${run_dir}/region-summary.json" >>"${LOG_PATH}" 2>&1 || status="failed"
  else
    status="failed"
    error_message="run-packed-model-batch failed"
  fi

  finished_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  results="$(jq -cn \
    --argjson rows "${results}" \
    --arg planId "${plan_id}" \
    --arg effect "${effect}" \
    --arg parameter "${parameter}" \
    --arg geometryProfile "${geometry_profile}" \
    --arg packId "${pack_id}" \
    --arg manifest "${manifest}" \
    --arg runDir "${run_dir}" \
    --arg status "${status}" \
    --arg errorMessage "${error_message}" \
    --arg startedAt "${started_at}" \
    --arg finishedAt "${finished_at}" \
    '$rows + [{planId:$planId,effect:$effect,parameter:$parameter,geometryProfile:$geometryProfile,packId:$packId,manifest:$manifest,runDir:$runDir,status:$status,errorMessage:$errorMessage,startedAt:$startedAt,finishedAt:$finishedAt}]')"

  jq -cn \
    --arg runStamp "${STAMP}" \
    --arg runRoot "${RUN_ROOT}" \
    --arg planFile "${PLAN_FILE}" \
    --arg registryFile "${REGISTRY_FILE}" \
    --arg generatedSummary "${GENERATED_SUMMARY}" \
    --argjson results "${results}" \
    '{runStamp:$runStamp,runRoot:$runRoot,planFile:$planFile,registryFile:$registryFile,generatedSummary:$generatedSummary,packCount:($results|length),passedCount:($results|map(select(.status=="passed"))|length),failedCount:($results|map(select(.status!="passed"))|length),results:$results}' \
    > "${SUMMARY_PATH}"

  log "pack-end ${pack_id} status=${status}"
done < <(jq -c '.results[]' "${GENERATED_SUMMARY}")

log "registry-run-complete summary=${SUMMARY_PATH}"

