import { executeDesignerDialogFlow } from "./designer-dialog-runtime.js";

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function str(value = "") {
  return String(value || "").trim();
}

export function executeDesignerProposalOrchestration(input = {}) {
  const result = executeDesignerDialogFlow(input);
  const proposalBundle = result?.proposalBundle || null;
  const handoff = result?.handoff || null;

  if (result?.status === "failed" || !proposalBundle || !handoff) {
    return {
      ok: false,
      result,
      summary: str(result?.summary || "Designer flow failed."),
      warnings: arr(result?.warnings)
    };
  }

  return {
    ok: true,
    result,
    creativeBrief: result.creativeBrief || null,
    proposalBundle,
    intentHandoff: handoff,
    proposalLines: arr(proposalBundle.proposalLines),
    guidedQuestions: arr(proposalBundle.guidedQuestions),
    warnings: arr(result?.warnings),
    summary: str(result?.summary || proposalBundle.summary || "")
  };
}
