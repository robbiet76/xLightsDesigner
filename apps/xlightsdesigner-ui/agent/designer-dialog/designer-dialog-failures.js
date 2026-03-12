function str(value = "") {
  return String(value || "").trim().toLowerCase();
}

export function classifyDesignerOrchestrationFailure(result = {}) {
  if (result?.failureReason) return String(result.failureReason);
  if (result?.status === "ok" || result?.status === "partial") return null;
  const combined = `${str(result?.summary)} ${str((result?.warnings || []).join(" "))}`.trim();
  if (combined.includes("clarif")) return "clarification";
  if (combined.includes("handoff")) return "handoff_validation";
  if (combined.includes("stale") || combined.includes("rebase") || combined.includes("revision")) return "stale_rebase";
  if (combined.includes("proposal") || combined.includes("design")) return "proposal_generation";
  if (combined.includes("runtime") || combined.includes("failed")) return "runtime";
  return "unknown";
}
