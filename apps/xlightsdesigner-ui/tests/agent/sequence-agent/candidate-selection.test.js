import test from "node:test";
import assert from "node:assert/strict";

import { buildCandidateSelectionV1 } from "../../../agent/sequence-agent/candidate-selection.js";

test("candidate selection penalizes oscillation back to the previous pass shape", () => {
  const out = buildCandidateSelectionV1({
    intentEnvelope: {
      artifactId: "intent-1",
      novelty: {
        explorationPressure: "medium",
        reuseTolerance: "medium"
      }
    },
    realizationCandidates: {
      artifactId: "candidates-1",
      candidates: [
        {
          candidateId: "candidate-stable",
          fitSignals: { overallFit: "high" },
          revisionSignals: { revisionScore: 0.7 },
          noveltySignals: {
            noveltyScore: 0.6,
            memoryPenalty: 0,
            oscillationPenalty: 0,
            oscillationRisk: "low"
          },
          riskSignals: {
            attentionConflictRisk: "medium",
            layeringConflictRisk: "low",
            complexityRisk: "low",
            renderUncertainty: "medium"
          }
        },
        {
          candidateId: "candidate-oscillating",
          fitSignals: { overallFit: "high" },
          revisionSignals: { revisionScore: 0.7 },
          noveltySignals: {
            noveltyScore: 0.6,
            memoryPenalty: 0,
            oscillationPenalty: 0.22,
            oscillationRisk: "high"
          },
          riskSignals: {
            attentionConflictRisk: "medium",
            layeringConflictRisk: "low",
            complexityRisk: "low",
            renderUncertainty: "medium"
          }
        }
      ]
    },
    selectionContext: {
      phase: "review",
      seed: "review::req-1::rev-1",
      explorationEnabled: true,
      unresolvedSignals: ["lead_mismatch"],
      retryPressureSignals: ["low_change_retry"]
    },
    selectionSeed: "review::req-1::rev-1"
  });

  assert.equal(out.artifactType, "candidate_selection_v1");
  assert.equal(out.scoredCandidates[0].candidateId, "candidate-stable");
  const oscillating = out.scoredCandidates.find((row) => row.candidateId === "candidate-oscillating");
  assert.equal(oscillating.oscillationRisk, "high");
});

test("candidate selection prefers candidates aligned to structured mismatch bias", () => {
  const out = buildCandidateSelectionV1({
    intentEnvelope: {
      artifactId: "intent-2",
      novelty: {
        explorationPressure: "medium",
        reuseTolerance: "medium"
      }
    },
    realizationCandidates: {
      artifactId: "candidates-2",
      candidates: [
        {
          candidateId: "candidate-matched",
          fitSignals: { overallFit: "high" },
          revisionSignals: { revisionScore: 0.72 },
          noveltySignals: {
            noveltyScore: 0.55,
            memoryPenalty: 0,
            oscillationPenalty: 0,
            oscillationRisk: "low"
          },
          compositionProfile: {
            footprint: "narrow"
          },
          temporalProfile: {
            profile: "evolving"
          },
          layeringProfile: {
            sameStructureDensity: "low",
            separationStrategy: "high"
          },
          riskSignals: {
            attentionConflictRisk: "medium",
            layeringConflictRisk: "low",
            complexityRisk: "low",
            renderUncertainty: "medium"
          }
        },
        {
          candidateId: "candidate-mismatched",
          fitSignals: { overallFit: "high" },
          revisionSignals: { revisionScore: 0.72 },
          noveltySignals: {
            noveltyScore: 0.55,
            memoryPenalty: 0,
            oscillationPenalty: 0,
            oscillationRisk: "low"
          },
          compositionProfile: {
            footprint: "full_scene"
          },
          temporalProfile: {
            profile: "steady"
          },
          layeringProfile: {
            sameStructureDensity: "high",
            separationStrategy: "low"
          },
          riskSignals: {
            attentionConflictRisk: "medium",
            layeringConflictRisk: "low",
            complexityRisk: "low",
            renderUncertainty: "medium"
          }
        }
      ]
    },
    selectionContext: {
      phase: "review",
      seed: "review::req-2::rev-2",
      explorationEnabled: true,
      unresolvedSignals: ["focus_mismatch", "progression_mismatch", "layering_mismatch"],
      retryPressureSignals: [],
      changeBias: {
        composition: {
          mismatch: true,
          targetShape: "narrow_focus"
        },
        progression: {
          mismatch: true,
          temporalVariation: "increase"
        },
        layering: {
          mismatch: true,
          density: "reduce",
          separation: "increase"
        },
        preservation: {
          mismatch: true,
          existingEffects: "preserve_unless_explicit_replace"
        }
      }
    },
    selectionSeed: "review::req-2::rev-2"
  });

  assert.equal(out.artifactType, "candidate_selection_v1");
  assert.equal(out.scoredCandidates[0].candidateId, "candidate-matched");
  const matched = out.scoredCandidates.find((row) => row.candidateId === "candidate-matched");
  const mismatched = out.scoredCandidates.find((row) => row.candidateId === "candidate-mismatched");
  assert.ok(matched.biasAlignmentScore > mismatched.biasAlignmentScore);
  assert.equal(out.selectionContext.changeBias.composition.targetShape, "narrow_focus");
  assert.equal(out.selectionContext.changeBias.progression.temporalVariation, "increase");
  assert.equal(out.selectionContext.changeBias.layering.density, "reduce");
  assert.equal(out.selectionContext.changeBias.preservation.existingEffects, "preserve_unless_explicit_replace");
});
