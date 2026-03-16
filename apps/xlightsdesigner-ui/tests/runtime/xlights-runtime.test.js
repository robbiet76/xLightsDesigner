import test from "node:test";
import assert from "node:assert/strict";

import {
  collectXLightsRuntimeSnapshot,
  syncXLightsRevisionState,
  fetchXLightsRevisionState
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
