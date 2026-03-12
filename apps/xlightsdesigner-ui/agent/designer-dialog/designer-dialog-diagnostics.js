function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

export function buildDesignerDiagnosticsArtifact({
  requestId = "",
  status = "failed",
  failureReason = null,
  degradedMode = false,
  warnings = [],
  proposalBundle = null,
  creativeBrief = null,
  handoff = null
} = {}) {
  return {
    artifactType: "designer_dialog_diagnostics_v1",
    requestId: str(requestId),
    status: str(status),
    failureReason: failureReason == null ? null : str(failureReason),
    degradedMode: Boolean(degradedMode),
    warnings: arr(warnings).map((row) => str(row)).filter(Boolean),
    proposalLifecycle: proposalBundle?.lifecycle || null,
    proposalSummary: str(proposalBundle?.summary),
    briefSummary: str(creativeBrief?.summary),
    handoffGoal: str(handoff?.goal),
    generatedAt: new Date().toISOString()
  };
}
