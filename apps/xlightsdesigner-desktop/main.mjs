import { app, BrowserWindow, dialog, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UI_URL = String(process.env.XLD_UI_URL || "").trim();
const STATE_FILENAME = "xlightsdesigner-state.json";
const PACKAGED_RENDERER_ENTRY = path.join(__dirname, "renderer", "index.html");
const DEV_RENDERER_ENTRY = path.resolve(__dirname, "..", "xlightsdesigner-ui", "index.html");

function resolveRendererEntry() {
  if (fs.existsSync(PACKAGED_RENDERER_ENTRY)) return PACKAGED_RENDERER_ENTRY;
  return DEV_RENDERER_ENTRY;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1560,
    height: 980,
    minWidth: 1200,
    minHeight: 760,
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (UI_URL) {
    win.loadURL(UI_URL);
    return;
  }

  win.loadFile(resolveRendererEntry());
}

ipcMain.handle("xld:open-file-dialog", async (_event, options = {}) => {
  const filters = Array.isArray(options?.filters)
    ? options.filters.map((f) => ({
        name: String(f?.name || "Files"),
        extensions: Array.isArray(f?.extensions)
          ? f.extensions.map((ext) => String(ext).replace(/^\./, ""))
          : ["*"]
      }))
    : [];

  const result = await dialog.showOpenDialog({
    title: String(options?.title || "Select File"),
    properties: ["openFile"],
    filters
  });

  if (result.canceled || !Array.isArray(result.filePaths) || result.filePaths.length === 0) {
    return "";
  }
  return result.filePaths[0] || "";
});

function stateFilePath() {
  return path.join(app.getPath("userData"), STATE_FILENAME);
}

function readDesktopStatePayload() {
  const file = stateFilePath();
  if (!fs.existsSync(file)) return { localStateRaw: "", projectsStoreRaw: "" };
  const raw = fs.readFileSync(file, "utf8");
  const parsed = JSON.parse(raw);
  return {
    localStateRaw: typeof parsed?.localStateRaw === "string" ? parsed.localStateRaw : "",
    projectsStoreRaw: typeof parsed?.projectsStoreRaw === "string" ? parsed.projectsStoreRaw : ""
  };
}

ipcMain.handle("xld:state:read", async () => {
  try {
    return { ok: true, ...readDesktopStatePayload() };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle("xld:state:write", async (_event, payload = {}) => {
  try {
    const file = stateFilePath();
    const next = {
      localStateRaw: typeof payload?.localStateRaw === "string" ? payload.localStateRaw : "",
      projectsStoreRaw: typeof payload?.projectsStoreRaw === "string" ? payload.projectsStoreRaw : ""
    };
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(next, null, 2), "utf8");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

function sidecarPathForSequence(sequencePath) {
  const seq = String(sequencePath || "").trim();
  if (!seq) return "";
  const dir = path.dirname(seq);
  const ext = path.extname(seq);
  const name = path.basename(seq, ext || undefined);
  return path.join(dir, `${name}.xdmeta`);
}

function sequenceFolderForPath(sequencePath) {
  const seq = String(sequencePath || "").trim();
  if (!seq) return "";
  return path.dirname(seq);
}

function designerMediaFolderForSequence(sequencePath) {
  const folder = sequenceFolderForPath(sequencePath);
  if (!folder) return "";
  return path.join(folder, "xlightsdesigner-media");
}

function sanitizeFilename(name) {
  const cleaned = String(name || "")
    .replace(/[^\w.\- ]+/g, "_")
    .trim();
  return cleaned || "reference.bin";
}

function backupFolderForSequence(sequencePath) {
  const folder = sequenceFolderForPath(sequencePath);
  if (!folder) return "";
  return path.join(folder, ".xlightsdesigner-backups");
}

ipcMain.handle("xld:sidecar:read", async (_event, payload = {}) => {
  try {
    const sidecarPath = sidecarPathForSequence(payload?.sequencePath);
    if (!sidecarPath) return { ok: false, error: "Missing sequencePath" };
    if (!fs.existsSync(sidecarPath)) {
      return { ok: true, exists: false, sidecarPath, data: null };
    }
    const raw = fs.readFileSync(sidecarPath, "utf8");
    const data = JSON.parse(raw);
    return { ok: true, exists: true, sidecarPath, data };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle("xld:sidecar:write", async (_event, payload = {}) => {
  try {
    const sidecarPath = sidecarPathForSequence(payload?.sequencePath);
    if (!sidecarPath) return { ok: false, error: "Missing sequencePath" };
    const data = payload?.data && typeof payload.data === "object" ? payload.data : {};
    fs.mkdirSync(path.dirname(sidecarPath), { recursive: true });
    fs.writeFileSync(sidecarPath, JSON.stringify(data, null, 2), "utf8");
    return { ok: true, sidecarPath };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle("xld:media:save-reference", async (_event, payload = {}) => {
  try {
    const sequencePath = String(payload?.sequencePath || "").trim();
    const folder = designerMediaFolderForSequence(sequencePath);
    if (!folder) return { ok: false, error: "Missing sequencePath" };

    const fileName = sanitizeFilename(payload?.fileName);
    const bytes = payload?.bytes;
    if (!(bytes instanceof ArrayBuffer)) {
      return { ok: false, error: "Missing media bytes" };
    }

    fs.mkdirSync(folder, { recursive: true });
    const absolutePath = path.join(folder, fileName);
    fs.writeFileSync(absolutePath, Buffer.from(bytes));
    return { ok: true, absolutePath };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle("xld:backup:create", async (_event, payload = {}) => {
  try {
    const sequencePath = String(payload?.sequencePath || "").trim();
    if (!sequencePath) return { ok: false, error: "Missing sequencePath" };
    if (!fs.existsSync(sequencePath)) return { ok: false, error: "Sequence file does not exist" };
    const backupDir = backupFolderForSequence(sequencePath);
    if (!backupDir) return { ok: false, error: "Unable to determine backup folder" };

    const ext = path.extname(sequencePath);
    const base = path.basename(sequencePath, ext || undefined);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupName = `${base}.${stamp}.bak${ext || ".xsq"}`;
    const backupPath = path.join(backupDir, backupName);

    fs.mkdirSync(backupDir, { recursive: true });
    fs.copyFileSync(sequencePath, backupPath);
    return { ok: true, backupPath };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle("xld:backup:restore", async (_event, payload = {}) => {
  try {
    const sequencePath = String(payload?.sequencePath || "").trim();
    const backupPath = String(payload?.backupPath || "").trim();
    if (!sequencePath) return { ok: false, error: "Missing sequencePath" };
    if (!backupPath) return { ok: false, error: "Missing backupPath" };
    if (!fs.existsSync(backupPath)) return { ok: false, error: "Backup file does not exist" };

    fs.mkdirSync(path.dirname(sequencePath), { recursive: true });
    fs.copyFileSync(backupPath, sequencePath);
    return { ok: true, sequencePath };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle("xld:diagnostics:export", async (_event, payload = {}) => {
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const defaultName = `xlightsdesigner-diagnostics-${stamp}.json`;
    const defaultPath = path.join(app.getPath("desktop"), defaultName);
    const save = await dialog.showSaveDialog({
      title: "Export Diagnostics Bundle",
      defaultPath,
      filters: [{ name: "JSON", extensions: ["json"] }]
    });
    if (save.canceled || !save.filePath) {
      return { ok: false, canceled: true, error: "User canceled save dialog" };
    }
    const data = payload && typeof payload === "object" ? payload : {};
    fs.writeFileSync(save.filePath, JSON.stringify(data, null, 2), "utf8");
    return { ok: true, outputPath: save.filePath };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
