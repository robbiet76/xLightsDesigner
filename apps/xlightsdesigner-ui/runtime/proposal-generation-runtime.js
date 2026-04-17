function str(value = "") {
  return String(value || "").trim();
}

export function createProposalGenerationRuntime(deps = {}) {
  const {
    state,
    setStatus = () => {},
    setStatusWithDiagnostics = () => {},
    render = () => {},
    persist = () => {},
    saveCurrentProjectSnapshot = () => {},
    pushDiagnostic = () => {},
    addStructuredChatMessage = () => {},
    addChatMessage = () => {},
    getTeamChatSpeakerLabel = () => "",
    getDesktopBridge = () => null,
    getOpenSequence = async () => ({}),
    isSequenceAllowedInActiveShowFolder = () => true,
    clearIgnoredExternalSequenceNote = () => {},
    noteIgnoredExternalSequence = () => {},
    applyOpenSequenceState = () => {},
    buildSequenceSession = () => ({ canGenerateSequence: false, planOnlyMode: false, xlightsConnected: false }),
    explainSequenceSessionBlockers = () => ({ message: "" }),
    getBlockingTimingReviewRows = () => [],
    syncLatestSequenceRevision = async () => ({ ok: true }),
    setAgentActiveRole = () => {},
    beginOrchestrationRun = () => ({ id: `orch-${Date.now()}` }),
    markOrchestrationStage = () => {},
    endOrchestrationRun = () => {},
    invalidateApplyApproval = () => {},
    latestUserIntentText = () => "",
    normalizeDesignRevisionTarget = (value) => value,
    buildRevisionPromptText = (text) => text,
    ensureCurrentAnalysisHandoff = async () => null,
    getValidHandoff = () => null,
    buildCurrentDesignSceneContext = () => null,
    buildCurrentMusicDesignContext = () => null,
    inferPromptSectionSelection = () => [],
    hasAllSectionsSelected = () => false,
    getSectionChoiceList = () => [],
    getSelectedSections = () => [],
    shouldCarryDesignerSelectionContext = () => false,
    buildRecentChatHistory = () => [],
    buildDesignerCloudConversationContext = () => ({}),
    isPlainObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value),
    executeDirectSequenceRequestOrchestration = () => ({ ok: false }),
    executeDesignerProposalOrchestration = () => ({ ok: false }),
    buildEffectiveMetadataAssignments = () => [],
    collectCurrentDesignIds = () => [],
    buildSupersededConceptRecordById = () => null,
    applyRevisionTargetToOrchestration = (value) => value,
    buildDesignDisplay = () => "",
    ensureRevisionTargetAppliedToOrchestration = (value) => value,
    applyDesignerDraftSuccessState = () => {},
    applyDesignerProposalSuccessToState = () => {},
    currentSequencePathForSidecar = () => "",
    applyRevisionTargetToCurrentDesignerState = () => {},
    hydrateIntentHandoffExecutionStrategy = (intent) => intent,
    retagExecutionPlanForRevisionTarget = (plan) => plan,
    rebuildProposalBundleFromExecutionPlan = (bundle) => bundle,
    setAgentHandoff = () => ({ ok: false, errors: [] }),
    buildDesignerExecutionSeedLines = () => [],
    shouldUseExecutionStrategySeedLines = () => false,
    buildSequenceAgentInput = () => ({}),
    buildPriorPassMemory = () => null,
    currentLayoutMode = () => "2d",
    getSequenceTimingOwnershipRows = () => [],
    getManualLockedXdTracks = () => [],
    validateSequenceAgentContractGate = () => ({ ok: true, report: {} }),
    pushSequenceAgentContractDiagnostic = () => {},
    buildSequenceAgentPlan = () => ({}),
    emitSequenceAgentStageTelemetry = () => {},
    estimateImpactCount = () => 0,
    buildArtifactId = () => "",
    validateCommandGraph = () => ({ ok: true, nodeCount: 0, errors: [] }),
    mergeCreativeBriefIntoProposal = (lines) => lines,
    upsertSupersededConceptRecord = () => {},
    buildDesignerGuidedQuestionMessage = () => "",
    buildDesignerCompletionMessage = () => "",
    buildChatArtifactCard = () => ({}),
    clearDesignRevisionTarget = () => {},
    normalizeMetadataSelectionIds = (values) => values,
    normalizeMetadataSelectedTags = (values) => values
  } = deps;

  async function generateProposal(intentOverride = "", options = {}) {
    const requestedRole = str(options?.requestedRole);
    const disableDesignerCloud = options?.disableDesignerCloud === true;
    const proposalRole = ["sequence_agent", "designer_dialog"].includes(requestedRole)
      ? requestedRole
      : "designer_dialog";
    const hasExplicitSelectedSections = Object.prototype.hasOwnProperty.call(options || {}, "selectedSections");
    const hasExplicitSelectedTargetIds = Object.prototype.hasOwnProperty.call(options || {}, "selectedTargetIds");
    const hasExplicitSelectedTagNames = Object.prototype.hasOwnProperty.call(options || {}, "selectedTagNames");
    const explicitSelectedSections = Array.isArray(options?.selectedSections)
      ? options.selectedSections.map((row) => str(row)).filter(Boolean)
      : [];
    const explicitSelectedTargetIds = Array.isArray(options?.selectedTargetIds)
      ? options.selectedTargetIds.map((row) => str(row)).filter(Boolean)
      : [];
    const explicitSelectedTagNames = Array.isArray(options?.selectedTagNames)
      ? options.selectedTagNames.map((row) => str(row)).filter(Boolean)
      : [];
    const directSequenceMode = proposalRole === "sequence_agent";
    const revisionTarget = normalizeDesignRevisionTarget(options?.revisionTarget || state.ui.designRevisionTarget);
    const postGenerateFailureMessage = (text = "") => {
      const message = str(text);
      if (!message) return;
      addStructuredChatMessage("agent", message, {
        roleId: proposalRole,
        displayName: getTeamChatSpeakerLabel(proposalRole),
        handledBy: proposalRole
      });
    };
    const bridge = getDesktopBridge();
    let sequenceSession = buildSequenceSession({ state });
    if (!sequenceSession.canGenerateSequence && !sequenceSession.planOnlyMode && sequenceSession.xlightsConnected) {
      try {
        const open = await getOpenSequence(state.endpoint);
        const seq = open?.data?.sequence;
        if (open?.data?.isOpen && seq && isSequenceAllowedInActiveShowFolder(seq)) {
          clearIgnoredExternalSequenceNote();
          applyOpenSequenceState(seq);
          state.flags.activeSequenceLoaded = true;
          state.health.sequenceOpen = true;
        } else if (open?.data?.isOpen && seq) {
          noteIgnoredExternalSequence(seq, "xLights");
        }
        sequenceSession = buildSequenceSession({
          state,
          liveSequencePayload: open?.data?.isOpen ? seq : null
        });
      } catch {
        // best effort
      }
    }
    const sessionBlockers = explainSequenceSessionBlockers(sequenceSession);
    if (!sequenceSession.canGenerateSequence) {
      setStatus("action-required", sessionBlockers.message || "Open a sequence or enter plan-only mode.");
      render();
      return;
    }
    if (proposalRole === "sequence_agent") {
      const blockingTimingReviewRows = getBlockingTimingReviewRows();
      if (blockingTimingReviewRows.length) {
        const trackList = blockingTimingReviewRows.map((row) => str(row.trackName)).filter(Boolean).join(", ");
        const message = `Sequence proposal blocked: accept timing review for ${trackList} before generating sequencing changes.`;
        pushDiagnostic("warning", message);
        addStructuredChatMessage("agent", message, {
          roleId: "sequence_agent",
          displayName: getTeamChatSpeakerLabel("sequence_agent"),
          handledBy: "sequence_agent"
        });
        setStatusWithDiagnostics("warning", message);
        render();
        return;
      }
    }
    if (state.flags.xlightsConnected && !state.flags.planOnlyMode) {
      const revisionState = await syncLatestSequenceRevision({
        onStaleMessage: "Detected newer xLights sequence revision. Regenerating against latest sequence state.",
        onUnknownMessage: "Unable to confirm current xLights revision. Continuing with a draft against the current loaded state."
      });
      if (!revisionState.ok) {
        pushDiagnostic("warning", "Proceeding with proposal generation despite revision sync failure.", str(revisionState.error || "revision sync failed"));
      }
    }
    try {
      setAgentActiveRole(proposalRole);
      const orchestrationRun = beginOrchestrationRun({ trigger: "generate", role: proposalRole });
      state.ui.agentThinking = true;
      addStructuredChatMessage(
        "agent",
        proposalRole === "sequence_agent"
          ? "Working on an updated sequencing draft from your current request..."
          : "Working on updated proposal from current chat intent...",
        {
          roleId: proposalRole,
          displayName: getTeamChatSpeakerLabel(proposalRole),
          handledBy: proposalRole
        }
      );
      state.flags.hasDraftProposal = true;
      state.flags.proposalStale = false;
      state.draftBaseRevision = state.revision;
      invalidateApplyApproval();
      const rawIntentText = str(intentOverride) || latestUserIntentText();
      const intentText = buildRevisionPromptText(rawIntentText, revisionTarget);
      const analysisHandoff = directSequenceMode
        ? await ensureCurrentAnalysisHandoff({ silent: true })
        : getValidHandoff("analysis_handoff_v1");
      const designSceneContext = buildCurrentDesignSceneContext();
      const musicDesignContext = buildCurrentMusicDesignContext();
      const inferredPromptSections = inferPromptSectionSelection(intentText, musicDesignContext);
      const usingAll = hasAllSectionsSelected();
      const selected = hasExplicitSelectedSections
        ? explicitSelectedSections
        : explicitSelectedSections.length
        ? explicitSelectedSections
        : revisionTarget?.sections?.length
        ? revisionTarget.sections
        : (inferredPromptSections.length
            ? inferredPromptSections
            : (usingAll ? getSectionChoiceList() : getSelectedSections().filter((s) => s !== "all")));
      const includeDesignerSelection = shouldCarryDesignerSelectionContext(intentText);
      const designerSelectedTags = hasExplicitSelectedTagNames
        ? explicitSelectedTagNames
        : explicitSelectedTagNames.length
        ? explicitSelectedTagNames
        : (includeDesignerSelection ? (state.ui.metadataSelectedTags || []) : []);
      const designerSelectedTargetIds = hasExplicitSelectedTargetIds
        ? explicitSelectedTargetIds
        : explicitSelectedTargetIds.length
        ? explicitSelectedTargetIds
        : revisionTarget?.targetIds?.length
        ? revisionTarget.targetIds
        : (includeDesignerSelection ? (state.ui.metadataSelectionIds || []) : []);
      const directSelectedTargetIds = hasExplicitSelectedTargetIds
        ? explicitSelectedTargetIds
        : explicitSelectedTargetIds.length
        ? explicitSelectedTargetIds
        : revisionTarget?.targetIds?.length
        ? revisionTarget.targetIds
        : (state.ui.metadataSelectionIds || []);
      let designerCloudResponse = null;
      if (!directSequenceMode && !disableDesignerCloud && bridge && typeof bridge.runDesignerConversation === "function") {
        const cloud = await bridge.runDesignerConversation({
          userMessage: intentText,
          messages: buildRecentChatHistory(),
          context: buildDesignerCloudConversationContext({
            intentText,
            selectedSections: selected,
            analysisHandoff,
            designSceneContext,
            musicDesignContext
          })
        });
        if (cloud?.ok && isPlainObject(cloud?.designerCloudResponse)) {
          designerCloudResponse = cloud.designerCloudResponse;
        } else if (cloud?.error) {
          pushDiagnostic("warning", "Designer cloud response unavailable. Falling back to local designer runtime.", str(cloud.error));
        }
      }
      const proposalOrchestration = directSequenceMode
        ? executeDirectSequenceRequestOrchestration({
            requestId: `${orchestrationRun.id}-direct-sequence`,
            sequenceRevision: str(state.draftBaseRevision || state.revision || "unknown"),
            promptText: intentText,
            selectedSections: selected,
            selectedTagNames: state.ui.metadataSelectedTags || [],
            selectedTargetIds: directSelectedTargetIds,
            analysisHandoff,
            models: state.models || [],
            submodels: state.submodels || [],
            displayElements: state.displayElements || [],
            effectCatalog: state.effectCatalog,
            metadataAssignments: buildEffectiveMetadataAssignments(),
            existingDesignIds: collectCurrentDesignIds(),
            elevatedRiskConfirmed: Boolean(state.ui.applyApprovalChecked)
          })
        : executeDesignerProposalOrchestration({
            requestId: `${orchestrationRun.id}-designer`,
            sequenceRevision: str(state.draftBaseRevision || state.revision || "unknown"),
            promptText: intentText,
            selectedSections: selected,
            selectedTagNames: designerSelectedTags,
            selectedTargetIds: designerSelectedTargetIds,
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
            cloudResponse: designerCloudResponse,
            models: state.models || [],
            submodels: state.submodels || [],
            displayElements: state.displayElements || [],
            metadataAssignments: buildEffectiveMetadataAssignments(),
            elevatedRiskConfirmed: Boolean(state.ui.applyApprovalChecked)
          });
      if (!proposalOrchestration.ok) {
        if (directSequenceMode) {
          const debugContext = {
            intentText,
            explicitSelectedSections,
            selected,
            analysisAvailable: Boolean(analysisHandoff),
            analysisSections: Array.isArray(analysisHandoff?.structure?.sections)
              ? analysisHandoff.structure.sections.map((row) => String(row?.label || row?.name || row || "").trim()).filter(Boolean)
              : [],
            warnings: Array.isArray(proposalOrchestration.warnings) ? proposalOrchestration.warnings : []
          };
          pushDiagnostic("warning", "Direct sequence debug context", JSON.stringify(debugContext, null, 2));
        }
        markOrchestrationStage(orchestrationRun, directSequenceMode ? "direct_sequence_request" : "designer_dialog", "error", proposalOrchestration.summary || (directSequenceMode ? "direct sequence flow failed" : "designer flow failed"));
        endOrchestrationRun(orchestrationRun, { status: "failed", summary: directSequenceMode ? "direct sequence flow failed" : "designer flow failed" });
        if (typeof deps.clearDesignerDraft === "function") deps.clearDesignerDraft(state);
        state.agentPlan = null;
        state.creative = state.creative || {};
        state.creative.intentHandoff = null;
        if (typeof deps.clearAgentHandoff === "function") {
          deps.clearAgentHandoff("intent_handoff_v1", "proposal generation blocked", { pushLog: false });
          deps.clearAgentHandoff("plan_handoff_v1", "proposal generation blocked", { pushLog: false });
        }
        state.ui.agentThinking = false;
        setStatusWithDiagnostics("warning", directSequenceMode ? "Direct sequence proposal generation blocked." : "Designer proposal generation blocked.", Array.isArray(proposalOrchestration.warnings) ? proposalOrchestration.warnings.join("\n") : "");
        postGenerateFailureMessage(
          directSequenceMode
            ? "I couldn't turn that request into a sequencing draft yet. Review the warning state and try narrowing the target, section, or effect."
            : "I couldn't turn that request into a design draft yet. Review the warning state and try refining the request."
        );
        persist();
        render();
        return;
      }
      const supersededConceptRecord = revisionTarget ? buildSupersededConceptRecordById(revisionTarget.designId, revisionTarget.designRevision) : null;
      const resolvedProposalOrchestration = revisionTarget ? applyRevisionTargetToOrchestration(proposalOrchestration, revisionTarget) : proposalOrchestration;
      if (revisionTarget && resolvedProposalOrchestration === proposalOrchestration) {
        markOrchestrationStage(orchestrationRun, "concept_revision_merge", "error", "unable to merge revised concept into current draft");
        endOrchestrationRun(orchestrationRun, { status: "failed", summary: "concept revision merge failed" });
        state.ui.agentThinking = false;
        setStatusWithDiagnostics("warning", `Revision blocked: could not merge ${buildDesignDisplay(revisionTarget.designId, revisionTarget.priorDesignRevision)} into the current draft.`);
        persist();
        render();
        return;
      }
      const normalizedProposalOrchestration = revisionTarget ? ensureRevisionTargetAppliedToOrchestration(resolvedProposalOrchestration, revisionTarget) : resolvedProposalOrchestration;
      if (directSequenceMode) {
        applyDesignerDraftSuccessState(state, {
          proposalBundle: normalizedProposalOrchestration.proposalBundle || null,
          proposalLines: Array.isArray(normalizedProposalOrchestration.proposalLines) ? normalizedProposalOrchestration.proposalLines : [],
          sequencePath: currentSequencePathForSidecar()
        });
      } else {
        applyDesignerProposalSuccessToState(state, normalizedProposalOrchestration);
      }
      if (revisionTarget) {
        applyRevisionTargetToCurrentDesignerState(revisionTarget);
      }
      markOrchestrationStage(orchestrationRun, "intent_normalization", "ok", directSequenceMode ? "direct technical sequencing request normalized into canonical intent handoff" : "designer runtime built brief + proposal");
      let intentHandoff = hydrateIntentHandoffExecutionStrategy(
        normalizedProposalOrchestration.intentHandoff,
        normalizedProposalOrchestration.proposalBundle
      );
      if (revisionTarget && isPlainObject(intentHandoff)) {
        const normalizedTarget = normalizeDesignRevisionTarget(revisionTarget);
        const revisedExecutionStrategy = retagExecutionPlanForRevisionTarget(intentHandoff.executionStrategy, normalizedTarget);
        intentHandoff = {
          ...intentHandoff,
          designId: normalizedTarget.designId,
          designRevision: normalizedTarget.designRevision,
          designAuthor: normalizedTarget.designAuthor,
          executionStrategy: revisedExecutionStrategy
        };
        if (state.creative?.proposalBundle && typeof state.creative.proposalBundle === "object" && revisedExecutionStrategy) {
          const rebuiltBundle = rebuildProposalBundleFromExecutionPlan(state.creative.proposalBundle, revisedExecutionStrategy);
          if (rebuiltBundle) {
            state.creative.proposalBundle = rebuiltBundle;
          }
        }
      }
      state.creative = state.creative || {};
      state.creative.intentHandoff = isPlainObject(intentHandoff) ? structuredClone(intentHandoff) : null;
      const intentSet = setAgentHandoff("intent_handoff_v1", intentHandoff, directSequenceMode ? "app_assistant" : "designer_dialog");
      if (!intentSet.ok) {
        markOrchestrationStage(orchestrationRun, "intent_handoff", "error", intentSet.errors.join("; "));
        endOrchestrationRun(orchestrationRun, { status: "failed", summary: "intent handoff invalid" });
        state.ui.agentThinking = false;
        setStatusWithDiagnostics("warning", "Intent handoff invalid. Proposal generation blocked.", intentSet.errors.join("\n"));
        postGenerateFailureMessage(
          directSequenceMode
            ? "I hit an intent-handoff problem while building the sequencing draft. Review the warning state and try again."
            : "I hit an intent-handoff problem while building the design draft. Review the warning state and try again."
        );
        persist();
        render();
        return;
      }
      setAgentActiveRole("sequence_agent");
      markOrchestrationStage(orchestrationRun, "intent_handoff", "ok", "intent_handoff_v1 ready");
      const guidedQuestions = normalizedProposalOrchestration.guidedQuestions;
      const designerExecutionSeedLines = buildDesignerExecutionSeedLines(normalizedProposalOrchestration);
      const proposalSeedLines = designerExecutionSeedLines.length
        ? designerExecutionSeedLines
        : (shouldUseExecutionStrategySeedLines({ directSequenceMode, proposalOrchestration: normalizedProposalOrchestration })
            ? []
            : normalizedProposalOrchestration.proposalLines);
      const priorPassMemory = buildPriorPassMemory({
        historySnapshot: state.ui?.reviewHistorySnapshot || state.ui?.selectedHistorySnapshot || null
      });
      const sequenceAgentInput = buildSequenceAgentInput({
        requestId: `${orchestrationRun.id}-generate`,
        endpoint: state.endpoint,
        sequenceRevision: str(state.draftBaseRevision || state.revision || "unknown"),
        sequenceSettings: state.sequenceSettings,
        layoutMode: currentLayoutMode(),
        displayElements: state.displayElements,
        groupIds: Object.keys(state.sceneGraph?.groupsById || {}),
        groupsById: state.sceneGraph?.groupsById || {},
        submodelsById: state.sceneGraph?.submodelsById || {},
        intentHandoff,
        sequencingDesignHandoff: state.creative?.sequencingDesignHandoff || intentHandoff?.sequencingDesignHandoff || null,
        sequenceArtisticGoal: state.creative?.sequenceArtisticGoal || null,
        sequenceRevisionObjective: state.creative?.sequenceRevisionObjective || null,
        analysisHandoff,
        renderValidationEvidence: state.agentPlan?.handoff?.metadata?.renderValidationEvidence || null,
        planningScope: {
          sections: selected,
          targetIds: revisionTarget?.targetIds?.length ? revisionTarget.targetIds : normalizeMetadataSelectionIds(state.ui.metadataSelectionIds || []),
          tagNames: normalizeMetadataSelectedTags(state.ui.metadataSelectedTags || [])
        },
        timingOwnership: getSequenceTimingOwnershipRows(),
        manualXdLocks: getManualLockedXdTracks(),
        allowTimingWrites: true
      });
      const inputGate = validateSequenceAgentContractGate("input", sequenceAgentInput, orchestrationRun.id);
      pushSequenceAgentContractDiagnostic(inputGate.report);
      if (!inputGate.ok) {
        markOrchestrationStage(orchestrationRun, inputGate.stage, "error", inputGate.report.errors.join("; "));
        endOrchestrationRun(orchestrationRun, { status: "failed", summary: "sequence_agent input contract invalid" });
        state.ui.agentThinking = false;
        setStatusWithDiagnostics("warning", "Proposal generation blocked: sequence_agent input contract invalid.", inputGate.report.errors.join("\n"));
        postGenerateFailureMessage("I couldn't build a valid sequencer input from that request. Review the warning state and try again.");
        persist();
        render();
        return;
      }
      let sequencerPlan = null;
      try {
        sequencerPlan = buildSequenceAgentPlan({
          analysisHandoff,
          intentHandoff,
          sequencingDesignHandoff: sequenceAgentInput.sequencingDesignHandoff,
          sequenceArtisticGoal: sequenceAgentInput.sequenceArtisticGoal,
          sequenceRevisionObjective: sequenceAgentInput.sequenceRevisionObjective,
          renderValidationEvidence: sequenceAgentInput.renderValidationEvidence,
          priorPassMemory,
          sourceLines: proposalSeedLines,
          baseRevision: str(state.draftBaseRevision || state.revision || "unknown"),
          capabilityCommands: state.health.capabilityCommands || [],
          effectCatalog: state.effectCatalog,
          sequenceSettings: state.sequenceSettings,
          layoutMode: currentLayoutMode(),
          displayElements: state.displayElements,
          groupIds: Object.keys(state.sceneGraph?.groupsById || {}),
          groupsById: state.sceneGraph?.groupsById || {},
          submodelsById: state.sceneGraph?.submodelsById || {},
          timingOwnership: getSequenceTimingOwnershipRows(),
          metadataAssignments: buildEffectiveMetadataAssignments(),
          allowTimingWrites: true
        });
        emitSequenceAgentStageTelemetry(orchestrationRun, sequencerPlan);
        markOrchestrationStage(orchestrationRun, "sequencer_plan", "ok", "sequence_agent plan built");
      } catch (err) {
        if (Array.isArray(err?.stageTelemetry)) {
          emitSequenceAgentStageTelemetry(orchestrationRun, { stageTelemetry: err.stageTelemetry });
        }
        markOrchestrationStage(orchestrationRun, "sequencer_plan", "error", str(err?.message || err));
        sequencerPlan = {
          planId: `plan-${Date.now()}`,
          summary: `Designer plan from intent "${intentText.slice(0, 90)}${intentText.length > 90 ? "..." : ""}"`,
          estimatedImpact: estimateImpactCount(state.proposed),
          warnings: [str(err?.message || err)],
          commands: [],
          baseRevision: str(state.draftBaseRevision || state.revision || "unknown"),
          validationReady: false,
          metadata: {
            layoutMode: currentLayoutMode(),
            mode: str(intentHandoff?.mode || "create"),
            scope: {
              sections: selected,
              targetIds: normalizeMetadataSelectionIds(state.ui.metadataSelectionIds || []),
              tagNames: normalizeMetadataSelectedTags(state.ui.metadataSelectedTags || [])
            },
            degradedMode: !analysisHandoff
          }
        };
      }
      const planHandoff = {
        agentRole: str(sequencerPlan.agentRole || "sequence_agent"),
        contractVersion: str(sequencerPlan.contractVersion || "1.0"),
        planId: str(sequencerPlan.planId || `plan-${Date.now()}`),
        summary: str(sequencerPlan.summary || `Designer plan from intent "${intentText.slice(0, 90)}${intentText.length > 90 ? "..." : ""}"`),
        estimatedImpact: Number(sequencerPlan.estimatedImpact || estimateImpactCount(state.proposed)),
        warnings: Array.isArray(sequencerPlan.warnings) ? sequencerPlan.warnings : [],
        commands: Array.isArray(sequencerPlan.commands) ? sequencerPlan.commands : [],
        baseRevision: str(sequencerPlan.baseRevision || state.draftBaseRevision || state.revision || "unknown"),
        validationReady: Boolean(sequencerPlan.validationReady),
        metadata: isPlainObject(sequencerPlan.metadata)
          ? sequencerPlan.metadata
          : {
              layoutMode: currentLayoutMode(),
              mode: str(intentHandoff?.mode || "create"),
              scope: {
                sections: selected,
                targetIds: normalizeMetadataSelectionIds(state.ui.metadataSelectionIds || []),
                tagNames: normalizeMetadataSelectedTags(state.ui.metadataSelectedTags || [])
              },
              degradedMode: !analysisHandoff
            }
      };
      if (revisionTarget) {
        const normalizedTarget = normalizeDesignRevisionTarget(revisionTarget);
        const retagCommand = (command = {}) => {
          if (str(command?.designId) !== normalizedTarget.designId) return command;
          return {
            ...command,
            designId: normalizedTarget.designId,
            designRevision: normalizedTarget.designRevision,
            designAuthor: normalizedTarget.designAuthor,
            intent: command?.intent && typeof command.intent === "object"
              ? {
                  ...command.intent,
                  designId: normalizedTarget.designId,
                  designRevision: normalizedTarget.designRevision,
                  designAuthor: normalizedTarget.designAuthor
                }
              : command?.intent
          };
        };
        planHandoff.commands = Array.isArray(planHandoff.commands) ? planHandoff.commands.map(retagCommand) : [];
        planHandoff.metadata = {
          ...(planHandoff.metadata && typeof planHandoff.metadata === "object" ? planHandoff.metadata : {}),
          designRevisionTarget: normalizedTarget
        };
      }
      planHandoff.createdAt = new Date().toISOString();
      planHandoff.artifactId = buildArtifactId("plan_handoff_v1", planHandoff);
      const planGraphGate = validateCommandGraph(planHandoff.commands);
      if (!planGraphGate.ok) {
        markOrchestrationStage(orchestrationRun, "graph_validation", "error", planGraphGate.errors.join("; "));
        endOrchestrationRun(orchestrationRun, { status: "failed", summary: "sequence_agent graph validation failed" });
        state.ui.agentThinking = false;
        setStatusWithDiagnostics("warning", "Proposal generation blocked: sequence_agent command graph invalid.", planGraphGate.errors.join("\n"));
        postGenerateFailureMessage("I built an invalid sequencing graph from that request. Review the warning state and try refining the scope.");
        persist();
        render();
        return;
      }
      markOrchestrationStage(orchestrationRun, "graph_validation", "ok", `nodes=${planGraphGate.nodeCount}`);
      const planGate = validateSequenceAgentContractGate("plan", planHandoff, orchestrationRun.id);
      pushSequenceAgentContractDiagnostic(planGate.report);
      if (!planGate.ok) {
        markOrchestrationStage(orchestrationRun, planGate.stage, "error", planGate.report.errors.join("; "));
        endOrchestrationRun(orchestrationRun, { status: "failed", summary: "sequence_agent plan contract invalid" });
        state.ui.agentThinking = false;
        setStatusWithDiagnostics("warning", "Proposal generation blocked: sequence_agent plan contract invalid.", planGate.report.errors.join("\n"));
        postGenerateFailureMessage("I couldn't finalize a valid sequencing draft from that request. Review the warning state and try again.");
        persist();
        render();
        return;
      }
      const executionLines = Array.isArray(sequencerPlan?.executionLines) ? sequencerPlan.executionLines : proposalSeedLines;
      state.proposed = mergeCreativeBriefIntoProposal(executionLines);
      state.agentPlan = {
        createdAt: new Date().toISOString(),
        source: "sequence_agent",
        handoff: planHandoff,
        executionLines
      };
      const planSet = setAgentHandoff("plan_handoff_v1", planHandoff, "sequence_agent");
      if (revisionTarget && planSet.ok && supersededConceptRecord) {
        upsertSupersededConceptRecord(supersededConceptRecord);
      }
      if (!planSet.ok) {
        markOrchestrationStage(orchestrationRun, "plan_handoff", "error", planSet.errors.join("; "));
        addChatMessage("system", `Plan handoff is incomplete: ${planSet.errors.join("; ")}`);
      } else if (planHandoff.warnings.length) {
        markOrchestrationStage(orchestrationRun, "plan_handoff", "ok", `warnings=${planHandoff.warnings.length}`);
        pushDiagnostic("warning", `Sequencer plan warnings: ${planHandoff.warnings.join(" | ")}`);
      } else {
        markOrchestrationStage(orchestrationRun, "plan_handoff", "ok", "plan_handoff_v1 ready");
      }
      endOrchestrationRun(orchestrationRun, {
        status: planSet.ok ? "ok" : "failed",
        summary: planSet.ok
          ? `proposal generated with ${state.proposed.length} line${state.proposed.length === 1 ? "" : "s"}`
          : "proposal generation incomplete"
      });
      state.ui.agentThinking = false;
      const guidedMessage = proposalRole === "designer_dialog" ? buildDesignerGuidedQuestionMessage(normalizedProposalOrchestration.guidedQuestions) : "";
      if (guidedMessage) addChatMessage("agent", guidedMessage);
      addStructuredChatMessage(
        "agent",
        proposalRole === "sequence_agent"
          ? `Sequencing draft ready: ${state.proposed.length} proposed change${state.proposed.length === 1 ? "" : "s"} ready for review.`
          : buildDesignerCompletionMessage({
              proposalBundle: state.creative?.proposalBundle || null,
              creativeBrief: state.creative?.brief || null
            }),
        {
          roleId: proposalRole,
          displayName: getTeamChatSpeakerLabel(proposalRole),
          handledBy: proposalRole,
          artifact: proposalRole === "sequence_agent"
            ? buildChatArtifactCard("plan_handoff_v1", {
                title: str(state.agentPlan?.handoff?.summary || "Sequence Draft"),
                summary: str(state.agentPlan?.handoff?.summary || ""),
                chips: [
                  state.creative?.proposalBundle?.lifecycle?.status || "",
                  Array.isArray(state.agentPlan?.handoff?.commands) ? `${state.agentPlan.handoff.commands.length} commands` : "",
                  Number.isFinite(Number(state.agentPlan?.handoff?.estimatedImpact)) ? `${Number(state.agentPlan.handoff.estimatedImpact)} impact` : ""
                ]
              })
            : buildChatArtifactCard("proposal_bundle_v1", {
                title: str(state.creative?.proposalBundle?.title || "Design Proposal"),
                summary: str(state.creative?.proposalBundle?.summary || state.creative?.brief?.summary || ""),
                chips: [
                  state.creative?.proposalBundle?.lifecycle?.status || "",
                  Array.isArray(state.creative?.proposalBundle?.lines) ? `${state.creative.proposalBundle.lines.length} lines` : "",
                  Array.isArray(state.creative?.proposalBundle?.scope?.sections) ? `${state.creative.proposalBundle.scope.sections.length} sections` : ""
                ]
              })
        }
      );
      setStatus("info", `Proposal refreshed from current intent (${state.proposed.length} line${state.proposed.length === 1 ? "" : "s"}).`);
      clearDesignRevisionTarget();
      saveCurrentProjectSnapshot();
      persist();
      render();
    } catch (err) {
      state.ui.agentThinking = false;
      const detail = str(err?.message || err);
      postGenerateFailureMessage(
        directSequenceMode
          ? `I hit an unexpected error while building the sequencing draft: ${detail}`
          : `I hit an unexpected error while building the design draft: ${detail}`
      );
      setStatusWithDiagnostics("warning", "Proposal generation failed unexpectedly.", detail);
      persist();
      render();
    }
  }

  return {
    generateProposal
  };
}
