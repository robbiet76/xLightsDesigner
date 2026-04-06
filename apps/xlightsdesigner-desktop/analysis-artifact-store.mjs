import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

const PROJECT_REQUIRED_SUBDIRS = ["analysis", "sequencing", "diagnostics"];
const TRACK_LIBRARY_DIR_PARTS = ["library", "tracks"];

function normalizePathForCompare(filePath) {
  return path.resolve(String(filePath || "").trim());
}

function normalizeAnalysisProfileMode(value = "") {
  const mode = String(value || "").trim().toLowerCase();
  return mode === "fast" || mode === "deep" ? mode : "";
}

function getArtifactProfileMode(artifact = null) {
  if (!artifact || typeof artifact !== "object" || Array.isArray(artifact)) return "";
  const mode = normalizeAnalysisProfileMode(artifact?.provenance?.analysisProfile?.mode);
  return mode || "deep";
}

function normalizeArtifactModulesForProfile(artifact = null, profileMode = "", mediaId = "") {
  if (!artifact || typeof artifact !== "object" || Array.isArray(artifact)) return artifact;
  const mode = normalizeAnalysisProfileMode(profileMode);
  if (!mode) return artifact;
  const modules = artifact.modules && typeof artifact.modules === "object" ? artifact.modules : null;
  if (!modules) return artifact;
  const nextModules = {};
  for (const [key, value] of Object.entries(modules)) {
    const moduleObj = value && typeof value === "object" && !Array.isArray(value) ? value : value;
    if (!moduleObj || typeof moduleObj !== "object" || Array.isArray(moduleObj)) {
      nextModules[key] = value;
      continue;
    }
    const metadata = moduleObj.metadata && typeof moduleObj.metadata === "object" && !Array.isArray(moduleObj.metadata)
      ? moduleObj.metadata
      : {};
    const moduleId = String(metadata.moduleId || key || "").trim();
    const moduleVersion = String(metadata.moduleVersion || "v1").trim();
    nextModules[key] = {
      ...moduleObj,
      metadata: {
        ...metadata,
        profileMode: mode,
        invalidationKey: mediaId && moduleId && moduleVersion
          ? `${mediaId}:${mode}:${moduleId}:${moduleVersion}`
          : String(metadata.invalidationKey || "")
      }
    };
  }
  return {
    ...artifact,
    modules: nextModules
  };
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

function mediaContentFingerprint(mediaFilePath) {
  const abs = normalizePathForCompare(mediaFilePath);
  const h = crypto.createHash("sha256");
  const fh = fs.openSync(abs, "r");
  try {
    const buffer = Buffer.allocUnsafe(1024 * 1024);
    for (;;) {
      const read = fs.readSync(fh, buffer, 0, buffer.length, null);
      if (!read) break;
      h.update(read === buffer.length ? buffer : buffer.subarray(0, read));
    }
  } finally {
    fs.closeSync(fh);
  }
  return h.digest("hex");
}

function artifactContentFingerprint(artifact = null) {
  if (!artifact || typeof artifact !== "object" || Array.isArray(artifact)) return "";
  const mediaFingerprint = String(artifact?.media?.contentFingerprint || "").trim().toLowerCase();
  if (mediaFingerprint) return mediaFingerprint;
  const identityFingerprint = String(artifact?.identity?.contentFingerprint || "").trim().toLowerCase();
  if (identityFingerprint) return identityFingerprint;
  return "";
}

function resolveAppRootFromProjectFile(projectFilePath = "") {
  const projectPath = normalizePathForCompare(projectFilePath);
  if (!projectPath) return "";
  const projectDir = path.dirname(projectPath);
  const projectsDir = path.dirname(projectDir);
  if (path.basename(projectsDir) === "projects") {
    return path.dirname(projectsDir);
  }
  return projectDir;
}

function getTrackLibraryDir(projectFilePath = "") {
  const appRoot = resolveAppRootFromProjectFile(projectFilePath);
  return appRoot ? path.join(appRoot, ...TRACK_LIBRARY_DIR_PARTS) : "";
}

function slugifyTrackFileStem(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function basenameWithoutExt(filePath = "") {
  const base = path.basename(String(filePath || "").trim());
  return base.replace(/\.[^.]+$/, "").trim();
}

function rows(value) {
  return Array.isArray(value) ? value.filter((row) => row && typeof row === "object" && !Array.isArray(row)) : [];
}

function str(value = "") {
  return String(value || "").trim();
}

function finiteOrNull(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeSegmentRows(rowsValue = [], { defaultKind = "", allowNullLabel = false } = {}) {
  return rows(rowsValue)
    .map((row) => {
      const startMs = finiteOrNull(row.startMs);
      const endMs = finiteOrNull(row.endMs);
      if (startMs == null || endMs == null || endMs < startMs) return null;
      const label = allowNullLabel ? (row.label == null ? null : str(row.label)) : str(row.label);
      return {
        startMs,
        endMs,
        label: allowNullLabel ? label : (label || null),
        kind: str(row.kind || defaultKind) || defaultKind || "segment"
      };
    })
    .filter(Boolean);
}

function buildCanonicalTimingTracks(canonicalArtifact = null) {
  if (!canonicalArtifact || typeof canonicalArtifact !== "object" || Array.isArray(canonicalArtifact)) return [];
  const durationMs = finiteOrNull(canonicalArtifact?.media?.durationMs);
  const structureSegments = normalizeSegmentRows(canonicalArtifact?.structure?.sections, { defaultKind: "section" });
  const syncedPhraseSegments = normalizeSegmentRows(canonicalArtifact?.lyrics?.lines, { defaultKind: "phrase", allowNullLabel: true });
  const fallbackPhraseSegments = normalizeSegmentRows(canonicalArtifact?.lyrics?.plainPhraseFallback?.phrases, { defaultKind: "phrase", allowNullLabel: true });
  const phraseSegments = syncedPhraseSegments.length ? syncedPhraseSegments : fallbackPhraseSegments;
  const beatSegments = normalizeSegmentRows(canonicalArtifact?.timing?.beats, { defaultKind: "beat" });
  const barSegments = normalizeSegmentRows(canonicalArtifact?.timing?.bars, { defaultKind: "bar" });
  const chordSegments = normalizeSegmentRows(canonicalArtifact?.harmonic?.chords, { defaultKind: "chord", allowNullLabel: true });
  const bpm = finiteOrNull(canonicalArtifact?.timing?.bpm);
  const timeSignature = str(canonicalArtifact?.timing?.timeSignature);
  const tracks = [];

  if (structureSegments.length) {
    tracks.push({
      type: "song_structure",
      name: "XD: Song Structure",
      coverageMode: durationMs != null ? "complete" : "partial",
      segmentCount: structureSegments.length,
      segments: structureSegments
    });
  }
  if (phraseSegments.length) {
    tracks.push({
      type: "phrase_cues",
      name: "XD: Phrase Cues",
      coverageMode: durationMs != null ? "complete" : "partial",
      segmentCount: phraseSegments.length,
      segments: phraseSegments
    });
  }
  if (beatSegments.length) {
    tracks.push({
      type: "beats",
      name: "XD: Beats",
      coverageMode: "event_series",
      segmentCount: beatSegments.length,
      tempoBpm: bpm,
      timeSignature: timeSignature || null,
      segments: beatSegments
    });
  }
  if (barSegments.length) {
    tracks.push({
      type: "bars",
      name: "XD: Bars",
      coverageMode: "event_series",
      segmentCount: barSegments.length,
      tempoBpm: bpm,
      timeSignature: timeSignature || null,
      segments: barSegments
    });
  }
  if (chordSegments.length) {
    tracks.push({
      type: "chords",
      name: "XD: Chords",
      coverageMode: "event_series",
      segmentCount: chordSegments.length,
      segments: chordSegments
    });
  }
  return tracks;
}

function buildTrackDisplayParts(mediaFilePath = "", artifact = null, contentFingerprint = "") {
  const identity = artifact?.identity && typeof artifact.identity === "object" ? artifact.identity : {};
  const title = String(identity.title || "").trim();
  const artist = String(identity.artist || "").trim();
  const shortFingerprint = String(contentFingerprint || "").trim().toLowerCase().slice(0, 8);
  const fallbackTitle = title || (shortFingerprint ? `track-${shortFingerprint}` : "track-unidentified");
  const stem = slugifyTrackFileStem([fallbackTitle, artist].filter(Boolean).join("-")) || "track";
  return {
    title: fallbackTitle,
    artist,
    stem
  };
}

function buildTrackRecordPathCandidate(projectFilePath = "", mediaFilePath = "", artifact = null, contentFingerprint = "") {
  const libraryDir = getTrackLibraryDir(projectFilePath);
  const { stem } = buildTrackDisplayParts(mediaFilePath, artifact, contentFingerprint);
  const normalizedFingerprint = String(contentFingerprint || "").trim().toLowerCase();
  const shortFingerprint = normalizedFingerprint ? normalizedFingerprint.slice(0, 8) : "";
  return {
    appRoot: resolveAppRootFromProjectFile(projectFilePath),
    libraryDir,
    fileStem: stem,
    defaultRecordPath: libraryDir ? path.join(libraryDir, `${stem}.json`) : "",
    collisionRecordPath: libraryDir && shortFingerprint ? path.join(libraryDir, `${stem}-${shortFingerprint}.json`) : ""
  };
}

function readTrackRecord(recordPath = "") {
  if (!recordPath || !fs.existsSync(recordPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(recordPath, "utf8"));
  } catch {
    return null;
  }
}

function findTrackRecordByContentFingerprint(projectFilePath = "", contentFingerprint = "") {
  const libraryDir = getTrackLibraryDir(projectFilePath);
  const fingerprint = String(contentFingerprint || "").trim().toLowerCase();
  if (!libraryDir || !fingerprint || !fs.existsSync(libraryDir)) return null;
  let entries = [];
  try {
    entries = fs.readdirSync(libraryDir, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries) {
    if (!entry.isFile() || !String(entry.name || "").toLowerCase().endsWith(".json")) continue;
    const recordPath = path.join(libraryDir, entry.name);
    const record = readTrackRecord(recordPath);
    const recordFingerprint = String(record?.track?.identity?.contentFingerprint || "").trim().toLowerCase();
    if (recordFingerprint && recordFingerprint === fingerprint) {
      return { recordPath, record };
    }
  }
  return null;
}

function findRecordPathForWrite(projectFilePath = "", mediaFilePath = "", artifact = null, contentFingerprint = "") {
  const existing = findTrackRecordByContentFingerprint(projectFilePath, contentFingerprint);
  const candidate = buildTrackRecordPathCandidate(projectFilePath, mediaFilePath, artifact, contentFingerprint);
  if (!candidate.defaultRecordPath) return { recordPath: "", previousRecordPath: "" };
  if (existing?.recordPath) {
    if (existing.recordPath === candidate.defaultRecordPath || existing.recordPath === candidate.collisionRecordPath) {
      return { recordPath: existing.recordPath, previousRecordPath: "" };
    }
    const existingDefault = readTrackRecord(candidate.defaultRecordPath);
    const existingDefaultFingerprint = String(existingDefault?.track?.identity?.contentFingerprint || "").trim().toLowerCase();
    if (!existingDefault || !existingDefaultFingerprint || existingDefaultFingerprint === String(contentFingerprint || "").trim().toLowerCase()) {
      return { recordPath: candidate.defaultRecordPath, previousRecordPath: existing.recordPath };
    }
    if (candidate.collisionRecordPath) {
      const existingCollision = readTrackRecord(candidate.collisionRecordPath);
      const existingCollisionFingerprint = String(existingCollision?.track?.identity?.contentFingerprint || "").trim().toLowerCase();
      if (!existingCollision || !existingCollisionFingerprint || existingCollisionFingerprint === String(contentFingerprint || "").trim().toLowerCase()) {
        return { recordPath: candidate.collisionRecordPath, previousRecordPath: existing.recordPath };
      }
    }
    return { recordPath: existing.recordPath, previousRecordPath: "" };
  }
  if (!fs.existsSync(candidate.defaultRecordPath)) {
    return { recordPath: candidate.defaultRecordPath, previousRecordPath: "" };
  }
  const existingDefault = readTrackRecord(candidate.defaultRecordPath);
  const existingFingerprint = String(existingDefault?.track?.identity?.contentFingerprint || "").trim().toLowerCase();
  if (!existingFingerprint || existingFingerprint === String(contentFingerprint || "").trim().toLowerCase()) {
    return { recordPath: candidate.defaultRecordPath, previousRecordPath: "" };
  }
  return { recordPath: candidate.collisionRecordPath || candidate.defaultRecordPath, previousRecordPath: "" };
}

function buildTrackRecordFromArtifact({ projectFilePath = "", mediaFilePath = "", artifact = null, mediaId = "", contentFingerprint = "", canonicalArtifact = null, profiledArtifact = null, profileMode = "" } = {}) {
  const identity = artifact?.identity && typeof artifact.identity === "object" ? artifact.identity : {};
  const title = String(identity.title || "").trim() || basenameWithoutExt(mediaFilePath);
  const artist = String(identity.artist || "").trim();
  const displayName = [title, artist].filter(Boolean).join(" - ") || title;
  const selectedMode = normalizeAnalysisProfileMode(profileMode) || getArtifactProfileMode(profiledArtifact) || getArtifactProfileMode(canonicalArtifact) || "";
  const profiles = {};
  if (profiledArtifact && selectedMode) profiles[selectedMode] = profiledArtifact;
  const canonicalMode = getArtifactProfileMode(canonicalArtifact) || selectedMode;
  if (canonicalArtifact && canonicalMode && !profiles[canonicalMode]) profiles[canonicalMode] = canonicalArtifact;
  const timingTracks = buildCanonicalTimingTracks(canonicalArtifact || artifact);
  return {
    version: 2,
    track: {
      title,
      artist,
      displayName,
      identity: {
        contentFingerprint,
        isrc: String(identity.isrc || "").trim() || null
      },
      sourceMedia: {
        mediaId,
        path: normalizePathForCompare(mediaFilePath),
        fileName: path.basename(normalizePathForCompare(mediaFilePath))
      }
    },
    analysis: {
      canonicalProfile: canonicalMode || null,
      availableProfiles: Object.keys(profiles).sort()
    },
    timingTracks,
    analyses: {
      canonicalProfile: canonicalMode || null,
      profiles
    }
  };
}

function getArtifactFromTrackRecord(record = null, preferredProfileMode = "") {
  const profiles = record?.analyses?.profiles && typeof record.analyses.profiles === "object" ? record.analyses.profiles : {};
  const preferred = normalizeAnalysisProfileMode(preferredProfileMode);
  if (preferred && profiles[preferred]) return { artifact: profiles[preferred], selectedProfileMode: preferred };
  if (profiles.deep) return { artifact: profiles.deep, selectedProfileMode: "deep" };
  const canonical = normalizeAnalysisProfileMode(record?.analyses?.canonicalProfile);
  if (canonical && profiles[canonical]) return { artifact: profiles[canonical], selectedProfileMode: canonical };
  if (profiles.fast) return { artifact: profiles.fast, selectedProfileMode: "fast" };
  return { artifact: null, selectedProfileMode: "" };
}

export function buildAnalysisArtifactPaths(projectFilePath, mediaFilePath, artifact = null) {
  const projectPath = normalizePathForCompare(projectFilePath);
  const mediaPath = normalizePathForCompare(mediaFilePath);
  const mediaId = mediaIdFromPathAndStat(mediaPath);
  const contentFingerprint = mediaContentFingerprint(mediaPath);
  const libraryDir = getTrackLibraryDir(projectPath);
  const recordPathInfo = findRecordPathForWrite(projectPath, mediaPath, artifact, contentFingerprint);
  return {
    projectPath,
    mediaPath,
    mediaId,
    contentFingerprint,
    appRoot: resolveAppRootFromProjectFile(projectPath),
    libraryDir,
    artifactDir: libraryDir,
    artifactPath: recordPathInfo.recordPath,
    recordPath: recordPathInfo.recordPath
  };
}

export function buildProfiledAnalysisArtifactPath(projectFilePath, mediaFilePath, profileMode = "", artifact = null) {
  const base = buildAnalysisArtifactPaths(projectFilePath, mediaFilePath, artifact);
  const mode = normalizeAnalysisProfileMode(profileMode);
  return {
    ...base,
    profileMode: mode,
    profileArtifactPath: base.recordPath
  };
}

export function readAnalysisArtifactFromProject({ projectFilePath = "", mediaFilePath = "", contentFingerprint = "", preferredProfileMode = "" } = {}) {
  const projectPath = String(projectFilePath || "").trim();
  const mediaPath = String(mediaFilePath || "").trim();
  const requestedContentFingerprint = String(contentFingerprint || "").trim().toLowerCase();
  if (!projectPath) return { ok: false, error: "Missing projectFilePath" };
  if (!mediaPath && !requestedContentFingerprint) return { ok: false, error: "Missing mediaFilePath or contentFingerprint" };
  if (!fs.existsSync(projectPath)) return { ok: false, error: "Project file not found" };
  const mediaId = mediaPath ? mediaIdFromPathAndStat(mediaPath) : "";
  let resolvedContentFingerprint = requestedContentFingerprint;
  if (!resolvedContentFingerprint && mediaPath) {
    try {
      resolvedContentFingerprint = mediaContentFingerprint(mediaPath);
    } catch {
      resolvedContentFingerprint = "";
    }
  }
  const match = resolvedContentFingerprint ? findTrackRecordByContentFingerprint(projectPath, resolvedContentFingerprint) : null;
  if (!match?.record) {
    const artifactPath = mediaPath ? buildAnalysisArtifactPaths(projectPath, mediaPath).artifactPath : "";
    return { ok: false, code: "NOT_FOUND", mediaId, artifactPath, error: "Analysis artifact not found" };
  }
  const { artifact, selectedProfileMode } = getArtifactFromTrackRecord(match.record, preferredProfileMode);
  if (!artifact) {
    return { ok: false, code: "NOT_FOUND", mediaId, artifactPath: match.recordPath, error: "Analysis artifact profile not found" };
  }
  return {
    ok: true,
    mediaId,
    artifactPath: match.recordPath,
    recordPath: match.recordPath,
    artifact,
    matchedBy: "contentFingerprint",
    selectedProfileMode,
    trackRecord: match.record
  };
}

export function writeAnalysisArtifactToProject({ projectFilePath = "", mediaFilePath = "", artifact = null } = {}) {
  const projectPath = String(projectFilePath || "").trim();
  const mediaPath = String(mediaFilePath || "").trim();
  if (!projectPath) return { ok: false, error: "Missing projectFilePath" };
  if (!mediaPath) return { ok: false, error: "Missing mediaFilePath" };
  if (!artifact || typeof artifact !== "object" || Array.isArray(artifact)) return { ok: false, error: "Missing artifact" };
  if (!fs.existsSync(projectPath)) return { ok: false, error: "Project file not found" };

  const mediaId = mediaIdFromPathAndStat(mediaPath);
  const contentFingerprint = artifactContentFingerprint(artifact) || mediaContentFingerprint(mediaPath);
  const profileMode = getArtifactProfileMode(artifact);
  const normalizedDoc = normalizeArtifactModulesForProfile({
    ...artifact,
    media: {
      ...(artifact.media && typeof artifact.media === "object" ? artifact.media : {}),
      mediaId,
      path: normalizePathForCompare(mediaPath),
      contentFingerprint
    },
    identity: {
      ...(artifact.identity && typeof artifact.identity === "object" ? artifact.identity : {}),
      contentFingerprint
    }
  }, profileMode, mediaId);

  const { recordPath, previousRecordPath } = findRecordPathForWrite(projectPath, mediaPath, normalizedDoc, contentFingerprint);
  const libraryDir = getTrackLibraryDir(projectPath);
  ensureProjectStructure(path.dirname(projectPath));
  fs.mkdirSync(libraryDir, { recursive: true });

  const existingRecord = readTrackRecord(recordPath) || {};
  const existingProfiles = existingRecord?.analyses?.profiles && typeof existingRecord.analyses.profiles === "object" ? existingRecord.analyses.profiles : {};
  const nextProfiles = { ...existingProfiles };
  if (profileMode) nextProfiles[profileMode] = normalizedDoc;

  let canonicalArtifact = normalizedDoc;
  let canonicalProfile = profileMode || getArtifactProfileMode(normalizedDoc) || null;
  const existingCanonicalProfile = normalizeAnalysisProfileMode(existingRecord?.analyses?.canonicalProfile);
  if (existingCanonicalProfile === "deep" && profileMode === "fast" && existingProfiles.deep) {
    canonicalArtifact = existingProfiles.deep;
    canonicalProfile = "deep";
  } else if (!canonicalProfile && existingCanonicalProfile && existingProfiles[existingCanonicalProfile]) {
    canonicalArtifact = existingProfiles[existingCanonicalProfile];
    canonicalProfile = existingCanonicalProfile;
  }

  const record = buildTrackRecordFromArtifact({
    projectFilePath: projectPath,
    mediaFilePath: mediaPath,
    artifact: normalizedDoc,
    mediaId,
    contentFingerprint,
    canonicalArtifact,
    profiledArtifact: profileMode ? normalizedDoc : null,
    profileMode: canonicalProfile
  });
  record.analyses.profiles = nextProfiles;
  if (canonicalProfile && nextProfiles[canonicalProfile]) {
    record.analyses.canonicalProfile = canonicalProfile;
  } else if (profileMode) {
    record.analyses.canonicalProfile = profileMode;
  }

  fs.writeFileSync(recordPath, JSON.stringify(record, null, 2), "utf8");
  if (previousRecordPath && previousRecordPath !== recordPath) {
    try {
      fs.rmSync(previousRecordPath, { force: true });
    } catch {
      // best effort; current record has already been written
    }
  }
  return {
    ok: true,
    mediaId,
    contentFingerprint,
    artifactPath: recordPath,
    canonicalArtifactPath: recordPath,
    profileArtifactPath: recordPath,
    recordPath,
    artifact: normalizedDoc,
    trackRecord: record
  };
}
