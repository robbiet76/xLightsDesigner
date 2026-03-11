#!/usr/bin/env bash
set -euo pipefail

LOG_FILE="docs/operations/xlightsdesigner-desktop-validation-evidence-log.md"

[[ -f "$LOG_FILE" ]] || {
  echo "[check-desktop-readiness] FAIL: missing log file: $LOG_FILE" >&2
  exit 1
}

if awk -F'\|' '
  function trim(s){ gsub(/^[ \t]+|[ \t]+$/, "", s); return s }
  /^\|/ {
    install=toupper(trim($8));
    core=toupper(trim($9));
    if (install=="PASS" && core=="PASS") {
      ok=1;
    }
  }
  END { exit(ok ? 0 : 1) }
' "$LOG_FILE"; then
  echo "[check-desktop-readiness] PASS: at least one evidence row has Install/Launch=PASS and Core Flow=PASS"
  exit 0
fi

echo "[check-desktop-readiness] FAIL: no qualifying PASS/PASS evidence row found"
exit 1
