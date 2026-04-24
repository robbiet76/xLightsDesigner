import test from "node:test";
import assert from "node:assert/strict";

import { createSequenceMediaSessionRuntime } from "../../runtime/sequence-media-session-runtime.js";

function buildState() {
  return {
    endpoint: "http://127.0.0.1:49915/xlightsdesigner/api",
    audioPathInput: "",
    mediaPath: "",
    sequenceMediaFile: "",
    sequencePathInput: "",
    savePathInput: "",
    activeSequence: "",
    sequenceSettings: {},
    lastApplyBackupPath: "",
    revision: "rev-1",
    draftSequencePath: "",
    route: "project",
    agentPlan: null,
    creative: {},
    ui: {
      sequenceMode: "existing",
      agentResponseId: ""
    },
    flags: {
      xlightsConnected: true,
      activeSequenceLoaded: true
    }
  };
}

test("setAudioPathWithAgentPolicy invalidates analysis state and hydrates artifacts on change", async () => {
  const state = buildState();
  const calls = [];
  const runtime = createSequenceMediaSessionRuntime({
    state,
    invalidateAnalysisHandoff: (reason, options) => calls.push(["invalidate", reason, options]),
    resetDerivedAudioAnalysisState: () => calls.push(["reset"]),
    hydrateAnalysisArtifactForCurrentMedia: async () => ({ ok: true }),
    saveCurrentProjectSnapshot: () => calls.push(["snapshot"]),
    persist: () => calls.push(["persist"]),
    render: () => calls.push(["render"])
  });

  runtime.setAudioPathWithAgentPolicy("/show/media/song.mp3", "picked");
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(state.audioPathInput, "/show/media/song.mp3");
  assert.deepEqual(calls[0], ["invalidate", "picked", { cascadePlan: true }]);
  assert.ok(calls.some((row) => row[0] === "reset"));
  assert.ok(calls.some((row) => row[0] === "snapshot"));
  assert.ok(calls.some((row) => row[0] === "persist"));
  assert.ok(calls.some((row) => row[0] === "render"));
});

test("applyOpenSequenceState updates sequence identity and adopts sequence media", async () => {
  const state = buildState();
  const runtime = createSequenceMediaSessionRuntime({
    state,
    addRecentSequence: (path) => { state._recent = path; },
    readSequencePathFromPayload: (payload, fallbackPath = "") => payload?.file || fallbackPath || ""
  });

  runtime.applyOpenSequenceState({
    name: "Example.xsq",
    file: "/show/Seq/Example.xsq",
    mediaFile: "/show/media/track.mp3",
    sequenceType: "Media",
    supportsModelBlending: true
  });

  assert.equal(state.activeSequence, "Example.xsq");
  assert.equal(state.sequencePathInput, "/show/Seq/Example.xsq");
  assert.equal(state.savePathInput, "/show/Seq/Example.xsq");
  assert.equal(state.sequenceMediaFile, "/show/media/track.mp3");
  assert.equal(state.audioPathInput, "/show/media/track.mp3");
  assert.equal(state.ui.sequenceMode, "existing");
  assert.equal(state._recent, "/show/Seq/Example.xsq");
  assert.deepEqual(state.sequenceSettings, {
    sequenceType: "Media",
    supportsModelBlending: true
  });
});

test("syncAudioPathFromMediaStatus replaces stale external audio path with active sequence media", async () => {
  const state = buildState();
  state.showFolder = "/show";
  state.audioPathInput = "/other-show/media/stale.mp3";
  const runtime = createSequenceMediaSessionRuntime({
    state,
    getMediaStatus: async () => ({
      data: {
        mediaFile: "/show/media/current.mp3"
      }
    }),
    onRefreshMediaCatalog: async () => {}
  });

  await runtime.syncAudioPathFromMediaStatus();

  assert.equal(state.sequenceMediaFile, "/show/media/current.mp3");
  assert.equal(state.audioPathInput, "/show/media/current.mp3");
});


