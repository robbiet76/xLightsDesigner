import test from "node:test";
import assert from "node:assert/strict";

import {
  applyDesignerDraftSuccessState,
  clearDesignerDraft,
  markDesignerDraftStale,
  rebaseDesignerDraft
} from "../../../agent/designer-dialog/designer-dialog-draft-state.js";

function buildState() {
  return {
    creative: {
      proposalBundle: {
        bundleType: "proposal_bundle_v1",
        baseRevision: "rev-1",
        lifecycle: {
          status: "fresh",
          stale: false,
          baseRevision: "rev-1",
          currentRevision: "rev-1",
          rebasedFrom: null,
          staleReason: "",
          updatedAt: new Date().toISOString()
        }
      }
    },
    proposed: ["Verse / MegaTree / keep motion gentle."],
    draftBaseRevision: "rev-1",
    flags: {
      hasDraftProposal: true,
      proposalStale: false
    }
  };
}

test("markDesignerDraftStale updates lifecycle and derived flags", () => {
  const state = buildState();
  markDesignerDraftStale(state, { currentRevision: "rev-2" });
  assert.equal(state.creative.proposalBundle.lifecycle.status, "stale");
  assert.equal(state.flags.proposalStale, true);
  assert.equal(state.draftBaseRevision, "rev-1");
});

test("rebaseDesignerDraft clears stale state and updates base revision", () => {
  const state = buildState();
  markDesignerDraftStale(state, { currentRevision: "rev-2" });
  rebaseDesignerDraft(state, {
    newBaseRevision: "rev-2",
    preserveLines: ["Verse / MegaTree / keep motion gentle."]
  });
  assert.equal(state.creative.proposalBundle.lifecycle.status, "rebased");
  assert.equal(state.flags.proposalStale, false);
  assert.equal(state.draftBaseRevision, "rev-2");
});

test("clearDesignerDraft removes proposal artifact and clears flags", () => {
  const state = buildState();
  clearDesignerDraft(state);
  assert.equal(state.creative.proposalBundle, null);
  assert.deepEqual(state.proposed, []);
  assert.equal(state.flags.hasDraftProposal, false);
  assert.equal(state.flags.proposalStale, false);
});

test("applyDesignerDraftSuccessState syncs proposal bundle and lines", () => {
  const state = buildState();
  applyDesignerDraftSuccessState(state, {
    proposalBundle: state.creative.proposalBundle,
    proposalLines: ["Chorus / MegaTree / add brighter focal contrast."]
  });
  assert.deepEqual(state.proposed, ["Chorus / MegaTree / add brighter focal contrast."]);
  assert.equal(state.flags.hasDraftProposal, true);
});
