import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("xlightsDesignerDesktop", {
  openFileDialog: (options = {}) => ipcRenderer.invoke("xld:open-file-dialog", options)
});
