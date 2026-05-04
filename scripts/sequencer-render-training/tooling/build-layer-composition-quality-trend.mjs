#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

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

function round6(value) {
  return Math.round(num(value) * 1_000_000) / 1_000_000;
}

function average(values = []) {
  const rows = arr(values).map((value) => num(value, NaN)).filter(Number.isFinite);
  return rows.length ? rows.reduce((sum, value) => sum + value, 0) / rows.length : 0;
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

function safeReadJson(filePath = "") {
  const resolved = resolvePath(filePath);
  if (!resolved || !fs.existsSync(resolved)) return null;
  try {
    return readJson(resolved);
  } catch {
    return null;
  }
}

function trendStatus(delta, threshold = 0.02) {
  if (delta >= threshold) return "improving";
  if (delta <= -threshold) return "regressing";
  return "stable";
}

function recordKey(record = {}) {
  return [
    str(record.experimentId),
    str(record.passId),
    str(record.effectName),
    arr(record.leadTargets).join("|")
  ].join("::");
}

function passMetadata(plan = {}, experimentId = "", passId = "") {
  const experiment = arr(plan.experiments).find((row) => str(row.experimentId) === str(experimentId)) || {};
  const pass = arr(experiment.passes).find((row) => str(row.passId) === str(passId)) || {};
  const placements = arr(pass.placements);
  return {
    family: str(experiment.family),
    targetScopes: [...new Set(placements.map((placement) => str(placement.targetScope)).filter(Boolean))],
    modelTypes: [...new Set(placements.map((placement) => str(placement.modelType)).filter(Boolean))],
    geometryProfiles: [...new Set(placements.map((placement) => str(placement.geometryProfile)).filter(Boolean))],
    changeType: str(pass.changeType)
  };
}

function loadRunRecords(runRoot = "", runIndex = 0) {
  const root = resolvePath(runRoot);
  const summaryPath = path.join(root, "pass-runner-summary.json");
  const summary = safeReadJson(summaryPath);
  if (!summary) return { root, summaryPath, runRecordCount: 0, evidenceRecords: [], observationRecords: [] };
  const plan = safeReadJson(path.join(root, "training-plan.json")) || {};
  const generatedAt = str(summary.generatedAt);
  const records = arr(summary.results)
    .filter((result) => str(result.renderReviewQualityRef))
    .map((result) => {
      const quality = safeReadJson(result.renderReviewQualityRef) || {};
      const review = safeReadJson(quality.renderReviewRef || result.renderReviewRef) || {};
      const scores = review.qualityScores || {};
      const metrics = review.deterministicMetrics || {};
      const qualification = review.evidenceQualification || quality.evidenceQualification || {};
      const evidenceEligible = Boolean(result.renderReviewEvidenceEligible || quality.evidenceEligible || qualification.eligible);
      const metadata = passMetadata(plan, result.experimentId || quality.experimentId, result.passId || quality.passId);
      return {
        runIndex,
        runRoot: root,
        runId: str(plan.runId || quality.runId || summary.runId),
        runGeneratedAt: generatedAt,
        experimentId: str(result.experimentId || quality.experimentId),
        passId: str(result.passId || quality.passId),
        family: metadata.family,
        targetScopes: metadata.targetScopes,
        modelTypes: metadata.modelTypes,
        geometryProfiles: metadata.geometryProfiles,
        changeType: metadata.changeType,
        decision: str(result.renderReviewDecision || quality.decision || review.critique?.decision),
        measurementStatus: str(result.renderReviewMeasurementStatus || quality.measurementStatus || qualification.status),
        evidenceEligible,
        qualityRef: str(result.renderReviewQualityRef),
        renderReviewRef: str(quality.renderReviewRef || result.renderReviewRef),
        effectName: str(review.intent?.effectName),
        leadTargets: arr(review.intent?.targetHierarchy?.leadTargets).map(str).filter(Boolean),
        plannedEffectCount: num(qualification.plannedEffectCount),
        plannedTargetCount: num(qualification.plannedTargetCount),
        overallQuality: num(scores.overallQuality ?? result.renderReviewOverallQuality),
        visualReadability: num(scores.visualReadability),
        intentMatch: num(scores.intentMatch),
        motionCoherence: num(scores.motionCoherence),
        activeCoverageMean: num(metrics.activeCoverageMean),
        activeNodeRatioPeak: num(metrics.activeNodeRatioPeak),
        activeTargetNodeRatioPeak: num(metrics.activeTargetNodeRatioPeak),
        temporalMotionMean: num(metrics.temporalMotionMean),
        blankRisk: num(metrics.blankRisk),
        qualificationReasons: arr(qualification.reasons).map(str).filter(Boolean)
      };
    });
  return {
    root,
    summaryPath,
    runId: str(plan.runId || summary.runId),
    generatedAt,
    runRecordCount: records.length,
    evidenceRecords: records.filter((record) => record.evidenceEligible),
    observationRecords: records.filter((record) => !record.evidenceEligible)
  };
}

function groupEvidence(records = []) {
  const groups = new Map();
  for (const record of records) {
    const key = recordKey(record);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }
  return [...groups.entries()].map(([key, rows]) => {
    const sortedRows = [...rows].sort((left, right) => left.runIndex - right.runIndex || str(left.runGeneratedAt).localeCompare(str(right.runGeneratedAt)));
    const first = sortedRows[0] || {};
    const latest = sortedRows[sortedRows.length - 1] || {};
    const previous = sortedRows.length > 1 ? sortedRows[sortedRows.length - 2] : null;
    const overallDeltaFromFirst = round6(num(latest.overallQuality) - num(first.overallQuality));
    const overallDeltaFromPrevious = previous ? round6(num(latest.overallQuality) - num(previous.overallQuality)) : 0;
    return {
      key,
      experimentId: str(latest.experimentId),
      passId: str(latest.passId),
      family: str(latest.family),
      targetScopes: arr(latest.targetScopes),
      modelTypes: arr(latest.modelTypes),
      geometryProfiles: arr(latest.geometryProfiles),
      changeType: str(latest.changeType),
      effectName: str(latest.effectName),
      leadTargets: arr(latest.leadTargets),
      sampleCount: sortedRows.length,
      firstOverallQuality: round6(first.overallQuality),
      previousOverallQuality: previous ? round6(previous.overallQuality) : null,
      latestOverallQuality: round6(latest.overallQuality),
      overallDeltaFromFirst,
      overallDeltaFromPrevious,
      trendStatus: sortedRows.length > 1 ? trendStatus(overallDeltaFromFirst) : "single_run_baseline",
      latestDecision: str(latest.decision),
      latestRenderReviewRef: str(latest.renderReviewRef),
      latestQualityRef: str(latest.qualityRef),
      samples: sortedRows.map((record) => ({
        runIndex: record.runIndex,
        runId: str(record.runId),
        runRoot: str(record.runRoot),
        overallQuality: round6(record.overallQuality),
        visualReadability: round6(record.visualReadability),
        intentMatch: round6(record.intentMatch),
        motionCoherence: round6(record.motionCoherence),
        activeNodeRatioPeak: round6(record.activeNodeRatioPeak),
        activeTargetNodeRatioPeak: round6(record.activeTargetNodeRatioPeak),
        temporalMotionMean: round6(record.temporalMotionMean)
      }))
    };
  }).sort((left, right) => left.key.localeCompare(right.key));
}

export function buildLayerCompositionQualityTrend({ runRoots = [], outPath = "" } = {}) {
  const roots = arr(runRoots).map(resolvePath).filter(Boolean);
  const runSummaries = roots.map(loadRunRecords);
  const evidenceRecords = runSummaries.flatMap((run) => run.evidenceRecords);
  const observationRecords = runSummaries.flatMap((run) => run.observationRecords);
  const groups = groupEvidence(evidenceRecords);
  const latestByGroup = groups.map((group) => group.latestOverallQuality).filter(Number.isFinite);
  const previousByGroup = groups.map((group) => group.previousOverallQuality).filter(Number.isFinite);
  const latestMean = round6(average(latestByGroup));
  const previousMean = previousByGroup.length ? round6(average(previousByGroup)) : null;
  const overallDelta = previousMean === null ? 0 : round6(latestMean - previousMean);
  const artifact = {
    artifactType: "layer_composition_quality_trend_v1",
    artifactVersion: 1,
    generatedAt: new Date().toISOString(),
    runCount: runSummaries.length,
    runRoots: roots,
    summary: {
      evidenceRecordCount: evidenceRecords.length,
      observationRecordCount: observationRecords.length,
      comparableGroupCount: groups.filter((group) => group.sampleCount > 1).length,
      qualityGroupCount: groups.length,
      latestEligibleQualityMean: latestMean,
      previousEligibleQualityMean: previousMean,
      latestQualityDeltaFromPrevious: overallDelta,
      qualityTrendStatus: previousMean === null ? "single_run_baseline" : trendStatus(overallDelta),
      improvingGroupCount: groups.filter((group) => group.trendStatus === "improving").length,
      stableGroupCount: groups.filter((group) => group.trendStatus === "stable").length,
      regressingGroupCount: groups.filter((group) => group.trendStatus === "regressing").length,
      singleRunBaselineGroupCount: groups.filter((group) => group.trendStatus === "single_run_baseline").length
    },
    runs: runSummaries.map((run) => ({
      runRoot: run.root,
      runId: str(run.runId),
      generatedAt: str(run.generatedAt),
      runRecordCount: run.runRecordCount,
      evidenceRecordCount: run.evidenceRecords.length,
      observationRecordCount: run.observationRecords.length,
      eligibleQualityMean: round6(average(run.evidenceRecords.map((record) => record.overallQuality)))
    })),
    groups,
    observationRecords: observationRecords.map((record) => ({
      runIndex: record.runIndex,
      runRoot: str(record.runRoot),
      experimentId: str(record.experimentId),
      passId: str(record.passId),
      decision: str(record.decision),
      measurementStatus: str(record.measurementStatus),
      qualificationReasons: arr(record.qualificationReasons)
    }))
  };
  const resolvedOutPath = resolvePath(outPath);
  if (resolvedOutPath) writeJson(resolvedOutPath, artifact);
  return artifact;
}

function parseArgs(argv = []) {
  const args = { runRoots: [], outPath: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = str(argv[index]);
    if (arg === "--run-root") args.runRoots.push(argv[++index]);
    else if (arg === "--out") args.outPath = argv[++index];
    else if (arg === "--help") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return `Usage:
  node scripts/sequencer-render-training/tooling/build-layer-composition-quality-trend.mjs --run-root <run-dir> [--run-root <previous-run-dir>] --out quality-trend.json
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.runRoots.length) {
    process.stdout.write(usage());
    process.exit(args.help ? 0 : 1);
  }
  const artifact = buildLayerCompositionQualityTrend(args);
  if (args.outPath) process.stdout.write(`${resolvePath(args.outPath)}\n`);
  else process.stdout.write(`${JSON.stringify(artifact, null, 2)}\n`);
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch((error) => {
    console.error(error?.stack || String(error));
    process.exit(1);
  });
}
