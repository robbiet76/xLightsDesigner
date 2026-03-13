import path from "node:path";
import fs from "node:fs";

import { ensureProjectStructure } from "./analysis-artifact-store.mjs";

const ARTIFACT_DIRS = {
  analysis_artifact_v1: path.join("artifacts", "analysis"),
  design_scene_context_v1: path.join("artifacts", "design-scene"),
  music_design_context_v1: path.join("artifacts", "music-context"),
  director_profile_v1: path.join("artifacts", "director-profiles"),
  creative_brief_v1: path.join("artifacts", "briefs"),
  proposal_bundle_v1: path.join("artifacts", "proposals"),
  intent_handoff_v1: path.join("artifacts", "intent-handoffs"),
  plan_handoff_v1: path.join("artifacts", "plans"),
  apply_result_v1: path.join("artifacts", "apply-results"),
  history_entry_v1: "history"
};

function normalizePathForCompare(filePath) {
  return path.resolve(String(filePath || "").trim());
}

function artifactDirForType(projectDir, artifactType) {
  const rel = ARTIFACT_DIRS[String(artifactType || "").trim()];
  if (!rel) return "";
  return path.join(projectDir, rel);
}

function artifactPathFor(projectFilePath, artifact = {}) {
  const projectPath = normalizePathForCompare(projectFilePath);
  const projectDir = path.dirname(projectPath);
  const artifactType = String(artifact?.artifactType || "").trim();
  const artifactId = String(artifact?.artifactId || "").trim();
  if (!projectPath || !artifactType || !artifactId) {
    return { ok: false, error: "Artifact requires projectFilePath, artifactType, and artifactId" };
  }
  const dir = artifactDirForType(projectDir, artifactType);
  if (!dir) return { ok: false, error: `Unsupported artifactType: ${artifactType}` };
  return {
    ok: true,
    projectPath,
    projectDir,
    artifactType,
    artifactId,
    artifactDir: dir,
    artifactPath: path.join(dir, `${artifactId}.json`)
  };
}

export function writeProjectArtifact({ projectFilePath = "", artifact = null } = {}) {
  if (!artifact || typeof artifact !== "object" || Array.isArray(artifact)) {
    return { ok: false, error: "Missing artifact" };
  }
  const resolved = artifactPathFor(projectFilePath, artifact);
  if (!resolved.ok) return resolved;
  if (!fs.existsSync(resolved.projectPath)) {
    return { ok: false, error: "Project file not found" };
  }
  ensureProjectStructure(resolved.projectDir);
  fs.mkdirSync(resolved.artifactDir, { recursive: true });
  fs.writeFileSync(resolved.artifactPath, JSON.stringify(artifact, null, 2), "utf8");
  return {
    ok: true,
    artifactType: resolved.artifactType,
    artifactId: resolved.artifactId,
    artifactPath: resolved.artifactPath
  };
}

export function writeProjectArtifacts({ projectFilePath = "", artifacts = [] } = {}) {
  const rows = Array.isArray(artifacts) ? artifacts : [];
  const results = [];
  for (const artifact of rows) {
    const out = writeProjectArtifact({ projectFilePath, artifact });
    if (!out.ok) return out;
    results.push(out);
  }
  return { ok: true, rows: results };
}

export function readProjectArtifact({ projectFilePath = "", artifactType = "", artifactId = "" } = {}) {
  const probe = artifactPathFor(projectFilePath, {
    artifactType,
    artifactId
  });
  if (!probe.ok) return probe;
  if (!fs.existsSync(probe.artifactPath)) {
    return { ok: false, code: "NOT_FOUND", error: "Artifact not found" };
  }
  const raw = fs.readFileSync(probe.artifactPath, "utf8");
  return {
    ok: true,
    artifactType: probe.artifactType,
    artifactId: probe.artifactId,
    artifactPath: probe.artifactPath,
    artifact: JSON.parse(raw)
  };
}
