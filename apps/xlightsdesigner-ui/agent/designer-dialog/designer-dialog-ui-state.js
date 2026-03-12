function arr(value) {
  return Array.isArray(value) ? value : [];
}

export function applyDesignerProposalSuccessToState(state, orchestration = {}) {
  if (!state || !orchestration?.ok) return;

  state.creative = state.creative || {};
  state.creative.brief = orchestration.creativeBrief || state.creative.brief || null;
  state.creative.proposalBundle = orchestration.proposalBundle || null;
  state.creative.briefUpdatedAt = new Date().toISOString();
  state.flags.creativeBriefReady = Boolean(state.creative.brief);
  state.proposed = arr(orchestration.proposalLines);
}

export function buildDesignerGuidedQuestionMessage(guidedQuestions = []) {
  const lines = arr(guidedQuestions).map((row) => String(row || "").trim()).filter(Boolean);
  if (!lines.length) return "";
  return `Before next pass, consider: ${lines.join(" | ")}`;
}
