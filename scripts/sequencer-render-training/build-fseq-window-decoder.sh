#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT_BIN="${SCRIPT_DIR}/fseq_window_decoder"
SRC_CPP="${SCRIPT_DIR}/fseq_window_decoder.cpp"
FSEQ_CPP="/Users/robterry/xLights/xLights/FSEQFile.cpp"
LOG4CPP_A="/Users/robterry/xLights/macOS/xLights-macOS-dependencies-2026.02/libdbg/liblog4cpp.a"

if [[ -x "${OUT_BIN}" && "${OUT_BIN}" -nt "${SRC_CPP}" && "${OUT_BIN}" -nt "${FSEQ_CPP}" ]]; then
  printf '%s\n' "${OUT_BIN}"
  exit 0
fi

clang++ -std=c++20 -O2 \
  -I/Users/robterry/xLights/xLights \
  -I/Users/robterry/xLights/include \
  -I/Users/robterry/xLights/macOS/xLights-macOS-dependencies-2026.02/include \
  -I/opt/homebrew/include \
  -I/usr/local/include \
  "${SRC_CPP}" \
  "${FSEQ_CPP}" \
  "${LOG4CPP_A}" \
  -o "${OUT_BIN}" \
  -L/Users/robterry/xLights/macOS/xLights-macOS-dependencies-2026.02/libdbg \
  -L/opt/homebrew/lib \
  -L/usr/local/lib \
  -lzstd -lz

printf '%s\n' "${OUT_BIN}"
