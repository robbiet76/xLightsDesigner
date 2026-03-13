import test from "node:test";
import assert from "node:assert/strict";

import { validateAgentHandoff } from "../../../agent/handoff-contracts.js";
import { executeDirectSequenceRequestOrchestration } from "../../../agent/sequence-agent/direct-sequence-orchestrator.js";

test("direct sequence orchestrator bypasses designer scaffolding and emits canonical handoff", () => {
  const result = executeDirectSequenceRequestOrchestration({
    requestId: "req-direct-1",
    sequenceRevision: "rev-1",
    promptText: "Put a green On effect on Border-01 for 30 seconds from the start",
    selectedSections: [],
    selectedTargetIds: [],
    selectedTagNames: [],
    models: [{ id: "Border-01", name: "Border-01", type: "Model" }],
    submodels: [],
    displayElements: [{ id: "Border-01", name: "Border-01", type: "model" }],
    metadataAssignments: [],
    analysisHandoff: null
  });

  assert.equal(result.ok, true);
  assert.equal(result.creativeBrief, null);
  assert.equal(result.proposalBundle.bundleType, "proposal_bundle_v1");
  assert.equal(result.proposalBundle.guidedQuestions.length, 0);
  assert.match(result.proposalLines[0], /General \/ Border-01 \/ apply On effect in green for 30000 ms starting at 0 ms/i);
  assert.deepEqual(validateAgentHandoff("intent_handoff_v1", result.intentHandoff), []);
});

test("direct sequence orchestrator blocks non-writable layout-only targets", () => {
  const result = executeDirectSequenceRequestOrchestration({
    requestId: "req-direct-2",
    sequenceRevision: "rev-1",
    promptText: "Put a green On effect on Border-01 for 30 seconds from the start",
    selectedSections: [],
    selectedTargetIds: [],
    selectedTagNames: [],
    models: [{ id: "Border-01", name: "Border-01", type: "Model", groupNames: ["Outlines"] }],
    submodels: [],
    displayElements: [{ id: "Outlines", name: "Outlines", type: "model" }],
    metadataAssignments: [],
    analysisHandoff: null
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.proposalLines, []);
  assert.ok(result.guidedQuestions.some((row) => /visible sequencer target/i.test(row)));
  assert.ok(result.warnings.some((row) => /not a writable sequencer element/i.test(row)));
});
