#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runSequencingQualityLoop } from "./run-sequencing-quality-loop.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const DEFAULT_OUT_ROOT = "var/logs/sequencing-quality-controller/unattended";
const DEFAULT_MODEL_CATALOG = "scripts/sequencer-render-training/catalog/generic-layout-model-catalog.json";
const DEFAULT_ENDPOINT = "http://127.0.0.1:49915/xlightsdesigner/api";

function str(value = "") {
  return String(value || "").trim();
}

function num(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function resolvePath(filePath = "") {
  const value = str(filePath);
  if (!value) return "";
  return path.isAbsolute(value) ? value : path.resolve(REPO_ROOT, value);
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function readJsonIfExists(filePath = "") {
  const resolved = resolvePath(filePath);
  if (!resolved || !fs.existsSync(resolved)) return null;
  return JSON.parse(fs.readFileSync(resolved, "utf8"));
}

function loopDir(root = "", index = 1) {
  return path.join(resolvePath(root || DEFAULT_OUT_ROOT), `loop-${String(index).padStart(6, "0")}`);
}

function shouldAdvanceLatestRun(summary = {}) {
  return str(summary.status) === "executed" && str(summary.loopRoot);
}

function stopReasonForSummary(summary = {}, index = 0, maxLoops = 1) {
  const decision = summary.controllerDecision || {};
  if (str(decision.nextAction) === "idle") return "controller_idle";
  if (str(summary.status) === "blocked_no_controller_queue") return str(decision.nextAction) === "await_evidence"
    ? "awaiting_evidence"
    : "blocked_no_controller_queue";
  if (index >= maxLoops) return "max_loops_reached";
  return "";
}

export async function runSequencingQualityUnattended({
  latestRunRoot = "",
  previousStatePath = "",
  outRoot = DEFAULT_OUT_ROOT,
  modelCatalogPath = DEFAULT_MODEL_CATALOG,
  runType = "overnight",
  maxLoops = 10,
  maxQueue = 25,
  maxPasses = 5,
  applyRender = true,
  endpoint = DEFAULT_ENDPOINT,
  summaryPath = "",
  deps = {}
} = {}) {
  const root = resolvePath(outRoot || DEFAULT_OUT_ROOT);
  fs.mkdirSync(root, { recursive: true });
  const resolvedSummaryPath = resolvePath(summaryPath) || path.join(root, "unattended-run-summary.json");
  let currentLatestRunRoot = resolvePath(latestRunRoot);
  let currentPreviousStatePath = resolvePath(previousStatePath);
  const iterations = [];
  let stopReason = "max_loops_reached";

  for (let index = 1; index <= maxLoops; index += 1) {
    const runLoop = deps.runLoop || runSequencingQualityLoop;
    const summary = await runLoop({
      latestRunRoot: currentLatestRunRoot,
      previousStatePath: currentPreviousStatePath,
      outRoot: root,
      loopRoot: loopDir(root, index),
      modelCatalogPath,
      runType,
      runId: `unattended-${String(index).padStart(6, "0")}`,
      maxQueue,
      maxPasses,
      applyRender,
      endpoint,
      deps: deps.loopDeps || {}
    });
    const controllerState = readJsonIfExists(summary.controllerStateRef);
    const iteration = {
      iteration: index,
      status: str(summary.status),
      loopRoot: str(summary.loopRoot),
      controllerStateRef: str(summary.controllerStateRef),
      selectedGoalId: str(summary.controllerDecision?.selectedGoalId),
      nextAction: str(summary.controllerDecision?.nextAction),
      selectionReason: str(summary.controllerDecision?.selectionReason),
      processedPasses: num(summary.passRunner?.processedPasses),
      acceptedEvidenceCount: num(summary.passRunner?.renderReviewAcceptedEvidenceCount),
      durableCandidateCount: num(summary.crossRunQuality?.durableCandidateCount),
      blockedRecordCount: num(summary.crossRunQuality?.blockedRecordCount),
      goalStatuses: arr(controllerState?.goalStatuses).map((goal) => ({
        goalId: str(goal.goalId),
        evidenceStatus: str(goal.evidenceStatus),
        durableCandidateCount: num(goal.durableCandidateCount),
        blockedPromisingCount: num(goal.blockedPromisingCount),
        blockers: arr(goal.blockers).map(str).filter(Boolean)
      }))
    };
    iterations.push(iteration);
    if (shouldAdvanceLatestRun(summary)) currentLatestRunRoot = resolvePath(summary.loopRoot);
    currentPreviousStatePath = resolvePath(summary.controllerStateRef);

    const reason = stopReasonForSummary(summary, index, maxLoops);
    const partial = {
      artifactType: "sequencing_quality_unattended_run_summary_v1",
      artifactVersion: 1,
      generatedAt: new Date().toISOString(),
      status: reason && reason !== "max_loops_reached" ? "stopped" : index >= maxLoops ? "stopped" : "running",
      stopReason: reason || "",
      outRoot: root,
      latestRunRoot: currentLatestRunRoot,
      previousStateRef: currentPreviousStatePath,
      iterationCount: iterations.length,
      iterations
    };
    writeJson(resolvedSummaryPath, partial);
    if (reason) {
      stopReason = reason;
      break;
    }
  }

  const finalSummary = {
    artifactType: "sequencing_quality_unattended_run_summary_v1",
    artifactVersion: 1,
    generatedAt: new Date().toISOString(),
    status: "stopped",
    stopReason,
    outRoot: root,
    latestRunRoot: currentLatestRunRoot,
    previousStateRef: currentPreviousStatePath,
    iterationCount: iterations.length,
    iterations,
    recommendedNextCurriculumExpansion: stopReason === "controller_idle"
      ? [
        "larger effect/model coverage matrix",
        "stronger video-level aesthetic scoring",
        "richer creative revision variants"
      ]
      : []
  };
  writeJson(resolvedSummaryPath, finalSummary);
  return finalSummary;
}

function parseArgs(argv = []) {
  const args = {
    latestRunRoot: "",
    previousStatePath: "",
    outRoot: DEFAULT_OUT_ROOT,
    modelCatalogPath: DEFAULT_MODEL_CATALOG,
    runType: "overnight",
    maxLoops: 10,
    maxQueue: 25,
    maxPasses: 5,
    applyRender: true,
    endpoint: DEFAULT_ENDPOINT,
    summaryPath: ""
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = str(argv[index]);
    if (arg === "--latest-run-root") args.latestRunRoot = argv[++index];
    else if (arg === "--previous-state") args.previousStatePath = argv[++index];
    else if (arg === "--out-root") args.outRoot = argv[++index];
    else if (arg === "--model-catalog") args.modelCatalogPath = argv[++index];
    else if (arg === "--run-type") args.runType = argv[++index];
    else if (arg === "--max-loops") args.maxLoops = Number(argv[++index]);
    else if (arg === "--max-queue") args.maxQueue = Number(argv[++index]);
    else if (arg === "--max-passes") args.maxPasses = Number(argv[++index]);
    else if (arg === "--endpoint") args.endpoint = argv[++index];
    else if (arg === "--summary") args.summaryPath = argv[++index];
    else if (arg === "--scaffold-only") args.applyRender = false;
    else if (arg === "--help") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return `Usage:
  node scripts/sequencer-render-training/tooling/run-sequencing-quality-unattended.mjs \\
    --latest-run-root /tmp/xld-quality-controller-loop-live-music-000002 \\
    --previous-state /tmp/xld-quality-controller-after-music-000002.json \\
    --model-catalog /tmp/xld-vendor-fixture-model-catalog.json \\
    --max-loops 20 \\
    --max-passes 5
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(usage());
    return;
  }
  const summary = await runSequencingQualityUnattended(args);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
