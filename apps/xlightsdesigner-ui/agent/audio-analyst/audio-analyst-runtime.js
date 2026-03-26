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

function titleCaseWords(value = "") {
  return str(value)
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join(" ");
}

function classifySectionType(label = "") {
  const lower = str(label).toLowerCase();
  if (!lower) return "section";
  if (/^intro\b/.test(lower)) return "intro";
  if (/^(verse|rap verse)\b/.test(lower)) return "verse";
  if (/^(chorus|final chorus|hook)\b/.test(lower)) return "chorus";
  if (/^(pre[- ]?chorus|lift)\b/.test(lower)) return "pre_chorus";
  if (/^(post[- ]?chorus)\b/.test(lower)) return "post_chorus";
  if (/^(bridge)\b/.test(lower)) return "bridge";
  if (/^(middle 8|middle8)\b/.test(lower)) return "middle_8";
  if (/^(outro|ending)\b/.test(lower)) return "outro";
  if (/^(tag)\b/.test(lower)) return "tag";
  if (/^(coda)\b/.test(lower)) return "coda";
  if (/^(interlude|break|turn)\b/.test(lower)) return "interlude";
  if (/^(refrain)\b/.test(lower)) return "refrain";
  if (/^(theme)\b/.test(lower)) return "theme";
  if (/^(contrast)\b/.test(lower)) return "contrast";
  if (/^(instrumental solo|solo)\b/.test(lower)) return "solo";
  if (/^(breakdown)\b/.test(lower)) return "breakdown";
  if (/^(drop)\b/.test(lower)) return "drop";
  if (/^(rap|rap section)\b/.test(lower)) return "rap";
  if (/^(ad[- ]?lib)\b/.test(lower)) return "ad_lib";
  return "section";
}

function canonicalizeSectionLabel(label = "", sectionType = "section") {
  const value = str(label);
  if (!value) return "";
  switch (sectionType) {
    case "pre_chorus":
      return /^lift$/i.test(value) ? "Lift" : value.replace(/^pre[- ]?chorus/i, "Pre-Chorus");
    case "post_chorus":
      return value.replace(/^post[- ]?chorus/i, "Post-Chorus");
    case "middle_8":
      return /^middle ?8$/i.test(value) ? "Middle 8" : value.replace(/^middle ?8/i, "Middle 8");
    case "ad_lib":
      return value.replace(/^ad[- ]?lib/i, "Ad Lib");
    case "coda":
      return value.replace(/^coda/i, "Coda");
    case "tag":
      return value.replace(/^tag/i, "Tag");
    case "interlude":
      return /^(break|turn)$/i.test(value) ? titleCaseWords(value) : value.replace(/^interlude/i, "Interlude");
    case "solo":
      return /^instrumental solo$/i.test(value) ? "Instrumental Solo" : value.replace(/^solo/i, "Solo");
    case "bridge":
    case "drop":
    case "refrain":
    case "theme":
    case "contrast":
    case "breakdown":
    case "rap":
      return titleCaseWords(value);
    default:
      return value;
  }
}

function looksGenericSectionLabel(value = "") {
  return /^section\s+\d+$/i.test(str(value));
}

function normalizeStructureSections(sections = []) {
  const src = rows(sections);
  if (!src.length) return [];
  return src.map((row) => {
    const label = str(row?.label || row?.name);
    const sectionType = classifySectionType(label);
    return {
      ...row,
      label,
      sectionType,
      canonicalLabel: canonicalizeSectionLabel(label, sectionType),
      provenance: {
        ...(isPlainObject(row?.provenance) ? row.provenance : {}),
        genericLabel: looksGenericSectionLabel(label)
      }
    };
  });
}

function isGenericStructureSection(section = {}) {
  return Boolean(section?.provenance?.genericLabel) || looksGenericSectionLabel(section?.label || section?.name);
}

function confidenceScore(label = "") {
  const lower = str(label).toLowerCase();
  if (lower === "high") return 0.85;
  if (lower === "medium") return 0.6;
  if (lower === "low") return 0.3;
  const n = Number(label);
  if (Number.isFinite(n)) return Math.max(0, Math.min(1, n));
  return 0;
}

