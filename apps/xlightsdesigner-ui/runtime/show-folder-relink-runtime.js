function str(value = "") {
  return String(value || "").trim();
}

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

export async function relinkProjectShowFolder({
  state = {},
  showFolder = "",
  reason = "show folder changed",
  deps = {}
} = {}) {
  const targetShowFolder = str(showFolder);
  if (!targetShowFolder) {
    return { ok: false, error: "showFolder is required." };
  }
  const previousShowFolder = str(state.showFolder);
  const changed = previousShowFolder !== targetShowFolder;
  if (!changed) {
    return {
      ok: true,
      changed: false,
      showFolder: targetShowFolder,
      previousShowFolder
    };
  }

  const {
    markDisplayMetadataPendingReconciliation = () => {},
    reconcileDisplayMetadataForSceneGraphChange = () => null,
    clearSequencingHandoffsForSequenceChange = () => {},
    onRefreshSequenceCatalog = async () => null,
    onRefreshMediaCatalog = async () => null,
    onRefreshDisplay = async () => null,
    saveProjectToCurrentFile = async () => null,
    persist = () => {},
    render = () => {},
    setStatus = () => {}
  } = deps;

  state.showFolder = targetShowFolder;
  state.sequenceAgentRuntime = isObject(state.sequenceAgentRuntime) ? state.sequenceAgentRuntime : {};
  state.sequenceAgentRuntime.displayRelink = {
    previousShowFolder,
    showFolder: targetShowFolder,
    reason: str(reason) || "show folder changed",
    changedAt: new Date().toISOString()
  };
  if (state.flags && typeof state.flags === "object") {
    state.flags.proposalStale = true;
    state.flags.hasDraftProposal = Array.isArray(state.proposed) && state.proposed.length > 0;
  }

  markDisplayMetadataPendingReconciliation(str(reason) || "show folder changed");
  clearSequencingHandoffsForSequenceChange("show folder changed");

  const results = {
    sequenceCatalog: await onRefreshSequenceCatalog({ silent: true, reason: "show_folder_relink" }),
    mediaCatalog: await onRefreshMediaCatalog({ silent: true, reason: "show_folder_relink" }),
    displayRefresh: await onRefreshDisplay({ silent: true, reason: "show_folder_relink" })
  };
  const reconciliation = reconcileDisplayMetadataForSceneGraphChange({ reason: "show folder relink" });
  const save = await saveProjectToCurrentFile({ saveAs: false, reason: "show_folder_relink" });

  setStatus("info", `Show folder linked: ${targetShowFolder}`);
  persist();
  render();

  return {
    ok: true,
    changed: true,
    previousShowFolder,
    showFolder: targetShowFolder,
    reconciliation,
    save,
    results
  };
}
