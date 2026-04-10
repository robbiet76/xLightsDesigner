import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

import { ensureProjectStructure } from "./analysis-artifact-store.mjs";

const PROJECTS_DIRNAME = "projects";

function normalizePathForCompare(filePath = "") {
  return path.resolve(String(filePath || "").trim());
}

function str(value = "") {
  return String(value || "").trim();
}

function sanitizeProjectName(projectName = "") {
  return String(projectName || "")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");
}

function resolveAppProjectsRootInput(rootPath = "") {
  const custom = String(rootPath || "").trim();
  if (!custom) return path.join(PROJECTS_DIRNAME);
  const resolved = path.resolve(custom);
  return path.basename(resolved) === PROJECTS_DIRNAME ? resolved : path.join(resolved, PROJECTS_DIRNAME);
}

export function resolveProjectsRootPath(rootPath = "") {
  return resolveAppProjectsRootInput(rootPath);
}

function projectKey(projectName = "", showFolder = "") {
  return `${String(projectName || "").trim()}::${String(showFolder || "").trim()}`;
}

function projectIdFromKey(key = "") {
  return crypto.createHash("sha1").update(String(key || "")).digest("hex");
}

export function buildProjectPaths(rootPath = "", projectName = "") {
  const normalizedName = sanitizeProjectName(projectName);
  const projectsRoot = resolveProjectsRootPath(rootPath);
  const projectDir = path.join(projectsRoot, normalizedName);
  const filePath = path.join(projectDir, `${normalizedName}.xdproj`);
  return { projectsRoot, normalizedName, projectDir, filePath };
}

export function inferAppRootFromProjectFile(filePath = "") {
  const absoluteFile = normalizePathForCompare(filePath);
  const projectDir = path.dirname(absoluteFile);
  const projectsRoot = path.dirname(projectDir);
  if (path.basename(projectsRoot) !== PROJECTS_DIRNAME) return "";
  return path.dirname(projectsRoot);
}

export function validateProjectFileLocation(filePath = "", projectName = "") {
  const absoluteFile = normalizePathForCompare(filePath);
  const normalizedName = sanitizeProjectName(projectName);
  if (!normalizedName) {
    return { ok: false, code: "INVALID_PROJECT_NAME", error: "Project name is required." };
  }
  const projectDir = path.dirname(absoluteFile);
  const fileName = path.basename(absoluteFile);
  const dirName = path.basename(projectDir);
  if (dirName !== normalizedName) {
    return {
      ok: false,
      code: "INVALID_PROJECT_LAYOUT",
      error: `Project folder must match project name: expected ${normalizedName}`
    };
  }
  if (fileName !== `${normalizedName}.xdproj`) {
    return {
      ok: false,
      code: "INVALID_PROJECT_LAYOUT",
      error: `Project file must be named ${normalizedName}.xdproj`
    };
  }
  return { ok: true };
}

export function readProjectFileRecord({ filePath = "" } = {}) {
  const targetPath = str(filePath);
  if (!targetPath) return { ok: false, error: "Missing filePath" };
  if (!fs.existsSync(targetPath)) return { ok: false, code: "NOT_FOUND", error: "Project file not found" };
  const raw = fs.readFileSync(targetPath, "utf8");
  const parsed = JSON.parse(raw);
  const projectName = str(parsed?.projectName);
  const showFolder = str(parsed?.showFolder);
  const mediaPath = str(parsed?.mediaPath);
  const layout = validateProjectFileLocation(targetPath, projectName);
  if (!layout.ok) return { ok: false, code: layout.code, error: layout.error };
  ensureProjectStructure(path.dirname(targetPath));
  const key = str(parsed?.key || projectKey(projectName, showFolder));
  const appRootPath = inferAppRootFromProjectFile(targetPath);
  return {
    ok: true,
    filePath: targetPath,
    project: {
      id: str(parsed?.id || projectIdFromKey(key)),
      key,
      projectName,
      showFolder,
      mediaPath,
      appRootPath,
      createdAt: str(parsed?.createdAt || parsed?.updatedAt || ""),
      updatedAt: str(parsed?.updatedAt || "")
    },
    snapshot: parsed?.snapshot && typeof parsed.snapshot === "object" ? parsed.snapshot : null
  };
}

