function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

export function buildReviewDashboardState({
  state = {},
  helpers = {}
} = {}) {
  const {
    getSelectedSections = () => [],
    hasAllSectionsSelected = () => true,
    getSectionName = () => "",
    selectedProposedLinesForApply = () => [],
    summarizeImpactForLines = () => ({ targetCount: 0, sectionWindows: [] }),
    buildDesignerPlanCommands = () => [],
    applyReadyForApprovalGate = () => false,
    applyDisabledReason = () => "",
    buildCurrentReviewSnapshotSummary = () => ({})
  } = helpers;

  const selectedSections = getSelectedSections();
  const allSelected = hasAllSectionsSelected();
  const applyReady = Boolean(applyReadyForApprovalGate());
  const disabledReason = str(applyDisabledReason());
  const approvalChecked = Boolean(state.ui?.applyApprovalChecked);
  const filteredRows = arr(state.proposed)
    .map((line, idx) => ({ line: str(line), idx }))
    .filter((entry) => {
      if (allSelected) return true;
      const section = str(getSectionName(entry.line));
      return section === "General" || selectedSections.includes(section);
    });
  const selectedIndexes = arr(state.ui?.proposedSelection).filter((idx) => Number.isInteger(idx));
  const selectedCount = selectedIndexes.filter((idx) => filteredRows.some((row) => row.idx === idx)).length;
  const allVisibleLines = filteredRows.map((row) => row.line);
  const selectedLines = arr(selectedProposedLinesForApply()).map((row) => str(row)).filter(Boolean);
  const previewLines = selectedLines.length ? selectedLines : allVisibleLines;

  let previewCommands = [];
  let previewError = "";
  if (previewLines.length) {
    try {
      previewCommands = arr(buildDesignerPlanCommands(previewLines));
    } catch (err) {
      previewError = str(err?.message || "Unable to build command preview.");
    }
  }

  const impact = summarizeImpactForLines(previewLines) || { targetCount: 0, sectionWindows: [] };
  const verification = state.lastApplyVerification && typeof state.lastApplyVerification === "object"
    ? state.lastApplyVerification
    : null;
  const currentSnapshot = buildCurrentReviewSnapshotSummary() || {};
  const applyHistory = arr(state.applyHistory);
  const lastApply = applyHistory.length ? applyHistory[0] : null;
  const lastAppliedSnapshot =
    state.ui?.reviewHistorySnapshot &&
    typeof state.ui.reviewHistorySnapshot === "object" &&
    state.ui.reviewHistorySnapshot.historyEntryId === str(lastApply?.historyEntryId)
      ? state.ui.reviewHistorySnapshot
      : null;
  const backupReady = Boolean(str(state.lastApplyBackupPath));
  const reviewStateLabel = state.flags?.applyInProgress
    ? "Applying"
    : state.flags?.proposalStale
      ? "Stale"
      : approvalChecked
        ? "Approved"
        : "Needs Approval";
  const planSummary = previewCommands.length
    ? `${previewCommands.length} command${previewCommands.length === 1 ? "" : "s"} ready for execution`
    : previewError || "No command preview available.";
  const canApplySelected = selectedCount > 0 && !state.flags?.applyInProgress && applyReady && approvalChecked;
  const canApplyAll = filteredRows.length > 0 && !state.flags?.applyInProgress && applyReady && approvalChecked;

  const validationIssues = [];
  if (!arr(state.proposed).length) {
    validationIssues.push({
      code: "no_pending_review_changes",
      severity: "info",
      message: "No proposed changes are available for review."
    });
  }
  if (state.flags?.proposalStale) {
    validationIssues.push({
      code: "stale_draft",
      severity: "warning",
      message: "Sequence changed since this draft was created. Refresh or rebase before apply."
    });
  }
  if (!applyReady && filteredRows.length) {
    validationIssues.push({
      code: "apply_not_ready",
      severity: "warning",
      message: disabledReason || "Apply is not currently allowed."
    });
  }
  if (applyReady && !approvalChecked) {
    validationIssues.push({
      code: "approval_required",
      severity: "warning",
      message: "Review the plan and confirm approval before applying."
    });
  }

  const ready = filteredRows.length > 0 && applyReady;
  const status = state.flags?.applyInProgress
    ? "in_progress"
    : state.flags?.proposalStale
      ? "stale"
      : ready
        ? "ready"
        : filteredRows.length
          ? "blocked"
          : "idle";

  return {
    contract: "review_dashboard_state_v1",
    version: "1.0",
    page: "review",
    title: "Review",
    summary: str(currentSnapshot?.designSummary?.title || "Ready to apply current design changes"),
    status,
    readiness: {
      ok: ready,
      level: ready ? "ready" : (filteredRows.length ? "blocked" : "idle"),
      reasons: validationIssues.map((issue) => issue.code)
    },
    warnings: validationIssues.filter((issue) => issue.severity === "warning").map((issue) => issue.message),
    validationIssues,
    refs: {
      lastApplyHistoryEntryId: str(lastApply?.historyEntryId || null),
      reviewHistorySnapshotId: str(lastAppliedSnapshot?.historyEntryId || null),
      backupPath: str(state.lastApplyBackupPath || null)
    },
    data: {
      stale: {
        active: Boolean(state.flags?.proposalStale),
        draftBaseRevision: str(state.draftBaseRevision || "unknown"),
        revision: str(state.revision || "unknown")
      },
      approvalChecked,
      applyReady,
      disabledReason,
      reviewStateLabel,
      backupReady,
      previewError,
      planSummary,
      impact,
      verification,
      counts: {
        pendingChanges: allVisibleLines.length,
        targets: Number(impact?.targetCount || 0),
        windows: arr(impact?.sectionWindows).length,
        commands: previewCommands.length,
        selectedCount
      },
      apply: {
        canApplySelected,
        canApplyAll
      },
      currentSnapshot,
      rows: filteredRows.map(({ line, idx }) => ({
        idx,
        line,
        selected: selectedIndexes.includes(idx)
      })),
      lastAppliedSnapshot: lastAppliedSnapshot
        ? {
            brief: lastAppliedSnapshot.creativeBrief || null,
            proposalLines: lastAppliedSnapshot.proposalBundle?.proposalLines || [],
            applyResult: lastAppliedSnapshot.applyResult || lastApply || null,
            analysisArtifact: lastAppliedSnapshot.analysisArtifact || null,
            sceneContext: lastAppliedSnapshot.designSceneContext || null,
            musicContext: lastAppliedSnapshot.musicDesignContext || null,
            artifactRefs: lastApply?.artifactRefs || null
          }
        : null,
      mobileStatusText: applyReady
        ? (approvalChecked ? "Ready" : "Awaiting approval")
        : disabledReason
    }
  };
}
