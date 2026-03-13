import { deriveDesignerDraftState } from "./designer-dialog-lifecycle.js";
import { applyDesignerDraftSuccessState } from "./designer-dialog-draft-state.js";

function arr(value) {
  return Array.isArray(value) ? value : [];
}

export function applyDesignerProposalSuccessToState(state, orchestration = {}) {
  if (!state || !orchestration?.ok) return;

  state.creative = state.creative || {};
  state.creative.brief = orchestration.creativeBrief || state.creative.brief || null;
  state.creative.briefUpdatedAt = new Date().toISOString();
  applyDesignerDraftSuccessState(state, {
    proposalBundle: orchestration.proposalBundle || null,
    proposalLines: arr(orchestration.proposalLines)
  });
  const derived = deriveDesignerDraftState({
    proposalBundle: state.creative?.proposalBundle,
    proposed: state.proposed
  });
  state.flags.creativeBriefReady = Boolean(state.creative.brief);
  state.flags.hasDraftProposal = derived.hasDraftProposal;
  state.flags.proposalStale = derived.proposalStale;
  state.draftBaseRevision = derived.draftBaseRevision;
}

export function buildDesignerGuidedQuestionMessage(guidedQuestions = []) {
  const lines = arr(guidedQuestions).map((row) => String(row || "").trim()).filter(Boolean);
  if (!lines.length) return "";
  if (lines.length === 1) {
    return `Before I refine the next pass, I need one decision from you: ${lines[0]}`;
  }
  return `Before I refine the next pass, I need these decisions from you: ${lines.join(" | ")}`;
}

function str(value = "") {
  return String(value || "").trim();
}

function summarizeList(values = [], count = 2) {
  return arr(values).map((row) => str(row)).filter(Boolean).slice(0, count).join(", ");
}

export function buildDesignerCompletionMessage({
  proposalBundle = null,
  creativeBrief = null
} = {}) {
  const summary = str(proposalBundle?.summary || creativeBrief?.summary || "Designer draft ready.");
  const assumptions = arr(proposalBundle?.assumptions).map((row) => str(row)).filter(Boolean);
  const sceneSignals = proposalBundle?.traceability?.designSceneSignals || {};
  const musicSignals = proposalBundle?.traceability?.musicDesignSignals || {};
  const rationale = [];

  const broad = summarizeList(sceneSignals.broadCoverageDomains, 1);
  const focal = summarizeList(sceneSignals.focalCandidates, 1);
  const reveals = summarizeList(musicSignals.revealMoments, 2);
  const holds = summarizeList(musicSignals.holdMoments, 2);

  if (broad) rationale.push(`starting from broad coverage on ${broad}`);
  if (focal) rationale.push(`keeping ${focal} as a focal anchor`);
  if (reveals) rationale.push(`building more contrast into ${reveals}`);
  if (holds) rationale.push(`preserving restraint through ${holds}`);

  const parts = [summary];
  if (rationale.length) {
    parts.push(`I shaped this pass by ${rationale.join(", ")}.`);
  }
  if (assumptions.length) {
    parts.push(`Assumptions: ${assumptions.slice(0, 2).join(" | ")}`);
  }
  return parts.join(" ");
}
