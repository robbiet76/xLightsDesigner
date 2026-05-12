#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { REVIEW_CHOICES } from "./build-production-human-review-calibration.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const CANDIDATE_SCORE_MAP = {
  energyArc: [
    ["scores", "displayEvolution"],
    ["scores", "narrativeShape"],
    ["qualityScores", "musicalFit"],
    ["qualityScores", "motionCoherence"]
  ],
  sectionContrast: [
    ["scores", "pacingVariety"],
    ["scores", "displayEvolution"],
    ["scores", "transitionFlow"],
    ["qualityScores", "transitionQuality"]
  ],
  paletteEvolution: [
    ["scores", "palettePurposeCoverage"],
    ["scores", "colorDiscipline"],
    ["qualityScores", "colorDiscipline"]
  ],
  focalHandoff: [
    ["scores", "focalHandoffStability"],
    ["scores", "focalClarity"],
    ["qualityScores", "targetHierarchy"]
  ],
  targetHierarchy: [
    ["scores", "focalClarity"],
    ["scores", "visualBalance"],
    ["scores", "localEvidenceReadability"],
    ["qualityScores", "targetHierarchy"],
    ["qualityScores", "visualReadability"]
  ],
  overallFit: [
    ["scores", "overallAestheticScore"],
    ["qualityScores", "overallQuality"]
  ]
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

function percentile(values = [], position = 0.5) {
  const rows = arr(values).map((value) => num(value, NaN)).filter(Number.isFinite).sort((left, right) => left - right);
  if (!rows.length) return null;
  if (rows.length === 1) return rows[0];
  const index = (rows.length - 1) * Math.max(0, Math.min(1, position));
  const low = Math.floor(index);
  const high = Math.ceil(index);
  if (low === high) return rows[low];
  return rows[low] + ((rows[high] - rows[low]) * (index - low));
}

function scoreForChoice(metric = "", choice = "") {
  const option = arr(REVIEW_CHOICES[metric]?.options).find((row) => str(row.id) === str(choice));
  return option && Number.isFinite(option.score) ? option.score : null;
}

function targetBands(calibration = {}) {
  const approved = arr(calibration.reviews)
    .filter((row) => str(row.status) === "reviewed" && ["approve", "adjust"].includes(str(row.recommendation)));
  return Object.fromEntries(Object.keys(REVIEW_CHOICES).map((metric) => {
    const scores = approved
      .map((row) => scoreForChoice(metric, row.metricChoices?.[metric]))
      .filter(Number.isFinite);
    return [metric, {
      metric,
      reviewedScoreCount: scores.length,
      min: scores.length ? round6(Math.min(...scores)) : null,
      p25: scores.length ? round6(percentile(scores, 0.25)) : null,
      median: scores.length ? round6(percentile(scores, 0.5)) : null,
      p75: scores.length ? round6(percentile(scores, 0.75)) : null,
      max: scores.length ? round6(Math.max(...scores)) : null,
      mean: scores.length ? round6(average(scores)) : null
    }];
  }));
}

function alignmentByMetric(alignment = {}) {
  return new Map(arr(alignment.metricAlignments).map((row) => [str(row.metric), row]));
}

function nestedValue(source = {}, pathParts = []) {
  let current = source;
  for (const part of pathParts) {
    if (!current || typeof current !== "object") return NaN;
    current = current[part];
  }
  return num(current, NaN);
}

function candidateScoreForMetric(candidate = {}, metric = "") {
  const values = arr(CANDIDATE_SCORE_MAP[metric]).map((pathParts) => nestedValue(candidate, pathParts));
  return average(values);
}

function metricScope(candidate = {}) {
  return str(candidate.metricScope || candidate.section?.scope || candidate.promotion?.metricScope || "unknown");
}

function contextMetricScope(candidate = {}) {
  return str(candidate.contextMetricScope || metricScope(candidate));
}

function hasFullSequenceContext(candidate = {}) {
  return metricScope(candidate) === "full_sequence_render" || contextMetricScope(candidate) === "full_sequence_render";
}

function candidateId(candidatePath = "", candidate = {}) {
  return str(candidate.candidateId || candidate.passId || candidate.runId || candidate.sequenceId || candidate.intent?.id)
    || path.basename(path.dirname(candidatePath)) || path.basename(candidatePath);
}

