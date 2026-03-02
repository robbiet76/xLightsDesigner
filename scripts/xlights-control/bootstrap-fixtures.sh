#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

MANIFEST_FILE="${MANIFEST_FILE:-${ROOT_DIR}/specs/projects/xlights-sequencer-control/test-fixtures.manifest.json}"
ENV_FILE="${ENV_FILE:-${ROOT_DIR}/specs/projects/xlights-sequencer-control/test-fixtures.example.env}"
OUT_FILE="${OUT_FILE:-/tmp/xlights-control-bootstrap.json}"

if [ -f "${ENV_FILE}" ]; then
  # shellcheck disable=SC1090
  . "${ENV_FILE}"
fi

if ! command -v jq >/dev/null 2>&1; then
  echo '{"passed":false,"error":"jq not found"}'
  exit 1
fi

pack_id="$(jq -r '.fixturePack.packId' "${MANIFEST_FILE}")"
pack_version="$(jq -r '.fixturePack.packVersion' "${MANIFEST_FILE}")"
overall_ok=true

assets_input="$(mktemp)"
assets_out="$(mktemp)"
jq -c '.fixturePack.assets[]' "${MANIFEST_FILE}" > "${assets_input}"

while IFS= read -r asset; do
  [ -z "${asset}" ] && continue

  id="$(printf '%s' "${asset}" | jq -r '.id')"
  env_var="$(printf '%s' "${asset}" | jq -r '.envVar')"
  required="$(printf '%s' "${asset}" | jq -r '.required')"
  checksum_algo="$(printf '%s' "${asset}" | jq -r '.checksum.algo')"
  checksum_expected="$(printf '%s' "${asset}" | jq -r '.checksum.value')"
  resolved_path="$(eval "printf '%s' \"\${${env_var}:-}\"")"

  status="ok"
  exists=false
  readable=false
  checksum_actual="null"
  checksum_match="null"
  message=""

  if [ -n "${resolved_path}" ] && [ -e "${resolved_path}" ]; then
    exists=true
  fi
  if [ -n "${resolved_path}" ] && [ -r "${resolved_path}" ]; then
    readable=true
  fi

  if [ "${required}" = "true" ] && { [ -z "${resolved_path}" ] || [ "${exists}" != "true" ] || [ "${readable}" != "true" ]; }; then
    status="error"
    overall_ok=false
    message="required asset missing or unreadable"
  fi

  if [ "${exists}" = "true" ] && [ "${checksum_algo}" = "sha256" ] && [ "${checksum_expected}" != "0000000000000000000000000000000000000000000000000000000000000000" ]; then
    if command -v shasum >/dev/null 2>&1; then
      checksum_actual="$(shasum -a 256 "${resolved_path}" | awk '{print $1}')"
      if [ "${checksum_actual}" = "${checksum_expected}" ]; then
        checksum_match=true
      else
        checksum_match=false
        status="error"
        overall_ok=false
        message="checksum mismatch"
      fi
    else
      status="warning"
      message="shasum not found; checksum not verified"
    fi
  fi

  jq -nc \
    --arg id "${id}" \
    --arg envVar "${env_var}" \
    --arg path "${resolved_path}" \
    --arg status "${status}" \
    --arg message "${message}" \
    --argjson required "${required}" \
    --argjson exists "${exists}" \
    --argjson readable "${readable}" \
    --arg checksumAlgo "${checksum_algo}" \
    --arg checksumExpected "${checksum_expected}" \
    --arg checksumActual "${checksum_actual}" \
    --argjson checksumMatch "${checksum_match}" \
    '{
      id: $id,
      envVar: $envVar,
      required: $required,
      resolvedPath: (if $path == "" then null else $path end),
      exists: $exists,
      readable: $readable,
      checksum: {
        algo: $checksumAlgo,
        expected: $checksumExpected,
        actual: (if $checksumActual == "null" then null else $checksumActual end),
        match: $checksumMatch
      },
      status: $status,
      message: (if $message == "" then null else $message end)
    }' >> "${assets_out}"
done < "${assets_input}"

assets_json="$(jq -s '.' "${assets_out}")"
report="$(jq -nc \
  --arg manifest "${MANIFEST_FILE}" \
  --arg packId "${pack_id}" \
  --arg packVersion "${pack_version}" \
  --argjson passed "${overall_ok}" \
  --argjson assets "${assets_json}" \
  '{
    manifest: $manifest,
    packId: $packId,
    packVersion: $packVersion,
    passed: $passed,
    assets: $assets
  }')"

printf "%s\n" "${report}" > "${OUT_FILE}"
printf "%s\n" "${report}"

rm -f "${assets_input}" "${assets_out}"

if [ "${overall_ok}" = "true" ]; then
  exit 0
fi

exit 1
