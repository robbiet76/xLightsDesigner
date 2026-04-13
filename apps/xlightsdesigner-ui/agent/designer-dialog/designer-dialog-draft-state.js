import { deriveDesignerDraftState, markProposalBundleStale, rebaseProposalBundle } from "./designer-dialog-lifecycle.js";

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function syncFlags(state) {
  const derived = deriveDesignerDraftState({
    proposalBundle: state?.creative?.proposalBundle || null,
    proposed: state?.proposed || []
  });
  state.draftBaseRevision = derived.draftBaseRevision;
  state.flags.hasDraftProposal = derived.hasDraftProposal;
  state.flags.proposalStale = derived.proposalStale;
}

export function applyDesignerDraftSuccessState(state, { proposalBundle = null, proposalLines = [], sequencePath = "" } = {}) {
  state.creative = state.creative || {};
  state.creative.proposalBundle = proposalBundle;
  state.proposed = arr(proposalLines);
  state.draftSequencePath = String(sequencePath || "").trim();
  syncFlags(state);
}

export function markDesignerDraftStale(state, { currentRevision = "unknown", reason = "sequence_revision_changed" } = {}) {
  if (state?.creative?.proposalBundle) {
    state.creative.proposalBundle = markProposalBundleStale(state.creative.proposalBundle, {
      currentRevision,
      reason
    });
  }
  syncFlags(state);
}

export function rebaseDesignerDraft(state, { newBaseRevision = "unknown", preserveLines = null } = {}) {
  if (Array.isArray(preserveLines)) {
    state.proposed = [...preserveLines];
  }
  if (state?.creative?.proposalBundle) {
    state.creative.proposalBundle = rebaseProposalBundle(state.creative.proposalBundle, {
      newBaseRevision
    });
  }
  syncFlags(state);
}

export function clearDesignerDraft(state) {
  state.creative = state.creative || {};
  state.creative.proposalBundle = null;
  state.creative.sequencingDesignHandoff = null;
  state.creative.sequenceArtisticGoal = null;
  state.creative.sequenceRevisionObjective = null;
  state.creative.runtime = null;
  state.proposed = [];
  state.draftSequencePath = "";
  syncFlags(state);
}

export function syncDesignerDraftFlags(state) {
  syncFlags(state);
}
