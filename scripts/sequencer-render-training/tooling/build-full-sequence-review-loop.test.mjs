import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildFullSequenceReviewLoop } from "./build-full-sequence-review-loop.mjs";

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function writePass(root, { passId, startMs, endMs, quality = 0.82, eligible = true } = {}) {
  const passDir = path.join(root, "passes", `experiment__${passId}`);
  const qualityDir = path.join(passDir, "render-review-quality");
  const reviewPath = path.join(qualityDir, "render-review.json");
  const qualityPath = path.join(qualityDir, "render-review-quality-summary.json");
  const observationPath = path.join(passDir, "render-observation.json");
  writeJson(reviewPath, {
    artifactType: "render_review_v1",
    section: { id: passId, label: passId, startMs, endMs },
    intent: { musicRole: { energy: "build" } },
    qualityScores: { overallQuality: quality }
  });
  writeJson(qualityPath, {
    artifactType: "layer_composition_render_review_quality_v1",
    passId,
    passWindow: { startMs, endMs },
    renderReviewRef: reviewPath,
    decision: eligible ? "accept" : "revise",
    overallQuality: quality,
    evidenceEligible: eligible,
    measurementStatus: eligible ? "quality_evidence" : "render_health_observation"
  });
  writeJson(observationPath, {
    macro: {
      leadModel: "Arch",
      leadModelShare: startMs === 0 ? 0.7 : 0.82,
      densityBucketSeries: startMs === 0 ? ["sparse"] : ["moderate"],
      meanSceneSpreadRatio: startMs === 0 ? 0.01 : 0.02,
      maxActiveNodeCount: startMs === 0 ? 40 : 80,
      maxActiveModelCount: startMs === 0 ? 1 : 2,
      activeFamilyTotals: startMs === 0 ? { Wave: 1 } : { Wave: 1, Bars: 1 },
      temporalRead: startMs === 0 ? "modulated" : "evolving",
      dominantColorRole: "blue",
      temporalMotionMean: 0.04
    }
  });
  return {
    experimentId: "experiment",
    passId,
    status: "completed",
    renderReviewDecision: eligible ? "accept" : "revise",
    renderReviewOverallQuality: quality,
    renderReviewQualityRef: qualityPath,
    renderReviewEvidenceEligible: eligible,
    renderReviewMeasurementStatus: eligible ? "quality_evidence" : "render_health_observation"
  };
}

test("full sequence review loop summarizes ordered run windows", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-full-sequence-review-"));
  const first = writePass(root, { passId: "opening", startMs: 0, endMs: 1000, quality: 0.8 });
  const second = writePass(root, { passId: "peak", startMs: 1000, endMs: 2000, quality: 0.9 });
  writeJson(path.join(root, "pass-runner-summary.json"), {
    artifactType: "layer_composition_pass_runner_summary_v1",
    results: [second, first]
  });

  const outPath = path.join(root, "full-sequence-review-loop.json");
  const artifact = buildFullSequenceReviewLoop({ runRoot: root, outPath });

  assert.equal(fs.existsSync(outPath), true);
  assert.equal(artifact.artifactType, "full_sequence_review_loop_v1");
  assert.equal(artifact.status, "ready");
  assert.equal(artifact.windowCount, 2);
  assert.equal(artifact.evidenceEligibleWindowCount, 2);
  assert.equal(artifact.meanEligibleQuality, 0.85);
  assert.deepEqual(artifact.windows.map((row) => row.passId), ["opening", "peak"]);
  assert.deepEqual(artifact.timingSources, ["section"]);
  assert.equal(artifact.qualityDimensions.includes("energy_progression"), true);
  assert.equal(artifact.qualityDimensions.includes("timing_alignment"), true);
  assert.equal(artifact.qualityDimensions.includes("repetition_with_variation"), true);
  assert.equal(fs.existsSync(artifact.progressionObservationRef), true);
});

test("full sequence review loop blocks when fewer than two windows exist", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-full-sequence-review-one-"));
  const first = writePass(root, { passId: "opening", startMs: 0, endMs: 1000, quality: 0.8 });
  writeJson(path.join(root, "pass-runner-summary.json"), {
    artifactType: "layer_composition_pass_runner_summary_v1",
    results: [first]
  });

  const artifact = buildFullSequenceReviewLoop({ runRoot: root });

  assert.equal(artifact.status, "insufficient_windows");
  assert.equal(artifact.windowCount, 1);
  assert.equal(artifact.progressionObservationRef, "");
});
