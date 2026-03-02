#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

ENV_FILE="${ENV_FILE:-${ROOT_DIR}/specs/projects/xlights-sequencer-control/test-fixtures.example.env}"
MANIFEST_FILE="${MANIFEST_FILE:-${ROOT_DIR}/specs/projects/xlights-sequencer-control/test-fixtures.manifest.json}"
OUT_DIR="${OUT_DIR:-/tmp/xlights-control-reports/$(date +%Y%m%d-%H%M%S)}"

mkdir -p "${OUT_DIR}"

if [[ -f "${ENV_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
fi

SUITES=(
  "01-discovery-smoke.sh"
  "02-sequence-lifecycle-smoke.sh"
  "03-sequencer-mutation-smoke.sh"
  "04-validation-gate-smoke.sh"
  "05-legacy-regression-smoke.sh"
)

overall_ok=true
summary_steps=()

for suite in "${SUITES[@]}"; do
  suite_name="${suite%.sh}"
  suite_path="${SCRIPT_DIR}/${suite}"
  report_path="${OUT_DIR}/${suite_name}.json"

  set +e
  report="$("${suite_path}")"
  rc=$?
  set -e

  printf "%s\n" "${report}" > "${report_path}"

  if [[ ${rc} -eq 0 && "${report}" == *'"passed":true'* ]]; then
    summary_steps+=("{\"suite\":\"${suite_name}\",\"passed\":true}")
  else
    overall_ok=false
    summary_steps+=("{\"suite\":\"${suite_name}\",\"passed\":false,\"report\":\"${report_path}\"}")
  fi
done

joined="$(IFS=,; echo "${summary_steps[*]}")"
printf '{"manifest":"%s","outDir":"%s","passed":%s,"suites":[%s]}\n' \
  "${MANIFEST_FILE}" "${OUT_DIR}" "${overall_ok}" "${joined}" | tee "${OUT_DIR}/run-all-summary.json"

if [[ "${overall_ok}" == "true" ]]; then
  exit 0
fi

exit 1
