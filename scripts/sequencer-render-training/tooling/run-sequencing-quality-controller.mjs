#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const DEFAULT_CURRICULUM_PATH = "scripts/sequencer-render-training/catalog/sequencing-quality-curriculum-v1.json";
const DEFAULT_OUT_PATH = "var/logs/sequencing-quality-controller/controller-state.json";
const DEFAULT_MAX_QUEUE = 25;
const VIDEO_AESTHETIC_STRATEGIES = [
  "section_window_pacing_balance",
  "regional_focus_contrast",
  "rgb_primary_color_discipline_repair",
  "rgb_primary_structure_balance_pacing_repair",
  "rgb_primary_regional_focus_contrast",
  "simultaneous_display_balance_revision",
  "focal_consistency_repair"
];

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

function recentVideoAestheticAttemptHistory(latestRunRoot = "", qualityRecords = {}) {
  const roots = [...new Set([
    ...arr(qualityRecords?.sourceRunRoots).map(resolvePath),
    resolvePath(latestRunRoot)
  ].filter(Boolean))].slice(-8);
  return roots.map((root) => {
    const comparison = readJsonIfExists(path.join(root, "video-aesthetic-attempt-comparison.json")) || {};
    const controllerState = readJsonIfExists(path.join(root, "controller-state.json")) || {};
    const queue = arr(controllerState.nextQueue)[0] || {};
    return {
      runRoot: root,
      comparisonStatus: str(comparison.comparisonStatus),
      nextStrategy: str(queue.nextStrategy),
      overallAestheticScoreDelta: round6(comparison.summary?.overallAestheticScoreDelta)
    };
  }).filter((row) => row.comparisonStatus && row.nextStrategy);
}

function recentControllerAttemptHistory(latestRunRoot = "", qualityRecords = {}) {
  const roots = [...new Set([
    ...arr(qualityRecords?.sourceRunRoots).map(resolvePath),
    resolvePath(latestRunRoot)
  ].filter(Boolean))].slice(-50);
  return roots.map((root) => {
    const controllerState = readJsonIfExists(path.join(root, "controller-state.json")) || {};
    const queue = arr(controllerState.nextQueue)[0] || {};
    const passRunner = readJsonIfExists(path.join(root, "pass-runner-summary.json")) || {};
    const comparison = readJsonIfExists(path.join(root, "video-aesthetic-attempt-comparison.json")) || {};
    const score = readJsonIfExists(path.join(root, "video-aesthetic-score.json")) || {};
    return {
      runRoot: root,
      goalId: str(queue.goalId),
      reason: str(queue.reason),
      missingCoverageUnitCount: arr(queue.missingCoverageUnits).length,
      processedPasses: num(passRunner.processedPasses),
      acceptedEvidenceCount: num(passRunner.renderReviewAcceptedEvidenceCount),
      comparisonStatus: str(comparison.comparisonStatus),
      overallAestheticScore: round6(score.scores?.overallAestheticScore)
    };
  }).filter((row) => row.goalId);
}

function stableQueueId(record = {}) {
  return [
    "quality-controller",
    str(record.experimentId).replace(/[^a-zA-Z0-9._:-]+/g, "-"),
    str(record.passId).replace(/[^a-zA-Z0-9._:-]+/g, "-")
  ].join(":");
}

function normalizedToken(value = "") {
  const token = str(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (token === "singlestrand") return "single_strand";
  return token;
}

function normalizedValues(values = []) {
  return arr(values).map(normalizedToken).filter(Boolean);
}

function targetScopesForRecord(record = {}) {
  const scopes = new Set(normalizedValues(record.targetScopes));
  const passId = normalizedToken(record.passId);
  if (passId.includes("parent_model")) scopes.add("parent_model");
  if (passId.includes("single_submodel")) scopes.add("submodel");
  if (passId.includes("sibling_submodels")) scopes.add("sibling_submodels");
  if (arr(record.leadTargets).some((target) => str(target).includes("/"))) scopes.add("submodel");
  return [...scopes];
}

function coverageList(coverage = {}, key = "") {
  return normalizedValues(coverage?.[key]);
}

function matchesCoverage(values = [], expected = []) {
  if (!expected.length) return true;
  const actual = new Set(normalizedValues(values));
  return expected.some((value) => actual.has(value));
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
    controllerState: artifactPath(latestRunRoot, "controller-state.json"),
    cleanupResult: artifactPath(latestRunRoot, "final-retention-cleanup-result.json"),
    fullSequenceReviewLoop: artifactPath(latestRunRoot, "full-sequence-review-loop.json"),
    videoAestheticScore: artifactPath(latestRunRoot, "video-aesthetic-score.json"),
    videoAestheticAttemptComparison: artifactPath(latestRunRoot, "video-aesthetic-attempt-comparison.json"),
    creativeIntentRevisionComparison: artifactPath(latestRunRoot, "creative-intent-revision-comparison.json")
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
    recentVideoAestheticAttempts: recentVideoAestheticAttemptHistory(latestRunRoot, artifacts.qualityRecords),
    recentControllerAttempts: recentControllerAttemptHistory(latestRunRoot, artifacts.qualityRecords),
    refs: files,
    missingArtifacts
  };
}

