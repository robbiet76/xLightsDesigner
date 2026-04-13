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
    creative: {},
    sequenceAgentRuntime: {}
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

test("automation runtime exposes visual hint definition snapshot", () => {
  const runtime = createAutomationRuntime(buildDeps({
    state: {
      status: { level: "info", text: "ready" },
      activeSequence: "",
      sequencePathInput: "",
      proposed: [],
      chat: [],
      flags: {},
      ui: {},
      creative: {},
      metadata: {
        visualHintDefinitions: [
          {
            name: "Cool",
            status: "pending_definition",
            source: "custom",
            definedBy: "user"
          },
          {
            name: "Warm Accent",
            status: "defined",
            source: "managed",
            definedBy: "agent"
          }
        ]
      }
    }
  }));

  const out = runtime.getAutomationVisualHintDefinitionsSnapshot();
  assert.equal(out.ok, true);
  assert.equal(out.counts.systemDefined > 0, true);
  assert.equal(out.counts.userPending, 1);
  assert.equal(out.counts.managedDefined, 1);
  assert.equal(Array.isArray(out.records), true);
});

test("automation reset clears stale audio path and sequence media state", async () => {
  const state = {
    status: { level: "info", text: "ready" },
    activeSequence: "CandyCaneLane",
    sequencePathInput: "/show/CandyCaneLane/CandyCaneLane.xsq",
    audioPathInput: "/other-show/Audio/stale.mp3",
    sequenceMediaFile: "/other-show/Audio/stale.mp3",
    proposed: [],
    chat: [],
    flags: {},
    ui: {},
    creative: {},
    sequenceAgentRuntime: {}
  };
  const runtime = createAutomationRuntime(buildDeps({ state }));

  const out = await runtime.resetAutomationState();

  assert.equal(out.ok, true);
  assert.equal(state.audioPathInput, "");
  assert.equal(state.sequenceMediaFile, "");
});

test("automation runtime stores render observation artifacts for feedback loop testing", () => {
  let persisted = false;
  let rendered = false;
  const state = {
    status: null,
    activeSequence: "",
    sequencePathInput: "",
    proposed: [],
    chat: [],
    flags: {},
    ui: {},
    creative: {},
    sequenceAgentRuntime: {}
  };
  const runtime = createAutomationRuntime(buildDeps({
    state,
    persist: () => { persisted = true; },
    render: () => { rendered = true; }
  }));

  const out = runtime.setAutomationRenderObservation({
    renderObservation: {
      artifactType: "render_observation_v1",
      artifactId: "render-1"
    },
    renderCritiqueContext: {
      artifactType: "sequence_render_critique_context_v1",
      artifactId: "critique-1"
    }
  });

  assert.equal(out.ok, true);
  assert.equal(state.sequenceAgentRuntime.renderObservation.artifactId, "render-1");
  assert.equal(state.sequenceAgentRuntime.renderCritiqueContext.artifactId, "critique-1");
  assert.equal(persisted, true);
  assert.equal(rendered, true);
  assert.equal(runtime.getAutomationRenderFeedbackSnapshot().renderObservation.artifactId, "render-1");
});

test("automation runtime rejects invalid render observation artifacts", () => {
  const runtime = createAutomationRuntime(buildDeps());
  const out = runtime.setAutomationRenderObservation({
    renderObservation: {
      artifactType: "wrong_type"
    }
  });
  assert.equal(out.ok, false);
  assert.match(out.error, /renderObservation must be render_observation_v1/i);
});
