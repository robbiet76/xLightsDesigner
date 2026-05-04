#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const DEFAULT_MIN_SAMPLE_COUNT = 2;
const DEFAULT_MIN_QUALITY = 0.72;

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

function stableId(value = "") {
  return str(value).toLowerCase().replace(/[^a-z0-9._:-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 160) || "unknown";
}

function qualitySamples(group = {}) {
  return arr(group.samples).map((sample) => ({
    runId: str(sample.runId),
    runRoot: str(sample.runRoot),
    overallQuality: round6(sample.overallQuality),
    visualReadability: round6(sample.visualReadability),
    intentMatch: round6(sample.intentMatch),
    motionCoherence: round6(sample.motionCoherence),
    activeNodeRatioPeak: round6(sample.activeNodeRatioPeak),
    activeTargetNodeRatioPeak: round6(sample.activeTargetNodeRatioPeak),
    temporalMotionMean: round6(sample.temporalMotionMean)
  }));
}

function promotionBlockers(group = {}, { minSampleCount = DEFAULT_MIN_SAMPLE_COUNT, minQuality = DEFAULT_MIN_QUALITY } = {}) {
  const blockers = [];
  if (num(group.sampleCount) < minSampleCount) blockers.push("insufficient_repeated_quality_evidence");
  if (!["stable", "improving"].includes(str(group.trendStatus))) blockers.push("quality_trend_not_stable_or_improving");
  if (str(group.latestDecision) !== "accept") blockers.push("latest_review_not_accepted");
  if (num(group.latestOverallQuality) < minQuality) blockers.push("latest_quality_below_threshold");
  return blockers;
}

function buildRecord(group = {}, options = {}) {
  const samples = qualitySamples(group);
  const sampleQualities = samples.map((sample) => sample.overallQuality);
  const blockers = promotionBlockers(group, options);
  return {
    artifactType: "layer_composition_quality_record_v1",
    artifactVersion: 1,
    recordId: [
      "layer_quality",
      stableId(group.experimentId),
      stableId(group.passId),
      stableId(group.effectName),
      stableId(arr(group.leadTargets).join("-"))
    ].join(":"),
    sourceTrendKey: str(group.key),
    experimentId: str(group.experimentId),
    passId: str(group.passId),
    family: str(group.family),
    targetScopes: arr(group.targetScopes).map(str).filter(Boolean),
    modelTypes: arr(group.modelTypes).map(str).filter(Boolean),
    geometryProfiles: arr(group.geometryProfiles).map(str).filter(Boolean),
    changeType: str(group.changeType),
    effectName: str(group.effectName),
    leadTargets: arr(group.leadTargets).map(str).filter(Boolean),
    sampleCount: num(group.sampleCount),
    trendStatus: str(group.trendStatus),
    quality: {
      firstOverallQuality: round6(group.firstOverallQuality),
      previousOverallQuality: group.previousOverallQuality == null ? null : round6(group.previousOverallQuality),
      latestOverallQuality: round6(group.latestOverallQuality),
      meanOverallQuality: round6(average(sampleQualities)),
      minOverallQuality: sampleQualities.length ? round6(Math.min(...sampleQualities)) : 0,
      maxOverallQuality: sampleQualities.length ? round6(Math.max(...sampleQualities)) : 0,
      overallDeltaFromFirst: round6(group.overallDeltaFromFirst),
      overallDeltaFromPrevious: round6(group.overallDeltaFromPrevious)
    },
    observedMetrics: {
      meanActiveNodeRatioPeak: round6(average(samples.map((sample) => sample.activeNodeRatioPeak))),
      meanActiveTargetNodeRatioPeak: round6(average(samples.map((sample) => sample.activeTargetNodeRatioPeak))),
      meanTemporalMotion: round6(average(samples.map((sample) => sample.temporalMotionMean))),
      meanVisualReadability: round6(average(samples.map((sample) => sample.visualReadability))),
      meanIntentMatch: round6(average(samples.map((sample) => sample.intentMatch))),
      meanMotionCoherence: round6(average(samples.map((sample) => sample.motionCoherence)))
    },
    evidence: {
      latestRenderReviewRef: str(group.latestRenderReviewRef),
      latestQualityRef: str(group.latestQualityRef),
      samples
    },
    promotion: {
      durableCandidate: blockers.length === 0,
      blockers,
      requiredSampleCount: num(options.minSampleCount, DEFAULT_MIN_SAMPLE_COUNT),
      requiredLatestQuality: num(options.minQuality, DEFAULT_MIN_QUALITY)
    },
    safeguards: [
      "Use as quality evidence, not as a fixed sequencing recipe.",
      "Require compatible target/effect context before applying this evidence.",
      "Keep project-local evidence separate from shared promotion until explicitly packed."
    ]
  };
}

export function buildLayerCompositionQualityRecords({
  qualityTrend,
  qualityTrendPath = "",
  outPath = "",
  minSampleCount = DEFAULT_MIN_SAMPLE_COUNT,
  minQuality = DEFAULT_MIN_QUALITY
} = {}) {
  const trend = qualityTrend || readJson(resolvePath(qualityTrendPath));
  const records = arr(trend.groups).map((group) => buildRecord(group, { minSampleCount, minQuality }));
  const durableRecords = records.filter((record) => record.promotion.durableCandidate);
  const artifact = {
    artifactType: "layer_composition_quality_records_v1",
    artifactVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceQualityTrendRef: str(qualityTrendPath ? resolvePath(qualityTrendPath) : ""),
    sourceRunRoots: arr(trend.runRoots).map(str).filter(Boolean),
    recordCount: records.length,
    durableCandidateCount: durableRecords.length,
    blockedRecordCount: records.length - durableRecords.length,
    promotionPolicy: {
      minSampleCount,
      minQuality,
      acceptedTrendStatuses: ["stable", "improving"],
      latestDecisionRequired: "accept"
    },
    records
  };
  const resolvedOutPath = resolvePath(outPath);
  if (resolvedOutPath) writeJson(resolvedOutPath, artifact);
  return artifact;
}

function parseArgs(argv = []) {
  const args = {
    qualityTrendPath: "",
    outPath: "",
    minSampleCount: DEFAULT_MIN_SAMPLE_COUNT,
    minQuality: DEFAULT_MIN_QUALITY
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = str(argv[index]);
    if (arg === "--quality-trend") args.qualityTrendPath = argv[++index];
    else if (arg === "--out") args.outPath = argv[++index];
    else if (arg === "--min-sample-count") args.minSampleCount = Number(argv[++index]);
    else if (arg === "--min-quality") args.minQuality = Number(argv[++index]);
    else if (arg === "--help") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return `Usage:
  node scripts/sequencer-render-training/tooling/build-layer-composition-quality-records.mjs --quality-trend quality-trend.json --out quality-records.json
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.qualityTrendPath) {
    process.stdout.write(usage());
    process.exit(args.help ? 0 : 1);
  }
  const artifact = buildLayerCompositionQualityRecords(args);
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