function deriveTimingConfidence({ beats = [], bars = [], rhythmProviderAgreement = null } = {}) {
  let label = "low";
  if (Array.isArray(beats) && beats.length && Array.isArray(bars) && bars.length) {
    label = "high";
  } else if ((Array.isArray(beats) && beats.length) || (Array.isArray(bars) && bars.length)) {
    label = "medium";
  }
  if (
    rhythmProviderAgreement
    && rhythmProviderAgreement.enabled
    && rhythmProviderAgreement.available
    && (
      rhythmProviderAgreement.agreedOnTimeSignature === false
      || rhythmProviderAgreement.agreedOnBeatsPerBar === false
    )
  ) {
    if (label === "high") return "medium";
    if (label === "medium") return "low";
  }
  return label;
}

export const ANALYSIS_MODULE_VERSIONS = Object.freeze({
  identity: "v1",
  rhythm: "v3",
  harmony: "v2",
  lyrics: "v4",
  structureBackbone: "v1",
  semanticStructure: "v1"
});

function normalizeProfileMode(value = "") {
  const mode = str(value).toLowerCase();
  return mode === "fast" || mode === "deep" ? mode : "";
}

export function inspectAnalysisArtifactFreshness(artifact = {}, { preferredProfileMode = "", requiredModules = [] } = {}) {
  const modules = isPlainObject(artifact?.modules) ? artifact.modules : {};
  const expectedProfileMode = normalizeProfileMode(preferredProfileMode);
  const artifactProfileMode = normalizeProfileMode(artifact?.provenance?.analysisProfile?.mode);
  const moduleNames = Array.isArray(requiredModules) && requiredModules.length
    ? requiredModules.filter((name) => Object.prototype.hasOwnProperty.call(ANALYSIS_MODULE_VERSIONS, name))
    : Object.keys(ANALYSIS_MODULE_VERSIONS);
  const reasons = [];
  if (expectedProfileMode && artifactProfileMode !== expectedProfileMode) {
    reasons.push(`artifact_profile_mismatch:${artifactProfileMode || "missing"}!=${expectedProfileMode}`);
  }
  for (const moduleName of moduleNames) {
    const moduleObj = isPlainObject(modules?.[moduleName]) ? modules[moduleName] : null;
    if (!moduleObj) {
      reasons.push(`missing_module:${moduleName}`);
      continue;
    }
    const metadata = isPlainObject(moduleObj.metadata) ? moduleObj.metadata : {};
    const expectedVersion = ANALYSIS_MODULE_VERSIONS[moduleName];
    const actualVersion = str(metadata.moduleVersion);
    const actualProfileMode = normalizeProfileMode(metadata.profileMode || artifactProfileMode);
    const freshness = str(metadata.freshness || "").toLowerCase();
    if (actualVersion !== expectedVersion) {
      reasons.push(`module_version_mismatch:${moduleName}:${actualVersion || "missing"}!=${expectedVersion}`);
    }
    if (expectedProfileMode && actualProfileMode !== expectedProfileMode) {
      reasons.push(`module_profile_mismatch:${moduleName}:${actualProfileMode || "missing"}!=${expectedProfileMode}`);
    }
    if (freshness && freshness !== "current") {
      reasons.push(`module_not_current:${moduleName}:${freshness}`);
    }
  }
  return {
    ok: reasons.length === 0,
    artifactProfileMode,
    expectedProfileMode,
    reasons
  };
}

export function isAnalysisArtifactFreshForRuntime(artifact = {}, options = {}) {
  return inspectAnalysisArtifactFreshness(artifact, options).ok;
}

