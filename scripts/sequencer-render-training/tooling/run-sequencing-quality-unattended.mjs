#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runSequencingQualityLoop } from "./run-sequencing-quality-loop.mjs";
import { buildLayerCompositionDeltas } from "./build-layer-composition-deltas.mjs";
import { buildLayerCompositionPriors } from "./build-layer-composition-priors.mjs";
import { promoteLayerCompositionPriors } from "./promote-layer-composition-priors.mjs";
import { RGB_DISPLAY_AUTO_REFILL_VALIDATION_CYCLE_COUNT } from "./build-layer-composition-training-plan.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const DEFAULT_OUT_ROOT = "var/logs/sequencing-quality-controller/unattended";
const DEFAULT_MODEL_CATALOG = "scripts/sequencer-render-training/catalog/generic-layout-model-catalog.json";
const DEFAULT_CURRICULUM = "scripts/sequencer-render-training/catalog/sequencing-quality-curriculum-v1.json";
const DEFAULT_ENDPOINT = "http://127.0.0.1:49915/xlightsdesigner/api";
const AUTO_REFILL_PATTERN_SPECS = [
  {
    key: "motion_pacing",
    passPrefix: "display_palette_motion_pacing_validation_cycle",
    description: "Auto-refill validation of the stable RGB motion pacing pattern."
  },
  {
    key: "spatial_negative_space",
    passPrefix: "display_palette_spatial_negative_space_validation_cycle",
    description: "Auto-refill validation of the stable RGB negative-space balance pattern."
  },
  {
    key: "spatial_focal",
    passPrefix: "display_palette_spatial_focal_validation_cycle",
    description: "Auto-refill validation of the stable sparse RGB focal pattern."
  },
  {
    key: "color_purpose_motion",
    passPrefix: "display_palette_color_purpose_motion_validation_cycle",
    description: "Auto-refill validation of the stable RGB color-purpose motion pattern."
  }
];

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

function copyRuntimeCurriculum({ sourcePath = DEFAULT_CURRICULUM, outRoot = "" } = {}) {
  const source = resolvePath(sourcePath || DEFAULT_CURRICULUM);
  const target = path.join(resolvePath(outRoot || DEFAULT_OUT_ROOT), "runtime-curriculum.json");
  const curriculum = readJsonIfExists(source);
  if (!curriculum) throw new Error(`Unable to read curriculum: ${source}`);
  curriculum.runtimeSourceRef = source;
  curriculum.runtimeGeneratedAt = new Date().toISOString();
  writeJson(target, curriculum);
  return target;
}

function existingGoalPassIds(curriculum = {}) {
  return new Set(arr(curriculum.goals).flatMap((goal) => arr(goal.coverage?.passIds).map(str).filter(Boolean)));
}

function maxGoalPriority(curriculum = {}) {
  return arr(curriculum.goals).reduce((max, goal) => Math.max(max, num(goal.priority)), 0);
}

function autoRefillGoal({ passId = "", pattern = {}, priority = 1, cycle = "" } = {}) {
  return {
    goalId: `display.video_aesthetic.auto_refill.${pattern.key}_cycle_${cycle}_v1`,
    areaId: "display_level_composition",
    priority,
    status: "not_started",
    description: pattern.description,
    requiredStableSamples: 2,
    coverage: {
      families: ["display_quality_review"],
      paletteProfiles: ["rgb_primary"],
      passIds: [passId],
      reviewScopes: [
        "section_video",
        "whole_sequence_window",
        "full_display_contact_sheet"
      ]
    },
    completionCriteria: {
      minimumDistinctCoverageUnitCount: 1,
      distinctCoverageFields: [
        "paletteProfile",
        "passId"
      ],
      desiredCoverageUnits: [{
        paletteProfile: "rgb_primary",
        passId
      }],
      maximumRegressingRecords: 0
    }
  };
}

