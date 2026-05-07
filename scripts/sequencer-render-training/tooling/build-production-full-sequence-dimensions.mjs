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

function clamp01(value) {
  return Math.max(0, Math.min(1, num(value)));
}

function round6(value) {
  return Math.round(num(value) * 1_000_000) / 1_000_000;
}

function average(values = []) {
  const rows = arr(values).map((value) => num(value, NaN)).filter(Number.isFinite);
  return rows.length ? rows.reduce((sum, value) => sum + value, 0) / rows.length : 0;
}

function stdev(values = []) {
  const rows = arr(values).map((value) => num(value, NaN)).filter(Number.isFinite);
  if (rows.length < 2) return 0;
  const mean = average(rows);
  return Math.sqrt(average(rows.map((value) => (value - mean) ** 2)));
}

function range(values = []) {
  const rows = arr(values).map((value) => num(value, NaN)).filter(Number.isFinite);
  return rows.length ? Math.max(...rows) - Math.min(...rows) : 0;
}

function scoreRange(values = [], expectedRange = 1) {
  return clamp01(range(values) / Math.max(expectedRange, 0.000001));
}

function scoreStdev(values = [], expectedStdev = 1) {
  return clamp01(stdev(values) / Math.max(expectedStdev, 0.000001));
}

function scoreBand(value, low, high) {
  const parsed = num(value, NaN);
  if (!Number.isFinite(parsed)) return 0;
  if (parsed >= low && parsed <= high) return 1;
  if (parsed < low) return clamp01(parsed / Math.max(low, 0.000001));
  return clamp01(1 - ((parsed - high) / Math.max(high - low, 0.000001)));
}

function rgbDistance(left = {}, right = {}) {
  const dr = num(left.r) - num(right.r);
  const dg = num(left.g) - num(right.g);
  const db = num(left.b) - num(right.b);
  return Math.sqrt((dr * dr) + (dg * dg) + (db * db));
}

function chunks(rows = [], count = 6) {
  const source = arr(rows);
  if (!source.length) return [];
  const chunkCount = Math.max(1, Math.min(count, source.length));
  const output = [];
  for (let index = 0; index < chunkCount; index += 1) {
    const start = Math.floor((index * source.length) / chunkCount);
    const end = Math.floor(((index + 1) * source.length) / chunkCount);
    output.push(source.slice(start, Math.max(start + 1, end)));
  }
  return output;
}

function chunkTransitionRows(transitions = [], startFrame = 0, endFrame = 0) {
  return arr(transitions).filter((row) => {
    const toFrame = num(row.toFrameIndex, NaN);
    return Number.isFinite(toFrame) && toFrame >= startFrame && toFrame <= endFrame;
  });
}

function summarizeWindows(features = {}, windowCount = 6) {
  const frames = arr(features.sampledFrameMetrics);
  const transitions = arr(features.sampledFrameTransitions);
  return chunks(frames, windowCount).map((rows, index) => {
    const startFrame = num(rows[0]?.frameIndex, index);
    const endFrame = num(rows[rows.length - 1]?.frameIndex, startFrame);
    const transitionRows = chunkTransitionRows(transitions, startFrame, endFrame);
    return {
      windowIndex: index,
      startFrameIndex: startFrame,
      endFrameIndex: endFrame,
      averageBrightness: round6(average(rows.map((row) => row.frameAverageBrightness))),
      activePixelRatio: round6(average(rows.map((row) => row.frameActivePixelRatio))),
      dominantPixelRatio: round6(average(rows.map((row) => row.frameDominantPixelRatio))),
      uniqueColorCount: round6(average(rows.map((row) => row.frameUniqueColorCount))),
      activeUniqueColorCount: round6(average(rows.map((row) => row.frameActiveUniqueColorCount))),
      activeColorClassCount: round6(average(rows.map((row) => row.frameActiveColorClassCount))),
      pixelDeltaMean: round6(average(rows.map((row) => row.framePixelDeltaFromPrevious))),
      transitionMotionMean: round6(average(transitionRows.map((row) => row.combinedDelta))),
      transitionPixelDeltaMean: round6(average(transitionRows.map((row) => row.pixelDelta))),
      transitionColorDeltaMean: round6(average(transitionRows.map((row) => row.colorDelta))),
      averageRgb: {
        r: round6(average(rows.map((row) => row.frameAverageRgb?.r))),
        g: round6(average(rows.map((row) => row.frameAverageRgb?.g))),
        b: round6(average(rows.map((row) => row.frameAverageRgb?.b)))
      }
    };
  });
}

