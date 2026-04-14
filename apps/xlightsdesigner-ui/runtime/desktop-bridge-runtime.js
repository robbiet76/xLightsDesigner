function currentWindow() {
  return typeof window !== "undefined" ? window : null;
}

function requireFunctions(bridge, names = []) {
  if (!bridge) return null;
  for (const name of names) {
    if (typeof bridge[name] !== "function") return null;
  }
  return bridge;
}

export function getDesktopBridge() {
  const w = currentWindow();
  if (!w) return null;
  return w.xlightsDesignerDesktop || w.__xlightsDesignerDesktop || null;
}

export function getDesktopStateBridge() {
  return requireFunctions(getDesktopBridge(), ["readAppState", "writeAppState"]);
}

export function getDesktopAppInfoBridge() {
  return requireFunctions(getDesktopBridge(), ["getAppInfo"]);
}

export function getDesktopAppAdminBridge() {
  return requireFunctions(getDesktopBridge(), ["resetAppInstallState"]);
}

export function getDesktopSidecarBridge() {
  return requireFunctions(getDesktopBridge(), ["readSequenceSidecar", "writeSequenceSidecar"]);
}

export function getDesktopFileStatBridge() {
  return requireFunctions(getDesktopBridge(), ["getFileStat"]);
}

export function getDesktopMediaBridge() {
  return requireFunctions(getDesktopBridge(), ["saveReferenceMedia"]);
}

export function getDesktopMediaIdentityBridge() {
  return requireFunctions(getDesktopBridge(), ["applyMediaIdentityRecommendation"]);
}

export function getDesktopBackupBridge() {
  return requireFunctions(getDesktopBridge(), ["createSequenceBackup"]);
}

export function getDesktopDiagnosticsBridge() {
  return requireFunctions(getDesktopBridge(), ["exportDiagnosticsBundle"]);
}

export function getDesktopSequenceBridge() {
  return requireFunctions(getDesktopBridge(), ["listSequencesInShowFolder"]);
}

export function getDesktopMediaCatalogBridge() {
  return requireFunctions(getDesktopBridge(), ["listMediaFilesInFolder"]);
}

export function getDesktopAgentLogBridge() {
  return requireFunctions(getDesktopBridge(), ["appendAgentApplyLog", "readAgentApplyLog"]);
}

export function getDesktopAgentConversationBridge() {
  return requireFunctions(getDesktopBridge(), ["runAgentConversation", "getAgentHealth"]);
}

export function getDesktopAgentConfigBridge() {
  return requireFunctions(getDesktopBridge(), ["getAgentConfig", "setAgentConfig"]);
}

export function getDesktopAudioAnalysisBridge() {
  return requireFunctions(getDesktopBridge(), ["runAudioAnalysisService"]);
}

export function getDesktopAudioLibraryBridge() {
  return requireFunctions(getDesktopBridge(), ["analyzeAudioLibraryFolder", "listAudioLibraryTracks", "updateAudioLibraryTrackIdentity"]);
}

export function getDesktopAnalysisArtifactBridge() {
  return requireFunctions(getDesktopBridge(), ["readAnalysisArtifact", "writeAnalysisArtifact"]);
}

export function getDesktopProjectArtifactBridge() {
  return requireFunctions(getDesktopBridge(), ["writeProjectArtifacts", "readProjectArtifact"]);
}

export function getDesktopTrainingPackageBridge() {
  return requireFunctions(getDesktopBridge(), ["readTrainingPackageAsset"]);
}

export function getDesktopSequenceDialogBridge() {
  const bridge = getDesktopBridge();
  if (!bridge || typeof bridge.saveSequenceDialog !== "function") return null;
  return async (payload) => bridge.saveSequenceDialog(payload);
}

export function getDesktopProjectBridge() {
  return requireFunctions(getDesktopBridge(), ["openProjectDialog", "openProjectFile", "writeProjectFile"]);
}

export function getDesktopBridgeHealth() {
  const bridge = getDesktopBridge();
  const apiCount =
    bridge && typeof bridge === "object"
      ? Object.keys(bridge).filter((key) => typeof bridge[key] === "function").length
      : 0;
  return {
    runtimeReady: Boolean(bridge),
    desktopFileDialogReady: Boolean(bridge && typeof bridge.openFileDialog === "function"),
    desktopBridgeApiCount: apiCount
  };
}

export function getDesktopFileDialogBridge() {
  const w = currentWindow();
  if (!w) return null;

  const xld = w.xlightsDesignerDesktop || w.__xlightsDesignerDesktop;
  if (xld) {
    if (typeof xld.openFileDialog === "function") {
      return async (opts) => xld.openFileDialog(opts);
    }
    if (typeof xld.pickFile === "function") {
      return async (opts) => xld.pickFile(opts);
    }
    if (typeof xld.selectFile === "function") {
      return async (opts) => xld.selectFile(opts);
    }
  }

  return null;
}

export function normalizeDialogPathSelection(result) {
  if (!result) return "";
  if (typeof result === "string") return result.trim();
  if (Array.isArray(result)) {
    const first = result.find((v) => typeof v === "string" && v.trim());
    return first ? first.trim() : "";
  }
  if (typeof result === "object") {
    if (typeof result.path === "string") return result.path.trim();
    if (typeof result.filePath === "string") return result.filePath.trim();
    if (typeof result.absolutePath === "string") return result.absolutePath.trim();
    if (Array.isArray(result.paths)) {
      const first = result.paths.find((v) => typeof v === "string" && v.trim());
      return first ? first.trim() : "";
    }
  }
  return "";
}
