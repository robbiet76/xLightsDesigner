export function createProjectSnapshotRuntime(deps = {}) {
  const {
    state,
    projectsKey = "",
    localStorageRef = globalThis?.localStorage,
    queueDesktopStatePersist = () => {},
    extractProjectSnapshot = () => ({}),
    applyProjectSnapshot = () => {}
  } = deps;

  function getProjectKey(projectName = state.projectName, showFolder = state.showFolder) {
    return `${(projectName || "").trim()}::${(showFolder || "").trim()}`;
  }

  function parseProjectKey(key) {
    const raw = String(key || "");
    const idx = raw.indexOf("::");
    if (idx < 0) return { projectName: raw.trim(), showFolder: "" };
    return {
      projectName: raw.slice(0, idx).trim(),
      showFolder: raw.slice(idx + 2).trim()
    };
  }

  function loadProjectsStore() {
    try {
      const raw = localStorageRef?.getItem?.(projectsKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function persistProjectsStore(store) {
    localStorageRef?.setItem?.(projectsKey, JSON.stringify(store));
    queueDesktopStatePersist();
  }

  function saveCurrentProjectSnapshot() {
    const key = getProjectKey();
    if (!key || key === "::") return;
    const store = loadProjectsStore();
    store[key] = extractProjectSnapshot();
    persistProjectsStore(store);
  }

  function deleteProjectSnapshot(projectName, showFolder) {
    const key = getProjectKey(projectName, showFolder);
    if (!key || key === "::") return;
    const store = loadProjectsStore();
    if (!(key in store)) return;
    delete store[key];
    persistProjectsStore(store);
  }

  function tryLoadProjectSnapshot(projectName, showFolder) {
    const key = getProjectKey(projectName, showFolder);
    const store = loadProjectsStore();
    const snapshot = store[key];
    if (!snapshot) return false;
    applyProjectSnapshot(snapshot);
    return true;
  }

  return {
    getProjectKey,
    parseProjectKey,
    loadProjectsStore,
    persistProjectsStore,
    saveCurrentProjectSnapshot,
    deleteProjectSnapshot,
    tryLoadProjectSnapshot
  };
}
