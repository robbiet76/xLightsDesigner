#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const DEFAULT_CURRICULUM_PATH = "scripts/sequencer-render-training/catalog/sequencing-quality-curriculum-v1.json";
const DEFAULT_OUT_PATH = "var/logs/sequencing-quality-controller/controller-state.json";
const DEFAULT_MAX_QUEUE = 25;

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function str(value = "") {
  return String(value || "").trim();
}

function num(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(value) {
  return Boolean(value);
}

function round6(value) {
  return Math.round(num(value) * 1_000_000) / 1_000_000;
}

function resolvePath(filePath = "") {
  const value = str(filePath);
  if (!value) return "";
  return path.isAbsolute(value) ? value : path.resolve(REPO_ROOT, value);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readJsonIfExists(filePath) {
  const resolved = resolvePath(filePath);
  if (!resolved || !fs.existsSync(resolved)) return null;
  return readJson(resolved);
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function artifactPath(runRoot, fileName) {
  const root = resolvePath(runRoot);
  return root ? path.join(root, fileName) : "";
}

function stableQueueId(record = {}) {
  return [
    "quality-controller",
    str(record.experimentId).replace(/[^a-zA-Z0-9._:-]+/g, "-"),
    str(record.passId).replace(/[^a-zA-Z0-9._:-]+/g, "-")
  ].join(":");
}

function promotionPolicy(curriculum = {}) {
  const requires = curriculum?.selectionPolicy?.promotionRequires || {};
  return {
    minimumStableSamples: num(requires.minimumStableSamples, 2),
    minimumOverallQuality: num(requires.minimumOverallQuality, 0.72),
    acceptedTrendStatuses: arr(requires.acceptedTrendStatuses).map(str).filter(Boolean)
  };
}

function latestRunArtifacts(latestRunRoot = "") {
  if (!latestRunRoot) {
    return {
      latestRunRoot: "",
      qualityRecords: null,
      promotedPriors: null,
      passRunnerSummary: null,
      cleanupResult: null,
      missingArtifacts: ["latest_run_root"]
    };
  }

  const files = {
    qualityRecords: artifactPath(latestRunRoot, "cross-run-quality-records.json"),
    promotedPriors: artifactPath(latestRunRoot, "cross-run-quality-priors-promoted.json"),
    passRunnerSummary: artifactPath(latestRunRoot, "pass-runner-summary.json"),
    cleanupResult: artifactPath(latestRunRoot, "final-retention-cleanup-result.json")
  };
  const artifacts = Object.fromEntries(Object.entries(files).map(([key, filePath]) => [key, readJsonIfExists(filePath)]));
  const requiredFiles = {
    qualityRecords: files.qualityRecords,
    passRunnerSummary: files.passRunnerSummary,
    cleanupResult: files.cleanupResult
  };
  const missingArtifacts = Object.entries(requiredFiles)
    .filter(([, filePath]) => !fs.existsSync(filePath))
    .map(([key]) => key);
  return {
    latestRunRoot: resolvePath(latestRunRoot),
    ...artifacts,
    refs: files,
    missingArtifacts
  };
}

function goalSort(left = {}, right = {}) {
  return num(left.priority, 999) - num(right.priority, 999) || str(left.goalId).localeCompare(str(right.goalId));
}

function activeGoals(curriculum = {}) {
  return arr(curriculum.goals)
    .filter((goal) => !["covered", "retired"].includes(str(goal.status)))
    .sort(goalSort);
}

function recordMatchesGoal(record = {}, goal = {}) {
  const coverage = goal.coverage || {};
  const families = arr(coverage.families).map(str).filter(Boolean);
  const paletteProfiles = arr(coverage.paletteProfiles).map(str).filter(Boolean);
  const effects = arr(coverage.effects).map(str).filter(Boolean);
  if (!families.length) return false;
  const experimentId = str(record.experimentId);

  const normalizedFamily = experimentId.split("-").slice(0, -1).join("_").replaceAll("-", "_");
  const normalizedExperiment = experimentId.replaceAll("-", "_");
  const familyMatch = !families.length || families.some((family) => normalizedExperiment.includes(family) || normalizedFamily.includes(family));
  const paletteMatch = !paletteProfiles.length || paletteProfiles.some((palette) => normalizedExperiment.includes(palette));
  const effectMatch = !effects.length || effects.includes(str(record.effectName));
  return familyMatch && paletteMatch && effectMatch;
}

function isPromisingBlockedRecord(record = {}, goal = {}, policy = {}) {
  const blockers = arr(record?.promotion?.blockers).map(str).filter(Boolean);
  if (!blockers.length) return false;
  if (!recordMatchesGoal(record, goal)) return false;
  if (num(record?.quality?.latestOverallQuality) < policy.minimumOverallQuality) return false;
  return blockers.includes("insufficient_repeated_quality_evidence")
    || str(record.trendStatus) === "single_run_baseline";
}

function queueFromBlockedRecords({ records = [], goal = {}, policy = {}, maxQueue = DEFAULT_MAX_QUEUE } = {}) {
  return arr(records)
    .filter((record) => isPromisingBlockedRecord(record, goal, policy))
    .sort((left, right) => {
      const qualityDelta = num(right?.quality?.latestOverallQuality) - num(left?.quality?.latestOverallQuality);
      if (qualityDelta) return qualityDelta;
      return str(left.passId).localeCompare(str(right.passId));
    })
    .slice(0, maxQueue)
    .map((record, index) => ({
      queueId: stableQueueId(record),
      goalId: str(goal.goalId),
      priority: index + 1,
      reason: "repeat_blocked_promising_record",
      experimentId: str(record.experimentId),
      passId: str(record.passId),
      effectName: str(record.effectName),
      leadTargets: arr(record.leadTargets).map(str).filter(Boolean),
      blockers: arr(record?.promotion?.blockers).map(str).filter(Boolean),
      latestOverallQuality: round6(record?.quality?.latestOverallQuality),
      meanOverallQuality: round6(record?.quality?.meanOverallQuality),
      sampleCount: num(record.sampleCount),
      trendStatus: str(record.trendStatus),
      selectionHint: "repeat to satisfy stable quality evidence requirements"
    }));
}

function promotedPriorsForGoal(priors = [], goal = {}) {
  return arr(priors).filter((prior) => {
    const scope = prior.scope || {};
    const pseudoRecord = {
      experimentId: str(scope.experimentId || prior.sourceExperimentId),
      passId: str(scope.passId),
      effectName: str(arr(scope.effectNames)[0] || "")
    };
    return bool(prior.selectorReady) && recordMatchesGoal(pseudoRecord, goal);
  });
}

function recordsForGoal(records = [], goal = {}) {
  return arr(records).filter((record) => recordMatchesGoal(record, goal));
}

function hasNonRepeatableBlockedRecord(records = [], goal = {}, policy = {}) {
  return recordsForGoal(records, goal).some((record) => {
    const blockers = arr(record?.promotion?.blockers).map(str).filter(Boolean);
    return blockers.length
      && num(record?.quality?.latestOverallQuality) >= policy.minimumOverallQuality
      && !isPromisingBlockedRecord(record, goal, policy);
  });
}

function buildGoalStatuses(curriculum = {}, artifacts = {}) {
  const policy = promotionPolicy(curriculum);
  const records = arr(artifacts?.qualityRecords?.records);
  const priors = arr(artifacts?.promotedPriors?.priors);
  return arr(curriculum.goals).sort(goalSort).map((goal) => {
    const goalRecords = recordsForGoal(records, goal);
    const durableCandidateCount = goalRecords.filter((record) => bool(record?.promotion?.durableCandidate)).length;
    const blockedPromisingCount = goalRecords.filter((record) => isPromisingBlockedRecord(record, goal, policy)).length;
    const selectorReadyPriorCount = promotedPriorsForGoal(priors, goal).length;
    const blockers = new Set(arr(goal.blockedBy).map(str).filter(Boolean));
    if (artifacts.missingArtifacts?.length && !goalRecords.length && !selectorReadyPriorCount) blockers.add("latest evidence artifacts unavailable");
    return {
      goalId: str(goal.goalId),
      areaId: str(goal.areaId),
      status: str(goal.status),
      priority: num(goal.priority),
      evidenceStatus: selectorReadyPriorCount >= num(goal?.completionCriteria?.minimumSelectorReadyPriorCount, Infinity)
        ? "covered"
        : blockedPromisingCount
          ? "in_progress"
          : goalRecords.length || selectorReadyPriorCount
            ? "in_progress"
            : str(goal.status),
      selectorReadyPriorCount,
      durableCandidateCount,
      blockedPromisingCount,
      blockers: [...blockers]
    };
  });
}

function coverageSummary(artifacts = {}) {
  const summary = artifacts.passRunnerSummary || {};
  const records = artifacts.qualityRecords || {};
  return {
    durableCandidateCount: num(records.durableCandidateCount),
    promotedSelectorReadyPriorCount: num(artifacts?.promotedPriors?.selectorReadyCount),
    blockedPromisingRecordCount: num(records.blockedRecordCount),
    runQualityMean: round6(summary.renderReviewEligibleQualityMean),
    acceptedEvidenceCount: num(summary.renderReviewAcceptedEvidenceCount),
    processedPassCount: num(summary.processedPasses)
  };
}

function promotionSummary(artifacts = {}) {
  const priors = artifacts.promotedPriors || {};
  const rows = arr(priors.priors);
  return {
    promotionState: str(priors.promotionState),
    selectorReadyPriorCount: num(priors.selectorReadyCount),
    blockedPriorCount: rows.filter((prior) => !bool(prior.selectorReady)).length,
    selectorReadyPriorIds: rows.filter((prior) => bool(prior.selectorReady)).map((prior) => str(prior.priorId)).filter(Boolean)
  };
}

function cleanupSummary(curriculum = {}, artifacts = {}) {
  const required = Boolean(curriculum?.selectionPolicy?.cleanupRequiredAfterEveryLoop);
  const cleanup = artifacts.cleanupResult || {};
  const missing = required && !artifacts.cleanupResult;
  return {
    required,
    cleanupResultRef: artifacts.refs?.cleanupResult || "",
    status: missing ? "missing" : cleanup.dryRun ? "dry_run" : "completed",
    deletedCount: num(cleanup.deletionCount),
    deletionBytes: num(cleanup.deletionBytes),
    keptCount: num(cleanup.keptCount),
    blockers: missing ? ["cleanup_result_missing"] : []
  };
}

function chooseNextQueue({ curriculum = {}, artifacts = {}, maxQueue = DEFAULT_MAX_QUEUE } = {}) {
  const policy = promotionPolicy(curriculum);
  const records = arr(artifacts?.qualityRecords?.records);
  const goals = activeGoals(curriculum);
  if (artifacts.missingArtifacts?.length) {
    return {
      selectedGoal: goals[0] || null,
      nextQueue: [],
      decision: {
        selectedGoalId: str(goals[0]?.goalId),
        selectionReason: "missing_latest_evidence",
        blockedBy: artifacts.missingArtifacts,
        nextAction: "await_evidence"
      }
    };
  }

  for (const goal of goals) {
    const queue = queueFromBlockedRecords({ records, goal, policy, maxQueue });
    if (queue.length) {
      return {
        selectedGoal: goal,
        nextQueue: queue,
        decision: {
          selectedGoalId: str(goal.goalId),
          selectionReason: "blocked_promising_records",
          blockedBy: [],
          nextAction: "plan_quality_repeats"
        }
      };
    }
  }

  const nextGoal = goals.find((goal) => !hasNonRepeatableBlockedRecord(records, goal, policy)) || goals[0] || null;
  return {
    selectedGoal: nextGoal,
    nextQueue: nextGoal ? [{
      queueId: `quality-controller:${str(nextGoal.goalId) || "none"}:coverage-gap`,
      goalId: str(nextGoal.goalId),
      priority: 1,
      reason: "coverage_gap",
      selectionHint: arr(nextGoal.nextSelectionHints)[0] || "create the first bounded coverage run for this curriculum goal"
    }] : [],
    decision: {
      selectedGoalId: str(nextGoal?.goalId),
      selectionReason: nextGoal ? "coverage_gap" : "no_active_goals",
      blockedBy: [],
      nextAction: nextGoal ? "plan_goal_coverage" : "idle"
    }
  };
}

export function buildSequencingQualityControllerState({
  curriculum,
  curriculumPath = DEFAULT_CURRICULUM_PATH,
  latestRunRoot = "",
  previousStatePath = "",
  maxQueue = DEFAULT_MAX_QUEUE
} = {}) {
  const resolvedCurriculum = curriculum || readJson(resolvePath(curriculumPath));
  const artifacts = latestRunArtifacts(latestRunRoot);
  const previousState = readJsonIfExists(previousStatePath);
  const { nextQueue, decision } = chooseNextQueue({ curriculum: resolvedCurriculum, artifacts, maxQueue });
  const cleanup = cleanupSummary(resolvedCurriculum, artifacts);
  if (cleanup.blockers.length && !decision.blockedBy.includes(cleanup.blockers[0])) {
    decision.blockedBy = [...decision.blockedBy, ...cleanup.blockers];
  }

  return {
    artifactType: "sequencing_quality_training_controller_state_v1",
    artifactVersion: 1,
    generatedAt: new Date().toISOString(),
    curriculumId: str(resolvedCurriculum.curriculumId),
    loopIndex: num(previousState?.loopIndex, 0) + 1,
    latestRunRoot: artifacts.latestRunRoot,
    goalStatuses: buildGoalStatuses(resolvedCurriculum, artifacts),
    coverageSummary: coverageSummary(artifacts),
    promotionSummary: promotionSummary(artifacts),
    cleanupSummary: cleanup,
    nextQueue,
    controllerDecision: decision
  };
}

function parseArgs(argv = []) {
  const args = {
    curriculumPath: DEFAULT_CURRICULUM_PATH,
    latestRunRoot: "",
    previousStatePath: "",
    outPath: DEFAULT_OUT_PATH,
    maxQueue: DEFAULT_MAX_QUEUE
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = str(argv[index]);
    if (arg === "--curriculum") args.curriculumPath = argv[++index];
    else if (arg === "--latest-run-root") args.latestRunRoot = argv[++index];
    else if (arg === "--previous-state") args.previousStatePath = argv[++index];
    else if (arg === "--out") args.outPath = argv[++index];
    else if (arg === "--max-queue") args.maxQueue = Number(argv[++index]);
    else if (arg === "--help") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return `Usage:
  node scripts/sequencer-render-training/tooling/run-sequencing-quality-controller.mjs \\
    --latest-run-root /tmp/xld-layer-composition-quality-long-YYYYMMDDTHHMMSSZ \\
    --out var/logs/sequencing-quality-controller/controller-state.json
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(usage());
    process.exit(0);
  }
  const state = buildSequencingQualityControllerState(args);
  const outPath = resolvePath(args.outPath);
  writeJson(outPath, state);
  process.stdout.write(`${outPath}\n`);
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch((error) => {
    console.error(error?.stack || String(error));
    process.exit(1);
  });
}
