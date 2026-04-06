function str(value = "") {
  return String(value || "").trim();
}

function toTimeText(value = "") {
  const raw = str(value);
  if (!raw) return "";
  const date = new Date(raw);
  return Number.isNaN(date.getTime())
    ? raw
    : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function toLastAnalyzedText(value = "") {
  const raw = str(value);
  if (!raw) return "never";
  const date = new Date(raw);
  return Number.isNaN(date.getTime())
    ? raw
    : date.toLocaleString([], { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function buildAudioOptions({ mediaCatalog = [], selectedAudioPath = "", basenameOfPath }) {
  const rows = Array.isArray(mediaCatalog) ? mediaCatalog : [];
  const selected = str(selectedAudioPath);
  const selectedCatalogItem = rows.find((row) => str(row?.path) === selected) || null;
  if (selectedCatalogItem) {
    return rows.map((row) => ({
      path: str(row?.path),
      label: str(row?.fileName || row?.relativePath || row?.path),
      detail: str(row?.relativePath || row?.fileName || row?.path),
      selected: str(row?.path) === selected
    }));
  }
  if (selected) {
    return [
      {
        path: selected,
        label: str(basenameOfPath?.(selected) || selected),
        detail: "Current selection (outside Media Directory)",
        selected: true
      },
      ...rows.map((row) => ({
        path: str(row?.path),
        label: str(row?.fileName || row?.relativePath || row?.path),
        detail: str(row?.relativePath || row?.fileName || row?.path),
        selected: false
      }))
    ];
  }
  return rows.map((row) => ({
    path: str(row?.path),
    label: str(row?.fileName || row?.relativePath || row?.path),
    detail: str(row?.relativePath || row?.fileName || row?.path),
    selected: false
  }));
}

function summarizeTimingAvailability(availableNames = []) {
  const names = new Set((Array.isArray(availableNames) ? availableNames : []).map((row) => str(row)).filter(Boolean));
  const required = [
    "XD: Song Structure",
    "XD: Phrase Cues",
    "XD: Beats",
    "XD: Bars"
  ];
  const optional = ["XD: Chords"];
  const available = required.filter((name) => names.has(name));
  const missing = required.filter((name) => !names.has(name));
  const optionalAvailable = optional.filter((name) => names.has(name));
  return {
    available,
    missing,
    optionalAvailable,
    summaryText: available.length ? available.map((name) => name.replace(/^XD:\s*/, "")).join(", ") : "None yet",
    missingText: missing.length ? missing.map((name) => name.replace(/^XD:\s*/, "")).join(", ") : "None"
  };
}

function isTempTrackName(title = "") {
  return /^track-[a-f0-9]{8}$/i.test(str(title));
}

function classifyLibraryRow(row = {}) {
  const timing = summarizeTimingAvailability(row.availableTimingNames);
  const verificationStatus = str(row.verificationStatus || "unverified");
  const tempName = isTempTrackName(row.title);
  const needsIdentityReview = tempName || verificationStatus === "unverified" || !row.titlePresent || !row.artistPresent;
  const hasProfiles = Array.isArray(row.availableProfiles) && row.availableProfiles.length > 0;

  if (!hasProfiles) {
    return {
      status: "Failed",
      reason: "Analysis record is missing a usable profile.",
      action: "Re-run analysis",
      timing
    };
  }
  if (needsIdentityReview) {
    return {
      status: "Needs Review",
      reason: "Track title and artist still need confirmation.",
      actionKind: "verify_identity",
      action: "Verify track info",
      timing
    };
  }
  if (timing.missing.length) {
    const missingPhraseOnly = timing.missing.length === 1 && timing.missing[0] === "XD: Phrase Cues";
    return {
      status: "Partial",
      reason: `Missing ${timing.missingText}.`,
      actionKind: missingPhraseOnly ? "none" : "review_details",
      action: missingPhraseOnly ? "No action needed" : "Review details",
      timing
    };
  }
  return {
    status: "Complete",
    reason: "Required timing layers are available.",
    actionKind: "none",
    action: "",
    timing
  };
}

function isActiveAnalysisProgress(state = {}) {
  const stage = str(state.audioAnalysis?.progress?.stage);
  if (!stage) return false;
  if (["artifact_reused", "handoff_ready", "failed"].includes(stage)) return false;
  return Boolean(state.ui?.agentThinking);
}

function buildCurrentResultFromLibraryRow(row = {}) {
  const timingSummary = summarizeTimingAvailability(row.availableTimingNames);
  return {
    hasTrack: true,
    title: str(row.displayName || row.title || "Selected track"),
    subtitle: str(row.artist || row.fileName || ""),
    summary: str(row.detail?.reason || "Shared track metadata is available."),
    isRunning: false,
    progressMessage: "",
    lastAnalyzedLabel: toLastAnalyzedText(row.updatedAt),
    timingSummary,
    bpmText: str(row.bpmText),
    meterText: str(row.meterText),
    selectedAudioPath: ""
  };
}

function buildCurrentResult({ state = {}, analysis = {}, basenameOfPath, selectedLibraryRow = null }) {
  if (selectedLibraryRow) {
    return buildCurrentResultFromLibraryRow(selectedLibraryRow);
  }
  const selectedAudioPath = str(state.audioPathInput);
  const identity = analysis?.trackIdentity && typeof analysis.trackIdentity === "object" ? analysis.trackIdentity : {};
  const artifact = state.audioAnalysis?.artifact && typeof state.audioAnalysis.artifact === "object" ? state.audioAnalysis.artifact : {};
  const timing = artifact?.timing && typeof artifact.timing === "object" ? artifact.timing : (analysis?.timing && typeof analysis.timing === "object" ? analysis.timing : {});
  const structure = artifact?.structure && typeof artifact.structure === "object" ? artifact.structure : (analysis?.structure && typeof analysis.structure === "object" ? analysis.structure : {});
  const lyrics = artifact?.lyrics && typeof artifact.lyrics === "object" ? artifact.lyrics : (analysis?.lyrics && typeof analysis.lyrics === "object" ? analysis.lyrics : {});
  const title = str(identity?.title || basenameOfPath(selectedAudioPath) || "No track selected");
  const artist = str(identity?.artist);
  const availableTimingNames = [];
  if (Array.isArray(structure?.sections) && structure.sections.length) availableTimingNames.push("XD: Song Structure");
  if (Array.isArray(lyrics?.lines) && lyrics.lines.length) availableTimingNames.push("XD: Phrase Cues");
  if (Array.isArray(timing?.beats) && timing.beats.length) availableTimingNames.push("XD: Beats");
  if (Array.isArray(timing?.bars) && timing.bars.length) availableTimingNames.push("XD: Bars");
  const timingSummary = summarizeTimingAvailability(availableTimingNames);
  const isRunning = isActiveAnalysisProgress(state) && Boolean(selectedAudioPath);
  return {
    hasTrack: Boolean(selectedAudioPath),
    title,
    subtitle: artist || selectedAudioPath || "Choose a track or folder to begin.",
    summary: str(state.audioAnalysis?.summary || "No analysis has been run for the current track yet."),
    isRunning,
    progressMessage: str(
      state.audioAnalysis?.progress?.message ||
      (isRunning ? "Audio analysis is in progress." : "")
    ),
    lastAnalyzedLabel: toLastAnalyzedText(state.audioAnalysis?.lastAnalyzedAt),
    timingSummary,
    bpmText: timing?.bpm != null ? `${timing.bpm} BPM` : "",
    meterText: str(timing?.timeSignature),
    selectedAudioPath
  };
}

function buildLibraryGridRows(tracks = [], selectedKey = "") {
  return (Array.isArray(tracks) ? tracks : []).map((row) => {
    const status = classifyLibraryRow(row);
    const key = str(row.contentFingerprint || row.recordPath || row.fileName);
    return {
      key,
      selected: selectedKey ? key === selectedKey : false,
      title: str(row.title),
      displayName: str(row.displayName || row.title || row.fileName),
      artist: str(row.artist),
      fileName: str(row.fileName),
      updatedAt: str(row.updatedAt),
      status: status.status,
      actionKind: str(status.actionKind || "none"),
      availableTimingsText: status.timing.summaryText,
      missingIssuesText: status.reason,
      identityText: status.status === "Needs Review" ? "Needs review" : "Verified",
      lastAnalyzedLabel: toLastAnalyzedText(row.updatedAt),
      actionText: str(status.action || "None"),
      detail: {
        key,
        actionKind: str(status.actionKind || "none"),
        actionText: str(status.action || "None"),
        reason: status.reason,
        availableProfiles: Array.isArray(row.availableProfiles) ? row.availableProfiles : [],
        timing: status.timing,
        fileName: str(row.fileName),
        verificationStatus: str(row.verificationStatus),
        recordPath: str(row.recordPath),
        sourceMediaPath: str(row.sourceMediaPath),
        suggestedTitle: str(row.suggestedTitle),
        suggestedArtist: str(row.suggestedArtist),
        embeddedTitle: str(row.embeddedTitle),
        embeddedArtist: str(row.embeddedArtist),
        recommendedFileName: str(row.recommendedFileName),
        shouldRename: row.shouldRename === true,
        shouldRetag: row.shouldRetag === true
      }
    };
  });
}

function buildLibraryOverview(rows = []) {
  const total = rows.length;
  const counts = { Complete: 0, Partial: 0, "Needs Review": 0, Failed: 0 };
  for (const row of rows) {
    counts[row.status] = Number(counts[row.status] || 0) + 1;
  }
  return {
    total,
    complete: counts.Complete,
    partial: counts.Partial,
    needsReview: counts["Needs Review"],
    failed: counts.Failed
  };
}

function resolveSelectedDetail(rows = [], selectedKey = "") {
  if (!rows.length) return null;
  const explicit = selectedKey ? rows.find((row) => row.key === selectedKey) : null;
  return (explicit || rows[0])?.detail || null;
}

function resolveSelectedLibraryRow(rows = [], selectedKey = "") {
  if (!rows.length) return null;
  return selectedKey ? rows.find((row) => row.key === selectedKey) || null : null;
}

export function buildAudioDashboardState({
  state = {},
  analysisHandoff = null,
  basenameOfPath = (value) => value
} = {}) {
  const selectedAudioPath = str(state.audioPathInput);
  const mediaCatalog = Array.isArray(state.mediaCatalog) ? state.mediaCatalog : [];
  const analysis = analysisHandoff && typeof analysisHandoff === "object" ? analysisHandoff : {};
  const options = buildAudioOptions({ mediaCatalog, selectedAudioPath, basenameOfPath });
  const audioLibrary = state.audioLibrary && typeof state.audioLibrary === "object" ? state.audioLibrary : {};
  const selectedKey = str(state.ui?.audioLibrarySelectedKey);
  const rows = buildLibraryGridRows(audioLibrary.tracks, selectedKey);
  const selectedRow = resolveSelectedLibraryRow(rows, selectedKey);
  const currentResult = buildCurrentResult({ state, analysis, basenameOfPath, selectedLibraryRow: selectedRow });
  const libraryOverview = buildLibraryOverview(rows);
  const detail = resolveSelectedDetail(rows, selectedKey);

  return {
    contract: "audio_dashboard_state_v2",
    version: "2.0",
    page: "audio",
    title: "Audio",
    header: {
      title: "Audio Analysis",
      summary: "Analyze tracks into the shared library, inspect current metadata quality, and confirm which timing layers are ready."
    },
    actions: {
      singleTrack: {
        selectedAudioPath,
        options,
        canAnalyze: Boolean(selectedAudioPath)
      },
      batch: {
        batchFolder: str(audioLibrary.batchFolder),
        recursive: audioLibrary.recursive !== false,
        isRunning: str(audioLibrary?.lastReview?.status) === "running"
      }
    },
    currentResult,
    library: {
      loadError: str(audioLibrary.loadError),
      lastLoadedLabel: toLastAnalyzedText(audioLibrary.lastLoadedAt),
      overview: libraryOverview,
      rows
    },
    detail,
    emptyState: !selectedAudioPath && rows.length === 0
      ? {
          title: "No Audio Metadata Yet",
          summary: "Analyze one track or a folder to start building the shared track library. This workflow is independent of xLights."
        }
      : null,
    latestBatchReview: {
      status: str(audioLibrary?.lastReview?.status),
      completedLabel: toLastAnalyzedText(audioLibrary?.lastReview?.completedAt || audioLibrary?.lastReview?.startedAt),
      totalTracks: Number(audioLibrary?.lastReview?.review?.totalTracks || 0),
      successfulTracks: Number(audioLibrary?.lastReview?.review?.successfulTracks || 0),
      failedTracks: Number(audioLibrary?.lastReview?.review?.failedTracks || 0)
    },
    refs: {
      selectedAudioPath: selectedAudioPath || null
    }
  };
}
