import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { runLayerCompositionOwnedPass } from "./run-layer-composition-owned-pass.mjs";
import { appendLayerCompositionAdaptiveRefill } from "./build-layer-composition-adaptive-refill.mjs";
import { buildLayerCompositionDeltas } from "./build-layer-composition-deltas.mjs";
import { buildLayerCompositionPriors } from "./build-layer-composition-priors.mjs";
import { buildLayerCompositionQualityRecords } from "./build-layer-composition-quality-records.mjs";
import { buildLayerCompositionQualityTrend } from "./build-layer-composition-quality-trend.mjs";
import { buildRenderReviewFromFseq } from "../../designer-training/build-render-review-from-fseq.mjs";
import {
  applyLayerCompositionRetentionCleanup,
  planLayerCompositionRetentionCleanup
} from "./apply-layer-composition-retention.mjs";

const DEFAULT_GEOMETRY = process.env.XLD_RENDER_TRAINING_GEOMETRY || "/tmp/xld-render-training-proofs/preview-scene-geometry-render-training-live.json";
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

function unique(values = []) {
  return [...new Set(arr(values).map(str).filter(Boolean))];
}

function average(values = []) {
  const rows = arr(values).map((value) => Number(value)).filter(Number.isFinite);
  return rows.length ? rows.reduce((sum, value) => sum + value, 0) / rows.length : 0;
}

