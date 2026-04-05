import { executeXLightsRefreshCycle } from "./xlights-runtime.js";

function str(value = "") {
  return String(value || "").trim();
}

export function createSequenceMediaSessionRuntime(deps = {}) {
  const {
    state,
    setStatus = () => {},
    setStatusWithDiagnostics = () => {},
    render = () => {},
    persist = () => {},
    saveCurrentProjectSnapshot = () => {},
    invalidateAnalysisHandoff = () => {},
    resetDerivedAudioAnalysisState = () => {},
    hydrateAnalysisArtifactForCurrentMedia = async () => ({ ok: false }),
    hydrateAgentHealth = async () => {},
    syncLatestSequenceRevision = async () => ({ ok: false }),
    refreshMetadataTargetsFromXLights = async () => {},
    refreshEffectCatalogFromXLights = async () => {},
    fetchSectionSuggestions = async () => {},
    refreshApplyHistoryFromDesktop = async () => {},
    applyRolloutPolicy = () => ({ mode: "full" }),
    releaseConnectivityPlanOnly = () => {},
    enforceConnectivityPlanOnly = () => {},
    isSequenceAllowedInActiveShowFolder = () => true,
    currentSequencePathForSidecar = () => "",
    clearIgnoredExternalSequenceNote = () => {},
    clearDesignerDraft = () => {},
    clearSequencingHandoffsForSequenceChange = () => {},
    invalidateApplyApproval = () => {},
    hydrateSidecarForCurrentSequence = async () => {},
    updateSequenceFileMtime = () => {},
    maybeFlushSidecarAfterExternalSave = async () => {},
    noteIgnoredExternalSequence = () => {},
    pushDiagnostic = () => {},
    withTimeout = async (promise) => promise,
    resolveReachableEndpoint = null,
    closeActiveSequenceForSwitch = async () => {},
    traceSequenceFileLifecycle = async (_label, _path, fn) => fn(),
    openSequenceApi = async () => ({}),
    createSequenceApi = async () => ({}),
    saveSequenceApi = async () => ({}),
    closeSequenceApi = async () => ({}),
    getOpenSequence = async () => ({}),
    getMediaStatus = async () => ({}),
    selectedSequencePath = () => "",
    syncSequencePathInput = () => {},
    resetCreativeState = () => {},
    readSequencePathFromPayload = () => "",
    onRefreshMediaCatalog = async () => {},
    onRefresh = async () => {},
    basenameOfPath = () => ""
  } = deps;

  async function resolveActiveEndpoint() {
    if (typeof resolveReachableEndpoint !== "function") {
      return str(state.endpoint);
    }
    const resolved = await resolveReachableEndpoint(str(state.endpoint));
    const endpoint = str(resolved?.endpoint || state.endpoint);
    if (endpoint) {
      state.endpoint = endpoint;
    }
    return endpoint;
  }

  function setAudioPathWithAgentPolicy(nextPath = "", reason = "audio path updated") {
    const prev = str(state.audioPathInput);
    const next = str(nextPath);
    state.audioPathInput = next;
    if (prev !== next) {
      invalidateAnalysisHandoff(reason, { cascadePlan: true });
      resetDerivedAudioAnalysisState();
      if (next) {
        void hydrateAnalysisArtifactForCurrentMedia({ silent: true }).then((res) => {
          if (res?.ok) {
            saveCurrentProjectSnapshot();
            persist();
            render();
          }
        });
      }
    }
  }

  function adoptMediaDirectoryFromPath(mediaFilePath = "") {
    const mediaPath = str(mediaFilePath);
    if (!mediaPath || !mediaPath.includes("/")) return false;
    const nextMediaDir = mediaPath.slice(0, mediaPath.lastIndexOf("/")).trim();
    if (!nextMediaDir) return false;
    if (str(state.mediaPath) === nextMediaDir) return false;
    state.mediaPath = nextMediaDir;
    return true;
  }

  function applySequenceMediaToAudioPath(sequenceData) {
    if (!sequenceData || typeof sequenceData !== "object") return;
    const mediaFile = str(sequenceData.mediaFile);
    state.sequenceMediaFile = mediaFile || "";
    if (mediaFile) adoptMediaDirectoryFromPath(mediaFile);
    if (!str(state.audioPathInput) && mediaFile) {
      setAudioPathWithAgentPolicy(mediaFile, "sequence media adopted as initial analysis track");
    }
  }

  async function syncAudioPathFromMediaStatus() {
    try {
      const endpoint = await resolveActiveEndpoint();
      const mediaBody = await getMediaStatus(endpoint);
      const mediaFile = str(mediaBody?.data?.mediaFile);
      state.sequenceMediaFile = mediaFile || "";
      const mediaDirChanged = mediaFile ? adoptMediaDirectoryFromPath(mediaFile) : false;
      if (mediaDirChanged) {
        await onRefreshMediaCatalog({ silent: true });
      }
      if (!str(state.audioPathInput) && mediaFile) {
        setAudioPathWithAgentPolicy(mediaFile, "media status adopted as initial analysis track");
      }
    } catch {
      try {
        const endpoint = await resolveActiveEndpoint();
        const open = await getOpenSequence(endpoint);
        const seq = open?.data?.sequence;
        applySequenceMediaToAudioPath(seq);
      } catch {
        // ignore legacy builds without sequence media status
      }
    }
  }

  function applyOpenSequenceState(sequencePayload, fallbackPath = "") {
    const previousSequencePath = str(state.sequencePathInput);
    const sequencePath = readSequencePathFromPayload(sequencePayload, fallbackPath);
    const sequenceChanged = Boolean(sequencePath) && sequencePath !== previousSequencePath;
    const sequenceName = str(
      sequencePayload?.name ||
      (sequencePath ? sequencePath.split("/").pop() : "") ||
      state.activeSequence ||
      ""
    );
    const mediaPath = sequencePayload?.mediaFile == null ? "" : str(sequencePayload.mediaFile);

    state.sequenceSettings = {
      sequenceType: str(sequencePayload?.sequenceType || state.sequenceSettings?.sequenceType || "Media") || "Media",
      supportsModelBlending: Boolean(sequencePayload?.supportsModelBlending)
    };

    if (sequenceName) state.activeSequence = sequenceName;
    if (sequencePath) {
      state.sequencePathInput = sequencePath;
      state.savePathInput = sequencePath;
      state.ui.sequenceMode = "existing";
      if (typeof deps.addRecentSequence === "function") deps.addRecentSequence(sequencePath);
    }
    state.sequenceMediaFile = mediaPath;
    if (mediaPath && (sequenceChanged || !str(state.audioPathInput))) {
      setAudioPathWithAgentPolicy(
        mediaPath,
        sequenceChanged
          ? "open sequence media adopted for sequence switch"
          : "open sequence media adopted as initial analysis track"
      );
    }
  }

  async function refresh() {
    state.ui.firstRunMode = false;
    const prevDraftSequencePath = str(state.draftSequencePath);
    try {
      const endpoint = await resolveActiveEndpoint();
      await hydrateAgentHealth();
      await executeXLightsRefreshCycle({
        state,
        endpoint,
        deps: {
          getOpen: getOpenSequence,
          syncRevision: () => syncLatestSequenceRevision({
            onStaleMessage: "Sequence changed since draft creation. Refresh proposal before apply.",
            onUnknownMessage: ""
          }),
          refreshMetadata: refreshMetadataTargetsFromXLights,
          refreshEffects: refreshEffectCatalogFromXLights,
          refreshSections: fetchSectionSuggestions,
          refreshHistory: () => refreshApplyHistoryFromDesktop(40)
        },
        callbacks: {
          applyRolloutPolicy,
          releaseConnectivityPlanOnly,
          enforceConnectivityPlanOnly,
          isSequenceAllowed: isSequenceAllowedInActiveShowFolder,
          currentSequencePath: currentSequencePathForSidecar,
          clearIgnoredExternalSequenceNote,
          applyOpenSequenceState,
          onSequenceChanged: ({ previousPath = "", nextPath = "" } = {}) => {
            if (nextPath && nextPath !== previousPath) {
              clearDesignerDraft(state);
              state.agentPlan = null;
              state.creative = state.creative || {};
              state.creative.intentHandoff = null;
              clearSequencingHandoffsForSequenceChange("sequence changed");
              invalidateApplyApproval();
            }
          },
          onSequenceCleared: () => {
            clearDesignerDraft(state);
            state.agentPlan = null;
            state.creative = state.creative || {};
            state.creative.intentHandoff = null;
            clearSequencingHandoffsForSequenceChange("sequence cleared");
            invalidateApplyApproval();
          },
          syncAudioPathFromMediaStatus,
          hydrateSidecarForCurrentSequence,
          updateSequenceFileMtime,
          maybeFlushSidecarAfterExternalSave,
          noteIgnoredExternalSequence,
          onWarning: (text, details = "") => setStatusWithDiagnostics("warning", text, details),
          onInfo: (text) => setStatus("info", text)
        }
      });
      const nextSequencePath = currentSequencePathForSidecar();
      if (prevDraftSequencePath && nextSequencePath && nextSequencePath !== prevDraftSequencePath) {
        clearDesignerDraft(state);
        state.agentPlan = null;
        state.creative = state.creative || {};
        state.creative.intentHandoff = null;
        clearSequencingHandoffsForSequenceChange("sequence changed");
        invalidateApplyApproval();
      }
    } catch (err) {
      state.flags.xlightsConnected = false;
      enforceConnectivityPlanOnly();
      setStatusWithDiagnostics("warning", `Refresh failed: ${err.message}`, err?.stack || "");
    }
    persist();
    render();
  }

  async function openSequence({ previousPath, targetPath, isNewSequence = false, mediaFile = null, durationMs, frameMs, skipPostOpenRefresh = false } = {}) {
    if (!state.flags.xlightsConnected) {
      setStatus("warning", "Connect to xLights before opening a sequence.");
      render();
      return;
    }
    if (!targetPath) {
      setStatus("warning", isNewSequence ? "Provide a new sequence path." : "Provide an existing sequence path.");
      render();
      return;
    }

    setStatus("info", isNewSequence ? "Creating sequence..." : "Opening sequence...");
    render();
    let failureStage = "open";
    try {
      failureStage = "resolve_endpoint";
      const endpoint = await resolveActiveEndpoint();
      if (!isNewSequence) {
        try {
          failureStage = "pre_close";
          await closeActiveSequenceForSwitch({ mode: "discard-unsaved" });
        } catch (err) {
          pushDiagnostic("warning", `Pre-open close failed; forcing sequence switch: ${err?.message || err}`);
        }
      }
      failureStage = isNewSequence ? "sequence_create" : "sequence_open";
      const body = isNewSequence
        ? await createSequenceApi(endpoint, { file: targetPath, mediaFile, durationMs, frameMs })
        : await traceSequenceFileLifecycle("sequence.open", targetPath, () => openSequenceApi(endpoint, targetPath, true, false));
      if (isNewSequence) {
        failureStage = "sequence_save";
        await traceSequenceFileLifecycle("sequence.create+save", targetPath, async () => {
          await saveSequenceApi(endpoint, targetPath);
          if (typeof deps.assertSequenceFileSafeAfterSave === "function") {
            await deps.assertSequenceFileSafeAfterSave(targetPath, "New sequence save");
          }
          return body;
        });
      }
      const seq = body?.data?.sequence || body?.data || {};
      applyOpenSequenceState(seq, targetPath);
      if (targetPath !== previousPath) {
        state.lastApplyBackupPath = "";
        resetCreativeState();
        state.ui.agentResponseId = "";
      }
      state.flags.activeSequenceLoaded = true;
      setStatus("info", `${isNewSequence ? "Sequence ready" : "Opened sequence"}: ${state.activeSequence || targetPath}`);
      state.route = "sequence";
      render();

      try {
        failureStage = "sidecar_hydrate";
        await withTimeout(hydrateSidecarForCurrentSequence(), 3000, "Hydrate sidecar");
      } catch (err) {
        pushDiagnostic("warning", `Post-open sidecar hydrate timed out: ${err.message}`);
      }
      try {
        failureStage = "media_sync";
        await withTimeout(syncAudioPathFromMediaStatus(), 3000, "Sync media status");
      } catch (err) {
        pushDiagnostic("warning", `Post-open media sync timed out: ${err.message}`);
      }
      if (!skipPostOpenRefresh) {
        try {
          failureStage = "post_open_refresh";
          await withTimeout(onRefresh(), 6000, "Post-open refresh");
        } catch (err) {
          pushDiagnostic("warning", `Post-open refresh timed out: ${err.message}`);
          setStatus("warning", "Sequence opened, but refresh is taking too long. You can continue and use Refresh if needed.");
        }
      }
    } catch (err) {
      setStatusWithDiagnostics("action-required", `Open failed [${failureStage}]: ${err.message}`, err?.stack || "");
      render();
    } finally {
      saveCurrentProjectSnapshot();
      persist();
      render();
    }
  }

  async function openCurrentSequence() {
    syncSequencePathInput();
    const previousPath = selectedSequencePath();
    const targetPath = selectedSequencePath();
    if (state.ui.sequenceMode === "new" && state.newSequenceType === "musical" && !state.audioPathInput) {
      setStatus("warning", "Musical sequence requires an audio file path.");
      render();
      return;
    }
    const isAnimation = state.newSequenceType === "animation";
    const mediaFile = isAnimation ? null : (state.audioPathInput || null);
    const durationMs = isAnimation || !mediaFile ? state.newSequenceDurationMs : undefined;
    return openSequence({
      previousPath,
      targetPath,
      isNewSequence: state.ui.sequenceMode === "new",
      mediaFile,
      durationMs,
      frameMs: state.newSequenceFrameMs
    });
  }

  async function openExistingSequence(targetPathInput = "", options = {}) {
    return openSequence({
      previousPath: str(state.sequencePathInput),
      targetPath: str(targetPathInput || state.sequencePathInput),
      isNewSequence: false,
      skipPostOpenRefresh: options?.skipPostOpenRefresh === true
    });
  }

  async function closeSequenceWithPrompt({
    confirm = () => true
  } = {}) {
    if (!state.flags.xlightsConnected) {
      setStatusWithDiagnostics("warning", "Connect to xLights before closing sequence.");
      render();
      return;
    }
    if (!confirm("Close active sequence in xLights?")) {
      setStatus("info", "Close sequence canceled.");
      render();
      return;
    }
    setStatus("info", "Closing sequence...");
    render();
    try {
      const endpoint = await resolveActiveEndpoint();
      await closeSequenceApi(endpoint, true, false);
      state.flags.activeSequenceLoaded = false;
      state.revision = "unknown";
      state.activeSequence = "(none)";
      if (typeof deps.resetSessionDraftState === "function") deps.resetSessionDraftState();
      resetCreativeState();
      setStatus("info", "Sequence closed.");
    } catch (err) {
      setStatusWithDiagnostics("action-required", `Close failed: ${err.message}`, err?.stack || "");
    } finally {
      saveCurrentProjectSnapshot();
      persist();
      render();
    }
  }

  return {
    setAudioPathWithAgentPolicy,
    adoptMediaDirectoryFromPath,
    applySequenceMediaToAudioPath,
    syncAudioPathFromMediaStatus,
    applyOpenSequenceState,
    refresh,
    openCurrentSequence,
    openExistingSequence,
    closeSequenceWithPrompt
  };
}
