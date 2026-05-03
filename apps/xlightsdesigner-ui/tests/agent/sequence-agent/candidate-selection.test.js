import test from "node:test";
import assert from "node:assert/strict";

import { buildCandidateSelectionV1 } from "../../../agent/sequence-agent/candidate-selection.js";
import { buildCandidateSelectionContext } from "../../../agent/sequence-agent/candidate-selection-context.js";

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

test("candidate selection context builds advisory submodel probe plan from render evidence", () => {
  const context = buildCandidateSelectionContext({
    requestId: "req-submodel",
    phase: "review",
    sequenceRevision: "rev-1",
    renderValidationEvidence: {
      renderObservationRef: "render-1",
      submodelEvidence: [
        {
          targetId: "Singing Face/@Mouth1",
          parentId: "Singing Face",
          siblingCount: 10,
          siblingIds: ["Singing Face/@Mouth2"],
          overlappingSiblingIds: [],
          nodeCoverage: { nodeCount: 8, parentNodeCount: 143, ratio: 0.0559 },
          structureHints: ["feature_mouth"]
        },
        {
          targetId: "Spinner/Spoke 1",
          parentId: "Spinner",
          siblingCount: 11,
          siblingIds: ["Spinner/Spoke 2"],
          overlappingSiblingIds: ["Spinner/Center"],
          nodeCoverage: { nodeCount: 7, parentNodeCount: 85, ratio: 0.0824 },
          structureHints: ["radial_spoke"]
        }
      ]
    }
  });

  assert.equal(context.submodelProbePlan.strategy, "submodel_first_with_parent_control");
  assert.deepEqual(context.submodelProbePlan.parentTargetIds, ["Singing Face", "Spinner"]);
  assert.deepEqual(context.submodelProbePlan.recommendedSubmodelTargetIds, ["Singing Face/@Mouth1", "Spinner/Spoke 1"]);
  assert.deepEqual(context.submodelProbePlan.siblingPairProbeIds, ["Spinner/Center + Spinner/Spoke 1"]);
  assert.ok(context.submodelProbePlan.reasons.includes("feature_submodels_present"));
  assert.ok(context.seed.includes("submodel:submodel_first_with_parent_control"));

  const out = buildCandidateSelectionV1({
    intentEnvelope: {
      artifactId: "intent-submodel",
      novelty: { explorationPressure: "medium", reuseTolerance: "medium" }
    },
    realizationCandidates: {
      artifactId: "candidates-submodel",
      candidates: [
        {
          candidateId: "candidate-a",
          fitSignals: { overallFit: "high" },
          revisionSignals: { revisionScore: 0.7 },
          noveltySignals: { noveltyScore: 0.5 },
          riskSignals: {
            attentionConflictRisk: "medium",
            layeringConflictRisk: "medium",
            complexityRisk: "medium",
            renderUncertainty: "medium"
          }
        }
      ]
    },
    selectionContext: context,
    selectionSeed: context.seed
  });

  assert.equal(out.selectionContext.submodelProbePlan.strategy, "submodel_first_with_parent_control");
  assert.deepEqual(out.selectionContext.submodelProbePlan.recommendedSubmodelTargetIds, ["Singing Face/@Mouth1", "Spinner/Spoke 1"]);
});

