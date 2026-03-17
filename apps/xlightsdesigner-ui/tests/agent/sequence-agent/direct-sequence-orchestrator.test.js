import test from "node:test";
import assert from "node:assert/strict";

import { validateAgentHandoff } from "../../../agent/handoff-contracts.js";
import { executeDirectSequenceRequestOrchestration } from "../../../agent/sequence-agent/direct-sequence-orchestrator.js";
import { buildEffectDefinitionCatalog } from "../../../agent/sequence-agent/effect-definition-catalog.js";

function sampleCatalog() {
  return buildEffectDefinitionCatalog([
    { effectName: "On", params: [] },
    { effectName: "Color Wash", params: [] },
    { effectName: "Shimmer", params: [] }
  ]);
}

function sampleAnalysis() {
  return {
    structure: {
      sections: [
        { label: "Intro", startMs: 0, endMs: 10000 },
        { label: "Chorus 1", startMs: 44000, endMs: 62000 },
        { label: "Chorus 2", startMs: 78000, endMs: 96000 }
      ]
    }
  };
}

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
    effectCatalog: sampleCatalog(),
    metadataAssignments: [],
    analysisHandoff: null
  });

  assert.equal(result.ok, true);
  assert.equal(result.creativeBrief, null);
  assert.equal(result.proposalBundle.bundleType, "proposal_bundle_v1");
  assert.ok(result.proposalBundle.executionPlan);
  assert.equal(result.proposalBundle.executionPlan.sectionPlans[0].designAuthor, "user");
  assert.equal(result.proposalBundle.executionPlan.sectionPlans[0].designId, "DES-001");
  assert.equal(result.proposalBundle.executionPlan.sectionPlans[0].designRevision, 0);
  assert.equal(result.intentHandoff.executionStrategy.sectionPlans[0].designAuthor, "user");
  assert.equal(result.intentHandoff.executionStrategy.sectionPlans[0].designRevision, 0);
  assert.equal(result.proposalBundle.guidedQuestions.length, 0);
  assert.match(result.proposalLines[0], /General \/ Border-01 \/ apply On effect in green for 30000 ms starting at 0 ms/i);
  assert.deepEqual(validateAgentHandoff("intent_handoff_v1", result.intentHandoff), []);
});

test("direct sequence orchestrator allocates the next short design id from existing concepts", () => {
  const result = executeDirectSequenceRequestOrchestration({
    requestId: "req-direct-next-id",
    sequenceRevision: "rev-1",
    promptText: "Add a Color Wash effect on Snowman during Chorus 1.",
    selectedSections: [],
    selectedTargetIds: [],
    selectedTagNames: [],
    models: [{ id: "Snowman", name: "Snowman", type: "Model" }],
    submodels: [],
    displayElements: [{ id: "Snowman", name: "Snowman", type: "model" }],
    effectCatalog: sampleCatalog(),
    metadataAssignments: [],
    existingDesignIds: ["DES-001", "DES-002", "DES-009"],
    analysisHandoff: sampleAnalysis()
  });

  assert.equal(result.ok, true);
  assert.equal(result.proposalBundle.executionPlan.sectionPlans[0].designId, "DES-010");
  assert.equal(result.proposalBundle.executionPlan.sectionPlans[0].designRevision, 0);
  assert.equal(result.intentHandoff.executionStrategy.sectionPlans[0].designId, "DES-010");
  assert.equal(result.intentHandoff.executionStrategy.sectionPlans[0].designRevision, 0);
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
    effectCatalog: sampleCatalog(),
    metadataAssignments: [],
    analysisHandoff: null
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.proposalLines, []);
  assert.ok(result.guidedQuestions.some((row) => /visible sequencer target/i.test(row)));
  assert.ok(result.warnings.some((row) => /not a writable sequencer element/i.test(row)));
});

