function str(value = "") {
  return String(value || "").trim();
}

export function createApplyReviewRuntime(deps = {}) {
  const {
    state,
    hasAllSectionsSelected = () => false,
    getSelectedSections = () => [],
    getSectionChoiceList = () => [],
    getSectionName = () => "General",
    buildDesignerPlanCommandsFromLines = (lines) => lines,
    estimateImpactCount = () => 0,
    currentSequencePathForSidecar = () => "",
    getDesktopFileStatBridge = () => null,
    applyEnabled = () => true,
    applyDisabledReason = () => "",
    syncLatestSequenceRevision = async () => ({ ok: true }),
    pushDiagnostic = () => {},
    pushSequenceAgentContractDiagnostic = () => {},
    evaluateApplyHandoffGate = () => ({ ok: true, message: "" }),
    getValidHandoffRecord = () => null,
    getValidHandoff = () => null,
    setStatus = () => {},
    setStatusWithDiagnostics = () => {},
    render = () => {},
    requiresApplyConfirmation = () => false,
    confirm = () => true,
    setAgentActiveRole = () => {},
    beginOrchestrationRun = () => ({ id: `orch-${Date.now()}` }),
    markOrchestrationStage = () => {},
    endOrchestrationRun = () => {},
    addChatMessage = () => {},
    executeApplyCore = async () => ({ blocked: true, message: "Apply blocked." }),
    saveCurrentProjectSnapshot = () => {},
    persist = () => {},
    persistCurrentArtifactsForHistory = async () => {},
    pushApplyHistory = () => {},
    appendDesktopApplyLog = async () => {},
    refreshApplyHistoryFromDesktop = async () => {},
    upsertJob = () => {},
    bumpVersion = () => {},
    addStructuredChatMessage = () => {}
  } = deps;

  function filteredProposed() {
    if (hasAllSectionsSelected()) return state.proposed;
    const selected = new Set(getSelectedSections());
    return state.proposed.filter((item) => {
      const section = getSectionName(item);
      return section === "General" || selected.has(section);
    });
  }

  function buildDesignerPlanCommands(sourceLines = filteredProposed()) {
    return buildDesignerPlanCommandsFromLines(sourceLines, { trackName: "XD:ProposedPlan" });
  }

  async function preflightSequenceFileForApply() {
    const sequencePath = currentSequencePathForSidecar();
    if (!sequencePath) {
      return { ok: false, message: "Open or create a sequence before apply." };
    }
    const bridge = getDesktopFileStatBridge();
    if (!bridge) {
      return { ok: true };
    }
    try {
      const stat = await bridge.getFileStat({ filePath: sequencePath });
      if (!stat?.ok || !stat?.exists) {
        return { ok: false, message: "The open sequence file is missing on disk. Save or reopen the sequence in xLights first." };
      }
      const size = Number(stat.size || 0);
      if (!Number.isFinite(size) || size <= 0) {
        return { ok: false, message: "The open sequence file is empty on disk. Save the sequence in xLights first." };
      }
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        message: `Unable to verify the open sequence file before apply: ${String(err?.message || err || "unknown error")}`
      };
    }
  }

  async function applyProposal(sourceLines = filteredProposed(), applyLabel = "proposal") {
    if (!applyEnabled()) {
      setStatusWithDiagnostics("warning", applyDisabledReason());
      render();
      return {
        ok: false,
        status: "blocked",
        blocked: true,
        reason: "apply_disabled",
        message: applyDisabledReason()
      };
    }
    const revisionState = await syncLatestSequenceRevision({
      onStaleMessage: "Sequence changed since draft creation. Refresh proposal before apply.",
      onUnknownMessage: "Unable to confirm current xLights revision. Continuing with reduced safety for apply."
    });
    if (!revisionState.ok) {
      pushDiagnostic("warning", "Proceeding with apply despite revision sync failure.", String(revisionState.error || "revision sync failed"));
    } else if (revisionState.revision === "unknown") {
      pushDiagnostic("warning", "Proceeding with apply despite unknown xLights revision.");
    }
    if (state.flags.proposalStale) {
      const message = "Apply blocked: draft is stale against the latest xLights revision.";
      setStatusWithDiagnostics("warning", message);
      render();
      return { ok: false, status: "blocked", blocked: true, reason: "stale_draft", message };
    }
    const handoffGate = evaluateApplyHandoffGate();
    if (!handoffGate.ok) {
      const message = `Apply blocked: ${handoffGate.message}`;
      setStatusWithDiagnostics("warning", message);
      render();
      return { ok: false, status: "blocked", blocked: true, reason: "handoff_gate", message };
    }
    const intentHandoffRecord = getValidHandoffRecord("intent_handoff_v1");
    const intentHandoff = intentHandoffRecord?.payload || null;
    const planHandoff = getValidHandoff("plan_handoff_v1");
    const scopedSource = Array.isArray(sourceLines) ? sourceLines.filter(Boolean) : [];
    if (!scopedSource.length) {
      const message = "No proposed changes available for this apply action.";
      setStatusWithDiagnostics("warning", message);
      render();
      return { ok: false, status: "blocked", blocked: true, reason: "no_proposed_changes", message };
    }
    if (!state.ui.applyApprovalChecked) {
      const message = "Review the plan and check approval before apply.";
      setStatusWithDiagnostics("warning", message);
      render();
      return { ok: false, status: "blocked", blocked: true, reason: "approval_required", message };
    }
    const sequencePreflight = await preflightSequenceFileForApply();
    if (!sequencePreflight.ok) {
      setStatusWithDiagnostics("warning", sequencePreflight.message);
      render();
      return { ok: false, status: "blocked", blocked: true, reason: "sequence_preflight", message: sequencePreflight.message };
    }
    const scopedImpactCount = scopedSource.length * 11;

    if (requiresApplyConfirmation()) {
      const message = `Apply ${scopedImpactCount} estimated impacted effects?`;
      if (!confirm(message)) {
        const cancelMessage = "Apply canceled by user.";
        setStatus("info", cancelMessage);
        render();
        return { ok: false, status: "canceled", blocked: true, reason: "user_canceled", message: cancelMessage };
      }
    }

    state.flags.applyInProgress = true;
    setAgentActiveRole("sequence_agent");
    const orchestrationRun = beginOrchestrationRun({ trigger: "apply", role: "sequence_agent" });
    state.ui.agentThinking = true;
    addChatMessage("agent", `Applying approved ${applyLabel} to xLights...`);
    setStatus("info", `Applying ${applyLabel} to xLights...`);
    render();

    let applyAuditEntry = null;
    let applyResult = null;
    let clearApprovalAfterApply = false;

    try {
      const result = await executeApplyCore({
        state,
        sourceLines: scopedSource,
        applyLabel,
        scopedImpactCount,
        orchestrationRun,
        intentHandoffRecord,
        intentHandoff,
        planHandoff,
        deps: {
          ...deps,
          filteredProposed
        },
        callbacks: {
          pushSequenceAgentContractDiagnostic,
          markOrchestrationStage,
          endOrchestrationRun,
          pushDiagnostic,
          upsertJob,
          bumpVersion,
          setStatusWithDiagnostics,
          addStructuredChatMessage
        }
      });

      applyAuditEntry = result.applyAuditEntry || null;
      applyResult = result.applyResult || null;
      clearApprovalAfterApply = Boolean(result.clearApprovalAfterApply);
      if (result.blocked) {
        setStatusWithDiagnostics("action-required", result.message || "Apply blocked.", result.details || "");
        return {
          ok: false,
          status: "blocked",
          blocked: true,
          reason: result.applyResult?.failureReason || result.status || "blocked",
          message: result.message || "Apply blocked.",
          details: result.details || "",
          applyAuditEntry,
          applyResult
        };
      }
    } finally {
      if (clearApprovalAfterApply) {
        state.ui.applyApprovalChecked = false;
      }
      if (applyAuditEntry) {
        const persistedHistory = await persistCurrentArtifactsForHistory({ planHandoff, applyResult, historyEntry: applyAuditEntry });
        const storedApplyAuditEntry = persistedHistory?.historyEntry || applyAuditEntry;
        const effectOutcomeRecords = Array.isArray(persistedHistory?.effectOutcomeRecords) ? persistedHistory.effectOutcomeRecords : [];
        pushApplyHistory(storedApplyAuditEntry, { planHandoff, applyResult, effectOutcomeRecords });
        await appendDesktopApplyLog(storedApplyAuditEntry);
        await refreshApplyHistoryFromDesktop(40);
      }
      state.flags.applyInProgress = false;
      state.ui.agentThinking = false;
      saveCurrentProjectSnapshot();
      persist();
      render();
    }
    return {
      ok: Boolean(applyAuditEntry),
      status: applyResult?.status || (applyAuditEntry ? str(applyAuditEntry.status || "unknown") : "unknown"),
      blocked: false,
      reason: applyResult?.failureReason || null,
      message: applyAuditEntry?.summary || null,
      applyAuditEntry,
      applyResult
    };
  }

  function selectedProposedLinesForApply() {
    const selectedIndexes = Array.isArray(state.ui?.proposedSelection)
      ? state.ui.proposedSelection.filter((idx) => Number.isInteger(idx))
      : [];
    if (!selectedIndexes.length) return [];
    const rows = Array.isArray(state.proposed) ? state.proposed : [];
    return selectedIndexes
      .map((idx) => rows[idx])
      .filter((line) => typeof line === "string" && line.trim());
  }

  async function applySelectedProposal() {
    const selectedLines = selectedProposedLinesForApply();
    if (!selectedLines.length) {
      setStatus("warning", "Select one or more proposed changes first.");
      render();
      return;
    }
    await applyProposal(selectedLines, "selected proposed changes");
  }

  async function applyAllProposal() {
    return await applyProposal(filteredProposed(), "all proposed changes");
  }

  return {
    filteredProposed,
    buildDesignerPlanCommands,
    preflightSequenceFileForApply,
    applyProposal,
    selectedProposedLinesForApply,
    applySelectedProposal,
    applyAllProposal
  };
}
