function str(value = "") {
  return String(value || "").trim();
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
  buildResolvedTrackIdentityForMediaMatching = () => null,
  loadPersistedTrackIdentityForMediaPath = async () => null,
  resolvePreferredMediaCatalogEntry = () => null,
  setAudioPathWithAgentPolicy = () => {}
} = {}) {
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