export function writeProjectFileRecord({
  rootPath = "",
  currentFilePath = "",
  projectName = "",
  showFolder = "",
  mediaPath = "",
  mode = "save",
  snapshot = null
} = {}) {
  const currentFile = str(currentFilePath);
  const name = str(projectName);
  const show = str(showFolder);
  const media = str(mediaPath);
  const normalizedMode = str(mode).toLowerCase();
  const writeMode = normalizedMode === "rename" || normalizedMode === "save-as" ? normalizedMode : "save";
  if (!name) return { ok: false, error: "Missing projectName" };
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return { ok: false, error: "Missing snapshot" };

  const { normalizedName, projectDir, filePath } = buildProjectPaths(rootPath, name);
  if (!normalizedName) return { ok: false, code: "INVALID_PROJECT_NAME", error: "Project name is required." };

  const currentResolved = currentFile ? normalizePathForCompare(currentFile) : "";
  const targetResolved = normalizePathForCompare(filePath);
  const currentDir = currentResolved ? path.dirname(currentResolved) : "";
  const targetDir = path.dirname(targetResolved);

  if (writeMode === "save" && currentResolved && currentResolved !== targetResolved) {
    return {
      ok: false,
      code: "PROJECT_RENAME_REQUIRED",
      error: "Project name changed. Use Rename Project to move the project folder."
    };
  }

  if (currentResolved && currentResolved !== targetResolved && fs.existsSync(targetResolved)) {
    return {
      ok: false,
      code: "PROJECT_NAME_CONFLICT",
      error: `A project named "${normalizedName}" already exists.`
    };
  }

  if (!currentResolved && fs.existsSync(targetResolved)) {
    return {
      ok: false,
      code: "PROJECT_NAME_CONFLICT",
      error: `A project named "${normalizedName}" already exists.`
    };
  }

  if (writeMode === "rename" && currentResolved && currentResolved !== targetResolved && fs.existsSync(currentDir)) {
    if (fs.existsSync(targetDir)) {
      return {
        ok: false,
        code: "PROJECT_NAME_CONFLICT",
        error: `A project named "${normalizedName}" already exists.`
      };
    }
    fs.mkdirSync(path.dirname(targetDir), { recursive: true });
    fs.renameSync(currentDir, targetDir);
  }

  const key = projectKey(name, show);
  const id = projectIdFromKey(key);
  let createdAt = "";
  if (fs.existsSync(targetResolved)) {
    try {
      const previous = JSON.parse(fs.readFileSync(targetResolved, "utf8"));
      createdAt = str(previous?.createdAt || previous?.updatedAt || "");
    } catch {
      createdAt = "";
    }
  }
  if (!createdAt) createdAt = new Date().toISOString();
  const doc = {
    version: 1,
    projectName: name,
    showFolder: show,
    mediaPath: media,
    key,
    id,
    createdAt,
    updatedAt: new Date().toISOString(),
    snapshot
  };
  ensureProjectStructure(projectDir);
  fs.writeFileSync(targetResolved, JSON.stringify(doc, null, 2), "utf8");
  return {
    ok: true,
    filePath: targetResolved,
    project: {
      id,
      key,
      projectName: name,
      showFolder: show,
      mediaPath: media,
      appRootPath: inferAppRootFromProjectFile(targetResolved),
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    }
  };
}

function normalizeSequencePathToken(sequencePath = "") {
  return String(sequencePath || "").trim().replace(/\\/g, "/").toLowerCase();
}

