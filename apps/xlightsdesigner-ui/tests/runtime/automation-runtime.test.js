import test from "node:test";
import assert from "node:assert/strict";

import { createAutomationRuntime } from "../../runtime/automation-runtime.js";

function buildDeps(overrides = {}) {
  const state = {
    status: null,
    activeSequence: "",
    sequencePathInput: "",
    proposed: [],
    chat: [],
    flags: {},
    ui: {},
    creative: {}
  };

  return {
    state,
    agentRuntime: { activeRole: "designer_dialog", handoffs: {} },
    onSendChat: async () => {},
    onGenerate: async () => {},
    onApplyAll: async () => ({}),
    onRefresh: async () => {},
    onAnalyzeAudio: async () => {},
    onOpenExistingSequence: async () => {},
    clearDesignRevisionTarget: () => {},
    normalizeDesignRevisionTarget: (value) => value,
    clearDesignerDraft: () => {},
    clearSequencingHandoffsForSequenceChange: () => {},
    buildSupersededConceptRecordById: () => null,
    retagExecutionPlanForRevisionTarget: () => null,
    getExecutionPlanFromArtifacts: () => null,
    rebuildProposalBundleFromExecutionPlan: () => null,
    setAgentHandoff: () => {},
    upsertSupersededConceptRecord: () => {},
    isPlainObject: (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value),
    buildCurrentDesignSceneContext: () => ({}),
    buildCurrentMusicDesignContext: () => ({}),
    executeDesignerProposalOrchestration: () => ({}),
    getValidHandoff: () => null,
    filteredProposed: () => [],
    arraysEqualOrdered: () => true,
    buildSequenceAgentPlan: () => ({}),
    validateCommandGraph: () => ({ ok: true }),
    buildOwnedSequencingBatchPlan: () => ({}),
    getOwnedHealth: () => null,
    currentLayoutMode: () => "2d",
    getSequenceTimingOwnershipRows: () => [],
    applyReadyForApprovalGate: () => false,
    definePersistedVisualHint: () => null,
    persist: () => {},
    render: () => {},
    setStatus: () => {},
    runCurrentDirectSequenceValidation: () => ({}),
    getCurrentDirectSequenceValidationSnapshot: () => ({}),
    getPageStates: () => ({}),
    ...overrides
  };
}

test("automation runtime defines managed visual hints through backend hook", () => {
  let persisted = false;
  let rendered = false;
  const runtime = createAutomationRuntime(buildDeps({
    definePersistedVisualHint: (name, definition) => ({
      name,
      status: "defined",
      semanticClass: definition.semanticClass,
      behavioralIntent: definition.behavioralIntent,
      behavioralTags: definition.behavioralTags
    }),
    persist: () => { persisted = true; },
    render: () => { rendered = true; }
  }));

  const out = runtime.defineAutomationVisualHint({
    name: "cool",
    semanticClass: "color_direction",
    behavioralIntent: "Prefer cooler color direction.",
    behavioralTags: ["cool-tone"]
  });

  assert.equal(out.ok, true);
  assert.equal(out.hint.name, "cool");
  assert.equal(out.hint.status, "defined");
  assert.equal(out.hint.semanticClass, "color_direction");
  assert.deepEqual(out.hint.behavioralTags, ["cool-tone"]);
  assert.equal(persisted, true);
  assert.equal(rendered, true);
});

test("automation runtime rejects empty visual hint definition requests", () => {
  const runtime = createAutomationRuntime(buildDeps());
  const out = runtime.defineAutomationVisualHint({ name: "" });
  assert.equal(out.ok, false);
  assert.match(out.error, /name is required/i);
});
