import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("xlightsDesignerDesktop", {
  openFileDialog: (options = {}) => ipcRenderer.invoke("xld:open-file-dialog", options),
  readAppState: () => ipcRenderer.invoke("xld:state:read"),
  writeAppState: (payload = {}) => ipcRenderer.invoke("xld:state:write", payload),
  readSequenceSidecar: (payload = {}) => ipcRenderer.invoke("xld:sidecar:read", payload),
  writeSequenceSidecar: (payload = {}) => ipcRenderer.invoke("xld:sidecar:write", payload),
  saveReferenceMedia: (payload = {}) => ipcRenderer.invoke("xld:media:save-reference", payload),
  createSequenceBackup: (payload = {}) => ipcRenderer.invoke("xld:backup:create", payload),
  restoreSequenceBackup: (payload = {}) => ipcRenderer.invoke("xld:backup:restore", payload),
  exportDiagnosticsBundle: (payload = {}) => ipcRenderer.invoke("xld:diagnostics:export", payload)
});
