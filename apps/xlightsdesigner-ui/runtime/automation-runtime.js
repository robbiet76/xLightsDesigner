import { buildEffectiveMetadataAssignments } from "./effective-metadata-assignments.js";
import { mergeVisualHintDefinitions } from "./visual-hint-definitions.js";

export function createAutomationRuntime(deps = {}) {
  const {
    state,
    agentRuntime,
    onSendChat,
    onGenerate,
    onApplyAll,
    onRefresh,
    onAnalyzeAudio,
    onSeedTimingTracksFromAnalysis,
    onOpenExistingSequence,
    clearDesignRevisionTarget,
    normalizeDesignRevisionTarget,
    clearDesignerDraft,
    clearSequencingHandoffsForSequenceChange,
    buildSupersededConceptRecordById,
    retagExecutionPlanForRevisionTarget,
    getExecutionPlanFromArtifacts,
    rebuildProposalBundleFromExecutionPlan,
    setAgentHandoff,
    upsertSupersededConceptRecord,
    isPlainObject,
    buildCurrentDesignSceneContext,
    buildCurrentMusicDesignContext,
    executeDesignerProposalOrchestration,
    getValidHandoff,
    filteredProposed,
    arraysEqualOrdered,
    buildSequenceAgentPlan,
    validateCommandGraph,
    buildOwnedSequencingBatchPlan,
    getOwnedHealth,
    currentLayoutMode,
    getSequenceTimingOwnershipRows,
    applyReadyForApprovalGate,
    definePersistedVisualHint,
    persist,
    render,
    setStatus,
    runCurrentDirectSequenceValidation,
    getCurrentDirectSequenceValidationSnapshot,
    getPageStates
  } = deps;

  async function dispatchAutomationPrompt(prompt = "") {
    const text = String(prompt || "").trim();
    if (!text) {
      return { ok: false, error: "Prompt is required." };
    }
    state.ui.chatDraft = text;
    await onSendChat();
    return {
      ok: true,
      status: state.status || null,
      activeSequence: state.activeSequence || "",
      proposedCount: Array.isArray(state.proposed) ? state.proposed.length : 0,
      lastChatMessage: Array.isArray(state.chat) && state.chat.length ? state.chat[state.chat.length - 1] : null
    };
  }

  async function generateAutomationProposal(payload = {}) {
    const prompt = String(payload?.prompt || "").trim();
    const requestedRole = String(payload?.requestedRole || "designer_dialog").trim();
    let normalizedRevisionTarget = null;
    if (!prompt) {
      return { ok: false, error: "Prompt is required." };
    }
    if (payload?.clearRevisionTarget === true) {
      clearDesignRevisionTarget();
    } else if (payload?.revisionTarget && typeof payload.revisionTarget === "object") {
      normalizedRevisionTarget = normalizeDesignRevisionTarget(payload.revisionTarget);
      if (!normalizedRevisionTarget) {
        return { ok: false, error: "revisionTarget is invalid." };
      }
      state.ui.designRevisionTarget = normalizedRevisionTarget;
    } else if (String(payload?.revisionDesignId || "").trim()) {
      normalizedRevisionTarget = normalizeDesignRevisionTarget({
        designId: payload.revisionDesignId,
        designRevision: payload.revisionDesignRevision,
        priorDesignRevision: payload.revisionPriorDesignRevision,
        designAuthor: payload.revisionDesignAuthor,
        sections: Array.isArray(payload?.revisionSections) ? payload.revisionSections : [],
        targetIds: Array.isArray(payload?.revisionTargetIds) ? payload.revisionTargetIds : [],
        summary: payload.revisionSummary,
        designLabel: payload.revisionDesignLabel,
        requestedAt: payload.revisionRequestedAt
      });
      if (!normalizedRevisionTarget) {
        return { ok: false, error: "flat revision target is invalid." };
      }
      state.ui.designRevisionTarget = normalizedRevisionTarget;
    }
    if (payload?.forceFresh === true) {
      clearDesignerDraft(state);
      state.agentPlan = null;
      clearSequencingHandoffsForSequenceChange("automation force-fresh proposal");
      state.creative = {
        goals: "",
        inspiration: "",
        notes: "",
        references: [],
        brief: null,
        proposalBundle: null,
        intentHandoff: null
      };
      if (state.ui && typeof state.ui === "object") {
        state.ui.reviewHistorySnapshot = null;
        state.ui.selectedHistorySnapshot = null;
        state.ui.sectionSelections = ["all"];
        state.ui.metadataSelectionIds = [];
        state.ui.metadataSelectedTags = [];
      }
    }
    await onGenerate(prompt, {
      requestedRole,
      disableDesignerCloud: payload?.disableDesignerCloud === true,
      revisionTarget: normalizedRevisionTarget,
      selectedSections: Array.isArray(payload?.selectedSections) ? payload.selectedSections : [],
      selectedTargetIds: Array.isArray(payload?.selectedTargetIds) ? payload.selectedTargetIds : [],
      selectedTagNames: Array.isArray(payload?.selectedTagNames) ? payload.selectedTagNames : []
    });
    if (normalizedRevisionTarget) {
      const supersededConceptRecord = buildSupersededConceptRecordById(
        normalizedRevisionTarget.designId,
        normalizedRevisionTarget.designRevision
      );
      const revisedExecutionPlan = retagExecutionPlanForRevisionTarget(
        getExecutionPlanFromArtifacts({
          proposalBundle: state.creative?.proposalBundle || null,
          intentHandoff: state.creative?.intentHandoff || null
        }),
        normalizedRevisionTarget
      );
      if (revisedExecutionPlan) {
        if (state.creative?.proposalBundle && typeof state.creative.proposalBundle === "object") {
          const rebuiltBundle = rebuildProposalBundleFromExecutionPlan(state.creative.proposalBundle, revisedExecutionPlan);
          if (rebuiltBundle) {
            state.creative.proposalBundle = rebuiltBundle;
          }
        }
        if (state.creative?.intentHandoff && typeof state.creative.intentHandoff === "object") {
          state.creative.intentHandoff = {
            ...state.creative.intentHandoff,
            designId: normalizedRevisionTarget.designId,
            designRevision: normalizedRevisionTarget.designRevision,
            designAuthor: normalizedRevisionTarget.designAuthor,
            executionStrategy: revisedExecutionPlan
          };
          setAgentHandoff("intent_handoff_v1", state.creative.intentHandoff, "designer_dialog");
        }
        if (state.agentPlan?.handoff && typeof state.agentPlan.handoff === "object") {
          const retagCommand = (command = {}) => {
            if (String(command?.designId || "").trim() !== normalizedRevisionTarget.designId) return command;
            return {
              ...command,
              designId: normalizedRevisionTarget.designId,
              designRevision: normalizedRevisionTarget.designRevision,
              designAuthor: normalizedRevisionTarget.designAuthor,
              intent: command?.intent && typeof command.intent === "object"
                ? {
                    ...command.intent,
                    designId: normalizedRevisionTarget.designId,
                    designRevision: normalizedRevisionTarget.designRevision,
                    designAuthor: normalizedRevisionTarget.designAuthor
                  }
                : command?.intent
            };
          };
          state.agentPlan.handoff = {
            ...state.agentPlan.handoff,
            commands: Array.isArray(state.agentPlan.handoff.commands) ? state.agentPlan.handoff.commands.map(retagCommand) : [],
            metadata: {
              ...(state.agentPlan.handoff.metadata && typeof state.agentPlan.handoff.metadata === "object"
                ? state.agentPlan.handoff.metadata
                : {}),
              designRevisionTarget: normalizedRevisionTarget
            }
          };
          setAgentHandoff("plan_handoff_v1", state.agentPlan.handoff, "sequence_agent");
        }
        if (supersededConceptRecord) {
          upsertSupersededConceptRecord(supersededConceptRecord);
        }
      }
    }
    let debugReplay = null;
    if (payload?.debugReplay === true && requestedRole === "designer_dialog") {
      try {
        const analysisHandoff = getValidHandoff("analysis_handoff_v1");
        const designSceneContext = buildCurrentDesignSceneContext();
        const musicDesignContext = buildCurrentMusicDesignContext();
        const replay = executeDesignerProposalOrchestration({
          requestId: `automation-debug-${Date.now()}`,
          sequenceRevision: String(state.draftBaseRevision || state.revision || "unknown"),
          promptText: prompt,
          selectedSections: Array.isArray(payload?.selectedSections) ? payload.selectedSections : [],
          selectedTagNames: Array.isArray(payload?.selectedTagNames) ? payload.selectedTagNames : [],
          selectedTargetIds: Array.isArray(payload?.selectedTargetIds) ? payload.selectedTargetIds : [],
          goals: state.creative?.goals || "",
          inspiration: state.creative?.inspiration || "",
          notes: state.creative?.notes || "",
          references: state.creative?.references || [],
          priorBrief: state.creative?.brief || null,
          analysisHandoff,
          analysisArtifact: state.audioAnalysis?.artifact || null,
          directorProfile: state.directorProfile || null,
          designSceneContext,
          musicDesignContext,
          models: state.models || [],
          submodels: state.submodels || [],
          displayElements: state.displayElements || [],
          metadataAssignments: buildEffectiveMetadataAssignments(
            state.metadata?.assignments || [],
            state.metadata?.preferencesByTargetId || {},
            { visualHintDefinitions: state.metadata?.visualHintDefinitions || [] }
          ),
          elevatedRiskConfirmed: Boolean(state.ui.applyApprovalChecked)
        });
        debugReplay = {
          ok: replay?.ok === true,
          summary: String(replay?.summary || ""),
          sectionPlans: Array.isArray(replay?.proposalBundle?.executionPlan?.sectionPlans)
            ? replay.proposalBundle.executionPlan.sectionPlans
            : [],
          intentGoal: String(replay?.intentHandoff?.goal || ""),
          sequencingSections: Array.isArray(replay?.intentHandoff?.sequencingDesignHandoff?.sectionDirectives)
            ? replay.intentHandoff.sequencingDesignHandoff.sectionDirectives
            : []
        };
      } catch (err) {
        debugReplay = { ok: false, error: String(err?.message || err) };
      }
    }
    return {
      ok: true,
      status: state.status || null,
      activeSequence: state.activeSequence || "",
      proposedCount: Array.isArray(state.proposed) ? state.proposed.length : 0,
      hasDraftProposal: Boolean(state.flags?.hasDraftProposal),
      reviewReady: applyReadyForApprovalGate(),
      requestedRole,
      requestedRevisionTarget: normalizedRevisionTarget,
      activeRevisionTarget: normalizeDesignRevisionTarget(state.ui?.designRevisionTarget),
      debugCurrentIntentRevision: state.creative?.intentHandoff && typeof state.creative.intentHandoff === "object"
        ? {
            designId: String(state.creative.intentHandoff.designId || ""),
            designRevision: Number(state.creative.intentHandoff.designRevision || 0),
            firstSectionPlanRevision: Number(state.creative.intentHandoff.executionStrategy?.sectionPlans?.[0]?.designRevision || 0)
          }
        : null,
      lastChatMessage: Array.isArray(state.chat) && state.chat.length ? state.chat[state.chat.length - 1] : null,
      creativeIntentHandoff: isPlainObject(state.creative?.intentHandoff)
        ? {
            artifactId: String(state.creative.intentHandoff.artifactId || ""),
            goal: String(state.creative.intentHandoff.goal || "")
          }
        : null,
      debugReplay,
      intentHandoff: getValidHandoff("intent_handoff_v1") || null,
      planHandoff: getValidHandoff("plan_handoff_v1") || null
    };
  }

  async function applyAutomationCurrentProposal() {
    state.ui.applyApprovalChecked = true;
    const previousConfirmMode = state.safety?.applyConfirmMode;
    const beforeHistoryId = String(state.applyHistory?.[0]?.historyEntryId || "").trim();
    let applyOutcome = null;
    if (state.safety && typeof state.safety === "object") {
      state.safety.applyConfirmMode = "never";
    }
    try {
      applyOutcome = await onApplyAll();
    } finally {
      if (state.safety && typeof state.safety === "object") {
        state.safety.applyConfirmMode = previousConfirmMode || "large-only";
      }
    }
    const afterLatestApply = Array.isArray(state.applyHistory) && state.applyHistory.length ? state.applyHistory[0] : null;
    const afterHistoryId = String(afterLatestApply?.historyEntryId || "").trim();
    const historyAdvanced = Boolean(afterHistoryId && afterHistoryId !== beforeHistoryId);
    const historySnapshot = state.ui?.reviewHistorySnapshot && typeof state.ui.reviewHistorySnapshot === "object"
      ? state.ui.reviewHistorySnapshot
      : (state.ui?.selectedHistorySnapshot && typeof state.ui.selectedHistorySnapshot === "object"
          ? state.ui.selectedHistorySnapshot
          : null);
    return {
      ok: applyOutcome?.ok !== false,
      status: state.status || null,
      activeSequence: state.activeSequence || "",
      proposedCount: Array.isArray(state.proposed) ? state.proposed.length : 0,
      reviewReady: applyReadyForApprovalGate(),
      lastChatMessage: Array.isArray(state.chat) && state.chat.length ? state.chat[state.chat.length - 1] : null,
      applyOutcome,
      historyAdvanced,
      latestApply: afterLatestApply,
      latestApplyResult: historySnapshot?.applyResult || null,
      latestPracticalValidation: historySnapshot?.applyResult?.practicalValidation || null
    };
  }

  async function diagnoseAutomationCurrentProposal() {
    const sourceLines = filteredProposed();
    const intentHandoff = getValidHandoff("intent_handoff_v1");
    const planHandoff = getValidHandoff("plan_handoff_v1");
    const analysisHandoff = getValidHandoff("analysis_handoff_v1");
    const proposalBundle = state.creative?.proposalBundle || null;
    const executionPlan = proposalBundle?.executionPlan || null;
    const musicDesignContext = buildCurrentMusicDesignContext();
    let planSource = "generated";
    let rawPlan = [];
    let graph = null;
    const generated = buildSequenceAgentPlan({
      analysisHandoff,
      intentHandoff,
      sourceLines,
      baseRevision: state.draftBaseRevision,
      capabilityCommands: state.health.capabilityCommands || [],
      effectCatalog: state.effectCatalog,
      sequenceSettings: state.sequenceSettings,
      layoutMode: currentLayoutMode(),
      displayElements: state.displayElements,
      groupIds: Object.keys(state.sceneGraph?.groupsById || {}),
      groupsById: state.sceneGraph?.groupsById || {},
      submodelsById: state.sceneGraph?.submodelsById || {},
      timingOwnership: getSequenceTimingOwnershipRows(),
      allowTimingWrites: true
    });
    rawPlan = Array.isArray(generated?.commands) ? generated.commands : [];
    graph = validateCommandGraph(rawPlan);

    const ownedBatchPlan = buildOwnedSequencingBatchPlan(rawPlan);
    let ownedHealth = null;
    let ownedHealthError = "";
    try {
      ownedHealth = await getOwnedHealth(state.endpoint);
    } catch (err) {
      ownedHealthError = String(err?.message || err || "");
    }

    return {
      ok: true,
      endpoint: state.endpoint,
      activeSequence: state.activeSequence || "",
      status: state.status || null,
      proposedCount: Array.isArray(state.proposed) ? state.proposed.length : 0,
      planSource,
      fallbackReason: Array.isArray(planHandoff?.commands) && planHandoff.commands.length
        ? "ignoring stored plan_handoff_v1 command graph and regenerating from current proposal"
        : "plan_handoff_v1 commands unavailable",
      proposalScope: proposalBundle?.scope || null,
      executionPlanSummary: executionPlan
        ? {
            passScope: executionPlan.passScope || "",
            implementationMode: executionPlan.implementationMode || "",
            primarySections: Array.isArray(executionPlan.primarySections) ? executionPlan.primarySections : [],
            sectionPlanCount: Array.isArray(executionPlan.sectionPlans) ? executionPlan.sectionPlans.length : 0,
            effectPlacementCount: Array.isArray(executionPlan.effectPlacements) ? executionPlan.effectPlacements.length : 0
          }
        : null,
      liveMusicDesignContext: {
        sectionArc: Array.isArray(musicDesignContext?.sectionArc) ? musicDesignContext.sectionArc : [],
        cueWindowSections: Object.keys(musicDesignContext?.designCues?.cueWindowsBySection || {})
      },
      intentHandoffSummary: intentHandoff
        ? {
            goal: intentHandoff.goal || "",
            scope: intentHandoff.scope || null,
            executionStrategy: intentHandoff.executionStrategy
              ? {
                  passScope: intentHandoff.executionStrategy.passScope || "",
                  implementationMode: intentHandoff.executionStrategy.implementationMode || "",
                  primarySections: Array.isArray(intentHandoff.executionStrategy.primarySections) ? intentHandoff.executionStrategy.primarySections : [],
                  effectPlacementCount: Array.isArray(intentHandoff.executionStrategy.effectPlacements) ? intentHandoff.executionStrategy.effectPlacements.length : 0
                }
              : null
          }
        : null,
      handoffCommandCount: Array.isArray(planHandoff?.commands) ? planHandoff.commands.length : 0,
      rawPlanCount: rawPlan.length,
      rawPlan,
      graph,
      ownedBatchCompressible: Boolean(ownedBatchPlan),
      ownedBatchPlan,
      ownedHealth,
      ownedHealthError
    };
  }

  function summarizeComparativeValidationPageStates(pageStates = getPageStates()) {
    const designConceptRows = Array.isArray(pageStates?.design?.data?.executionPlan?.conceptRows)
      ? pageStates.design.data.executionPlan.conceptRows
      : [];
    const reviewRows = Array.isArray(pageStates?.review?.data?.rows)
      ? pageStates.review.data.rows
      : [];
    const sequenceRows = Array.isArray(pageStates?.sequence?.data?.rows)
      ? pageStates.sequence.data.rows
      : [];
    return {
      project: {
        data: {
          sequenceContext: {
            activeSequence: state.activeSequence || ""
          }
        }
      },
      design: {
        data: {
          executionPlan: {
            conceptRows: designConceptRows.map((row) => ({
              designLabel: String(row?.designLabel || ""),
              anchor: String(row?.anchor || ""),
              focus: Array.isArray(row?.focus) ? row.focus.map((value) => String(value || "").trim()).filter(Boolean) : [],
              effectFamilies: Array.isArray(row?.effectFamilies)
                ? row.effectFamilies.map((value) => String(value || "").trim()).filter(Boolean)
                : []
            }))
          }
        }
      },
      review: {
        data: {
          rows: reviewRows.map((row) => ({
            designLabel: String(row?.designLabel || "")
          }))
        }
      },
      sequence: {
        data: {
          rows: sequenceRows.map((row) => ({
            designLabel: String(row?.designLabel || ""),
            target: String(row?.target || ""),
            summary: String(row?.summary || ""),
            effects: Number(row?.effects || 0) || 0
          }))
        }
      }
    };
  }

  function summarizeComparativeValidationRawPlan(rawPlan = []) {
    return Array.isArray(rawPlan)
      ? rawPlan
          .filter((row) => String(row?.cmd || "").trim() === "effects.create")
          .map((row) => ({
            cmd: "effects.create",
            params: {
              effectName: String(row?.params?.effectName || "")
            },
            anchor: {
              trackName: String(row?.anchor?.trackName || ""),
              basis: String(row?.anchor?.basis || "")
            }
          }))
      : [];
  }

  function summarizeComparativeValidationSectionPlans(sectionPlans = []) {
    return Array.isArray(sectionPlans)
      ? sectionPlans.map((row) => ({
          designId: String(row?.designId || ""),
          designRevision: Number(row?.designRevision || 0) || 0,
          section: String(row?.section || ""),
          targetIds: Array.isArray(row?.targetIds)
            ? row.targetIds.map((value) => String(value || "").trim()).filter(Boolean)
            : [],
          effectHints: Array.isArray(row?.effectHints)
            ? row.effectHints.map((value) => String(value || "").trim()).filter(Boolean)
            : []
        }))
      : [];
  }

  async function getAutomationComparativeValidationSnapshot() {
    const sourceLines = filteredProposed();
    const intentHandoff = getValidHandoff("intent_handoff_v1");
    const planHandoff = getValidHandoff("plan_handoff_v1");
    const analysisHandoff = getValidHandoff("analysis_handoff_v1");
    const proposalBundle = state.creative?.proposalBundle || null;
    const executionPlan = proposalBundle?.executionPlan || null;
    let planSource = "generated";
    let rawPlan = [];
    const generated = buildSequenceAgentPlan({
      analysisHandoff,
      intentHandoff,
      sourceLines,
      baseRevision: state.draftBaseRevision,
      capabilityCommands: state.health.capabilityCommands || [],
      effectCatalog: state.effectCatalog,
      sequenceSettings: state.sequenceSettings,
      layoutMode: currentLayoutMode(),
      displayElements: state.displayElements,
      groupIds: Object.keys(state.sceneGraph?.groupsById || {}),
      groupsById: state.sceneGraph?.groupsById || {},
      submodelsById: state.sceneGraph?.submodelsById || {},
      timingOwnership: getSequenceTimingOwnershipRows(),
      allowTimingWrites: true
    });
    rawPlan = Array.isArray(generated?.commands) ? generated.commands : [];

    return {
      ok: true,
      activeSequence: state.activeSequence || "",
      planSource,
      fallbackReason: Array.isArray(planHandoff?.commands) && planHandoff.commands.length
        ? "ignoring stored plan_handoff_v1 command graph and regenerating from current proposal"
        : "plan_handoff_v1 commands unavailable",
      proposalScope: proposalBundle?.scope || null,
      executionPlanSummary: executionPlan
        ? {
            passScope: executionPlan.passScope || "",
            implementationMode: executionPlan.implementationMode || "",
            primarySections: Array.isArray(executionPlan.primarySections) ? executionPlan.primarySections : [],
            sectionPlanCount: Array.isArray(executionPlan.sectionPlans) ? executionPlan.sectionPlans.length : 0,
            effectPlacementCount: Array.isArray(executionPlan.effectPlacements) ? executionPlan.effectPlacements.length : 0
          }
        : null,
      executionPlanSections: summarizeComparativeValidationSectionPlans(executionPlan?.sectionPlans),
      intentHandoffSummary: intentHandoff
        ? {
            goal: intentHandoff.goal || "",
            scope: intentHandoff.scope || null,
            executionStrategy: intentHandoff.executionStrategy
              ? {
                  passScope: intentHandoff.executionStrategy.passScope || "",
                  implementationMode: intentHandoff.executionStrategy.implementationMode || "",
                  primarySections: Array.isArray(intentHandoff.executionStrategy.primarySections) ? intentHandoff.executionStrategy.primarySections : [],
                  effectPlacementCount: Array.isArray(intentHandoff.executionStrategy.effectPlacements) ? intentHandoff.executionStrategy.effectPlacements.length : 0
                }
              : null
          }
        : null,
      intentSectionPlans: summarizeComparativeValidationSectionPlans(intentHandoff?.executionStrategy?.sectionPlans),
      rawPlan: summarizeComparativeValidationRawPlan(rawPlan),
      pageStates: summarizeComparativeValidationPageStates()
    };
  }

  async function refreshAutomationFromXLights() {
    await onRefresh();
    return {
      ok: true,
      status: state.status || null,
      activeSequence: state.activeSequence || "",
      sequencePathInput: state.sequencePathInput || "",
      proposedCount: Array.isArray(state.proposed) ? state.proposed.length : 0
    };
  }

  async function resetAutomationState(payload = {}) {
    clearDesignerDraft(state);
    state.agentPlan = null;
    clearSequencingHandoffsForSequenceChange("automation reset state");
    clearDesignRevisionTarget();
    state.creative = {
      goals: "",
      inspiration: "",
      notes: "",
      references: [],
      brief: null,
      proposalBundle: null,
      intentHandoff: null
    };
    if (state.ui && typeof state.ui === "object") {
      state.ui.reviewHistorySnapshot = null;
      state.ui.selectedHistorySnapshot = null;
      state.ui.sectionSelections = ["all"];
      state.ui.metadataSelectionIds = [];
      state.ui.metadataSelectedTags = [];
      state.ui.applyApprovalChecked = false;
      state.ui.designRevisionTarget = null;
    }
    setStatus({ level: "info", text: "Automation state reset." });
    const persistState = payload?.persist === true;
    const rerender = payload?.render === true;
    if (persistState) {
      persist();
    }
    if (rerender) {
      render();
    }
    return {
      ok: true,
      status: state.status || null,
      activeSequence: state.activeSequence || "",
      sequencePathInput: state.sequencePathInput || "",
      proposedCount: Array.isArray(state.proposed) ? state.proposed.length : 0
    };
  }

  async function analyzeAutomationAudio(payload = {}) {
    await onAnalyzeAudio({
      userPrompt: String(payload?.prompt || "").trim(),
      analysisProfile: payload?.analysisProfile && typeof payload.analysisProfile === "object"
        ? payload.analysisProfile
        : null,
      forceFresh: payload?.forceFresh === true
    });
    return {
      ok: true,
      status: state.status || null,
      activeSequence: state.activeSequence || "",
      analysisReady: Boolean(getValidHandoff("analysis_handoff_v1")),
      lastChatMessage: Array.isArray(state.chat) && state.chat.length ? state.chat[state.chat.length - 1] : null
    };
  }

  async function seedAutomationTimingTracksFromAnalysis(payload = {}) {
    if (typeof onSeedTimingTracksFromAnalysis !== "function") {
      return { ok: false, error: "timing track seeding unavailable." };
    }
    return await onSeedTimingTracksFromAnalysis(payload);
  }

  function defineAutomationVisualHint(payload = {}) {
    const hintName = String(payload?.name || payload?.hintName || "").trim();
    if (!hintName) {
      return { ok: false, error: "name is required." };
    }
    if (typeof definePersistedVisualHint !== "function") {
      return { ok: false, error: "visual hint definition runtime unavailable." };
    }

    const record = definePersistedVisualHint(hintName, {
      description: payload?.description,
      semanticClass: payload?.semanticClass,
      behavioralIntent: payload?.behavioralIntent,
      behavioralTags: Array.isArray(payload?.behavioralTags) ? payload.behavioralTags : [],
      definedBy: payload?.definedBy || "agent",
      source: payload?.source || "managed",
      learnedFrom: payload?.learnedFrom || "chat_dialog",
      timestamp: payload?.timestamp
    });
    persist();
    render();
    return {
      ok: true,
      hint: record
    };
  }

  async function openAutomationSequence(payload = {}) {
    const targetPath = String(payload?.sequencePath || "").trim();
    if (!targetPath) {
      return { ok: false, error: "sequencePath is required." };
    }
    await onOpenExistingSequence(targetPath);
    return {
      ok: true,
      status: state.status || null,
      activeSequence: state.activeSequence || "",
      sequencePathInput: state.sequencePathInput || ""
    };
  }

  function getAutomationAgentRuntimeSnapshot() {
    const musicDesignContext = buildCurrentMusicDesignContext();
    const cueWindowSections = isPlainObject(musicDesignContext?.designCues?.cueWindowsBySection)
      ? musicDesignContext.designCues.cueWindowsBySection
      : {};
    const availableCueTypes = Array.from(new Set(
      Object.values(cueWindowSections)
        .flatMap((row) => Object.keys(isPlainObject(row) ? row : {}))
        .map((value) => String(value || "").trim().toLowerCase())
        .filter(Boolean)
    ));
    const summarizeExecutionStrategy = (payload = null) => {
      const strategy = isPlainObject(payload?.executionStrategy) ? payload.executionStrategy : null;
      if (!strategy) return null;
      const sectionPlans = Array.isArray(strategy.sectionPlans) ? strategy.sectionPlans : [];
      const effectPlacements = Array.isArray(strategy.effectPlacements) ? strategy.effectPlacements : [];
      const distinctEffects = Array.from(new Set(
        effectPlacements.map((row) => String(row?.effectName || "").trim()).filter(Boolean)
      ));
      return {
        passScope: String(strategy.passScope || "").trim(),
        sectionPlanCount: sectionPlans.length,
        effectPlacementCount: effectPlacements.length,
        distinctEffects
      };
    };

    const summarizeHandoff = (contract = "") => {
      const row = agentRuntime.handoffs?.[String(contract || "").trim()] || null;
      return row ? {
        valid: Boolean(row.valid),
        producer: String(row.producer || ""),
        errors: Array.isArray(row.errors) ? row.errors : [],
        at: String(row.at || ""),
        context: isPlainObject(row.context) ? row.context : null,
        payloadSummary: row.valid && isPlainObject(row.payload)
          ? {
              artifactId: String(row.payload.artifactId || ""),
              goal: String(row.payload.goal || row.payload.summary || ""),
              sections: Array.isArray(row.payload?.scope?.sections)
                ? row.payload.scope.sections
                : (Array.isArray(row.payload?.structure?.sections) ? row.payload.structure.sections.length : 0),
              executionStrategy: summarizeExecutionStrategy(row.payload)
            }
          : null
      } : null;
    };

    return {
      ok: true,
      status: state.status || null,
      activeSequence: state.activeSequence || "",
      sequencePathInput: state.sequencePathInput || "",
      showFolder: state.showFolder || "",
      audioPathInput: state.audioPathInput || "",
      lastAnalysisPrompt: String(state.ui?.lastAnalysisPrompt || ""),
      proposedCount: Array.isArray(state.proposed) ? state.proposed.length : 0,
      agentThinking: Boolean(state.ui?.agentThinking),
      activeRole: String(agentRuntime.activeRole || ""),
      flags: {
        xlightsConnected: Boolean(state.flags?.xlightsConnected),
        activeSequenceLoaded: Boolean(state.flags?.activeSequenceLoaded),
        planOnlyMode: Boolean(state.flags?.planOnlyMode),
        hasDraftProposal: Boolean(state.flags?.hasDraftProposal),
        proposalStale: Boolean(state.flags?.proposalStale)
      },
      musicDesignContextSummary: {
        sectionArc: Array.isArray(musicDesignContext?.sectionArc) ? musicDesignContext.sectionArc : [],
        cueWindowSections: Object.keys(cueWindowSections),
        availableCueTypes
      },
      creativeIntentHandoff: isPlainObject(state.creative?.intentHandoff)
        ? {
            artifactId: String(state.creative.intentHandoff.artifactId || ""),
            goal: String(state.creative.intentHandoff.goal || "")
          }
        : null,
      handoffs: {
        analysis_handoff_v1: summarizeHandoff("analysis_handoff_v1"),
        intent_handoff_v1: summarizeHandoff("intent_handoff_v1"),
        plan_handoff_v1: summarizeHandoff("plan_handoff_v1")
      }
    };
  }

  function getAutomationPageStatesSnapshot() {
    const pageStates = getPageStates();
    return {
      ok: true,
      status: state.status || null,
      activeSequence: state.activeSequence || "",
      review: pageStates?.review || null,
      design: pageStates?.design || null,
      sequence: pageStates?.sequence || null
    };
  }

  function getAutomationSequencerValidationSnapshot() {
    const latestApply = Array.isArray(state.applyHistory) && state.applyHistory.length ? state.applyHistory[0] : null;
    const historySnapshot = state.ui?.reviewHistorySnapshot && typeof state.ui.reviewHistorySnapshot === "object"
      ? state.ui.reviewHistorySnapshot
      : (state.ui?.selectedHistorySnapshot && typeof state.ui.selectedHistorySnapshot === "object"
          ? state.ui.selectedHistorySnapshot
          : null);
    return {
      ok: true,
      status: state.status || null,
      activeSequence: state.activeSequence || "",
      sequencePathInput: state.sequencePathInput || "",
      latestApply,
      latestPracticalValidation: historySnapshot?.applyResult?.practicalValidation || null,
      latestApplyResult: historySnapshot?.applyResult || null,
      latestPlanHandoff: historySnapshot?.planHandoff || getValidHandoff("plan_handoff_v1"),
      latestIntentHandoff: historySnapshot?.intentHandoff || getValidHandoff("intent_handoff_v1"),
      pageStates: getPageStates()
    };
  }

  function getAutomationVisualHintDefinitionsSnapshot() {
    const records = mergeVisualHintDefinitions(state.metadata?.visualHintDefinitions || []);
    const counts = {
      total: records.length,
      systemDefined: records.filter((row) => String(row?.source || "").trim().toLowerCase() === "system").length,
      userPending: records.filter((row) => String(row?.status || "").trim().toLowerCase() === "pending_definition").length,
      managedDefined: records.filter((row) => {
        const source = String(row?.source || "").trim().toLowerCase();
        const status = String(row?.status || "").trim().toLowerCase();
        return source !== "system" && status === "defined";
      }).length
    };
    return {
      ok: true,
      status: state.status || null,
      counts,
      records
    };
  }

  function getAutomationReadyState() {
    return {
      ok: true,
      ready: true,
      activeSequence: state.activeSequence || "",
      status: state.status || null
    };
  }

  function exposeRuntimeValidationHooks() {
    window.xLightsDesignerRuntime = {
      isAutomationReady: getAutomationReadyState,
      dispatchPrompt: dispatchAutomationPrompt,
      generateProposal: generateAutomationProposal,
      resetAutomationState,
      openSequence: openAutomationSequence,
      refreshFromXLights: refreshAutomationFromXLights,
      analyzeAudio: analyzeAutomationAudio,
      seedTimingTracksFromAnalysis: seedAutomationTimingTracksFromAnalysis,
      defineVisualHint: defineAutomationVisualHint,
      applyCurrentProposal: applyAutomationCurrentProposal,
      diagnoseCurrentProposal: diagnoseAutomationCurrentProposal,
      getComparativeValidationSnapshot: getAutomationComparativeValidationSnapshot,
      getSequencerValidationSnapshot: getAutomationSequencerValidationSnapshot,
      getVisualHintDefinitionsSnapshot: getAutomationVisualHintDefinitionsSnapshot,
      getAgentRuntimeSnapshot: getAutomationAgentRuntimeSnapshot,
      getPageStatesSnapshot: getAutomationPageStatesSnapshot,
      runDirectSequenceValidation: runCurrentDirectSequenceValidation,
      getDirectSequenceValidationSnapshot: getCurrentDirectSequenceValidationSnapshot
    };
  }

  return {
    dispatchAutomationPrompt,
    generateAutomationProposal,
    resetAutomationState,
    applyAutomationCurrentProposal,
    diagnoseAutomationCurrentProposal,
    getAutomationComparativeValidationSnapshot,
    refreshAutomationFromXLights,
    analyzeAutomationAudio,
    seedAutomationTimingTracksFromAnalysis,
    defineAutomationVisualHint,
    openAutomationSequence,
    getAutomationAgentRuntimeSnapshot,
    getAutomationPageStatesSnapshot,
    getAutomationSequencerValidationSnapshot,
    getAutomationVisualHintDefinitionsSnapshot,
    exposeRuntimeValidationHooks
  };
}
