#!/usr/bin/env bash
set -euo pipefail
PORT="${PORT:-8080}"
python3 "$(dirname "$0")/dev_server.py" --port "${PORT}"
