#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const SCORE_KEYS = [
  "overallQuality",
  "intentMatch",
  "musicalFit",
  "visualReadability",
  "colorDiscipline",
  "motionCoherence",
  "transitionQuality",
  "clutterControl"
];

const METRIC_KEYS = [
  "activeCoverageMean",
  "activeCoveragePeak",
  "brightnessMean",
  "brightnessPeak",
  "colorDiversityMean",
  "activeColorDiversityMean",
  "activeColorClassMean",
  "temporalMotionMean",
  "temporalMotionPeak",
  "temporalColorDeltaMean",
  "temporalBrightnessDeltaMean",
  "temporalActiveDeltaMean",
  "blankRisk",
  "overexposureRisk",
  "flatnessRisk",
  "clutterRisk"
];

const FEATURE_KEYS = [
  "mediaDurationSeconds",
  "sampleFps",
  "sampledFrameCount",
  "nonBlankSampledFrameRatio",
  "activeSampledFrameSpanRatio",
  "temporalPixelDeltaMean",
  "temporalMotionMean",
  "temporalMotionPeak",
  "representativeSampledFrameAverageBrightness",
  "representativeSampledFrameActivePixelRatio",
  "representativeSampledFrameUniqueColorCount",
  "representativeSampledFrameActiveUniqueColorCount",
  "meanSampledFrameActiveUniqueColorCount",
  "meanSampledFrameActiveColorClassCount"
];

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

function quantile(sorted = [], ratio = 0.5) {
  if (!sorted.length) return null;
  if (sorted.length === 1) return sorted[0];
  const index = (sorted.length - 1) * ratio;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  if (low === high) return sorted[low];
  return sorted[low] + (sorted[high] - sorted[low]) * (index - low);
}

function stats(values = []) {
  const rows = arr(values).map((value) => num(value, NaN)).filter(Number.isFinite).sort((a, b) => a - b);
  if (!rows.length) return null;
  const mean = rows.reduce((sum, value) => sum + value, 0) / rows.length;
  return {
    count: rows.length,
    min: round6(rows[0]),
    p25: round6(quantile(rows, 0.25)),
    median: round6(quantile(rows, 0.5)),
    p75: round6(quantile(rows, 0.75)),
    max: round6(rows[rows.length - 1]),
    mean: round6(mean)
  };
}

function collectStats(rows = [], key = "", source = "") {
  const values = rows.map((row) => row[source]?.[key]);
  return stats(values);
}

function compactMap(source = {}, keys = []) {
  const output = {};
  for (const key of keys) {
    const value = num(source?.[key], NaN);
    if (Number.isFinite(value)) output[key] = round6(value);
  }
  return output;
}

function loadAcceptedRows(summary = {}) {
  return arr(summary.rows)
    .filter((row) => str(row.status) === "reviewed")
    .filter((row) => str(row.decision) === "accept")
    .filter((row) => str(row.renderReviewPath) && str(row.frameFeaturesPath))
    .map((row) => {
      const reviewPath = resolvePath(row.renderReviewPath);
      const featuresPath = resolvePath(row.frameFeaturesPath);
      const review = readJson(reviewPath);
      const features = readJson(featuresPath);
      return {
        sequenceId: str(row.sequenceId),
        status: str(row.status),
        decision: str(row.decision),
        overallQuality: round6(row.overallQuality),
        videoPath: str(row.videoPath),
        contactSheetPath: str(row.contactSheetPath),
        renderReviewPath: reviewPath,
        frameFeaturesPath: featuresPath,
        scores: compactMap(review.qualityScores, SCORE_KEYS),
        metrics: compactMap(review.deterministicMetrics, METRIC_KEYS),
        features: compactMap(features, FEATURE_KEYS),
        temporalSignature: str(features.temporalSignature),
        calibrationPolicy: review.calibrationPolicy || {}
      };
    });
}

