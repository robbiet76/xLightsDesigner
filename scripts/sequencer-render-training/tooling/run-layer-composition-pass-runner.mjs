import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { runLayerCompositionOwnedPass } from "./run-layer-composition-owned-pass.mjs";
import { appendLayerCompositionAdaptiveRefill } from "./build-layer-composition-adaptive-refill.mjs";
import { buildLayerCompositionDeltas } from "./build-layer-composition-deltas.mjs";
import { buildLayerCompositionPriors } from "./build-layer-composition-priors.mjs";
import {
  applyLayerCompositionRetentionCleanup,
  planLayerCompositionRetentionCleanup
} from "./apply-layer-composition-retention.mjs";

const DEFAULT_GEOMETRY = "scripts/sequencer-render-training/proofs/preview-scene-geometry-render-training-live.json";
const DEFAULT_FRAME_OFFSETS = "0,4,8,16,32,48,64,78";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function str(value = "") {
  return String(value || "").trim();
}

function passWindow(passExecution = {}) {
  const effects = arr(passExecution?.ownedBatchPayload?.effects);
  const marks = arr(passExecution?.ownedBatchPayload?.marks);
  const timingRows = effects.length ? effects : marks;
  const starts = timingRows.map((row) => Number(row?.startMs)).filter(Number.isFinite);
  const ends = timingRows.map((row) => Number(row?.endMs)).filter(Number.isFinite);
  if (!starts.length || !ends.length) return { startMs: 1000, endMs: 5000 };
  return {
    startMs: Math.min(...starts),
    endMs: Math.max(...ends)
  };
}

function fileSize(filePath) {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
}

function safeSlug(value = "") {
  return str(value).replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 96) || "unnamed";
}

function stageSequenceBaseName(plan = {}, passExecution = {}) {
  return [
    "xld-layer-composition",
    safeSlug(plan.runId || passExecution.runId),
    safeSlug(passExecution.experimentId),
    safeSlug(passExecution.passId)
  ].filter(Boolean).join("__");
}

function copyShowRootFiles(sourceShowDir = "", targetShowDir = "") {
  for (const fileName of ["xlights_rgbeffects.xml", "xlights_networks.xml", "xlights_keybindings.xml", "xlights_effectpresets.json"]) {
    const source = path.join(sourceShowDir, fileName);
    if (fs.existsSync(source)) {
      fs.copyFileSync(source, path.join(targetShowDir, fileName));
    }
  }
}

function resolvedTrainingShowDir(plan = {}) {
  const canonicalShowDir = str(plan?.trainingDisplay?.showDir);
  const stagingRoot = str(process.env.TRAINING_API_STAGING_ROOT);
  if (!stagingRoot) return canonicalShowDir;
  if (!canonicalShowDir) throw new Error("trainingDisplay.showDir is required when TRAINING_API_STAGING_ROOT is set");
  fs.mkdirSync(stagingRoot, { recursive: true });
  copyShowRootFiles(canonicalShowDir, stagingRoot);
  return stagingRoot;
}

function copyFixtureSequence(plan = {}, passExecution = {}) {
  const source = str(plan?.trainingDisplay?.fixtureSequencePath);
  if (!source) throw new Error("trainingDisplay.fixtureSequencePath is required");
  if (!fs.existsSync(source)) throw new Error(`Fixture sequence not found: ${source}`);
  const showDir = resolvedTrainingShowDir(plan);
  if (!showDir) throw new Error("trainingDisplay.showDir is required");
  fs.mkdirSync(showDir, { recursive: true });
  const target = path.join(showDir, `${stageSequenceBaseName(plan, passExecution)}.xsq`);
  fs.copyFileSync(source, target);
  const sourceFseq = source.replace(/\.xsq$/i, ".fseq");
  if (fs.existsSync(sourceFseq)) {
    fs.copyFileSync(sourceFseq, target.replace(/\.xsq$/i, ".fseq"));
  }
  return target;
}