test("syncAudioPathFromMediaStatus clears stale external audio path when active sequence media is outside the show", async () => {
  const state = buildState();
  state.showFolder = "/show";
  state.audioPathInput = "/other-show/media/stale.mp3";
  const runtime = createSequenceMediaSessionRuntime({
    state,
    getMediaStatus: async () => ({
      data: {
        mediaFile: "/other-show/media/stale.mp3"
      }
    }),
    onRefreshMediaCatalog: async () => {}
  });

  await runtime.syncAudioPathFromMediaStatus();

  assert.equal(state.sequenceMediaFile, "");
  assert.equal(state.audioPathInput, "");
});

test("syncAudioPathFromMediaStatus preserves explicit bound audio path outside the show", async () => {
  const state = buildState();
  state.showFolder = "/show";
  state.audioPathInput = "/library/audio/candy-cane-lane.mp3";
  state.trackBinding = {
    preferredAudioPath: "/library/audio/candy-cane-lane.mp3",
    contentFingerprint: "abc123",
    title: "Candy Cane Lane",
    artist: "Sia",
    displayName: "Candy Cane Lane - Sia"
  };
  const runtime = createSequenceMediaSessionRuntime({
    state,
    getSequenceTrackBinding: () => state.trackBinding,
    getMediaStatus: async () => ({
      data: {
        mediaFile: "/other-show/media/stale.mp3"
      }
    }),
    onRefreshMediaCatalog: async () => {}
  });

  await runtime.syncAudioPathFromMediaStatus();

  assert.equal(state.sequenceMediaFile, "");
  assert.equal(state.audioPathInput, "/library/audio/candy-cane-lane.mp3");
});

test("applyOpenSequenceState clears previous track binding on sequence switch", () => {
  const state = buildState();
  state.sequencePathInput = "/show/Seq/Old.xsq";
  state.trackBinding = {
    preferredAudioPath: "/library/audio/old.mp3",
    contentFingerprint: "oldfp",
    title: "Old",
    artist: "",
    displayName: "Old"
  };
  const runtime = createSequenceMediaSessionRuntime({
    state,
    readSequencePathFromPayload: (payload, fallbackPath = "") => payload?.file || fallbackPath || ""
  });

  runtime.applyOpenSequenceState({
    name: "Example.xsq",
    file: "/show/Seq/Example.xsq",
    mediaFile: "/show/media/track.mp3"
  });

  assert.equal(state.trackBinding, null);
});

test("closeSequenceWithPrompt resets sequence state after confirmed close", async () => {
  const state = buildState();
  state.activeSequence = "Example.xsq";
  const calls = [];
  const runtime = createSequenceMediaSessionRuntime({
    state,
    closeSequenceApi: async (...args) => { calls.push(["close", ...args]); },
    resetSessionDraftState: () => { calls.push(["resetSession"]); },
    resetCreativeState: () => { calls.push(["resetCreative"]); },
    saveCurrentProjectSnapshot: () => { calls.push(["snapshot"]); },
    persist: () => { calls.push(["persist"]); },
    render: () => { calls.push(["render"]); },
    setStatus: (level, text) => { calls.push(["status", level, text]); },
    setStatusWithDiagnostics: (level, text) => { calls.push(["statusDiag", level, text]); }
  });

  await runtime.closeSequenceWithPrompt({ confirm: () => true });

  assert.equal(state.flags.activeSequenceLoaded, false);
  assert.equal(state.revision, "unknown");
  assert.equal(state.activeSequence, "(none)");
  assert.ok(calls.some((row) => row[0] === "close"));
  assert.ok(calls.some((row) => row[0] === "resetSession"));
  assert.ok(calls.some((row) => row[0] === "resetCreative"));
  assert.ok(calls.some((row) => row[0] === "snapshot"));
});