function buildAnalysisModules({
  audioPath = "",
  mediaId = "",
  identity = {},
  timing = {},
  harmonic = {},
  lyrics = {},
  structure = {},
  analysisProfile = null,
  generatedAt = "",
  pipeline = {},
  rawMeta = {},
  requestedProvider = "",
  analysisBaseUrl = ""
} = {}) {
  const resolvedMediaId = str(mediaId) || deriveFallbackMediaId(audioPath);
  const generatedAtValue = str(generatedAt) || new Date().toISOString();
  const profileMode = str(analysisProfile?.mode || "deep").toLowerCase() || "deep";
  const harmonicConfidence = str(harmonic?.confidence || (Array.isArray(harmonic?.chords) && harmonic.chords.length ? "medium" : "low"));
  const lyricsConfidence = Array.isArray(lyrics?.lines) && lyrics.lines.length ? "high" : "low";
  const structureConfidence = str(structure?.confidence || (Array.isArray(structure?.sections) && structure.sections.length ? "medium" : "low"));
  const structureSections = rows(structure?.sections);
  const semanticSections = structureSections.filter((row) => !isGenericStructureSection(row));
  const rhythmProviderAgreement = isPlainObject(rawMeta?.rhythmProviderAgreement) ? rawMeta.rhythmProviderAgreement : {};
  const rhythmProviderResults = isPlainObject(rawMeta?.rhythmProviderResults) ? rawMeta.rhythmProviderResults : {};
  const harmonyProviderResults = isPlainObject(rawMeta?.harmonyProviderResults) ? rawMeta.harmonyProviderResults : {};
  const lyricsProviderResults = isPlainObject(rawMeta?.lyricsProviderResults) ? rawMeta.lyricsProviderResults : {};
  const plainLyricsPhraseFallback = isPlainObject(rawMeta?.plainLyricsPhraseFallback) ? rawMeta.plainLyricsPhraseFallback : {};
  const structureBackboneMeta = isPlainObject(rawMeta?.structureBackbone) ? rawMeta.structureBackbone : {};
  const derivedTimingConfidence = deriveTimingConfidence({
    beats: timing?.beats,
    bars: timing?.bars,
    rhythmProviderAgreement
  });
  const backboneSegments = rows(structureBackboneMeta?.segments).length
    ? rows(structureBackboneMeta.segments)
    : structureSections.map((row, index) => ({
        startMs: row?.startMs,
        endMs: row?.endMs,
        familyId: str(row?.familyId || row?.family || row?.groupId || `family-${index + 1}`),
        familyLabel: str(row?.familyLabel || row?.canonicalLabel || row?.label || String(index + 1)),
        anchorIndex: Number.isFinite(Number(row?.anchorIndex)) ? Number(row.anchorIndex) : index,
        segmentIndex: index
      }));
  const backboneFamilies = rows(structureBackboneMeta?.families).length
    ? rows(structureBackboneMeta.families)
    : Array.from(new Map(
      backboneSegments.map((row, index) => {
        const familyId = str(row?.familyId || `family-${index + 1}`);
        return [familyId, {
          familyId,
          label: str(row?.familyLabel || row?.label || String(index + 1))
        }];
      })
    ).values());
  const provenanceSources = [
    str(rawMeta?.engine || requestedProvider),
    str(rawMeta?.trackIdentity?.provider || identity?.provider),
    str(rawMeta?.lyricsSource || lyrics?.source),
    str(rawMeta?.sectionSource || structure?.source),
    str(rawMeta?.chordAnalysis?.engine || harmonic?.source),
    str(analysisBaseUrl)
  ].filter(Boolean);
  const baseDiagnostics = {
    identity: [
      str(identity?.provider ? `identity provider: ${identity.provider}` : ""),
      str(identity?.title || identity?.artist ? "track identity resolved" : "track identity unresolved"),
      str(identity?.recommendation?.shouldRename ? `rename suggestion: ${identity.recommendation.recommendedFileName}` : ""),
      str(identity?.metadataRecommendation?.shouldRetag ? "metadata retag recommended" : "")
    ].filter(Boolean),
    rhythm: [
      str(timing?.bpm != null ? `tempo=${timing.bpm}` : ""),
      str(timing?.timeSignature ? `timeSignature=${timing.timeSignature}` : ""),
      str(timing?.beats?.length ? `beats=${timing.beats.length}` : ""),
      str(timing?.bars?.length ? `bars=${timing.bars.length}` : "")
    ].filter(Boolean),
    harmony: [
      str(harmonic?.chords?.length ? `chords=${harmonic.chords.length}` : "no chords"),
      str(harmonic?.source ? `source=${harmonic.source}` : "")
    ].filter(Boolean),
    lyrics: [
      str(lyrics?.source ? `source=${lyrics.source}` : ""),
      str(lyrics?.lines?.length ? `lines=${lyrics.lines.length}` : "no lyrics"),
      str(rows(plainLyricsPhraseFallback?.phrases).length ? `plainPhraseFallback=${rows(plainLyricsPhraseFallback.phrases).length}` : "")
    ].filter(Boolean),
    structureBackbone: [
      str(structure?.source ? `source=${structure.source}` : ""),
      str(structureSections.length ? `segments=${structureSections.length}` : "no segments"),
      str(backboneFamilies.length ? `families=${backboneFamilies.length}` : "")
    ].filter(Boolean),
    semanticStructure: [
      str(semanticSections.length ? `semanticSections=${semanticSections.length}` : "no semantic sections"),
      str(semanticSections.length !== structureSections.length ? "generic sections excluded from semantic layer" : "")
    ].filter(Boolean)
  };
  const buildModuleMetadata = (moduleId = "", version = "v1") => ({
    moduleId: str(moduleId),
    moduleVersion: str(version),
    generatedAt: generatedAtValue,
    profileMode,
    freshness: "current",
    invalidationKey: `${resolvedMediaId}:${profileMode}:${moduleId}:${version}`
  });

  return {
    identity: {
      data: {
        title: str(identity?.title),
        artist: str(identity?.artist),
        album: str(identity?.album),
        isrc: str(identity?.isrc),
        sourceMetadata: isPlainObject(identity?.sourceMetadata) ? {
          fileName: str(identity.sourceMetadata?.fileName),
          embeddedTitle: str(identity.sourceMetadata?.embeddedTitle),
          embeddedArtist: str(identity.sourceMetadata?.embeddedArtist),
          embeddedAlbum: str(identity.sourceMetadata?.embeddedAlbum),
          embeddedReleaseDate: str(identity.sourceMetadata?.embeddedReleaseDate),
          filenameTitleHint: str(identity.sourceMetadata?.filenameTitleHint),
          filenameArtistHint: str(identity.sourceMetadata?.filenameArtistHint)
        } : {},
        recommendation: isPlainObject(identity?.recommendation) ? {
          available: Boolean(identity.recommendation?.available),
          recommendedFileName: str(identity.recommendation?.recommendedFileName),
          currentFileName: str(identity.recommendation?.currentFileName),
          shouldRename: Boolean(identity.recommendation?.shouldRename)
        } : {},
        metadataRecommendation: isPlainObject(identity?.metadataRecommendation) ? {
          available: Boolean(identity.metadataRecommendation?.available),
          shouldRetag: Boolean(identity.metadataRecommendation?.shouldRetag),
          current: isPlainObject(identity.metadataRecommendation?.current) ? {
            title: str(identity.metadataRecommendation.current?.title),
            artist: str(identity.metadataRecommendation.current?.artist),
            album: str(identity.metadataRecommendation.current?.album)
          } : {},
          recommended: isPlainObject(identity.metadataRecommendation?.recommended) ? {
            title: str(identity.metadataRecommendation.recommended?.title),
            artist: str(identity.metadataRecommendation.recommended?.artist),
            album: str(identity.metadataRecommendation.recommended?.album)
          } : {}
        } : {}
      },
      confidence: identity?.title || identity?.artist || identity?.isrc ? 0.8 : 0,
      sources: Array.from(new Set([str(identity?.provider || rawMeta?.trackIdentity?.provider), str(analysisBaseUrl)]).values()).filter(Boolean),
      diagnostics: baseDiagnostics.identity,
      cacheKey: `${resolvedMediaId}:identity:v1`,
      metadata: buildModuleMetadata("identity", "v1")
    },
    rhythm: {
      data: {
        bpm: finiteOrNull(timing?.bpm),
        timeSignature: str(timing?.timeSignature || "unknown"),
        beats: rows(timing?.beats),
        bars: rows(timing?.bars),
        providerAgreement: rhythmProviderAgreement,
        providerResults: rhythmProviderResults
      },
      confidence: confidenceScore(derivedTimingConfidence),
      sources: Array.from(new Set([str(rawMeta?.engine || requestedProvider), str(analysisBaseUrl)]).values()).filter(Boolean),
      diagnostics: [
        ...baseDiagnostics.rhythm,
        str(rhythmProviderAgreement?.enabled ? `madmomCrosscheck=${rhythmProviderAgreement.available ? "available" : "unavailable"}` : ""),
        str(
          rhythmProviderAgreement?.available && rhythmProviderAgreement?.agreedOnTimeSignature === false
            ? `timeSignature disagreement: ${rhythmProviderAgreement?.primary?.timeSignature || "unknown"} vs ${rhythmProviderAgreement?.secondary?.timeSignature || "unknown"}`
            : ""
        )
      ].filter(Boolean),
      cacheKey: `${resolvedMediaId}:rhythm:v2`,
      metadata: buildModuleMetadata("rhythm", "v3")
    },
    harmony: {
      data: {
        chords: rows(harmonic?.chords),
        providerResults: harmonyProviderResults
      },
      confidence: confidenceScore(harmonicConfidence),
      sources: Array.from(new Set([str(harmonic?.source || rawMeta?.chordAnalysis?.engine), str(analysisBaseUrl)]).values()).filter(Boolean),
      diagnostics: baseDiagnostics.harmony,
      cacheKey: `${resolvedMediaId}:harmony:v2`,
      metadata: buildModuleMetadata("harmony", "v2")
    },
    lyrics: {
      data: {
        hasSyncedLyrics: Boolean(lyrics?.hasSyncedLyrics),
        lines: rows(lyrics?.lines),
        plainPhraseFallback: {
          available: Boolean(plainLyricsPhraseFallback?.available),
          provider: str(plainLyricsPhraseFallback?.provider),
          lineCount: Number.isFinite(Number(plainLyricsPhraseFallback?.lineCount)) ? Number(plainLyricsPhraseFallback.lineCount) : 0,
          phraseCount: Number.isFinite(Number(plainLyricsPhraseFallback?.phraseCount)) ? Number(plainLyricsPhraseFallback.phraseCount) : 0,
          lines: Array.isArray(plainLyricsPhraseFallback?.lines)
            ? plainLyricsPhraseFallback.lines.map((row) => str(row)).filter(Boolean)
            : [],
          phrases: rows(plainLyricsPhraseFallback?.phrases),
          matchedTitle: str(plainLyricsPhraseFallback?.geniusMatchedTitle),
          matchedArtist: str(plainLyricsPhraseFallback?.geniusMatchedArtist),
          titleSimilarity: finiteOrNull(plainLyricsPhraseFallback?.geniusTitleSimilarity),
          artistMatched: Boolean(plainLyricsPhraseFallback?.geniusArtistMatched),
          blockedReason: str(plainLyricsPhraseFallback?.lyricsRecoveryBlockedReason),
          error: str(plainLyricsPhraseFallback?.error)
        },
        providerResults: lyricsProviderResults
      },
      confidence: confidenceScore(lyricsConfidence),
      sources: Array.from(new Set([str(lyrics?.source || rawMeta?.lyricsSource), str(analysisBaseUrl)]).values()).filter(Boolean),
      diagnostics: baseDiagnostics.lyrics,
      cacheKey: `${resolvedMediaId}:lyrics:v4`,
      metadata: buildModuleMetadata("lyrics", "v4")
    },
    structureBackbone: {
      data: {
        segments: backboneSegments,
        families: backboneFamilies,
        sequence: Array.isArray(structureBackboneMeta?.sequence)
          ? structureBackboneMeta.sequence.map((row) => str(row)).filter(Boolean)
          : backboneSegments.map((row) => str(row?.familyLabel || "")).filter(Boolean)
      },
      confidence: confidenceScore(structureConfidence),
      sources: Array.from(new Set([str(structure?.source || rawMeta?.sectionSource), str(analysisBaseUrl)]).values()).filter(Boolean),
      diagnostics: baseDiagnostics.structureBackbone,
      cacheKey: `${resolvedMediaId}:structure-backbone:v1`,
      metadata: buildModuleMetadata("structure-backbone", "v1")
    },
    semanticStructure: {
      data: {
        sections: semanticSections
      },
      confidence: semanticSections.length ? confidenceScore(structureConfidence) : 0,
      sources: provenanceSources,
      diagnostics: baseDiagnostics.semanticStructure,
      cacheKey: `${resolvedMediaId}:semantic-structure:v1`,
      metadata: buildModuleMetadata("semantic-structure", "v1")
    }
  };
}