function extractObservation({
  fseqPath,
  passExecution,
  passDir,
  geometryPath = DEFAULT_GEOMETRY,
  frameOffsets = DEFAULT_FRAME_OFFSETS,
  execFile = execFileSync
} = {}) {
  const window = passWindow(passExecution);
  const previewWindowPath = path.join(passDir, "preview-window.json");
  const renderObservationPath = path.join(passDir, "render-observation.json");
  const compositionObservationPath = path.join(passDir, "composition-stack-observation.json");
  execFile("python3", [
    "scripts/sequencer-render-training/tooling/reconstruct-preview-scene-window.py",
    "--geometry",
    geometryPath,
    "--fseq",
    fseqPath,
    "--window-start-ms",
    String(window.startMs),
    "--window-end-ms",
    String(window.endMs),
    "--frame-offsets",
    frameOffsets,
    "--out",
    previewWindowPath
  ], { stdio: "pipe" });
  execFile("python3", [
    "scripts/sequencer-render-training/tooling/extract-render-observation.py",
    "--window",
    previewWindowPath,
    "--out",
    renderObservationPath
  ], { stdio: "pipe" });
  const renderObservation = readJson(renderObservationPath);
  const compositionObservation = {
    artifactType: "composition_stack_observation_v1",
    artifactVersion: 1,
    generatedAt: new Date().toISOString(),
    runId: str(passExecution.runId),
    experimentId: str(passExecution.experimentId),
    passId: str(passExecution.passId),
    learningId: str(passExecution.learningId),
    paletteProfile: str(passExecution.paletteProfile),
    passWindow: window,
    renderArtifact: {
      fseqPath,
      previewWindowRef: previewWindowPath,
      renderObservationRef: renderObservationPath,
      sizeBytes: fileSize(fseqPath)
    },
    renderObservation
  };
  writeJson(compositionObservationPath, compositionObservation);
  return {
    window,
    previewWindowPath,
    renderObservationPath,
    compositionObservationPath,
    compositionObservation
  };
}

function appendLedgerArtifacts(ledgerPath, rows = [], patch = {}) {
  const ledger = fs.existsSync(ledgerPath) ? readJson(ledgerPath) : { artifacts: [] };
  ledger.artifacts = [...arr(ledger.artifacts), ...rows];
  if (arr(patch.externalDeleteRoots).length) {
    ledger.externalDeleteRoots = [...new Set([...arr(ledger.externalDeleteRoots), ...arr(patch.externalDeleteRoots).map(str).filter(Boolean)])];
  }
  ledger.updatedAt = new Date().toISOString();
  writeJson(ledgerPath, ledger);
  return ledger;
}

function updateCheckpoint(checkpointPath, patch = {}) {
  const checkpoint = readJson(checkpointPath);
  const next = {
    ...checkpoint,
    ...patch,
    updatedAt: new Date().toISOString()
  };
  writeJson(checkpointPath, next);
  return next;
}

function checkpointStatus(row = {}) {
  try {
    return str(readJson(row.checkpointRef)?.status || row.status);
  } catch {
    return str(row.status);
  }
}

function pendingRows({ bundle, experimentFilter }) {
  return arr(bundle.checkpoints)
    .filter((row) => checkpointStatus(row) === "pending_apply_render")
    .filter((row) => experimentFilter.size === 0 || experimentFilter.has(str(row.experimentId)));
}

function freeDiskGbForPath(targetPath) {
  if (typeof fs.statfsSync !== "function") return null;
  try {
    const stats = fs.statfsSync(targetPath);
    return (Number(stats.bavail) * Number(stats.bsize)) / (1024 ** 3);
  } catch {
    return null;
  }
}