test("candidate selection uses project target behavior learning as advisory evidence", () => {
  const out = buildCandidateSelectionV1({
    intentEnvelope: {
      artifactId: "intent-behavior",
      novelty: { explorationPressure: "medium", reuseTolerance: "medium" }
    },
    realizationCandidates: {
      artifactId: "candidates-behavior",
      candidates: [
        {
          candidateId: "candidate-known-good",
          realizationRefs: [
            { targetIds: ["CustomFace/@Mouth"], effectName: "On" }
          ],
          fitSignals: { overallFit: "medium" },
          revisionSignals: { revisionScore: 0.6 },
          noveltySignals: { noveltyScore: 0.5, memoryPenalty: 0, oscillationPenalty: 0, oscillationRisk: "low" },
          riskSignals: {
            attentionConflictRisk: "medium",
            layeringConflictRisk: "medium",
            complexityRisk: "medium",
            renderUncertainty: "medium"
          }
        },
        {
          candidateId: "candidate-known-poor",
          realizationRefs: [
            { targetIds: ["CustomFace/@Mouth"], effectName: "Bars" }
          ],
          fitSignals: { overallFit: "medium" },
          revisionSignals: { revisionScore: 0.6 },
          noveltySignals: { noveltyScore: 0.5, memoryPenalty: 0, oscillationPenalty: 0, oscillationRisk: "low" },
          riskSignals: {
            attentionConflictRisk: "medium",
            layeringConflictRisk: "medium",
            complexityRisk: "medium",
            renderUncertainty: "medium"
          }
        }
      ]
    },
    targetBehaviorLearning: {
      artifactPath: "/project/display/target-behavior.json",
      records: [
        {
          recordId: "tbl1:good",
          targetId: "CustomFace/@Mouth",
          effectName: "On",
          stats: { sampleCount: 4, positiveCount: 4, negativeCount: 0 }
        },
        {
          recordId: "tbl1:poor",
          targetId: "CustomFace/@Mouth",
          effectName: "Bars",
          stats: { sampleCount: 4, positiveCount: 0, negativeCount: 4 }
        }
      ]
    },
    selectionContext: {
      phase: "proposal",
      seed: "proposal::behavior",
      explorationEnabled: true
    }
  });

  assert.equal(out.scoredCandidates[0].candidateId, "candidate-known-good");
  const good = out.scoredCandidates.find((row) => row.candidateId === "candidate-known-good");
  const poor = out.scoredCandidates.find((row) => row.candidateId === "candidate-known-poor");
  assert.equal(good.behaviorEvidenceCount, 1);
  assert.equal(good.behaviorScore, 1);
  assert.equal(poor.behaviorScore, 0);
  assert.ok(good.selectionScore > poor.selectionScore);
  assert.equal(out.selectionContext.targetBehaviorLearning.recordCount, 2);
});

test("candidate selection matches project target behavior by fingerprint before target name", () => {
  const out = buildCandidateSelectionV1({
    intentEnvelope: {
      artifactId: "intent-behavior-fingerprint",
      novelty: { explorationPressure: "medium", reuseTolerance: "medium" }
    },
    realizationCandidates: {
      artifactId: "candidates-behavior-fingerprint",
      candidates: [
        {
          candidateId: "candidate-renamed-target",
          realizationRefs: [
            { targetIds: ["RenamedFace/@Mouth"], targetFingerprints: ["tmf1:mouth001"], effectName: "On" }
          ],
          fitSignals: { overallFit: "medium" },
          revisionSignals: { revisionScore: 0.6 },
          noveltySignals: { noveltyScore: 0.5, memoryPenalty: 0, oscillationPenalty: 0, oscillationRisk: "low" },
          riskSignals: {
            attentionConflictRisk: "medium",
            layeringConflictRisk: "medium",
            complexityRisk: "medium",
            renderUncertainty: "medium"
          }
        },
        {
          candidateId: "candidate-wrong-fingerprint",
          realizationRefs: [
            { targetIds: ["OldFace/@Mouth"], targetFingerprints: ["tmf1:other"], effectName: "On" }
          ],
          fitSignals: { overallFit: "medium" },
          revisionSignals: { revisionScore: 0.6 },
          noveltySignals: { noveltyScore: 0.5, memoryPenalty: 0, oscillationPenalty: 0, oscillationRisk: "low" },
          riskSignals: {
            attentionConflictRisk: "medium",
            layeringConflictRisk: "medium",
            complexityRisk: "medium",
            renderUncertainty: "medium"
          }
        }
      ]
    },
    targetBehaviorLearning: {
      artifactPath: "/project/display/target-behavior.json",
      records: [
        {
          recordId: "tbl1:fingerprint-good",
          targetId: "OldFace/@Mouth",
          targetFingerprint: "tmf1:mouth001",
          effectName: "On",
          stats: { sampleCount: 3, positiveCount: 3, negativeCount: 0 }
        }
      ]
    },
    selectionContext: {
      phase: "proposal",
      seed: "proposal::behavior-fingerprint",
      explorationEnabled: true
    }
  });

  const renamed = out.scoredCandidates.find((row) => row.candidateId === "candidate-renamed-target");
  const wrong = out.scoredCandidates.find((row) => row.candidateId === "candidate-wrong-fingerprint");
  assert.equal(renamed.behaviorEvidenceCount, 1);
  assert.equal(renamed.behaviorScore, 1);
  assert.equal(wrong.behaviorEvidenceCount, 0);
  assert.ok(renamed.selectionScore > wrong.selectionScore);
});

