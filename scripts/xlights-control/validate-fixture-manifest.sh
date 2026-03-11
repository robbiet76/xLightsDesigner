#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MANIFEST_FILE="${1:-${ROOT_DIR}/specs/xlights-sequencer-control-test-fixtures.manifest.json}"

jq empty "${MANIFEST_FILE}" >/dev/null

jq -e '
  .fixturePack.packId | type == "string" and length > 0
' "${MANIFEST_FILE}" >/dev/null

jq -e '
  .fixturePack.packVersion | type == "string" and length > 0
' "${MANIFEST_FILE}" >/dev/null

jq -e '
  .fixturePack.source.type | type == "string" and (. == "local" or . == "remote")
' "${MANIFEST_FILE}" >/dev/null

jq -e '
  .fixturePack.source.uri | type == "string" and length > 0
' "${MANIFEST_FILE}" >/dev/null

jq -e '
  .fixturePack.assets | type == "array" and length > 0
' "${MANIFEST_FILE}" >/dev/null

jq -e '
  .fixturePack.assets[]
  | (.id | type == "string" and length > 0)
  and (.envVar | type == "string" and test("^[A-Z0-9_]+$"))
  and (.required | type == "boolean")
  and (.checksum.algo == "sha256")
  and (.checksum.value | type == "string" and test("^[a-f0-9]{64}$"))
' "${MANIFEST_FILE}" >/dev/null

jq -e '
  [ .environment | keys[] ] as $env_keys
  | .fixturePack.assets
  | all(.envVar as $k | $env_keys | index($k))
' "${MANIFEST_FILE}" >/dev/null

jq -e '
  .fixturePack.assets
  | map(select(.required == true and .envVar == "TEST_SEQUENCE_PATH"))
  | length >= 1
' "${MANIFEST_FILE}" >/dev/null

echo "fixture-manifest-valid:${MANIFEST_FILE}"
