import test from "node:test";
import assert from "node:assert/strict";

import { createAudioAnalysisSessionRuntime } from "../../runtime/audio-analysis-session-runtime.js";

function createBaseState() {
  return {
    audioPathInput: "",
    audioAnalysis: {},
    ui: {},
    creative: {},
    project: {},
    diagnostics: [],
    sectionSuggestions: [],
    sectionStartByLabel: {}
  };
}

test("analyzeAudio warns and returns missing_audio_path when no audio path is available", async () => {
  const state = createBaseState();
  const calls = {
    statuses: [],
    renders: 0
  };
  const runtime = createAudioAnalysisSessionRuntime({
    state,
    agentRuntime: { handoffs: {} },
    setStatus: (level, message) => calls.statuses.push({ level, message }),
    render: () => { calls.renders += 1; }
  });

  const result = await runtime.analyzeAudio();

  assert.deepEqual(result, { ok: false, error: "missing_audio_path" });
  assert.equal(state.ui.lastAnalysisPrompt, "");
  assert.deepEqual(calls.statuses, [
    { level: "warning", message: "No audio track available for analysis on this sequence." }
  ]);
  assert.equal(calls.renders, 1);
});

test("analyzeAudio reuses persisted artifacts through the runtime dependencies", async () => {
  const state = createBaseState();
  state.audioPathInput = "/tmp/example.mp3";
  state.creative = { brief: { summary: "brief" } };
  state.audioAnalysis = { summary: "summary" };
  const events = [];
  const runtime = createAudioAnalysisSessionRuntime({
    state,
    agentRuntime: { handoffs: {} },
    setStatus: (level, message) => events.push(["status", level, message]),
    render: () => events.push(["render"]),
    persist: () => events.push(["persist"]),
    saveCurrentProjectSnapshot: () => events.push(["snapshot"]),
    setAgentActiveRole: (role) => events.push(["role", role]),
    beginOrchestrationRun: () => ({ id: "run-1" }),
    refreshAgentRuntimeHealth: () => events.push(["health"]),
    markOrchestrationStage: (...args) => events.push(["stage", ...args.slice(1)]),
    endOrchestrationRun: (...args) => events.push(["end", args[1]]),
    resetAudioAnalysisView: () => events.push(["resetView"]),
    buildPendingAudioAnalysisPipeline: () => ({ pending: true }),
    setAudioAnalysisProgress: (...args) => events.push(["progress", args[1]?.stage, args[1]?.message]),
    startAudioAnalysisProgressTicker: () => ({
      stop: () => events.push(["tickerStop"])
    }),
    loadReusableAnalysisArtifactForProfile: async () => ({
      mode: "fast",
      artifact: {
        identity: { title: "Track Title" }
      }
    }),
    buildAnalysisHandoffFromArtifact: () => ({
      trackIdentity: { title: "Track Title" },
      summary: "handoff summary",
      timing: { bpm: 120, timeSignature: "4/4" },
      structure: { sections: [{ label: "Verse" }] },
      chords: { hasChords: false }
    }),
    setAgentHandoff: (...args) => events.push(["handoff", args[0], args[2]]),
    applyPersistedAnalysisArtifact: () => true,
    addStructuredChatMessage: () => events.push(["chat"]),
    buildAudioAnalystChatReply: () => "reply",
    getTeamChatSpeakerLabel: () => "Audio Analyst",
    buildChatArtifactCard: () => ({ ok: true }),
    basenameOfPath: () => "example.mp3",
    maybeOfferIdentityRecommendationAction: async () => null,
    buildLyricsRecoveryGuidance: () => null,
    buildAudioAnalystInput: () => {
      throw new Error("should not build a fresh request when artifact is reused");
    },
    executeAudioAnalystFlow: async () => {
      throw new Error("should not execute flow when artifact is reused");
    },
    buildAudioAnalysisStubSummary: () => "stub",
    applyAudioAnalystFlowSuccessToState: () => ({ ok: true }),
    syncSectionSuggestionsFromAnalysisArtifact: () => events.push(["syncSections"]),
    pushDiagnostic: () => events.push(["diagnostic"]),
    applyAudioAnalystFlowFailureToState: () => events.push(["failure"]),
    runAudioAnalysisPipeline: async () => ({})
  });

  const result = await runtime.analyzeAudio({ userPrompt: "analyze" });

  assert.deepEqual(result, { ok: true, reused: true, mode: "fast" });
  assert.equal(state.ui.lastAnalysisPrompt, "analyze");
  assert.ok(events.some((entry) => entry[0] === "handoff"));
  assert.ok(events.some((entry) => entry[0] === "tickerStop"));
  assert.ok(events.some((entry) => entry[0] === "snapshot"));
  assert.ok(events.some((entry) => entry[0] === "persist"));
});

test("analyzeAudio notifies when a reusable artifact is ready", async () => {
  const state = createBaseState();
  state.audioPathInput = "/tmp/example.mp3";
  const calls = [];
  const runtime = createAudioAnalysisSessionRuntime({
    state,
    agentRuntime: { handoffs: {} },
    setStatus: () => {},
    render: () => {},
    persist: () => {},
    saveCurrentProjectSnapshot: () => {},
    setAgentActiveRole: () => {},
    beginOrchestrationRun: () => ({ id: "run-2" }),
    refreshAgentRuntimeHealth: () => {},
    markOrchestrationStage: () => {},
    endOrchestrationRun: () => {},
    resetAudioAnalysisView: () => {},
    buildPendingAudioAnalysisPipeline: () => ({}),
    setAudioAnalysisProgress: () => {},
    startAudioAnalysisProgressTicker: () => ({ stop: () => {} }),
    loadReusableAnalysisArtifactForProfile: async () => ({
      mode: "deep",
      artifact: { identity: { title: "Track Title" } }
    }),
    buildAnalysisHandoffFromArtifact: () => ({ summary: "handoff" }),
    setAgentHandoff: () => {},
    applyPersistedAnalysisArtifact: () => true,
    addStructuredChatMessage: () => {},
    buildAudioAnalystChatReply: () => "reply",
    getTeamChatSpeakerLabel: () => "Audio Analyst",
    buildChatArtifactCard: () => ({}),
    basenameOfPath: () => "example.mp3",
    maybeOfferIdentityRecommendationAction: async () => null,
    onAnalysisArtifactReady: async (payload) => { calls.push(payload); },
    buildLyricsRecoveryGuidance: () => null,
    buildAudioAnalystInput: () => {
      throw new Error("should not build a fresh request when artifact is reused");
    },
    executeAudioAnalystFlow: async () => {
      throw new Error("should not execute flow when artifact is reused");
    },
    buildAudioAnalysisStubSummary: () => "stub",
    applyAudioAnalystFlowSuccessToState: () => ({ ok: true }),
    syncSectionSuggestionsFromAnalysisArtifact: () => {},
    pushDiagnostic: () => {},
    applyAudioAnalystFlowFailureToState: () => {},
    runAudioAnalysisPipeline: async () => ({})
  });

  const result = await runtime.analyzeAudio();

  assert.deepEqual(result, { ok: true, reused: true, mode: "deep" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].audioPath, "/tmp/example.mp3");
  assert.equal(calls[0].source, "reused");
});