function adjacentDeltas(windows = [], key = "") {
  const output = [];
  for (let index = 1; index < arr(windows).length; index += 1) {
    output.push(Math.abs(num(windows[index]?.[key]) - num(windows[index - 1]?.[key])));
  }
  return output;
}

function adjacentRgbDeltas(windows = []) {
  const output = [];
  for (let index = 1; index < arr(windows).length; index += 1) {
    output.push(rgbDistance(windows[index]?.averageRgb, windows[index - 1]?.averageRgb));
  }
  return output;
}

function peakPlacementScore(values = []) {
  const rows = arr(values).map((value) => num(value, NaN)).filter(Number.isFinite);
  if (rows.length < 3) return 0.5;
  const peak = Math.max(...rows);
  const peakIndex = rows.indexOf(peak);
  const position = peakIndex / Math.max(1, rows.length - 1);
  return scoreBand(position, 0.35, 0.9);
}

function buildDimensionsForReference(reference = {}, features = {}) {
  const windows = summarizeWindows(features);
  const brightness = windows.map((row) => row.averageBrightness);
  const active = windows.map((row) => row.activePixelRatio);
  const motion = windows.map((row) => row.transitionMotionMean || row.pixelDeltaMean);
  const pixelMotion = windows.map((row) => row.transitionPixelDeltaMean || row.pixelDeltaMean);
  const activeColors = windows.map((row) => row.activeUniqueColorCount);
  const activeClasses = windows.map((row) => row.activeColorClassCount);
  const rgbDeltas = adjacentRgbDeltas(windows);
  const activeDeltas = adjacentDeltas(windows, "activePixelRatio");
  const brightnessDeltas = adjacentDeltas(windows, "averageBrightness");
  const motionDeltas = adjacentDeltas(windows, "transitionMotionMean");
  const colorClassDeltas = adjacentDeltas(windows, "activeColorClassCount");
  const visualEnergy = windows.map((row) => (
    (row.averageBrightness * 2.5) +
    row.activePixelRatio +
    (row.transitionPixelDeltaMean * 8) +
    (row.activeColorClassCount / 8)
  ));
  const contrastMean = average([
    average(activeDeltas) / 0.025,
    average(brightnessDeltas) / 0.006,
    average(motionDeltas) / 0.02,
    average(rgbDeltas) / 0.02
  ]);
  const abruptnessRisk = clamp01(average([
    Math.max(0, Math.max(...activeDeltas, 0) - 0.035) / 0.04,
    Math.max(0, Math.max(...brightnessDeltas, 0) - 0.01) / 0.015,
    Math.max(0, Math.max(...rgbDeltas, 0) - 0.035) / 0.05
  ]));
  const motifSimilarity = 1 - clamp01(average([
    average(activeDeltas) / 0.04,
    average(brightnessDeltas) / 0.012,
    average(rgbDeltas) / 0.04
  ]));
  const motifVariation = clamp01(average([
    scoreStdev(active, 0.015),
    scoreStdev(brightness, 0.004),
    scoreStdev(pixelMotion, 0.002),
    scoreStdev(activeClasses, 1.2)
  ]));
  const motifDevelopment = average([
    scoreBand(motifSimilarity, 0.35, 0.9),
    scoreBand(motifVariation, 0.25, 0.9)
  ]);

  return {
    sequenceId: str(reference.sequenceId),
    status: "scored",
    evidenceScope: "full_sequence_video_sample",
    confidence: {
      energyArc: "medium",
      sectionContrast: "medium",
      pacingVariety: "medium",
      paletteEvolution: "medium",
      motifDevelopment: "low",
      focalHandoff: "proxy_only"
    },
    scores: {
      energyArc: round6(average([
        scoreRange(visualEnergy, 0.18),
        peakPlacementScore(visualEnergy),
        scoreBand(stdev(visualEnergy), 0.015, 0.11)
      ])),
      sectionContrast: round6(scoreBand(contrastMean, 0.25, 1.2)),
      pacingVariety: round6(average([
        scoreRange(motion, 0.035),
        scoreStdev(motion, 0.012),
        scoreBand(average(motion), 0.025, 0.09)
      ])),
      paletteEvolution: round6(average([
        scoreRange(activeColors, 140),
        scoreRange(activeClasses, 3),
        scoreBand(average(rgbDeltas), 0.0015, 0.025),
        scoreBand(average(colorClassDeltas), 0.15, 1.8)
      ])),
      motifDevelopment: round6(motifDevelopment),
      focalHandoffProxy: round6(average([
        scoreBand(average(activeDeltas), 0.002, 0.025),
        scoreBand(average(brightnessDeltas), 0.0005, 0.008),
        1 - abruptnessRisk
      ]))
    },
    risks: {
      abruptnessRisk: round6(abruptnessRisk),
      stagnantEnergyRisk: round6(1 - scoreRange(visualEnergy, 0.12)),
      paletteNoiseRisk: round6(clamp01((average(activeColors) - 150) / 220))
    },
    windowCount: windows.length,
    windows
  };
}

