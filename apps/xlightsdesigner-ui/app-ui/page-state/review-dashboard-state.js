function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueStrings(values = []) {
  return [...new Set(arr(values).map((value) => str(value)).filter(Boolean))];
}

function differenceStrings(nextValues = [], previousValues = []) {
  const previous = new Set(uniqueStrings(previousValues));
  return uniqueStrings(nextValues).filter((value) => !previous.has(value));
}

function buildGenerativeSummaryFromMetadata(metadata = null) {
  if (!metadata || typeof metadata !== "object") return null;
  const intentEnvelope = metadata.intentEnvelope && typeof metadata.intentEnvelope === "object"
    ? metadata.intentEnvelope
    : null;
  const realizationCandidates = metadata.realizationCandidates && typeof metadata.realizationCandidates === "object"
    ? metadata.realizationCandidates
    : null;
  const candidateSelection = metadata.candidateSelection && typeof metadata.candidateSelection === "object"
    ? metadata.candidateSelection
    : null;
  const candidateChoice = metadata.candidateChoice && typeof metadata.candidateChoice === "object"
    ? metadata.candidateChoice
    : null;
  const effectStrategy = metadata.effectStrategy && typeof metadata.effectStrategy === "object"
    ? metadata.effectStrategy
    : null;
  const revisionDelta = metadata.revisionDelta && typeof metadata.revisionDelta === "object"
    ? metadata.revisionDelta
    : null;
  const revisionRetryPressure = metadata.revisionRetryPressure && typeof metadata.revisionRetryPressure === "object"
    ? metadata.revisionRetryPressure
    : null;
  const priorPassMemory = metadata.priorPassMemory && typeof metadata.priorPassMemory === "object"
    ? metadata.priorPassMemory
    : null;
  const candidates = arr(realizationCandidates?.candidates).filter((row) => row && typeof row === "object");
  const scoredCandidates = arr(candidateSelection?.scoredCandidates).filter((row) => row && typeof row === "object");
  const selectedBandIds = uniqueStrings(candidateSelection?.selectedBand?.candidateIds).slice(0, 4);
  const chosenCandidateId = str(candidateChoice?.chosenCandidateId || effectStrategy?.selectedCandidateId);
  const chosenCandidate = chosenCandidateId
    ? candidates.find((row) => str(row?.candidateId) === chosenCandidateId)
    : null;
  const chosenSummary = str(effectStrategy?.selectedCandidateSummary || chosenCandidate?.summary);
  const chosenSeedRecommendations = arr(chosenCandidate?.seedRecommendations).filter((row) => row && typeof row === "object");
  const currentEffectNames = uniqueStrings(
    chosenSeedRecommendations.length
      ? chosenSeedRecommendations.map((row) => row?.effectName)
      : arr(effectStrategy?.seedRecommendations).map((row) => row?.effectName)
  );
  const currentTargetIds = uniqueStrings(
    chosenSeedRecommendations.length
      ? chosenSeedRecommendations.flatMap((row) => arr(row?.targetIds))
      : arr(effectStrategy?.seedRecommendations).flatMap((row) => arr(row?.targetIds))
  );
  const selectionMode = str(candidateChoice?.selectionMode || candidateSelection?.policy?.mode);
  const phase = str(candidateSelection?.policy?.phase || metadata.candidateSelectionContext?.phase);
  const unresolvedSignals = uniqueStrings(metadata.candidateSelectionContext?.unresolvedSignals).slice(0, 5);
  const retryPressureSignals = uniqueStrings(
    revisionRetryPressure?.signals || metadata.candidateSelectionContext?.retryPressureSignals || priorPassMemory?.retryPressureSignals
  ).slice(0, 5);
  const oscillatingCandidateIds = uniqueStrings(
    revisionRetryPressure?.oscillation?.candidateIds || scoredCandidates
      .filter((row) => str(row?.oscillationRisk) === "high")
      .map((row) => str(row?.candidateId))
  ).slice(0, 4);
  const hasContent = intentEnvelope || candidates.length || candidateSelection || candidateChoice || effectStrategy;
  if (!hasContent) return null;
  return {
    intent: {
      attentionProfile: str(intentEnvelope?.attention?.profile || "unconstrained"),
      temporalProfile: str(intentEnvelope?.temporal?.profile || "unconstrained"),
      footprint: str(intentEnvelope?.spatial?.footprint || "unconstrained"),
      texture: str(intentEnvelope?.texture?.profile || "unconstrained")
    },
    candidates: {
      count: candidates.length,
      candidateIds: candidates.map((row) => str(row?.candidateId)).filter(Boolean).slice(0, 4)
    },
    selection: {
      mode: selectionMode,
      phase,
      primaryCandidateId: str(candidateSelection?.primaryCandidateId),
      selectedBandIds,
      selectedBandSize: Number(candidateSelection?.selectedBand?.size || selectedBandIds.length || 0)
    },
    choice: {
      chosenCandidateId,
      chosenSummary,
      selectedFromBand: Boolean(candidateChoice?.selectedFromBand),
      unresolvedSignals,
      retryPressureSignals
    },
    delta: {
      artifactType: str(revisionDelta?.artifactType || "revision_delta_v1"),
      artifactId: str(revisionDelta?.artifactId),
      currentEffectNames: uniqueStrings(revisionDelta?.current?.effectNames || currentEffectNames).slice(0, 5),
      currentTargetIds: uniqueStrings(revisionDelta?.current?.targetIds || currentTargetIds).slice(0, 5),
      previousEffectNames: uniqueStrings(revisionDelta?.previous?.effectNames || priorPassMemory?.previousEffectNames).slice(0, 5),
      previousTargetIds: uniqueStrings(revisionDelta?.previous?.targetIds || priorPassMemory?.previousTargetIds).slice(0, 5),
      introducedEffectNames: uniqueStrings(revisionDelta?.introduced?.effectNames || differenceStrings(currentEffectNames, priorPassMemory?.previousEffectNames)).slice(0, 5),
      introducedTargetIds: uniqueStrings(revisionDelta?.introduced?.targetIds || differenceStrings(currentTargetIds, priorPassMemory?.previousTargetIds)).slice(0, 5)
    },
    retry: {
      artifactType: str(revisionRetryPressure?.artifactType || "revision_retry_pressure_v1"),
      artifactId: str(revisionRetryPressure?.artifactId),
      signals: retryPressureSignals,
      oscillatingCandidateIds
    }
  };
}