function diskGuardrailStatus({ runRoot, plan, deps = {} } = {}) {
  const guardrails = plan?.retentionPolicy?.diskGuardrails || {};
  if (guardrails.enabled === false) {
    return { status: "disabled", freeDiskGb: null };
  }
  if (plan?.runType === "smoke" && typeof deps.freeDiskGb !== "function") {
    return { status: "smoke_skipped", freeDiskGb: null };
  }
  const freeDiskGb = typeof deps.freeDiskGb === "function"
    ? deps.freeDiskGb(runRoot)
    : freeDiskGbForPath(runRoot);
  if (!Number.isFinite(Number(freeDiskGb))) {
    return { status: "unknown", freeDiskGb: null };
  }
  const stopFreeDiskGb = Number(guardrails.stopFreeDiskGb ?? 10);
  const warningFreeDiskGb = Number(guardrails.warningFreeDiskGb ?? 25);
  if (Number(freeDiskGb) <= stopFreeDiskGb) {
    return {
      status: "stop",
      freeDiskGb: Number(freeDiskGb),
      stopFreeDiskGb,
      warningFreeDiskGb,
      reason: "free_disk_below_stop_guardrail"
    };
  }
  if (Number(freeDiskGb) <= warningFreeDiskGb) {
    return {
      status: "warning",
      freeDiskGb: Number(freeDiskGb),
      stopFreeDiskGb,
      warningFreeDiskGb,
      reason: "free_disk_below_warning_guardrail"
    };
  }
  return {
    status: "ok",
    freeDiskGb: Number(freeDiskGb),
    stopFreeDiskGb,
    warningFreeDiskGb
  };
}

function summarizeLearningCheckpoint({
  runRoot,
  ledgerPath,
  label = "checkpoint",
  applyRetention = true
} = {}) {
  const checkpointRoot = path.join(runRoot, "learning-checkpoints", safeSlug(label));
  const deltaSummaryPath = path.join(checkpointRoot, "layer-composition-delta-summary.json");
  const priorsPath = path.join(checkpointRoot, "layer-composition-priors-staged.json");
  const retentionPath = path.join(checkpointRoot, "retention-cleanup-result.json");
  const deltaSummary = buildLayerCompositionDeltas({ runRoot });
  deltaSummary.sourceDeltaSummaryRef = deltaSummaryPath;
  writeJson(deltaSummaryPath, deltaSummary);
  const priors = buildLayerCompositionPriors({ deltaSummary });
  writeJson(priorsPath, priors);
  appendLedgerArtifacts(ledgerPath, [
    {
      path: deltaSummaryPath,
      artifactClass: "layer_delta_observation",
      summarized: true,
      retain: true
    },
    {
      path: priorsPath,
      artifactClass: "prior_bundle",
      summarized: true,
      retain: true
    }
  ]);
  const ledger = readJson(ledgerPath);
  const retentionPlan = planLayerCompositionRetentionCleanup({
    runRoot,
    ledger,
    retentionPolicy: ledger.retentionPolicy
  });
  const retentionResult = applyRetention
    ? applyLayerCompositionRetentionCleanup(retentionPlan)
    : retentionPlan;
  writeJson(retentionPath, retentionResult);
  appendLedgerArtifacts(ledgerPath, [
    {
      path: retentionPath,
      artifactClass: "run_summary",
      summarized: true,
      retain: true
    }
  ]);
  return {
    artifactType: "layer_composition_learning_checkpoint_summary_v1",
    artifactVersion: 1,
    generatedAt: new Date().toISOString(),
    label,
    deltaSummaryRef: deltaSummaryPath,
    priorsRef: priorsPath,
    retentionResultRef: retentionPath,
    experimentCount: deltaSummary.experimentCount,
    completedObservationCount: deltaSummary.completedObservationCount,
    priorCount: priors.priorCount,
    cleanupDeletedCount: retentionResult.deletedCount ?? 0,
    cleanupDeletedBytes: retentionResult.deletedBytes ?? 0
  };
}

