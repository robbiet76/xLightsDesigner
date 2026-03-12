import test from "node:test";
import assert from "node:assert/strict";

import {
  buildProposalLifecycle,
  ensureProposalLifecycle,
  markProposalBundleStale,
  rebaseProposalBundle,
  deriveDesignerDraftState
} from "../../../agent/designer-dialog/designer-dialog-lifecycle.js";

test("proposal lifecycle starts fresh at the base revision", () => {
  const lifecycle = buildProposalLifecycle("rev-1");
  assert.equal(lifecycle.status, "fresh");
  assert.equal(lifecycle.stale, false);
  assert.equal(lifecycle.baseRevision, "rev-1");
});

test("markProposalBundleStale marks bundle stale against current revision", () => {
  const bundle = ensureProposalLifecycle({
    bundleType: "proposal_bundle_v1",
    baseRevision: "rev-1",
    proposalLines: ["x"]
  });
  const stale = markProposalBundleStale(bundle, { currentRevision: "rev-2" });
  assert.equal(stale.lifecycle.status, "stale");
  assert.equal(stale.lifecycle.stale, true);
  assert.equal(stale.lifecycle.currentRevision, "rev-2");
});

test("rebaseProposalBundle updates base revision and clears stale state", () => {
  const stale = markProposalBundleStale(
    ensureProposalLifecycle({ bundleType: "proposal_bundle_v1", baseRevision: "rev-1", proposalLines: ["x"] }),
    { currentRevision: "rev-2" }
  );
  const rebased = rebaseProposalBundle(stale, { newBaseRevision: "rev-2" });
  assert.equal(rebased.baseRevision, "rev-2");
  assert.equal(rebased.lifecycle.status, "rebased");
  assert.equal(rebased.lifecycle.stale, false);
  assert.equal(rebased.lifecycle.rebasedFrom, "rev-1");
});

test("deriveDesignerDraftState reflects proposal bundle lifecycle", () => {
  const bundle = ensureProposalLifecycle({
    bundleType: "proposal_bundle_v1",
    baseRevision: "rev-9",
    proposalLines: ["x"]
  });
  const state = deriveDesignerDraftState({ proposalBundle: bundle, proposed: ["x"] });
  assert.equal(state.draftBaseRevision, "rev-9");
  assert.equal(state.hasDraftProposal, true);
  assert.equal(state.proposalStale, false);
});