function refillRuntimeCurriculum({
  curriculumPath = "",
  outRoot = "",
  iteration = 0,
  batchSize = AUTO_REFILL_PATTERN_SPECS.length,
  deps = {}
} = {}) {
  const read = deps.readJson || readJsonIfExists;
  const write = deps.writeJson || writeJson;
  const resolved = resolvePath(curriculumPath);
  const curriculum = read(resolved);
  if (!curriculum) return null;
  const usedPassIds = existingGoalPassIds(curriculum);
  const newGoals = [];
  let priority = maxGoalPriority(curriculum) + 1;
  for (let cycleIndex = 1; cycleIndex <= RGB_DISPLAY_AUTO_REFILL_VALIDATION_CYCLE_COUNT; cycleIndex += 1) {
    const cycle = String(cycleIndex).padStart(2, "0");
    for (const pattern of AUTO_REFILL_PATTERN_SPECS) {
      const passId = `${pattern.passPrefix}_${cycle}`;
      if (usedPassIds.has(passId)) continue;
      newGoals.push(autoRefillGoal({ passId, pattern, priority: priority += 1, cycle }));
      usedPassIds.add(passId);
      if (newGoals.length >= batchSize) break;
    }
    if (newGoals.length >= batchSize) break;
  }
  if (!newGoals.length) return null;
  const event = {
    artifactType: "sequencing_quality_unattended_refill_event_v1",
    artifactVersion: 1,
    generatedAt: new Date().toISOString(),
    iteration,
    reason: "controller_idle",
    curriculumRef: resolved,
    addedGoalCount: newGoals.length,
    addedGoals: newGoals.map((goal) => ({
      goalId: goal.goalId,
      passId: goal.coverage.passIds[0],
      priority: goal.priority
    }))
  };
  curriculum.goals = [...arr(curriculum.goals), ...newGoals];
  curriculum.runtimeRefillEvents = [...arr(curriculum.runtimeRefillEvents), event];
  write(resolved, curriculum);
  const eventPath = path.join(resolvePath(outRoot || path.dirname(resolved)), `runtime-curriculum-refill-${String(iteration).padStart(6, "0")}.json`);
  write(eventPath, event);
  return { ...event, eventRef: eventPath };
}

function loopDir(root = "", index = 1) {
  return path.join(resolvePath(root || DEFAULT_OUT_ROOT), `loop-${String(index).padStart(6, "0")}`);
}

function shouldAdvanceVideoBaselineRun(summary = {}, gate = {}) {
  if (str(summary.status) !== "executed" || !str(summary.loopRoot)) return false;
  if (str(gate.source) === "creative_intent_revision_comparison") return false;
  if (str(gate.status) === "regressed") return false;
  return true;
}

function stopReasonForSummary(
  summary = {},
  index = 0,
  maxLoops = 1,
  {
    consecutiveRegressionCount = 0,
    maxConsecutiveRegressions = 0,
    repeatedGoalCount = 0,
    maxRepeatedGoalCount = 0
  } = {}
) {
  const decision = summary.controllerDecision || {};
  if (str(decision.nextAction) === "idle") return "controller_idle";
  if (str(summary.status) === "blocked_no_controller_queue") return str(decision.nextAction) === "await_evidence"
    ? "awaiting_evidence"
    : "blocked_no_controller_queue";
  if (maxConsecutiveRegressions > 0 && consecutiveRegressionCount >= maxConsecutiveRegressions) return "max_consecutive_regressions";
  if (maxRepeatedGoalCount > 0 && repeatedGoalCount >= maxRepeatedGoalCount) return "max_repeated_goal_selection";
  if (index >= maxLoops) return "max_loops_reached";
  return "";
}

function prunePreviewFrameDumps(root = "") {
  const resolved = resolvePath(root);
  const deleted = [];
  if (!resolved || !fs.existsSync(resolved)) {
    return { deletedFileCount: 0, deletedBytes: 0, deletedFiles: [] };
  }
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const filePath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(filePath);
        if (entry.name === "preview-media-frames" && fs.existsSync(filePath) && fs.readdirSync(filePath).length === 0) {
          fs.rmdirSync(filePath);
        }
        continue;
      }
      if (entry.isFile() && path.basename(path.dirname(filePath)) === "preview-media-frames" && entry.name.startsWith("frame-") && entry.name.endsWith(".ppm")) {
        const sizeBytes = fs.statSync(filePath).size;
        fs.rmSync(filePath, { force: true });
        deleted.push({ path: filePath, sizeBytes });
      }
    }
  };
  walk(resolved);
  return {
    deletedFileCount: deleted.length,
    deletedBytes: deleted.reduce((total, row) => total + num(row.sizeBytes), 0),
    deletedFiles: deleted
  };
}

