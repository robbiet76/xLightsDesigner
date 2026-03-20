import test from "node:test";
import assert from "node:assert/strict";

import { buildPracticalSequenceValidation } from "../../../agent/sequence-agent/practical-sequence-validation.js";

test("practical sequence validation summarizes readback and design alignment", () => {
  const artifact = buildPracticalSequenceValidation({
    planHandoff: {
      planId: "plan-1",
      metadata: {
        sequencingDesignHandoffSummary: "Tree chorus",
        sequencingSectionDirectiveCount: 1,
        trainingKnowledge: {
          artifactType: "sequencer_stage1_training_bundle",
          artifactVersion: "1.0"
        }
      }
    },
    applyResult: {
      artifactId: "apply-1",
      status: "applied"
    },
    verification: {
      revisionAdvanced: true,
      expectedMutationsPresent: true,
      checks: [
        { kind: "effect", target: "TreeRound@0", ok: true, detail: "Spirals present" }
      ],
      designContext: {
        designSummary: "Tree chorus",
        sectionDirectiveCount: 1
      },
      designAlignment: {
        primaryFocusTargetIds: ["TreeRound"],
        coveredPrimaryFocusTargetIds: ["TreeRound"],
        uncoveredPrimaryFocusTargetIds: [],
        preferredVisualFamilies: ["spiral_flow"],
        preferredEffectHints: ["Spirals"],
        observedTargets: ["TreeRound"],
        observedEffectNames: ["Spirals"],
        roleCoverage: [{ role: "lead", ok: true, coveredTargetIds: ["TreeRound"] }]
      },
      designChecks: [
        { kind: "design-focus", target: "primary-focus", ok: true, detail: "covered TreeRound" },
        { kind: "design-visual-family", target: "spiral_flow", ok: true, detail: "matched Spirals" }
      ]
    }
  });

  assert.equal(artifact.artifactType, "practical_sequence_validation_v1");
  assert.equal(artifact.overallOk, true);
  assert.equal(artifact.trainingKnowledge.artifactType, "sequencer_stage1_training_bundle");
  assert.equal(artifact.summary.readbackChecks.passed, 1);
  assert.equal(artifact.summary.designChecks.passed, 2);
});
