#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT_BIN="${SCRIPT_DIR}/fseq_window_decoder"
SRC_CPP="${SCRIPT_DIR}/fseq_window_decoder.cpp"
XLIGHTS_ROOT="${XLIGHTS_ROOT:-/Users/robterry/xLights-2026.07}"
XLIGHTS_DEPS_ROOT="${XLIGHTS_DEPS_ROOT:-${XLIGHTS_ROOT}/macOS/xLights-macOS-dependencies-2026.07}"
FSEQ_CPP="${XLIGHTS_ROOT}/src-core/render/FSEQFile.cpp"

if [[ -x "${OUT_BIN}" && "${OUT_BIN}" -nt "${SRC_CPP}" && "${OUT_BIN}" -nt "${FSEQ_CPP}" ]]; then
  printf '%s\n' "${OUT_BIN}"
  exit 0
fi

clang++ -std=c++20 -O2 \
  -I"${XLIGHTS_ROOT}/src-core/render" \
  -I"${XLIGHTS_ROOT}/src-core" \
  -I"${XLIGHTS_ROOT}/include" \
  -I"${XLIGHTS_ROOT}/dependencies/spdlog/include" \
  -I"${XLIGHTS_DEPS_ROOT}/include" \
  -I/opt/homebrew/include \
  -I/usr/local/include \
  "${SRC_CPP}" \
  "${FSEQ_CPP}" \
  -o "${OUT_BIN}" \
  -L"${XLIGHTS_DEPS_ROOT}/libdbg" \
  -L/opt/homebrew/lib \
  -L/usr/local/lib \
  -lzstd -lz

printf '%s\n' "${OUT_BIN}"