function sequenceIdFromPath(sequencePath = "") {
  const token = normalizeSequencePathToken(sequencePath);
  if (!token) return "";
  let hash = 2166136261;
  for (let i = 0; i < token.length; i += 1) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function appManagedSidecarPathForSequence(sequencePath = "", appRootPath = "") {
  const seq = str(sequencePath);
  const root = str(appRootPath);
  if (!seq || !root) return "";
  const sequenceId = sequenceIdFromPath(seq);
  if (!sequenceId) return "";
  return path.join(root, "sequencing", "sequences", sequenceId, "sequence.xdmeta");
}

function sequenceFolderForPath(sequencePath = "") {
  const seq = str(sequencePath);
  if (!seq) return "";
  return path.dirname(seq);
}

function designerMediaFolderForSequence(sequencePath = "") {
  const folder = sequenceFolderForPath(sequencePath);
  if (!folder) return "";
  return path.join(folder, "xlightsdesigner-media");
}

function sanitizeFilename(name = "") {
  const cleaned = String(name || "").replace(/[^\w.\- ]+/g, "_").trim();
  return cleaned || "reference.bin";
}

export function readSequenceSidecarFile({ sequencePath = "", appRootPath = "", metadataRootPath = "" } = {}) {
  const seq = str(sequencePath);
  const root = str(appRootPath || metadataRootPath);
  const sidecarPath = appManagedSidecarPathForSequence(seq, root);
  if (!sidecarPath) return { ok: false, error: "Missing sequencePath or appRootPath" };
  if (!fs.existsSync(sidecarPath)) {
    return { ok: true, exists: false, sidecarPath, managedSidecarPath: sidecarPath, data: null };
  }
  return {
    ok: true,
    exists: true,
    sidecarPath,
    managedSidecarPath: sidecarPath,
    data: JSON.parse(fs.readFileSync(sidecarPath, "utf8"))
  };
}

export function writeSequenceSidecarFile({ sequencePath = "", appRootPath = "", metadataRootPath = "", data = {} } = {}) {
  const seq = str(sequencePath);
  const root = str(appRootPath || metadataRootPath);
  const sidecarPath = appManagedSidecarPathForSequence(seq, root);
  if (!sidecarPath) return { ok: false, error: "Missing sequencePath or appRootPath" };
  const nextData = data && typeof data === "object" && !Array.isArray(data) ? data : {};
  fs.mkdirSync(path.dirname(sidecarPath), { recursive: true });
  fs.writeFileSync(sidecarPath, JSON.stringify(nextData, null, 2), "utf8");
  return { ok: true, sidecarPath };
}

export function saveReferenceMediaFile({ sequencePath = "", fileName = "", bytes = null } = {}) {
  const folder = designerMediaFolderForSequence(sequencePath);
  if (!folder) return { ok: false, error: "Missing sequencePath" };
  if (!(bytes instanceof ArrayBuffer)) return { ok: false, error: "Missing media bytes" };
  const safeName = sanitizeFilename(fileName);
  fs.mkdirSync(folder, { recursive: true });
  const absolutePath = path.join(folder, safeName);
  fs.writeFileSync(absolutePath, Buffer.from(bytes));
  return { ok: true, absolutePath };
}

function listSequenceFilesRecursive(rootFolder = "") {
  const root = str(rootFolder);
  if (!root || !fs.existsSync(root)) return [];
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
        const dirName = str(entry.name).toLowerCase();
        if (dirName === "backup" || dirName === ".xlightsdesigner-backups") continue;
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
  return results.sort((a, b) => String(a.relativePath || "").localeCompare(String(b.relativePath || ""), undefined, { sensitivity: "base" }));
}

function listMediaFilesRecursive(rootFolder = "", extensions = [], options = {}, readMediaIdentity = null) {
  const root = str(rootFolder);
  if (!root || !fs.existsSync(root)) return [];
  const includeIdentity = options?.includeIdentity === true;
  const includeFingerprint = options?.includeFingerprint === true;
  const allowed = new Set((Array.isArray(extensions) ? extensions : []).map((ext) => str(ext).toLowerCase().replace(/^\./, "")).filter(Boolean));
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
        const dirName = str(entry.name).toLowerCase();
        if (dirName === "backup" || dirName === ".xlightsdesigner-backups") continue;
        stack.push(abs);
        continue;
      }
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase().replace(/^\./, "");
      if (allowed.size && !allowed.has(ext)) continue;
      const relativePath = path.relative(root, abs) || entry.name;
      const nextRow = { path: abs, relativePath, fileName: path.basename(abs), extension: ext };
      if (includeIdentity) {
        const identity = typeof readMediaIdentity === "function"
          ? readMediaIdentity(abs, { includeFingerprint })
          : null;
        nextRow.identity = identity ? {
          title: str(identity?.title),
          artist: str(identity?.artist),
          album: str(identity?.album),
          date: str(identity?.date),
          isrc: str(identity?.isrc),
          durationMs: Number.isFinite(Number(identity?.durationMs)) ? Number(identity.durationMs) : null,
          identityKey: str(identity?.identityKey),
          contentFingerprint: str(identity?.contentFingerprint)
        } : {
          title: "",
          artist: "",
          album: "",
          date: "",
          isrc: "",
          durationMs: null,
          identityKey: "",
          contentFingerprint: ""
        };
      }
      results.push(nextRow);
    }
  }
  return results.sort((a, b) => String(a.relativePath || "").localeCompare(String(b.relativePath || ""), undefined, { sensitivity: "base" }));
}

