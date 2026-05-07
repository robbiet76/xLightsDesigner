#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function num(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

function round6(value) {
  return Math.round(num(value) * 1_000_000) / 1_000_000;
}

function statsRange(stats = {}) {
  return num(stats.max, NaN) - num(stats.min, NaN);
}

function dimensionStatus(stats = {}) {
  const min = num(stats.min, NaN);
  const max = num(stats.max, NaN);
  const mean = num(stats.mean, NaN);
  const range = statsRange(stats);
  if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(mean)) return "missing";
  if (range <= 0.000001) {
    if (mean >= 0.98) return "saturated_high";
    if (mean <= 0.02) return "saturated_low";
    return "constant";
  }
  if (range < 0.05 && mean >= 0.9) return "compressed_high";
  if (range < 0.05 && mean <= 0.25) return "compressed_low";
  if (range < 0.1) return "low_variance";
  return "varied";
}

function issueForScoreDimension(key = "", stats = {}) {
  const status = dimensionStatus(stats);
  const mean = num(stats.mean, NaN);
  if (["saturated_high", "compressed_high"].includes(status)) {
    return {
      dimension: key,
      status,
      severity: "high",
      finding: `${key} is too close to perfect across accepted production references.`,
      implication: "This dimension cannot distinguish mature production quality from merely nonblank output.",
      recommendation: "Add richer full-sequence criteria or require human calibration notes before using this dimension as a training target."
    };
  }
  if (["saturated_low", "compressed_low"].includes(status)) {
    return {
      dimension: key,
      status,
      severity: mean <= 0.15 ? "high" : "medium",
      finding: `${key} is compressed low across accepted production references.`,
      implication: "The scoring rule may be penalizing normal production-sequence evidence instead of actual weakness.",
      recommendation: "Inspect the feature basis and retune this dimension against human-reviewed production examples."
    };
  }
  if (status === "constant" || status === "low_variance") {
    return {
      dimension: key,
      status,
      severity: "medium",
      finding: `${key} has low variance across accepted references.`,
      implication: "The dimension may still be useful as a gate, but it is weak as an optimization target.",
      recommendation: "Use this as supporting evidence only until additional section/window-level calibration creates a wider range."
    };
  }
  return null;
}

function topReferences(references = [], scoreKey = "", direction = "lowest", count = 3) {
  const rows = arr(references)
    .map((row) => ({
      sequenceId: str(row.sequenceId),
      value: num(row.scores?.[scoreKey], NaN),
      overallQuality: num(row.overallQuality, NaN),
      metrics: row.metrics || {},
      features: row.features || {}
    }))
    .filter((row) => Number.isFinite(row.value))
    .sort((left, right) => direction === "highest" ? right.value - left.value : left.value - right.value);
  return rows.slice(0, count).map((row) => ({
    sequenceId: row.sequenceId,
    value: round6(row.value),
    overallQuality: round6(row.overallQuality),
    activeColorClassMean: round6(row.metrics.activeColorClassMean),
    temporalColorDeltaMean: round6(row.metrics.temporalColorDeltaMean),
    meanActiveUniqueColorCount: round6(row.features.meanSampledFrameActiveUniqueColorCount),
    meanActiveColorClassCount: round6(row.features.meanSampledFrameActiveColorClassCount)
  }));
}

export function buildProductionScorerCalibrationDiagnostics({
  baselinePath = "",
  outPath = ""
} = {}) {
  const resolvedBaselinePath = resolvePath(baselinePath);
  if (!resolvedBaselinePath || !fs.existsSync(resolvedBaselinePath)) {
    throw new Error(`baseline not found: ${resolvedBaselinePath || "(missing)"}`);
  }
  const baseline = readJson(resolvedBaselinePath);
  const resolvedOutPath = resolvePath(outPath || path.join(path.dirname(resolvedBaselinePath), "production-scorer-calibration-diagnostics.json"));
  const scoreFindings = Object.entries(baseline.scoreRanges || {})
    .map(([key, value]) => issueForScoreDimension(key, value))
    .filter(Boolean);
  const metricFindings = Object.entries(baseline.metricRanges || {})
    .map(([key, value]) => ({ metric: key, status: dimensionStatus(value), range: round6(statsRange(value)), stats: value }))
    .filter((row) => row.status !== "varied");

  const highSeverityCount = scoreFindings.filter((row) => row.severity === "high").length;
  const artifact = {
    artifactType: "production_scorer_calibration_diagnostics_v1",
    artifactVersion: 1,
    generatedAt: new Date().toISOString(),
    baselinePath: resolvedBaselinePath,
    referenceCount: num(baseline.summary?.acceptedReferenceCount, arr(baseline.references).length),
    status: highSeverityCount ? "scorer_calibration_needed" : "usable_with_review",
    policy: {
      calibrationOnly: true,
      requiresHumanReviewBeforeScorerPromotion: true,
      doNotOptimizeGenerationDirectlyAgainstCurrentScores: highSeverityCount > 0
    },
    summary: {
      scoreFindingCount: scoreFindings.length,
      highSeverityScoreFindingCount: highSeverityCount,
      metricLowVarianceCount: metricFindings.length,
      primaryRisk: highSeverityCount
        ? "Current scoring has saturated/compressed dimensions and should not be used as the sole training objective."
        : "Current scoring still requires human review before promotion."
    },
    scoreFindings,
    metricFindings,
    dimensionExamples: {
      lowestColorDiscipline: topReferences(baseline.references, "colorDiscipline", "lowest"),
      highestColorDiscipline: topReferences(baseline.references, "colorDiscipline", "highest"),
      lowestOverallQuality: topReferences(baseline.references, "overallQuality", "lowest"),
      highestOverallQuality: topReferences(baseline.references, "overallQuality", "highest")
    },
    recommendedNextActions: [
      "Capture human notes for several production MP4/contact-sheet references.",
      "Split full-sequence scoring from section/effect scoring where the evidence shape differs.",
      "Replace saturated accept-style dimensions with range-aware dimensions for energy arc, focal handoff, section contrast, palette purpose, and motif development.",
      "Treat current overall scores as diagnostic baselines, not optimization targets."
    ]
  };
  writeJson(resolvedOutPath, artifact);
  return { ...artifact, outPath: resolvedOutPath };
}

function parseArgs(argv = []) {
  const args = { baselinePath: "", outPath: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = str(argv[index]);
    if (arg === "--baseline") args.baselinePath = argv[++index];
    else if (arg === "--out") args.outPath = argv[++index];
    else if (arg === "--help") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return `Usage:
  node scripts/sequencer-render-training/tooling/build-production-scorer-calibration-diagnostics.mjs \\
    --baseline var/benchmarks/production-sequence-read/video-review-owned/production-video-calibration-baseline.json \\
    --out var/benchmarks/production-sequence-read/video-review-owned/production-scorer-calibration-diagnostics.json
`;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help || !args.baselinePath) {
      process.stdout.write(usage());
      process.exit(args.help ? 0 : 1);
    }
    const artifact = buildProductionScorerCalibrationDiagnostics(args);
    process.stdout.write(`${JSON.stringify({
      ok: true,
      outPath: artifact.outPath,
      status: artifact.status,
      summary: artifact.summary
    }, null, 2)}\n`);
  } catch (error) {
    console.error(error?.stack || String(error));
    process.exit(1);
  }
}
