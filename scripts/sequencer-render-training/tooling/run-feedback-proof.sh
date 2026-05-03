#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "${ROOT_DIR}"

GEOMETRY="${XLD_RENDER_TRAINING_GEOMETRY:-/tmp/xld-render-training-proofs/preview-scene-geometry-render-training-live.json}"
FSEQ="render-training/fseq/singlestrand-treeflat-stage1-coverage-v1-chaseSize-registry-v1.20260319T201838Z.fseq"
OUT_DIR="${XLD_RENDER_TRAINING_PROOF_OUT_DIR:-/tmp/xld-render-training-proofs}"
WINDOW="${OUT_DIR}/preview-scene-window-render-training-treeflat.json"
OBS="${OUT_DIR}/render-observation-render-training-treeflat.json"
CRITIQUE="${OUT_DIR}/sequence-critique-render-training-treeflat.json"
RECORD="${OUT_DIR}/sequence-learning-record-render-training-treeflat.json"

if [[ ! -f "${GEOMETRY}" ]]; then
  printf 'Missing geometry artifact: %s\nSet XLD_RENDER_TRAINING_GEOMETRY to a local preview_scene_geometry_v1 export.\n' "${GEOMETRY}" >&2
  exit 2
fi

mkdir -p "${OUT_DIR}"

python3 scripts/sequencer-render-training/tooling/reconstruct-preview-scene-window.py \
  --geometry "${GEOMETRY}" \
  --fseq "${FSEQ}" \
  --window-start-ms 1000 \
  --window-end-ms 5000 \
  --frame-offsets 8,10,12 \
  --out "${WINDOW}"

python3 scripts/sequencer-render-training/tooling/extract-render-observation.py \
  --window "${WINDOW}" \
  --out "${OBS}"

python3 scripts/sequencer-render-training/tooling/extract-sequence-critique.py \
  --observation "${OBS}" \
  --out "${CRITIQUE}"

python3 scripts/sequencer-render-training/tooling/build-sequence-learning-record.py \
  --window "${WINDOW}" \
  --observation "${OBS}" \
  --critique "${CRITIQUE}" \
  --out "${RECORD}"

printf '%s\n' "${WINDOW}"
printf '%s\n' "${OBS}"
printf '%s\n' "${CRITIQUE}"
printf '%s\n' "${RECORD}"
