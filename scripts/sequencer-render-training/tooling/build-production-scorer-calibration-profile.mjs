#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const DIMENSION_WEIGHTS = {
  energyArc: 1.1,
  sectionContrast: 1.1,
  pacingVariety: 0.8,
  paletteEvolution: 1,
  motifDevelopment: 0.6,
  modelAwareFocalHandoff: 1.2,
  resolvedActivityRatio: 0.7,
  leadTargetChangeRatio: 0.6,
  leadRegionChangeRatio: 0.6,
  averageCenterMovement: 0.5,
  averageActiveRegionCount: 0.8
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
  return rows.length ? rows.reduce((sum, value) => sum + value, 0) / rows.length : 0;
}

function weightedAverage(entries = []) {
  let sum = 0;
  let weight = 0;
  for (const entry of arr(entries)) {
    const value = num(entry?.value, NaN);
    const rowWeight = Math.max(0, num(entry?.weight, 0));
    if (!Number.isFinite(value) || rowWeight <= 0) continue;
    sum += value * rowWeight;
    weight += rowWeight;
  }
  return weight ? sum / weight : 0;
}

function normalizedDimensionValue(key = "", value = 0) {
  const parsed = num(value, NaN);
  if (!Number.isFinite(parsed)) return NaN;
  if (key === "averageActiveRegionCount") return Math.max(0, Math.min(1, parsed / 5));
  if (key === "averageCenterMovement") return Math.max(0, Math.min(1, parsed / 0.12));
  return Math.max(0, Math.min(1, parsed));
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
  return {
    count: rows.length,
    min: round6(rows[0]),
    p25: round6(quantile(rows, 0.25)),
    median: round6(quantile(rows, 0.5)),
    p75: round6(quantile(rows, 0.75)),
    max: round6(rows[rows.length - 1]),
    mean: round6(average(rows)),
    range: round6(rows[rows.length - 1] - rows[0])
  };
}

function mapBySequence(rows = []) {
  return new Map(arr(rows).map((row) => [str(row.sequenceId), row]).filter(([key]) => key));
}

function dimensionStatus(range = {}) {
  const spread = num(range.range, 0);
  if (spread >= 0.25) return "strong_variance";
  if (spread >= 0.1) return "usable_variance";
  if (spread > 0) return "low_variance";
  return "no_variance";
}

function targetBand(range = {}) {
  return {
    floor: round6(range.min),
    lowerTypical: round6(range.p25 ?? range.min),
    median: round6(range.median ?? range.mean),
    upperTypical: round6(range.p75 ?? range.max),
    ceiling: round6(range.max),
    optimizationUse: ["strong_variance", "usable_variance"].includes(dimensionStatus(range))
      ? "primary_calibration_dimension"
      : "supporting_diagnostic_only"
  };
}

function combinedScore(row = {}) {
  return round6(weightedAverage(Object.entries(DIMENSION_WEIGHTS).map(([key, weight]) => ({
    value: normalizedDimensionValue(key, row.dimensions?.[key]),
    weight
  }))));
}

