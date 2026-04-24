function str(value = "") {
  return String(value || "").trim();
}

export function createProjectHistoryRuntime(deps = {}) {
  const {
    state,
    getDesktopProjectArtifactBridge = () => null,
    getDesktopAgentLogBridge = () => null,
    pushDiagnostic = () => {},
    buildCurrentDesignSceneContext = () => null,
    buildCurrentMusicDesignContext = () => null,
    getValidHandoff = () => null,
    currentApplyContext = () => ({ projectKey: "", sequencePath: "", endpoint: "" }),
    buildHistoryEntry = (value) => value,
    currentArtifactRefs = () => ({}),
    buildHistorySnapshotSummary = () => ({}),
    buildEffectFamilyOutcomeRecords = () => [],
    getSelectedSections = () => [],
    normalizeMetadataSelectionIds = (values) => values,
    persist = () => {},
    render = () => {}
  } = deps;

  async function persistCurrentArtifactsForHistory({ planHandoff = null, applyResult = null, historyEntry = null } = {}) {
    const bridge = getDesktopProjectArtifactBridge();
    const projectFilePath = str(state.projectFilePath);
    if (!bridge || !projectFilePath) {
      pushDiagnostic("warning", "Project artifact persistence unavailable.", !bridge ? "desktop bridge missing" : "project file path missing");
      return { ok: false, reason: "unavailable" };
    }
    const context = currentApplyContext();
    const outcomeRecords = arrify(buildEffectFamilyOutcomeRecords({
      planHandoff: planHandoff || getValidHandoff("plan_handoff_v1"),
      applyResult,
      renderObservation: state.sequenceAgentRuntime?.renderObservation || null,
      renderCritiqueContext: state.sequenceAgentRuntime?.renderCritiqueContext || null,
      sequenceRevisionObjective: state.creative?.sequenceRevisionObjective || null,
      historyEntry,
      projectKey: context.projectKey,
      sequencePath: context.sequencePath
    })).filter((artifact) => artifact && typeof artifact === "object" && typeof artifact.artifactId === "string");
    const enrichedHistoryEntry = historyEntry && typeof historyEntry === "object"
      ? {
          ...historyEntry,
          effectOutcomeRecordIds: outcomeRecords.map((row) => str(row.artifactId)).filter(Boolean)
        }
      : null;
    const artifacts = [
      state.audioAnalysis?.artifact || null,
      buildCurrentDesignSceneContext(),
      buildCurrentMusicDesignContext(),
      state.directorProfile || null,
      state.creative?.brief || null,
      state.creative?.proposalBundle || null,
      state.creative?.intentHandoff || getValidHandoff("intent_handoff_v1"),
      planHandoff || getValidHandoff("plan_handoff_v1"),
      applyResult,
      state.sequenceAgentRuntime?.renderObservation || null,
      state.sequenceAgentRuntime?.renderCritiqueContext || null,
      state.creative?.sequenceArtisticGoal || null,
      state.creative?.sequenceRevisionObjective || null,
      enrichedHistoryEntry
    ].filter((artifact) => artifact && typeof artifact === "object" && typeof artifact.artifactId === "string");
    artifacts.push(...outcomeRecords);
    if (!artifacts.length) {
      pushDiagnostic("warning", "Project artifact persistence skipped.", "no artifacts were available to write");
      return { ok: false, reason: "no_artifacts" };
    }
    try {
      const res = await bridge.writeProjectArtifacts({
        projectFilePath,
        artifacts
      });
      if (!res?.ok) {
        pushDiagnostic(
          "warning",
          "Project artifact persistence failed.",
          `reason=${str(res?.reason || res?.error || "unknown")} artifacts=${artifacts.length} outcomes=${outcomeRecords.length}`
        );
      }
      return {
        ...res,
        historyEntry: enrichedHistoryEntry || historyEntry || null,
        effectOutcomeRecords: outcomeRecords
      };
    } catch (err) {
      pushDiagnostic("warning", "Project artifact persistence failed.", String(err?.message || err));
      return { ok: false, reason: "write_failed" };
    }
  }

  async function readProjectArtifactById(artifactType = "", artifactId = "") {
    const bridge = getDesktopProjectArtifactBridge();
    const projectFilePath = str(state.projectFilePath);
    if (!bridge || !projectFilePath) return null;
    const normalizedType = str(artifactType);
    const normalizedId = str(artifactId);
    if (!normalizedType || !normalizedId) return null;
    try {
      const res = await bridge.readProjectArtifact({
        projectFilePath,
        artifactType: normalizedType,
        artifactId: normalizedId
      });
      return res?.ok === true && res.artifact && typeof res.artifact === "object" ? res.artifact : null;
    } catch {
      return null;
    }
  }

  async function loadHistoryEntrySnapshot(entry = null) {
    if (!entry || typeof entry !== "object") return null;
    const refs = entry.artifactRefs || {};
    const [
      analysisArtifact,
      designSceneContext,
      musicDesignContext,
      directorProfile,
      creativeBrief,
      proposalBundle,
      intentHandoff,
      planHandoff,
      applyResult,
      renderObservation,
      renderCritiqueContext,
      sequenceArtisticGoal,
      sequenceRevisionObjective
    ] = await Promise.all([
      readProjectArtifactById("analysis_artifact_v1", refs.analysisArtifactId),
      readProjectArtifactById("design_scene_context_v1", refs.sceneContextId),
      readProjectArtifactById("music_design_context_v1", refs.musicContextId),
      readProjectArtifactById("director_profile_v1", refs.directorProfileId),
      readProjectArtifactById("creative_brief_v1", refs.briefId),
      readProjectArtifactById("proposal_bundle_v1", refs.proposalId),
      readProjectArtifactById("intent_handoff_v1", refs.intentHandoffId),
      readProjectArtifactById("plan_handoff_v1", refs.planId),
      readProjectArtifactById("apply_result_v1", refs.applyResultId),
      readProjectArtifactById("render_observation_v1", refs.renderObservationId),
      readProjectArtifactById("sequence_render_critique_context_v1", refs.renderCritiqueContextId),
      readProjectArtifactById("sequence_artistic_goal_v1", refs.sequenceArtisticGoalId),
      readProjectArtifactById("sequence_revision_objective_v1", refs.sequenceRevisionObjectiveId)
    ]);
    return {
      historyEntryId: str(entry.historyEntryId),
      analysisArtifact,
      designSceneContext,
      musicDesignContext,
      directorProfile,
      creativeBrief,
      proposalBundle,
      intentHandoff,
      planHandoff,
      applyResult,
      renderObservation,
      renderCritiqueContext,
      sequenceArtisticGoal,
      sequenceRevisionObjective
    };
  }

  async function selectHistoryEntry(entryId = "", options = {}) {
    const normalizedId = str(entryId);
    state.ui.selectedHistoryEntry = normalizedId;
    const applyHistory = Array.isArray(state.applyHistory) ? state.applyHistory : [];
    const selectedEntry = applyHistory.find((entry) => str(entry?.historyEntryId) === normalizedId) || null;
    if (!selectedEntry) {
      state.ui.selectedHistorySnapshot = null;
      if (options.forReview) state.ui.reviewHistorySnapshot = null;
      persist();
      render();
      return null;
    }
    const snapshot = await loadHistoryEntrySnapshot(selectedEntry);
    state.ui.selectedHistorySnapshot = snapshot;
    if (options.forReview) {
      state.ui.reviewHistorySnapshot = snapshot;
    }
    persist();
    render();
    return snapshot;
  }

  function buildApplyHistoryEntry({
    status = "",
    summary = "",
    stage = "",
    commandCount = 0,
    impactCount = 0,
    currentRevision = "",
    nextRevision = "",
    verification = null,
    planHandoff = null,
    applyResult = null
  } = {}) {
    const context = currentApplyContext();
    return {
      ...buildHistoryEntry({
        createdAt: new Date().toISOString(),
        projectId: context.projectKey,
        projectKey: context.projectKey,
        sequencePath: context.sequencePath,
        xlightsRevisionBefore: str(currentRevision || state.draftBaseRevision || state.revision || "unknown"),
        xlightsRevisionAfter: str(nextRevision || currentRevision || state.revision || "unknown"),
        status,
        summary,
        artifactRefs: currentArtifactRefs({ planHandoff, applyResult }),
        snapshotSummary: buildHistorySnapshotSummary({
          creativeBrief: state.creative?.brief || null,
          proposalBundle: state.creative?.proposalBundle || null,
          planHandoff: planHandoff || getValidHandoff("plan_handoff_v1"),
          applyResult,
          selectedSections: getSelectedSections(),
          selectedTargets: normalizeMetadataSelectionIds(state.ui.metadataSelectionIds || [])
        }),
        applyStage: stage,
        commandCount,
        impactCount,
        verification
      }),
      endpoint: context.endpoint
    };
  }

  function buildCurrentReviewSnapshotSummary() {
    return buildHistorySnapshotSummary({
      creativeBrief: state.creative?.brief || null,
      proposalBundle: state.creative?.proposalBundle || null,
      planHandoff: getValidHandoff("plan_handoff_v1"),
      applyResult: null
    });
  }

  function pushApplyHistory(entry, options = {}) {
    const applyResult = options?.applyResult && typeof options.applyResult === "object" ? options.applyResult : null;
    const planHandoff = options?.planHandoff && typeof options.planHandoff === "object" ? options.planHandoff : null;
    const effectOutcomeRecords = Array.isArray(options?.effectOutcomeRecords) ? options.effectOutcomeRecords : [];
    state.applyHistory = [entry, ...(state.applyHistory || [])].slice(0, 80);
    state.ui.selectedHistoryEntry = str(entry?.historyEntryId);
    state.ui.reviewHistorySnapshot = {
      historyEntryId: str(entry?.historyEntryId),
      analysisArtifact: state.audioAnalysis?.artifact || null,
      designSceneContext: buildCurrentDesignSceneContext(),
      musicDesignContext: buildCurrentMusicDesignContext(),
      directorProfile: state.directorProfile || null,
      creativeBrief: state.creative?.brief || null,
      proposalBundle: state.creative?.proposalBundle || null,
      intentHandoff: state.creative?.intentHandoff || getValidHandoff("intent_handoff_v1"),
      planHandoff: planHandoff || getValidHandoff("plan_handoff_v1"),
      applyResult,
      renderObservation: state.sequenceAgentRuntime?.renderObservation || null,
      renderCritiqueContext: state.sequenceAgentRuntime?.renderCritiqueContext || null,
      sequenceArtisticGoal: state.creative?.sequenceArtisticGoal || null,
      sequenceRevisionObjective: state.creative?.sequenceRevisionObjective || null,
      effectOutcomeRecords
    };
    state.ui.selectedHistorySnapshot = state.ui.reviewHistorySnapshot;
  }

  async function appendDesktopApplyLog(entry) {
    const bridge = getDesktopAgentLogBridge();
    if (!bridge) return;
    try {
      await bridge.appendAgentApplyLog({ entry });
    } catch {
      // Non-fatal logging failure.
    }
  }

  async function refreshApplyHistoryFromDesktop(limit = 40) {
    const bridge = getDesktopAgentLogBridge();
    if (!bridge) return;
    const context = currentApplyContext();
    try {
      const res = await bridge.readAgentApplyLog({
        limit,
        projectKey: context.projectKey,
        sequencePath: context.sequencePath || ""
      });
      if (!res?.ok || !Array.isArray(res?.rows)) return;
      state.applyHistory = res.rows.slice(0, limit);
      const selectedId = str(state.ui.selectedHistoryEntry);
      const nextSelectedId =
        selectedId && state.applyHistory.some((entry) => str(entry?.historyEntryId) === selectedId)
          ? selectedId
          : str(state.applyHistory[0]?.historyEntryId);
      if (nextSelectedId) {
        await selectHistoryEntry(nextSelectedId, { forReview: true });
        return;
      }
      state.ui.selectedHistorySnapshot = null;
      state.ui.reviewHistorySnapshot = null;
    } catch {
      // Non-fatal history read failure.
    }
  }

  return {
    persistCurrentArtifactsForHistory,
    readProjectArtifactById,
    loadHistoryEntrySnapshot,
    selectHistoryEntry,
    buildApplyHistoryEntry,
    buildCurrentReviewSnapshotSummary,
    pushApplyHistory,
    appendDesktopApplyLog,
    refreshApplyHistoryFromDesktop
  };
}

function arrify(value) {
  return Array.isArray(value) ? value : [];
}
