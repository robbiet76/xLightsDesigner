import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { validateSequencingQualityCurriculum } from "./validate-sequencing-quality-curriculum.mjs";

test("sequencing quality curriculum is controller-ready", () => {
  const curriculum = JSON.parse(fs.readFileSync("scripts/sequencer-render-training/catalog/sequencing-quality-curriculum-v1.json", "utf8"));
  const result = validateSequencingQualityCurriculum(curriculum);

  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.summary.curriculumId, "sequencing-quality-v1");
  assert.ok(result.summary.areaCount >= 8);
  assert.ok(result.summary.goalCount >= 8);
  assert.ok(result.summary.activeGoalIds.includes("layer.same_target.mono_white.basic"));
  assert.ok(result.summary.activeGoalIds.includes("layer.rgb_primary.basic"));
});

test("sequencing quality curriculum validator rejects unknown goal areas", () => {
  const result = validateSequencingQualityCurriculum({
    artifactType: "sequencing_quality_curriculum_v1",
    curriculumId: "sequencing-quality-v1",
    selectionPolicy: {
      cleanupRequiredAfterEveryLoop: true,
      promotionRequires: {
        minimumStableSamples: 2,
        minimumOverallQuality: 0.72,
        acceptedTrendStatuses: ["stable"]
      }
    },
    areas: [{ areaId: "known", priority: 1 }],
    goals: [{
      goalId: "bad",
      areaId: "missing",
      priority: 1,
      status: "not_started",
      requiredStableSamples: 2,
      coverage: {}
    }]
  });

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("unknown areaId")));
});
