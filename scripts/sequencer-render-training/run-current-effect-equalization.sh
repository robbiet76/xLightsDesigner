#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

SELECTOR_MAP_OUT="${1:-/tmp/render-training-selector-intent-map.v1.json}"
SELECTOR_EVAL_OUT="${2:-/tmp/priority-effect-selection-eval.v7.json}"
EQUALIZATION_OUT="${3:-/tmp/render-training-current-effect-equalization.v4.json}"

python3 "${SCRIPT_DIR}/merge-intent-maps.py" \
  --intent-map /tmp/render-training-priority-intent-map.v5.json \
  --intent-map /tmp/render-training-shockwave-interaction-intent-map.v2.json \
  --intent-map /tmp/render-training-twinkle-interaction-intent-map.v1.json \
  --out-file "${SELECTOR_MAP_OUT}"

python3 "${SCRIPT_DIR}/evaluate-priority-effect-selection.py" \
  --intent-map "${SELECTOR_MAP_OUT}" \
  --cases "${SCRIPT_DIR}/priority-effect-selection-cases.v4.json" \
  --out-file "${SELECTOR_EVAL_OUT}"

python3 "${SCRIPT_DIR}/generate-current-effect-equalization-board.py" \
  --priority-maturity /tmp/render-training-effect-maturity.v7.json \
  --selector-eval "${SELECTOR_EVAL_OUT}" \
  --twinkle-summary /tmp/render-training-twinkle-summary.v2.json \
  --twinkle-retrieval-eval /tmp/twinkle-intent-eval.v1.json \
  --twinkle-interaction-eval /tmp/twinkle-intent-eval.v2.json \
  --shockwave-summary /tmp/render-training-shockwave-summary.v3.json \
  --shockwave-retrieval-eval /tmp/shockwave-intent-eval.v3.json \
  --out-file "${EQUALIZATION_OUT}"

printf '%s\n' "${EQUALIZATION_OUT}"
