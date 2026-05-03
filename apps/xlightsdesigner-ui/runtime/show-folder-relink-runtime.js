function str(value = "") {
  return String(value || "").trim();
}

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function normalizePath(value = "") {
  return str(value).replace(/\\/g, "/").replace(/\/+$/g, "");
}

function pathWithinRoot(candidatePath = "", rootPath = "") {
  const candidate = normalizePath(candidatePath);
  const root = normalizePath(rootPath);
  if (!candidate || !root) return false;
  return candidate === root || candidate.startsWith(`${root}/`);
}

function remapPathBetweenShowFolders(candidatePath = "", previousShowFolder = "", showFolder = "") {
  const candidate = normalizePath(candidatePath);
  const previous = normalizePath(previousShowFolder);
  const next = normalizePath(showFolder);
  if (!candidate || !previous || !next || !pathWithinRoot(candidate, previous)) return "";
  if (candidate === previous) return next;
  return `${next}/${candidate.slice(previous.length + 1)}`;
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
  for (const key of ["mediaPath", "audioPathInput", "sequenceMediaFile"]) {
    const remapped = remapPathBetweenShowFolders(state[key], previousShowFolder, targetShowFolder);
    if (remapped) state[key] = remapped;
  }
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
