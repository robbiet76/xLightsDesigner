import { executeDesignerDialogFlow } from "./designer-dialog-runtime.js";
import { buildDesignerDiagnosticsArtifact } from "./designer-dialog-diagnostics.js";
import { classifyDesignerOrchestrationFailure } from "./designer-dialog-failures.js";

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
  const degradedMode = !input?.analysisHandoff;
  const failureReason = classifyDesignerOrchestrationFailure(result);

  if (result?.status === "failed" || !proposalBundle || !handoff) {
    return {
      ok: false,
      result,
      diagnostics: buildDesignerDiagnosticsArtifact({
        requestId: result?.requestId || input?.requestId,
        status: result?.status || "failed",
        failureReason,
        degradedMode,
        warnings: result?.warnings || [],
        proposalBundle,
        creativeBrief: result?.creativeBrief,
        handoff
      }),
      summary: str(result?.summary || "Designer flow failed."),
      warnings: arr(result?.warnings)
    };
  }

  return {
    ok: true,
    result,
    diagnostics: buildDesignerDiagnosticsArtifact({
      requestId: result?.requestId || input?.requestId,
      status: result?.status || "ok",
      failureReason,
      degradedMode,
      warnings: result?.warnings || [],
      proposalBundle,
      creativeBrief: result?.creativeBrief,
      handoff
    }),
    creativeBrief: result.creativeBrief || null,
    proposalBundle,
    intentHandoff: handoff,
    proposalLines: arr(proposalBundle.proposalLines),
    guidedQuestions: arr(proposalBundle.guidedQuestions),
    warnings: arr(result?.warnings),
    summary: str(result?.summary || proposalBundle.summary || "")
  };
}
