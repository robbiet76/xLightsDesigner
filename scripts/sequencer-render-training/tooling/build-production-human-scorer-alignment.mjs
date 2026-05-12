#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { REVIEW_CHOICES } from "./build-production-human-review-calibration.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const DIMENSION_MAP = {
  energyArc: ["energyArc"],
  sectionContrast: ["sectionContrast"],
  paletteEvolution: ["paletteEvolution"],
  focalHandoff: ["modelAwareFocalHandoff"],
  targetHierarchy: ["resolvedActivityRatio", "leadTargetChangeRatio", "leadRegionChangeRatio"],
  overallFit: ["combinedCalibrationScore"]
};

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

function average(values = []) {
  const rows = arr(values).map((value) => num(value, NaN)).filter(Number.isFinite);
  return rows.length ? rows.reduce((sum, value) => sum + value, 0) / rows.length : null;
}

function scoreForChoice(metric = "", choice = "") {
  const option = arr(REVIEW_CHOICES[metric]?.options).find((row) => str(row.id) === str(choice));
  return option && Number.isFinite(option.score) ? option.score : null;
}

function automatedValueForMetric(review = {}, metric = "") {
  const dimensions = review.profileSnapshot?.dimensions || {};
  const keys = DIMENSION_MAP[metric] || [];
  if (metric === "overallFit") {
    return num(review.profileSnapshot?.combinedCalibrationScore, NaN);
  }
  return average(keys.map((key) => dimensions[key]));
}

function pearson(rows = []) {
  const pairs = arr(rows)
    .map((row) => [num(row.humanScore, NaN), num(row.automatedScore, NaN)])
    .filter(([left, right]) => Number.isFinite(left) && Number.isFinite(right));
  if (pairs.length < 2) return null;
  const meanX = average(pairs.map(([x]) => x));
  const meanY = average(pairs.map(([, y]) => y));
  const numerator = pairs.reduce((sum, [x, y]) => sum + ((x - meanX) * (y - meanY)), 0);
  const denomX = Math.sqrt(pairs.reduce((sum, [x]) => sum + ((x - meanX) ** 2), 0));
  const denomY = Math.sqrt(pairs.reduce((sum, [, y]) => sum + ((y - meanY) ** 2), 0));
  if (denomX <= 0 || denomY <= 0) return null;
  return round6(numerator / (denomX * denomY));
}

function alignmentStatus(correlation, meanAbsoluteError) {
  if (!Number.isFinite(correlation)) return "needs_more_variance";
  if (correlation >= 0.65 && meanAbsoluteError <= 0.18) return "aligned";
  if (correlation >= 0.35 && meanAbsoluteError <= 0.25) return "partially_aligned";
  if (correlation < 0) return "inverted_or_misaligned";
  return "weak_alignment";
}

function recommendationForStatus(status = "") {
  if (status === "aligned") return "Use as a supporting calibration target.";
  if (status === "partially_aligned") return "Use with human-calibrated guardrails and collect more examples.";
  if (status === "inverted_or_misaligned") return "Do not optimize against this automated dimension until retuned.";
  if (status === "needs_more_variance") return "Collect more reviewed references or finer-grained section reviews.";
  return "Treat as diagnostic evidence only.";
}

function metricAlignment(metric = "", reviews = []) {
  const rows = arr(reviews)
    .filter((row) => str(row.status) === "reviewed" && str(row.recommendation) === "approve")
    .map((row) => {
      const humanScore = scoreForChoice(metric, row.metricChoices?.[metric]);
      const automatedScore = automatedValueForMetric(row, metric);
      const delta = Number.isFinite(humanScore) && Number.isFinite(automatedScore)
        ? automatedScore - humanScore
        : NaN;
      return {
        sequenceId: str(row.sequenceId),
        choice: str(row.metricChoices?.[metric]),
        humanScore: Number.isFinite(humanScore) ? round6(humanScore) : null,
        automatedScore: Number.isFinite(automatedScore) ? round6(automatedScore) : null,
        delta: Number.isFinite(delta) ? round6(delta) : null,
        absoluteError: Number.isFinite(delta) ? round6(Math.abs(delta)) : null
      };
    })
    .filter((row) => row.humanScore !== null && row.automatedScore !== null);
  const meanAbsoluteError = average(rows.map((row) => row.absoluteError));
  const meanDelta = average(rows.map((row) => row.delta));
  const correlation = pearson(rows);
  const status = alignmentStatus(correlation, meanAbsoluteError);
  const outliers = [...rows]
    .sort((left, right) => num(right.absoluteError) - num(left.absoluteError))
    .slice(0, 3);
  return {
    metric,
    mappedAutomatedDimensions: DIMENSION_MAP[metric] || [],
    reviewedCount: rows.length,
    humanMean: round6(average(rows.map((row) => row.humanScore))),
    automatedMean: round6(average(rows.map((row) => row.automatedScore))),
    meanDelta: round6(meanDelta),
    meanAbsoluteError: round6(meanAbsoluteError),
    correlation,
    status,
    recommendation: recommendationForStatus(status),
    outliers,
    rows
  };
}