export function buildProductionVideoCalibrationBaseline({
  summaryPath = "",
  outPath = ""
} = {}) {
  const resolvedSummaryPath = resolvePath(summaryPath);
  if (!resolvedSummaryPath || !fs.existsSync(resolvedSummaryPath)) {
    throw new Error(`summary not found: ${resolvedSummaryPath || "(missing)"}`);
  }
  const summary = readJson(resolvedSummaryPath);
  const rows = loadAcceptedRows(summary);
  const resolvedOutPath = resolvePath(outPath || path.join(path.dirname(resolvedSummaryPath), "production-video-calibration-baseline.json"));
  const invalidRows = arr(summary.rows).filter((row) => str(row.status) !== "reviewed");
  const scoreRanges = Object.fromEntries(SCORE_KEYS
    .map((key) => [key, collectStats(rows, key, "scores")])
    .filter(([, value]) => value));
  const metricRanges = Object.fromEntries(METRIC_KEYS
    .map((key) => [key, collectStats(rows, key, "metrics")])
    .filter(([, value]) => value));
  const featureRanges = Object.fromEntries(FEATURE_KEYS
    .map((key) => [key, collectStats(rows, key, "features")])
    .filter(([, value]) => value));

  const artifact = {
    artifactType: "production_video_calibration_baseline_v1",
    artifactVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceSummaryPath: resolvedSummaryPath,
    readOnly: true,
    metricScope: "full_sequence_render",
    promotionUse: "calibration_reference_only",
    promotionPolicy: {
      trainSequencingPolicy: false,
      copyStylisticPatterns: false,
      requiresHumanReviewBeforePromotion: true,
      rawMediaRetainedLocallyOnly: true
    },
    summary: {
      sourceSequenceCount: arr(summary.rows).length,
      acceptedReferenceCount: rows.length,
      invalidOrRejectedCount: invalidRows.length,
      scoreRangeBasis: "accepted_production_sequence_video_reads",
      overallQuality: scoreRanges.overallQuality || null
    },
    scoreRanges,
    metricRanges,
    featureRanges,
    references: rows.map((row) => ({
      sequenceId: row.sequenceId,
      decision: row.decision,
      overallQuality: row.overallQuality,
      temporalSignature: row.temporalSignature,
      scores: row.scores,
      metrics: row.metrics,
      features: row.features,
      videoPath: row.videoPath,
      contactSheetPath: row.contactSheetPath,
      renderReviewPath: row.renderReviewPath,
      frameFeaturesPath: row.frameFeaturesPath
    })),
    excludedReferences: invalidRows.map((row) => ({
      sequenceId: str(row.sequenceId),
      status: str(row.status),
      decision: str(row.decision),
      invalidReasonCode: str(row.invalidReasonCode),
      invalidReason: str(row.invalidReason)
    }))
  };
  writeJson(resolvedOutPath, artifact);
  return { ...artifact, outPath: resolvedOutPath };
}

function parseArgs(argv = []) {
  const args = { summaryPath: "", outPath: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = str(argv[index]);
    if (arg === "--summary") args.summaryPath = argv[++index];
    else if (arg === "--out") args.outPath = argv[++index];
    else if (arg === "--help") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return `Usage:
  node scripts/sequencer-render-training/tooling/build-production-video-calibration-baseline.mjs \\
    --summary var/benchmarks/production-sequence-read/video-review-owned/production-sequence-video-read-summary.json \\
    --out var/benchmarks/production-sequence-read/video-review-owned/production-video-calibration-baseline.json
`;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help || !args.summaryPath) {
      process.stdout.write(usage());
      process.exit(args.help ? 0 : 1);
    }
    const artifact = buildProductionVideoCalibrationBaseline(args);
    process.stdout.write(`${JSON.stringify({
      ok: true,
      outPath: artifact.outPath,
      acceptedReferenceCount: artifact.summary.acceptedReferenceCount,
      invalidOrRejectedCount: artifact.summary.invalidOrRejectedCount,
      overallQuality: artifact.summary.overallQuality
    }, null, 2)}\n`);
  } catch (error) {
    console.error(error?.stack || String(error));
    process.exit(1);
  }
}
