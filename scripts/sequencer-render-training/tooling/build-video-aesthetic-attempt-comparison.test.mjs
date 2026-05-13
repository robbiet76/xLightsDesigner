import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildVideoAestheticAttemptComparison } from "./build-video-aesthetic-attempt-comparison.mjs";

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function writeScore(root, scores, status = "ready") {
  writeJson(path.join(root, "video-aesthetic-score.json"), {
    artifactType: "video_aesthetic_score_v1",
    status,
    scores,
    promotion: {
      evidenceEligible: scores.overallAestheticScore >= 0.72
    }
  });
}

test("video aesthetic attempt comparison marks meaningful score gains as improved", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-video-attempt-"));
  const baseline = path.join(root, "baseline");
  const candidate = path.join(root, "candidate");
  writeScore(baseline, {
    overallAestheticScore: 0.63,
    pacingVariety: 0.2,
    visualBalance: 0.44,
    motionInterest: 0.5,
    colorDiscipline: 0.63
  });
  writeScore(candidate, {
    overallAestheticScore: 0.69,
    pacingVariety: 0.23,
    visualBalance: 0.48,
    motionInterest: 0.54,
    colorDiscipline: 0.63
  });

  const artifact = buildVideoAestheticAttemptComparison({
    baselineRunRoot: baseline,
    candidateRunRoot: candidate
  });

  assert.equal(artifact.artifactType, "video_aesthetic_attempt_comparison_v1");
  assert.equal(artifact.status, "ready");
  assert.equal(artifact.metricScope, "section_render");
  assert.equal(artifact.promotionUse, "sequencing_behavior_candidate");
  assert.equal(artifact.comparisonStatus, "improved");
  assert.equal(artifact.promotionEligible, true);
  assert.equal(artifact.summary.overallAestheticScoreDelta, 0.06);
  assert.equal(artifact.summary.improvedDimensionCount, 3);
  assert.equal(fs.existsSync(path.join(candidate, "video-aesthetic-attempt-comparison.json")), true);
});

test("video aesthetic attempt comparison blocks missing baseline score", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-video-attempt-missing-"));
  const baseline = path.join(root, "baseline");
  const candidate = path.join(root, "candidate");
  fs.mkdirSync(baseline, { recursive: true });
  writeScore(candidate, {
    overallAestheticScore: 0.69,
    pacingVariety: 0.23
  });

  const artifact = buildVideoAestheticAttemptComparison({
    baselineRunRoot: baseline,
    candidateRunRoot: candidate
  });

  assert.equal(artifact.status, "blocked");
  assert.equal(artifact.comparisonStatus, "blocked");
  assert.equal(artifact.blockers.includes("baseline_video_aesthetic_score_missing"), true);
});

test("video aesthetic attempt comparison marks broad regression", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-video-attempt-regressed-"));
  const baseline = path.join(root, "baseline");
  const candidate = path.join(root, "candidate");
  writeScore(baseline, {
    overallAestheticScore: 0.69,
    pacingVariety: 0.3,
    visualBalance: 0.5,
    motionInterest: 0.55,
    transitionFlow: 0.7
  });
  writeScore(candidate, {
    overallAestheticScore: 0.67,
    pacingVariety: 0.24,
    visualBalance: 0.46,
    motionInterest: 0.51,
    transitionFlow: 0.65
  });

  const artifact = buildVideoAestheticAttemptComparison({
    baselineRunRoot: baseline,
    candidateRunRoot: candidate
  });

  assert.equal(artifact.comparisonStatus, "regressed");
  assert.equal(artifact.promotionEligible, false);
  assert.equal(artifact.summary.regressedDimensionCount, 4);
});

test("video aesthetic attempt comparison marks material overall drift as regression", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-video-attempt-overall-regressed-"));
  const baseline = path.join(root, "baseline");
  const candidate = path.join(root, "candidate");
  writeScore(baseline, {
    overallAestheticScore: 0.7443,
    pacingVariety: 0.6,
    visualBalance: 0.7,
    motionInterest: 0.66
  });
  writeScore(candidate, {
    overallAestheticScore: 0.73455,
    pacingVariety: 0.6,
    visualBalance: 0.7,
    motionInterest: 0.66
  });

  const artifact = buildVideoAestheticAttemptComparison({
    baselineRunRoot: baseline,
    candidateRunRoot: candidate
  });

  assert.equal(artifact.comparisonStatus, "regressed");
  assert.equal(artifact.promotionEligible, false);
  assert.equal(artifact.summary.overallAestheticScoreDelta, -0.00975);
});

