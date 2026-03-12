import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("xlightsDesignerDesktop", {
  openFileDialog: (options = {}) => ipcRenderer.invoke("xld:open-file-dialog", options),
  saveSequenceDialog: (payload = {}) => ipcRenderer.invoke("xld:sequence:save-dialog", payload),
  openProjectDialog: (payload = {}) => ipcRenderer.invoke("xld:project:open-dialog", payload),
  saveProjectDialog: (payload = {}) => ipcRenderer.invoke("xld:project:save-dialog", payload),
  readAppState: () => ipcRenderer.invoke("xld:state:read"),
  writeAppState: (payload = {}) => ipcRenderer.invoke("xld:state:write", payload),
  getAppInfo: () => ipcRenderer.invoke("xld:app:info"),
  readAudioFile: (payload = {}) => ipcRenderer.invoke("xld:audio:read", payload),
  runAudioAnalysisService: (payload = {}) => ipcRenderer.invoke("xld:analysis:run", payload),
  checkAudioAnalysisService: (payload = {}) => ipcRenderer.invoke("xld:analysis:health", payload),
  openProjectFile: (payload = {}) => ipcRenderer.invoke("xld:project:open-file", payload),
  writeProjectFile: (payload = {}) => ipcRenderer.invoke("xld:project:write-file", payload),
  readAnalysisArtifact: (payload = {}) => ipcRenderer.invoke("xld:analysis-artifact:read", payload),
  writeAnalysisArtifact: (payload = {}) => ipcRenderer.invoke("xld:analysis-artifact:write", payload),
  getFileStat: (payload = {}) => ipcRenderer.invoke("xld:file:stat", payload),
  readTrainingPackageAsset: (payload = {}) => ipcRenderer.invoke("xld:training-package:read", payload),
  getAgentHealth: () => ipcRenderer.invoke("xld:agent:health"),
  getAgentConfig: () => ipcRenderer.invoke("xld:agent-config:get"),
  setAgentConfig: (payload = {}) => ipcRenderer.invoke("xld:agent-config:set", payload),
  runAgentConversation: (payload = {}) => ipcRenderer.invoke("xld:agent:chat", payload),
  appendAgentApplyLog: (payload = {}) => ipcRenderer.invoke("xld:agent-log:append", payload),
  readAgentApplyLog: (payload = {}) => ipcRenderer.invoke("xld:agent-log:read", payload),
  readSequenceSidecar: (payload = {}) => ipcRenderer.invoke("xld:sidecar:read", payload),
  writeSequenceSidecar: (payload = {}) => ipcRenderer.invoke("xld:sidecar:write", payload),
  saveReferenceMedia: (payload = {}) => ipcRenderer.invoke("xld:media:save-reference", payload),
  createSequenceBackup: (payload = {}) => ipcRenderer.invoke("xld:backup:create", payload),
  restoreSequenceBackup: (payload = {}) => ipcRenderer.invoke("xld:backup:restore", payload),
  listSequencesInShowFolder: (payload = {}) => ipcRenderer.invoke("xld:sequence:list", payload),
  exportDiagnosticsBundle: (payload = {}) => ipcRenderer.invoke("xld:diagnostics:export", payload)
});
