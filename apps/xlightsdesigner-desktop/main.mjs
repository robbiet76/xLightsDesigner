import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import crypto from "node:crypto";

const require = createRequire(import.meta.url);
const { app, BrowserWindow, dialog, ipcMain } = require("electron");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UI_URL = String(process.env.XLD_UI_URL || "").trim();
const STATE_FILENAME = "xlightsdesigner-state.json";
const PACKAGED_RENDERER_ENTRY = path.join(__dirname, "renderer", "index.html");
const DEV_RENDERER_ENTRY = path.resolve(__dirname, "..", "xlightsdesigner-ui", "index.html");
let mainWindow = null;
const STARTUP_LOG = "/tmp/xld-desktop-main.log";

function logStartup(message) {
  try {
    fs.appendFileSync(STARTUP_LOG, `${new Date().toISOString()} ${message}\n`, "utf8");
  } catch {
    // ignore logging failures
  }
}

function resolveRendererEntry() {
  if (fs.existsSync(PACKAGED_RENDERER_ENTRY)) return PACKAGED_RENDERER_ENTRY;
  return DEV_RENDERER_ENTRY;
}

function createWindow() {
  logStartup("createWindow:enter");
  if (mainWindow && !mainWindow.isDestroyed()) {
    logStartup("createWindow:focus-existing");
    mainWindow.focus();
    return mainWindow;
  }

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

  mainWindow = win;
  logStartup("createWindow:created");
  win.on("closed", () => {
    logStartup("window:closed");
    if (mainWindow === win) {
      mainWindow = null;
    }
  });

  win.webContents.on("did-fail-load", (_event, code, desc, url, isMainFrame) => {
    logStartup(`webContents:did-fail-load code=${code} desc=${desc} url=${url} main=${isMainFrame}`);
  });

  win.webContents.on("render-process-gone", (_event, details) => {
    logStartup(`webContents:render-process-gone reason=${details?.reason || "unknown"} exitCode=${details?.exitCode || 0}`);
  });

  if (UI_URL) {
    logStartup(`loadURL:${UI_URL}`);
    win.loadURL(UI_URL);
    return win;
  }

  const rendererEntry = resolveRendererEntry();
  logStartup(`loadFile:${rendererEntry}`);
  win.loadFile(rendererEntry).catch((err) => {
    logStartup(`loadFile:error ${String(err?.message || err)}`);
  });
  return win;
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
    defaultPath: String(options?.defaultPath || "").trim() || undefined,
    properties: [options?.directory ? "openDirectory" : "openFile"],
    filters
  });

  if (result.canceled || !Array.isArray(result.filePaths) || result.filePaths.length === 0) {
    return "";
  }
  return result.filePaths[0] || "";
});

