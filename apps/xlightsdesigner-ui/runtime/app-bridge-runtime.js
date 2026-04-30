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

export function getAppBridge() {
  const w = currentWindow();
  if (!w) return null;
  return w.xlightsDesignerApp || w.__xlightsDesignerApp || null;
}

export function getAppStateBridge() {
  return requireFunctions(getAppBridge(), ["readAppState", "writeAppState"]);
}

export function getAppInfoBridge() {
  return requireFunctions(getAppBridge(), ["getAppInfo"]);
}

export function getAppAdminBridge() {
  return requireFunctions(getAppBridge(), ["resetAppInstallState"]);
}

export function getAppSidecarBridge() {
  return requireFunctions(getAppBridge(), ["readSequenceSidecar", "writeSequenceSidecar"]);
}

export function getAppFileStatBridge() {
  return requireFunctions(getAppBridge(), ["getFileStat"]);
}

export function getAppMediaBridge() {
  return requireFunctions(getAppBridge(), ["saveReferenceMedia"]);
}

export function getAppMediaIdentityBridge() {
  return requireFunctions(getAppBridge(), ["applyMediaIdentityRecommendation"]);
}

export function getAppBackupBridge() {
  return requireFunctions(getAppBridge(), ["createSequenceBackup"]);
}

export function getAppDiagnosticsBridge() {
  return requireFunctions(getAppBridge(), ["exportDiagnosticsBundle"]);
}

export function getAppSequenceBridge() {
  return requireFunctions(getAppBridge(), ["listSequencesInShowFolder"]);
}

export function getAppMediaCatalogBridge() {
  return requireFunctions(getAppBridge(), ["listMediaFilesInFolder"]);
}

export function getAppAgentLogBridge() {
  return requireFunctions(getAppBridge(), ["appendAgentApplyLog", "readAgentApplyLog"]);
}

export function getAppAgentConversationBridge() {
  return requireFunctions(getAppBridge(), ["runAgentConversation", "getAgentHealth"]);
}

export function getAppAgentConfigBridge() {
  return requireFunctions(getAppBridge(), ["getAgentConfig", "setAgentConfig"]);
}

export function getAppAudioAnalysisBridge() {
  return requireFunctions(getAppBridge(), ["runAudioAnalysisService"]);
}

export function getAppAudioLibraryBridge() {
  return requireFunctions(getAppBridge(), ["analyzeAudioLibraryFolder", "listAudioLibraryTracks", "updateAudioLibraryTrackIdentity"]);
}

export function getAppAnalysisArtifactBridge() {
  return requireFunctions(getAppBridge(), ["readAnalysisArtifact", "writeAnalysisArtifact"]);
}

export function getAppProjectArtifactBridge() {
  return requireFunctions(getAppBridge(), ["writeProjectArtifacts", "readProjectArtifact"]);
}

export function getAppTrainingPackageBridge() {
  return requireFunctions(getAppBridge(), ["readTrainingPackageAsset"]);
}

export function getAppSequenceDialogBridge() {
  const bridge = getAppBridge();
  if (!bridge || typeof bridge.saveSequenceDialog !== "function") return null;
  return async (payload) => bridge.saveSequenceDialog(payload);
}

export function getAppProjectBridge() {
  return requireFunctions(getAppBridge(), ["openProjectDialog", "openProjectFile", "writeProjectFile"]);
}

export function getAppBridgeHealth() {
  const bridge = getAppBridge();
  const apiCount =
    bridge && typeof bridge === "object"
      ? Object.keys(bridge).filter((key) => typeof bridge[key] === "function").length
      : 0;
  const fileDialogReady = Boolean(bridge && typeof bridge.openFileDialog === "function");
  return {
    runtimeReady: Boolean(bridge),
    appFileDialogReady: fileDialogReady,
    appBridgeApiCount: apiCount
  };
}

export function getAppFileDialogBridge() {
  const w = currentWindow();
  if (!w) return null;

  const xld = w.xlightsDesignerApp || w.__xlightsDesignerApp;
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
