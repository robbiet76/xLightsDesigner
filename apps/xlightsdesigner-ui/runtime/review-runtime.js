import { buildPracticalSequenceValidation } from "../agent/sequence-agent/practical-sequence-validation.js";
import { buildTimingTrackProvenanceRecord } from "./timing-track-provenance.js";
import {
  refreshSequenceArtisticGoalFromPracticalValidation,
  refreshSequenceRevisionObjectiveFromPracticalValidation,
  refreshSequenceArtisticGoalFromRenderCritique,
  refreshSequenceRevisionObjectiveFromRenderCritique
} from "../agent/designer-dialog/sequence-artifacts.js";
import { buildRenderCritiqueContext } from "../agent/sequence-agent/render-critique-context.js";
import { buildRenderValidationEvidence } from "../agent/sequence-agent/render-validation-evidence.js";
import { buildCandidateSelectionContext } from "../agent/sequence-agent/candidate-selection-context.js";

function normalizePlanForLiveApply(rawPlan = [], { analysisHandoff = null } = {}) {
  return Array.isArray(rawPlan) ? rawPlan.map((row) => ({ ...row })) : [];
}

export async function executeApplyCore({
  state = {},
  sourceLines = [],
  applyLabel = "proposal",
  scopedImpactCount = 0,
  orchestrationRun = null,
  intentHandoffRecord = null,
  intentHandoff = null,
  planHandoff = null,
  deps = {},
  callbacks = {}
} = {}) {
  const {
    currentSequencePathForSidecar,
    getDesktopBackupBridge,
    getValidHandoff,
    buildSequenceAgentInput,
    currentLayoutMode,
    getSelectedSections,
    normalizeMetadataSelectionIds,
    normalizeMetadataSelectedTags,
    buildPriorPassMemory = () => null,
    getSequenceTimingOwnershipRows,
    getManualLockedXdTracks,
    validateSequenceAgentContractGate,
    filteredProposed,
    arraysEqualOrdered,
    validateCommandGraph,
    buildSequenceAgentPlan,
    emitSequenceAgentStageTelemetry,
    evaluateSequencePlanCapabilities,
    isXdTimingTrack,
    timingMarksSignature,
    buildGlobalXdTrackPolicyKey,
    validateAndApplyPlan,
    verifyAppliedPlanReadback,
    buildSequenceAgentApplyResult,
    classifyOrchestrationFailureReason,
    getSequenceTimingTrackPoliciesState,
    getSequenceTimingGeneratedSignaturesState,
    setSequenceTimingTrackPoliciesState,
    setSequenceTimingGeneratedSignaturesState,
    applyAcceptedProposalToDirectorProfile,
    buildApplyHistoryEntry,
    buildChatArtifactCard,
    getTeamChatSpeakerLabel,
    buildCurrentDesignSceneContext,
    buildCurrentMusicDesignContext,
    buildCurrentRenderObservation,
    collectPostApplyRenderObservation = async () => null
  } = deps;
  const {
    pushSequenceAgentContractDiagnostic = () => {},
    markOrchestrationStage = () => {},
    endOrchestrationRun = () => {},
    pushDiagnostic = () => {},
    upsertJob = () => {},
    bumpVersion = () => {},
    setStatusWithDiagnostics = () => {},
    addStructuredChatMessage = () => {}
  } = callbacks;

  let applyAuditEntry = null;
  let applyResult = null;
  let lastOrchestrated = null;
  let lastVerification = null;
  let clearApprovalAfterApply = false;

  try {
    const sequencePath = currentSequencePathForSidecar();
    const backupBridge = getDesktopBackupBridge();
    if (backupBridge && sequencePath) {
      const backup = await backupBridge.createSequenceBackup({ sequencePath });
      if (backup?.ok !== true) {
        return {
          status: "blocked",
          blocked: true,
          message: "Apply blocked: failed to create pre-apply backup.",
          details: backup?.error || "Unknown backup error"
        };
      }
      state.lastApplyBackupPath = String(backup.backupPath || "");
      setStatusWithDiagnostics("info", `Pre-apply backup created: ${backup.backupPath || "ok"}`);
    }

    const analysisHandoff = getValidHandoff("analysis_handoff_v1");
    const sequenceArtisticGoal = state.creative?.sequenceArtisticGoal || planHandoff?.metadata?.sequenceArtisticGoal || null;
    const sequenceRevisionObjective = state.creative?.sequenceRevisionObjective || planHandoff?.metadata?.sequenceRevisionObjective || null;
    const sequencingDesignHandoff = state.creative?.sequencingDesignHandoff || planHandoff?.metadata?.sequencingDesignHandoff || intentHandoff?.sequencingDesignHandoff || null;
    const priorPassMemory = buildPriorPassMemory({
      historySnapshot: state.ui?.reviewHistorySnapshot || state.ui?.selectedHistorySnapshot || null
    });
    const revisionRetryPressure =
      state.ui?.reviewHistorySnapshot?.planHandoff?.metadata?.revisionRetryPressure
      || state.ui?.selectedHistorySnapshot?.planHandoff?.metadata?.revisionRetryPressure
      || null;
    const sequenceAgentInput = buildSequenceAgentInput({
      requestId: `${orchestrationRun.id}-apply`,
      endpoint: state.endpoint,
      sequenceRevision: String(state.draftBaseRevision || state.revision || "unknown"),
      sequenceSettings: state.sequenceSettings,
      layoutMode: currentLayoutMode(),
      displayElements: state.displayElements,
      groupIds: Object.keys(state.sceneGraph?.groupsById || {}),
      groupsById: state.sceneGraph?.groupsById || {},
      submodelsById: state.sceneGraph?.submodelsById || {},
      intentHandoff,
      sequencingDesignHandoff,
      sequenceArtisticGoal,
      sequenceRevisionObjective,
      analysisHandoff,
      renderValidationEvidence: planHandoff?.metadata?.renderValidationEvidence || null,
      revisionRetryPressure,
      candidateSelectionContext: buildCandidateSelectionContext({
        requestId: `${orchestrationRun.id}-apply`,
        phase: "review",
        sequenceRevision: String(state.draftBaseRevision || state.revision || "unknown"),
        priorPassMemory,
        revisionRetryPressure,
        renderValidationEvidence: planHandoff?.metadata?.renderValidationEvidence || null
      }),
      planningScope: {
        sections: getSelectedSections(),
        targetIds: normalizeMetadataSelectionIds(state.ui.metadataSelectionIds || []),
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
      endOrchestrationRun(orchestrationRun, { status: "failed", summary: "apply blocked: invalid sequence_agent input contract" });
      return {
        status: "blocked",
        blocked: true,
        message: "Apply blocked: sequence_agent input contract invalid.",
        details: inputGate.report.errors.join("\n")
      };
    }

    let planSource = "generated";
    let sequencerPlan = null;
    const handoffCommands = Array.isArray(planHandoff?.commands) ? planHandoff.commands : [];
    const hasHandoffGraph = handoffCommands.length > 0;
    markOrchestrationStage(
      orchestrationRun,
      "graph_validation",
      hasHandoffGraph ? "warning" : "warning",
      hasHandoffGraph
        ? "ignoring stored plan_handoff_v1 command graph and regenerating from current proposal"
        : "plan_handoff_v1 commands unavailable; generating from current proposal"
    );

    const metadataAssignments = typeof deps.buildEffectiveMetadataAssignments === "function"
      ? deps.buildEffectiveMetadataAssignments()
      : [];

    sequencerPlan = buildSequenceAgentPlan({
      analysisHandoff,
      intentHandoff,
      sequencingDesignHandoff: sequenceAgentInput.sequencingDesignHandoff,
      sequenceArtisticGoal: sequenceAgentInput.sequenceArtisticGoal,
      sequenceRevisionObjective: sequenceAgentInput.sequenceRevisionObjective,
      renderValidationEvidence: sequenceAgentInput.renderValidationEvidence,
      revisionRetryPressure: sequenceAgentInput.revisionRetryPressure,
      candidateSelectionContext: sequenceAgentInput.candidateSelectionContext,
      priorPassMemory,
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
      metadataAssignments,
      timingOwnership: getSequenceTimingOwnershipRows(),
      allowTimingWrites: true
    });
    emitSequenceAgentStageTelemetry(orchestrationRun, sequencerPlan);

    markOrchestrationStage(orchestrationRun, "sequencer_plan", "ok", "apply plan built");
    const rawPlan = normalizePlanForLiveApply(
      Array.isArray(sequencerPlan?.commands) ? sequencerPlan.commands : [],
      { analysisHandoff }
    );
    if (!rawPlan.length) {
      throw new Error("sequence_agent generated no commands for apply.");
    }

    const capabilityGate = evaluateSequencePlanCapabilities({
      commands: rawPlan,
      capabilityCommands: state.health.capabilityCommands || []
    });
    if (!capabilityGate.ok) {
      markOrchestrationStage(orchestrationRun, "capability_gate", "error", capabilityGate.errors.join(" | "));
      throw new Error(`Apply blocked by capability gate: ${capabilityGate.errors.join("; ")}`);
    }
    if (capabilityGate.skipped) {
      markOrchestrationStage(orchestrationRun, "capability_gate", "warning", capabilityGate.warnings.join(" | "));
    } else {
      markOrchestrationStage(orchestrationRun, "capability_gate", "ok", `required=${capabilityGate.requiredCapabilities.length}`);
    }

    const generatedGraph = validateCommandGraph(rawPlan);
    if (!generatedGraph.ok) {
      markOrchestrationStage(orchestrationRun, "graph_validation", "error", generatedGraph.errors.join(" | "));
      throw new Error(`Generated command graph invalid: ${generatedGraph.errors.join("; ")}`);
    }
    markOrchestrationStage(orchestrationRun, "graph_validation", "ok", `source=generated nodes=${generatedGraph.nodeCount}`);

    const pendingGenerated = new Map();
    for (const step of rawPlan) {
      const cmd = String(step?.cmd || "").trim();
      const params = step?.params && typeof step.params === "object" ? step.params : {};
      const trackName = String(params?.trackName || "").trim();
      if (isXdTimingTrack(trackName) && (cmd === "timing.insertMarks" || cmd === "timing.replaceMarks") && Array.isArray(params?.marks)) {
        const sig = timingMarksSignature(params.marks);
        if (sig) {
          pendingGenerated.set(trackName, {
            policyKey: buildGlobalXdTrackPolicyKey(trackName),
            signature: sig
          });
        }
      }
    }

    markOrchestrationStage(orchestrationRun, "xd_protection", "ok", "timing ownership resolved by sequence_agent");
    if (Array.isArray(sequencerPlan?.warnings) && sequencerPlan.warnings.length) {
      pushDiagnostic("warning", `Sequencer apply warnings: ${sequencerPlan.warnings.join(" | ")}`);
    }

    const orchestrated = await validateAndApplyPlan({
      endpoint: state.endpoint,
      commands: rawPlan,
      expectedRevision: state.draftBaseRevision,
      getRevision: deps.getRevision,
      validateCommands: deps.validateCommands,
      beginTransaction: deps.beginTransaction,
      commitTransaction: deps.commitTransaction,
      rollbackTransaction: deps.rollbackTransaction,
      stageTransactionCommand: deps.stageTransactionCommand,
      applySequencingBatchPlan: deps.applySequencingBatchPlan,
      getOwnedJob: deps.getOwnedJob,
      getOwnedHealth: deps.getOwnedHealth,
      getOwnedRevision: deps.getOwnedSequenceRevision,
      safetyOptions: { maxCommands: 200 }
    });
    lastOrchestrated = orchestrated;

    if (!orchestrated?.ok) {
      applyResult = buildSequenceAgentApplyResult({
        planId: String(planHandoff?.planId || ""),
        status: "blocked",
        failureReason: classifyOrchestrationFailureReason(orchestrated?.stage || "", orchestrated?.error || ""),
        currentRevision: String(orchestrated?.currentRevision || state.draftBaseRevision || state.revision || "unknown"),
        nextRevision: String(orchestrated?.nextRevision || orchestrated?.currentRevision || state.revision || "unknown"),
        verification: { revisionAdvanced: false, expectedMutationsPresent: false, lockedTracksUnchanged: true }
      });
      const applyGate = validateSequenceAgentContractGate("apply", applyResult, orchestrationRun.id);
      pushSequenceAgentContractDiagnostic(applyGate.report);
      if (!applyGate.ok) {
        markOrchestrationStage(orchestrationRun, applyGate.stage, "error", applyGate.report.errors.join("; "));
        pushDiagnostic("warning", `Sequence-agent apply raw result: ${JSON.stringify(orchestrated || {})}`);
      }
      markOrchestrationStage(orchestrationRun, "validate_apply", "error", String(orchestrated?.error || "unknown orchestration error"));
      endOrchestrationRun(orchestrationRun, { status: "failed", summary: `apply blocked at ${orchestrated?.stage || "unknown"}` });
      applyAuditEntry = buildApplyHistoryEntry({
        status: "blocked",
        stage: orchestrated?.stage || "unknown",
        commandCount: rawPlan.length,
        impactCount: scopedImpactCount,
        currentRevision: String(orchestrated?.currentRevision || state.draftBaseRevision || state.revision || "unknown"),
        nextRevision: String(orchestrated?.nextRevision || orchestrated?.currentRevision || state.revision || "unknown"),
        planHandoff,
        applyResult,
        summary: orchestrated?.error || "Unknown orchestration error.",
        verification: applyResult?.verification || null
      });
      return {
        status: "blocked",
        blocked: true,
        message: `Apply blocked at ${orchestrated?.stage || "unknown"} stage.`,
        details: orchestrated?.error || "Unknown orchestration error.",
        applyAuditEntry,
        applyResult,
        clearApprovalAfterApply
      };
    }

    const executed = Number(orchestrated?.executedCount || 0);
    const verification = await verifyAppliedPlanReadback(rawPlan, {
      submodelsById: state.sceneGraph?.submodelsById || {},
      planMetadata: planHandoff?.metadata || {}
    });
    lastVerification = verification;
    verification.revisionAdvanced = String(orchestrated?.nextRevision || "") !== String(orchestrated?.currentRevision || "");
    const practicalValidation = buildPracticalSequenceValidation({
      planHandoff,
      verification
    });
    const designSceneContext = typeof buildCurrentDesignSceneContext === "function"
      ? buildCurrentDesignSceneContext()
      : null;
    const musicDesignContext = typeof buildCurrentMusicDesignContext === "function"
      ? buildCurrentMusicDesignContext()
      : null;
    state.sequenceAgentRuntime = state.sequenceAgentRuntime && typeof state.sequenceAgentRuntime === "object"
      ? state.sequenceAgentRuntime
      : {};
    let nextRenderObservation = await collectPostApplyRenderObservation({
      state,
      practicalValidation,
      verification,
      planHandoff,
      sequencingDesignHandoff,
      designSceneContext,
      applyResult: {
        currentRevision: String(orchestrated?.currentRevision || state.draftBaseRevision || state.revision || "unknown"),
        nextRevision: String(orchestrated?.nextRevision || orchestrated?.currentRevision || state.revision || "unknown")
      }
    });
    if (!nextRenderObservation && typeof buildCurrentRenderObservation === "function") {
      nextRenderObservation = buildCurrentRenderObservation({
        practicalValidation,
        verification,
        planHandoff,
        sequencingDesignHandoff
      });
    }
    if (nextRenderObservation && typeof nextRenderObservation === "object") {
      state.sequenceAgentRuntime.renderObservation = nextRenderObservation;
    }
    const renderObservation = state.sequenceAgentRuntime?.renderObservation
      && typeof state.sequenceAgentRuntime.renderObservation === "object"
      ? state.sequenceAgentRuntime.renderObservation
      : null;
    const renderCritiqueContext = buildRenderCritiqueContext({
      renderObservation,
      designSceneContext,
      sequencingDesignHandoff,
      musicDesignContext
    });
    state.sequenceAgentRuntime.renderCritiqueContext = renderCritiqueContext;
    const nextRenderValidationEvidence = buildRenderValidationEvidence({
      priorEvidence: planHandoff?.metadata?.renderValidationEvidence || state.sequenceAgentRuntime?.renderValidationEvidence || null,
      renderObservation,
      renderCritiqueContext,
      sectionNames: getSelectedSections(),
      targetIds: normalizeMetadataSelectionIds(state.ui.metadataSelectionIds || [])
    });
    state.sequenceAgentRuntime.renderValidationEvidence = nextRenderValidationEvidence;
    if (planHandoff && typeof planHandoff === "object") {
      planHandoff.metadata = planHandoff.metadata && typeof planHandoff.metadata === "object" ? planHandoff.metadata : {};
      planHandoff.metadata.renderValidationEvidence = nextRenderValidationEvidence;
    }
    state.creative = state.creative && typeof state.creative === "object" ? state.creative : {};
    state.creative.sequenceArtisticGoal = renderCritiqueContext
      ? refreshSequenceArtisticGoalFromRenderCritique({
          priorArtisticGoal: sequenceArtisticGoal,
          sequencingDesignHandoff,
          renderCritiqueContext
        })
      : refreshSequenceArtisticGoalFromPracticalValidation({
          priorArtisticGoal: sequenceArtisticGoal,
          sequencingDesignHandoff,
          practicalValidation
        });
    state.creative.sequenceRevisionObjective = renderCritiqueContext
      ? refreshSequenceRevisionObjectiveFromRenderCritique({
          priorRevisionObjective: sequenceRevisionObjective,
          sequenceArtisticGoal: state.creative.sequenceArtisticGoal,
          sequencingDesignHandoff,
          renderCritiqueContext
        })
      : refreshSequenceRevisionObjectiveFromPracticalValidation({
          priorRevisionObjective: sequenceRevisionObjective,
          sequenceArtisticGoal: state.creative.sequenceArtisticGoal,
          sequencingDesignHandoff,
          practicalValidation
        });
    applyResult = buildSequenceAgentApplyResult({
      planId: String(planHandoff?.planId || ""),
      status: "applied",
      failureReason: null,
      currentRevision: String(orchestrated?.currentRevision || state.draftBaseRevision || state.revision || "unknown"),
      nextRevision: String(orchestrated?.nextRevision || orchestrated?.currentRevision || state.revision || "unknown"),
      verification,
      practicalValidation
    });
    const applyGate = validateSequenceAgentContractGate("apply", applyResult, orchestrationRun.id);
    pushSequenceAgentContractDiagnostic(applyGate.report);
    if (!applyGate.ok) {
      markOrchestrationStage(orchestrationRun, applyGate.stage, "error", applyGate.report.errors.join("; "));
      pushDiagnostic("warning", `Sequence-agent apply raw result: ${JSON.stringify(orchestrated || {})}`);
      throw new Error(`Apply result contract invalid: ${applyGate.report.errors.join("; ")}`);
    }
    if (!verification.revisionAdvanced) {
      markOrchestrationStage(orchestrationRun, "validate_apply", "error", "revision did not advance");
      throw new Error("Apply verification failed: revision did not advance.");
    }
    if (!verification.expectedMutationsPresent) {
      const failedChecks = verification.checks.filter((row) => !row.ok).map((row) => `${row.kind}:${row.target} ${row.detail}`);
      markOrchestrationStage(orchestrationRun, "validate_apply", "error", failedChecks.join(" | ") || "expected mutations missing");
      throw new Error(`Apply verification failed: ${failedChecks.join("; ") || "expected mutations missing"}`);
    }

    pushDiagnostic("info", `Apply verification passed: revision advanced, ${verification.checks.length} readback check${verification.checks.length === 1 ? "" : "s"}.`);
    markOrchestrationStage(orchestrationRun, "validate_apply", "ok", `executed=${executed} verified=${verification.checks.length}`);
    const jobId = orchestrated?.jobId || null;
    const applyPath = String(orchestrated?.applyPath || "").trim();
    const applyPathLabel = applyPath === "owned_batch_plan"
      ? "owned batch plan"
      : "transaction commit";
    state.revision = orchestrated?.nextRevision || orchestrated?.currentRevision || state.revision;
    if (jobId && applyPath === "legacy_transactions") {
      upsertJob({ id: jobId, source: "transactions.commit", status: "running", progress: 0, updatedAt: new Date().toISOString() });
      setStatusWithDiagnostics("info", `Plan accepted as async job ${jobId}.`);
    }
    state.draftBaseRevision = state.revision;
    const timingTrackPolicies = getSequenceTimingTrackPoliciesState();
    const timingGeneratedSignatures = getSequenceTimingGeneratedSignaturesState();
    const timingTrackProvenance = state.sequenceAgentRuntime?.timingTrackProvenance
      && typeof state.sequenceAgentRuntime.timingTrackProvenance === "object"
      ? { ...state.sequenceAgentRuntime.timingTrackProvenance }
      : {};
    for (const [trackName, row] of pendingGenerated.entries()) {
      const key = String(row?.policyKey || "").trim();
      const sig = String(row?.signature || "").trim();
      if (!key || !sig) continue;
      const policy = timingTrackPolicies[key];
      if (policy?.manual) continue;
      timingGeneratedSignatures[key] = sig;
      timingTrackPolicies[key] = { manual: false, trackName, updatedAt: new Date().toISOString() };
    }
    for (const check of Array.isArray(verification?.checks) ? verification.checks : []) {
      if (String(check?.kind || "").trim() !== "timing") continue;
      const trackName = String(check?.target || "").trim();
      if (!trackName || !isXdTimingTrack(trackName)) continue;
      const policyKey = buildGlobalXdTrackPolicyKey(trackName);
      if (!policyKey) continue;
      timingTrackProvenance[policyKey] = buildTimingTrackProvenanceRecord({
        trackType:
          trackName === "XD: Song Structure"
            ? "structure"
            : (trackName === "XD: Phrase Cues" ? "phrase" : "timing"),
        trackName,
        sourceMarks: Array.isArray(check?.expectedMarks) ? check.expectedMarks : [],
        userFinalMarks: Array.isArray(check?.actualMarks) ? check.actualMarks : [],
        sourceProvenance: {
          generator: "sequence_agent_apply_v1",
          verificationKind: "readback"
        },
        capturedAt: new Date().toISOString(),
        coverageMode: (trackName === "XD: Song Structure" || trackName === "XD: Phrase Cues") ? "complete" : "sparse",
        durationMs: Number(state.sequenceSettings?.durationMs || 0),
        fillerLabel: ""
      });
    }
    setSequenceTimingTrackPoliciesState(timingTrackPolicies);
    setSequenceTimingGeneratedSignaturesState(timingGeneratedSignatures);
    state.sequenceAgentRuntime.timingTrackProvenance = timingTrackProvenance;
    state.flags.proposalStale = false;
    if (String(intentHandoffRecord?.producer || "") === "designer_dialog" && state.creative?.proposalBundle && typeof applyAcceptedProposalToDirectorProfile === "function") {
      state.directorProfile = applyAcceptedProposalToDirectorProfile(state.directorProfile, { proposalBundle: state.creative.proposalBundle });
    }
    bumpVersion("Applied draft proposal", state.proposed.length * 11);
    setStatusWithDiagnostics("info", `Applied via ${applyPathLabel} (${executed} steps).`);
    addStructuredChatMessage("agent", `Apply complete via ${applyPathLabel}. Executed ${executed} step${executed === 1 ? "" : "s"}.`, {
      roleId: "sequence_agent",
      displayName: getTeamChatSpeakerLabel("sequence_agent"),
      handledBy: "sequence_agent",
      artifact: buildChatArtifactCard("apply_result_v1", {
        title: "Apply Result",
        summary: `Revision ${String(state.revision || "unknown")} verified successfully via ${applyPathLabel}.`,
        chips: [applyPath || "unknown", `${executed} steps`, verification.expectedMutationsPresent ? "verified" : "", verification.revisionAdvanced ? "revision advanced" : ""]
      })
    });
    applyAuditEntry = buildApplyHistoryEntry({
      status: "success",
      stage: "validate_apply",
      commandCount: rawPlan.length,
      impactCount: scopedImpactCount,
      currentRevision: String(orchestrated?.currentRevision || state.draftBaseRevision || state.revision || "unknown"),
      nextRevision: String(state.revision || orchestrated?.nextRevision || orchestrated?.currentRevision || "unknown"),
      verification,
      planHandoff,
      applyResult,
      summary: `Applied ${executed} command${executed === 1 ? "" : "s"} successfully via ${applyPathLabel}.`
    });
    applyAuditEntry.executedCount = executed;
    applyAuditEntry.jobId = jobId || "";
    applyAuditEntry.applyPath = applyPath;
    applyAuditEntry.revision = state.revision || "unknown";
    clearApprovalAfterApply = true;
    endOrchestrationRun(orchestrationRun, { status: "ok", summary: `apply succeeded (${executed} command${executed === 1 ? "" : "s"})` });
    return {
      status: "applied",
      blocked: false,
      applyAuditEntry,
      applyResult,
      clearApprovalAfterApply,
      lastOrchestrated,
      lastVerification
    };
  } catch (err) {
    markOrchestrationStage(orchestrationRun, "exception", "error", String(err?.message || err));
    applyResult = buildSequenceAgentApplyResult({
      planId: String(planHandoff?.planId || ""),
      status: "failed",
      failureReason: classifyOrchestrationFailureReason(lastOrchestrated?.stage || "exception", String(err?.message || err || ""), lastVerification),
      currentRevision: String(lastOrchestrated?.currentRevision || state.draftBaseRevision || state.revision || "unknown"),
      nextRevision: String(lastOrchestrated?.nextRevision || lastOrchestrated?.currentRevision || state.revision || "unknown"),
      verification: lastVerification && typeof lastVerification === "object" ? lastVerification : undefined
    });
    const applyGate = validateSequenceAgentContractGate("apply", applyResult, orchestrationRun.id);
    pushSequenceAgentContractDiagnostic(applyGate.report);
    if (!applyGate.ok) {
      markOrchestrationStage(orchestrationRun, applyGate.stage, "error", applyGate.report.errors.join("; "));
      pushDiagnostic("warning", `Sequence-agent apply raw result: ${JSON.stringify(applyResult || {})}`);
    }
    endOrchestrationRun(orchestrationRun, { status: "failed", summary: String(err?.message || "apply error") });
    setStatusWithDiagnostics("action-required", `Apply blocked: ${err.message}`, err.stack || "");
    addStructuredChatMessage("agent", `Apply blocked: ${err.message}`, {
      roleId: "sequence_agent",
      displayName: getTeamChatSpeakerLabel("sequence_agent"),
      handledBy: "sequence_agent"
    });
    applyAuditEntry = buildApplyHistoryEntry({
      status: "failed",
      stage: "exception",
      commandCount: Array.isArray(sourceLines) ? sourceLines.length : 0,
      impactCount: scopedImpactCount,
      currentRevision: String(lastOrchestrated?.currentRevision || state.draftBaseRevision || state.revision || "unknown"),
      nextRevision: String(lastOrchestrated?.nextRevision || lastOrchestrated?.currentRevision || state.revision || "unknown"),
      verification: lastVerification && typeof lastVerification === "object" ? lastVerification : undefined,
      planHandoff,
      applyResult,
      summary: String(err?.message || "Unknown apply error")
    });
    return {
      status: "failed",
      blocked: false,
      applyAuditEntry,
      applyResult,
      clearApprovalAfterApply,
      lastOrchestrated,
      lastVerification
    };
  }
}
