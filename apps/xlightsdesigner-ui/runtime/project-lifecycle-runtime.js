function str(value = "") {
  return String(value || "").trim();
}

export function normalizeProjectDisplayName(value) {
  return String(value || "")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");
}

export function buildCanonicalProjectFilePath(rootPath, projectName) {
  const root = str(rootPath).replace(/[\\/]+$/, "");
  const normalizedName = normalizeProjectDisplayName(projectName);
  if (!root || !normalizedName) return "";
  return `${root}/projects/${normalizedName}/${normalizedName}.xdproj`;
}

export function inferProjectRootFromFilePath(filePath) {
  const raw = str(filePath).replace(/\\/g, "/");
  if (!raw) return "";
  const marker = "/projects/";
  const idx = raw.lastIndexOf(marker);
  if (idx < 0) return "";
  return raw.slice(0, idx);
}

export function createProjectLifecycleRuntime(deps = {}) {
  const {
    state,
    app,
    defaultState,
    storageKey = "",
    projectsKey = "",
    resetPreserveKey = "",
    defaultTeamChatIdentities = [],
    setStatus = () => {},
    setStatusWithDiagnostics = () => {},
    render = () => {},
    persist = () => {},
    saveCurrentProjectSnapshot = () => {},
    getDesktopProjectBridge = () => null,
    getDesktopAppAdminBridge = () => null,
    getDesktopStateBridge = () => null,
    hydrateAnalysisArtifactForCurrentMedia = async () => ({ ok: false }),
    onRefreshSequenceCatalog = async () => {},
    onRefreshMediaCatalog = async () => {},
    applyProjectSnapshot = () => {},
    parseProjectKey = () => ({ projectName: "", showFolder: "" }),
    loadProjectsStore = () => ({}),
    persistProjectsStore = () => {},
    extractProjectSnapshot = () => ({}),
    saveProjectToCurrentFile = async () => ({ ok: false, error: "save unavailable" }),
    resetSessionDraftState = () => {},
    resetCreativeState = () => {},
    buildTeamChatIdentities = (rows) => rows,
    confirm = () => true,
    reload = () => {},
    localStorageRef = globalThis.localStorage,
    sessionStorageRef = globalThis.sessionStorage
  } = deps;

  function syncProjectSummaryInputs() {
    const showFolderInput = app?.querySelector?.("#showfolder-input");
    const mediaPathInput = app?.querySelector?.("#mediapath-input");
    const metadataRootInput = app?.querySelector?.("#project-metadata-root-input");
    if (showFolderInput) state.showFolder = showFolderInput.value.trim() || state.showFolder;
    if (mediaPathInput) state.mediaPath = mediaPathInput.value.trim() || "";
    if (metadataRootInput) state.projectMetadataRoot = metadataRootInput.value.trim();
  }

  function openProjectNameDialog({ mode, title, initialName = "" }) {
    state.ui.projectNameDialogOpen = true;
    state.ui.projectNameDialogMode = str(mode);
    state.ui.projectNameDialogTitle = String(title || "Project name");
    state.ui.projectNameDialogValue = String(initialName || "");
    state.ui.projectNameDialogError = "";
    persist();
    render();
  }

  function closeProjectNameDialog() {
    state.ui.projectNameDialogOpen = false;
    state.ui.projectNameDialogMode = "";
    state.ui.projectNameDialogTitle = "";
    state.ui.projectNameDialogValue = "";
    state.ui.projectNameDialogError = "";
    persist();
    render();
  }

  async function confirmProjectNameDialog() {
    const mode = str(state.ui.projectNameDialogMode);
    const normalizedName = normalizeProjectDisplayName(state.ui.projectNameDialogValue || "");
    if (!normalizedName) {
      state.ui.projectNameDialogError = "Project name is required.";
      persist();
      render();
      return;
    }

    const previousName = str(state.projectName);
    state.projectName = normalizedName;

    if (mode === "create") {
      state.projectFilePath = "";
      resetSessionDraftState();
      resetCreativeState();
      state.flags.activeSequenceLoaded = false;
      state.activeSequence = "";
      state.sequencePathInput = "";
      state.newSequencePathInput = "";
      state.audioPathInput = "";
      state.mediaPath = "";
      state.savePathInput = "";
      state.recentSequences = [];
      state.projectSequences = [];
      state.projectCreatedAt = "";
      state.projectUpdatedAt = "";

      const saved = await saveProjectToCurrentFile({ saveAs: false });
      if (!saved?.ok) {
        state.ui.projectNameDialogError = "";
        closeProjectNameDialog();
        setStatusWithDiagnostics("warning", `Created new project but initial save failed: ${saved?.error || "unknown error"}`);
      } else {
        state.ui.firstRunMode = false;
        state.ui.projectNameDialogError = "";
        closeProjectNameDialog();
        setStatus("info", `Created new project: ${state.projectName}`);
      }
      saveCurrentProjectSnapshot();
      persist();
      render();
      return;
    }

    if (mode === "saveAs") {
      const saved = await saveProjectToCurrentFile({ saveAs: true });
      if (saved?.ok) {
        state.ui.projectNameDialogError = "";
        closeProjectNameDialog();
        setStatus("info", `Saved project as: ${saved.filePath}`);
      } else if (saved?.code === "CANCELED") {
        state.projectName = previousName;
        closeProjectNameDialog();
        setStatus("info", "Save As canceled.");
      } else {
        state.projectName = previousName;
        state.ui.projectNameDialogError = "";
        closeProjectNameDialog();
        setStatusWithDiagnostics("action-required", `Save As failed: ${saved?.error || "unknown error"}`);
      }
      saveCurrentProjectSnapshot();
      persist();
      render();
    }
  }

  async function openSelectedProject(selectedKeyArg = "") {
    syncProjectSummaryInputs();
    if (selectedKeyArg && typeof selectedKeyArg === "object") {
      selectedKeyArg = "";
    }
    let selectedKey = str(selectedKeyArg);
    const bridge = getDesktopProjectBridge();
    if (!bridge) {
      setStatusWithDiagnostics("warning", "Open project requires desktop runtime.");
      render();
      return;
    }

    if (!selectedKey) {
      const dialogRes = await bridge.openProjectDialog({ rootPath: state.projectMetadataRoot });
      if (!dialogRes?.ok || !dialogRes?.filePath) {
        setStatus("info", "Open project canceled.");
        render();
        return;
      }
      const fileRes = await bridge.openProjectFile({ filePath: dialogRes.filePath });
      if (!fileRes?.ok || !fileRes?.snapshot) {
        setStatusWithDiagnostics("warning", `Open failed: ${fileRes?.error || "Invalid project file."}`);
        render();
        return;
      }
      if (fileRes.project?.appRootPath) state.projectMetadataRoot = String(fileRes.project.appRootPath);
      state.projectFilePath = String(dialogRes.filePath);
      state.projectName = String(fileRes.project?.projectName || state.projectName);
      state.showFolder = String(fileRes.project?.showFolder || state.showFolder);
      state.mediaPath = String(fileRes.project?.mediaPath || state.mediaPath);
      state.projectCreatedAt = String(fileRes.project?.createdAt || state.projectCreatedAt || "");
      state.projectUpdatedAt = String(fileRes.project?.updatedAt || state.projectUpdatedAt || "");
      applyProjectSnapshot(fileRes.snapshot);
      setStatus("info", `Opened project: ${state.projectName}`);
      persist();
      render();
      void hydrateAnalysisArtifactForCurrentMedia({ silent: true }).then((res) => {
        if (res?.ok) {
          saveCurrentProjectSnapshot();
          persist();
          render();
        }
      });
      void onRefreshSequenceCatalog({ silent: true });
      void onRefreshMediaCatalog({ silent: true });
      return;
    }

    const { projectName, showFolder } = parseProjectKey(selectedKey);
    if (!projectName) {
      setStatus("warning", "Selected project key is invalid.");
      render();
      return;
    }

    const rootPath = state.projectMetadataRoot || inferProjectRootFromFilePath(state.projectFilePath);
    if (!rootPath) {
      setStatusWithDiagnostics("warning", "Open failed: project metadata folder is not set.");
      render();
      return;
    }
    const guessedFilePath = buildCanonicalProjectFilePath(rootPath, projectName);
    const fileRes = await bridge.openProjectFile({ filePath: guessedFilePath });
    if (!fileRes?.ok || !fileRes?.snapshot) {
      setStatusWithDiagnostics("warning", `Open failed: ${fileRes?.error || "Invalid project file."}`);
      render();
      return;
    }
    state.projectFilePath = guessedFilePath;
    if (fileRes.project?.appRootPath) state.projectMetadataRoot = String(fileRes.project.appRootPath);
    state.projectName = String(fileRes.project?.projectName || projectName);
    state.showFolder = String(fileRes.project?.showFolder || showFolder);
    state.mediaPath = String(fileRes.project?.mediaPath || state.mediaPath);
    state.projectCreatedAt = String(fileRes.project?.createdAt || state.projectCreatedAt || "");
    state.projectUpdatedAt = String(fileRes.project?.updatedAt || state.projectUpdatedAt || "");
    applyProjectSnapshot(fileRes.snapshot);
    setStatus("info", `Opened project: ${state.projectName}`);
    persist();
    render();
    void hydrateAnalysisArtifactForCurrentMedia({ silent: true }).then((res) => {
      if (res?.ok) {
        saveCurrentProjectSnapshot();
        persist();
        render();
      }
    });
    void onRefreshSequenceCatalog({ silent: true });
    void onRefreshMediaCatalog({ silent: true });
  }

  function createNewProject() {
    syncProjectSummaryInputs();
    const bridge = getDesktopProjectBridge();
    if (!bridge) {
      setStatusWithDiagnostics("warning", "New project requires desktop runtime.");
      render();
      return;
    }
    openProjectNameDialog({
      mode: "create",
      title: "Create New Project",
      initialName: ""
    });
  }

  function saveProjectAs() {
    syncProjectSummaryInputs();
    const previousName = str(state.projectName);
    openProjectNameDialog({
      mode: "saveAs",
      title: "Save Project As",
      initialName: previousName || "Project"
    });
  }

  function resetProjectWorkspace() {
    const key = typeof deps.getProjectKey === "function" ? deps.getProjectKey() : "";
    if (!key || key === "::") {
      setStatus("warning", "Set project name and show folder before reset.");
      render();
      return;
    }
    if (!confirm("Reset current project workspace to defaults?")) {
      setStatus("info", "Workspace reset canceled.");
      render();
      return;
    }

    state.sequencePathInput = defaultState.sequencePathInput;
    state.newSequencePathInput = defaultState.newSequencePathInput;
    state.newSequenceType = defaultState.newSequenceType;
    state.newSequenceDurationMs = defaultState.newSequenceDurationMs;
    state.newSequenceFrameMs = defaultState.newSequenceFrameMs;
    state.audioPathInput = defaultState.audioPathInput;
    state.mediaPath = defaultState.mediaPath;
    state.mediaCatalog = [];
    state.savePathInput = defaultState.savePathInput;
    state.lastApplyBackupPath = defaultState.lastApplyBackupPath;
    state.recentSequences = [];
    state.projectSequences = [];
    state.revision = "unknown";
    state.draftBaseRevision = "unknown";
    state.proposed = [...defaultState.proposed];
    state.flags.planOnlyMode = false;
    state.flags.planOnlyForcedByConnectivity = false;
    state.flags.planOnlyForcedByRollout = false;
    state.flags.hasDraftProposal = state.proposed.length > 0;
    state.flags.proposalStale = false;
    state.ui.sectionSelections = ["all"];
    state.ui.designTab = "chat";
    state.ui.designRevisionTarget = null;
    state.ui.sequenceDesignFilterId = "";
    state.ui.sequenceMode = "existing";
    state.ui.sectionTrackName = "";
    state.ui.metadataTargetId = "";
    state.ui.metadataSelectionIds = [];
    state.ui.metadataSelectedTags = [];
    state.ui.metadataNewTag = "";
    state.ui.metadataNewTagDescription = "";
    state.ui.agentResponseId = "";
    state.ui.metadataFilterName = "";
    state.ui.metadataFilterType = "";
    state.ui.metadataFilterRole = "";
    state.ui.metadataFilterVisualHints = "";
    state.ui.metadataFilterEffectAvoidances = "";
    state.ui.metadataFilterSupport = "";
    state.ui.metadataFilterTags = "";
    state.ui.metadataFilterMetadata = "";
    state.ui.metadataFilterDimension = "overall";
    state.ui.detailsOpen = false;
    state.chat = [];
    state.ui.chatDraft = "";
    state.diagnostics = [];
    state.jobs = [];
    state.sectionStartByLabel = {};
    state.metadata = structuredClone(defaultState.metadata);
    resetCreativeState();

    const store = loadProjectsStore();
    store[key] = extractProjectSnapshot();
    persistProjectsStore(store);

    setStatus("info", "Project workspace reset.");
    persist();
    render();
  }

  async function resetAppInstallState() {
    const bridge = getDesktopAppAdminBridge();
    if (!bridge) {
      setStatusWithDiagnostics("warning", "Fresh-install reset requires desktop runtime.");
      render();
      return;
    }
    if (!confirm("Reset app state to first-run defaults? This clears local app state, recent-project index, chat history, and UI memory, but preserves stored API keys, project folders, and analysis artifacts.")) {
      setStatus("info", "Fresh-install reset canceled.");
      render();
      return;
    }
    try {
      const res = await bridge.resetAppInstallState({ resetMode: "app-state-only" });
      if (!res?.ok) {
        setStatusWithDiagnostics("action-required", "Fresh-install reset failed.", String(res?.error || "Unknown error"));
        render();
        return;
      }
      const preservedState = structuredClone(defaultState);
      preservedState.route = "settings";
      preservedState.projectName = "";
      preservedState.projectConcept = "";
      preservedState.showFolder = "";
      preservedState.mediaPath = "";
      preservedState.projectFilePath = "";
      preservedState.activeSequence = "";
      preservedState.sequencePathInput = "";
      preservedState.newSequencePathInput = "";
      preservedState.audioPathInput = "";
      preservedState.savePathInput = "";
      preservedState.lastApplyBackupPath = "";
      preservedState.recentSequences = [];
      preservedState.projectCreatedAt = "";
      preservedState.projectUpdatedAt = "";
      preservedState.revision = "unknown";
      preservedState.status = {
        level: "info",
        text: "Welcome. Start in Settings, then create or open a project when you are ready."
      };
      preservedState.flags.xlightsConnected = false;
      preservedState.flags.activeSequenceLoaded = false;
      preservedState.health.sequenceOpen = false;
      preservedState.ui.firstRunMode = true;
      preservedState.ui.agentModelDraft = String(state.ui.agentModelDraft || "");
      preservedState.ui.agentBaseUrlDraft = String(state.ui.agentBaseUrlDraft || "");
      preservedState.ui.analysisServiceUrlDraft = String(state.ui.analysisServiceUrlDraft || "");
      preservedState.ui.analysisServiceApiKeyDraft = String(state.ui.analysisServiceApiKeyDraft || "");
      preservedState.ui.analysisServiceAuthBearerDraft = String(state.ui.analysisServiceAuthBearerDraft || "");
      preservedState.chat = [];
      preservedState.ui.chatDraft = "";
      preservedState.teamChat = {
        identities: buildTeamChatIdentities(defaultTeamChatIdentities)
      };
      const preservedRaw = JSON.stringify(preservedState);
      try {
        localStorageRef?.removeItem?.(storageKey);
        localStorageRef?.removeItem?.(projectsKey);
        localStorageRef?.setItem?.(storageKey, preservedRaw);
        localStorageRef?.setItem?.(projectsKey, "");
        sessionStorageRef?.setItem?.(resetPreserveKey, preservedRaw);
      } catch {
        // ignore local storage cleanup failures
      }
      try {
        const stateBridge = getDesktopStateBridge();
        if (stateBridge && typeof stateBridge.writeAppState === "function") {
          await stateBridge.writeAppState({
            localStateRaw: preservedRaw,
            projectsStoreRaw: ""
          });
        }
      } catch {
        // best effort
      }
      state.chat = [];
      state.ui.chatDraft = "";
      persist();
      reload();
    } catch (err) {
      setStatusWithDiagnostics("action-required", "Fresh-install reset failed.", String(err?.message || err));
      render();
    }
  }

  return {
    syncProjectSummaryInputs,
    openProjectNameDialog,
    closeProjectNameDialog,
    confirmProjectNameDialog,
    openSelectedProject,
    createNewProject,
    saveProjectAs,
    resetProjectWorkspace,
    resetAppInstallState
  };
}
