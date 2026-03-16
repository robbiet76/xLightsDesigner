function str(value = "") {
  return String(value || "").trim();
}

function escapeSectionLabel(section = {}) {
  return str(section?.label || section?.name);
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

export function buildAudioDashboardState({
  state = {},
  analysisHandoff = null,
  basenameOfPath = (value) => value
} = {}) {
  const selectedAudioPath = str(state.audioPathInput);
  const hasTrack = Boolean(selectedAudioPath);
  const mediaCatalog = Array.isArray(state.mediaCatalog) ? state.mediaCatalog : [];
  const analysis = analysisHandoff && typeof analysisHandoff === "object" ? analysisHandoff : {};
  const identity = analysis?.trackIdentity && typeof analysis.trackIdentity === "object" ? analysis.trackIdentity : {};
  const timing = analysis?.timing && typeof analysis.timing === "object" ? analysis.timing : {};
  const structure = analysis?.structure && typeof analysis.structure === "object" ? analysis.structure : {};
  const chords = analysis?.chords && typeof analysis.chords === "object" ? analysis.chords : {};
  const briefSeed = analysis?.briefSeed && typeof analysis.briefSeed === "object" ? analysis.briefSeed : {};
  const evidence = analysis?.evidence && typeof analysis.evidence === "object" ? analysis.evidence : {};
  const sections = Array.isArray(structure?.sections) ? structure.sections : [];
  const sectionLabels = sections.map(escapeSectionLabel).filter(Boolean);
  const visibleSections = sectionLabels.slice(0, 8);
  const firstLift = sectionLabels.find((label) => /chorus|bridge|hook/i.test(label)) || "";
  const holdCue = sectionLabels.find((label) => /intro|verse/i.test(label)) || "";
  const structureReady = sections.length > 0;
  const timingReady = timing?.bpm != null || Boolean(timing?.beatsArtifact) || Boolean(timing?.barsArtifact);
  const downstreamReady = structureReady && timingReady;
  const progress = state.audioAnalysis?.progress && typeof state.audioAnalysis.progress === "object"
    ? state.audioAnalysis.progress
    : null;
  const isInProgress = Boolean(progress?.stage) || Boolean(state.ui?.agentThinking && hasTrack);
  const progressMessage = str(
    progress?.message ||
    (isInProgress ? "Audio analysis is in progress." : "Idle. Select a track and run analysis.")
  );
  const summary = str(state.audioAnalysis?.summary || "Lyric's song understanding will appear here once analysis runs.");

  const readinessReasons = [];
  if (!hasTrack) readinessReasons.push("no_audio_track_selected");
  if (hasTrack && !structureReady) readinessReasons.push("sections_unavailable");
  if (hasTrack && !timingReady) readinessReasons.push("timing_unavailable");

  const validationIssues = [];
  if (!hasTrack) {
    validationIssues.push({
      code: "no_audio_track_selected",
      severity: "info",
      message: "No audio track is selected."
    });
  }
  if (hasTrack && !structureReady && !isInProgress) {
    validationIssues.push({
      code: "sections_unavailable",
      severity: "warning",
      message: "Main song sections are not available yet."
    });
  }
  if (hasTrack && !timingReady && !isInProgress) {
    validationIssues.push({
      code: "timing_unavailable",
      severity: "warning",
      message: "Timing context is not available yet."
    });
  }

  let status = "idle";
  let readinessLevel = "idle";
  if (!hasTrack) {
    status = "idle";
    readinessLevel = "blocked";
  } else if (isInProgress) {
    status = "in_progress";
    readinessLevel = "pending";
  } else if (downstreamReady) {
    status = "ready";
    readinessLevel = "ready";
  } else {
    status = "partial";
    readinessLevel = "partial";
  }

  const warnings = [];
  if (hasTrack && !downstreamReady && !isInProgress) {
    warnings.push("Analysis is still partial. Downstream work may rely on assumptions.");
  }

  const selectedCatalogItem = mediaCatalog.find((row) => str(row?.path) === selectedAudioPath) || null;
  const artifact = state.audioAnalysis?.artifact && typeof state.audioAnalysis.artifact === "object"
    ? state.audioAnalysis.artifact
    : null;

  return {
    contract: "audio_dashboard_state_v1",
    version: "1.0",
    page: "audio",
    title: "Audio",
    summary,
    status,
    readiness: {
      ok: downstreamReady,
      level: readinessLevel,
      reasons: readinessReasons
    },
    warnings,
    validationIssues,
    refs: {
      analysisArtifactId: str(artifact?.artifactId || null),
      mediaId: str(artifact?.media?.mediaId || null),
      selectedAudioPath: selectedAudioPath || null
    },
    data: {
      hasTrack,
      selectedAudioPath,
      selectedTrack: {
        title: str(identity?.title || basenameOfPath(selectedAudioPath) || "No media loaded"),
        subtitle: str(identity?.artist || selectedCatalogItem?.relativePath || selectedAudioPath || "Attach or load sequence media to begin analysis."),
        lastAnalyzedAt: str(state.audioAnalysis?.lastAnalyzedAt),
        lastAnalyzedLabel: toLastAnalyzedText(state.audioAnalysis?.lastAnalyzedAt)
      },
      chips: {
        bpm: timing?.bpm != null ? `${timing.bpm} BPM` : "BPM pending",
        timeSignature: str(timing?.timeSignature || "meter pending"),
        sectionsCount: sections.length,
        chordsReady: Boolean(chords?.hasChords)
      },
      progress: {
        active: isInProgress,
        stage: str(progress?.stage),
        message: progressMessage,
        updatedAt: str(progress?.updatedAt),
        updatedLabel: toTimeText(progress?.updatedAt)
      },
      options: buildAudioOptions({ mediaCatalog, selectedAudioPath, basenameOfPath }),
      trackContext: {
        title: str(identity?.title || basenameOfPath(selectedAudioPath) || "No audio track attached"),
        subtitle: str(identity?.artist || selectedCatalogItem?.relativePath || selectedAudioPath || "Attach or load sequence media to begin analysis."),
        lastAnalyzedLabel: toLastAnalyzedText(state.audioAnalysis?.lastAnalyzedAt)
      },
      analysisSummary: {
        summary,
        tone: str(briefSeed?.tone || evidence?.serviceSummary || "No high-level music framing captured yet.")
      },
      structure: {
        visibleSections,
        source: str(structure?.source || "pending"),
        confidence: str(structure?.confidence || "low"),
        ready: structureReady
      },
      cues: {
        holdCue: holdCue || "",
        firstLift: firstLift || "",
        validationSummary: str(evidence?.webValidationSummary || "No additional music cue validation yet.")
      },
      downstream: {
        ready: downstreamReady,
        summary: downstreamReady
          ? "Analysis is ready for Mira and Patch to use."
          : "Analysis is still partial. Downstream work may rely on assumptions.",
        structureReady,
        timingReady
      },
      emptyState: hasTrack
        ? null
        : {
            title: "No Media Loaded",
            summary: "Open a sequence with attached media before running Lyric's analysis. Once media is available, this page will show structure, music cues, and downstream readiness."
          }
    }
  };
}
