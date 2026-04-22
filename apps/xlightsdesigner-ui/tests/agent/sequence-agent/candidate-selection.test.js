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
