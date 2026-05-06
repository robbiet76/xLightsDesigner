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

function resolvePath(filePath = "") {
  const value = str(filePath);
  if (!value) return "";
  return path.isAbsolute(value) ? value : path.resolve(REPO_ROOT, value);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readJsonIfExists(filePath = "") {
  const resolved = resolvePath(filePath);
  if (!resolved || !fs.existsSync(resolved)) return null;
  return readJson(resolved);
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function scoreDeltas(baselineScores = {}, candidateScores = {}) {
  const dimensions = [
    ["overallAestheticScore", "overall_aesthetic_score"],
    ["displayEvolution", "display_evolution"],
    ["narrativeShape", "narrative_shape"],
    ["pacingVariety", "pacing_variety"],
    ["transitionFlow", "transition_flow"],
    ["focalClarity", "focal_clarity"],
    ["focalHandoffStability", "focal_handoff_stability"],
    ["visualBalance", "visual_balance"],
    ["colorDiscipline", "color_discipline"],
    ["palettePurposeCoverage", "palette_purpose_coverage"],
    ["motionInterest", "motion_interest"],
    ["temporalContinuity", "temporal_continuity"],
    ["localEvidenceReadability", "local_evidence_readability"],
    ["clutterControl", "clutter_control"],
    ["intentMatch", "intent_match"],
    ["sectionQualityMean", "section_quality_mean"],
    ["qualityConsistency", "quality_consistency"],
    ["fullSequenceContext", "full_sequence_context"]
  ];
  return dimensions.map(([key, dimension]) => {
    const baseline = num(baselineScores[key], NaN);
    const candidate = num(candidateScores[key], NaN);
    return {
      dimension,
      baseline: Number.isFinite(baseline) ? round6(baseline) : null,
      candidate: Number.isFinite(candidate) ? round6(candidate) : null,
      delta: Number.isFinite(baseline) && Number.isFinite(candidate) ? round6(candidate - baseline) : null
    };
  }).filter((row) => row.delta !== null);
}

const IMPROVEMENT_THRESHOLD = 0.01;
const REGRESSION_THRESHOLD = 0.0075;

function classifyAttempt(deltas = [], improvementThreshold = IMPROVEMENT_THRESHOLD, regressionThreshold = REGRESSION_THRESHOLD) {
  const overall = deltas.find((row) => row.dimension === "overall_aesthetic_score")?.delta ?? 0;
  const hardRegressionDimensions = new Set(["clutter_control", "intent_match", "section_quality_mean"]);
  const hardRegressions = deltas.filter((row) => hardRegressionDimensions.has(row.dimension) && num(row.delta) <= -0.03);
  const broadRegressions = deltas.filter((row) => row.dimension !== "overall_aesthetic_score" && num(row.delta) <= -0.05);
  if (overall >= improvementThreshold && !hardRegressions.length) return "improved";
  if (overall <= -regressionThreshold || (hardRegressions.length && overall < improvementThreshold) || broadRegressions.length >= 3) return "regressed";
  return "neutral";
}

function loadScore(runRoot = "", explicitPath = "") {
  const root = resolvePath(runRoot);
  const scorePath = resolvePath(explicitPath || path.join(root, "video-aesthetic-score.json"));
  const score = readJsonIfExists(scorePath);
  return { root, scorePath, score };
}

export function buildVideoAestheticAttemptComparison({
  baselineRunRoot = "",
  candidateRunRoot = "",
  baselineScorePath = "",
  candidateScorePath = "",
  outPath = ""
} = {}) {
  const baseline = loadScore(baselineRunRoot, baselineScorePath);
  const candidate = loadScore(candidateRunRoot, candidateScorePath);
  const resolvedCandidateRoot = resolvePath(candidateRunRoot);
  if (!resolvedCandidateRoot || !fs.existsSync(resolvedCandidateRoot)) {
    throw new Error(`candidateRunRoot not found: ${resolvedCandidateRoot || "(missing)"}`);
  }
  const resolvedOutPath = resolvePath(outPath || path.join(resolvedCandidateRoot, "video-aesthetic-attempt-comparison.json"));
  const blockers = [];
  if (!baseline.score) blockers.push("baseline_video_aesthetic_score_missing");
  if (!candidate.score) blockers.push("candidate_video_aesthetic_score_missing");
  if (baseline.score && str(baseline.score.status) !== "ready") blockers.push("baseline_video_aesthetic_score_not_ready");
  if (candidate.score && str(candidate.score.status) !== "ready") blockers.push("candidate_video_aesthetic_score_not_ready");
  const deltas = blockers.length ? [] : scoreDeltas(baseline.score.scores || {}, candidate.score.scores || {});
  const comparisonStatus = blockers.length ? "blocked" : classifyAttempt(deltas);
  const improvedDimensions = deltas
    .filter((row) => row.dimension !== "overall_aesthetic_score" && num(row.delta) >= 0.01)
    .sort((left, right) => num(right.delta) - num(left.delta));
  const regressedDimensions = deltas
    .filter((row) => row.dimension !== "overall_aesthetic_score" && num(row.delta) <= -0.01)
    .sort((left, right) => num(left.delta) - num(right.delta));
  const artifact = {
    artifactType: "video_aesthetic_attempt_comparison_v1",
    artifactVersion: 1,
    generatedAt: new Date().toISOString(),
    status: blockers.length ? "blocked" : "ready",
    baselineRunRoot: baseline.root,
    candidateRunRoot: candidate.root,
    baselineVideoAestheticScoreRef: baseline.scorePath,
    candidateVideoAestheticScoreRef: candidate.scorePath,
    comparisonStatus,
    promotionEligible: comparisonStatus === "improved",
    blockers,
    deltas,
    summary: blockers.length ? {
      overallAestheticScoreDelta: 0,
      improvedDimensionCount: 0,
      regressedDimensionCount: 0
    } : {
      overallAestheticScoreDelta: round6(deltas.find((row) => row.dimension === "overall_aesthetic_score")?.delta ?? 0),
      improvedDimensionCount: improvedDimensions.length,
      regressedDimensionCount: regressedDimensions.length,
      strongestImprovements: improvedDimensions.slice(0, 4),
      strongestRegressions: regressedDimensions.slice(0, 4)
    },
    notes: [
      "Compares compact video_aesthetic_score_v1 artifacts only; raw video and frame artifacts stay local.",
      "An improved attempt requires meaningful overall gain without broad dimension regression.",
      "Regression detection is slightly more sensitive than improvement promotion so repeated material losses do not pass as neutral."
    ]
  };
  writeJson(resolvedOutPath, artifact);
  return artifact;
}

function parseArgs(argv = []) {
  const args = {
    baselineRunRoot: "",
    candidateRunRoot: "",
    baselineScorePath: "",
    candidateScorePath: "",
    outPath: ""
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = str(argv[index]);
    if (arg === "--baseline-run-root") args.baselineRunRoot = argv[++index];
    else if (arg === "--candidate-run-root") args.candidateRunRoot = argv[++index];
    else if (arg === "--baseline-score") args.baselineScorePath = argv[++index];
    else if (arg === "--candidate-score") args.candidateScorePath = argv[++index];
    else if (arg === "--out") args.outPath = argv[++index];
    else if (arg === "--help") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return `Usage:
  node scripts/sequencer-render-training/tooling/build-video-aesthetic-attempt-comparison.mjs \\
    --baseline-run-root <previous-run-root> \\
    --candidate-run-root <current-run-root>
`;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help || !args.candidateRunRoot) {
      process.stdout.write(usage());
      process.exit(args.help ? 0 : 1);
    }
    const artifact = buildVideoAestheticAttemptComparison(args);
    process.stdout.write(`${JSON.stringify({
      ok: true,
      out: resolvePath(args.outPath || path.join(args.candidateRunRoot, "video-aesthetic-attempt-comparison.json")),
      status: artifact.status,
      comparisonStatus: artifact.comparisonStatus,
      overallAestheticScoreDelta: artifact.summary.overallAestheticScoreDelta
    }, null, 2)}\n`);
  } catch (error) {
    console.error(error?.stack || String(error));
    process.exit(1);
  }
}