function buildPreferenceCue(profile = null) {
  const preferences = profile?.preferences && typeof profile.preferences === "object"
    ? profile.preferences
    : {};
  const parts = [];
  const palette = str(preferences.palettePreference);
  const motion = str(preferences.motionPreference);
  const focus = str(preferences.focusPreference);
  if (palette) parts.push(palette.replace(/_/g, " "));
  if (motion) parts.push(motion);
  if (focus) parts.push(focus.replace(/_/g, " "));
  return parts.slice(0, 3).join(" / ");
}

function buildDesignDisplay(designId = "", designRevision = 0) {
  const raw = str(designId);
  const revision = Number.isInteger(Number(designRevision)) ? Number(designRevision) : 0;
  const desMatch = raw.match(/^DES-(\d+)$/i);
  if (desMatch) {
    return {
      designNumber: Number(desMatch[1]),
      designRevision: revision,
      designLabel: `D${Number(desMatch[1])}.${revision}`
    };
  }
  const dMatch = raw.match(/^D(\d+)$/i);
  if (dMatch) {
    return {
      designNumber: Number(dMatch[1]),
      designRevision: revision,
      designLabel: `D${Number(dMatch[1])}.${revision}`
    };
  }
  return {
    designNumber: 0,
    designRevision: revision,
    designLabel: raw || ""
  };
}

function compareDesignEntries(a = {}, b = {}) {
  const aNumber = Number.isFinite(Number(a.designNumber)) ? Number(a.designNumber) : Number.MAX_SAFE_INTEGER;
  const bNumber = Number.isFinite(Number(b.designNumber)) ? Number(b.designNumber) : Number.MAX_SAFE_INTEGER;
  if (aNumber !== bNumber) return aNumber - bNumber;
  const aRevision = Number.isFinite(Number(a.designRevision)) ? Number(a.designRevision) : 0;
  const bRevision = Number.isFinite(Number(b.designRevision)) ? Number(b.designRevision) : 0;
  if (aRevision !== bRevision) return bRevision - aRevision;
  return str(a.designId).localeCompare(str(b.designId));
}

