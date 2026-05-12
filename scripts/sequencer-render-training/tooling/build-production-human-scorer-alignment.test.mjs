import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildProductionHumanScorerAlignment } from "./build-production-human-scorer-alignment.mjs";

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

test("buildProductionHumanScorerAlignment compares human choices to automated profile dimensions", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-human-scorer-alignment-"));
  const humanPath = path.join(root, "human.json");
  const outPath = path.join(root, "alignment.json");
  writeJson(humanPath, {
    artifactType: "production_human_review_calibration_v1",
    status: "approved",
    summary: { reviewed: 2 },
    reviews: [
      {
        sequenceId: "Strong",
        status: "reviewed",
        recommendation: "approve",
        metricChoices: {
          energyArc: "excellent_dynamic_arc",
          sectionContrast: "excellent_section_identity",
          paletteEvolution: "excellent_color_story",
          focalHandoff: "excellent_focus_direction",
          targetHierarchy: "excellent_layer_hierarchy",
          overallFit: "excellent_reference"
        },
        profileSnapshot: {
          combinedCalibrationScore: 0.92,
          dimensions: {
            energyArc: 0.95,
            sectionContrast: 0.9,
            paletteEvolution: 0.88,
            modelAwareFocalHandoff: 0.93,
            resolvedActivityRatio: 0.85,
            leadTargetChangeRatio: 0.9,
            leadRegionChangeRatio: 0.95
          }
        }
      },
      {
        sequenceId: "Mixed",
        status: "reviewed",
        recommendation: "approve",
        metricChoices: {
          energyArc: "mostly_flat_or_overdriven",
          sectionContrast: "weak_section_separation",
          paletteEvolution: "limited_or_inconsistent_color",
          focalHandoff: "weak_or_unclear_focus",
          targetHierarchy: "weak_hierarchy",
          overallFit: "mixed_reference"
        },
        profileSnapshot: {
          combinedCalibrationScore: 0.48,
          dimensions: {
            energyArc: 0.5,
            sectionContrast: 0.45,
            paletteEvolution: 0.4,
            modelAwareFocalHandoff: 0.35,
            resolvedActivityRatio: 0.38,
            leadTargetChangeRatio: 0.3,
            leadRegionChangeRatio: 0.34
          }
        }
      }
    ]
  });

  const artifact = buildProductionHumanScorerAlignment({
    humanCalibrationPath: humanPath,
    outPath
  });

  assert.equal(artifact.artifactType, "production_human_scorer_alignment_v1");
  assert.equal(artifact.summary.humanCalibrationStatus, "approved");
  assert.equal(artifact.summary.reviewedReferenceCount, 2);
  assert.equal(artifact.policy.generatedTrainingMayUseHumanTargets, true);
  const energy = artifact.metricAlignments.find((row) => row.metric === "energyArc");
  assert.equal(energy.reviewedCount, 2);
  assert.equal(energy.correlation, 1);
  assert.equal(energy.status, "aligned");
  const hierarchy = artifact.metricAlignments.find((row) => row.metric === "targetHierarchy");
  assert.deepEqual(hierarchy.mappedAutomatedDimensions, ["resolvedActivityRatio", "leadTargetChangeRatio", "leadRegionChangeRatio"]);
  assert.equal(fs.existsSync(outPath), true);
});
