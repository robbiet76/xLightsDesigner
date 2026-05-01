import fs from "node:fs";
import path from "node:path";

import { ensureProjectStructure } from "./analysis-artifact-store.mjs";

function str(value = "") {
  return String(value || "").trim();
}

function normalizePathForCompare(filePath = "") {
  return path.resolve(str(filePath));
}

function readJson(filePath = "") {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath = "", value = {}) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function projectDirFor(projectFilePath = "") {
  const projectPath = normalizePathForCompare(projectFilePath);
  return projectPath ? path.dirname(projectPath) : "";
}

export function buildDisplayMetadataPaths(projectFilePath = "") {
  const projectDir = projectDirFor(projectFilePath);
  const displayDir = projectDir ? path.join(projectDir, "display") : "";
  const legacyLayoutDir = projectDir ? path.join(projectDir, "layout") : "";
  return {
    projectDir,
    displayDir,
    metadataPath: displayDir ? path.join(displayDir, "metadata.json") : "",
    modelIndexPath: displayDir ? path.join(displayDir, "model-index.json") : "",
    reconciliationPath: displayDir ? path.join(displayDir, "reconciliation.json") : "",
    discoveryPath: displayDir ? path.join(displayDir, "discovery.json") : "",
    legacyMetadataPath: legacyLayoutDir ? path.join(legacyLayoutDir, "layout-metadata.json") : ""
  };
}

export function readDisplayMetadataDocument({ projectFilePath = "" } = {}) {
  const paths = buildDisplayMetadataPaths(projectFilePath);
  if (!paths.projectDir) return { ok: false, error: "Missing projectFilePath" };
  const sourcePath = fs.existsSync(paths.metadataPath)
    ? paths.metadataPath
    : (fs.existsSync(paths.legacyMetadataPath) ? paths.legacyMetadataPath : "");
  if (!sourcePath) {
    return {
      ok: true,
      exists: false,
      metadataPath: paths.metadataPath,
      legacyMetadataPath: paths.legacyMetadataPath,
      document: {
        version: 1,
        tags: [],
        targetTags: {},
        preferencesByTargetId: {},
        visualHintDefinitions: []
      }
    };
  }
  return {
    ok: true,
    exists: true,
    metadataPath: sourcePath,
    canonicalMetadataPath: paths.metadataPath,
    legacy: sourcePath === paths.legacyMetadataPath,
    document: readJson(sourcePath)
  };
}

export function writeDisplayMetadataDocument({ projectFilePath = "", document = null } = {}) {
  const paths = buildDisplayMetadataPaths(projectFilePath);
  if (!paths.projectDir) return { ok: false, error: "Missing projectFilePath" };
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    return { ok: false, error: "Missing display metadata document" };
  }
  ensureProjectStructure(paths.projectDir);
  writeJson(paths.metadataPath, document);
  return {
    ok: true,
    metadataPath: paths.metadataPath
  };
}

export function writeDisplayRefreshArtifacts({
  projectFilePath = "",
  targetMetadata = null,
  reconciliation = null
} = {}) {
  const paths = buildDisplayMetadataPaths(projectFilePath);
  if (!paths.projectDir) return { ok: false, error: "Missing projectFilePath" };
  ensureProjectStructure(paths.projectDir);
  const rows = [];
  if (targetMetadata && typeof targetMetadata === "object" && !Array.isArray(targetMetadata)) {
    writeJson(paths.modelIndexPath, targetMetadata);
    rows.push({ kind: "model-index", path: paths.modelIndexPath });
  }
  if (reconciliation && typeof reconciliation === "object" && !Array.isArray(reconciliation)) {
    writeJson(paths.reconciliationPath, reconciliation);
    rows.push({ kind: "reconciliation", path: paths.reconciliationPath });
  }
  return {
    ok: true,
    displayDir: paths.displayDir,
    rows
  };
}

export function readDisplayRefreshArtifact({ projectFilePath = "", kind = "" } = {}) {
  const paths = buildDisplayMetadataPaths(projectFilePath);
  const byKind = {
    "model-index": paths.modelIndexPath,
    reconciliation: paths.reconciliationPath,
    discovery: paths.discoveryPath
  };
  const artifactPath = byKind[str(kind)];
  if (!artifactPath) return { ok: false, error: `Unsupported display artifact kind: ${kind}` };
  if (!fs.existsSync(artifactPath)) return { ok: false, code: "NOT_FOUND", error: "Display artifact not found", artifactPath };
  return {
    ok: true,
    kind: str(kind),
    artifactPath,
    artifact: readJson(artifactPath)
  };
}
