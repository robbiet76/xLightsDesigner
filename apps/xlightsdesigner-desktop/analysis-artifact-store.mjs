import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

const PROJECT_REQUIRED_SUBDIRS = ["analysis", "sequencing", "diagnostics"];

function normalizePathForCompare(filePath) {
  return path.resolve(String(filePath || "").trim());
}

function normalizeAnalysisProfileMode(value = "") {
  const mode = String(value || "").trim().toLowerCase();
  return mode === "fast" || mode === "deep" ? mode : "";
}

function getArtifactProfileMode(artifact = null) {
  const mode = artifact?.provenance?.analysisProfile?.mode;
  return normalizeAnalysisProfileMode(mode);
}

export function ensureProjectStructure(projectDir) {
  fs.mkdirSync(projectDir, { recursive: true });
  for (const dirName of PROJECT_REQUIRED_SUBDIRS) {
    fs.mkdirSync(path.join(projectDir, dirName), { recursive: true });
  }
}

export function mediaIdFromPathAndStat(mediaFilePath) {
  const abs = normalizePathForCompare(mediaFilePath);
  let size = 0;
  let mtimeMs = 0;
  try {
    const stat = fs.statSync(abs);
    size = Number(stat?.size || 0);
    mtimeMs = Number(stat?.mtimeMs || 0);
  } catch {
    size = 0;
    mtimeMs = 0;
  }
  return crypto.createHash("sha1").update(JSON.stringify({
    path: abs,
    size,
    mtimeMs: Math.round(mtimeMs)
  })).digest("hex");
}

export function buildAnalysisArtifactPaths(projectFilePath, mediaFilePath) {
  const projectPath = normalizePathForCompare(projectFilePath);
  const mediaPath = normalizePathForCompare(mediaFilePath);
  const mediaId = mediaIdFromPathAndStat(mediaPath);
  const projectDir = path.dirname(projectPath);
  const artifactDir = path.join(projectDir, "analysis", "media", mediaId);
  const artifactPath = path.join(artifactDir, "analysis.json");
  return { projectPath, mediaPath, mediaId, artifactDir, artifactPath };
}

export function buildProfiledAnalysisArtifactPath(projectFilePath, mediaFilePath, profileMode = "") {
  const base = buildAnalysisArtifactPaths(projectFilePath, mediaFilePath);
  const mode = normalizeAnalysisProfileMode(profileMode);
  if (!mode) {
    return { ...base, profileMode: "", profileArtifactPath: base.artifactPath };
  }
  return {
    ...base,
    profileMode: mode,
    profileArtifactPath: path.join(base.artifactDir, `analysis-${mode}.json`)
  };
}

export function readAnalysisArtifactFromProject({ projectFilePath = "", mediaFilePath = "", preferredProfileMode = "" } = {}) {
  const projectPath = String(projectFilePath || "").trim();
  const mediaPath = String(mediaFilePath || "").trim();
  if (!projectPath) return { ok: false, error: "Missing projectFilePath" };
  if (!mediaPath) return { ok: false, error: "Missing mediaFilePath" };
  if (!fs.existsSync(projectPath)) return { ok: false, error: "Project file not found" };
  const paths = buildAnalysisArtifactPaths(projectPath, mediaPath);
  const preferred = buildProfiledAnalysisArtifactPath(projectPath, mediaPath, preferredProfileMode);
  const deep = buildProfiledAnalysisArtifactPath(projectPath, mediaPath, "deep");
  const fast = buildProfiledAnalysisArtifactPath(projectPath, mediaPath, "fast");
  const candidates = [];
  if (preferred.profileMode) candidates.push(preferred.profileArtifactPath);
  candidates.push(deep.profileArtifactPath, paths.artifactPath, fast.profileArtifactPath);
  const artifactPath = candidates.find((candidate, index) => candidate && candidates.indexOf(candidate) === index && fs.existsSync(candidate));
  if (!artifactPath) {
    return { ok: false, code: "NOT_FOUND", mediaId: paths.mediaId, artifactPath: paths.artifactPath, error: "Analysis artifact not found" };
  }
  const raw = fs.readFileSync(artifactPath, "utf8");
  const artifact = JSON.parse(raw);
  return {
    ok: true,
    mediaId: paths.mediaId,
    artifactPath,
    artifact
  };
}

export function writeAnalysisArtifactToProject({ projectFilePath = "", mediaFilePath = "", artifact = null } = {}) {
  const projectPath = String(projectFilePath || "").trim();
  const mediaPath = String(mediaFilePath || "").trim();
  if (!projectPath) return { ok: false, error: "Missing projectFilePath" };
  if (!mediaPath) return { ok: false, error: "Missing mediaFilePath" };
  if (!artifact || typeof artifact !== "object" || Array.isArray(artifact)) return { ok: false, error: "Missing artifact" };
  if (!fs.existsSync(projectPath)) return { ok: false, error: "Project file not found" };
  const paths = buildAnalysisArtifactPaths(projectPath, mediaPath);
  const profileMode = getArtifactProfileMode(artifact);
  const profiledPaths = buildProfiledAnalysisArtifactPath(projectPath, mediaPath, profileMode);
  ensureProjectStructure(path.dirname(paths.projectPath));
  fs.mkdirSync(paths.artifactDir, { recursive: true });
  const doc = {
    ...artifact,
    media: {
      ...(artifact.media && typeof artifact.media === "object" ? artifact.media : {}),
      mediaId: paths.mediaId,
      path: paths.mediaPath
    }
  };
  if (profiledPaths.profileMode) {
    fs.writeFileSync(profiledPaths.profileArtifactPath, JSON.stringify(doc, null, 2), "utf8");
  }
  let shouldUpdateCanonical = true;
  if (profiledPaths.profileMode === "fast" && fs.existsSync(paths.artifactPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(paths.artifactPath, "utf8"));
      shouldUpdateCanonical = getArtifactProfileMode(existing) !== "deep";
    } catch {
      shouldUpdateCanonical = true;
    }
  }
  if (shouldUpdateCanonical) {
    fs.writeFileSync(paths.artifactPath, JSON.stringify(doc, null, 2), "utf8");
  }
  return {
    ok: true,
    mediaId: paths.mediaId,
    artifactPath: shouldUpdateCanonical ? paths.artifactPath : profiledPaths.profileArtifactPath,
    canonicalArtifactPath: paths.artifactPath,
    profileArtifactPath: profiledPaths.profileArtifactPath,
    artifact: doc
  };
}