export function buildProductionHumanScorerAlignment({
  humanCalibrationPath = "",
  outPath = ""
} = {}) {
  const resolvedHumanPath = resolvePath(humanCalibrationPath);
  if (!resolvedHumanPath || !fs.existsSync(resolvedHumanPath)) {
    throw new Error(`human calibration not found: ${resolvedHumanPath || "(missing)"}`);
  }
  const calibration = readJson(resolvedHumanPath);
  const resolvedOutPath = resolvePath(outPath || path.join(path.dirname(resolvedHumanPath), "production-human-scorer-alignment.json"));
  const metricAlignments = Object.keys(REVIEW_CHOICES).map((metric) => metricAlignment(metric, calibration.reviews));
  const alignedCount = metricAlignments.filter((row) => row.status === "aligned").length;
  const riskyCount = metricAlignments.filter((row) => ["inverted_or_misaligned", "weak_alignment"].includes(row.status)).length;
  const artifact = {
    artifactType: "production_human_scorer_alignment_v1",
    artifactVersion: 1,
    generatedAt: new Date().toISOString(),
    humanCalibrationPath: resolvedHumanPath,
    metricScope: "full_sequence_render",
    policy: {
      calibrationOnly: true,
      doNotTrainDirectlyOnSourceSequences: true,
      generatedTrainingMayUseHumanTargets: str(calibration.status) === "approved",
      useAlignedAutomatedDimensionsOnlyForOptimization: true
    },
    summary: {
      humanCalibrationStatus: str(calibration.status),
      reviewedReferenceCount: num(calibration.summary?.reviewed, 0),
      metricCount: metricAlignments.length,
      alignedMetricCount: alignedCount,
      riskyMetricCount: riskyCount,
      primaryRisk: riskyCount
        ? "Some automated dimensions disagree with human review and should not be used as direct optimization targets."
        : "Automated dimensions are usable as supporting calibration signals, still anchored by human review."
    },
    metricAlignments,
    recommendedNextActions: [
      "Use human metric scores as the target labels for full-sequence generated-candidate evaluation.",
      "Retune or replace automated dimensions marked weak/inverted before using them as unattended optimization objectives.",
      "Collect section-level human reviews next so full-sequence labels can be decomposed into actionable training corrections.",
      "Keep production references read-only; train on generated candidates measured against these calibrated targets."
    ]
  };
  writeJson(resolvedOutPath, artifact);
  return { ...artifact, outPath: resolvedOutPath };
}

function parseArgs(argv = []) {
  const args = { humanCalibrationPath: "", outPath: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = str(argv[index]);
    if (arg === "--human-calibration") args.humanCalibrationPath = argv[++index];
    else if (arg === "--out") args.outPath = argv[++index];
    else if (arg === "--help") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return `Usage:
  node scripts/sequencer-render-training/tooling/build-production-human-scorer-alignment.mjs \\
    --human-calibration var/benchmarks/production-sequence-read/video-review-owned/production-human-review-calibration.json \\
    --out var/benchmarks/production-sequence-read/video-review-owned/production-human-scorer-alignment.json
`;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help || !args.humanCalibrationPath) {
      process.stdout.write(usage());
      process.exit(args.help ? 0 : 1);
    }
    const artifact = buildProductionHumanScorerAlignment(args);
    process.stdout.write(`${JSON.stringify({
      ok: true,
      outPath: artifact.outPath,
      summary: artifact.summary
    }, null, 2)}\n`);
  } catch (error) {
    console.error(error?.stack || String(error));
    process.exit(1);
  }
}
