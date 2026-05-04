#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildSequencingQualityControllerState } from "./run-sequencing-quality-controller.mjs";
import { buildLayerCompositionTrainingPlan } from "./build-layer-composition-training-plan.mjs";
import { buildLayerCompositionExecutionScaffold } from "./run-layer-composition-execution-scaffold.mjs";
import { runLayerCompositionPasses } from "./run-layer-composition-pass-runner.mjs";
import { buildLayerCompositionQualityTrend } from "./build-layer-composition-quality-trend.mjs";
import { buildLayerCompositionQualityRecords } from "./build-layer-composition-quality-records.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const DEFAULT_MODEL_CATALOG = "scripts/sequencer-render-training/catalog/generic-layout-model-catalog.json";
const DEFAULT_CURRICULUM = "scripts/sequencer-render-training/catalog/sequencing-quality-curriculum-v1.json";
const DEFAULT_OUT_ROOT = "var/logs/sequencing-quality-controller";
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

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function resolvePath(filePath = "") {
  const value = str(filePath);
  if (!value) return "";
  return path.isAbsolute(value) ? value : path.resolve(REPO_ROOT, value);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function summarizePlan(plan = {}) {
  return {
    runId: str(plan.runId),
    runType: str(plan.runType),
    experimentCount: arr(plan.experiments).length,
    passCount: arr(plan.experiments).reduce((total, experiment) => total + arr(experiment.passes).length, 0),
    controllerSelection: plan.curriculum?.controllerSelection || null
  };
}

function previousCrossRunRoots(latestRunRoot = "") {
  const latest = resolvePath(latestRunRoot);
  if (!latest) return [];
  const recordsPath = path.join(latest, "cross-run-quality-records.json");
  if (!fs.existsSync(recordsPath)) return [latest];
  const records = readJson(recordsPath);
  return [...new Set([...arr(records.sourceRunRoots).map(resolvePath), latest].filter(Boolean))];
}

function buildCrossRunQualityArtifacts({ latestRunRoot = "", loopRoot = "", deps = {} } = {}) {
  const roots = [...new Set([...previousCrossRunRoots(latestRunRoot), resolvePath(loopRoot)].filter(Boolean))];
  if (!roots.length) return null;
  const trendPath = path.join(resolvePath(loopRoot), "cross-run-quality-trend.json");
  const recordsPath = path.join(resolvePath(loopRoot), "cross-run-quality-records.json");
  const trend = (deps.buildQualityTrend || buildLayerCompositionQualityTrend)({
    runRoots: roots,
    outPath: trendPath
  });
  const records = (deps.buildQualityRecords || buildLayerCompositionQualityRecords)({
    qualityTrend: trend,
    qualityTrendPath: trendPath,
    outPath: recordsPath
  });
  return {
    trendRef: trendPath,
    recordsRef: recordsPath,
    runRootCount: roots.length,
    recordCount: Number(records.recordCount) || 0,
    durableCandidateCount: Number(records.durableCandidateCount) || 0,
    blockedRecordCount: Number(records.blockedRecordCount) || 0
  };
}

function nextLoopDir(outRoot = "", loopIndex = 1) {
  return path.join(resolvePath(outRoot || DEFAULT_OUT_ROOT), `loop-${String(loopIndex).padStart(6, "0")}`);
}

export async function runSequencingQualityLoop({
  latestRunRoot = "",
  outRoot = DEFAULT_OUT_ROOT,
  loopRoot = "",
  previousStatePath = "",
  curriculumPath = DEFAULT_CURRICULUM,
  modelCatalogPath = DEFAULT_MODEL_CATALOG,
  runType = "overnight",
  runId = "",
  maxQueue = 25,
  maxPasses = 1,
  applyRender = false,
  renderReviewQuality = true,
  endpoint = DEFAULT_ENDPOINT,
  deps = {}
} = {}) {
  const controllerState = buildSequencingQualityControllerState({
    curriculumPath,
    latestRunRoot,
    previousStatePath,
    maxQueue
  });
  const root = resolvePath(loopRoot) || nextLoopDir(outRoot, controllerState.loopIndex);
  fs.mkdirSync(root, { recursive: true });

  const controllerStatePath = path.join(root, "controller-state.json");
  writeJson(controllerStatePath, controllerState);

  const summaryBase = {
    artifactType: "sequencing_quality_loop_summary_v1",
    artifactVersion: 1,
    generatedAt: new Date().toISOString(),
    loopIndex: controllerState.loopIndex,
    loopRoot: root,
    latestRunRoot: resolvePath(latestRunRoot),
    controllerStateRef: controllerStatePath,
    controllerDecision: controllerState.controllerDecision,
    nextQueueCount: arr(controllerState.nextQueue).length
  };

  if (!arr(controllerState.nextQueue).length) {
    const summary = {
      ...summaryBase,
      status: "blocked_no_controller_queue",
      nextStep: controllerState.controllerDecision?.nextAction === "await_evidence"
        ? "Provide latest compact evidence from a completed quality run."
        : "Review curriculum/controller state before creating the next plan."
    };
    writeJson(path.join(root, "loop-summary.json"), summary);
    return summary;
  }

  const modelCatalog = readJson(resolvePath(modelCatalogPath));
  const plan = buildLayerCompositionTrainingPlan({
    modelCatalog,
    runId: runId || `sequencing-quality-loop-${stamp()}`,
    runType,
    controllerState
  });
  const planPath = path.join(root, "training-plan.json");
  writeJson(planPath, plan);

  const scaffold = (deps.buildScaffold || buildLayerCompositionExecutionScaffold)({
    plan,
    planPath,
    runRoot: root,
    mode: "controller_loop"
  });
  const scaffoldPath = path.join(root, "execution-scaffold-result.json");
  writeJson(scaffoldPath, scaffold);
  if (!scaffold.ok) {
    const summary = {
      ...summaryBase,
      status: "scaffold_failed",
      trainingPlanRef: planPath,
      scaffoldRef: scaffoldPath,
      plan: summarizePlan(plan),
      validationErrors: scaffold.validationErrors || []
    };
    writeJson(path.join(root, "loop-summary.json"), summary);
    return summary;
  }

  let passRunnerSummary = null;
  let crossRunQuality = null;
  if (applyRender) {
    passRunnerSummary = await (deps.runPasses || runLayerCompositionPasses)({
      runRoot: root,
      endpoint,
      maxPasses,
      renderReviewQuality
    });
    crossRunQuality = buildCrossRunQualityArtifacts({ latestRunRoot, loopRoot: root, deps });
  }

  const summary = {
    ...summaryBase,
    status: applyRender ? "executed" : "scaffolded",
    trainingPlanRef: planPath,
    scaffoldRef: scaffoldPath,
    plan: summarizePlan(plan),
    scaffold: {
      status: scaffold.status,
      passCount: num(scaffold.passCount),
      appendedCheckpointCount: num(scaffold.appendedCheckpointCount)
    },
    passRunnerSummaryRef: applyRender ? path.join(root, "pass-runner-summary.json") : "",
    passRunner: passRunnerSummary ? {
      processedPasses: num(passRunnerSummary.processedPasses),
      stopStatus: str(passRunnerSummary.stopStatus),
      stopReason: str(passRunnerSummary.stopReason),
      renderReviewAcceptedEvidenceCount: num(passRunnerSummary.renderReviewAcceptedEvidenceCount)
    } : null,
    crossRunQuality,
    nextStep: applyRender
      ? "Build cross-run trend/records from this loop, promote eligible priors, clean up, then run the controller again."
      : "Review scaffolded checkpoints, then rerun with --apply-render for a small live controller-driven loop."
  };
  writeJson(path.join(root, "loop-summary.json"), summary);
  return summary;
}

function parseArgs(argv = []) {
  const args = {
    latestRunRoot: "",
    outRoot: DEFAULT_OUT_ROOT,
    loopRoot: "",
    previousStatePath: "",
    curriculumPath: DEFAULT_CURRICULUM,
    modelCatalogPath: DEFAULT_MODEL_CATALOG,
    runType: "overnight",
    runId: "",
    maxQueue: 25,
    maxPasses: 1,
    applyRender: false,
    renderReviewQuality: true,
    endpoint: DEFAULT_ENDPOINT
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = str(argv[index]);
    if (arg === "--latest-run-root") args.latestRunRoot = argv[++index];
    else if (arg === "--out-root") args.outRoot = argv[++index];
    else if (arg === "--loop-root") args.loopRoot = argv[++index];
    else if (arg === "--previous-state") args.previousStatePath = argv[++index];
    else if (arg === "--curriculum") args.curriculumPath = argv[++index];
    else if (arg === "--model-catalog") args.modelCatalogPath = argv[++index];
    else if (arg === "--run-type") args.runType = argv[++index];
    else if (arg === "--run-id") args.runId = argv[++index];
    else if (arg === "--max-queue") args.maxQueue = Number(argv[++index]);
    else if (arg === "--max-passes") args.maxPasses = Number(argv[++index]);
    else if (arg === "--endpoint") args.endpoint = argv[++index];
    else if (arg === "--apply-render") args.applyRender = true;
    else if (arg === "--no-render-review-quality") args.renderReviewQuality = false;
    else if (arg === "--help") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return `Usage:
  node scripts/sequencer-render-training/tooling/run-sequencing-quality-loop.mjs \\
    --latest-run-root /tmp/xld-layer-composition-quality-long-YYYYMMDDTHHMMSSZ \\
    --loop-root /tmp/xld-quality-controller-loop-000001

Default mode is scaffold-only. Add --apply-render --max-passes 1 for a small live loop.
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(usage());
    return;
  }
  const summary = await runSequencingQualityLoop(args);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch((error) => {
    console.error(error?.stack || String(error));
    process.exit(1);
  });
}
