import test from "node:test";
import assert from "node:assert/strict";

import { executeDesignerProposalOrchestration } from "../../../agent/designer-dialog/designer-dialog-orchestrator.js";

const models = [
  { id: "MegaTree", name: "MegaTree", type: "Model" }
];

test("designer orchestrator returns canonical proposal artifacts on success", () => {
  const result = executeDesignerProposalOrchestration({
    requestId: "req-orch-1",
    sequenceRevision: "rev-1",
    promptText: "Make the chorus warmer and cleaner",
    selectedSections: ["Chorus"],
    selectedTargetIds: ["MegaTree"],
    goals: "Increase warmth without clutter.",
    models
  });

  assert.equal(result.ok, true);
  assert.equal(result.creativeBrief.briefType, "creative_brief_v1");
  assert.equal(result.proposalBundle.bundleType, "proposal_bundle_v1");
  assert.equal(result.intentHandoff.goal, "Make the chorus warmer and cleaner");
  assert.equal(result.diagnostics.artifactType, "designer_dialog_diagnostics_v1");
  assert.ok(result.proposalLines.length > 0);
});

test("designer orchestrator can normalize cloud response while preserving local handoff", () => {
  const result = executeDesignerProposalOrchestration({
    requestId: "req-cloud-orch",
    sequenceRevision: "rev-3",
    promptText: "Make the chorus feel nostalgic and cleaner.",
    selectedSections: ["Chorus"],
    goals: "Make the chorus feel nostalgic and cleaner.",
    models,
    cloudResponse: {
      responseType: "designer_cloud_response_v1",
      responseVersion: "1.0",
      assistantMessage: "I want to keep the intro restrained and let the chorus bloom more warmly.",
      summary: "Restrained intro with a warmer chorus bloom.",
      guidedQuestions: ["Should the chorus spread beyond the focal props?"],
      assumptions: ["Keep the intro restrained."],
      brief: {
        summary: "Restrained intro with a warmer chorus bloom.",
        sections: ["Intro", "Chorus"],
        moodEnergyArc: "Intro: low -> Chorus: high",
        narrativeCues: "Hold back the intro and reveal into the chorus.",
        visualCues: "Start broad, then refine the focal props.",
        hypotheses: ["Use a broad base pass and reserve the focal props for the payoff."]
      },
      proposal: {
        proposalId: "proposal-cloud-2",
        summary: "Restrained intro with a warmer chorus bloom.",
        baseRevision: "rev-3",
        proposalLines: [
          "Intro / AllModels / keep the pass restrained and readable to preserve space",
          "Chorus / MegaTree / preserve focal clarity as the lead visual anchor"
        ]
      }
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.creativeBrief.summary, "Restrained intro with a warmer chorus bloom.");
  assert.equal(result.proposalBundle.proposalId, "proposal-cloud-2");
  assert.equal(result.intentHandoff.goal, "Make the chorus feel nostalgic and cleaner.");
  assert.deepEqual(result.guidedQuestions, ["Should the chorus spread beyond the focal props?"]);
});

test("designer orchestrator keeps local target scope authoritative when explicit targets are selected", () => {
  const result = executeDesignerProposalOrchestration({
    requestId: "req-cloud-explicit-targets",
    sequenceRevision: "rev-4",
    promptText: "Design a single Chorus 1 concept for CandyCane-01/Fill and Border_Segments.",
    selectedSections: ["Chorus 1"],
    selectedTargetIds: ["CandyCane-01/Fill", "Border_Segments"],
    models: [
      { id: "Border_Segments", name: "Border_Segments", type: "Model" },
      { id: "CandyCane-01", name: "CandyCane-01", type: "Model" }
    ],
    submodels: [
      { id: "CandyCane-01/Fill", name: "Fill", parentId: "CandyCane-01" }
    ],
    displayElements: [
      { id: "Border_Segments", name: "Border_Segments", type: "model" },
      { id: "CandyCane-01", name: "CandyCane-01", type: "model" },
      { id: "CandyCane-01/Fill", name: "CandyCane-01/Fill", type: "submodel" }
    ],
    musicDesignContext: {
      sectionArc: [
        { label: "Chorus 1", energy: "high", density: "dense" }
      ]
    },
    cloudResponse: {
      responseType: "designer_cloud_response_v1",
      responseVersion: "1.0",
      assistantMessage: "Cloud widened the scope.",
      summary: "Cloud widened the scope.",
      proposal: {
        proposalId: "proposal-cloud-wide",
        summary: "Cloud widened the scope.",
        baseRevision: "rev-4",
        scope: {
          sections: ["Chorus 1"],
          targetIds: ["Border_Segments", "CandyCane-01", "CandyCane-01/Fill"]
        },
        proposalLines: [
          "Chorus 1 / Border_Segments + CandyCane-01 + CandyCane-01/Fill / broaden the scope"
        ]
      }
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.source, "local_runtime_explicit_target_scope");
  assert.deepEqual(result.proposalBundle.scope.targetIds.sort(), ["Border_Segments", "CandyCane-01/Fill"]);
  assert.deepEqual(result.intentHandoff.scope.targetIds.sort(), ["Border_Segments", "CandyCane-01/Fill"]);
});
