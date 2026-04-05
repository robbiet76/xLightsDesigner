#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
log_root="$repo_root/var/logs/designer-training-runs"
latest_link="$log_root/latest"
fallback_file="$log_root/pending-followups-next.md"

note="${*:-}"
if [[ -z "$note" ]]; then
  echo "usage: bash scripts/designer-training/add-followup.sh \"note text\"" >&2
  exit 2
fi

mkdir -p "$log_root"

if [[ -L "$latest_link" || -d "$latest_link" ]]; then
  target_dir="$(cd "$latest_link" && pwd)"
  queue_file="$target_dir/pending-followups.md"
else
  queue_file="$fallback_file"
fi

printf -- "- [%s] %s\n" "$(date '+%Y-%m-%d %H:%M:%S %Z')" "$note" >> "$queue_file"
printf '%s\n' "$queue_file"
