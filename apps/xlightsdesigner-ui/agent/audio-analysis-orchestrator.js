import { createAudioAnalysisPipelineState, runAudioAnalysisServicePass } from "./audio-analysis-service-runtime.js";
import { runAudioAnalysisContextPass } from "./audio-analysis-context-runtime.js";

function str(value = "") {
  return String(value || "").trim();
}

export async function runAudioAnalysisOrchestration({
  audioPath = "",
  timingTracks = [],
  analysisService = {},
  analysisBridge = null,
  inferLyricStanzaPlan,
  relabelSectionsWithLlm,
  audioTrackQueryFromPath,
  buildSectionSuggestions,
  runSongContextResearch,
  runSongContextWebFallback,
  buildWebValidationFromServiceEvidence,
  areMetersCompatible,
  beatsPerBarFromSignature,
  extractNumericCandidates,
  medianNumber,
  analyzeAudioContext,
  formatAudioAnalysisSummary,
  initialSectionSuggestions = [],
  initialSectionStartByLabel = {}
} = {}) {
  const pipeline = createAudioAnalysisPipelineState();
  pipeline.mediaAttached = Boolean(str(audioPath));
  const diagnostics = [];

  if (!pipeline.mediaAttached) {
    return {
      summary: "No audio track available for analysis on this sequence.",
      pipeline,
      details: null,
      diagnostics,
      sectionTrackName: "",
      sectionSuggestions: [],
      sectionStartByLabel: {}
    };
  }

  const analysisBaseUrl = str(analysisService.baseUrl).replace(/\/+$/, "");
  if (!analysisBaseUrl) {
    const analysis = analyzeAudioContext({
      audioPath,
      mediaMetadata: null,
      sectionSuggestions: [],
      sectionStartByLabel: {},
      timingTracks,
      trackMarksByName: {},
      songContextSummary: ""
    });
    diagnostics.push("Audio analysis service URL is required in Settings.");
    return {
      summary: formatAudioAnalysisSummary({ analysis, pipeline, webValidation: null }),
      pipeline: { ...pipeline },
      details: analysis,
      diagnostics,
      sectionTrackName: "",
      sectionSuggestions: [],
      sectionStartByLabel: {}
    };
  }

  const servicePass = await runAudioAnalysisServicePass({
    audioPath,
    analysisBridge,
    baseUrl: analysisBaseUrl,
    provider: analysisService.provider,
    apiKey: analysisService.apiKey,
    authBearer: analysisService.authBearer,
    mediaMetadata: null,
    sequenceDurationMs: null,
    inferLyricStanzaPlan,
    relabelSectionsWithLlm,
    audioTrackQueryFromPath,
    buildSectionSuggestions
  });
  Object.assign(pipeline, servicePass.pipeline || {});
  diagnostics.push(...(Array.isArray(servicePass.diagnostics) ? servicePass.diagnostics : []));

  const nextSectionSuggestions = Array.isArray(servicePass.sectionSuggestions) && servicePass.sectionSuggestions.length
    ? servicePass.sectionSuggestions
    : (Array.isArray(initialSectionSuggestions) ? initialSectionSuggestions : []);
  const nextSectionStartByLabel = servicePass.sectionStartByLabel && typeof servicePass.sectionStartByLabel === "object"
    ? servicePass.sectionStartByLabel
    : (initialSectionStartByLabel && typeof initialSectionStartByLabel === "object" ? initialSectionStartByLabel : {});

  const analysisTracks = (Array.isArray(servicePass.analysisTrackNames) ? servicePass.analysisTrackNames : []).map((name) => ({ name }));
  const contextPass = await runAudioAnalysisContextPass({
    audioPath,
    sections: nextSectionSuggestions,
    detectedTrackIdentity: servicePass.detectedTrackIdentity,
    detectedTimeSignature: servicePass.detectedTimeSignature,
    detectedTempoBpm: servicePass.detectedTempoBpm,
    serviceWebTempoEvidence: servicePass.serviceWebTempoEvidence,
    runSongContextResearch,
    runSongContextWebFallback,
    buildWebValidationFromServiceEvidence,
    areMetersCompatible,
    beatsPerBarFromSignature,
    extractNumericCandidates,
    medianNumber
  });
  diagnostics.push(...(Array.isArray(contextPass.diagnostics) ? contextPass.diagnostics : []));
  pipeline.webContextDerived = Boolean(contextPass.webContextDerived);

  const analysis = analyzeAudioContext({
    audioPath,
    mediaMetadata: servicePass.mediaMetadata,
    sectionSuggestions: nextSectionSuggestions,
    sectionStartByLabel: nextSectionStartByLabel,
    timingTracks: analysisTracks,
    trackMarksByName: servicePass.trackMarksByName || {},
    songContextSummary: str(contextPass.effectiveSongContext),
    detectedTimeSignature: servicePass.detectedTimeSignature,
    detectedTempoBpm: Number.isFinite(contextPass.detectedTempoBpm)
      ? contextPass.detectedTempoBpm
      : servicePass.detectedTempoBpm
  });
  if (servicePass.detectedTrackIdentity && typeof servicePass.detectedTrackIdentity === "object") {
    analysis.trackIdentity = {
      title: str(servicePass.detectedTrackIdentity.title),
      artist: str(servicePass.detectedTrackIdentity.artist),
      isrc: str(servicePass.detectedTrackIdentity.isrc)
    };
  }

  return {
    summary: formatAudioAnalysisSummary({ analysis, pipeline, webValidation: contextPass.webValidation || null }),
    pipeline: { ...pipeline },
    details: analysis,
    raw: servicePass.rawAnalysisData && typeof servicePass.rawAnalysisData === "object" ? servicePass.rawAnalysisData : {},
    diagnostics,
    sectionTrackName: servicePass.sectionTrackName || "",
    sectionSuggestions: nextSectionSuggestions,
    sectionStartByLabel: nextSectionStartByLabel
  };
}