function isPathWithinRoot(candidatePath, rootPath) {
  const candidate = path.resolve(String(candidatePath || "").trim());
  const root = path.resolve(String(rootPath || "").trim());
  if (!candidate || !root) return false;
  if (candidate === root) return true;
  const relative = path.relative(root, candidate);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

ipcMain.handle("xld:sequence:save-dialog", async (_event, payload = {}) => {
  try {
    const showFolder = String(payload?.showFolder || "").trim();
    if (!showFolder) return { ok: false, canceled: false, error: "Missing showFolder", filePath: "" };

    const defaultNameRaw = String(payload?.defaultName || "NewSequence.xsq").trim() || "NewSequence.xsq";
    const defaultName = defaultNameRaw.toLowerCase().endsWith(".xsq")
      ? defaultNameRaw
      : `${defaultNameRaw}.xsq`;
    const title = String(payload?.title || "Select Sequence File").trim() || "Select Sequence File";

    const result = await dialog.showSaveDialog({
      title,
      defaultPath: path.join(showFolder, defaultName),
      filters: [{ name: "xLights Sequence", extensions: ["xsq"] }]
    });

    if (result.canceled || !result.filePath) {
      return { ok: false, canceled: true, filePath: "" };
    }

    let selectedPath = String(result.filePath).trim();
    if (!selectedPath.toLowerCase().endsWith(".xsq")) {
      selectedPath += ".xsq";
    }

    if (!isPathWithinRoot(selectedPath, showFolder)) {
      return {
        ok: false,
        canceled: false,
        code: "OUTSIDE_SHOW_FOLDER",
        error: "Selected path must be within Show Directory",
        filePath: ""
      };
    }

    return { ok: true, canceled: false, filePath: selectedPath };
  } catch (err) {
    return { ok: false, canceled: false, error: String(err?.message || err), filePath: "" };
  }
});

ipcMain.handle("xld:project:open-dialog", async (_event, payload = {}) => {
  try {
    const rootPath = String(payload?.rootPath || "").trim();
    const baseDir = resolveProjectsRootPath(rootPath);
    const result = await dialog.showOpenDialog({
      title: "Open Project Metadata",
      defaultPath: baseDir,
      properties: ["openFile"],
      filters: [{ name: "xLightsDesigner Project", extensions: ["xdproj"] }]
    });
    if (result.canceled || !Array.isArray(result.filePaths) || result.filePaths.length === 0) {
      return { ok: false, canceled: true, filePath: "" };
    }
    return { ok: true, canceled: false, filePath: String(result.filePaths[0] || "") };
  } catch (err) {
    return { ok: false, canceled: false, error: String(err?.message || err), filePath: "" };
  }
});

ipcMain.handle("xld:project:save-dialog", async (_event, payload = {}) => {
  try {
    const rootPath = String(payload?.rootPath || "").trim();
    const defaultName = String(payload?.defaultName || "project.xdproj").trim() || "project.xdproj";
    const baseDir = resolveProjectsRootPath(rootPath);
    const result = await dialog.showSaveDialog({
      title: "Save Project As",
      defaultPath: path.join(baseDir, defaultName),
      filters: [{ name: "xLightsDesigner Project", extensions: ["xdproj"] }]
    });
    if (result.canceled || !result.filePath) {
      return { ok: false, canceled: true, filePath: "" };
    }
    return { ok: true, canceled: false, filePath: String(result.filePath) };
  } catch (err) {
    return { ok: false, canceled: false, error: String(err?.message || err), filePath: "" };
  }
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

function projectKey(projectName, showFolder) {
  return `${String(projectName || "").trim()}::${String(showFolder || "").trim()}`;
}

function resolveProjectsRootPath(rootPath) {
  const custom = String(rootPath || "").trim();
  if (custom) return custom;
  return path.join(app.getPath("userData"), "projects");
}

function projectIdFromKey(key) {
  return crypto.createHash("sha1").update(String(key || "")).digest("hex");
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

ipcMain.handle("xld:project:open-file", async (_event, payload = {}) => {
  try {
    const filePath = String(payload?.filePath || "").trim();
    if (!filePath) return { ok: false, error: "Missing filePath" };
    if (!fs.existsSync(filePath)) return { ok: false, code: "NOT_FOUND", error: "Project file not found" };
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    const projectName = String(parsed?.projectName || "").trim();
    const showFolder = String(parsed?.showFolder || "").trim();
    const key = String(parsed?.key || projectKey(projectName, showFolder)).trim();
    return {
      ok: true,
      filePath,
      project: {
        id: String(parsed?.id || projectIdFromKey(key)),
        key,
        projectName,
        showFolder,
        createdAt: String(parsed?.createdAt || parsed?.updatedAt || ""),
        updatedAt: String(parsed?.updatedAt || "")
      },
      snapshot: parsed?.snapshot && typeof parsed.snapshot === "object" ? parsed.snapshot : null
    };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle("xld:project:write-file", async (_event, payload = {}) => {
  try {
    const filePath = String(payload?.filePath || "").trim();
    const projectName = String(payload?.projectName || "").trim();
    const showFolder = String(payload?.showFolder || "").trim();
    const snapshot = payload?.snapshot && typeof payload.snapshot === "object" ? payload.snapshot : null;
    if (!filePath) return { ok: false, error: "Missing filePath" };
    if (!projectName) return { ok: false, error: "Missing projectName" };
    if (!showFolder) return { ok: false, error: "Missing showFolder" };
    if (!snapshot) return { ok: false, error: "Missing snapshot" };

    const key = projectKey(projectName, showFolder);
    const id = projectIdFromKey(key);
    let createdAt = "";
    if (fs.existsSync(filePath)) {
      try {
        const previousRaw = fs.readFileSync(filePath, "utf8");
        const previous = JSON.parse(previousRaw);
        createdAt = String(previous?.createdAt || previous?.updatedAt || "");
      } catch {
        createdAt = "";
      }
    }
    if (!createdAt) createdAt = new Date().toISOString();
    const doc = {
      version: 1,
      projectName,
      showFolder,
      key,
      id,
      createdAt,
      updatedAt: new Date().toISOString(),
      snapshot
    };
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(doc, null, 2), "utf8");
    return {
      ok: true,
      filePath,
      project: {
        id,
        key,
        projectName,
        showFolder,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt
      }
    };
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

function listSequenceFilesRecursive(rootFolder) {
  const root = String(rootFolder || "").trim();
  if (!root) return [];
  if (!fs.existsSync(root)) return [];

  const results = [];
  const stack = [root];

  while (stack.length) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) {
        const dirName = String(entry.name || "").toLowerCase();
        if (dirName === "backup" || dirName === ".xlightsdesigner-backups") {
          continue;
        }
        stack.push(abs);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!entry.name.toLowerCase().endsWith(".xsq")) continue;
      const relativePath = path.relative(root, abs) || entry.name;
      results.push({
        path: abs,
        relativePath,
        name: path.basename(abs, path.extname(abs))
      });
    }
  }

  return results.sort((a, b) =>
    String(a.relativePath || "").localeCompare(String(b.relativePath || ""), undefined, {
      sensitivity: "base"
    })
  );
}

function countShowArtifactsRecursive(rootFolder) {
  const root = String(rootFolder || "").trim();
  if (!root) return { xsqCount: 0, xdmetaCount: 0 };
  if (!fs.existsSync(root)) return { xsqCount: 0, xdmetaCount: 0 };

  let xsqCount = 0;
  let xdmetaCount = 0;
  const stack = [root];

  while (stack.length) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) {
        const dirName = String(entry.name || "").toLowerCase();
        if (dirName === "backup" || dirName === ".xlightsdesigner-backups") {
          continue;
        }
        stack.push(abs);
        continue;
      }
      if (!entry.isFile()) continue;
      const lower = String(entry.name || "").toLowerCase();
      if (lower.endsWith(".xsq")) xsqCount += 1;
      if (lower.endsWith(".xdmeta")) xdmetaCount += 1;
    }
  }

  return { xsqCount, xdmetaCount };
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

ipcMain.handle("xld:sequence:list", async (_event, payload = {}) => {
  try {
    const showFolder = String(payload?.showFolder || "").trim();
    if (!showFolder) return { ok: false, error: "Missing showFolder" };
    const sequences = listSequenceFilesRecursive(showFolder);
    const stats = countShowArtifactsRecursive(showFolder);
    return { ok: true, showFolder, sequences, stats };
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

process.on("uncaughtException", (err) => {
  logStartup(`process:uncaughtException ${String(err?.stack || err)}`);
});

process.on("unhandledRejection", (err) => {
  logStartup(`process:unhandledRejection ${String(err?.stack || err)}`);
});

app.on("will-finish-launching", () => logStartup("app:will-finish-launching"));
app.on("ready", () => logStartup("app:ready"));
app.on("before-quit", () => logStartup("app:before-quit"));
app.on("will-quit", () => logStartup("app:will-quit"));
app.on("quit", (_event, code) => logStartup(`app:quit code=${code}`));

app.whenReady().then(() => {
  logStartup("app:whenReady:resolved");
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
