#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
source "${ROOT_DIR}/lib.sh"

DEBUG_APP_DEFAULT="/Users/robterry/Library/Developer/Xcode/DerivedData/xLights-ewiqueswvnjesbbydtiylmstqbkg/Build/Products/Debug/xLights.app"
export XLIGHTS_APP_PATH="${XLIGHTS_APP_PATH:-${DEBUG_APP_DEFAULT}}"

RUN_ROOT=""
PACKS_OVERRIDE=""
PHASE_SET="${PHASE_SET:-phase1_phase2}"
STAMP="$(date -u +"%Y%m%dT%H%M%SZ")"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --out-dir)
      RUN_ROOT="$2"
      shift 2
      ;;
    --packs)
      PACKS_OVERRIDE="$2"
      shift 2
      ;;
    --phase-set)
      PHASE_SET="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "${RUN_ROOT}" ]]; then
  RUN_ROOT="/tmp/render-training-overnight-${STAMP}"
fi
mkdir -p "${RUN_ROOT}"
SUMMARY_PATH="${RUN_ROOT}/overnight-summary.json"
LOG_PATH="${RUN_ROOT}/overnight.log"
: > "${LOG_PATH}"

log() {
  printf '[overnight] %s\n' "$*" | tee -a "${LOG_PATH}" >/dev/null
}

range_param_for_manifest() {
  local manifest="$1"
  python3 - <<'PY' "${manifest}"
import json, sys
from pathlib import Path
m = json.loads(Path(sys.argv[1]).read_text())
labels = m['samples'][0].get('labelHints', [])
mapping = {
    'duty_factor': 'dutyFactor',
    'number_chases': 'numberChases',
    'chase_size': 'chaseSize',
    'skip_size': 'skipSize',
    'band_size': 'bandSize',
    'fx_intensity': 'intensity',
}
for x in labels:
    if x in {'duty_factor','number_chases','chase_size','skip_size','band_size','advances','fx_intensity','cycles'}:
        print(mapping.get(x, x))
        break
else:
    print('')
PY
}

PHASE1_PACKS=(
  on-reduced-sweep-v1
  singlestrand-linear-expanded-sweep-v2
  singlestrand-linear-chasesize-range-v1
  singlestrand-linear-numberchases-range-v1
  singlestrand-linear-advances-range-v1
  singlestrand-linear-fx-intensity-range-v1
  shimmer-outline-expanded-sweep-v2
  shimmer-outline-dutyfactor-range-v1
  shimmer-outline-cycles-range-v1
  on-hiddentree-reduced-sweep-v1
  shimmer-hiddentree-expanded-sweep-v1
  shimmer-hiddentree-dutyfactor-range-v1
  on-spiraltree-reduced-sweep-v1
  singlestrand-spiraltree-expanded-sweep-v1
  singlestrand-spiraltree-numberchases-range-v1
  on-hiddentreestar-reduced-sweep-v1
  shimmer-hiddentreestar-expanded-sweep-v1
)

PHASE2_PACKS=(
  singlestrand-linear-cycles-range-v1
  singlestrand-linear-skipsize-range-v1
  singlestrand-linear-bandsize-range-v1
  singlestrand-linear-chasetype-combos-v1
  singlestrand-linear-fadetype-combos-v1
  shimmer-hiddentree-cycles-range-v1
  shimmer-hiddentreestar-dutyfactor-range-v1
  shimmer-hiddentreestar-cycles-range-v1
  singlestrand-spiraltree-chasesize-range-v1
  singlestrand-spiraltree-cycles-range-v1
)

PACKS=()
case "${PHASE_SET}" in
  phase1)
    PACKS=("${PHASE1_PACKS[@]}")
    ;;
  phase1_phase2)
    PACKS=("${PHASE1_PACKS[@]}" "${PHASE2_PACKS[@]}")
    ;;
  *)
    echo "Unknown --phase-set value: ${PHASE_SET}" >&2
    exit 1
    ;;
esac

if [[ -n "${PACKS_OVERRIDE}" ]]; then
  IFS=',' read -r -a PACKS <<<"${PACKS_OVERRIDE}"
fi

ensure_xlights_ready >>"${LOG_PATH}" 2>&1

results='[]'
for pack_id in "${PACKS[@]}"; do
  manifest="${SCRIPT_DIR}/manifests/${pack_id}.json"
  run_dir="${RUN_ROOT}/${pack_id}"
  started_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  mkdir -p "${run_dir}"
  log "pack-begin ${pack_id}"
  status="passed"
  error_message=""

  if bash "${SCRIPT_DIR}/run-packed-model-batch.sh" --manifest "${manifest}" --out-dir "${run_dir}" >>"${LOG_PATH}" 2>&1; then
    if [[ "${pack_id}" == *"range"* ]]; then
      param="$(range_param_for_manifest "${manifest}")"
      if [[ -n "${param}" ]]; then
        python3 "${ROOT_DIR}/generate-range-transition-report.py" --run-dir "${run_dir}" --param "${param}" --out-file "${run_dir}/range-transition.json" >>"${LOG_PATH}" 2>&1 || status="failed"
        python3 "${ROOT_DIR}/generate-parameter-region-summary.py" --transition-report "${run_dir}/range-transition.json" --out-file "${run_dir}/region-summary.json" >>"${LOG_PATH}" 2>&1 || status="failed"
      fi
    else
      python3 "${ROOT_DIR}/generate-look-catalog.py" --run-dir "${run_dir}" --out-file "${run_dir}/look-catalog.json" >>"${LOG_PATH}" 2>&1 || status="failed"
      python3 "${ROOT_DIR}/generate-intent-vocab-summary.py" --catalog "${run_dir}/look-catalog.json" --out-file "${run_dir}/intent-summary.json" >>"${LOG_PATH}" 2>&1 || status="failed"
      python3 "${ROOT_DIR}/generate-intent-gap-report.py" --summary "${run_dir}/intent-summary.json" --out-file "${run_dir}/intent-gap-report.json" >>"${LOG_PATH}" 2>&1 || status="failed"
      bash "${ROOT_DIR}/generate-sample-comparisons.sh" --run-dir "${run_dir}" --criterion usefulness --out-file "${run_dir}/comparisons.usefulness.json" >>"${LOG_PATH}" 2>&1 || status="failed"
    fi
  else
    status="failed"
    error_message="run-packed-model-batch failed"
  fi

  finished_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  results="$(jq -cn --argjson rows "${results}" --arg packId "${pack_id}" --arg manifest "${manifest}" --arg runDir "${run_dir}" --arg status "${status}" --arg errorMessage "${error_message}" --arg startedAt "${started_at}" --arg finishedAt "${finished_at}" '$rows + [{packId:$packId,manifest:$manifest,runDir:$runDir,status:$status,errorMessage:$errorMessage,startedAt:$startedAt,finishedAt:$finishedAt}]')"

  jq -cn \
    --arg runStamp "${STAMP}" \
    --arg runRoot "${RUN_ROOT}" \
    --argjson results "${results}" \
    '{runStamp:$runStamp,runRoot:$runRoot,packCount:($results|length),passedCount:($results|map(select(.status=="passed"))|length),failedCount:($results|map(select(.status!="passed"))|length),results:$results}' \
    > "${SUMMARY_PATH}"

  log "pack-end ${pack_id} status=${status}"
done

log "overnight-complete summary=${SUMMARY_PATH}"
