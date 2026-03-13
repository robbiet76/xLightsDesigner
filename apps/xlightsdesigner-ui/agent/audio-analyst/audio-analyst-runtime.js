import {
  AUDIO_ANALYST_ROLE,
  AUDIO_ANALYST_CONTRACT_VERSION,
  buildAudioAnalystResult,
  classifyAudioAnalysisFailureReason,
  validateAudioAnalystContractGate
} from "./audio-analyst-contracts.js";
import { normalizeAudioAnalysisProvider } from "./audio-provider-adapters.js";
import { validateAgentHandoff } from "../handoff-contracts.js";
import { finalizeArtifact } from "../shared/artifact-ids.js";

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

function getByPath(obj, path) {
  const keys = Array.isArray(path) ? path : String(path || "").split(".");
  let cur = obj;
  for (const key of keys) {
    if (!isPlainObject(cur) || !(key in cur)) return undefined;
    cur = cur[key];
  }
  return cur;
}

function deriveFallbackMediaId(audioPath = "") {
  const normalized = str(audioPath).replace(/\\/g, "/").toLowerCase();
  if (!normalized) return "";
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i += 1) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `media-${(hash >>> 0).toString(16)}`;
}

export const AUDIO_ANALYST_ARTIFACT_TYPE = "analysis_artifact_v1";
export const AUDIO_ANALYST_ARTIFACT_VERSION = AUDIO_ANALYST_CONTRACT_VERSION;

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
  const beats = rows(raw?.beats);
  const bars = rows(raw?.bars);
  const chords = rows(raw?.chords);
  const lyricsLines = rows(raw?.lyrics);
  const sections = rows(raw?.sections);
  const webTempoEvidence = isPlainObject(rawMeta?.webTempoEvidence) ? rawMeta.webTempoEvidence : {};

  return finalizeArtifact({
    artifactType: AUDIO_ANALYST_ARTIFACT_TYPE,
    artifactVersion: AUDIO_ANALYST_ARTIFACT_VERSION,
    createdAt: artifactGeneratedAt,
    media: {
      mediaId: str(mediaId) || deriveFallbackMediaId(audioPath),
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
      beats,
      bars
    },
    harmonic: {
      chords,
      confidence: str(rawMeta?.chordAnalysis?.avgMarginConfidence)
    },
    lyrics: {
      hasSyncedLyrics: Boolean(timing?.hasLyricsTrack || lyricsLines.length),
      lines: lyricsLines,
      source: str(rawMeta?.lyricsSource || "none"),
      sourceError: str(rawMeta?.lyricsSourceError),
      shiftMs: finiteOrNull(rawMeta?.lyricsGlobalShiftMs)
    },
    structure: {
      sections,
      source: str(rawMeta?.sectionSource || (pipeline.structureDerived ? "service+llm" : "pending")),
      confidence: pipeline.structureDerived ? "medium" : "low"
    },
    capabilities: {
      identity: {
        available: Boolean(str(identity?.title) || str(identity?.artist) || str(identity?.isrc)),
        provider: str(identity?.provider || rawMeta?.trackIdentity?.provider)
      },
      timing: {
        available: beats.length > 0 || bars.length > 0 || finiteOrNull(timing?.tempoEstimate ?? raw?.bpm) != null,
        confidence: beats.length > 0 && bars.length > 0 ? "high" : ((beats.length > 0 || bars.length > 0) ? "medium" : "low"),
        source: "analysis-service"
      },
      harmonic: {
        available: chords.length > 0,
        confidence: str(rawMeta?.chordAnalysis?.avgMarginConfidence || (chords.length ? "medium" : "low")),
        source: str(rawMeta?.chordAnalysis?.engine || "analysis-service")
      },
      lyrics: {
        available: lyricsLines.length > 0,
        confidence: lyricsLines.length ? "high" : "low",
        source: str(rawMeta?.lyricsSource || "none")
      },
      structure: {
        available: sections.length > 0,
        confidence: str(rawMeta?.sectionConfidence || (pipeline.structureDerived ? "medium" : "low")),
        source: str(rawMeta?.sectionSource || (pipeline.structureDerived ? "service+llm" : "pending"))
      }
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
        audioAnalystRole: AUDIO_ANALYST_ROLE,
        artifactVersion: AUDIO_ANALYST_ARTIFACT_VERSION
      },
      evidence: {
        serviceSummary: summaryLines.find((line) => line.toLowerCase().startsWith("tempo/time signature:")) || "",
        webValidationSummary: summaryLines.find((line) => line.toLowerCase().startsWith("web validation:")) || "",
        webValidation: {
          confidence: str(webTempoEvidence?.confidence),
          timeSignature: str(webTempoEvidence?.timeSignature),
          tempoBpm: finiteOrNull(webTempoEvidence?.tempoBpm),
          chosenBeatBpm: finiteOrNull(webTempoEvidence?.chosenBeatBpm)
        },
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
  });
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

export function buildAudioAnalystInput({
  requestId = "",
  mediaFilePath = "",
  mediaRootPath = "",
  projectFilePath = "",
  analysisProfile = null,
  service = {}
} = {}) {
  const provider = normalizeAudioAnalysisProvider(service?.provider || "auto");
  return {
    agentRole: AUDIO_ANALYST_ROLE,
    contractVersion: AUDIO_ANALYST_CONTRACT_VERSION,
    requestId: str(requestId),
    context: {
      media: {
        path: str(mediaFilePath),
        fileName: str(mediaFilePath).split(/[\\/]/).pop() || ""
      },
      project: {
        mediaRootPath: str(mediaRootPath),
        projectFilePath: str(projectFilePath)
      },
      service: {
        baseUrl: str(service?.baseUrl),
        provider,
        apiKeyPresent: Boolean(str(service?.apiKey)),
        authBearerPresent: Boolean(str(service?.authBearer))
      }
    },
    analysisProfile: analysisProfile && typeof analysisProfile === "object" && !Array.isArray(analysisProfile)
      ? analysisProfile
      : {}
  };
}

export async function executeAudioAnalystFlow({
  input = {},
  runPipeline,
  persistArtifact = null,
  creativeBrief = null,
  generatedAt = ""
} = {}) {
  const inputGate = validateAudioAnalystContractGate("input", input, input?.requestId);
  if (!inputGate.ok) {
    const summary = inputGate.report.errors.join("; ");
    return {
      ok: false,
      stage: inputGate.stage,
      gate: inputGate,
      artifact: null,
      handoff: null,
      result: buildAudioAnalystResult({
        requestId: input?.requestId,
        status: "failed",
        failureReason: classifyAudioAnalysisFailureReason(inputGate.stage, summary),
        summary
      })
    };
  }

  let pipelineResult;
  try {
    pipelineResult = await runPipeline({ input });
  } catch (err) {
    const detail = String(err?.message || err);
    return {
      ok: false,
      stage: "pipeline_runtime",
      gate: null,
      artifact: null,
      handoff: null,
      result: buildAudioAnalystResult({
        requestId: input?.requestId,
        status: "failed",
        failureReason: classifyAudioAnalysisFailureReason("runtime", detail),
        summary: detail
      })
    };
  }

  const artifact = buildAnalysisArtifactFromPipelineResult({
    audioPath: getByPath(input, ["context", "media", "path"]),
    result: pipelineResult,
    requestedProvider: getByPath(input, ["context", "service", "provider"]),
    analysisBaseUrl: getByPath(input, ["context", "service", "baseUrl"]),
    generatedAt
  });

  let persistedArtifact = artifact;
  if (typeof persistArtifact === "function") {
    const writeRes = await persistArtifact({ artifact, input, pipelineResult });
    if (writeRes?.ok && writeRes.artifact && typeof writeRes.artifact === "object") {
      persistedArtifact = writeRes.artifact;
    } else if (writeRes?.error) {
      const warnings = Array.isArray(persistedArtifact?.diagnostics?.warnings) ? [...persistedArtifact.diagnostics.warnings] : [];
      warnings.push(str(writeRes.error));
      persistedArtifact = {
        ...persistedArtifact,
        diagnostics: {
          ...(persistedArtifact.diagnostics || {}),
          warnings
        }
      };
    }
  }

  const artifactGate = validateAudioAnalystContractGate("artifact", persistedArtifact, input?.requestId);
  if (!artifactGate.ok) {
    const summary = artifactGate.report.errors.join("; ");
    return {
      ok: false,
      stage: artifactGate.stage,
      gate: artifactGate,
      artifact: persistedArtifact,
      handoff: null,
      result: buildAudioAnalystResult({
        requestId: input?.requestId,
        status: "failed",
        failureReason: classifyAudioAnalysisFailureReason(artifactGate.stage, summary, persistedArtifact),
        artifact: persistedArtifact,
        warnings: persistedArtifact?.diagnostics?.warnings || [],
        summary
      })
    };
  }

  const handoff = buildAnalysisHandoffFromArtifact(persistedArtifact, creativeBrief);
  const handoffErrors = validateAgentHandoff("analysis_handoff_v1", handoff);
  if (handoffErrors.length) {
    const summary = handoffErrors.join("; ");
    return {
      ok: false,
      stage: "handoff_contract",
      gate: null,
      artifact: persistedArtifact,
      handoff,
      result: buildAudioAnalystResult({
        requestId: input?.requestId,
        status: "failed",
        failureReason: classifyAudioAnalysisFailureReason("handoff", summary, persistedArtifact),
        artifact: persistedArtifact,
        handoff,
        warnings: persistedArtifact?.diagnostics?.warnings || [],
        summary
      })
    };
  }

  const warnings = Array.isArray(persistedArtifact?.diagnostics?.warnings) ? persistedArtifact.diagnostics.warnings : [];
  const failureReason = classifyAudioAnalysisFailureReason("artifact", persistedArtifact?.diagnostics?.summary, persistedArtifact);
  const status = persistedArtifact?.diagnostics?.degraded ? "partial" : "ok";
  const result = buildAudioAnalystResult({
    requestId: input?.requestId,
    status,
    failureReason: status === "ok" ? null : failureReason,
    artifact: persistedArtifact,
    handoff,
    warnings,
    summary: persistedArtifact?.diagnostics?.summary || pipelineResult?.summary || ""
  });
  const resultGate = validateAudioAnalystContractGate("result", result, input?.requestId);

  return {
    ok: resultGate.ok,
    stage: resultGate.stage,
    gate: resultGate,
    artifact: persistedArtifact,
    handoff,
    pipelineResult,
    result
  };
}