test("candidate selection uses model-index fingerprints to apply renamed submodel behavior evidence", () => {
  const modelIndexSubmodel = {
    targetId: "CustomFaceCurrent/@Mouth",
    targetKind: "submodel",
    identity: {
      fingerprint: "tmf1:custom-mouth",
      fingerprintVersion: "target-metadata-fingerprint-v1",
      parentId: "CustomFaceCurrent",
      parentName: "CustomFaceCurrent"
    },
    structure: {
      submodelMetadata: {
        parentId: "CustomFaceCurrent",
        siblingCount: 11,
        nodeCoverage: { nodeCount: 12, parentNodeCount: 143, ratio: 0.12 },
        structureHints: ["custom_submodel"]
      }
    }
  };

  const out = buildCandidateSelectionV1({
    intentEnvelope: {
      artifactId: "intent-combined-target-context",
      novelty: { explorationPressure: "medium", reuseTolerance: "medium" }
    },
    realizationCandidates: {
      artifactId: "candidates-combined-target-context",
      candidates: [
        {
          candidateId: "candidate-model-index-fingerprint",
          realizationRefs: [
            {
              targetIds: [modelIndexSubmodel.targetId],
              targetFingerprints: [modelIndexSubmodel.identity.fingerprint],
              effectName: "On"
            }
          ],
          fitSignals: { overallFit: "medium" },
          revisionSignals: { revisionScore: 0.6 },
          noveltySignals: { noveltyScore: 0.5, memoryPenalty: 0, oscillationPenalty: 0, oscillationRisk: "low" },
          riskSignals: {
            attentionConflictRisk: "medium",
            layeringConflictRisk: "medium",
            complexityRisk: "medium",
            renderUncertainty: "medium"
          }
        },
        {
          candidateId: "candidate-name-only-miss",
          realizationRefs: [
            {
              targetIds: [modelIndexSubmodel.targetId],
              effectName: "On"
            }
          ],
          fitSignals: { overallFit: "medium" },
          revisionSignals: { revisionScore: 0.6 },
          noveltySignals: { noveltyScore: 0.5, memoryPenalty: 0, oscillationPenalty: 0, oscillationRisk: "low" },
          riskSignals: {
            attentionConflictRisk: "medium",
            layeringConflictRisk: "medium",
            complexityRisk: "medium",
            renderUncertainty: "medium"
          }
        }
      ]
    },
    targetBehaviorLearning: {
      artifactPath: "/project/display/target-behavior.json",
      records: [
        {
          recordId: "tbl1:previous-custom-mouth",
          targetId: "CustomFacePrevious/@Mouth",
          targetKind: "submodel",
          targetFingerprint: "tmf1:custom-mouth",
          effectName: "On",
          effectFamily: "On",
          probeScope: "submodel",
          stats: { sampleCount: 3, positiveCount: 3, negativeCount: 0 }
        }
      ]
    },
    selectionContext: {
      phase: "proposal",
      seed: "proposal::combined-target-context",
      explorationEnabled: true
    }
  });

  const fingerprintMatched = out.scoredCandidates.find((row) => row.candidateId === "candidate-model-index-fingerprint");
  const nameOnlyMiss = out.scoredCandidates.find((row) => row.candidateId === "candidate-name-only-miss");

  assert.equal(fingerprintMatched.behaviorEvidenceCount, 1);
  assert.deepEqual(fingerprintMatched.behaviorRecordIds, ["tbl1:previous-custom-mouth"]);
  assert.equal(fingerprintMatched.behaviorScore, 1);
  assert.equal(nameOnlyMiss.behaviorEvidenceCount, 0);
  assert.ok(fingerprintMatched.selectionScore > nameOnlyMiss.selectionScore);
});