function countShowArtifactsRecursive(rootFolder = "") {
  const root = str(rootFolder);
  if (!root || !fs.existsSync(root)) return { xsqCount: 0, xdmetaCount: 0 };
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
        const dirName = str(entry.name).toLowerCase();
        if (dirName === "backup" || dirName === ".xlightsdesigner-backups") continue;
        stack.push(abs);
        continue;
      }
      if (!entry.isFile()) continue;
      const lower = str(entry.name).toLowerCase();
      if (lower.endsWith(".xsq")) xsqCount += 1;
      if (lower.endsWith(".xdmeta")) xdmetaCount += 1;
    }
  }
  return { xsqCount, xdmetaCount };
}

function backupFolderForSequence(sequencePath = "") {
  const folder = sequenceFolderForPath(sequencePath);
  if (!folder) return "";
  return path.join(folder, ".xlightsdesigner-backups");
}

export function createSequenceBackupFile({ sequencePath = "" } = {}) {
  const seq = str(sequencePath);
  if (!seq) return { ok: false, error: "Missing sequencePath" };
  if (!fs.existsSync(seq)) return { ok: false, error: "Sequence file does not exist" };
  const backupDir = backupFolderForSequence(seq);
  if (!backupDir) return { ok: false, error: "Unable to determine backup folder" };
  const ext = path.extname(seq);
  const base = path.basename(seq, ext || undefined);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupName = `${base}.${stamp}.bak${ext || ".xsq"}`;
  const backupPath = path.join(backupDir, backupName);
  fs.mkdirSync(backupDir, { recursive: true });
  fs.copyFileSync(seq, backupPath);
  return { ok: true, backupPath };
}

export function restoreSequenceBackupFile({ sequencePath = "", backupPath = "" } = {}) {
  const seq = str(sequencePath);
  const backup = str(backupPath);
  if (!seq) return { ok: false, error: "Missing sequencePath" };
  if (!backup) return { ok: false, error: "Missing backupPath" };
  if (!fs.existsSync(backup)) return { ok: false, error: "Backup file does not exist" };
  fs.mkdirSync(path.dirname(seq), { recursive: true });
  fs.copyFileSync(backup, seq);
  return { ok: true, sequencePath: seq };
}

export function listSequenceFilesInShowFolder({ showFolder = "" } = {}) {
  const folder = str(showFolder);
  if (!folder) return { ok: false, error: "Missing showFolder" };
  const sequences = listSequenceFilesRecursive(folder);
  const stats = countShowArtifactsRecursive(folder);
  return { ok: true, showFolder: folder, sequences, stats };
}

export function listMediaFilesInFolder({ mediaFolder = "", extensions = [], includeIdentity = false, includeFingerprint = false, readMediaIdentity = null } = {}) {
  const folder = str(mediaFolder);
  if (!folder) return { ok: false, error: "Missing mediaFolder" };
  const mediaFiles = listMediaFilesRecursive(folder, extensions, {
    includeIdentity,
    includeFingerprint
  }, readMediaIdentity);
  return { ok: true, mediaFolder: folder, mediaFiles };
}
