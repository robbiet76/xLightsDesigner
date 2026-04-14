#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

PLAN_PATH="${ROOT_DIR}/catalog/effect-parameter-screening-plan-v1.json"
OUT_DIR=""
EXECUTE="0"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --out-dir)
      OUT_DIR="$2"
      shift 2
      ;;
    --execute)
      EXECUTE="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

[[ -n "${OUT_DIR}" ]] || OUT_DIR="/tmp/effect-parameter-screening"
mkdir -p "${OUT_DIR}"

bash "${SCRIPT_DIR}/run-effect-training-automation-cycle.sh" >/dev/null
node "${ROOT_DIR}/tooling/build-effect-parameter-screening-plan.mjs" "${PLAN_PATH}" >/dev/null

python3 - <<'PY' "${PLAN_PATH}" "${ROOT_DIR}" "${OUT_DIR}" "${EXECUTE}"
import json, os, subprocess, sys

plan_path, root_dir, out_dir, execute = sys.argv[1:5]
with open(plan_path) as f:
    plan = json.load(f)

for row in plan.get("rows", []):
    generated_manifest = row["generatedManifestPath"]
    os.makedirs(os.path.dirname(generated_manifest), exist_ok=True)
    subprocess.run([
        "python3",
        os.path.join(root_dir, "generators", "generate-parameter-sweep-manifest.py"),
        "--registry", os.path.join(root_dir, "catalog", "effect-parameter-registry.json"),
        "--base-manifest", row["baseManifestPath"],
        "--parameter", row["parameterName"],
        "--out-file", generated_manifest
    ], check=True)

    if execute == "1":
        sample_out = os.path.join(out_dir, f"{row['effectName']}-{row['parameterName']}")
        os.makedirs(sample_out, exist_ok=True)
        subprocess.run([
            "bash",
            os.path.join(root_dir, "runners", "run-manifest.sh"),
            "--manifest", generated_manifest,
            "--out-dir", sample_out
        ], check=True)
PY

printf '[effect-parameter-screening] plan=%s out=%s execute=%s\n' "${PLAN_PATH}" "${OUT_DIR}" "${EXECUTE}"
