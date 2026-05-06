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