export async function runLayerCompositionPasses({
  runRoot,
  endpoint,
  maxPasses = 1,
  maxRuntimeMinutes = null,
  untilRuntimeBudget = false,
  geometryPath = DEFAULT_GEOMETRY,
  frameOffsets = DEFAULT_FRAME_OFFSETS,
  experimentIds = [],
  dryRun = false,
  deps = {}
} = {}) {
  const root = path.resolve(str(runRoot));
  if (!root) throw new Error("runRoot is required");
  const planPath = path.join(root, "training-plan.json");
  const checkpointsPath = path.join(root, "checkpoints.json");
  const ledgerPath = path.join(root, "retention-ledger.json");
  const plan = readJson(planPath);
  const experimentFilter = new Set(arr(experimentIds).map(str).filter(Boolean));
  const now = deps.now || (() => Date.now());
  const startedAtMs = now();
  const resolvedMaxRuntimeMinutes = maxRuntimeMinutes !== null && maxRuntimeMinutes !== undefined && Number.isFinite(Number(maxRuntimeMinutes))
    ? Number(maxRuntimeMinutes)
    : Number(plan?.runtimeBudget?.maxRuntimeMinutes ?? plan?.maxRuntimeMinutes ?? 0);
  const runtimeDeadlineMs = untilRuntimeBudget && resolvedMaxRuntimeMinutes > 0
    ? startedAtMs + (resolvedMaxRuntimeMinutes * 60 * 1000)
    : null;
  const requestedPassLimit = untilRuntimeBudget ? Number.POSITIVE_INFINITY : Math.max(0, Number(maxPasses) || 0);
  let bundle = readJson(checkpointsPath);
  let pending = pendingRows({ bundle, experimentFilter });
  const results = [];
  let stopStatus = "queue_exhausted";
  let stopReason = "no_pending_passes";
  const refillResults = [];
  const learningCheckpoints = [];
  const diskGuardrailEvents = [];
  let pendingIndex = 0;
  while (true) {
    const diskStatus = diskGuardrailStatus({ runRoot: root, plan, deps });
    if (diskStatus.status === "stop") {
      diskGuardrailEvents.push({
        ...diskStatus,
        checkedAt: new Date().toISOString(),
        phase: "before_pass"
      });
      stopStatus = "disk_guardrail_stop";
      stopReason = diskStatus.reason;
      break;
    }
    if (diskStatus.status === "warning") {
      diskGuardrailEvents.push({
        ...diskStatus,
        checkedAt: new Date().toISOString(),
        phase: "before_pass"
      });
    }
    if (results.length >= requestedPassLimit) {
      stopStatus = "pass_limit_reached";
      stopReason = "requested_max_passes_reached";
      break;
    }
    if (runtimeDeadlineMs !== null && now() >= runtimeDeadlineMs) {
      stopStatus = "runtime_budget_reached";
      stopReason = "max_runtime_minutes_elapsed";
      break;
    }
    if (pendingIndex >= pending.length) {
      if (untilRuntimeBudget && typeof deps.refillPendingPasses === "function") {
        const checkpointSummary = typeof deps.summarizeBeforeRefill === "function"
          ? await deps.summarizeBeforeRefill({
            runRoot: root,
            label: `before_refill_${refillResults.length + 1}`,
            processedPasses: results.length
          })
          : summarizeLearningCheckpoint({
            runRoot: root,
            ledgerPath,
            label: `before_refill_${refillResults.length + 1}`
          });
        learningCheckpoints.push(checkpointSummary);
        const postCleanupDiskStatus = diskGuardrailStatus({ runRoot: root, plan, deps });
        if (postCleanupDiskStatus.status === "stop") {
          diskGuardrailEvents.push({
            ...postCleanupDiskStatus,
            checkedAt: new Date().toISOString(),
            phase: "after_cleanup_before_refill"
          });
          stopStatus = "disk_guardrail_stop";
          stopReason = postCleanupDiskStatus.reason;
          break;
        }
        const refill = await deps.refillPendingPasses({
          runRoot: root,
          plan,
          processedPasses: results.length,
          refillAttempt: refillResults.length + 1,
          experimentIds: [...experimentFilter]
        });
        refillResults.push(refill || { status: "no_refill_result" });
        bundle = readJson(checkpointsPath);
        pending = pendingRows({ bundle, experimentFilter });
        pendingIndex = 0;
        if (pendingIndex < pending.length) continue;
        stopStatus = "queue_exhausted";
        stopReason = str(refill?.stopReason || refill?.status || "refill_returned_no_pending_passes");
        break;
      }
      if (untilRuntimeBudget && experimentFilter.size === 0) {
        const checkpointSummary = typeof deps.summarizeBeforeRefill === "function"
          ? await deps.summarizeBeforeRefill({
            runRoot: root,
            label: `before_refill_${refillResults.length + 1}`,
            processedPasses: results.length
          })
          : summarizeLearningCheckpoint({
            runRoot: root,
            ledgerPath,
            label: `before_refill_${refillResults.length + 1}`
          });
        learningCheckpoints.push(checkpointSummary);
        const postCleanupDiskStatus = diskGuardrailStatus({ runRoot: root, plan, deps });
        if (postCleanupDiskStatus.status === "stop") {
          diskGuardrailEvents.push({
            ...postCleanupDiskStatus,
            checkedAt: new Date().toISOString(),
            phase: "after_cleanup_before_refill"
          });
          stopStatus = "disk_guardrail_stop";
          stopReason = postCleanupDiskStatus.reason;
          break;
        }
        const refill = appendLayerCompositionAdaptiveRefill({
          runRoot: root,
          plan,
          planPath: planPath,
          refillAttempt: refillResults.length + 1
        });
        refillResults.push(refill || { status: "no_refill_result" });
        bundle = readJson(checkpointsPath);
        pending = pendingRows({ bundle, experimentFilter });
        pendingIndex = 0;
        if (pending.length > 0 && str(refill?.status) === "appended_pending_apply_render") continue;
        stopStatus = "queue_exhausted";
        stopReason = str(refill?.stopReason || refill?.status || "refill_returned_no_pending_passes");
        break;
      }
      stopStatus = "queue_exhausted";
      stopReason = results.length > 0 ? "all_selected_pending_passes_processed" : "no_pending_passes";
      break;
    }
    const row = pending[pendingIndex];
    pendingIndex += 1;
    const passDir = path.dirname(row.checkpointRef);
    const passExecution = readJson(row.passExecutionRef);
    if (dryRun) {
      results.push({
        experimentId: row.experimentId,
        passId: row.passId,
        status: "dry_run_pending_apply_render"
      });
      continue;
    }
    const sequencePath = copyFixtureSequence(plan, passExecution);
    const stagedBasePath = sequencePath.replace(/\.xsq$/i, "");
    const stagedFseqPath = `${stagedBasePath}.fseq`;
    const ownedResultPath = path.join(passDir, "owned-pass-result.json");
    try {
      const ownedResult = await (deps.runOwnedPass || runLayerCompositionOwnedPass)({
        endpoint,
        sequencePath,
        passExecution,
        deps: deps.ownedDeps || {}
      });
      writeJson(ownedResultPath, ownedResult);
      const observation = (deps.extractObservation || extractObservation)({
        fseqPath: ownedResult.fseqPath,
        passExecution,
        passDir,
        geometryPath,
        frameOffsets,
        execFile: deps.execFile || execFileSync
      });
      updateCheckpoint(row.checkpointRef, {
        status: "completed",
        workingSequenceRef: sequencePath,
        ownedPassResultRef: ownedResultPath,
        observationRef: observation.compositionObservationPath,
        renderObservationRef: observation.renderObservationPath,
        previewWindowRef: observation.previewWindowPath,
        rawArtifactsSummarized: true,
        cleanupApplied: false
      });
      appendLedgerArtifacts(ledgerPath, [
        {
          path: sequencePath,
          artifactClass: "temporary_sequence_copy",
          summarized: true,
          purgeEligible: true,
          allowExternalDelete: true
        },
        {
          path: stagedFseqPath,
          artifactClass: "temporary_sequence_copy",
          summarized: true,
          purgeEligible: true,
          allowExternalDelete: true
        },
        {
          path: ownedResult.fseqPath,
          artifactClass: "raw_fseq",
          summarized: true,
          purgeEligible: true,
          allowExternalDelete: true
        },
        {
          path: ownedResultPath,
          artifactClass: "metric_summary",
          summarized: true,
          retain: true
        },
        {
          path: observation.compositionObservationPath,
          artifactClass: "composition_stack_observation",
          summarized: true,
          retain: true
        },
        {
          path: observation.renderObservationPath,
          artifactClass: "composition_stack_observation",
          summarized: true,
          retain: true
        },
        {
          path: observation.previewWindowPath,
          artifactClass: "small_preview",
          summarized: true,
          purgeEligible: true
        }
      ], {
        externalDeleteRoots: [path.dirname(sequencePath)]
      });
      results.push({ experimentId: row.experimentId, passId: row.passId, status: "completed" });
    } catch (error) {
      stopStatus = "failed";
      stopReason = "pass_failed";
      const failurePath = path.join(passDir, "failure-summary.json");
      writeJson(failurePath, {
        artifactType: "layer_composition_pass_failure_v1",
        artifactVersion: 1,
        generatedAt: new Date().toISOString(),
        experimentId: row.experimentId,
        passId: row.passId,
        error: str(error?.stack || error?.message || error)
      });
      updateCheckpoint(row.checkpointRef, {
        status: "failed",
        workingSequenceRef: sequencePath,
        failureSummaryRef: failurePath,
        rawArtifactsSummarized: false,
        cleanupApplied: false
      });
      appendLedgerArtifacts(ledgerPath, [
        {
          path: sequencePath,
          artifactClass: "temporary_sequence_copy",
          summarized: false,
          purgeEligible: true,
          allowExternalDelete: true,
          failureUnreviewed: true
        },
        {
          path: stagedFseqPath,
          artifactClass: "temporary_sequence_copy",
          summarized: false,
          purgeEligible: true,
          allowExternalDelete: true,
          failureUnreviewed: true
        },
        {
          path: failurePath,
          artifactClass: "failure_summary",
          summarized: true,
          retain: true,
          failureUnreviewed: true
        }
      ], {
        externalDeleteRoots: [path.dirname(sequencePath)]
      });
      results.push({ experimentId: row.experimentId, passId: row.passId, status: "failed", error: str(error?.message || error) });
      break;
    }
  }
  const elapsedRuntimeMinutes = Number(((now() - startedAtMs) / 60000).toFixed(3));
  return {
    artifactType: "layer_composition_pass_runner_summary_v1",
    artifactVersion: 1,
    generatedAt: new Date().toISOString(),
    runRoot: root,
    dryRun,
    experimentIds: [...experimentFilter],
    untilRuntimeBudget,
    maxRuntimeMinutes: runtimeDeadlineMs === null ? null : resolvedMaxRuntimeMinutes,
    requestedPasses: untilRuntimeBudget ? null : maxPasses,
    processedPasses: results.length,
    pendingPassesSelected: pending.length,
    elapsedRuntimeMinutes,
    stopStatus,
    stopReason,
    refillAttempts: refillResults.length,
    refillResults,
    learningCheckpointCount: learningCheckpoints.length,
    learningCheckpoints,
    diskGuardrailEventCount: diskGuardrailEvents.length,
    diskGuardrailEvents,
    results
  };
}

