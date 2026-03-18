import { executeDesignerDialogFlow } from "./designer-dialog-runtime.js";
import { buildDesignerDiagnosticsArtifact } from "./designer-dialog-diagnostics.js";
import { classifyDesignerOrchestrationFailure } from "./designer-dialog-failures.js";
import { normalizeDesignerCloudResponse } from "./designer-cloud-response.js";

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function str(value = "") {
  return String(value || "").trim();
}

export function executeDesignerProposalOrchestration(input = {}) {
  const localResult = executeDesignerDialogFlow(input);
  const hasAuthoritativeTargetSelection = arr(input?.selectedTargetIds).map((row) => str(row)).filter(Boolean).length > 0;
  const cloudResult = input?.cloudResponse && !hasAuthoritativeTargetSelection
    ? normalizeDesignerCloudResponse({
        cloudResponse: input.cloudResponse,
        fallback: {
          requestId: localResult?.requestId || input?.requestId,
          creativeBrief: localResult?.creativeBrief || null,
          proposalBundle: localResult?.proposalBundle || null,
          warnings: localResult?.warnings || []
        },
        requestId: localResult?.requestId || input?.requestId,
        handoff: localResult?.handoff || null
      })
    : null;
  const result = cloudResult || localResult;
  const source = cloudResult
    ? "cloud_normalized"
    : (hasAuthoritativeTargetSelection && input?.cloudResponse ? "local_runtime_explicit_target_scope" : "local_runtime");
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
    source,
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
    assistantMessage: str(result?.assistantMessage || ""),
    warnings: arr(result?.warnings),
    summary: str(result?.summary || proposalBundle.summary || "")
  };
}
