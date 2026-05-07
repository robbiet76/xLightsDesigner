import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildProductionHumanReviewCalibration } from "./build-production-human-review-calibration.mjs";

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function profile() {
  return {
    artifactType: "production_scorer_calibration_profile_v1",
    references: [
      {
        sequenceId: "A",
        combinedCalibrationScore: 0.7,
        dimensions: { energyArc: 0.8, modelAwareFocalHandoff: 0.6 }
      },
      {
        sequenceId: "B",
        combinedCalibrationScore: 0.5,
        dimensions: { energyArc: 0.4, modelAwareFocalHandoff: 0.3 }
      }
    ]
  };
}

test("production human review calibration writes a pending template and gate", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-human-review-template-"));
  const profilePath = path.join(root, "profile.json");
  const templatePath = path.join(root, "notes.template.json");
  const outPath = path.join(root, "review.json");
  writeJson(profilePath, profile());

  const artifact = buildProductionHumanReviewCalibration({
    profilePath,
    writeTemplatePath: templatePath,
    outPath
  });

  assert.equal(artifact.artifactType, "production_human_review_calibration_v1");
  assert.equal(artifact.status, "human_review_pending");
  assert.equal(artifact.policy.generatedTrainingMayUseProfile, false);
  assert.equal(artifact.summary.pending, 2);
  assert.equal(fs.existsSync(templatePath), true);
  const template = JSON.parse(fs.readFileSync(templatePath, "utf8"));
  assert.equal(template.artifactType, "production_human_review_notes_v1");
  assert.deepEqual(template.reviews.map((row) => row.sequenceId), ["A", "B"]);
});

test("production human review calibration approves reviewed notes", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-human-review-approved-"));
  const profilePath = path.join(root, "profile.json");
  const notesPath = path.join(root, "notes.json");
  const outPath = path.join(root, "review.json");
  writeJson(profilePath, profile());
  writeJson(notesPath, {
    artifactType: "production_human_review_notes_v1",
    reviews: [
      {
        sequenceId: "A",
        status: "reviewed",
        recommendation: "approve",
        reviewer: "tester",
        summary: "Strong arc.",
        knownStrengths: ["clear lift"],
        knownWeaknesses: [],
        calibrationNotes: { energyArc: "Good build." }
      },
      {
        sequenceId: "B",
        status: "reviewed",
        recommendation: "adjust",
        reviewer: "tester",
        summary: "Useful but needs lower handoff target.",
        knownStrengths: ["contrast"],
        knownWeaknesses: ["handoff is intentionally subtle"],
        calibrationNotes: { focalHandoff: "Do not over-penalize subtle holds." }
      }
    ]
  });

  const artifact = buildProductionHumanReviewCalibration({ profilePath, notesPath, outPath });

  assert.equal(artifact.status, "approved_with_adjustments");
  assert.equal(artifact.policy.generatedTrainingMayUseProfile, true);
  assert.deepEqual(artifact.approvedSequenceIds, ["A"]);
  assert.deepEqual(artifact.adjustmentSequenceIds, ["B"]);
  assert.equal(artifact.summary.pending, 0);
  assert.equal(artifact.reviews[0].profileSnapshot.combinedCalibrationScore, 0.7);
});