export const AUDIO_ANALYST_ARTIFACT_TYPE = "analysis_artifact_v1";
export const AUDIO_ANALYST_ARTIFACT_VERSION = AUDIO_ANALYST_CONTRACT_VERSION;

export function buildAnalysisArtifactFromPipelineResult({
  audioPath = "",
  mediaId = "",
  result = {},
  analysisProfile = null,
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
  const sections = normalizeStructureSections(raw?.sections);
  const webTempoEvidence = isPlainObject(rawMeta?.webTempoEvidence) ? rawMeta.webTempoEvidence : {};
  const identityBlock = {
    title: str(identity?.title),
    artist: str(identity?.artist),
    album: str(identity?.album),
    isrc: str(identity?.isrc),
    provider: str(identity?.provider || rawMeta?.trackIdentity?.provider),
    sourceMetadata: isPlainObject(rawMeta?.sourceMetadata) ? {
      fileName: str(rawMeta.sourceMetadata?.fileName),
      embeddedTitle: str(rawMeta.sourceMetadata?.embeddedTitle),
      embeddedArtist: str(rawMeta.sourceMetadata?.embeddedArtist),
      embeddedAlbum: str(rawMeta.sourceMetadata?.embeddedAlbum),
      embeddedReleaseDate: str(rawMeta.sourceMetadata?.embeddedReleaseDate),
      filenameTitleHint: str(rawMeta.sourceMetadata?.filenameTitleHint),
      filenameArtistHint: str(rawMeta.sourceMetadata?.filenameArtistHint)
    } : {},
    recommendation: isPlainObject(rawMeta?.identityRecommendation) ? {
      available: Boolean(rawMeta.identityRecommendation?.available),
      title: str(rawMeta.identityRecommendation?.title),
      artist: str(rawMeta.identityRecommendation?.artist),
      provider: str(rawMeta.identityRecommendation?.provider),
      recommendedFileName: str(rawMeta.identityRecommendation?.recommendedFileName),
      currentFileName: str(rawMeta.identityRecommendation?.currentFileName),
      shouldRename: Boolean(rawMeta.identityRecommendation?.shouldRename)
    } : {},
    metadataRecommendation: isPlainObject(rawMeta?.metadataRecommendation) ? {
      available: Boolean(rawMeta.metadataRecommendation?.available),
      shouldRetag: Boolean(rawMeta.metadataRecommendation?.shouldRetag),
      current: isPlainObject(rawMeta.metadataRecommendation?.current) ? {
        title: str(rawMeta.metadataRecommendation.current?.title),
        artist: str(rawMeta.metadataRecommendation.current?.artist),
        album: str(rawMeta.metadataRecommendation.current?.album)
      } : {},
      recommended: isPlainObject(rawMeta.metadataRecommendation?.recommended) ? {
        title: str(rawMeta.metadataRecommendation.recommended?.title),
        artist: str(rawMeta.metadataRecommendation.recommended?.artist),
        album: str(rawMeta.metadataRecommendation.recommended?.album)
      } : {}
    } : {}
  };
  const timingBlock = {
    bpm: finiteOrNull(timing?.tempoEstimate ?? raw?.bpm),
    timeSignature: str(timing?.timeSignature || raw?.timeSignature || "unknown"),
    beats,
    bars
  };
  const harmonicBlock = {
    chords,
    confidence: str(rawMeta?.chordAnalysis?.avgMarginConfidence),
    source: str(rawMeta?.chordAnalysis?.engine || "analysis-service")
  };
  const lyricsBlock = {
    hasSyncedLyrics: Boolean(timing?.hasLyricsTrack || lyricsLines.length),
    lines: lyricsLines,
    source: str(rawMeta?.lyricsSource || "none"),
    sourceError: str(rawMeta?.lyricsSourceError),
    shiftMs: finiteOrNull(rawMeta?.lyricsGlobalShiftMs),
    plainPhraseFallback: isPlainObject(rawMeta?.plainLyricsPhraseFallback) ? {
      available: Boolean(rawMeta.plainLyricsPhraseFallback?.available),
      provider: str(rawMeta.plainLyricsPhraseFallback?.provider),
      lineCount: Number.isFinite(Number(rawMeta.plainLyricsPhraseFallback?.lineCount)) ? Number(rawMeta.plainLyricsPhraseFallback.lineCount) : 0,
      phraseCount: Number.isFinite(Number(rawMeta.plainLyricsPhraseFallback?.phraseCount)) ? Number(rawMeta.plainLyricsPhraseFallback.phraseCount) : 0,
      lines: Array.isArray(rawMeta.plainLyricsPhraseFallback?.lines)
        ? rawMeta.plainLyricsPhraseFallback.lines.map((row) => str(row)).filter(Boolean)
        : [],
      phrases: rows(rawMeta.plainLyricsPhraseFallback?.phrases),
      matchedTitle: str(rawMeta.plainLyricsPhraseFallback?.geniusMatchedTitle),
      matchedArtist: str(rawMeta.plainLyricsPhraseFallback?.geniusMatchedArtist),
      titleSimilarity: finiteOrNull(rawMeta.plainLyricsPhraseFallback?.geniusTitleSimilarity),
      artistMatched: Boolean(rawMeta.plainLyricsPhraseFallback?.geniusArtistMatched),
      blockedReason: str(rawMeta.plainLyricsPhraseFallback?.lyricsRecoveryBlockedReason),
      error: str(rawMeta.plainLyricsPhraseFallback?.error)
    } : {}
  };
  const structureBlock = {
    sections,
    source: str(rawMeta?.sectionSource || (pipeline.structureDerived ? "service+llm" : "pending")),
    confidence: pipeline.structureDerived ? "medium" : "low"
  };
  const rhythmProviderAgreement = isPlainObject(rawMeta?.rhythmProviderAgreement) ? rawMeta.rhythmProviderAgreement : {};
  const modules = buildAnalysisModules({
    audioPath,
    mediaId,
    identity: identityBlock,
    timing: timingBlock,
    harmonic: harmonicBlock,
    lyrics: lyricsBlock,
    structure: structureBlock,
    analysisProfile,
    generatedAt: artifactGeneratedAt,
    pipeline,
    rawMeta,
    requestedProvider,
    analysisBaseUrl
  });

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
    identity: identityBlock,
    timing: timingBlock,
    harmonic: harmonicBlock,
    lyrics: lyricsBlock,
    structure: structureBlock,
    modules,
    capabilities: {
      identity: {
        available: Boolean(str(identity?.title) || str(identity?.artist) || str(identity?.isrc)),
        provider: str(identity?.provider || rawMeta?.trackIdentity?.provider)
      },
      timing: {
        available: beats.length > 0 || bars.length > 0 || finiteOrNull(timing?.tempoEstimate ?? raw?.bpm) != null,
      confidence: deriveTimingConfidence({
        beats,
        bars,
        rhythmProviderAgreement
      }),
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
      analysisProfile: isPlainObject(analysisProfile) ? analysisProfile : {},
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
  const modules = isPlainObject(artifact?.modules) ? artifact.modules : {};
  const moduleSemantic = isPlainObject(modules?.semanticStructure) ? modules.semanticStructure : {};
  const moduleRhythm = isPlainObject(modules?.rhythm) ? modules.rhythm : {};
  const moduleHarmony = isPlainObject(modules?.harmony) ? modules.harmony : {};
  const moduleLyrics = isPlainObject(modules?.lyrics) ? modules.lyrics : {};
  const semanticSections = rows(moduleSemantic?.data?.sections).length
    ? rows(moduleSemantic.data.sections)
    : rows(structure?.sections).filter((row) => !isGenericStructureSection(row));
  const provenance = isPlainObject(artifact?.provenance) ? artifact.provenance : {};
  const evidence = isPlainObject(provenance?.evidence) ? provenance.evidence : {};
  const briefSeed = isPlainObject(artifact?.briefSeed) ? artifact.briefSeed : {};
  const creative = isPlainObject(creativeBrief) ? creativeBrief : {};

  return {
    trackIdentity: {
      title: str(identity?.title || media?.fileName),
      artist: str(identity?.artist),
      isrc: str(identity?.isrc),
      sourceMetadata: isPlainObject(identity?.sourceMetadata) ? {
        embeddedTitle: str(identity.sourceMetadata?.embeddedTitle),
        embeddedArtist: str(identity.sourceMetadata?.embeddedArtist),
        embeddedAlbum: str(identity.sourceMetadata?.embeddedAlbum)
      } : {},
      recommendation: isPlainObject(identity?.recommendation) ? {
        recommendedFileName: str(identity.recommendation?.recommendedFileName),
        shouldRename: Boolean(identity.recommendation?.shouldRename)
      } : {},
      metadataRecommendation: isPlainObject(identity?.metadataRecommendation) ? {
        shouldRetag: Boolean(identity.metadataRecommendation?.shouldRetag),
        current: isPlainObject(identity.metadataRecommendation?.current) ? {
          title: str(identity.metadataRecommendation.current?.title),
          artist: str(identity.metadataRecommendation.current?.artist),
          album: str(identity.metadataRecommendation.current?.album)
        } : {},
        recommended: isPlainObject(identity.metadataRecommendation?.recommended) ? {
          title: str(identity.metadataRecommendation.recommended?.title),
          artist: str(identity.metadataRecommendation.recommended?.artist),
          album: str(identity.metadataRecommendation.recommended?.album)
        } : {}
      } : {}
    },
    timing: {
      bpm: finiteOrNull(moduleRhythm?.data?.bpm ?? timing?.bpm),
      timeSignature: str(moduleRhythm?.data?.timeSignature || timing?.timeSignature || "unknown"),
      beatsArtifact: Array.isArray(moduleRhythm?.data?.beats) && moduleRhythm.data.beats.length
        ? "beats"
        : (Array.isArray(timing?.beats) && timing.beats.length ? "beats" : ""),
      barsArtifact: Array.isArray(moduleRhythm?.data?.bars) && moduleRhythm.data.bars.length
        ? "bars"
        : (Array.isArray(timing?.bars) && timing.bars.length ? "bars" : "")
    },
    structure: {
      sections: semanticSections,
      source: str(moduleSemantic?.sources?.[0] || structure?.source),
      confidence: semanticSections.length
        ? str(structure?.confidence || (moduleSemantic?.confidence != null ? moduleSemantic.confidence : "low"))
        : "low"
    },
    lyrics: {
      hasSyncedLyrics: Boolean(moduleLyrics?.data?.hasSyncedLyrics ?? lyrics?.hasSyncedLyrics),
      hasPlainPhraseFallback: Boolean(moduleLyrics?.data?.plainPhraseFallback?.available ?? lyrics?.plainPhraseFallback?.available),
      lyricsArtifact: Array.isArray(moduleLyrics?.data?.lines) && moduleLyrics.data.lines.length
        ? "lyrics"
        : (Array.isArray(lyrics?.lines) && lyrics.lines.length ? "lyrics" : ""),
      phraseArtifact: Array.isArray(moduleLyrics?.data?.plainPhraseFallback?.phrases) && moduleLyrics.data.plainPhraseFallback.phrases.length
        ? "plain-lyrics-phrases"
        : (Array.isArray(lyrics?.plainPhraseFallback?.phrases) && lyrics.plainPhraseFallback.phrases.length ? "plain-lyrics-phrases" : "")
    },
    chords: {
      hasChords: Array.isArray(moduleHarmony?.data?.chords) && moduleHarmony.data.chords.length > 0
        ? true
        : (Array.isArray(harmonic?.chords) && harmonic.chords.length > 0),
      chordsArtifact: Array.isArray(moduleHarmony?.data?.chords) && moduleHarmony.data.chords.length
        ? "chords"
        : (Array.isArray(harmonic?.chords) && harmonic.chords.length ? "chords" : ""),
      confidence: str(
        harmonic?.confidence
        || (moduleHarmony?.confidence != null ? moduleHarmony.confidence : "")
        || ((Array.isArray(harmonic?.chords) && harmonic.chords.length) ? "medium" : "low")
      )
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
    analysisProfile: input?.analysisProfile,
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