export function buildProductionScorerCalibrationProfile({
  videoDimensionsPath = "",
  modelRegionHandoffPath = "",
  scorerDiagnosticsPath = "",
  outPath = ""
} = {}) {
  const resolvedVideoDimensionsPath = resolvePath(videoDimensionsPath);
  const resolvedHandoffPath = resolvePath(modelRegionHandoffPath);
  if (!resolvedVideoDimensionsPath || !fs.existsSync(resolvedVideoDimensionsPath)) {
    throw new Error(`video dimensions not found: ${resolvedVideoDimensionsPath || "(missing)"}`);
  }
  if (!resolvedHandoffPath || !fs.existsSync(resolvedHandoffPath)) {
    throw new Error(`model region handoff not found: ${resolvedHandoffPath || "(missing)"}`);
  }
  const video = readJson(resolvedVideoDimensionsPath);
  const handoff = readJson(resolvedHandoffPath);
  const diagnosticsPath = resolvePath(scorerDiagnosticsPath);
  const diagnostics = diagnosticsPath && fs.existsSync(diagnosticsPath) ? readJson(diagnosticsPath) : null;
  const resolvedOutPath = resolvePath(outPath || path.join(path.dirname(resolvedVideoDimensionsPath), "production-scorer-calibration-profile.json"));
  const videoRows = mapBySequence(video.references);
  const handoffRows = mapBySequence(handoff.references);
  const sequenceIds = [...videoRows.keys()].filter((id) => handoffRows.has(id)).sort();
  const references = sequenceIds.map((sequenceId) => {
    const videoRow = videoRows.get(sequenceId) || {};
    const handoffRow = handoffRows.get(sequenceId) || {};
    const dimensions = {
      energyArc: round6(videoRow.scores?.energyArc),
      sectionContrast: round6(videoRow.scores?.sectionContrast),
      pacingVariety: round6(videoRow.scores?.pacingVariety),
      paletteEvolution: round6(videoRow.scores?.paletteEvolution),
      motifDevelopment: round6(videoRow.scores?.motifDevelopment),
      modelAwareFocalHandoff: round6(handoffRow.scores?.modelAwareFocalHandoff),
      resolvedActivityRatio: round6(handoffRow.scores?.resolvedActivityRatio),
      leadTargetChangeRatio: round6(handoffRow.scores?.leadTargetChangeRatio),
      leadRegionChangeRatio: round6(handoffRow.scores?.leadRegionChangeRatio),
      averageCenterMovement: round6(handoffRow.scores?.averageCenterMovement),
      averageActiveRegionCount: round6(handoffRow.scores?.averageActiveRegionCount)
    };
    const risks = {
      abruptnessRisk: round6(videoRow.risks?.abruptnessRisk),
      stagnantEnergyRisk: round6(videoRow.risks?.stagnantEnergyRisk),
      paletteNoiseRisk: round6(videoRow.risks?.paletteNoiseRisk)
    };
    return {
      sequenceId,
      dimensions,
      risks,
      combinedCalibrationScore: combinedScore({ dimensions }),
      confidence: {
        video: videoRow.confidence || {},
        modelRegion: str(handoffRow.confidence)
      },
      refs: {
        videoDimensions: resolvedVideoDimensionsPath,
        modelRegionHandoff: resolvedHandoffPath
      }
    };
  });
  const dimensionRanges = Object.fromEntries(Object.keys(DIMENSION_WEIGHTS).map((key) => [
    key,
    stats(references.map((row) => row.dimensions[key]))
  ]).filter(([, value]) => value));
  const calibrationTargets = Object.fromEntries(Object.entries(dimensionRanges).map(([key, range]) => [
    key,
    targetBand(range)
  ]));
  const usableDimensions = Object.entries(dimensionRanges)
    .filter(([, range]) => ["strong_variance", "usable_variance"].includes(dimensionStatus(range)))
    .map(([key]) => key);
  const weakDimensions = Object.entries(dimensionRanges)
    .filter(([, range]) => !["strong_variance", "usable_variance"].includes(dimensionStatus(range)))
    .map(([key]) => key);
  const profile = {
    artifactType: "production_scorer_calibration_profile_v1",
    artifactVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceArtifacts: {
      videoDimensionsPath: resolvedVideoDimensionsPath,
      modelRegionHandoffPath: resolvedHandoffPath,
      scorerDiagnosticsPath: diagnosticsPath || ""
    },
    metricScope: "full_sequence_render",
    promotionUse: "scorer_calibration_only",
    policy: {
      calibrationOnly: true,
      requiresHumanReviewBeforeTrainingUse: true,
      replacesLegacySaturatedScoreOptimization: true,
      generatedTrainingMayUseAsRangeTargetsAfterHumanReview: false
    },
    summary: {
      referenceCount: references.length,
      usableDimensionCount: usableDimensions.length,
      weakDimensionCount: weakDimensions.length,
      legacyScorerStatus: str(diagnostics?.status || "unknown"),
      combinedCalibrationScore: stats(references.map((row) => row.combinedCalibrationScore))
    },
    dimensionWeights: DIMENSION_WEIGHTS,
    dimensionRanges,
    calibrationTargets,
    usableDimensions,
    weakDimensions,
    references,
    nextActions: [
      "Collect human section/quality notes before promoting target bands into generation scoring.",
      "Map generated sequence review outputs onto the same dimension names.",
      "Optimize generated loops against dimension balance and deltas, not raw accept/reject saturation.",
      "Keep weak dimensions as diagnostics until more varied evidence is available."
    ]
  };
  writeJson(resolvedOutPath, profile);
  return { ...profile, outPath: resolvedOutPath };
}

function parseArgs(argv = []) {
  const args = {
    videoDimensionsPath: "",
    modelRegionHandoffPath: "",
    scorerDiagnosticsPath: "",
    outPath: ""
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = str(argv[index]);
    if (arg === "--video-dimensions") args.videoDimensionsPath = argv[++index];
    else if (arg === "--model-region-handoff") args.modelRegionHandoffPath = argv[++index];
    else if (arg === "--scorer-diagnostics") args.scorerDiagnosticsPath = argv[++index];
    else if (arg === "--out") args.outPath = argv[++index];
    else if (arg === "--help") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return `Usage:
  node scripts/sequencer-render-training/tooling/build-production-scorer-calibration-profile.mjs \\
    --video-dimensions var/benchmarks/production-sequence-read/video-review-owned/production-full-sequence-dimensions.json \\
    --model-region-handoff var/benchmarks/production-sequence-read/video-review-owned/production-model-region-handoff.json \\
    --scorer-diagnostics var/benchmarks/production-sequence-read/video-review-owned/production-scorer-calibration-diagnostics.json \\
    --out var/benchmarks/production-sequence-read/video-review-owned/production-scorer-calibration-profile.json
`;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help || !args.videoDimensionsPath || !args.modelRegionHandoffPath) {
      process.stdout.write(usage());
      process.exit(args.help ? 0 : 1);
    }
    const profile = buildProductionScorerCalibrationProfile(args);
    process.stdout.write(`${JSON.stringify({
      ok: true,
      outPath: profile.outPath,
      summary: profile.summary,
      usableDimensions: profile.usableDimensions,
      weakDimensions: profile.weakDimensions
    }, null, 2)}\n`);
  } catch (error) {
    console.error(error?.stack || String(error));
    process.exit(1);
  }
}