function bandStatus(score, band = {}) {
  if (!Number.isFinite(score) || band.p25 === null || band.p75 === null) return "missing";
  if (score >= num(band.p25) && score <= num(band.p75)) return "inside_human_iqr";
  if (score >= num(band.min) && score <= num(band.max)) return "inside_human_reference_range";
  if (score < num(band.min)) return "below_human_reference_range";
  return "above_human_reference_range";
}

function distanceToBand(score, band = {}) {
  if (!Number.isFinite(score) || band.p25 === null || band.p75 === null) return null;
  if (score >= num(band.p25) && score <= num(band.p75)) return 0;
  return score < num(band.p25) ? round6(num(band.p25) - score) : round6(score - num(band.p75));
}

function evaluationUse(status = "") {
  if (status === "aligned") return "optimization_support";
  if (status === "partially_aligned") return "human_calibrated_guardrail";
  return "diagnostic_only";
}

function evaluateCandidate(candidatePath = "", candidate = {}, bands = {}, alignments = new Map(), calibrationApproved = false) {
  const blockers = [];
  if (!calibrationApproved) blockers.push("human_calibration_not_approved");
  if (!hasFullSequenceContext(candidate)) blockers.push("candidate_not_full_sequence_scope");
  const metricEvaluations = Object.keys(REVIEW_CHOICES).map((metric) => {
    const score = candidateScoreForMetric(candidate, metric);
    const alignment = alignments.get(metric) || {};
    const status = str(alignment.status || "unknown");
    const use = evaluationUse(status);
    return {
      metric,
      candidateScore: Number.isFinite(score) ? round6(score) : null,
      humanTargetBand: bands[metric],
      alignmentStatus: status,
      evaluationUse: use,
      bandStatus: bandStatus(score, bands[metric]),
      distanceToHumanIqr: distanceToBand(score, bands[metric]),
      recommendation: use === "optimization_support"
        ? "May support unattended optimization when other promotion gates pass."
        : use === "human_calibrated_guardrail"
          ? "Use as a bounded guardrail and prefer candidates near the human-reviewed band."
          : "Diagnostic only until this dimension is retuned against human review."
    };
  });
  const usable = metricEvaluations.filter((row) => row.evaluationUse === "optimization_support");
  const guardrails = metricEvaluations.filter((row) => row.evaluationUse === "human_calibrated_guardrail");
  const usableInside = usable.filter((row) => ["inside_human_iqr", "inside_human_reference_range"].includes(row.bandStatus));
  const guardrailInside = guardrails.filter((row) => ["inside_human_iqr", "inside_human_reference_range"].includes(row.bandStatus));
  const promotionEligible = !blockers.length
    && usable.length > 0
    && usableInside.length === usable.length
    && guardrailInside.length >= Math.ceil(guardrails.length * 0.5);
  return {
    candidateId: candidateId(candidatePath, candidate),
    candidatePath,
    inputArtifactType: str(candidate.artifactType),
    metricScope: metricScope(candidate),
    contextMetricScope: contextMetricScope(candidate),
    status: blockers.length ? "blocked" : "ready",
    promotionEligible,
    decision: promotionEligible ? "eligible_for_generated_candidate_promotion" : "needs_human_review_or_scorer_retune",
    blockers,
    metricEvaluations,
    summary: {
      optimizationMetricCount: usable.length,
      guardrailMetricCount: guardrails.length,
      diagnosticMetricCount: metricEvaluations.filter((row) => row.evaluationUse === "diagnostic_only").length,
      optimizationMetricsInsideBand: usableInside.length,
      guardrailMetricsInsideBand: guardrailInside.length,
      meanCandidateScore: round6(average(metricEvaluations.map((row) => row.candidateScore))),
      meanDistanceToHumanIqr: round6(average(metricEvaluations.map((row) => row.distanceToHumanIqr)))
    }
  };
}