test("video aesthetic attempt comparison keeps high-quality style variants neutral", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-video-attempt-style-variant-"));
  const baseline = path.join(root, "baseline");
  const candidate = path.join(root, "candidate");
  writeScore(baseline, {
    overallAestheticScore: 0.804886,
    clutterControl: 1,
    intentMatch: 0.89,
    sectionQualityMean: 0.835,
    colorDiscipline: 0.98,
    transitionFlow: 0.79
  });
  writeScore(candidate, {
    overallAestheticScore: 0.788542,
    clutterControl: 1,
    intentMatch: 0.885,
    sectionQualityMean: 0.833,
    colorDiscipline: 0.979,
    transitionFlow: 0.791
  });

  const artifact = buildVideoAestheticAttemptComparison({
    baselineRunRoot: baseline,
    candidateRunRoot: candidate
  });

  assert.equal(artifact.comparisonStatus, "neutral");
  assert.equal(artifact.promotionEligible, false);
  assert.equal(artifact.summary.overallAestheticScoreDelta, -0.016344);
});

test("video aesthetic attempt comparison treats score recovery with hard tradeoff as neutral", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-video-attempt-tradeoff-"));
  const baseline = path.join(root, "baseline");
  const candidate = path.join(root, "candidate");
  writeScore(baseline, {
    overallAestheticScore: 0.67,
    colorDiscipline: 0.1,
    sectionQualityMean: 0.77,
    intentMatch: 0.73
  });
  writeScore(candidate, {
    overallAestheticScore: 0.75,
    colorDiscipline: 0.91,
    sectionQualityMean: 0.88,
    intentMatch: 0.68
  });

  const artifact = buildVideoAestheticAttemptComparison({
    baselineRunRoot: baseline,
    candidateRunRoot: candidate
  });

  assert.equal(artifact.comparisonStatus, "neutral");
  assert.equal(artifact.promotionEligible, false);
  assert.equal(artifact.summary.overallAestheticScoreDelta, 0.08);
  assert.equal(artifact.summary.strongestRegressions[0].dimension, "intent_match");
});

test("video aesthetic attempt comparison includes stronger video context dimensions", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-video-aesthetic-context-comparison-"));
  const baseline = path.join(root, "baseline");
  const candidate = path.join(root, "candidate");
  writeScore(baseline, {
    overallAestheticScore: 0.72,
    narrativeShape: 0.62,
    focalHandoffStability: 0.58,
    palettePurposeCoverage: 0.66,
    fullSequenceContext: 0.6
  });
  writeScore(candidate, {
    overallAestheticScore: 0.731,
    narrativeShape: 0.69,
    focalHandoffStability: 0.64,
    palettePurposeCoverage: 0.78,
    fullSequenceContext: 0.68
  });

  const artifact = buildVideoAestheticAttemptComparison({
    baselineRunRoot: baseline,
    candidateRunRoot: candidate
  });

  const dimensions = artifact.deltas.map((row) => row.dimension);
  assert.equal(dimensions.includes("narrative_shape"), true);
  assert.equal(dimensions.includes("focal_handoff_stability"), true);
  assert.equal(dimensions.includes("palette_purpose_coverage"), true);
  assert.equal(dimensions.includes("full_sequence_context"), true);
  assert.equal(artifact.comparisonStatus, "improved");
});

test("video aesthetic attempt comparison blocks non-sequence metric scopes", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-video-attempt-scope-"));
  const baseline = path.join(root, "baseline");
  const candidate = path.join(root, "candidate");
  writeScore(baseline, { overallAestheticScore: 0.6 });
  writeScore(candidate, { overallAestheticScore: 0.8 });
  const candidateScorePath = path.join(candidate, "video-aesthetic-score.json");
  const candidateScore = JSON.parse(fs.readFileSync(candidateScorePath, "utf8"));
  writeJson(candidateScorePath, {
    ...candidateScore,
    metricScope: "effect_capability",
    promotionUse: "capability_prior_only"
  });

  const artifact = buildVideoAestheticAttemptComparison({
    baselineRunRoot: baseline,
    candidateRunRoot: candidate
  });

  assert.equal(artifact.status, "blocked");
  assert.equal(artifact.comparisonStatus, "blocked");
  assert.equal(artifact.promotionEligible, false);
  assert.equal(artifact.blockers.includes("candidate_metric_scope_not_sequence_level"), true);
});
