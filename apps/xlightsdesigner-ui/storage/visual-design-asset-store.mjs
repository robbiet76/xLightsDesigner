import fs from "node:fs";
import path from "node:path";

import { ensureProjectStructure } from "./analysis-artifact-store.mjs";
import { validateVisualDesignAssetPack } from "../agent/designer-dialog/visual-design-assets.js";

function str(value = "") {
  return String(value || "").trim();
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizePathForCompare(filePath = "") {
  return path.resolve(String(filePath || "").trim());
}

function sanitizePathToken(value = "") {
  return str(value)
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function rejectUnsafeRelativePath(relativePath = "") {
  const rel = str(relativePath);
  if (!rel) return "Missing relativePath";
  if (path.isAbsolute(rel)) return "relativePath must not be absolute";
  const normalized = path.normalize(rel);
  if (normalized.startsWith("..") || normalized.includes(`${path.sep}..${path.sep}`) || normalized === "..") {
    return "relativePath must stay inside visual design asset folder";
  }
  return "";
}

export function resolveVisualDesignAssetPackDir({ projectFilePath = "", assetPack = {} } = {}) {
  const projectPath = normalizePathForCompare(projectFilePath);
  const projectDir = path.dirname(projectPath);
  const sequenceToken = sanitizePathToken(assetPack?.sequenceId) || sanitizePathToken(assetPack?.artifactId) || "unscoped";
  return path.join(projectDir, "artifacts", "visual-design", sequenceToken);
}

function writeBinaryOrTextFile(targetPath = "", content = null) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  if (Buffer.isBuffer(content)) {
    fs.writeFileSync(targetPath, content);
    return;
  }
  if (typeof content === "string") {
    fs.writeFileSync(targetPath, content);
    return;
  }
  throw new Error("file content must be a Buffer or string");
}

export function writeVisualDesignAssetPack({ projectFilePath = "", assetPack = null, files = [] } = {}) {
  if (!assetPack || !isPlainObject(assetPack)) {
    return { ok: false, error: "Missing assetPack" };
  }
  const errors = validateVisualDesignAssetPack(assetPack);
  if (errors.length) {
    return { ok: false, code: "INVALID_VISUAL_DESIGN_ASSET_PACK", errors };
  }

  const projectPath = normalizePathForCompare(projectFilePath);
  if (!projectPath || !fs.existsSync(projectPath)) {
    return { ok: false, code: "PROJECT_NOT_FOUND", error: "Project file not found" };
  }

  const projectDir = path.dirname(projectPath);
  const assetDir = resolveVisualDesignAssetPackDir({ projectFilePath: projectPath, assetPack });
  ensureProjectStructure(projectDir);
  fs.mkdirSync(assetDir, { recursive: true });

  const writtenFiles = [];
  for (const file of Array.isArray(files) ? files : []) {
    const relativePath = str(file?.relativePath);
    const pathError = rejectUnsafeRelativePath(relativePath);
    if (pathError) return { ok: false, code: "INVALID_RELATIVE_PATH", error: pathError };
    const targetPath = path.join(assetDir, path.normalize(relativePath));
    try {
      writeBinaryOrTextFile(targetPath, file.content);
    } catch (error) {
      return { ok: false, code: "FILE_WRITE_FAILED", error: String(error?.message || error) };
    }
    writtenFiles.push({ relativePath, path: targetPath });
  }

  const manifestPath = path.join(assetDir, "visual-design-manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(assetPack, null, 2), "utf8");
  return {
    ok: true,
    artifactType: assetPack.artifactType,
    artifactId: assetPack.artifactId,
    assetDir,
    manifestPath,
    writtenFiles
  };
}

export function readVisualDesignAssetPack({ projectFilePath = "", sequenceId = "", artifactId = "" } = {}) {
  const pseudoPack = { sequenceId, artifactId };
  const assetDir = resolveVisualDesignAssetPackDir({ projectFilePath, assetPack: pseudoPack });
  const manifestPath = path.join(assetDir, "visual-design-manifest.json");
  if (!fs.existsSync(manifestPath)) {
    return { ok: false, code: "NOT_FOUND", error: "Visual design manifest not found" };
  }
  const assetPack = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  return {
    ok: true,
    artifactType: assetPack.artifactType,
    artifactId: assetPack.artifactId,
    assetDir,
    manifestPath,
    assetPack
  };
}