test("direct sequence orchestrator asks for clarification when effect name is not in live catalog", () => {
  const result = executeDirectSequenceRequestOrchestration({
    requestId: "req-direct-3",
    sequenceRevision: "rev-1",
    promptText: "Add a rainbow effect on Border-01 from 1 minute to 2 minutes",
    selectedSections: [],
    selectedTargetIds: [],
    selectedTagNames: [],
    models: [{ id: "Border-01", name: "Border-01", type: "Model" }],
    submodels: [],
    displayElements: [{ id: "Border-01", name: "Border-01", type: "model" }],
    effectCatalog: sampleCatalog(),
    metadataAssignments: [],
    analysisHandoff: null
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.proposalLines, []);
  assert.ok(result.guidedQuestions.some((row) => /loaded xlights effect name/i.test(row)));
  assert.ok(result.warnings.some((row) => /does not match a loaded xlights effect name/i.test(row)));
});

test("direct sequence orchestrator infers analyzed section scope from the prompt", () => {
  const result = executeDirectSequenceRequestOrchestration({
    requestId: "req-direct-4",
    sequenceRevision: "rev-1",
    promptText: "Add a Color Wash effect on Snowman during Chorus 1.",
    selectedSections: [],
    selectedTargetIds: [],
    selectedTagNames: [],
    models: [{ id: "Snowman", name: "Snowman", type: "Model" }],
    submodels: [],
    displayElements: [{ id: "Snowman", name: "Snowman", type: "model" }],
    effectCatalog: sampleCatalog(),
    metadataAssignments: [],
    analysisHandoff: sampleAnalysis()
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.intentHandoff.scope.sections, ["Chorus 1"]);
  assert.ok(result.proposalBundle.scope.sections.includes("Chorus 1"));
  assert.match(result.proposalLines[0], /for the requested duration/i);
});

test("direct sequence orchestrator fails closed when prompt names a section without analysis", () => {
  const result = executeDirectSequenceRequestOrchestration({
    requestId: "req-direct-5",
    sequenceRevision: "rev-1",
    promptText: "Add a Color Wash effect on Snowman during Chorus 1.",
    selectedSections: [],
    selectedTargetIds: [],
    selectedTagNames: [],
    models: [{ id: "Snowman", name: "Snowman", type: "Model" }],
    submodels: [],
    displayElements: [{ id: "Snowman", name: "Snowman", type: "model" }],
    effectCatalog: sampleCatalog(),
    metadataAssignments: [],
    analysisHandoff: null
  });

  assert.equal(result.ok, false);
  assert.equal(result.intentHandoff, null);
  assert.ok(result.warnings.some((row) => /analyze the track first/i.test(row)));
});

test("direct sequence orchestrator decomposes clear mixed effect and section clauses", () => {
  const result = executeDirectSequenceRequestOrchestration({
    requestId: "req-direct-6",
    sequenceRevision: "rev-1",
    promptText: "Add a Color Wash effect on Snowman during Chorus 1 and a Shimmer effect on PorchTree during Chorus 2.",
    selectedSections: [],
    selectedTargetIds: [],
    selectedTagNames: [],
    models: [
      { id: "Snowman", name: "Snowman", type: "Model" },
      { id: "PorchTree", name: "PorchTree", type: "Model" }
    ],
    submodels: [],
    displayElements: [
      { id: "Snowman", name: "Snowman", type: "model" },
      { id: "PorchTree", name: "PorchTree", type: "model" }
    ],
    effectCatalog: sampleCatalog(),
    metadataAssignments: [],
    analysisHandoff: sampleAnalysis()
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.intentHandoff.scope.sections, ["Chorus 1", "Chorus 2"]);
  assert.deepEqual(result.intentHandoff.scope.targetIds, ["Snowman", "PorchTree"]);
  assert.equal(result.proposalLines.length, 2);
  assert.match(result.proposalLines[0], /Chorus 1 \/ Snowman \/ apply Color Wash effect/i);
  assert.match(result.proposalLines[1], /Chorus 2 \/ PorchTree \/ apply Shimmer effect/i);
});

test("direct sequence orchestrator still blocks ambiguous mixed clauses", () => {
  const result = executeDirectSequenceRequestOrchestration({
    requestId: "req-direct-7",
    sequenceRevision: "rev-1",
    promptText: "Add a Color Wash effect on Snowman during Chorus 1 and Shimmer on PorchTree during Chorus 2.",
    selectedSections: [],
    selectedTargetIds: [],
    selectedTagNames: [],
    models: [
      { id: "Snowman", name: "Snowman", type: "Model" },
      { id: "PorchTree", name: "PorchTree", type: "Model" }
    ],
    submodels: [],
    displayElements: [
      { id: "Snowman", name: "Snowman", type: "model" },
      { id: "PorchTree", name: "PorchTree", type: "model" }
    ],
    effectCatalog: sampleCatalog(),
    metadataAssignments: [],
    analysisHandoff: sampleAnalysis()
  });

  assert.equal(result.ok, false);
  assert.equal(result.intentHandoff, null);
  assert.deepEqual(result.proposalLines, []);
  assert.ok(result.warnings.some((row) => /multiple sequencing clauses/i.test(row)));
});