function prerequisiteGoalReady(goalId = "", curriculum = {}, artifacts = {}) {
  const goal = arr(curriculum.goals).find((row) => str(row.goalId) === goalId);
  if (!goal) return false;
  if (goalBlockers(goal, artifacts, curriculum).length) return false;
  return durableRecordCountForGoal(arr(artifacts?.qualityRecords?.records), goal) > 0;
}

function goalBlockers(goal = {}, artifacts = {}, curriculum = {}) {
  const blockers = arr(goal.blockedBy).map(str).filter(Boolean);
  return blockers.filter((blocker) => {
    if (blocker === "needs broader full-sequence review loop") {
      return str(artifacts?.fullSequenceReviewLoop?.status) !== "ready";
    }
    if (blocker === "needs display-level and musical-structure evidence first") {
      return !(
        prerequisiteGoalReady("display.full_sequence.quality_v1", curriculum, artifacts)
        && prerequisiteGoalReady("music.structure_alignment.v1", curriculum, artifacts)
      );
    }
    if (blocker === "needs baseline creative-intent evidence first") {
      return !prerequisiteGoalReady("creative.intent_match.v1", curriculum, artifacts);
    }
    return true;
  });
}

function goalSort(left = {}, right = {}) {
  return num(left.priority, 999) - num(right.priority, 999) || str(left.goalId).localeCompare(str(right.goalId));
}

function activeGoals(curriculum = {}) {
  return arr(curriculum.goals)
    .filter((goal) => !["covered", "retired"].includes(str(goal.status)))
    .sort(goalSort);
}

function finiteCriteriaNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function completionCriteriaForGoal(goal = {}) {
  const criteria = goal.completionCriteria || {};
  const minimumSelectorReadyPriorCount = finiteCriteriaNumber(criteria.minimumSelectorReadyPriorCount);
  return {
    minimumSelectorReadyPriorCount,
    minimumDurableCandidateCount: finiteCriteriaNumber(criteria.minimumDurableCandidateCount)
      || minimumSelectorReadyPriorCount
      || null,
    minimumDistinctCoverageUnitCount: finiteCriteriaNumber(criteria.minimumDistinctCoverageUnitCount),
    distinctCoverageFields: arr(criteria.distinctCoverageFields).map(normalizedToken).filter(Boolean),
    desiredCoverageUnits: arr(criteria.desiredCoverageUnits)
  };
}

function paletteProfilesForRecord(record = {}) {
  const values = new Set(normalizedValues(record.paletteProfiles));
  const experiment = normalizedToken(record.experimentId);
  if (experiment.includes("mono_white")) values.add("mono_white");
  if (experiment.includes("rgb_primary")) values.add("rgb_primary");
  return [...values];
}

function coverageFieldValues(record = {}, field = "") {
  if (field === "effect" || field === "effects" || field === "effect_name") return [normalizedToken(record.effectName)].filter(Boolean);
  if (field === "model_type" || field === "model_types" || field === "modeltype") return normalizedValues(record.modelTypes);
  if (field === "palette" || field === "palette_profile" || field === "palette_profiles" || field === "paletteprofile") return paletteProfilesForRecord(record);
  if (field === "target_scope" || field === "target_scopes") return normalizedValues(targetScopesForRecord(record));
  if (field === "family" || field === "families") return [normalizedToken(record.family)].filter(Boolean);
  if (field === "pass" || field === "pass_id" || field === "pass_ids" || field === "passid") return [normalizedToken(record.passId)].filter(Boolean);
  return normalizedValues(record[field]);
}

