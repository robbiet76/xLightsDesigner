#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${ROOT_DIR}/../.." && pwd)"

RUN_TYPE="overnight"
RUN_ROOT=""
RUN_ID=""
MAX_RUNTIME_MINUTES=""
MODE="plan"
PRIOR_FILES=()
APPLY_RENDER="0"
MAX_PASSES="1"
UNTIL_RUNTIME_BUDGET="0"
STAMP="$(date -u +"%Y%m%dT%H%M%SZ")"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/sequencer-render-training/runners/run-layer-composition-training.sh [options]

Options:
  --run-type <type>             smoke, focused_evening, overnight, or extended. Default: overnight.
  --out-dir <path>              Write run artifacts to this directory.
  --run-id <id>                 Override generated run id.
  --max-runtime-minutes <n>     Override run type max runtime metadata.
  --prior-file <path>           Existing layer composition priors to skip durable covered learnings. Repeatable.
  --execute                     Build non-mutating execution scaffold. Real xLights apply/render is not wired yet.
  --apply-render                With --execute, run real owned xLights apply/render for pending passes.
  --max-passes <n>              Limit real apply/render pass count. Default: 1.
  --until-runtime-budget        With --apply-render, process pending passes until the run budget or queue ends.
  --help                        Show this help.

Default mode is planning only. It writes training-plan.json without running xLights.
The normal learning run type is overnight, targeting 8 to 10 hours. Use smoke only
for daytime validation of the plan and runner plumbing.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --run-type)
      RUN_TYPE="$2"
      shift 2
      ;;
    --out-dir)
      RUN_ROOT="$2"
      shift 2
      ;;
    --run-id)
      RUN_ID="$2"
      shift 2
      ;;
    --max-runtime-minutes)
      MAX_RUNTIME_MINUTES="$2"
      shift 2
      ;;
    --prior-file)
      PRIOR_FILES+=("$2")
      shift 2
      ;;
    --execute)
      MODE="execute"
      shift
      ;;
    --apply-render)
      APPLY_RENDER="1"
      shift
      ;;
    --max-passes)
      MAX_PASSES="$2"
      shift 2
      ;;
    --until-runtime-budget)
      UNTIL_RUNTIME_BUDGET="1"
      shift
      ;;
    --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

case "${RUN_TYPE}" in
  smoke|focused_evening|overnight|extended)
    ;;
  *)
    echo "Invalid run type: ${RUN_TYPE}" >&2
    usage >&2
    exit 1
    ;;
esac

if [[ -z "${RUN_ROOT}" ]]; then
  RUN_ROOT="${REPO_ROOT}/var/logs/sequencer-layer-composition-training-runs/${STAMP}"
fi
mkdir -p "${RUN_ROOT}"

PLAN_PATH="${RUN_ROOT}/training-plan.json"
SUMMARY_PATH="${RUN_ROOT}/summary.json"

ARGS=(
  "${REPO_ROOT}/scripts/sequencer-render-training/tooling/build-layer-composition-training-plan.mjs"
  --run-type "${RUN_TYPE}"
  --out "${PLAN_PATH}"
)

if [[ -n "${RUN_ID}" ]]; then
  ARGS+=(--run-id "${RUN_ID}")
fi

if [[ -n "${MAX_RUNTIME_MINUTES}" ]]; then
  ARGS+=(--max-runtime-minutes "${MAX_RUNTIME_MINUTES}")
fi

if [[ ${#PRIOR_FILES[@]} -gt 0 ]]; then
  for PRIOR_FILE in "${PRIOR_FILES[@]}"; do
    ARGS+=(--prior-file "${PRIOR_FILE}")
  done
fi

node "${ARGS[@]}" >/dev/null

if [[ "${MODE}" == "execute" ]]; then
  node "${REPO_ROOT}/scripts/sequencer-render-training/tooling/run-layer-composition-execution-scaffold.mjs" \
    --plan "${PLAN_PATH}" \
    --run-root "${RUN_ROOT}" \
    > "${RUN_ROOT}/execution-scaffold-result.json"
  if [[ "${APPLY_RENDER}" == "1" ]]; then
    RUNNER_ARGS=(
      "${REPO_ROOT}/scripts/sequencer-render-training/tooling/run-layer-composition-pass-runner.mjs"
      --run-root "${RUN_ROOT}" \
      --max-passes "${MAX_PASSES}"
    )
    if [[ "${UNTIL_RUNTIME_BUDGET}" == "1" ]]; then
      RUNNER_ARGS+=(--until-runtime-budget)
      if [[ -n "${MAX_RUNTIME_MINUTES}" ]]; then
        RUNNER_ARGS+=(--max-runtime-minutes "${MAX_RUNTIME_MINUTES}")
      fi
    fi
    node "${RUNNER_ARGS[@]}"
  else
    cat "${RUN_ROOT}/execution-scaffold-result.json"
  fi
  exit 0
fi

node --input-type=module - "${PLAN_PATH}" "${SUMMARY_PATH}" <<'NODE'
import fs from "node:fs";

const [planPath, summaryPath] = process.argv.slice(2);
const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
const passCount = (plan.experiments || []).reduce((total, experiment) => total + (experiment.passes || []).length, 0);
const summary = {
  artifactType: "layer_composition_training_run_summary_v1",
  status: "planned",
  runId: plan.runId,
  runType: plan.runType,
  trainingPlanRef: planPath,
  runtimeBudget: plan.runtimeBudget,
  experimentCount: (plan.experiments || []).length,
  passCount,
  paletteProfiles: (plan.paletteProfiles || []).map((row) => row.profile),
  priorCoverageSummary: plan.curriculum?.priorCoverageSummary || {},
  unsupportedRenderSettingCount: (plan.unsupportedRenderSettings || []).length,
  retentionPolicy: {
    summarizeAsYouGo: Boolean(plan.retentionPolicy?.summarizeAsYouGo),
    cleanupMode: plan.retentionPolicy?.cleanupMode || "",
    warningFreeDiskGb: plan.retentionPolicy?.diskGuardrails?.warningFreeDiskGb ?? null,
    stopFreeDiskGb: plan.retentionPolicy?.diskGuardrails?.stopFreeDiskGb ?? null
  },
  nextStep: plan.runType === "smoke"
    ? "Review plan, then wire execution for smoke validation."
    : "Review plan during daytime, then execute after smoke validation is available."
};
fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
NODE
