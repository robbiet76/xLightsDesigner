import test from "node:test";
import assert from "node:assert/strict";

import { createAutomationBridgeRuntime } from "../../runtime/automation-bridge-runtime.js";

test("automation bridge exposes runtime hooks and demo helpers", () => {
  global.window = {};
  const state = {
    revision: "rev-1",
    sequencePathInput: "/show/seq.xsq",
    activeSequence: "Seq",
    status: "idle",
    flags: {},
    ui: {},
    creative: {},
    sequenceAgentRuntime: {}
  };

  const bridge = createAutomationBridgeRuntime({
    state,
    agentRuntime: {},
    onSendChat: async () => {},
    onGenerate: async () => {},
    onApplyAll: async () => {},
    onRefresh: async () => {},
    onAnalyzeAudio: async () => {},
    onSeedTimingTracksFromAnalysis: async () => {},
    onOpenExistingSequence: async () => {},
    setAudioPath: async () => {},
    onRefreshSequenceCatalog: async () => {},
    adoptMediaDirectoryFromPath: () => {},
    onRefreshMediaCatalog: async () => {},
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
    isPlainObject: (value) => Boolean(value && typeof value === "object" && !Array.isArray(value)),
    buildCurrentDesignSceneContext: () => ({}),
    buildCurrentMusicDesignContext: () => ({}),
    executeDesignerProposalOrchestration: () => ({}),
    getValidHandoff: () => null,
    filteredProposed: () => [],
    arraysEqualOrdered: () => true,
    buildSequenceAgentPlan: () => ({}),
    validateCommandGraph: () => ({ ok: true }),
    buildOwnedSequencingBatchPlan: () => ({}),
    getOwnedHealth: () => ({}),
    currentLayoutMode: () => "2d",
    getSequenceTimingOwnershipRows: () => [],
    applyReadyForApprovalGate: () => true,
    definePersistedVisualHint: () => {},
    persist: () => {},
    render: () => {},
    setStatus: () => {},
    setStatusWithDiagnostics: () => {},
    saveCurrentProjectSnapshot: () => {},
    runCurrentDirectSequenceValidation: () => ({}),
    getCurrentDirectSequenceValidationSnapshot: () => ({}),
    getPageStates: () => ({}),
    onAcceptTimingTrackReview: async () => ({ ok: true })
  });

  bridge.exposeRuntimeValidationHooks();

  assert.equal(typeof global.window.xLightsDesignerRuntime.dispatchPrompt, "function");
  assert.equal(typeof global.window.xLightsDesignerRuntime.showTenEffectGridDemo, "function");
  assert.equal(typeof global.window.xLightsDesignerRuntime.showSplitEffectGridDemo, "function");
  assert.equal(typeof global.window.xLightsDesignerRuntime.acceptTimingTrackReview, "function");

  delete global.window;
});
