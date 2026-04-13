function str(value = "") {
  return String(value || "").trim();
}

export function createAudioAnalysisSessionRuntime(deps = {}) {
  const {
    state,
    agentRuntime,
    setStatus = () => {},
    setStatusWithDiagnostics = () => {},
    render = () => {},
    persist = () => {},
    saveCurrentProjectSnapshot = () => {},
    setAgentActiveRole = () => {},
    beginOrchestrationRun = () => ({ id: `run-${Date.now()}` }),
    refreshAgentRuntimeHealth = () => {},
    markOrchestrationStage = () => {},
    endOrchestrationRun = () => {},
    resetAudioAnalysisView,
    buildPendingAudioAnalysisPipeline,
    setAudioAnalysisProgress,
    startAudioAnalysisProgressTicker,
    loadReusableAnalysisArtifactForProfile,
    buildAnalysisHandoffFromArtifact,
    setAgentHandoff,
    applyPersistedAnalysisArtifact,
    addStructuredChatMessage,
    buildAudioAnalystChatReply,
    getTeamChatSpeakerLabel = () => "",
    buildChatArtifactCard,
    basenameOfPath = () => "",
    maybeOfferIdentityRecommendationAction,
    onAnalysisArtifactReady = async () => {},
    buildLyricsRecoveryGuidance,
    buildAudioAnalystInput,
    executeAudioAnalystFlow,
    getDesktopAnalysisArtifactBridge = () => null,
    getProjectMetadataRoot = () => "",
    buildAudioAnalysisStubSummary,
    applyAudioAnalystFlowSuccessToState,
    syncSectionSuggestionsFromAnalysisArtifact,
    pushDiagnostic = () => {},
    applyAudioAnalystFlowFailureToState,
    runAudioAnalysisPipeline
  } = deps;

  async function analyzeAudio({
    userPrompt = "",
    analysisProfile = null,
    forceFresh = false,
    disableInteractivePrompts = false
  } = {}) {
    const audioPath = str(state.audioPathInput);
    state.ui.lastAnalysisPrompt = str(userPrompt);
    if (!audioPath) {
      setStatus("warning", "No audio track selected for analysis.");
      render();
      return { ok: false, error: "missing_audio_path" };
    }
    setAgentActiveRole("audio_analyst");
    const orchestrationRun = beginOrchestrationRun({ trigger: "analyze-audio", role: "audio_analyst" });
    agentRuntime.handoffs.analysis_handoff_v1 = null;
    refreshAgentRuntimeHealth();
    markOrchestrationStage(orchestrationRun, "service_health", "ok", "service preflight skipped; analyze call will self-heal backend");
    state.diagnostics = (state.diagnostics || []).filter(
      (entry) => !str(entry?.text).startsWith("Audio analysis:")
    );
    state.sectionSuggestions = [];
    state.sectionStartByLabel = {};
    state.sectionEndByLabel = {};
    resetAudioAnalysisView(state.audioAnalysis);
    state.audioAnalysis.pipeline = buildPendingAudioAnalysisPipeline();
    setAudioAnalysisProgress(state.audioAnalysis, {
      stage: "pipeline_start",
      message: "Preparing the audio analysis pipeline."
    });
    state.ui.agentThinking = true;
    setStatus("info", "Running audio analysis pipeline...");
    render();
    const progressTicker = startAudioAnalysisProgressTicker();
    try {
      const resolvedProvider = "librosa";
      const requestedAnalysisProfile = analysisProfile && typeof analysisProfile === "object"
        ? {
            mode: str(analysisProfile.mode).toLowerCase() === "deep" ? "deep" : "fast",
            allowEscalation: analysisProfile.allowEscalation !== false
          }
        : { mode: "fast", allowEscalation: true };
      const reusable = forceFresh ? null : await loadReusableAnalysisArtifactForProfile(requestedAnalysisProfile);
      if (reusable?.artifact) {
        progressTicker.stop();
        const handoff = buildAnalysisHandoffFromArtifact(reusable.artifact, state.creative?.brief || null);
        setAgentHandoff("analysis_handoff_v1", handoff, "audio_analyst");
        const applied = applyPersistedAnalysisArtifact(reusable.artifact);
        if (!applied) {
          throw new Error("Stored analysis artifact was fresh but could not be applied to UI state.");
        }
        await onAnalysisArtifactReady({ artifact: reusable.artifact, audioPath, source: "reused" });
        setAudioAnalysisProgress(state.audioAnalysis, {
          stage: "artifact_reused",
          message: `Reused stored ${reusable.mode} audio analysis artifact.`
        });
        markOrchestrationStage(orchestrationRun, "audio_pipeline", "ok", `reused stored ${reusable.mode} analysis artifact`);
        markOrchestrationStage(orchestrationRun, "analysis_handoff", "ok", "analysis_handoff_v1 ready");
        addStructuredChatMessage("agent", buildAudioAnalystChatReply(userPrompt, handoff), {
          roleId: "audio_analyst",
          displayName: getTeamChatSpeakerLabel("audio_analyst"),
          handledBy: "audio_analyst",
          artifact: buildChatArtifactCard("analysis_handoff_v1", {
            title: str(handoff?.trackIdentity?.title || basenameOfPath(audioPath) || "Audio Analysis"),
            summary: str(handoff?.summary || state.audioAnalysis?.summary),
            chips: [
              handoff?.timing?.bpm != null ? `${handoff.timing.bpm} BPM` : "",
              str(handoff?.timing?.timeSignature),
              Array.isArray(handoff?.structure?.sections) ? `${handoff.structure.sections.length} sections` : "",
              handoff?.chords?.hasChords ? "chords ready" : "",
              `reused ${reusable.mode}`
            ]
          })
        });
        const identityAction = await maybeOfferIdentityRecommendationAction({
          audioPath,
          trackIdentity: handoff?.trackIdentity || reusable.artifact?.identity || null
        });
        const recoveryGuidance = buildLyricsRecoveryGuidance(reusable.artifact);
        if (identityAction?.applied) {
          setStatus("info", str(identityAction.message || "Applied track identity recommendation."));
        } else if (recoveryGuidance?.message) {
          setStatus(recoveryGuidance.level || "warning", recoveryGuidance.message);
        } else {
          setStatus("info", `Loaded stored ${reusable.mode} audio analysis artifact.`);
        }
        endOrchestrationRun(orchestrationRun, { status: "ok", summary: `reused stored ${reusable.mode} audio analysis artifact` });
        return { ok: true, reused: true, mode: reusable.mode };
      }

      const analysisRequest = buildAudioAnalystInput({
        requestId: orchestrationRun.id,
        mediaFilePath: audioPath,
        mediaRootPath: str(state.project?.mediaPath),
        projectFilePath: str(state.projectFilePath),
        analysisProfile: requestedAnalysisProfile,
        service: {
          baseUrl: str(state.ui.analysisServiceUrlDraft).replace(/\/+$/, ""),
          provider: resolvedProvider,
          apiKey: str(state.ui.analysisServiceApiKeyDraft),
          authBearer: str(state.ui.analysisServiceAuthBearerDraft)
        }
      });
      const flow = await executeAudioAnalystFlow({
        input: analysisRequest,
        runPipeline: async ({ input }) => runAudioAnalysisPipeline({
          analysisProfile: input?.analysisProfile || requestedAnalysisProfile,
          disableInteractivePrompts
        }),
        persistArtifact: async ({ artifact }) => {
          const artifactBridge = getDesktopAnalysisArtifactBridge();
          const projectFilePath = str(state.projectFilePath);
          const appRootPath = str(getProjectMetadataRoot());
          if (artifactBridge && projectFilePath && audioPath) {
            return artifactBridge.writeAnalysisArtifact({
              projectFilePath,
              mediaFilePath: audioPath,
              artifact
            });
          }
          if (artifactBridge && appRootPath && audioPath) {
            return artifactBridge.writeAnalysisArtifact({
              appRootPath,
              mediaFilePath: audioPath,
              artifact
            });
          }
          if (!artifactBridge) return { ok: false, error: "Audio analysis artifact bridge unavailable in this runtime." };
          return { ok: false, error: "Audio analysis artifact not persisted: app metadata root is unavailable." };
        },
        creativeBrief: state.creative?.brief || null
      });
      const result = flow.pipelineResult || null;
      const persistedArtifact = flow.artifact || null;
      if (!flow.ok || !persistedArtifact || !flow.handoff) {
        const failureSummary = str(flow?.result?.summary || "audio analysis failed");
        throw new Error(failureSummary);
      }
      markOrchestrationStage(orchestrationRun, "audio_pipeline", flow.result.status === "partial" ? "warning" : "ok", "analysis pipeline complete");
      if (Array.isArray(flow.result.warnings)) {
        for (const row of flow.result.warnings) {
          pushDiagnostic("warning", `Audio analysis: ${row}`);
        }
      }
      const applied = applyAudioAnalystFlowSuccessToState({
        flow,
        pipelineResult: result,
        fallbackSummary: buildAudioAnalysisStubSummary(),
        audioAnalysisState: state.audioAnalysis,
        setHandoff: (handoff) => setAgentHandoff("analysis_handoff_v1", handoff, "audio_analyst")
      });
      if (!applied.ok) {
        throw new Error("Audio analysis flow did not produce a valid UI projection.");
      }
      await onAnalysisArtifactReady({ artifact: persistedArtifact, audioPath, source: "fresh" });
      syncSectionSuggestionsFromAnalysisArtifact(persistedArtifact);
      setAudioAnalysisProgress(state.audioAnalysis, {
        stage: "handoff_ready",
        message: "Analysis finished and handoff is ready."
      });
      markOrchestrationStage(orchestrationRun, "analysis_handoff", "ok", "analysis_handoff_v1 ready");
      addStructuredChatMessage("agent", buildAudioAnalystChatReply(userPrompt, flow.handoff), {
        roleId: "audio_analyst",
        displayName: getTeamChatSpeakerLabel("audio_analyst"),
        handledBy: "audio_analyst",
        artifact: buildChatArtifactCard("analysis_handoff_v1", {
          title: str(flow.handoff?.trackIdentity?.title || basenameOfPath(audioPath) || "Audio Analysis"),
          summary: str(flow.handoff?.summary || state.audioAnalysis?.summary),
          chips: [
            flow.handoff?.timing?.bpm != null ? `${flow.handoff.timing.bpm} BPM` : "",
            str(flow.handoff?.timing?.timeSignature),
            Array.isArray(flow.handoff?.structure?.sections) ? `${flow.handoff.structure.sections.length} sections` : "",
            flow.handoff?.chords?.hasChords ? "chords ready" : ""
          ]
        })
      });
      const identityAction = await maybeOfferIdentityRecommendationAction({
        audioPath,
        trackIdentity: flow.handoff?.trackIdentity || persistedArtifact?.identity || null
      });
      const recoveryGuidance = buildLyricsRecoveryGuidance(persistedArtifact);
      if (identityAction?.applied) {
        setStatus("info", str(identityAction.message || "Applied track identity recommendation."));
      } else if (recoveryGuidance?.message) {
        setStatus(recoveryGuidance.level || "warning", recoveryGuidance.message);
      } else {
        setStatus("info", flow.result.status === "partial" ? "Audio analysis complete with warnings." : "Audio analysis complete.");
      }
      endOrchestrationRun(orchestrationRun, {
        status: flow.result.status === "failed" ? "failed" : "ok",
        summary: flow.result.status === "partial" ? "audio analysis complete with warnings" : "audio analysis complete"
      });
      return { ok: true, reused: false };
    } catch (err) {
      markOrchestrationStage(orchestrationRun, "audio_pipeline", "error", str(err?.message || err));
      endOrchestrationRun(orchestrationRun, { status: "failed", summary: "audio analysis failed" });
      applyAudioAnalystFlowFailureToState({
        audioAnalysisState: state.audioAnalysis,
        fallbackSummary: buildAudioAnalysisStubSummary()
      });
      setAudioAnalysisProgress(state.audioAnalysis, {
        stage: "failed",
        message: `Analysis failed: ${str(err?.message || err)}`
      });
      setStatusWithDiagnostics("warning", `Audio analysis pipeline failed: ${err.message}`);
      return { ok: false, error: str(err?.message || err) };
    } finally {
      progressTicker.stop();
      state.ui.agentThinking = false;
      saveCurrentProjectSnapshot();
      persist();
      render();
    }
  }

  return {
    analyzeAudio
  };
}
