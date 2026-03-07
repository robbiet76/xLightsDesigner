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
  openProjectFile: (payload = {}) => ipcRenderer.invoke("xld:project:open-file", payload),
  writeProjectFile: (payload = {}) => ipcRenderer.invoke("xld:project:write-file", payload),
  readSequenceSidecar: (payload = {}) => ipcRenderer.invoke("xld:sidecar:read", payload),
  writeSequenceSidecar: (payload = {}) => ipcRenderer.invoke("xld:sidecar:write", payload),
  saveReferenceMedia: (payload = {}) => ipcRenderer.invoke("xld:media:save-reference", payload),
  createSequenceBackup: (payload = {}) => ipcRenderer.invoke("xld:backup:create", payload),
  restoreSequenceBackup: (payload = {}) => ipcRenderer.invoke("xld:backup:restore", payload),
  listSequencesInShowFolder: (payload = {}) => ipcRenderer.invoke("xld:sequence:list", payload),
  exportDiagnosticsBundle: (payload = {}) => ipcRenderer.invoke("xld:diagnostics:export", payload)
});
