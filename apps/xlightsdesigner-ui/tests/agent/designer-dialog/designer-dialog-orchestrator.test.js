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