function coverageUnitKeysForRecord(record = {}, fields = []) {
  const normalizedFields = arr(fields).map(normalizedToken).filter(Boolean);
  if (!normalizedFields.length) return [];
  const units = [""];
  for (const field of normalizedFields) {
    const values = coverageFieldValues(record, field);
    if (!values.length) return [];
    const next = [];
    for (const unit of units) {
      for (const value of values) next.push(`${unit}${unit ? "|" : ""}${field}:${value}`);
    }
    units.splice(0, units.length, ...next);
  }
  return units;
}

function coverageUnitKeyForDesiredUnit(unit = {}, fields = []) {
  return arr(fields)
    .map(normalizedToken)
    .filter(Boolean)
    .map((field) => {
      const value = unit[field]
        ?? unit[`${field}s`]
        ?? (field === "paletteprofile" ? unit.paletteProfile : undefined)
        ?? (field === "modeltype" ? unit.modelType : undefined)
        ?? (field === "effectname" ? unit.effectName : undefined)
        ?? (field === "passid" ? unit.passId : undefined)
        ?? unit[field.replace("_", "")]
        ?? unit[field.replaceAll("_", "")]
        ?? unit[field.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())]
        ?? unit[field.replaceAll("_", "")]
        ?? "";
      return `${field}:${normalizedToken(value)}`;
    })
    .join("|");
}

function durableCoverageUnitKeysForGoal(records = [], goal = {}) {
  const fields = completionCriteriaForGoal(goal).distinctCoverageFields;
  if (!fields.length) return new Set();
  const keys = new Set();
  for (const record of recordsForGoal(records, goal)) {
    if (!bool(record?.promotion?.durableCandidate)) continue;
    for (const key of coverageUnitKeysForRecord(record, fields)) keys.add(key);
  }
  return keys;
}

function missingDesiredCoverageUnits(records = [], goal = {}) {
  const criteria = completionCriteriaForGoal(goal);
  if (!criteria.distinctCoverageFields.length || !criteria.desiredCoverageUnits.length) return [];
  const covered = durableCoverageUnitKeysForGoal(records, goal);
  return criteria.desiredCoverageUnits
    .filter((unit) => !covered.has(coverageUnitKeyForDesiredUnit(unit, criteria.distinctCoverageFields)));
}

function recordMatchesGoal(record = {}, goal = {}) {
  const coverage = goal.coverage || {};
  const families = coverageList(coverage, "families");
  const paletteProfiles = coverageList(coverage, "paletteProfiles");
  const effects = coverageList(coverage, "effects");
  const targetScopes = coverageList(coverage, "targetScopes");
  const modelTypes = coverageList(coverage, "modelTypes");
  const reviewScopes = coverageList(coverage, "reviewScopes");
  const qualityDimensions = coverageList(coverage, "qualityDimensions");
  const timingSources = coverageList(coverage, "timingSources");
  const intentDimensions = coverageList(coverage, "intentDimensions");
  const reviewMethods = coverageList(coverage, "reviewMethods");
  const passIds = coverageList(coverage, "passIds");
  const hasStructuredCoverage = families.length
    || paletteProfiles.length
    || effects.length
    || targetScopes.length
    || modelTypes.length
    || reviewScopes.length
    || qualityDimensions.length
    || timingSources.length
    || intentDimensions.length
    || reviewMethods.length
    || passIds.length;
  if (!hasStructuredCoverage) return false;
  const experimentId = str(record.experimentId);

  const normalizedFamily = normalizedToken(record.family)
    || experimentId.split("-").slice(0, -1).join("_").replaceAll("-", "_");
  const normalizedExperiment = normalizedToken(experimentId);
  const recordIntentDimensions = normalizedValues(record.intentDimensions);
  const recordReviewMethods = normalizedValues(record.reviewMethods);
  if ((normalizedFamily.includes("creative_intent") || recordIntentDimensions.length)
    && !intentDimensions.length
    && !reviewMethods.length) {
    return false;
  }
  const familyMatch = !families.length || families.some((family) => normalizedExperiment.includes(family) || normalizedFamily.includes(family));
  const paletteMatch = !paletteProfiles.length || paletteProfiles.some((palette) => normalizedExperiment.includes(palette));
  const effectMatch = !effects.length || effects.includes(normalizedToken(record.effectName));
  const targetScopeMatch = matchesCoverage(targetScopesForRecord(record), targetScopes);
  const modelTypeMatch = !modelTypes.length || !arr(record.modelTypes).length || matchesCoverage(record.modelTypes, modelTypes);
  const reviewScopeMatch = matchesCoverage(record.reviewScopes, reviewScopes);
  const qualityDimensionMatch = matchesCoverage([...arr(record.qualityDimensions), ...arr(record.musicQualityDimensions)], qualityDimensions);
  const timingSourceMatch = matchesCoverage(record.timingSources, timingSources);
  const intentDimensionMatch = matchesCoverage(record.intentDimensions, intentDimensions);
  const reviewMethodMatch = matchesCoverage(record.reviewMethods, reviewMethods);
  const passIdMatch = !passIds.length || passIds.includes(normalizedToken(record.passId));
  return familyMatch
    && paletteMatch
    && effectMatch
    && targetScopeMatch
    && modelTypeMatch
    && reviewScopeMatch
    && qualityDimensionMatch
    && timingSourceMatch
    && intentDimensionMatch
    && reviewMethodMatch
    && passIdMatch;
}

