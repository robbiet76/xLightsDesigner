#!/usr/bin/env bash
set -euo pipefail

DIAG_DIR="${HOME}/Library/Logs/DiagnosticReports"
SINCE_EPOCH="${XLIGHTS_CRASH_SINCE_EPOCH:-0}"
OUT_SUMMARY="${XLIGHTS_CRASH_SUMMARY_OUT:-/tmp/xlights-crash.latest.txt}"
OUT_RAW="${XLIGHTS_CRASH_RAW_OUT:-/tmp/xlights-crash.latest.raw}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --since-epoch)
      SINCE_EPOCH="${2:-0}"
      shift 2
      ;;
    --summary-out)
      OUT_SUMMARY="${2:-${OUT_SUMMARY}}"
      shift 2
      ;;
    --raw-out)
      OUT_RAW="${2:-${OUT_RAW}}"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

if [[ -z "${SINCE_EPOCH}" ]]; then
  SINCE_EPOCH=0
fi

if [[ "${SINCE_EPOCH}" == "0" && -f /tmp/xlights-crash-since.epoch ]]; then
  maybe_since="$(cat /tmp/xlights-crash-since.epoch 2>/dev/null || true)"
  if [[ "${maybe_since}" =~ ^[0-9]+$ ]]; then
    SINCE_EPOCH="${maybe_since}"
  fi
fi

latest=""
while IFS= read -r file; do
  [[ -z "${file}" ]] && continue
  file_epoch="$(stat -f %m "${file}" 2>/dev/null || echo 0)"
  if [[ "${SINCE_EPOCH}" =~ ^[0-9]+$ ]] && (( SINCE_EPOCH > 0 )) && (( file_epoch < SINCE_EPOCH )); then
    continue
  fi
  latest="${file}"
  break
done < <(ls -1t "${DIAG_DIR}"/xLights*.crash "${DIAG_DIR}"/xLights*.ips 2>/dev/null || true)

if [[ -z "${latest}" ]]; then
  echo "No xLights crash report found in ${DIAG_DIR} (since epoch ${SINCE_EPOCH})."
  exit 0
fi

cp -f "${latest}" "${OUT_RAW}" 2>/dev/null || true

{
  echo "xLights crash report: ${latest}"
  echo "mtime epoch: $(stat -f %m "${latest}" 2>/dev/null || echo unknown)"
  echo
  if [[ "${latest}" == *.crash ]]; then
    awk '
      /^Process:/ { print; next }
      /^Date\/Time:/ { print; next }
      /^Exception Type:/ { print; next }
      /^Exception Codes:/ { print; next }
      /^Termination Reason:/ { print; next }
      /^Application Specific Information:/ { print; app=1; next }
      app==1 && NF==0 { app=0; print ""; next }
      app==1 { print; next }
      /^Thread 0 Crashed::/ { print; t0=1; count=0; next }
      t0==1 && /^Thread [0-9]+/ && $2 != "Crashed::" { t0=0 }
      t0==1 && count < 18 { print; count++ }
    ' "${latest}"
  else
    echo "Detected .ips crash report. Key fields:"
    rg -n '"procName"|"captureTime"|"type"\\s*:\\s*"EXC_|"signal"\\s*:|"termination"|\"indicator\"|\"faultingThread\"|\"asi\"' "${latest}" || true
    echo
    echo "Top of file:"
    sed -n '1,60p' "${latest}"
  fi
} | tee "${OUT_SUMMARY}"

