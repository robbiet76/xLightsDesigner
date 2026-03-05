#!/usr/bin/env bash
set -euo pipefail

LOG_FILE="specs/projects/xlights-sequencer-control/desktop-validation-evidence-log.md"

date_val="$(date +%F)"
build_val=""
channel_val=""
machine_val=""
macos_val=""
xlights_val=""
install_val=""
core_val=""
evidence_val=""
notes_val=""

usage() {
  cat <<USAGE
Usage:
  $0 --build <sha> --channel <preview|stable> --machine <name> --macos <version> --xlights <version> --install <PASS|FAIL> --core <PASS|FAIL> [--evidence <text>] [--notes <text>] [--date <YYYY-MM-DD>]
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --date) date_val="${2:-}"; shift 2 ;;
    --build) build_val="${2:-}"; shift 2 ;;
    --channel) channel_val="${2:-}"; shift 2 ;;
    --machine) machine_val="${2:-}"; shift 2 ;;
    --macos) macos_val="${2:-}"; shift 2 ;;
    --xlights) xlights_val="${2:-}"; shift 2 ;;
    --install) install_val="${2:-}"; shift 2 ;;
    --core) core_val="${2:-}"; shift 2 ;;
    --evidence) evidence_val="${2:-}"; shift 2 ;;
    --notes) notes_val="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 2 ;;
  esac
done

for v in build_val channel_val machine_val macos_val xlights_val install_val core_val; do
  if [[ -z "${!v}" ]]; then
    echo "Missing required option: ${v%_val}" >&2
    usage
    exit 2
  fi
done

install_val="$(echo "$install_val" | tr '[:lower:]' '[:upper:]')"
core_val="$(echo "$core_val" | tr '[:lower:]' '[:upper:]')"

if [[ "$install_val" != "PASS" && "$install_val" != "FAIL" ]]; then
  echo "--install must be PASS or FAIL" >&2
  exit 2
fi
if [[ "$core_val" != "PASS" && "$core_val" != "FAIL" ]]; then
  echo "--core must be PASS or FAIL" >&2
  exit 2
fi

[[ -f "$LOG_FILE" ]] || {
  echo "Log file not found: $LOG_FILE" >&2
  exit 1
}

row="| $date_val | $build_val | $channel_val | $machine_val | $macos_val | $xlights_val | $install_val | $core_val | ${evidence_val:-n/a} | ${notes_val:-} |"
printf "%s\n" "$row" >> "$LOG_FILE"

echo "[record-validation-evidence] added row to $LOG_FILE"
