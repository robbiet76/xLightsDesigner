import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildProductionScorerCalibrationProfile } from "./build-production-scorer-calibration-profile.mjs";

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

test("production scorer calibration profile merges video and model-region dimensions", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-production-profile-"));
  const videoPath = path.join(root, "video-dimensions.json");
  const handoffPath = path.join(root, "handoff.json");
  const diagnosticsPath = path.join(root, "diagnostics.json");
  const outPath = path.join(root, "profile.json");
  writeJson(videoPath, {
    artifactType: "production_full_sequence_dimensions_v1",
    references: [
      { sequenceId: "A", scores: { energyArc: 0.4, sectionContrast: 0.2, pacingVariety: 0.3, paletteEvolution: 0.6, motifDevelopment: 0.9 }, risks: { abruptnessRisk: 0.1 }, confidence: { energyArc: "medium" } },
      { sequenceId: "B", scores: { energyArc: 0.9, sectionContrast: 0.8, pacingVariety: 0.35, paletteEvolution: 0.75, motifDevelopment: 0.95 }, risks: { abruptnessRisk: 0.05 }, confidence: { energyArc: "medium" } }
    ]
  });
  writeJson(handoffPath, {
    artifactType: "production_model_region_handoff_v1",
    references: [
      { sequenceId: "A", scores: { modelAwareFocalHandoff: 0.3, resolvedActivityRatio: 0.4, leadTargetChangeRatio: 0, leadRegionChangeRatio: 0, averageCenterMovement: 0.01, averageActiveRegionCount: 2 }, confidence: "model_aware" },
      { sequenceId: "B", scores: { modelAwareFocalHandoff: 0.95, resolvedActivityRatio: 0.75, leadTargetChangeRatio: 1, leadRegionChangeRatio: 1, averageCenterMovement: 0.08, averageActiveRegionCount: 4 }, confidence: "model_aware" }
    ]
  });
  writeJson(diagnosticsPath, {
    artifactType: "production_scorer_calibration_diagnostics_v1",
    status: "scorer_calibration_needed"
  });

  const profile = buildProductionScorerCalibrationProfile({
    videoDimensionsPath: videoPath,
    modelRegionHandoffPath: handoffPath,
    scorerDiagnosticsPath: diagnosticsPath,
    outPath
  });

  assert.equal(profile.artifactType, "production_scorer_calibration_profile_v1");
  assert.equal(profile.summary.referenceCount, 2);
  assert.equal(profile.summary.legacyScorerStatus, "scorer_calibration_needed");
  assert.equal(profile.dimensionRanges.energyArc.range, 0.5);
  assert.equal(profile.dimensionRanges.modelAwareFocalHandoff.range, 0.65);
  assert.equal(profile.calibrationTargets.energyArc.optimizationUse, "primary_calibration_dimension");
  assert.equal(profile.policy.generatedTrainingMayUseAsRangeTargetsAfterHumanReview, false);
  assert.equal(profile.references.every((row) => row.combinedCalibrationScore >= 0 && row.combinedCalibrationScore <= 1), true);
  assert.deepEqual(profile.references.map((row) => row.sequenceId), ["A", "B"]);
  assert.equal(profile.references[0].confidence.modelRegion, "model_aware");
  assert.equal(fs.existsSync(outPath), true);
});
