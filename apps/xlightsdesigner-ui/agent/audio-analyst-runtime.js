function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function str(value = "") {
  return String(value || "").trim();
}

function finiteOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function rows(value) {
  return Array.isArray(value) ? value.filter((row) => isPlainObject(row)) : [];
}

export const AUDIO_ANALYST_ARTIFACT_TYPE = "analysis_artifact_v1";
export const AUDIO_ANALYST_ARTIFACT_VERSION = "1.0";

export function buildAnalysisArtifactFromPipelineResult({
  audioPath = "",
  mediaId = "",
  result = {},
  requestedProvider = "",
  analysisBaseUrl = "",
  generatedAt = ""
} = {}) {
  const details = isPlainObject(result?.details) ? result.details : {};
  const pipeline = isPlainObject(result?.pipeline) ? result.pipeline : {};
  const diagnostics = Array.isArray(result?.diagnostics) ? result.diagnostics.map((row) => str(row)).filter(Boolean) : [];
  const media = isPlainObject(details?.media) ? details.media : {};
  const timing = isPlainObject(details?.timing) ? details.timing : {};
  const identity = isPlainObject(details?.trackIdentity) ? details.trackIdentity : {};
  const raw = isPlainObject(result?.raw) ? result.raw : {};
  const rawMeta = isPlainObject(raw?.meta) ? raw.meta : {};
  const summaryLines = Array.isArray(details?.summaryLines) ? details.summaryLines.map((row) => str(row)).filter(Boolean) : [];
  const artifactGeneratedAt = str(generatedAt) || new Date().toISOString();

  return {
    artifactType: AUDIO_ANALYST_ARTIFACT_TYPE,
    artifactVersion: AUDIO_ANALYST_ARTIFACT_VERSION,
    media: {
      mediaId: str(mediaId),
      path: str(audioPath),
      fileName: str(details?.trackName),
      durationMs: finiteOrNull(media?.durationMs),
      sampleRate: finiteOrNull(media?.sampleRate),
      channels: finiteOrNull(media?.channels)
    },
    identity: {
      title: str(identity?.title),
      artist: str(identity?.artist),
      album: str(identity?.album),
      isrc: str(identity?.isrc),
      provider: str(identity?.provider || rawMeta?.trackIdentity?.provider)
    },
    timing: {
      bpm: finiteOrNull(timing?.tempoEstimate ?? raw?.bpm),
      timeSignature: str(timing?.timeSignature || raw?.timeSignature || "unknown"),
      beats: rows(raw?.beats),
      bars: rows(raw?.bars)
    },
    harmonic: {
      chords: rows(raw?.chords),
      confidence: str(rawMeta?.chordAnalysis?.avgMarginConfidence)
    },
    lyrics: {
      hasSyncedLyrics: Boolean(timing?.hasLyricsTrack || rows(raw?.lyrics).length),
      lines: rows(raw?.lyrics),
      source: str(rawMeta?.lyricsSource || "none"),
      sourceError: str(rawMeta?.lyricsSourceError),
      shiftMs: finiteOrNull(rawMeta?.lyricsGlobalShiftMs)
    },
    structure: {
      sections: rows(raw?.sections),
      source: str(rawMeta?.sectionSource || (pipeline.structureDerived ? "service+llm" : "pending")),
      confidence: pipeline.structureDerived ? "medium" : "low"
    },
    briefSeed: {
      summaryLines,
      songContext: summaryLines.find((line) => line.toLowerCase().startsWith("song context:")) || ""
    },
    provenance: {
      generatedAt: artifactGeneratedAt,
      service: {
        baseUrl: str(analysisBaseUrl),
        providerRequested: str(requestedProvider),
        providerUsed: str(rawMeta?.engine || requestedProvider)
      },
      pipeline,
      runtime: {
        audioAnalystRole: "audio_analyst",
        artifactVersion: AUDIO_ANALYST_ARTIFACT_VERSION
      },
      evidence: {
        serviceSummary: summaryLines.find((line) => line.toLowerCase().startsWith("tempo/time signature:")) || "",
        webValidationSummary: summaryLines.find((line) => line.toLowerCase().startsWith("web validation:")) || "",
        sources: diagnostics
          .filter((line) => /^Web source \d+:/i.test(line))
          .map((line) => line.replace(/^Web source \d+:\s*/i, "").trim())
          .filter(Boolean)
          .slice(0, 6)
      }
    },
    diagnostics: {
      warnings: diagnostics,
      degraded: !Boolean(pipeline.analysisServiceSucceeded),
      summary: str(result?.summary)
    }
  };
}

export function buildAnalysisHandoffFromArtifact(artifact = {}, creativeBrief = null) {
  const media = isPlainObject(artifact?.media) ? artifact.media : {};
  const identity = isPlainObject(artifact?.identity) ? artifact.identity : {};
  const timing = isPlainObject(artifact?.timing) ? artifact.timing : {};
  const harmonic = isPlainObject(artifact?.harmonic) ? artifact.harmonic : {};
  const lyrics = isPlainObject(artifact?.lyrics) ? artifact.lyrics : {};
  const structure = isPlainObject(artifact?.structure) ? artifact.structure : {};
  const provenance = isPlainObject(artifact?.provenance) ? artifact.provenance : {};
  const evidence = isPlainObject(provenance?.evidence) ? provenance.evidence : {};
  const briefSeed = isPlainObject(artifact?.briefSeed) ? artifact.briefSeed : {};
  const creative = isPlainObject(creativeBrief) ? creativeBrief : {};

  return {
    trackIdentity: {
      title: str(identity?.title || media?.fileName),
      artist: str(identity?.artist),
      isrc: str(identity?.isrc)
    },
    timing: {
      bpm: finiteOrNull(timing?.bpm),
      timeSignature: str(timing?.timeSignature || "unknown"),
      beatsArtifact: Array.isArray(timing?.beats) && timing.beats.length ? "beats" : "",
      barsArtifact: Array.isArray(timing?.bars) && timing.bars.length ? "bars" : ""
    },
    structure: {
      sections: rows(structure?.sections),
      source: str(structure?.source),
      confidence: str(structure?.confidence || "low")
    },
    lyrics: {
      hasSyncedLyrics: Boolean(lyrics?.hasSyncedLyrics),
      lyricsArtifact: Array.isArray(lyrics?.lines) && lyrics.lines.length ? "lyrics" : ""
    },
    chords: {
      hasChords: Array.isArray(harmonic?.chords) && harmonic.chords.length > 0,
      chordsArtifact: Array.isArray(harmonic?.chords) && harmonic.chords.length ? "chords" : "",
      confidence: str(harmonic?.confidence || ((Array.isArray(harmonic?.chords) && harmonic.chords.length) ? "medium" : "low"))
    },
    briefSeed: {
      tone: str(briefSeed?.songContext),
      mood: str(creative?.mood),
      story: str(creative?.storyArc),
      designHints: String(creative?.designHints || "")
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 8)
    },
    evidence: {
      serviceSummary: str(evidence?.serviceSummary),
      webValidationSummary: str(evidence?.webValidationSummary),
      sources: Array.isArray(evidence?.sources) ? evidence.sources.map((row) => str(row)).filter(Boolean) : []
    }
  };
}
