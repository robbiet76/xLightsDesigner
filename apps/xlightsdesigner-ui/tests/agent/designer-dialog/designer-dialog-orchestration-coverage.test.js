import test from "node:test";
import assert from "node:assert/strict";

import { executeDesignerProposalOrchestration } from "../../../agent/designer-dialog/designer-dialog-orchestrator.js";

const models = [
  { id: "MegaTree", name: "MegaTree", type: "Model" }
];

test("designer orchestration enters degraded mode without analysis but still produces reviewable output", () => {
  const result = executeDesignerProposalOrchestration({
    requestId: "req-degraded-1",
    sequenceRevision: "rev-1",
    promptText: "Make the chorus warmer and more nostalgic",
    goals: "Increase emotional warmth.",
    models
  });

  assert.equal(result.ok, true);
  assert.equal(result.diagnostics.degradedMode, true);
  assert.ok(result.warnings.some((row) => /degraded mode/i.test(row) || /without analysis_handoff_v1/i.test(row)));
});

test("designer orchestration returns clarification failure on empty creative kickoff", () => {
  const result = executeDesignerProposalOrchestration({
    requestId: "req-empty-1",
    sequenceRevision: "rev-1",
    promptText: "",
    goals: "",
    inspiration: "",
    notes: ""
  });

  assert.equal(result.ok, false);
  assert.equal(result.diagnostics.failureReason, "clarification");
});

test("designer orchestration regenerates fresh proposal lifecycle on new revision while preserving handoff goal", () => {
  const a = executeDesignerProposalOrchestration({
    requestId: "req-rev-a",
    sequenceRevision: "rev-1",
    promptText: "Make the chorus brighter and cleaner",
    goals: "Lift chorus energy.",
    selectedSections: ["Chorus"],
    models
  });
  const b = executeDesignerProposalOrchestration({
    requestId: "req-rev-b",
    sequenceRevision: "rev-2",
    promptText: "Make the chorus brighter and cleaner",
    goals: "Lift chorus energy.",
    selectedSections: ["Chorus"],
    models
  });

  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(a.proposalBundle.lifecycle.baseRevision, "rev-1");
  assert.equal(b.proposalBundle.lifecycle.baseRevision, "rev-2");
  assert.equal(a.intentHandoff.goal, b.intentHandoff.goal);
});
