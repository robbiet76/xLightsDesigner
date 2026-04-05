#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

OUT_DIR=""

while [[ $# -gt 0 ]]; do
  case "$1" in
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

[[ -n "${OUT_DIR}" ]] || { echo "--out-dir is required" >&2; exit 1; }

mkdir -p "${OUT_DIR}"

declare -a manifests=(
  "${ROOT_DIR}/manifests/twinkle-singlelinehorizontal-interactions-v1.json"
  "${ROOT_DIR}/manifests/twinkle-treeround-interactions-v1.json"
  "${ROOT_DIR}/manifests/twinkle-spinner-interactions-v1.json"
)

results_json='[]'
passed=0
failed=0

for manifest in "${manifests[@]}"; do
  pack_id="$(jq -r '.packId' "${manifest}")"
  run_dir="${OUT_DIR}/${pack_id}"
  status="passed"
  summary_path=""
  if summary_path="$(bash "${SCRIPT_DIR}/run-packed-model-batch.sh" --manifest "${manifest}" --out-dir "${run_dir}")"; then
    passed=$((passed + 1))
  else
    status="failed"
    failed=$((failed + 1))
  fi
  row="$(jq -cn \
    --arg manifest "${manifest}" \
    --arg packId "${pack_id}" \
    --arg status "${status}" \
    --arg runDir "${run_dir}" \
    --arg summaryPath "${summary_path}" \
    '{manifestPath:$manifest, packId:$packId, status:$status, runDir:$runDir, summaryPath:(if ($summaryPath|length)>0 then $summaryPath else null end)}')"
  results_json="$(jq -cn --argjson rows "${results_json}" --argjson row "${row}" '$rows + [$row]')"
done

jq -cn \
  --arg outDir "${OUT_DIR}" \
  --argjson passed "${passed}" \
  --argjson failed "${failed}" \
  --argjson results "${results_json}" \
  '{outDir:$outDir, packCount:($passed+$failed), passedCount:$passed, failedCount:$failed, results:$results}' \
  > "${OUT_DIR}/interaction-set-summary.json"

printf '%s\n' "${OUT_DIR}/interaction-set-summary.json"

if [[ "${failed}" -gt 0 ]]; then
  exit 1
fi