function consolidateLoopEvidence({
  loopRoot = "",
  crossRunQualityRecordsRef = "",
  cleanupPreviewFrames = true,
  deps = {}
} = {}) {
  const root = resolvePath(loopRoot);
  if (!root || !fs.existsSync(path.join(root, "checkpoints.json"))) return null;
  const deltaPath = path.join(root, "layer-composition-delta-summary.json");
  const stagedPriorsPath = path.join(root, "cross-run-quality-priors-staged.json");
  const promotedPriorsPath = path.join(root, "cross-run-quality-priors-promoted.json");
  const cleanupPath = path.join(root, "unattended-cleanup-summary.json");

  const buildDeltas = deps.buildDeltas || buildLayerCompositionDeltas;
  const buildPriors = deps.buildPriors || buildLayerCompositionPriors;
  const promotePriors = deps.promotePriors || promoteLayerCompositionPriors;
  const deltaSummary = buildDeltas({ runRoot: root });
  deltaSummary.sourceDeltaSummaryRef = deltaPath;
  writeJson(deltaPath, deltaSummary);

  const qualityRecords = readJsonIfExists(crossRunQualityRecordsRef);
  if (qualityRecords) qualityRecords.sourceQualityRecordsRef = resolvePath(crossRunQualityRecordsRef);
  const stagedPriors = buildPriors({ deltaSummary, qualityRecords });
  writeJson(stagedPriorsPath, stagedPriors);
  const promotedPriors = promotePriors({ priors: stagedPriors });
  writeJson(promotedPriorsPath, promotedPriors);

  const cleanup = cleanupPreviewFrames ? prunePreviewFrameDumps(root) : { deletedFileCount: 0, deletedBytes: 0, deletedFiles: [] };
  writeJson(cleanupPath, {
    artifactType: "sequencing_quality_unattended_cleanup_summary_v1",
    artifactVersion: 1,
    generatedAt: new Date().toISOString(),
    previewFrameCleanup: cleanup
  });

  return {
    deltaSummaryRef: deltaPath,
    stagedPriorsRef: stagedPriorsPath,
    promotedPriorsRef: promotedPriorsPath,
    selectorReadyPriorCount: num(promotedPriors.selectorReadyCount),
    blockedPromotionCount: num(promotedPriors.blockedPromotionCount),
    cleanupRef: cleanupPath,
    deletedPreviewFrameCount: num(cleanup.deletedFileCount),
    deletedPreviewFrameBytes: num(cleanup.deletedBytes)
  };
}

function isCreativeRevisionGoal(goalId = "") {
  return str(goalId).startsWith("creative.intent_revision");
}

function creativeRevisionOutcome(comparison = {}) {
  const status = str(comparison.status);
  const comparisonCount = num(comparison.comparisonCount);
  const improvedComparisonCount = num(comparison.improvedComparisonCount);
  const promotionEligibleCount = num(comparison.promotionEligibleCount);
  if (status !== "ready" || comparisonCount <= 0) return "";
  if (promotionEligibleCount > 0 || improvedComparisonCount > 0) return "improved";
  return "regressed";
}

function qualityGate(summary = {}) {
  const selectedGoalId = str(summary.controllerDecision?.selectedGoalId);
  if (isCreativeRevisionGoal(selectedGoalId)) {
    const creativeOutcome = creativeRevisionOutcome(summary.creativeIntentRevisionComparison);
    if (creativeOutcome) {
      return {
        source: "creative_intent_revision_comparison",
        status: creativeOutcome,
        reason: creativeOutcome === "improved"
          ? "At least one paired creative revision comparison improved."
          : "No paired creative revision comparison was promotion eligible."
      };
    }
  }
  const comparisonStatus = str(summary.videoAestheticAttemptComparison?.comparisonStatus);
  if (comparisonStatus) {
    return {
      source: "video_aesthetic_attempt_comparison",
      status: comparisonStatus,
      reason: "Candidate video aesthetic score was compared against the latest run root."
    };
  }
  if (summary.videoAestheticScore?.promotionEligible) {
    return {
      source: "video_aesthetic_score",
      status: "promotion_eligible",
      reason: "Candidate video aesthetic score is promotion eligible without a comparison."
    };
  }
  return {
    source: "loop_status",
    status: str(summary.status),
    reason: "No quality comparison artifact was available for this loop."
  };
}

