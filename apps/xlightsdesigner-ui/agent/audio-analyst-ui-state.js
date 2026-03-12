import { buildAnalysisHandoffFromArtifact } from "./audio-analyst-runtime.js";

function str(value = "") {
  return String(value || "");
}

export function resetAudioAnalysisView(audioAnalysisState = {}) {
  audioAnalysisState.summary = "";
  audioAnalysisState.lastAnalyzedAt = "";
  audioAnalysisState.pipeline = null;
}

export function buildPendingAudioAnalysisPipeline() {
  return {
    mediaAttached: true,
    mediaMetadataRead: false,
    analysisServiceCalled: false,
    analysisServiceSucceeded: false,
    beatTrackWritten: false,
    beatTrackPreserved: false,
    barTrackWritten: false,
    barTrackPreserved: false,
    chordTrackWritten: false,
    chordTrackPreserved: false,
    structureTrackWritten: false,
    structureTrackPreserved: false,
    lyricsTrackWritten: false,
    lyricsTrackPreserved: false,
    structureDerived: false,
    timingDerived: false,
    lyricsDetected: false,
    webContextDerived: false
  };
}

export function applyPersistedAnalysisArtifactToState({
  artifact = null,
  creativeBrief = null,
  setHandoff,
  audioAnalysisState
} = {}) {
  if (!artifact || typeof artifact !== "object") return { ok: false, reason: "missing_artifact" };
  if (!audioAnalysisState || typeof audioAnalysisState !== "object") return { ok: false, reason: "missing_audio_state" };
  if (typeof setHandoff !== "function") return { ok: false, reason: "missing_set_handoff" };

  const analysisHandoff = buildAnalysisHandoffFromArtifact(artifact, creativeBrief);
  const set = setHandoff(analysisHandoff);
  if (!set?.ok) return { ok: false, reason: "handoff_rejected" };

  audioAnalysisState.summary = str(artifact?.diagnostics?.summary);
  audioAnalysisState.lastAnalyzedAt = str(artifact?.provenance?.generatedAt);
  audioAnalysisState.pipeline = artifact?.provenance?.pipeline && typeof artifact.provenance.pipeline === "object"
    ? artifact.provenance.pipeline
    : null;

  return { ok: true, handoff: analysisHandoff };
}

export function applyAudioAnalystFlowSuccessToState({
  flow,
  pipelineResult = null,
  fallbackSummary = "",
  audioAnalysisState,
  setHandoff
} = {}) {
  if (!flow || typeof flow !== "object" || !flow.artifact || !flow.handoff) {
    return { ok: false, reason: "invalid_flow" };
  }
  if (!audioAnalysisState || typeof audioAnalysisState !== "object") {
    return { ok: false, reason: "missing_audio_state" };
  }
  if (typeof setHandoff !== "function") {
    return { ok: false, reason: "missing_set_handoff" };
  }

  const persistedArtifact = flow.artifact;
  const set = setHandoff(flow.handoff);
  if (!set?.ok) return { ok: false, reason: "handoff_rejected" };
  audioAnalysisState.summary = str(
    persistedArtifact?.diagnostics?.summary ||
    pipelineResult?.summary ||
    fallbackSummary
  );
  audioAnalysisState.lastAnalyzedAt = str(
    persistedArtifact?.provenance?.generatedAt ||
    new Date().toISOString()
  );
  audioAnalysisState.pipeline = persistedArtifact?.provenance?.pipeline || pipelineResult?.pipeline || null;

  return { ok: true };
}

export function applyAudioAnalystFlowFailureToState({
  audioAnalysisState,
  fallbackSummary = "",
  at = ""
} = {}) {
  if (!audioAnalysisState || typeof audioAnalysisState !== "object") {
    return { ok: false, reason: "missing_audio_state" };
  }
  audioAnalysisState.summary = str(fallbackSummary);
  audioAnalysisState.lastAnalyzedAt = str(at || new Date().toISOString());
  audioAnalysisState.pipeline = null;
  return { ok: true };
}
