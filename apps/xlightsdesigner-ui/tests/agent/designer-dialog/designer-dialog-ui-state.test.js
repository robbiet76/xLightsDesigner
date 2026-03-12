import test from "node:test";
import assert from "node:assert/strict";

import {
  applyDesignerProposalSuccessToState,
  buildDesignerGuidedQuestionMessage
} from "../../../agent/designer-dialog/designer-dialog-ui-state.js";

test("designer ui-state applies canonical proposal artifacts to app state", () => {
  const state = {
    creative: {},
    flags: { creativeBriefReady: false },
    proposed: []
  };

  applyDesignerProposalSuccessToState(state, {
    ok: true,
    creativeBrief: { briefType: "creative_brief_v1" },
    proposalBundle: {
      bundleType: "proposal_bundle_v1",
      baseRevision: "rev-5",
      lifecycle: {
        status: "fresh",
        stale: false,
        baseRevision: "rev-5",
        currentRevision: "rev-5",
        rebasedFrom: null,
        staleReason: "",
        updatedAt: new Date().toISOString()
      }
    },
    proposalLines: ["Chorus / MegaTree / warm up palette and reduce clutter."]
  });

  assert.equal(state.creative.brief.briefType, "creative_brief_v1");
  assert.equal(state.creative.proposalBundle.bundleType, "proposal_bundle_v1");
  assert.equal(state.flags.creativeBriefReady, true);
  assert.equal(state.flags.hasDraftProposal, true);
  assert.equal(state.flags.proposalStale, false);
  assert.equal(state.draftBaseRevision, "rev-5");
  assert.deepEqual(state.proposed, ["Chorus / MegaTree / warm up palette and reduce clutter."]);
});

test("designer ui-state builds concise guided-question chat message", () => {
  const message = buildDesignerGuidedQuestionMessage([
    "Should the chorus stay focused on the megatree?",
    "Do you want warmer whites or amber?"
  ]);
  assert.match(message, /Before next pass, consider:/);
  assert.match(message, /megatree/i);
  assert.match(message, /amber/i);
});
