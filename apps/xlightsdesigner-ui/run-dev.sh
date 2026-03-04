#!/usr/bin/env bash
set -euo pipefail
PORT="${PORT:-8080}"
python3 -m http.server "${PORT}"