function stats(values = []) {
  const rows = arr(values).map((value) => num(value, NaN)).filter(Number.isFinite).sort((a, b) => a - b);
  if (!rows.length) return null;
  return {
    count: rows.length,
    min: round6(rows[0]),
    mean: round6(average(rows)),
    max: round6(rows[rows.length - 1]),
    range: round6(rows[rows.length - 1] - rows[0]),
    stdev: round6(stdev(rows))
  };
}

function scoreRanges(rows = []) {
  const keys = ["energyArc", "sectionContrast", "pacingVariety", "paletteEvolution", "motifDevelopment", "focalHandoffProxy"];
  return Object.fromEntries(keys.map((key) => [key, stats(rows.map((row) => row.scores?.[key]))]));
}

export function buildProductionFullSequenceDimensions({
  baselinePath = "",
  outPath = ""
} = {}) {
  const resolvedBaselinePath = resolvePath(baselinePath);
  if (!resolvedBaselinePath || !fs.existsSync(resolvedBaselinePath)) {
    throw new Error(`baseline not found: ${resolvedBaselinePath || "(missing)"}`);
  }
  const baseline = readJson(resolvedBaselinePath);
  const resolvedOutPath = resolvePath(outPath || path.join(path.dirname(resolvedBaselinePath), "production-full-sequence-dimensions.json"));
  const rows = arr(baseline.references).map((reference) => {
    const featuresPath = resolvePath(reference.frameFeaturesPath);
    const features = readJson(featuresPath);
    return buildDimensionsForReference(reference, features);
  });
  const ranges = scoreRanges(rows);
  const artifact = {
    artifactType: "production_full_sequence_dimensions_v1",
    artifactVersion: 1,
    generatedAt: new Date().toISOString(),
    baselinePath: resolvedBaselinePath,
    referenceCount: rows.length,
    metricScope: "full_sequence_render",
    promotionUse: "scorer_calibration_only",
    policy: {
      calibrationOnly: true,
      requiresHumanReviewBeforeTrainingUse: true,
      focalHandoffRequiresModelAwareEvidence: true
    },
    dimensions: {
      energyArc: "Variation and placement of visual energy across the sampled full sequence.",
      sectionContrast: "How clearly sampled windows differ without becoming abrupt.",
      pacingVariety: "Variation in motion and pixel change across the sequence.",
      paletteEvolution: "Color-class and RGB evolution across sequence windows.",
      motifDevelopment: "Repetition-with-variation proxy from adjacent visual similarity and variation.",
      focalHandoffProxy: "Low-confidence video-only proxy; true focal handoff requires model/region-aware evidence."
    },
    scoreRanges: ranges,
    diagnostics: {
      variedDimensionCount: Object.values(ranges).filter((row) => num(row?.range) >= 0.1).length,
      proxyOnlyDimensions: ["focalHandoffProxy"],
      nextEvidenceNeeded: ["model_region_activity_by_video_window", "human_section_labels", "audio_energy_sections"]
    },
    references: rows
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
  node scripts/sequencer-render-training/tooling/build-production-full-sequence-dimensions.mjs \\
    --baseline var/benchmarks/production-sequence-read/video-review-owned/production-video-calibration-baseline.json \\
    --out var/benchmarks/production-sequence-read/video-review-owned/production-full-sequence-dimensions.json
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
    const artifact = buildProductionFullSequenceDimensions(args);
    process.stdout.write(`${JSON.stringify({
      ok: true,
      outPath: artifact.outPath,
      referenceCount: artifact.referenceCount,
      scoreRanges: artifact.scoreRanges,
      diagnostics: artifact.diagnostics
    }, null, 2)}\n`);
  } catch (error) {
    console.error(error?.stack || String(error));
    process.exit(1);
  }
}
