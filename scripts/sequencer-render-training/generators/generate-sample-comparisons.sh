#!/usr/bin/env bash
set -euo pipefail

RUN_DIR=""
OUT_FILE=""
CRITERION="usefulness"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --run-dir)
      RUN_DIR="$2"
      shift 2
      ;;
    --out-file)
      OUT_FILE="$2"
      shift 2
      ;;
    --criterion)
      CRITERION="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

command -v jq >/dev/null 2>&1 || {
  echo "Missing required command: jq" >&2
  exit 1
}

[[ -n "${RUN_DIR}" ]] || { echo "--run-dir is required" >&2; exit 1; }
[[ -d "${RUN_DIR}" ]] || { echo "Run dir not found: ${RUN_DIR}" >&2; exit 1; }
[[ -n "${OUT_FILE}" ]] || { echo "--out-file is required" >&2; exit 1; }

summary_path="${RUN_DIR}/run-summary.json"
[[ -f "${summary_path}" ]] || { echo "Run summary not found: ${summary_path}" >&2; exit 1; }

record_paths=()
while IFS= read -r record_path; do
  [[ -n "${record_path}" ]] || continue
  record_paths+=("${record_path}")
done < <(jq -r '.results[].recordPath // empty' "${summary_path}")
[[ "${#record_paths[@]}" -ge 2 ]] || { echo "Need at least two records to compare" >&2; exit 1; }

comparisons='[]'
for ((i = 0; i < ${#record_paths[@]}; i++)); do
  for ((j = i + 1; j < ${#record_paths[@]}; j++)); do
    comparison="$(
      bash "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/build-record-comparison.sh" \
        --left-record "${record_paths[$i]}" \
        --right-record "${record_paths[$j]}" \
        --criterion "${CRITERION}"
    )"
    comparisons="$(jq -cn --argjson rows "${comparisons}" --argjson row "${comparison}" '$rows + [$row]')"
  done
done

jq -cn \
  --arg runDir "${RUN_DIR}" \
  --arg criterion "${CRITERION}" \
  --argjson comparisons "${comparisons}" \
  '{
    runDir: $runDir,
    criterion: $criterion,
    comparisons: $comparisons
  }' > "${OUT_FILE}"
