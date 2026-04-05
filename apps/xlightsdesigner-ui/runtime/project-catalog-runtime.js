function str(value = "") {
  return String(value || "").trim();
}

function normalizeTrackIdentityToken(value = "") {
  return str(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function scoreMediaCatalogIdentityMatch(mediaRow = {}, targetIdentity = null) {
  const target = targetIdentity && typeof targetIdentity === "object" ? targetIdentity : null;
  if (!target) return null;
  const identity = mediaRow?.identity && typeof mediaRow.identity === "object" ? mediaRow.identity : {};
  const targetFingerprint = str(target?.contentFingerprint).toLowerCase();
  const rowFingerprint = str(identity?.contentFingerprint).toLowerCase();
  const targetIsrc = str(target?.isrc).toLowerCase();
  const rowIsrc = str(identity?.isrc).toLowerCase();
  const targetTitle = normalizeTrackIdentityToken(target?.title);
  const rowTitle = normalizeTrackIdentityToken(identity?.title);
  const targetArtist = normalizeTrackIdentityToken(target?.artist);
  const rowArtist = normalizeTrackIdentityToken(identity?.artist);
  const rowDurationMs = Number(identity?.durationMs || 0);
  const targetDurationMs = Number(target?.durationMs || 0);

  let score = 0;
  let matchBasis = "";

  if (targetFingerprint && rowFingerprint && targetFingerprint === rowFingerprint) {
    score = 120;
    matchBasis = "content_fingerprint";
  } else if (targetIsrc && rowIsrc && targetIsrc === rowIsrc) {
    score = 100;
    matchBasis = "isrc";
  } else if (targetTitle && rowTitle && targetTitle === rowTitle && targetArtist && rowArtist === targetArtist) {
    score = 90;
    matchBasis = "title_artist";
  } else {
    return null;
  }

  if (targetDurationMs > 0 && rowDurationMs > 0) {
    const delta = Math.abs(targetDurationMs - rowDurationMs);
    if (delta <= 2000) score += 10;
    else if (delta <= 10000) score += 5;
  }

  return { matched: true, score, matchBasis };
}


export function createProjectCatalogRuntime({
  state,
  supportedSequenceMediaExtensions = [],
  getDesktopSequenceBridge = () => null,
  getDesktopMediaCatalogBridge = () => null,
  setStatus = () => {},
  setStatusWithDiagnostics = () => {},
  persist = () => {},
  render = () => {},
  saveCurrentProjectSnapshot = () => {},
  getValidHandoff = () => null,
  getDesktopAnalysisArtifactBridge = () => null,
  setAudioPathWithAgentPolicy = () => {}
} = {}) {
  function buildResolvedTrackIdentityForMediaMatching() {
    const handoff = getValidHandoff("analysis_handoff_v1");
    const artifactIdentity = state.audioAnalysis?.artifact?.identity && typeof state.audioAnalysis.artifact.identity === "object"
      ? state.audioAnalysis.artifact.identity
      : null;
    const handoffIdentity = handoff?.trackIdentity && typeof handoff.trackIdentity === "object"
      ? handoff.trackIdentity
      : null;
    const identity = artifactIdentity || handoffIdentity || null;
    if (!identity) return null;
    const sourceMetadata = identity?.sourceMetadata && typeof identity.sourceMetadata === "object"
      ? identity.sourceMetadata
      : {};
    const title = str(identity?.title || sourceMetadata?.embeddedTitle || "");
    const artist = str(identity?.artist || sourceMetadata?.embeddedArtist || "");
    const isrc = str(identity?.isrc || "");
    const contentFingerprint = str(identity?.contentFingerprint || "").toLowerCase();
    const durationMs = Number(state.audioAnalysis?.artifact?.audio?.durationMs || handoff?.audio?.durationMs || 0) || 0;
    if (!title && !artist && !isrc && !contentFingerprint) return null;
    return {
      title,
      artist,
      isrc,
      contentFingerprint,
      durationMs: durationMs > 0 ? durationMs : null
    };
  }

  async function loadPersistedTrackIdentityForMediaPath(mediaFilePath = "", options = {}) {
    const bridge = getDesktopAnalysisArtifactBridge();
    const projectFilePath = str(state.projectFilePath);
    const targetPath = str(mediaFilePath);
    const preferredProfileMode = str(options?.preferredProfileMode || "deep").toLowerCase() || "deep";
    if (!bridge || !projectFilePath || !targetPath) return null;
    try {
      const res = await bridge.readAnalysisArtifact({
        projectFilePath,
        mediaFilePath: targetPath,
        preferredProfileMode
      });
      if (res?.ok !== true || !res.artifact || typeof res.artifact !== "object") return null;
      const artifact = res.artifact;
      const identity = artifact?.identity && typeof artifact.identity === "object" ? artifact.identity : {};
      const sourceMetadata = identity?.sourceMetadata && typeof identity.sourceMetadata === "object"
        ? identity.sourceMetadata
        : {};
      const title = str(identity?.title || sourceMetadata?.embeddedTitle || "");
      const artist = str(identity?.artist || sourceMetadata?.embeddedArtist || "");
      const isrc = str(identity?.isrc || "");
      const contentFingerprint = str(identity?.contentFingerprint || artifact?.media?.contentFingerprint || "").toLowerCase();
      const durationMs = Number(artifact?.audio?.durationMs || 0) || null;
      if (!title && !artist && !isrc && !contentFingerprint) return null;
      return { title, artist, isrc, contentFingerprint, durationMs };
    } catch {
      return null;
    }
  }

  function resolvePreferredMediaCatalogEntry(mediaFiles = [], { currentAudioPath = "", sequenceMediaPath = "", targetIdentity = null } = {}) {
    const rows = Array.isArray(mediaFiles) ? mediaFiles : [];
    const currentPath = str(currentAudioPath);
    const sequencePath = str(sequenceMediaPath);
    const exact =
      rows.find((row) => str(row?.path) === currentPath) ||
      rows.find((row) => str(row?.path) === sequencePath) ||
      null;
    if (exact) return { row: exact, basis: "exact_path" };

    const resolvedTargetIdentity = targetIdentity && typeof targetIdentity === "object"
      ? targetIdentity
      : buildResolvedTrackIdentityForMediaMatching();
    if (!resolvedTargetIdentity) return { row: null, basis: "" };

    const scored = rows
      .map((row) => {
        const match = scoreMediaCatalogIdentityMatch(row, resolvedTargetIdentity);
        if (!match) return null;
        return { row, ...match };
      })
      .filter(Boolean)
      .sort((a, b) => Number(b.score || 0) - Number(a.score || 0));

    if (!scored.length) return { row: null, basis: "" };
    const best = scored[0];
    const second = scored[1];
    if (second && Number(second.score || 0) === Number(best.score || 0)) {
      return { row: null, basis: "" };
    }
    return { row: best.row, basis: `identity:${best.matchBasis}` };
  }

  async function refreshSequenceCatalog(options = {}) {
    const silent = options?.silent === true;
    const showFolder = str(state.showFolder);
    if (!showFolder) {
      state.sequenceCatalog = [];
      state.showDirectoryStats = { xsqCount: 0, xdmetaCount: 0 };
      if (!silent) setStatus("warning", "Set Show Folder first.");
      persist();
      render();
      return;
    }
    const bridge = getDesktopSequenceBridge();
    if (!bridge) {
      if (!silent) setStatus("warning", "Sequence discovery requires desktop runtime.");
      render();
      return;
    }
    try {
      const res = await bridge.listSequencesInShowFolder({ showFolder });
      if (!res?.ok) {
        throw new Error(res?.error || "Unable to list sequences.");
      }
      const sequences = Array.isArray(res.sequences) ? res.sequences : [];
      state.sequenceCatalog = sequences;
      state.showDirectoryStats = {
        xsqCount: Number.isFinite(Number(res?.stats?.xsqCount)) ? Math.max(0, Number(res.stats.xsqCount)) : sequences.length,
        xdmetaCount: Number.isFinite(Number(res?.stats?.xdmetaCount)) ? Math.max(0, Number(res.stats.xdmetaCount)) : 0
      };
      if (state.ui.sequenceMode === "existing") {
        const exists = sequences.some((s) => str(s?.path) === state.sequencePathInput);
        if (!exists && sequences.length) {
          state.sequencePathInput = str(sequences[0].path);
        }
      }
      if (!silent) {
        setStatus("info", `Loaded ${sequences.length} sequence${sequences.length === 1 ? "" : "s"} from show folder.`);
      }
      saveCurrentProjectSnapshot();
      persist();
      render();
    } catch (err) {
      if (!silent) {
        setStatusWithDiagnostics(
          "action-required",
          `Sequence discovery failed: ${err.message}`,
          err.stack || ""
        );
      }
      render();
    }
  }

  async function refreshMediaCatalog(options = {}) {
    const silent = options?.silent === true;
    const mediaFolder = str(state.mediaPath);
    if (!mediaFolder) {
      state.mediaCatalog = [];
      if (!silent) setStatus("warning", "Set Media Directory first.");
      persist();
      render();
      return;
    }
    const bridge = getDesktopMediaCatalogBridge();
    if (!bridge) {
      if (!silent) setStatus("warning", "Media catalog requires desktop runtime.");
      render();
      return;
    }
    try {
      const res = await bridge.listMediaFilesInFolder({
        mediaFolder,
        extensions: Array.from(supportedSequenceMediaExtensions),
        includeIdentity: true,
        includeFingerprint: true
      });
      if (!res?.ok) throw new Error(res?.error || "Unable to list media files.");
      const mediaFiles = Array.isArray(res.mediaFiles) ? res.mediaFiles : [];
      state.mediaCatalog = mediaFiles;

      const currentAudioPath = str(state.audioPathInput);
      const sequenceMediaPath = str(state.sequenceMediaFile);
      const currentAudioExists = currentAudioPath ? mediaFiles.some((row) => str(row?.path) === currentAudioPath) : false;
      const sequenceMediaExists = sequenceMediaPath ? mediaFiles.some((row) => str(row?.path) === sequenceMediaPath) : false;
      let targetIdentity = buildResolvedTrackIdentityForMediaMatching();
      if (!targetIdentity && ((currentAudioPath && !currentAudioExists) || (sequenceMediaPath && !sequenceMediaExists))) {
        targetIdentity =
          await loadPersistedTrackIdentityForMediaPath(currentAudioPath) ||
          await loadPersistedTrackIdentityForMediaPath(sequenceMediaPath);
      }

      const preferred = resolvePreferredMediaCatalogEntry(mediaFiles, {
        currentAudioPath,
        sequenceMediaPath,
        targetIdentity
      });

      if (preferred?.row) {
        if (str(preferred.row.path) !== currentAudioPath) {
          setAudioPathWithAgentPolicy(
            str(preferred.row.path),
            preferred.basis === "exact_path"
              ? "media catalog preferred track"
              : `media catalog identity match (${preferred.basis})`
          );
        }
      } else if (currentAudioPath && currentAudioExists) {
        // Keep current external selection if it is valid and outside the media-library match set.
      } else if ((currentAudioPath && !currentAudioExists) || (sequenceMediaPath && !sequenceMediaExists)) {
        setAudioPathWithAgentPolicy("", "stale media path cleared because no exact identity match was available");
        if (!silent) {
          setStatus(
            "warning",
            "Sequence media path is stale and no verified media identity match was available. Select the actual media file to continue."
          );
        }
      } else if (mediaFiles.length === 1) {
        setAudioPathWithAgentPolicy(str(mediaFiles[0].path), "single media file selected");
      }

      if (!silent) {
        setStatus("info", `Media catalog refreshed: ${mediaFiles.length} file${mediaFiles.length === 1 ? "" : "s"} found.`);
      }
      persist();
      render();
    } catch (err) {
      state.mediaCatalog = [];
      if (!silent) {
        setStatusWithDiagnostics("warning", `Media catalog refresh failed: ${err?.message || err}`);
      }
      persist();
      render();
    }
  }

  return {
    refreshSequenceCatalog,
    refreshMediaCatalog
  };
}