export function buildHumanCalibratedCandidateEvaluation({
  humanCalibrationPath = "",
  alignmentPath = "",
  candidatePaths = [],
  outPath = ""
} = {}) {
  const resolvedHumanPath = resolvePath(humanCalibrationPath);
  const resolvedAlignmentPath = resolvePath(alignmentPath);
  if (!resolvedHumanPath || !fs.existsSync(resolvedHumanPath)) {
    throw new Error(`human calibration not found: ${resolvedHumanPath || "(missing)"}`);
  }
  if (!resolvedAlignmentPath || !fs.existsSync(resolvedAlignmentPath)) {
    throw new Error(`human/scorer alignment not found: ${resolvedAlignmentPath || "(missing)"}`);
  }
  const resolvedCandidatePaths = arr(candidatePaths).map(resolvePath).filter(Boolean);
  if (!resolvedCandidatePaths.length) throw new Error("at least one --candidate-score path is required");
  const missing = resolvedCandidatePaths.filter((candidatePath) => !fs.existsSync(candidatePath));
  if (missing.length) throw new Error(`candidate score not found: ${missing[0]}`);

  const calibration = readJson(resolvedHumanPath);
  const alignment = readJson(resolvedAlignmentPath);
  const calibrationApproved = str(calibration.status) === "approved"
    && Boolean(alignment.policy?.generatedTrainingMayUseHumanTargets);
  const bands = targetBands(calibration);
  const alignments = alignmentByMetric(alignment);
  const candidateEvaluations = resolvedCandidatePaths.map((candidatePath) => (
    evaluateCandidate(candidatePath, readJson(candidatePath), bands, alignments, calibrationApproved)
  ));
  const resolvedOutPath = resolvePath(outPath || path.join(path.dirname(resolvedAlignmentPath), "human-calibrated-candidate-evaluation.json"));
  const metricUses = candidateEvaluations.flatMap((candidate) => candidate.metricEvaluations.map((row) => row.evaluationUse));
  const artifact = {
    artifactType: "human_calibrated_candidate_evaluation_v1",
    artifactVersion: 1,
    generatedAt: new Date().toISOString(),
    status: calibrationApproved ? "ready" : "blocked",
    metricScope: "full_sequence_render",
    humanCalibrationPath: resolvedHumanPath,
    humanScorerAlignmentPath: resolvedAlignmentPath,
    policy: {
      productionReferencesAreReadOnly: true,
      generatedCandidatesMayBeEvaluatedAgainstHumanTargets: calibrationApproved,
      weakAutomatedDimensionsAreDiagnosticOnly: true,
      promotionRequiresAtLeastOneAlignedOptimizationMetric: true
    },
    targetBands: bands,
    summary: {
      humanCalibrationStatus: str(calibration.status),
      candidateCount: candidateEvaluations.length,
      promotionEligibleCandidateCount: candidateEvaluations.filter((row) => row.promotionEligible).length,
      optimizationMetricEvaluations: metricUses.filter((use) => use === "optimization_support").length,
      guardrailMetricEvaluations: metricUses.filter((use) => use === "human_calibrated_guardrail").length,
      diagnosticMetricEvaluations: metricUses.filter((use) => use === "diagnostic_only").length,
      primaryRisk: metricUses.includes("optimization_support")
        ? "Candidate evaluation has at least one aligned automated dimension, but human labels remain the anchor."
        : "No current automated dimension is aligned enough for unattended promotion; use this artifact for guardrails and human review selection."
    },
    candidateEvaluations,
    recommendedNextActions: [
      "Run this after generated full-sequence candidates have video_aesthetic_score_v1 artifacts.",
      "Prefer candidates that land inside human-reviewed bands without treating weak dimensions as optimization targets.",
      "Use failed or ambiguous candidates to retune weak automated dimensions and to select the next human review samples."
    ]
  };
  writeJson(resolvedOutPath, artifact);
  return { ...artifact, outPath: resolvedOutPath };
}

function parseArgs(argv = []) {
  const args = {
    humanCalibrationPath: "",
    alignmentPath: "",
    candidatePaths: [],
    outPath: ""
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = str(argv[index]);
    if (arg === "--human-calibration") args.humanCalibrationPath = argv[++index];
    else if (arg === "--alignment") args.alignmentPath = argv[++index];
    else if (arg === "--candidate-score" || arg === "--candidate-review") args.candidatePaths.push(argv[++index]);
    else if (arg === "--out") args.outPath = argv[++index];
    else if (arg === "--help") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return `Usage:
  node scripts/sequencer-render-training/tooling/build-human-calibrated-candidate-evaluation.mjs \\
    --human-calibration var/benchmarks/production-sequence-read/video-review-owned/production-human-review-calibration.json \\
    --alignment var/benchmarks/production-sequence-read/video-review-owned/production-human-scorer-alignment.json \\
    --candidate-score <generated-run-root>/video-aesthetic-score.json \\
    --out <generated-run-root>/human-calibrated-candidate-evaluation.json
`;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help || !args.humanCalibrationPath || !args.alignmentPath || !args.candidatePaths.length) {
      process.stdout.write(usage());
      process.exit(args.help ? 0 : 1);
    }
    const artifact = buildHumanCalibratedCandidateEvaluation(args);
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