function round6(value) {
  return Math.round(Number(value || 0) * 1_000_000) / 1_000_000;
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

async function currentShowDirectory(endpoint, deps = {}) {
  const response = await fetch(`${str(endpoint)}/media/current`, {
    method: "GET",
    headers: { Accept: "application/json" }
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON from GET /media/current: ${text}`);
  }
  if (!response.ok || json?.ok === false) {
    throw new Error(`GET /media/current failed (${response.status}): ${JSON.stringify(json)}`);
  }
  return str(json?.data?.showDirectory);
}

async function assertTrainingShowDirectory({ endpoint, plan } = {}) {
  const expectedShowDir = path.resolve(str(resolvedTrainingShowDir(plan)));
  if (!expectedShowDir) throw new Error("trainingDisplay.showDir is required");
  const actualShowDir = path.resolve(str(await currentShowDirectory(endpoint)));
  if (actualShowDir !== expectedShowDir) {
    throw new Error(`xLights is open to ${actualShowDir}; expected training show ${expectedShowDir}.`);
  }
  return { expectedShowDir, actualShowDir };
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

function buildRenderReviewQuality({
  fseqPath,
  passExecution,
  passDir,
  geometryPath = DEFAULT_GEOMETRY,
  frameOffsets = DEFAULT_FRAME_OFFSETS,
  buildFseqReview = buildRenderReviewFromFseq
} = {}) {
  const window = passWindow(passExecution);
  const outDir = path.join(passDir, "render-review-quality");
  const effects = arr(passExecution?.ownedBatchPayload?.effects);
  const effectNames = unique(effects.map((effect) => effect?.effectName));
  const targets = unique(effects.map((effect) => effect?.element));
  const sectionId = str(passExecution.passId || "layer-composition-pass");
  const run = buildFseqReview({
    geometryPath,
    fseqPath,
    outDir,
    windowStartMs: window.startMs,
    windowEndMs: window.endMs,
    frameOffsets,
    intent: {
      effectName: effectNames[0] || "",
      targetHierarchy: {
        leadTargets: targets.slice(0, 1),
        supportTargets: targets.slice(1)
      },
      renderPlan: {
        plannedEffectCount: effects.length,
        plannedTargetCount: targets.length,
        effectNames,
        targets
      },
      section: {
        id: sectionId,
        label: sectionId,
        startMs: window.startMs,
        endMs: window.endMs
      },
      rawSummary: [
        effectNames.length ? `effects:${effectNames.join(",")}` : "",
        targets.length ? `targets:${targets.length}` : ""
      ].filter(Boolean).join(" ")
    }
  });
  const review = readJson(run.renderReviewPath);
  const summaryPath = path.join(outDir, "render-review-quality-summary.json");
  const summary = {
    artifactType: "layer_composition_render_review_quality_v1",
    artifactVersion: 1,
    generatedAt: new Date().toISOString(),
    runId: str(passExecution.runId),
    experimentId: str(passExecution.experimentId),
    passId: str(passExecution.passId),
    learningId: str(passExecution.learningId),
    passWindow: window,
    fseqPath,
    renderReviewRunRef: path.join(outDir, "fseq-render-review-run.json"),
    renderReviewRef: run.renderReviewPath,
    previewWindowRef: run.previewWindowPath,
    previewMediaRef: run.previewMediaPath,
    previewMediaFramesRef: str(run.mediaExtraction?.framesDir),
    frameFeaturesRef: run.frameFeaturesPath,
    contactSheetRef: run.contactSheetPath,
    decision: str(review?.critique?.decision || run.decision),
    overallQuality: Number(review?.qualityScores?.overallQuality ?? run.overallQuality ?? 0),
    evidenceQualification: review?.evidenceQualification || {},
    evidenceEligible: Boolean(review?.evidenceQualification?.eligible),
    measurementStatus: str(review?.evidenceQualification?.status)
  };
  writeJson(summaryPath, summary);
  return {
    ...summary,
    summaryPath
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

function refreshCheckpointBundle(root, plan = {}) {
  const checkpointsPath = path.join(root, "checkpoints.json");
  const bundle = readJson(checkpointsPath);
  const dedupedRows = [...new Map(arr(bundle.checkpoints)
    .map((row) => [str(row.checkpointRef), row]))
    .values()];
  const checkpoints = dedupedRows.map((row) => {
    const checkpoint = readJson(row.checkpointRef);
    return {
      ...row,
      status: str(checkpoint.status || row.status),
      observationRef: str(checkpoint.observationRef || ""),
      renderObservationRef: str(checkpoint.renderObservationRef || ""),
      ownedPassResultRef: str(checkpoint.ownedPassResultRef || ""),
      renderReviewQualityRef: str(checkpoint.renderReviewQualityRef || ""),
      renderReviewRef: str(checkpoint.renderReviewRef || ""),
      renderReviewDecision: str(checkpoint.renderReviewDecision || ""),
      renderReviewEvidenceEligible: Boolean(checkpoint.renderReviewEvidenceEligible),
      renderReviewMeasurementStatus: str(checkpoint.renderReviewMeasurementStatus || ""),
      failureSummaryRef: str(checkpoint.failureSummaryRef || "")
    };
  });
  const refreshed = {
    ...bundle,
    updatedAt: new Date().toISOString(),
    runId: str(bundle.runId || plan.runId),
    runRoot: root,
    checkpointCount: checkpoints.length,
    appendedCheckpointCount: checkpoints.filter((row) => str(row.experimentId).includes("-refill-")).length,
    checkpoints
  };
  writeJson(checkpointsPath, refreshed);
  return refreshed;
}

function writeExecutionSummary({
  root,
  plan = {},
  mode = "pass_runner",
  bundle,
  refillResults = [],
  learningCheckpoints = [],
  stopStatus = "",
  stopReason = ""
} = {}) {
  const summaryPath = path.join(root, "execution-summary.json");
  const checkpoints = arr(bundle?.checkpoints);
  const completedPassCount = checkpoints.filter((row) => str(row.status) === "completed").length;
  const failedPassCount = checkpoints.filter((row) => str(row.status) === "failed").length;
  const pendingApplyRenderCount = checkpoints.filter((row) => str(row.status) === "pending_apply_render").length;
  const observationCount = checkpoints.filter((row) => str(row.observationRef)).length;
  const renderReviewQualityCount = checkpoints.filter((row) => str(row.renderReviewQualityRef)).length;
  const summary = {
    artifactType: "layer_composition_execution_summary_v1",
    artifactVersion: 1,
    generatedAt: new Date().toISOString(),
    runId: str(plan.runId || bundle?.runId),
    runType: str(plan.runType),
    runRoot: root,
    planRef: path.join(root, "training-plan.json"),
    mode,
    status: failedPassCount > 0
      ? "failed"
      : pendingApplyRenderCount > 0
        ? "partially_completed_pending_apply_render"
        : "completed",
    experimentCount: arr(plan.experiments).length,
    passCount: checkpoints.length,
    appendedPassCount: checkpoints.filter((row) => str(row.experimentId).includes("-refill-")).length,
    pendingApplyRenderCount,
    completedPassCount,
    failedPassCount,
    observationCount,
    renderReviewQualityCount,
    deltaCount: learningCheckpoints.length,
    retentionLedgerRef: path.join(root, "retention-ledger.json"),
    checkpointBundleRef: path.join(root, "checkpoints.json"),
    lastStopStatus: stopStatus,
    lastStopReason: stopReason,
    refillAttemptCount: refillResults.length,
    learningCheckpointCount: learningCheckpoints.length,
    nextStep: pendingApplyRenderCount > 0
      ? "Resume pending passes or reconcile unfinished apply/render work."
      : failedPassCount > 0
        ? "Inspect failed pass summaries before continuing."
        : "Promote or consume staged priors after review."
  };
  writeJson(summaryPath, summary);
  return summary;
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
  const qualityRecordsPath = path.join(runRoot, "layer-composition-quality-records.json");
  const qualityRecords = fs.existsSync(qualityRecordsPath) ? readJson(qualityRecordsPath) : null;
  const priors = buildLayerCompositionPriors({ deltaSummary, qualityRecords });
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

function applyEndOfLoopRetentionCleanup({ runRoot, ledgerPath } = {}) {
  if (!fs.existsSync(ledgerPath)) return null;
  const retentionPath = path.join(runRoot, "final-retention-cleanup-result.json");
  const ledger = readJson(ledgerPath);
  const retentionPlan = planLayerCompositionRetentionCleanup({
    runRoot,
    ledger,
    retentionPolicy: ledger.retentionPolicy
  });
  const retentionResult = applyLayerCompositionRetentionCleanup(retentionPlan);
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
    artifactType: "layer_composition_end_of_loop_retention_summary_v1",
    artifactVersion: 1,
    resultRef: retentionPath,
    deletedCount: retentionResult.deletedCount ?? 0,
    deletedBytes: retentionResult.deletedBytes ?? 0,
    deletionCount: retentionResult.deletionCount ?? 0,
    deletionBytes: retentionResult.deletionBytes ?? 0
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
  renderReviewQuality = false,
  dryRun = false,
  deps = {}
} = {}) {
  const root = path.resolve(str(runRoot));
  if (!root) throw new Error("runRoot is required");
  const planPath = path.join(root, "training-plan.json");
  const checkpointsPath = path.join(root, "checkpoints.json");
  const ledgerPath = path.join(root, "retention-ledger.json");
  const passRunnerSummaryPath = path.join(root, "pass-runner-summary.json");
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
  const buildCurrentSummary = () => {
    const elapsedRuntimeMinutes = Number(((now() - startedAtMs) / 60000).toFixed(3));
    const renderReviewResults = results.filter((result) => str(result.renderReviewQualityRef));
    const eligibleRenderReviewResults = renderReviewResults.filter((result) => result.renderReviewEvidenceEligible);
    const eligibleQualityScores = eligibleRenderReviewResults.map((result) => Number(result.renderReviewOverallQuality)).filter(Number.isFinite);
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
      renderReviewQualityEnabled: Boolean(renderReviewQuality),
      renderReviewQualityCount: renderReviewResults.length,
      renderReviewAcceptedCount: renderReviewResults.filter((result) => str(result.renderReviewDecision) === "accept").length,
      renderReviewEvidenceEligibleCount: eligibleRenderReviewResults.length,
      renderReviewObservationOnlyCount: renderReviewResults.filter((result) => str(result.renderReviewMeasurementStatus) === "render_health_observation").length,
      renderReviewAcceptedEvidenceCount: eligibleRenderReviewResults.filter((result) => str(result.renderReviewDecision) === "accept").length,
      renderReviewReviseCount: renderReviewResults.filter((result) => str(result.renderReviewDecision) === "revise").length,
      renderReviewRejectedCount: renderReviewResults.filter((result) => str(result.renderReviewDecision) === "reject").length,
      renderReviewEligibleQualityMean: round6(average(eligibleQualityScores)),
      renderReviewEligibleQualityMin: eligibleQualityScores.length ? round6(Math.min(...eligibleQualityScores)) : 0,
      renderReviewEligibleQualityMax: eligibleQualityScores.length ? round6(Math.max(...eligibleQualityScores)) : 0,
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
  };
  const writeCurrentSummary = ({ includeQualityTrend = false } = {}) => {
    const summary = buildCurrentSummary();
    writeJson(passRunnerSummaryPath, summary);
    if (includeQualityTrend) {
      const qualityTrendPath = path.join(root, "layer-composition-quality-trend.json");
      const qualityRecordsPath = path.join(root, "layer-composition-quality-records.json");
      const qualityTrend = (deps.buildQualityTrend || buildLayerCompositionQualityTrend)({
        runRoots: [root],
        outPath: qualityTrendPath
      });
      const qualityRecords = (deps.buildQualityRecords || buildLayerCompositionQualityRecords)({
        qualityTrend,
        qualityTrendPath,
        outPath: qualityRecordsPath
      });
      summary.renderReviewQualityTrendRef = qualityTrendPath;
      summary.renderReviewQualityTrend = qualityTrend.summary || null;
      summary.renderReviewQualityRecordsRef = qualityRecordsPath;
      summary.renderReviewQualityRecords = {
        recordCount: Number(qualityRecords.recordCount) || 0,
        durableCandidateCount: Number(qualityRecords.durableCandidateCount) || 0,
        blockedRecordCount: Number(qualityRecords.blockedRecordCount) || 0
      };
      writeJson(passRunnerSummaryPath, summary);
      const ledger = fs.existsSync(ledgerPath) ? readJson(ledgerPath) : { artifacts: [] };
      if (!arr(ledger.artifacts).some((row) => str(row.path) === qualityTrendPath)) {
        appendLedgerArtifacts(ledgerPath, [
          {
            path: qualityTrendPath,
            artifactClass: "metric_summary",
            summarized: true,
            retain: true
          }
        ]);
      }
      const nextLedger = fs.existsSync(ledgerPath) ? readJson(ledgerPath) : { artifacts: [] };
      if (!arr(nextLedger.artifacts).some((row) => str(row.path) === qualityRecordsPath)) {
        appendLedgerArtifacts(ledgerPath, [
          {
            path: qualityRecordsPath,
            artifactClass: "prior_bundle",
            summarized: true,
            retain: true
          }
        ]);
      }
    }
    return summary;
  };
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
        bundle = refreshCheckpointBundle(root, plan);
        if (renderReviewQuality) writeCurrentSummary({ includeQualityTrend: true });
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
        bundle = refreshCheckpointBundle(root, plan);
        if (renderReviewQuality) writeCurrentSummary({ includeQualityTrend: true });
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
    try {
      await (deps.assertTrainingShowDir || assertTrainingShowDirectory)({ endpoint, plan, deps: deps.ownedDeps || {} });
    } catch (error) {
      stopStatus = "training_show_mismatch";
      stopReason = str(error?.message || error);
      break;
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
      const renderReviewQualityResult = renderReviewQuality
        ? (deps.buildRenderReviewQuality || buildRenderReviewQuality)({
          fseqPath: ownedResult.fseqPath,
          passExecution,
          passDir,
          geometryPath,
          frameOffsets,
          buildFseqReview: deps.buildFseqReview || buildRenderReviewFromFseq
        })
        : null;
      updateCheckpoint(row.checkpointRef, {
        status: "completed",
        workingSequenceRef: sequencePath,
        ownedPassResultRef: ownedResultPath,
        observationRef: observation.compositionObservationPath,
        renderObservationRef: observation.renderObservationPath,
        previewWindowRef: observation.previewWindowPath,
        renderReviewQualityRef: str(renderReviewQualityResult?.summaryPath),
        renderReviewRef: str(renderReviewQualityResult?.renderReviewRef),
        renderReviewDecision: str(renderReviewQualityResult?.decision),
        renderReviewOverallQuality: Number(renderReviewQualityResult?.overallQuality ?? 0),
        renderReviewEvidenceEligible: Boolean(renderReviewQualityResult?.evidenceEligible),
        renderReviewMeasurementStatus: str(renderReviewQualityResult?.measurementStatus),
        rawArtifactsSummarized: true,
        cleanupApplied: false
      });
      const ledgerRows = [
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
      ];
      if (renderReviewQualityResult) {
        ledgerRows.push(
          {
            path: renderReviewQualityResult.summaryPath,
            artifactClass: "metric_summary",
            summarized: true,
            retain: true
          },
          {
            path: renderReviewQualityResult.renderReviewRef,
            artifactClass: "render_review",
            summarized: true,
            retain: true
          },
          {
            path: renderReviewQualityResult.previewWindowRef,
            artifactClass: "small_preview",
            summarized: true,
            purgeEligible: true
          },
          {
            path: renderReviewQualityResult.previewMediaRef,
            artifactClass: "preview_media",
            summarized: true,
            purgeEligible: true
          },
          {
            path: renderReviewQualityResult.previewMediaFramesRef,
            artifactClass: "preview_media_directory",
            summarized: true,
            purgeEligible: true
          },
          {
            path: renderReviewQualityResult.contactSheetRef,
            artifactClass: "preview_media",
            summarized: true,
            purgeEligible: true
          }
        );
      }
      appendLedgerArtifacts(ledgerPath, ledgerRows.filter((row) => str(row.path)), {
        externalDeleteRoots: [path.dirname(sequencePath)]
      });
      results.push({
        experimentId: row.experimentId,
        passId: row.passId,
        status: "completed",
        renderReviewDecision: str(renderReviewQualityResult?.decision),
        renderReviewOverallQuality: Number(renderReviewQualityResult?.overallQuality ?? 0),
        renderReviewQualityRef: str(renderReviewQualityResult?.summaryPath),
        renderReviewEvidenceEligible: Boolean(renderReviewQualityResult?.evidenceEligible),
        renderReviewMeasurementStatus: str(renderReviewQualityResult?.measurementStatus)
      });
      bundle = refreshCheckpointBundle(root, plan);
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
      bundle = refreshCheckpointBundle(root, plan);
      break;
    }
  }
  bundle = refreshCheckpointBundle(root, plan);
  const summary = writeCurrentSummary({ includeQualityTrend: renderReviewQuality });
  const finalRetentionCleanup = applyEndOfLoopRetentionCleanup({ runRoot: root, ledgerPath });
  if (finalRetentionCleanup) {
    summary.finalRetentionCleanup = finalRetentionCleanup;
    writeJson(passRunnerSummaryPath, summary);
  }
  writeExecutionSummary({
    root,
    plan,
    mode: untilRuntimeBudget ? "adaptive_refill" : "pass_runner",
    bundle,
    refillResults,
    learningCheckpoints,
    stopStatus,
    stopReason
  });
  return summary;
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
    renderReviewQuality: false,
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
    else if (arg === "--render-review-quality") args.renderReviewQuality = true;
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--out") args.outPath = argv[++index];
    else if (arg === "--help") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return `Usage:
  node scripts/sequencer-render-training/tooling/run-layer-composition-pass-runner.mjs --run-root <run-dir> [--max-passes 1] [--until-runtime-budget] [--max-runtime-minutes <n>] [--experiment-id <id>] [--render-review-quality]
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
