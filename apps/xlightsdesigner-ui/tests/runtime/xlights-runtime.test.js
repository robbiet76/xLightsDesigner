import test from "node:test";
import assert from "node:assert/strict";

import {
  collectXLightsRuntimeSnapshot,
  syncXLightsRevisionState,
  fetchXLightsRevisionState,
  executeXLightsRefreshCycle
} from "../../runtime/xlights-runtime.js";

test("collectXLightsRuntimeSnapshot aggregates live sequence state and capabilities", async () => {
  const snapshot = await collectXLightsRuntimeSnapshot("http://127.0.0.1:49914/xlDoAutomation", {
    readSequenceState: async () => ({
      contract: "xlights_sequence_state_v1",
      summary: "Open sequence Test.xsq at revision rev-3.",
      sequence: { isOpen: true, name: "Test.xsq", revision: "rev-3" }
    }),
    ping: async () => ({ data: { commands: ["sequence.getOpen", "timing.getTracks"] } }),
    getVersion: async () => ({ data: { version: "2026.10" } })
  });

  assert.equal(snapshot.contract, "xlights_runtime_snapshot_v1");
  assert.equal(snapshot.sequenceState.sequence.name, "Test.xsq");
  assert.equal(snapshot.capabilities.commandCount, 2);
  assert.equal(snapshot.capabilities.rawVersion, "2026.10");
});

test("syncXLightsRevisionState marks stale drafts and handoff invalidation", () => {
  const result = syncXLightsRevisionState({
    previousRevision: "rev-1",
    nextRevision: "rev-2",
    hasDraftProposal: true,
    draftBaseRevision: "rev-1",
    hasCreativeProposal: true
  });

  assert.equal(result.revisionChanged, true);
  assert.equal(result.shouldInvalidatePlanHandoff, true);
  assert.equal(result.shouldMarkDesignerDraftStale, true);
  assert.equal(result.staleDetected, true);
});

test("fetchXLightsRevisionState normalizes revision from xlights api", async () => {
  const revision = await fetchXLightsRevisionState("http://127.0.0.1:49914/xlDoAutomation", {
    getRevision: async () => ({ data: { revisionToken: "rev-44" } })
  });
  assert.equal(revision, "rev-44");
});


test("executeXLightsRefreshCycle delegates open-sequence refresh flow", async () => {
  const state = { flags: {}, health: {} };
  let applied = "";
  const result = await executeXLightsRefreshCycle({
    state,
    endpoint: "http://127.0.0.1:49914/xlDoAutomation",
    deps: {
      getOpen: async () => ({ data: { isOpen: true, sequence: { file: "/show/Test.xsq" } } }),
      syncRevision: async () => ({ staleDetected: false }),
      refreshMetadata: async () => {},
      refreshEffects: async () => {},
      refreshSections: async () => {},
      refreshHistory: async () => {}
    },
    callbacks: {
      applyRolloutPolicy: () => {},
      releaseConnectivityPlanOnly: () => false,
      isSequenceAllowed: () => true,
      currentSequencePath: () => "/show/Test.xsq",
      clearIgnoredExternalSequenceNote: () => {},
      applyOpenSequenceState: (seq) => { applied = seq.file; },
      syncAudioPathFromMediaStatus: async () => {},
      hydrateSidecarForCurrentSequence: async () => {},
      updateSequenceFileMtime: async () => {},
      maybeFlushSidecarAfterExternalSave: async () => {},
      noteIgnoredExternalSequence: () => {},
      onWarning: () => {},
      onInfo: () => {}
    }
  });

  assert.equal(state.flags.xlightsConnected, true);
  assert.equal(state.flags.activeSequenceLoaded, true);
  assert.equal(state.health.sequenceOpen, true);
  assert.equal(applied, "/show/Test.xsq");
  assert.equal(result.openSequenceAllowed, true);
});

test("executeXLightsRefreshCycle notifies when sequence path changes", async () => {
  const state = { flags: {}, health: {} };
  let changed = null;
  let currentPath = "/show/Prev.xsq";
  await executeXLightsRefreshCycle({
    state,
    endpoint: "http://127.0.0.1:49914/xlDoAutomation",
    deps: {
      getOpen: async () => ({ data: { isOpen: true, sequence: { file: "/show/Next.xsq" } } }),
      syncRevision: async () => ({ staleDetected: false }),
      refreshMetadata: async () => {},
      refreshEffects: async () => {},
      refreshSections: async () => {},
      refreshHistory: async () => {}
    },
    callbacks: {
      applyRolloutPolicy: () => {},
      releaseConnectivityPlanOnly: () => false,
      isSequenceAllowed: () => true,
      currentSequencePath: () => currentPath,
      clearIgnoredExternalSequenceNote: () => {},
      applyOpenSequenceState: (seq) => { currentPath = seq.file; },
      onSequenceChanged: (payload) => { changed = payload; },
      syncAudioPathFromMediaStatus: async () => {},
      hydrateSidecarForCurrentSequence: async () => {},
      updateSequenceFileMtime: async () => {},
      maybeFlushSidecarAfterExternalSave: async () => {},
      noteIgnoredExternalSequence: () => {},
      onWarning: () => {},
      onInfo: () => {}
    }
  });

  assert.deepEqual(changed, {
    previousPath: "/show/Prev.xsq",
    nextPath: "/show/Next.xsq",
    sequence: { file: "/show/Next.xsq" }
  });
});

test("executeXLightsRefreshCycle notifies when open sequence is cleared", async () => {
  const state = { flags: {}, health: {} };
  let cleared = null;
  await executeXLightsRefreshCycle({
    state,
    endpoint: "http://127.0.0.1:49914/xlDoAutomation",
    deps: {
      getOpen: async () => ({ data: { isOpen: false, sequence: null } }),
      syncRevision: async () => ({ staleDetected: false }),
      refreshMetadata: async () => {},
      refreshEffects: async () => {},
      refreshSections: async () => {},
      refreshHistory: async () => {}
    },
    callbacks: {
      applyRolloutPolicy: () => {},
      releaseConnectivityPlanOnly: () => false,
      currentSequencePath: () => "/show/Prev.xsq",
      clearIgnoredExternalSequenceNote: () => {},
      onSequenceCleared: (payload) => { cleared = payload; },
      noteIgnoredExternalSequence: () => {},
      onWarning: () => {},
      onInfo: () => {}
    }
  });

  assert.deepEqual(cleared, { previousPath: "/show/Prev.xsq" });
});
