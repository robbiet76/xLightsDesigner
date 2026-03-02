#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

ENV_FILE="${ENV_FILE:-${ROOT_DIR}/specs/projects/xlights-sequencer-control/test-fixtures.example.env}"
MANIFEST_FILE="${MANIFEST_FILE:-${ROOT_DIR}/specs/projects/xlights-sequencer-control/test-fixtures.manifest.json}"
OUT_DIR="${OUT_DIR:-/tmp/xlights-control-reports/$(date +%Y%m%d-%H%M%S)}"
BOOTSTRAP_FIXTURES="${BOOTSTRAP_FIXTURES:-false}"

mkdir -p "${OUT_DIR}"

if [[ -f "${ENV_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
fi

pack_id="$(jq -r '.fixturePack.packId // "unknown"' "${MANIFEST_FILE}" 2>/dev/null || echo "unknown")"
pack_version="$(jq -r '.fixturePack.packVersion // "unknown"' "${MANIFEST_FILE}" 2>/dev/null || echo "unknown")"

bootstrap_ok=true
bootstrap_report_path=""
if [[ "${BOOTSTRAP_FIXTURES}" == "true" ]]; then
  bootstrap_report_path="${OUT_DIR}/bootstrap-report.json"
  set +e
  MANIFEST_FILE="${MANIFEST_FILE}" ENV_FILE="${ENV_FILE}" OUT_FILE="${bootstrap_report_path}" \
    bash "${SCRIPT_DIR}/bootstrap-fixtures.sh"
  bootstrap_rc=$?
  set -e
  if [[ ${bootstrap_rc} -ne 0 ]]; then
    bootstrap_ok=false
  fi
fi

SUITES=(
  "01-discovery-smoke.sh"
  "02-sequence-lifecycle-smoke.sh"
  "03-sequencer-mutation-smoke.sh"
  "04-validation-gate-smoke.sh"
  "05-legacy-regression-smoke.sh"
  "06-effects-definition-smoke.sh"
  "07-transactions-smoke.sh"
  "09-async-jobs-smoke.sh"
)

overall_ok="${bootstrap_ok}"
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
printf '{"manifest":"%s","packId":"%s","packVersion":"%s","outDir":"%s","bootstrap":{"enabled":%s,"passed":%s,"report":%s},"passed":%s,"suites":[%s]}\n' \
  "${MANIFEST_FILE}" "${pack_id}" "${pack_version}" "${OUT_DIR}" "${BOOTSTRAP_FIXTURES}" "${bootstrap_ok}" \
  "$(if [[ -n "${bootstrap_report_path}" ]]; then printf '"%s"' "${bootstrap_report_path}"; else printf 'null'; fi)" \
  "${overall_ok}" "${joined}" | tee "${OUT_DIR}/run-all-summary.json"

if [[ "${overall_ok}" == "true" ]]; then
  exit 0
fi

exit 1