function parseArgs(argv) {
  const args = {
    runRoot: "",
    endpoint: "http://127.0.0.1:49915/xlightsdesigner/api",
    maxPasses: 1,
    maxRuntimeMinutes: null,
    untilRuntimeBudget: false,
    geometryPath: DEFAULT_GEOMETRY,
    frameOffsets: DEFAULT_FRAME_OFFSETS,
    experimentIds: [],
    dryRun: false,
    outPath: ""
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--run-root") args.runRoot = argv[++index];
    else if (arg === "--endpoint") args.endpoint = argv[++index];
    else if (arg === "--max-passes") args.maxPasses = Number(argv[++index]);
    else if (arg === "--max-runtime-minutes") args.maxRuntimeMinutes = Number(argv[++index]);
    else if (arg === "--until-runtime-budget") args.untilRuntimeBudget = true;
    else if (arg === "--geometry") args.geometryPath = argv[++index];
    else if (arg === "--frame-offsets") args.frameOffsets = argv[++index];
    else if (arg === "--experiment-id") args.experimentIds.push(argv[++index]);
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--out") args.outPath = argv[++index];
    else if (arg === "--help") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return `Usage:
  node scripts/sequencer-render-training/tooling/run-layer-composition-pass-runner.mjs --run-root <run-dir> [--max-passes 1] [--until-runtime-budget] [--max-runtime-minutes <n>] [--experiment-id <id>]
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(usage());
    return;
  }
  const summary = await runLayerCompositionPasses(args);
  if (args.outPath) writeJson(args.outPath, summary);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch((error) => {
    console.error(error?.stack || String(error));
    process.exit(1);
  });
}