function runOutcome(summary = {}) {
  return qualityGate(summary).status;
}

export async function runSequencingQualityUnattended({
  latestRunRoot = "",
  videoComparisonBaselineRunRoot = "",
  previousStatePath = "",
  outRoot = DEFAULT_OUT_ROOT,
  curriculumPath = DEFAULT_CURRICULUM,
  modelCatalogPath = DEFAULT_MODEL_CATALOG,
  runType = "overnight",
  maxLoops = 10,
  maxQueue = 25,
  maxPasses = 5,
  maxConsecutiveRegressions = 1,
  maxRepeatedGoalCount = 6,
  applyRender = true,
  endpoint = DEFAULT_ENDPOINT,
  cleanupPreviewFrames = true,
  autoRefill = true,
  maxAutoRefills = 4,
  summaryPath = "",
  deps = {}
} = {}) {
  const root = resolvePath(outRoot || DEFAULT_OUT_ROOT);
  fs.mkdirSync(root, { recursive: true });
  const resolvedSummaryPath = resolvePath(summaryPath) || path.join(root, "unattended-run-summary.json");
  let currentLatestRunRoot = resolvePath(latestRunRoot);
  let currentVideoBaselineRunRoot = resolvePath(videoComparisonBaselineRunRoot) || currentLatestRunRoot;
  let currentPreviousStatePath = resolvePath(previousStatePath);
  const iterations = [];
  let stopReason = "max_loops_reached";
  let consecutiveRegressionCount = 0;
  let previousGoalId = "";
  let repeatedGoalCount = 0;
  const refillEvents = [];
  let currentCurriculumPath = autoRefill
    ? (deps.copyRuntimeCurriculum || copyRuntimeCurriculum)({ sourcePath: curriculumPath, outRoot: root })
    : resolvePath(curriculumPath || DEFAULT_CURRICULUM);

  for (let index = 1; index <= maxLoops; index += 1) {
    const runLoop = deps.runLoop || runSequencingQualityLoop;
    const summary = await runLoop({
      latestRunRoot: currentLatestRunRoot,
      videoComparisonBaselineRunRoot: currentVideoBaselineRunRoot,
      previousStatePath: currentPreviousStatePath,
      curriculumPath: currentCurriculumPath,
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
    const gate = qualityGate(summary);
    const outcome = gate.status;
    consecutiveRegressionCount = outcome === "regressed" ? consecutiveRegressionCount + 1 : 0;
    const selectedGoalId = str(summary.controllerDecision?.selectedGoalId);
    repeatedGoalCount = selectedGoalId && selectedGoalId === previousGoalId ? repeatedGoalCount + 1 : selectedGoalId ? 1 : 0;
    previousGoalId = selectedGoalId;
    const consolidation = str(summary.status) === "executed"
      ? (deps.consolidateLoopEvidence || consolidateLoopEvidence)({
        loopRoot: summary.loopRoot,
        crossRunQualityRecordsRef: summary.crossRunQuality?.recordsRef,
        cleanupPreviewFrames,
        deps: deps.consolidationDeps || {}
      })
      : null;
    const iteration = {
      iteration: index,
      status: str(summary.status),
      loopRoot: str(summary.loopRoot),
      controllerStateRef: str(summary.controllerStateRef),
      selectedGoalId,
      nextAction: str(summary.controllerDecision?.nextAction),
      selectionReason: str(summary.controllerDecision?.selectionReason),
      processedPasses: num(summary.passRunner?.processedPasses),
      acceptedEvidenceCount: num(summary.passRunner?.renderReviewAcceptedEvidenceCount),
      overallAestheticScore: num(summary.videoAestheticScore?.overallAestheticScore),
      promotionEligible: Boolean(summary.videoAestheticScore?.promotionEligible),
      comparisonStatus: str(summary.videoAestheticAttemptComparison?.comparisonStatus),
      overallAestheticScoreDelta: num(summary.videoAestheticAttemptComparison?.overallAestheticScoreDelta),
      creativeRevisionComparisonStatus: str(summary.creativeIntentRevisionComparison?.status),
      creativeRevisionImprovedComparisonCount: num(summary.creativeIntentRevisionComparison?.improvedComparisonCount),
      creativeRevisionPromotionEligibleCount: num(summary.creativeIntentRevisionComparison?.promotionEligibleCount),
      qualityGateSource: gate.source,
      qualityGateStatus: gate.status,
      qualityGateReason: gate.reason,
      outcome,
      consecutiveRegressionCount,
      repeatedGoalCount,
      durableCandidateCount: num(summary.crossRunQuality?.durableCandidateCount),
      blockedRecordCount: num(summary.crossRunQuality?.blockedRecordCount),
      consolidation,
      goalStatuses: arr(controllerState?.goalStatuses).map((goal) => ({
        goalId: str(goal.goalId),
        evidenceStatus: str(goal.evidenceStatus),
        durableCandidateCount: num(goal.durableCandidateCount),
        blockedPromisingCount: num(goal.blockedPromisingCount),
        blockers: arr(goal.blockers).map(str).filter(Boolean)
      }))
    };
    iterations.push(iteration);
    if (shouldAdvanceVideoBaselineRun(summary, gate)) currentVideoBaselineRunRoot = resolvePath(summary.loopRoot);
    if (str(summary.status) === "executed" && str(summary.loopRoot)) currentLatestRunRoot = resolvePath(summary.loopRoot);
    currentPreviousStatePath = resolvePath(summary.controllerStateRef);

    const reason = stopReasonForSummary(summary, index, maxLoops, {
      consecutiveRegressionCount,
      maxConsecutiveRegressions,
      repeatedGoalCount,
      maxRepeatedGoalCount
    });
    if (reason === "controller_idle" && autoRefill && refillEvents.length < maxAutoRefills && index < maxLoops) {
      const refill = (deps.refillRuntimeCurriculum || refillRuntimeCurriculum)({
        curriculumPath: currentCurriculumPath,
        outRoot: root,
        iteration: index,
        deps: deps.refillDeps || {}
      });
      if (refill) {
        refillEvents.push(refill);
        iteration.refillEventRef = refill.eventRef;
        iteration.refillAddedGoalCount = refill.addedGoalCount;
      }
    }
    const effectiveReason = iteration.refillAddedGoalCount ? "" : reason;
    const partial = {
      artifactType: "sequencing_quality_unattended_run_summary_v1",
      artifactVersion: 1,
      generatedAt: new Date().toISOString(),
      status: effectiveReason && effectiveReason !== "max_loops_reached" ? "stopped" : index >= maxLoops ? "stopped" : "running",
      stopReason: effectiveReason || "",
      outRoot: root,
      latestRunRoot: currentLatestRunRoot,
      videoComparisonBaselineRunRoot: currentVideoBaselineRunRoot,
      previousStateRef: currentPreviousStatePath,
      iterationCount: iterations.length,
      guardrails: {
        maxLoops,
        maxQueue,
        maxPasses,
        maxConsecutiveRegressions,
        maxRepeatedGoalCount,
        cleanupPreviewFrames,
        autoRefill,
        maxAutoRefills
      },
      iterations,
      runtimeCurriculumRef: currentCurriculumPath,
      refillEvents
    };
    writeJson(resolvedSummaryPath, partial);
    if (effectiveReason) {
      stopReason = effectiveReason;
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
    videoComparisonBaselineRunRoot: currentVideoBaselineRunRoot,
    previousStateRef: currentPreviousStatePath,
    iterationCount: iterations.length,
    guardrails: {
      maxLoops,
      maxQueue,
      maxPasses,
      maxConsecutiveRegressions,
      maxRepeatedGoalCount,
      cleanupPreviewFrames,
      autoRefill,
      maxAutoRefills
    },
    iterations,
    runtimeCurriculumRef: currentCurriculumPath,
    refillEvents,
    interventionRecommended: [
      "max_consecutive_regressions",
      "max_repeated_goal_selection",
      "blocked_no_controller_queue",
      "awaiting_evidence"
    ].includes(stopReason),
    interventionReason: stopReason === "max_consecutive_regressions"
      ? "The controller produced too many regressions in a row; inspect the latest selected goal and adjust curriculum or strategy selection before continuing."
      : stopReason === "max_repeated_goal_selection"
        ? "The controller selected the same goal repeatedly; inspect blocked promising records and add a narrower repair or exploration strategy."
        : stopReason === "blocked_no_controller_queue" || stopReason === "awaiting_evidence"
          ? "The controller cannot build a useful next queue from the current evidence."
          : "",
    recommendedNextCurriculumExpansion: stopReason === "controller_idle"
      ? [
        "stronger video-level aesthetic scoring",
        "richer creative revision variants",
        "matrix/cane/tree-360 effect-model coverage when those models are available"
      ]
      : []
  };
  writeJson(resolvedSummaryPath, finalSummary);
  return finalSummary;
}

function parseArgs(argv = []) {
  const args = {
    latestRunRoot: "",
    videoComparisonBaselineRunRoot: "",
    previousStatePath: "",
    outRoot: DEFAULT_OUT_ROOT,
    curriculumPath: DEFAULT_CURRICULUM,
    modelCatalogPath: DEFAULT_MODEL_CATALOG,
    runType: "overnight",
    maxLoops: 10,
    maxQueue: 25,
    maxPasses: 5,
    maxConsecutiveRegressions: 1,
    maxRepeatedGoalCount: 6,
    applyRender: true,
    endpoint: DEFAULT_ENDPOINT,
    cleanupPreviewFrames: true,
    autoRefill: true,
    maxAutoRefills: 4,
    summaryPath: ""
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = str(argv[index]);
    if (arg === "--latest-run-root") args.latestRunRoot = argv[++index];
    else if (arg === "--video-comparison-baseline-run-root") args.videoComparisonBaselineRunRoot = argv[++index];
    else if (arg === "--previous-state") args.previousStatePath = argv[++index];
    else if (arg === "--out-root") args.outRoot = argv[++index];
    else if (arg === "--curriculum") args.curriculumPath = argv[++index];
    else if (arg === "--model-catalog") args.modelCatalogPath = argv[++index];
    else if (arg === "--run-type") args.runType = argv[++index];
    else if (arg === "--max-loops") args.maxLoops = Number(argv[++index]);
    else if (arg === "--max-queue") args.maxQueue = Number(argv[++index]);
    else if (arg === "--max-passes") args.maxPasses = Number(argv[++index]);
    else if (arg === "--max-consecutive-regressions") args.maxConsecutiveRegressions = Number(argv[++index]);
    else if (arg === "--max-repeated-goal-count") args.maxRepeatedGoalCount = Number(argv[++index]);
    else if (arg === "--max-auto-refills") args.maxAutoRefills = Number(argv[++index]);
    else if (arg === "--endpoint") args.endpoint = argv[++index];
    else if (arg === "--summary") args.summaryPath = argv[++index];
    else if (arg === "--scaffold-only") args.applyRender = false;
    else if (arg === "--keep-preview-frames") args.cleanupPreviewFrames = false;
    else if (arg === "--no-auto-refill") args.autoRefill = false;
    else if (arg === "--help") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return `Usage:
  node scripts/sequencer-render-training/tooling/run-sequencing-quality-unattended.mjs \\
    --latest-run-root /tmp/xld-quality-controller-loop-live-music-000002 \\
    --video-comparison-baseline-run-root /tmp/xld-quality-controller-loop-live-display-000001 \\
    --previous-state /tmp/xld-quality-controller-after-music-000002.json \\
    --curriculum scripts/sequencer-render-training/catalog/sequencing-quality-curriculum-v1.json \\
    --model-catalog /tmp/xld-vendor-fixture-model-catalog.json \\
    --max-loops 20 \\
    --max-passes 5 \\
    --max-consecutive-regressions 1 \\
    --max-auto-refills 4
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
