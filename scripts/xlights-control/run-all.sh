#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

DEFAULT_ENV_FILE="${ROOT_DIR}/specs/projects/xlights-sequencer-control/test-fixtures.env"
if [[ ! -f "${DEFAULT_ENV_FILE}" ]]; then
  DEFAULT_ENV_FILE="${ROOT_DIR}/specs/projects/xlights-sequencer-control/test-fixtures.example.env"
fi

ENV_FILE="${ENV_FILE:-${DEFAULT_ENV_FILE}}"
MANIFEST_FILE="${MANIFEST_FILE:-${ROOT_DIR}/specs/projects/xlights-sequencer-control/test-fixtures.manifest.json}"
OUT_DIR="${OUT_DIR:-/tmp/xlights-control-reports/$(date +%Y%m%d-%H%M%S)}"
BOOTSTRAP_FIXTURES="${BOOTSTRAP_FIXTURES:-}"
BOOTSTRAP_WAS_PRESET=false
if [[ -n "${BOOTSTRAP_FIXTURES}" ]]; then
  BOOTSTRAP_WAS_PRESET=true
fi

mkdir -p "${OUT_DIR}"

if [[ -f "${ENV_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
fi

if [[ -z "${BOOTSTRAP_FIXTURES}" ]]; then
  BOOTSTRAP_FIXTURES=false
fi

# If running against the example template (placeholder paths), disable bootstrap
# unless explicitly requested by caller.
if [[ "${BOOTSTRAP_WAS_PRESET}" != "true" && "${ENV_FILE}" == *"test-fixtures.example.env" ]]; then
  BOOTSTRAP_FIXTURES=false
fi

if [[ -z "${TEST_SEQUENCE_PATH:-}" || "${TEST_SEQUENCE_PATH}" == "/abs/path/to/test-sequence.xsq" ]]; then
  if [[ -f "/Users/robterry/Desktop/Show/HolidayRoad/HolidayRoad.xsq" ]]; then
    TEST_SEQUENCE_PATH="/Users/robterry/Desktop/Show/HolidayRoad/HolidayRoad.xsq"
    export TEST_SEQUENCE_PATH
  fi
fi

if [[ -z "${TEST_MEDIA_PATH:-}" || "${TEST_MEDIA_PATH}" == "/abs/path/to/test-song.mp3" ]]; then
  if [[ -d "/Users/robterry/Desktop/Show/Audio" ]]; then
    TEST_MEDIA_PATH="/Users/robterry/Desktop/Show/Audio"
    export TEST_MEDIA_PATH
  fi
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

# Ensure xLights automation endpoint is running before suite execution.
if [[ -z "${TEST_SEQUENCE_PATH:-}" || ! -f "${TEST_SEQUENCE_PATH}" ]]; then
  echo "Missing usable TEST_SEQUENCE_PATH. Set it in ${ENV_FILE} or environment." >&2
  exit 2
fi

launch_log="${OUT_DIR}/launch.log"
set +e
launch_output="$("${SCRIPT_DIR}/launch-and-open-sequence.sh" "${TEST_SEQUENCE_PATH}" 2>&1)"
launch_rc=$?
set -e
printf "%s\n" "${launch_output}" | tee "${launch_log}"
if [[ ${launch_rc} -ne 0 ]]; then
  if [[ ${launch_rc} -eq 3 ]]; then
    echo "HARNESS_ENV_NOT_READY: xLights endpoint is not auto-launchable from this shell context." >&2
    echo "Start xLights manually, then rerun run-all.sh." >&2
    printf '{"manifest":"%s","packId":"%s","packVersion":"%s","outDir":"%s","bootstrap":{"enabled":%s,"passed":%s,"report":%s},"passed":false,"envReady":false,"reason":"HARNESS_ENV_NOT_READY","suites":[]}\n' \
      "${MANIFEST_FILE}" "${pack_id}" "${pack_version}" "${OUT_DIR}" "${BOOTSTRAP_FIXTURES}" "${bootstrap_ok}" \
      "$(if [[ -n "${bootstrap_report_path}" ]]; then printf '"%s"' "${bootstrap_report_path}"; else printf 'null'; fi)" \
      | tee "${OUT_DIR}/run-all-summary.json"
    exit 2
  fi
  echo "Failed to launch xLights/open sequence; see ${launch_log}" >&2
  exit 1
fi

launched_base_url="$(printf "%s\n" "${launch_output}" | sed -n 's/^xLights ready on //p' | tail -n1)"
if [[ -n "${launched_base_url}" ]]; then
  export XLIGHTS_BASE_URL="${launched_base_url}"
fi

SUITES=(
  "01-discovery-smoke.sh"
  "02-sequence-lifecycle-smoke.sh"
  "03-sequencer-mutation-smoke.sh"
  "04-validation-gate-smoke.sh"
  "05-legacy-regression-smoke.sh"
  "06-effects-definition-smoke.sh"
  "07-transactions-smoke.sh"
  "08-plan-execution-smoke.sh"
  "09-async-jobs-smoke.sh"
  "10-revision-conflict-smoke.sh"
  "11-diagnostics-smoke.sh"
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
