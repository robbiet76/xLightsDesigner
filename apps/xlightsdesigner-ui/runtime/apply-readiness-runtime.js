export function createApplyReadinessRuntime(deps = {}) {
  const {
    state,
    getValidHandoff = () => null,
    buildTimingTrackStatusRows = () => [],
    getSequenceTimingTrackProvenanceState = () => ({}),
    getSequenceTimingGeneratedSignaturesState = () => ({}),
    getSequenceTimingTrackPoliciesState = () => ({}),
    isXdTimingTrack = () => false,
    buildSequenceSession = () => ({
      xlightsConnected: false,
      planOnlyMode: false,
      effectiveSequenceLoaded: false,
      effectiveSequenceAllowed: false
    }),
    getAgentApplyRolloutMode = () => "full",
    estimateImpactCount = () => 0,
    filteredProposed = () => []
  } = deps;

  function evaluateApplyHandoffGate() {
    const intent = getValidHandoff("intent_handoff_v1");
    if (!intent) {
      return { ok: false, reason: "missing-intent-handoff", message: "Generate proposal to establish intent handoff." };
    }
    const plan = getValidHandoff("plan_handoff_v1");
    if (!plan) {
      return { ok: false, reason: "missing-plan-handoff", message: "Generate proposal to establish plan handoff." };
    }
    const handoffBaseRevision = String(plan?.baseRevision || "unknown");
    const draftBaseRevision = String(state.draftBaseRevision || "unknown");
    if (
      handoffBaseRevision !== "unknown" &&
      draftBaseRevision !== "unknown" &&
      handoffBaseRevision !== draftBaseRevision
    ) {
      return {
        ok: false,
        reason: "plan-base-revision-mismatch",
        message: `Plan handoff revision mismatch (${handoffBaseRevision} vs ${draftBaseRevision}). Regenerate proposal.`
      };
    }
    return { ok: true, reason: "ok", message: "" };
  }

  function buildCurrentSequenceSession(options = {}) {
    return buildSequenceSession({
      state,
      liveSequencePayload: options?.liveSequencePayload || null
    });
  }

  function getCurrentPlanCommandsForTimingReview() {
    const plan = getValidHandoff("plan_handoff_v1");
    if (Array.isArray(plan?.commands)) return plan.commands;
    if (Array.isArray(state.agentPlan?.handoff?.commands)) return state.agentPlan.handoff.commands;
    return [];
  }

  function getBlockingTimingReviewRows(planCommands = getCurrentPlanCommandsForTimingReview()) {
    const rows = buildTimingTrackStatusRows({
      timingTrackProvenance: getSequenceTimingTrackProvenanceState(),
      timingGeneratedSignatures: getSequenceTimingGeneratedSignaturesState(),
      timingTrackPolicies: getSequenceTimingTrackPoliciesState()
    });
    const requiredTrackNames = [...new Set((Array.isArray(planCommands) ? planCommands : []).flatMap((command) => {
      const cmd = String(command?.cmd || "").trim();
      const params = command?.params && typeof command.params === "object" ? command.params : {};
      const anchor = command?.anchor && typeof command.anchor === "object" ? command.anchor : {};
      const names = [];
      if (cmd === "timing.createTrack" || cmd === "timing.insertMarks" || cmd === "timing.replaceMarks") {
        const trackName = String(params?.trackName || "").trim();
        if (isXdTimingTrack(trackName)) names.push(trackName.toLowerCase());
      }
      const anchorTrackName = String(anchor?.trackName || "").trim();
      if (isXdTimingTrack(anchorTrackName)) names.push(anchorTrackName.toLowerCase());
      return names;
    }))];
    return rows.filter((row) => requiredTrackNames.includes(String(row?.trackName || "").trim().toLowerCase()) && (row?.status === "user_edited" || row?.status === "stale"));
  }

  function applyReadyForApprovalGate() {
    const f = state.flags;
    const session = buildCurrentSequenceSession();
    const handoffGate = evaluateApplyHandoffGate();
    const blockingTimingReviewRows = getBlockingTimingReviewRows();
    return (
      f.hasDraftProposal &&
      session.xlightsConnected &&
      f.xlightsCompatible &&
      !session.planOnlyMode &&
      session.effectiveSequenceLoaded &&
      session.effectiveSequenceAllowed &&
      !f.proposalStale &&
      !f.applyInProgress &&
      handoffGate.ok &&
      blockingTimingReviewRows.length === 0
    );
  }

  function applyPlanReadinessReason() {
    const f = state.flags;
    const session = buildCurrentSequenceSession();
    const rolloutMode = getAgentApplyRolloutMode();
    if (!session.xlightsConnected) return "Connect to xLights to apply.";
    if (!f.xlightsCompatible) return "xLights version is below minimum supported floor (2026.1).";
    if (rolloutMode === "disabled") return "Agent apply is disabled by rollout policy.";
    if (rolloutMode === "plan-only") return "Agent rollout is in plan-only mode; apply is disabled.";
    if (session.planOnlyMode) return "Exit plan-only mode to apply.";
    if (!session.effectiveSequenceLoaded) return "Open a sequence first.";
    if (!session.effectiveSequenceAllowed) return "Open a sequence inside the active Show Directory.";
    if (f.proposalStale) return "Refresh proposal before apply.";
    if (!f.hasDraftProposal) return "Generate a proposal first.";
    const handoffGate = evaluateApplyHandoffGate();
    if (!handoffGate.ok) return handoffGate.message;
    const blockingTimingReviewRows = getBlockingTimingReviewRows();
    if (blockingTimingReviewRows.length) {
      return `Accept timing review for ${blockingTimingReviewRows.map((row) => String(row.trackName || "").trim()).filter(Boolean).join(", ")} before apply.`;
    }
    if (f.applyInProgress) return "Apply in progress.";
    return "";
  }

  function applyDisabledReason() {
    if (applyReadyForApprovalGate() && !state.ui.applyApprovalChecked) {
      return "Review the plan and check approval before apply.";
    }
    return applyPlanReadinessReason();
  }

  function applyEnabled() {
    return applyReadyForApprovalGate() && Boolean(state.ui.applyApprovalChecked);
  }

  function currentImpactCount() {
    return estimateImpactCount(filteredProposed());
  }

  function requiresApplyConfirmation() {
    const mode = state.safety?.applyConfirmMode || "large-only";
    if (mode === "always") return true;
    if (mode === "never") return false;
    return currentImpactCount() >= (state.safety?.largeChangeThreshold || 60);
  }

  return {
    evaluateApplyHandoffGate,
    buildCurrentSequenceSession,
    getCurrentPlanCommandsForTimingReview,
    getBlockingTimingReviewRows,
    applyReadyForApprovalGate,
    applyPlanReadinessReason,
    applyDisabledReason,
    applyEnabled,
    currentImpactCount,
    requiresApplyConfirmation
  };
}
