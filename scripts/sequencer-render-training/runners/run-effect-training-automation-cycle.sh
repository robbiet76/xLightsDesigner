#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

node "${ROOT_DIR}/tooling/build-unified-training-set.mjs"
node "${ROOT_DIR}/tooling/build-effect-settings-coverage-report.mjs"
node "${ROOT_DIR}/tooling/build-effect-training-automation-plan.mjs"

printf '[effect-training-cycle] refreshed unified training set, settings coverage report, and automation plan\n'