function isPromisingBlockedRecord(record = {}, goal = {}, policy = {}) {
  const coverage = goal.coverage || {};
  const repeatableCoverage = coverageList(coverage, "families").length
    || coverageList(coverage, "effects").length
    || coverageList(coverage, "targetScopes").length
    || coverageList(coverage, "modelTypes").length
    || coverageList(coverage, "intentDimensions").length
    || coverageList(coverage, "reviewMethods").length
    || coverageList(coverage, "passIds").length;
  if (!repeatableCoverage) return false;
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

function durableRecordCountForGoal(records = [], goal = {}) {
  return recordsForGoal(records, goal).filter((record) => bool(record?.promotion?.durableCandidate)).length;
}

function videoAestheticGatePassed(goal = {}, artifacts = {}) {
  if (str(goal.goalId) !== "display.full_sequence.quality_v1") return true;
  const video = artifacts.videoAestheticScore || {};
  if (str(video.status) !== "ready") return true;
  return bool(video?.promotion?.evidenceEligible);
}

function goalEvidenceCovered(goal = {}, artifacts = {}, curriculum = {}) {
  const blockers = goalBlockers(goal, artifacts, curriculum);
  if (blockers.length) return false;
  if (!videoAestheticGatePassed(goal, artifacts)) return false;
  const criteria = completionCriteriaForGoal(goal);
  const records = arr(artifacts?.qualityRecords?.records);
  const selectorReadyPriorCount = promotedPriorsForGoal(arr(artifacts?.promotedPriors?.priors), goal).length;
  const durableCandidateCount = durableRecordCountForGoal(records, goal);
  const distinctCoverageUnitCount = durableCoverageUnitKeysForGoal(records, goal).size;
  return (criteria.minimumSelectorReadyPriorCount !== null && selectorReadyPriorCount >= criteria.minimumSelectorReadyPriorCount)
    || (criteria.minimumDurableCandidateCount !== null && durableCandidateCount >= criteria.minimumDurableCandidateCount)
    || (criteria.minimumDistinctCoverageUnitCount !== null && distinctCoverageUnitCount >= criteria.minimumDistinctCoverageUnitCount);
}

function hasNonRepeatableBlockedRecord(records = [], goal = {}, policy = {}) {
  return recordsForGoal(records, goal).some((record) => {
    const blockers = arr(record?.promotion?.blockers).map(str).filter(Boolean);
    return blockers.length
      && num(record?.quality?.latestOverallQuality) >= policy.minimumOverallQuality
      && !isPromisingBlockedRecord(record, goal, policy);
  });
}

function durableCriteriaStillNeedsCoverage(records = [], goal = {}) {
  const criteria = completionCriteriaForGoal(goal);
  return criteria.minimumDurableCandidateCount !== null
    && durableRecordCountForGoal(records, goal) < criteria.minimumDurableCandidateCount;
}

function supportsGeneratedCoverageGap(goal = {}) {
  const goalId = str(goal.goalId);
  return goalId === "layer.rgb_primary.basic"
    || goalId === "submodel.vendor_fixture.basic"
    || goalId === "creative.intent_match.v1"
    || goalId === "creative.intent_revision_comparison.v1"
    || goalId === "creative.intent_revision_variants.v1"
    || goalId === "target_transfer.compatibility_adaptation.v1"
    || goalId === "effect_fit.core_effects.v1"
    || goalId === "effect_fit.expanded_model_matrix.v1"
    || goalId === "music.structure_alignment.v1"
    || goalId === "display.full_sequence.quality_v1"
    || goalId.startsWith("display.video_aesthetic.");
}

function coverageGapAttemptStalled(goal = {}, artifacts = {}, policy = {}) {
  const latestQueue = arr(artifacts.controllerState?.nextQueue)[0] || {};
  const missingPassIds = arr(latestQueue.missingCoverageUnits)
    .map((unit) => normalizedToken(unit.passId || unit.pass || unit.pass_id))
    .filter(Boolean);
  const passResults = arr(artifacts.passRunnerSummary?.results);
  const attemptedMissingResults = missingPassIds.length
    ? passResults.filter((result) => missingPassIds.includes(normalizedToken(result.passId)))
    : [];
  const missingPassAttemptRejected = missingPassIds.length > 0
    && attemptedMissingResults.length === missingPassIds.length
    && attemptedMissingResults.every((result) => !bool(result.renderReviewEvidenceEligible));
  const latestAttempt = {
    goalId: str(latestQueue.goalId),
    reason: str(latestQueue.reason),
    missingCoverageUnitCount: arr(latestQueue.missingCoverageUnits).length,
    processedPasses: num(artifacts.passRunnerSummary?.processedPasses),
    acceptedEvidenceCount: num(artifacts.passRunnerSummary?.renderReviewAcceptedEvidenceCount),
    comparisonStatus: str(artifacts.videoAestheticAttemptComparison?.comparisonStatus),
    overallAestheticScore: num(artifacts.videoAestheticScore?.scores?.overallAestheticScore)
  };
  if (str(latestAttempt.goalId) === str(goal.goalId)
    && str(latestAttempt.reason) === "coverage_gap"
    && num(latestAttempt.missingCoverageUnitCount) > 0
    && num(latestAttempt.processedPasses) > 0
    && missingPassAttemptRejected) {
    return true;
  }
  return [latestAttempt, ...arr(artifacts.recentControllerAttempts)].some((attempt) => {
    if (str(attempt.goalId) !== str(goal.goalId)) return false;
    if (str(attempt.reason) !== "coverage_gap") return false;
    if (num(attempt.missingCoverageUnitCount) <= 0) return false;
    if (num(attempt.processedPasses) <= 0) return false;
    if (num(attempt.acceptedEvidenceCount) > 0) return false;

    const comparisonStatus = str(attempt.comparisonStatus);
    const overallScore = num(attempt.overallAestheticScore);
    return comparisonStatus === "blocked"
      || comparisonStatus === "regressed"
      || (overallScore > 0 && overallScore < policy.minimumOverallQuality);
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
    const distinctCoverageUnitCount = durableCoverageUnitKeysForGoal(records, goal).size;
    const missingCoverageUnits = missingDesiredCoverageUnits(records, goal);
    const blockers = new Set(goalBlockers(goal, artifacts, curriculum));
    const criteria = completionCriteriaForGoal(goal);
    const coveredByDeclaredStatus = str(goal.status) === "covered";
    const coveredBySelectorReadyPriors = criteria.minimumSelectorReadyPriorCount !== null
      && selectorReadyPriorCount >= criteria.minimumSelectorReadyPriorCount;
    const coveredByDurableEvidence = criteria.minimumDurableCandidateCount !== null
      && durableCandidateCount >= criteria.minimumDurableCandidateCount;
    const coveredByDistinctCoverage = criteria.minimumDistinctCoverageUnitCount !== null
      && distinctCoverageUnitCount >= criteria.minimumDistinctCoverageUnitCount;
    if (artifacts.missingArtifacts?.length && !goalRecords.length && !selectorReadyPriorCount) blockers.add("latest evidence artifacts unavailable");
    if (!videoAestheticGatePassed(goal, artifacts)) blockers.add("video aesthetic score below promotion threshold");
    if (coverageGapAttemptStalled(goal, artifacts, policy)) blockers.add("coverage gap attempt produced no accepted evidence");
    return {
      goalId: str(goal.goalId),
      areaId: str(goal.areaId),
      status: str(goal.status),
      priority: num(goal.priority),
      evidenceStatus: coveredByDeclaredStatus || coveredBySelectorReadyPriors || coveredByDurableEvidence || coveredByDistinctCoverage
        ? videoAestheticGatePassed(goal, artifacts) ? "covered" : "in_progress"
        : blockedPromisingCount
          ? "in_progress"
          : goalRecords.length || selectorReadyPriorCount
            ? "in_progress"
            : str(goal.status),
      selectorReadyPriorCount,
      durableCandidateCount,
      distinctCoverageUnitCount,
      missingCoverageUnitCount: missingCoverageUnits.length,
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

function videoAestheticSummary(artifacts = {}) {
  const artifact = artifacts.videoAestheticScore || {};
  const scores = artifact.scores || {};
  return {
    status: str(artifact.status),
    overallAestheticScore: round6(scores.overallAestheticScore),
    scoredWindowCount: num(artifact.scoredWindowCount),
    evidenceEligibleWindowCount: num(artifact.evidenceEligibleWindowCount),
    promotionEligible: bool(artifact?.promotion?.evidenceEligible),
    qualityDimensions: arr(artifact.qualityDimensions).map(str).filter(Boolean),
    recommendationCount: arr(artifact.recommendationSummary).length,
    ref: artifacts.refs?.videoAestheticScore || ""
  };
}

function videoAestheticAttemptSummary(artifacts = {}) {
  const artifact = artifacts.videoAestheticAttemptComparison || {};
  return {
    status: str(artifact.status),
    comparisonStatus: str(artifact.comparisonStatus),
    overallAestheticScoreDelta: round6(artifact.summary?.overallAestheticScoreDelta),
    improvedDimensionCount: num(artifact.summary?.improvedDimensionCount),
    regressedDimensionCount: num(artifact.summary?.regressedDimensionCount),
    promotionEligible: bool(artifact.promotionEligible),
    ref: artifacts.refs?.videoAestheticAttemptComparison || ""
  };
}

function weakVideoAestheticDimensions(video = {}, threshold = 0.65) {
  const scores = video.scores || {};
  const dimensions = [
    ["display_evolution", scores.displayEvolution],
    ["pacing_variety", scores.pacingVariety],
    ["transition_flow", scores.transitionFlow],
    ["focal_clarity", scores.focalClarity],
    ["visual_balance", scores.visualBalance],
    ["motion_interest", scores.motionInterest],
    ["color_discipline", scores.colorDiscipline],
    ["clutter_control", scores.clutterControl],
    ["quality_consistency", scores.qualityConsistency]
  ];
  return dimensions
    .filter(([, value]) => value !== null && value !== undefined && value !== "" && Number.isFinite(num(value, NaN)) && num(value) < threshold)
    .sort((left, right) => num(left[1]) - num(right[1]))
    .map(([dimension, value]) => ({ dimension, score: round6(value) }));
}

function videoAestheticAttemptStrategy(artifacts = {}) {
  const comparison = artifacts.videoAestheticAttemptComparison || {};
  const comparisonStatus = str(comparison.comparisonStatus);
  const previousStrategy = str(arr(artifacts.controllerState?.nextQueue)[0]?.nextStrategy)
    || str(arr(artifacts.controllerState?.nextQueue)[0]?.avoidStrategy)
    || "simultaneous_display_balance_revision";
  const weakDimensions = new Set(weakVideoAestheticDimensions(artifacts.videoAestheticScore || {}).map((row) => row.dimension));
  const recentIneffectiveStrategies = new Set(arr(artifacts.recentVideoAestheticAttempts)
    .filter((row) => ["neutral", "regressed"].includes(str(row.comparisonStatus)))
    .map((row) => str(row.nextStrategy))
    .filter(Boolean));
  if (comparisonStatus === "improved") {
    if (
      previousStrategy === "rgb_primary_color_discipline_repair"
      && (weakDimensions.has("visual_balance") || weakDimensions.has("pacing_variety"))
    ) {
      return {
        previousStrategy,
        avoidStrategy: "",
        nextStrategy: "rgb_primary_structure_balance_pacing_repair",
        reason: "previous RGB color discipline attempt improved, but visual balance or pacing remained weak"
      };
    }
    return {
      previousStrategy,
      avoidStrategy: "",
      nextStrategy: previousStrategy === "regional_focus_contrast" && weakDimensions.has("color_discipline")
        ? "rgb_primary_color_discipline_repair"
        : previousStrategy || "simultaneous_display_balance",
      reason: previousStrategy
        ? `previous video aesthetic attempt improved with ${previousStrategy}`
        : ""
    };
  }
  if (!["neutral", "regressed"].includes(comparisonStatus)) {
    return {
      previousStrategy: "",
      avoidStrategy: "",
      nextStrategy: "simultaneous_display_balance",
      reason: ""
    };
  }
  recentIneffectiveStrategies.add(previousStrategy);
  const nextStrategy = VIDEO_AESTHETIC_STRATEGIES.find((strategy) => !recentIneffectiveStrategies.has(strategy))
    || (previousStrategy === "section_window_pacing_balance" ? "regional_focus_contrast" : "section_window_pacing_balance");
  return {
    previousStrategy,
    avoidStrategy: [...recentIneffectiveStrategies].join(","),
    nextStrategy,
    reason: recentIneffectiveStrategies.size > 1
      ? `recent video aesthetic attempts were ineffective for ${[...recentIneffectiveStrategies].join(", ")}`
      : `previous video aesthetic attempt was ${comparisonStatus}`
  };
}

function videoAestheticImprovementQueue(goal = {}, artifacts = {}, policy = {}) {
  if (str(goal.goalId) !== "display.full_sequence.quality_v1") return [];
  const video = artifacts.videoAestheticScore || {};
  if (str(video.status) !== "ready") return [];
  const overall = num(video.scores?.overallAestheticScore, NaN);
  const weakDimensions = weakVideoAestheticDimensions(video);
  const strategy = videoAestheticAttemptStrategy(artifacts);
  const weakDimensionKeys = new Set(weakDimensions.map((row) => row.dimension));
  const shouldContinuePromotionEligibleRgbRepair =
    strategy.nextStrategy === "rgb_primary_structure_balance_pacing_repair"
    && (weakDimensionKeys.has("visual_balance") || weakDimensionKeys.has("pacing_variety"));
  if (
    !Number.isFinite(overall)
    || ((overall >= policy.minimumOverallQuality || bool(video?.promotion?.evidenceEligible)) && !shouldContinuePromotionEligibleRgbRepair)
  ) return [];
  return [{
    queueId: `quality-controller:${str(goal.goalId)}:video-aesthetic-improvement`,
    goalId: str(goal.goalId),
    priority: 1,
    reason: "coverage_gap",
    improvementSource: "video_aesthetic_score",
    previousAttemptStatus: str(artifacts.videoAestheticAttemptComparison?.comparisonStatus),
    avoidStrategy: strategy.avoidStrategy,
    nextStrategy: strategy.nextStrategy,
    overallAestheticScore: round6(overall),
    weakDimensions,
    recommendations: arr(video.recommendationSummary).map(str).filter(Boolean),
    selectionHint: strategy.reason
      ? `${strategy.reason}; try ${strategy.nextStrategy} for ${weakDimensions.slice(0, 3).map((row) => row.dimension).join(", ")}.`
      : weakDimensions.length
      ? `Generate display review passes that improve ${weakDimensions.slice(0, 3).map((row) => row.dimension).join(", ")}.`
      : "Generate display review passes that improve the whole-display aesthetic score."
  }];
}

function chooseNextQueue({ curriculum = {}, artifacts = {}, maxQueue = DEFAULT_MAX_QUEUE } = {}) {
  const policy = promotionPolicy(curriculum);
  const records = arr(artifacts?.qualityRecords?.records);
  const goals = activeGoals(curriculum).filter((goal) => !goalEvidenceCovered(goal, artifacts, curriculum));
  const stalledGoalIds = new Set(goals
    .filter((goal) => coverageGapAttemptStalled(goal, artifacts, policy))
    .map((goal) => str(goal.goalId))
    .filter(Boolean));
  const selectableGoals = goals.filter((goal) => !stalledGoalIds.has(str(goal.goalId)));
  if (artifacts.missingArtifacts?.length) {
    return {
      selectedGoal: selectableGoals[0] || goals[0] || null,
      nextQueue: [],
      decision: {
        selectedGoalId: str((selectableGoals[0] || goals[0])?.goalId),
        selectionReason: "missing_latest_evidence",
        blockedBy: artifacts.missingArtifacts,
        nextAction: "await_evidence"
      }
    };
  }

  const unblockedGoals = selectableGoals.filter((goal) => !goalBlockers(goal, artifacts, curriculum).length);

  for (const goal of unblockedGoals) {
    const queue = videoAestheticImprovementQueue(goal, artifacts, policy);
    if (queue.length) {
      return {
        selectedGoal: goal,
        nextQueue: queue,
        decision: {
          selectedGoalId: str(goal.goalId),
          selectionReason: "video_aesthetic_score_below_threshold",
          blockedBy: [],
          nextAction: "plan_goal_coverage"
        }
      };
    }
  }

  for (const goal of unblockedGoals) {
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

  const coverageGapGoals = unblockedGoals.filter(supportsGeneratedCoverageGap);
  const nextGoal = coverageGapGoals.find((goal) => missingDesiredCoverageUnits(records, goal).length && !hasNonRepeatableBlockedRecord(records, goal, policy))
    || coverageGapGoals.find((goal) => !recordsForGoal(records, goal).length && !hasNonRepeatableBlockedRecord(records, goal, policy))
    || coverageGapGoals.find((goal) => durableCriteriaStillNeedsCoverage(records, goal) && !hasNonRepeatableBlockedRecord(records, goal, policy))
    || coverageGapGoals.find((goal) => !durableRecordCountForGoal(records, goal) && !hasNonRepeatableBlockedRecord(records, goal, policy))
    || null;
  if (nextGoal) {
    const missingCoverageUnits = missingDesiredCoverageUnits(records, nextGoal);
    return {
      selectedGoal: nextGoal,
      nextQueue: [{
        queueId: `quality-controller:${str(nextGoal.goalId) || "none"}:coverage-gap`,
        goalId: str(nextGoal.goalId),
        priority: 1,
        reason: "coverage_gap",
        missingCoverageUnits,
        selectionHint: arr(nextGoal.nextSelectionHints)[0] || "create the first bounded coverage run for this curriculum goal"
      }],
      decision: {
        selectedGoalId: str(nextGoal?.goalId),
        selectionReason: "coverage_gap",
        blockedBy: [],
        nextAction: "plan_goal_coverage"
      }
    };
  }

  const blockedGoal = selectableGoals.find((goal) => goalBlockers(goal, artifacts, curriculum).length);
  if (blockedGoal) {
    const blockers = goalBlockers(blockedGoal, artifacts, curriculum);
    return {
      selectedGoal: blockedGoal,
      nextQueue: [{
        queueId: `quality-controller:${str(blockedGoal.goalId) || "none"}:blocked-coverage-gap`,
        goalId: str(blockedGoal.goalId),
        priority: 1,
        reason: "coverage_gap",
        blockedBy: blockers,
        selectionHint: arr(blockedGoal.nextSelectionHints)[0] || blockers[0] || "resolve the curriculum blocker before advancing"
      }],
      decision: {
        selectedGoalId: str(blockedGoal.goalId),
        selectionReason: "blocked_coverage_gap",
        blockedBy: blockers,
        nextAction: "resolve_blocker"
      }
    };
  }

  const nonRepeatableGoal = unblockedGoals.find((goal) => hasNonRepeatableBlockedRecord(records, goal, policy));
  if (nonRepeatableGoal) {
    return {
      selectedGoal: nonRepeatableGoal,
      nextQueue: [],
      decision: {
        selectedGoalId: str(nonRepeatableGoal.goalId),
        selectionReason: "nonrepeatable_regressed_evidence",
        blockedBy: ["current evidence is blocked but not repeatable by the existing curriculum strategy"],
        nextAction: "needs_strategy_expansion"
      }
    };
  }

  if (stalledGoalIds.size) {
    return {
      selectedGoal: goals.find((goal) => stalledGoalIds.has(str(goal.goalId))) || null,
      nextQueue: [],
      decision: {
        selectedGoalId: [...stalledGoalIds][0] || "",
        selectionReason: "stalled_coverage_gap",
        blockedBy: ["coverage gap attempt produced no accepted evidence"],
        nextAction: "await_intervention"
      }
    };
  }

  return {
    selectedGoal: null,
    nextQueue: [],
    decision: {
      selectedGoalId: "",
      selectionReason: "no_active_goals",
      blockedBy: [],
      nextAction: "idle"
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
    videoAestheticSummary: videoAestheticSummary(artifacts),
    videoAestheticAttemptSummary: videoAestheticAttemptSummary(artifacts),
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
