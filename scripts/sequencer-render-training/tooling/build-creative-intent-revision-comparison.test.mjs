import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildCreativeIntentRevisionComparison } from "./build-creative-intent-revision-comparison.mjs";

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function writeReview(root, passId, scores) {
  const dir = path.join(root, "passes", `creative__${passId}`, "render-review-quality");
  const reviewPath = path.join(dir, "render-review.json");
  const qualityPath = path.join(dir, "render-review-quality-summary.json");
  writeJson(reviewPath, {
    artifactType: "render_review_v1",
    qualityScores: scores,
    critique: { decision: "accept" },
    evidenceQualification: { eligible: true, status: "quality_evidence" }
  });
  writeJson(qualityPath, {
    artifactType: "layer_composition_render_review_quality_v1",
    passId,
    renderReviewRef: reviewPath,
    decision: "accept",
    evidenceEligible: true,
    measurementStatus: "quality_evidence"
  });
  return {
    experimentId: "creative-intent-revision-comparison-mono_white",
    passId,
    status: "completed",
    renderReviewDecision: "accept",
    renderReviewQualityRef: qualityPath,
    renderReviewEvidenceEligible: true,
    renderReviewMeasurementStatus: "quality_evidence"
  };
}

test("creative intent revision comparison scores paired baseline and revised passes", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-creative-revision-"));
  writeJson(path.join(root, "training-plan.json"), {
    artifactType: "layer_composition_experiment_manifest_v1",
    experiments: [{
      experimentId: "creative-intent-revision-comparison-mono_white",
      family: "creative_intent_revision_comparison",
      paletteProfile: "mono_white",
      designType: "before_after_revision_pair",
      revisionComparisonContract: {
        baselinePassId: "intent_first_draft",
        revisedPassId: "intent_targeted_revision"
      },
      passes: [{
        passId: "intent_first_draft"
      }, {
        passId: "intent_targeted_revision",
        comparisonBasePassId: "intent_first_draft",
        changeType: "creative_intent_revision"
      }]
    }]
  });
  const baseline = writeReview(root, "intent_first_draft", {
    overallQuality: 0.76,
    intentMatch: 0.72,
    visualReadability: 0.78,
    motionCoherence: 0.74,
    clutterControl: 0.8
  });
  const revised = writeReview(root, "intent_targeted_revision", {
    overallQuality: 0.84,
    intentMatch: 0.81,
    visualReadability: 0.79,
    motionCoherence: 0.78,
    clutterControl: 0.79
  });
  writeJson(path.join(root, "pass-runner-summary.json"), {
    artifactType: "layer_composition_pass_runner_summary_v1",
    results: [revised, baseline]
  });

  const artifact = buildCreativeIntentRevisionComparison({ runRoot: root });

  assert.equal(artifact.artifactType, "creative_intent_revision_comparison_v1");
  assert.equal(artifact.status, "ready");
  assert.equal(artifact.comparisonCount, 1);
  assert.equal(artifact.improvedComparisonCount, 1);
  assert.equal(artifact.promotionEligibleCount, 1);
  assert.equal(artifact.comparisons[0].comparisonStatus, "improved");
  assert.equal(artifact.comparisons[0].deltas.intentMatch, 0.09);
  assert.equal(fs.existsSync(path.join(root, "creative-intent-revision-comparison.json")), true);
});

test("creative intent revision comparison blocks regressions", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-creative-revision-regression-"));
  writeJson(path.join(root, "training-plan.json"), {
    experiments: [{
      experimentId: "creative-intent-revision-comparison-mono_white",
      family: "creative_intent_revision_comparison",
      paletteProfile: "mono_white",
      passes: [{
        passId: "intent_first_draft"
      }, {
        passId: "intent_targeted_revision",
        comparisonBasePassId: "intent_first_draft",
        changeType: "creative_intent_revision"
      }]
    }]
  });
  const baseline = writeReview(root, "intent_first_draft", {
    overallQuality: 0.8,
    intentMatch: 0.8,
    visualReadability: 0.82,
    motionCoherence: 0.78,
    clutterControl: 0.84
  });
  const revised = writeReview(root, "intent_targeted_revision", {
    overallQuality: 0.79,
    intentMatch: 0.81,
    visualReadability: 0.74,
    motionCoherence: 0.8,
    clutterControl: 0.72
  });
  writeJson(path.join(root, "pass-runner-summary.json"), {
    results: [baseline, revised]
  });

  const artifact = buildCreativeIntentRevisionComparison({ runRoot: root });

  assert.equal(artifact.status, "ready");
  assert.equal(artifact.improvedComparisonCount, 0);
  assert.equal(artifact.comparisons[0].comparisonStatus, "blocked");
  assert.equal(artifact.comparisons[0].blockers.includes("readability_regressed"), true);
  assert.equal(artifact.comparisons[0].blockers.includes("clutter_control_regressed"), true);
});