function buildReviewGroupRows({ state = {}, filteredRows = [], selectedIndexes = [] } = {}) {
  const preferenceCue = buildPreferenceCue(state.directorProfile || null);
  const executionPlan = state.creative?.proposalBundle?.executionPlan && typeof state.creative.proposalBundle.executionPlan === "object"
    ? state.creative.proposalBundle.executionPlan
    : (state.creative?.intentHandoff?.executionStrategy && typeof state.creative.intentHandoff.executionStrategy === "object"
        ? state.creative.intentHandoff.executionStrategy
        : null);
  const sectionPlans = arr(executionPlan?.sectionPlans);
  const planCommands = arr(state.agentPlan?.handoff?.commands);
  const effectCommands = planCommands.filter((command) => str(command?.cmd) === "effects.create");
  const supersededConcepts = arr(state.creative?.supersededConcepts);
  const supersededByDesignId = new Map();
  for (const row of supersededConcepts) {
    const designId = str(row?.designId);
    if (!designId) continue;
    if (!supersededByDesignId.has(designId)) supersededByDesignId.set(designId, []);
    supersededByDesignId.get(designId).push(row);
  }
  function buildPreviousRevisionSummary(designId = "") {
    const revisions = supersededByDesignId.get(str(designId)) || [];
    if (!revisions.length) return null;
    const latest = [...revisions].sort((a, b) => Number(b?.designRevision || 0) - Number(a?.designRevision || 0))[0];
    const display = buildDesignDisplay(designId, latest?.designRevision || 0);
    return {
      designId: str(latest?.designId || designId),
      designRevision: Number(latest?.designRevision || 0),
      designLabel: display.designLabel,
      summary: str(latest?.summary || "Previous revision"),
      anchor: uniqueStrings(latest?.sections || []).join(", ") || "General",
      targetSummary: uniqueStrings(latest?.targetIds || []).slice(0, 3).join(", ") || "Current scope",
      effectCount: Number(latest?.placementCount || 0)
    };
  }
  const conceptMeta = new Map();
  for (const row of sectionPlans) {
    const designId = str(row?.designId);
    if (!designId) continue;
    if (!conceptMeta.has(designId)) {
      conceptMeta.set(designId, {
        designId,
        designRevision: Number(row?.designRevision || 0),
        designAuthor: str(row?.designAuthor || "designer"),
        sections: [],
        summaries: [],
        targetIds: []
      });
    }
    const bucket = conceptMeta.get(designId);
    if (str(row?.section)) bucket.sections.push(str(row.section));
    if (str(row?.intentSummary)) bucket.summaries.push(str(row.intentSummary));
    bucket.targetIds.push(...arr(row?.targetIds));
  }

  if (conceptMeta.size) {
    return [...conceptMeta.values()].map((meta, index) => {
      const designId = str(meta.designId);
      const matchingIndexes = filteredRows
        .filter((entry) => meta.sections.includes(str(entry.section)))
        .map((entry) => entry.idx);
      const linkedEffectCount = effectCommands.filter((command) => str(command?.designId || command?.intent?.designId) === designId).length;
      return {
        idx: index,
        designId,
        ...buildDesignDisplay(designId, meta.designRevision),
        designAuthor: str(meta.designAuthor || "designer"),
        revisionState: "current",
        supersededRevisionCount: (supersededByDesignId.get(designId) || []).length,
        previousRevision: buildPreviousRevisionSummary(designId),
        anchor: uniqueStrings(meta.sections).join(", ") || "General",
        summary: uniqueStrings(meta.summaries)[0] || "Pending design change",
        targetSummary: uniqueStrings(meta.targetIds).slice(0, 3).join(", ") || "Current scope",
        preferenceCue,
        effectCount: linkedEffectCount,
        indexes: matchingIndexes,
        selected: matchingIndexes.length ? matchingIndexes.every((idx) => selectedIndexes.includes(idx)) : false
      };
    }).sort(compareDesignEntries);
  }

  const grouped = new Map();
  for (const entry of filteredRows) {
    const line = str(entry?.line);
    const section = str(entry?.section);
    let matchedDesignId = "";
    for (const [designId, meta] of conceptMeta.entries()) {
      if (meta.sections.includes(section)) {
        matchedDesignId = designId;
        break;
      }
    }
    const key = matchedDesignId || `line-${entry.idx}`;
    if (!grouped.has(key)) {
      const meta = matchedDesignId ? conceptMeta.get(matchedDesignId) : null;
      const linkedEffectCount = matchedDesignId
        ? effectCommands.filter((command) => str(command?.designId || command?.intent?.designId) === matchedDesignId).length
        : 0;
      grouped.set(key, {
        designId: matchedDesignId,
        designRevision: Number(meta?.designRevision || 0),
        designAuthor: str(meta?.designAuthor || "designer"),
        sections: uniqueStrings(meta?.sections || (section ? [section] : [])),
        summaries: uniqueStrings(meta?.summaries || [line]),
        targetIds: uniqueStrings(meta?.targetIds || []),
        indexes: [],
        linkedEffectCount
      });
    }
    grouped.get(key).indexes.push(entry.idx);
  }

  return [...grouped.values()].map((row, index) => {
    const indexes = Array.from(new Set(arr(row.indexes).filter((value) => Number.isInteger(value)))).sort((a, b) => a - b);
    return {
      idx: index,
      designId: str(row.designId || ""),
      ...buildDesignDisplay(row.designId || "", row.designRevision || 0),
      designAuthor: str(row.designAuthor || ""),
      revisionState: "current",
      supersededRevisionCount: (supersededByDesignId.get(str(row.designId || "")) || []).length,
      previousRevision: buildPreviousRevisionSummary(row.designId),
      anchor: row.sections.length ? row.sections.join(", ") : "General",
      summary: row.summaries[0] || "Pending design change",
      targetSummary: row.targetIds.length ? row.targetIds.slice(0, 3).join(", ") : "Current scope",
      preferenceCue,
      effectCount: Number(row.linkedEffectCount || 0),
      indexes,
      selected: indexes.length ? indexes.every((idx) => selectedIndexes.includes(idx)) : false
    };
  }).sort(compareDesignEntries);
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
  const preferenceCue = buildPreferenceCue(state.directorProfile || null);

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
  const reviewRows = buildReviewGroupRows({
    state,
    filteredRows: filteredRows.map((row) => ({ ...row, section: str(getSectionName(row.line)) })),
    selectedIndexes
  });
  const selectedCount = reviewRows.filter((row) => row.selected).length;
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
  const currentGenerativeSummary = buildGenerativeSummaryFromMetadata(state.agentPlan?.metadata || null);
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
      preferenceCue,
      planSummary,
      impact,
      verification,
      counts: {
        pendingChanges: allVisibleLines.length,
        designGroups: reviewRows.length,
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
      currentGenerativeSummary,
      rows: reviewRows,
      lastAppliedSnapshot: lastAppliedSnapshot
        ? {
            brief: lastAppliedSnapshot.creativeBrief || null,
            proposalLines: lastAppliedSnapshot.proposalBundle?.proposalLines || [],
            applyResult: lastAppliedSnapshot.applyResult || lastApply || null,
            planHandoff: lastAppliedSnapshot.planHandoff || null,
            analysisArtifact: lastAppliedSnapshot.analysisArtifact || null,
            sceneContext: lastAppliedSnapshot.designSceneContext || null,
            musicContext: lastAppliedSnapshot.musicDesignContext || null,
            renderObservation: lastAppliedSnapshot.renderObservation || null,
            renderCritiqueContext: lastAppliedSnapshot.renderCritiqueContext || null,
            sequenceArtisticGoal: lastAppliedSnapshot.sequenceArtisticGoal || null,
            sequenceRevisionObjective: lastAppliedSnapshot.sequenceRevisionObjective || null,
            generativeSummary: buildGenerativeSummaryFromMetadata(lastAppliedSnapshot.planHandoff?.metadata || null),
            artifactRefs: lastApply?.artifactRefs || null
          }
        : null,
      mobileStatusText: applyReady
        ? (approvalChecked ? "Ready" : "Awaiting approval")
        : disabledReason
    }
  };
}
