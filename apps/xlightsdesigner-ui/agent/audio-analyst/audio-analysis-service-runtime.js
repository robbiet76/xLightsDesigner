import {
  buildAudioAnalysisServiceRequest,
  summarizeProviderSelection
} from "./audio-provider-adapters.js";
import {
  normalizeChordCapability,
  normalizeIdentityCapability,
  normalizeLyricsCapability,
  normalizeStructureCapability,
  normalizeTimingCapability
} from "./audio-analysis-capability-adapters.js";

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function str(value = "") {
  return String(value || "").trim();
}

function buildFallbackSectionMarks({ durationMs = 0 } = {}) {
  const total = Math.round(Number(durationMs));
  if (!Number.isFinite(total) || total < 15000) return [];

  const templates =
    total >= 150000
      ? ["Intro", "Verse 1", "Chorus 1", "Verse 2", "Chorus 2", "Outro"]
      : total >= 105000
        ? ["Intro", "Verse 1", "Chorus 1", "Bridge", "Chorus 2", "Outro"]
        : ["Intro", "Verse", "Chorus", "Bridge", "Outro"];
  const count = templates.length;
  const rows = [];

  for (let index = 0; index < count; index += 1) {
    const startMs = Math.round((total * index) / count);
    const endMs =
      index === count - 1
        ? Math.max(startMs + 1, total - 1)
        : Math.max(startMs + 1, Math.round((total * (index + 1)) / count) - 1);
    rows.push({
      label: templates[index],
      startMs,
      endMs
    });
  }

  return rows;
}

export function createAudioAnalysisPipelineState() {
  return {
    mediaAttached: false,
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

export function normalizeAnalysisMarksForApi(marks = [], { sequenceDurationMs = null, mediaDurationMs = null } = {}) {
  const cap =
    Number.isFinite(sequenceDurationMs) && sequenceDurationMs > 1
      ? sequenceDurationMs
      : (Number.isFinite(Number(mediaDurationMs)) && Number(mediaDurationMs) > 1
        ? Math.round(Number(mediaDurationMs))
        : null);
  const maxExclusive = cap != null ? Math.max(1, cap) : null;
  const maxEnd = maxExclusive != null ? Math.max(1, maxExclusive - 1) : null;
  const out = [];
  for (const mark of Array.isArray(marks) ? marks : []) {
    const startMsRaw = Math.round(Number(mark?.startMs));
    if (!Number.isFinite(startMsRaw)) continue;
    let startMs = Math.max(0, startMsRaw);
    if (maxExclusive != null && startMs >= maxExclusive) continue;
    if (!Number.isFinite(startMs)) continue;
    const endRaw = Number(mark?.endMs);
    const label = str(mark?.label);
    const row = { startMs };
    if (Number.isFinite(endRaw) && endRaw > startMs) row.endMs = Math.round(endRaw);
    if (maxEnd != null && Number.isFinite(row.endMs)) row.endMs = Math.min(row.endMs, maxEnd);
    if (maxEnd != null && !Number.isFinite(row.endMs)) row.endMs = Math.min(maxEnd, row.startMs + 1);
    if (maxEnd != null && row.endMs <= row.startMs) row.endMs = Math.min(maxEnd, row.startMs + 1);
    if (maxEnd != null && row.endMs <= row.startMs) continue;
    if (label) row.label = label;
    out.push(row);
  }
  return out;
}

export async function runAudioAnalysisServicePass({
  audioPath = "",
  analysisBridge = null,
  baseUrl = "",
  provider = "auto",
  apiKey = "",
  authBearer = "",
  mediaMetadata = null,
  sequenceDurationMs = null,
  inferLyricStanzaPlan,
  relabelSectionsWithLlm,
  audioTrackQueryFromPath,
  buildSectionSuggestions,
  onProgress = null
} = {}) {
  const pipeline = createAudioAnalysisPipelineState();
  const diagnostics = [];
  const trackMarksByName = {};
  const analysisTrackNames = [];
  let nextMediaMetadata = mediaMetadata;
  let nextSequenceDurationMs = sequenceDurationMs;
  let detectedTimeSignature = "";
  let detectedTempoBpm = null;
  let detectedTrackIdentity = null;
  let serviceWebTempoEvidence = null;
  let rawAnalysisData = {};
  let sectionSuggestions = [];
  let sectionStartByLabel = {};
  let sectionTrackName = "";

  const addDiag = (message) => {
    const text = str(message);
    if (text) diagnostics.push(text);
  };
  const emitProgress = (stage, message) => {
    if (typeof onProgress === "function") onProgress({ stage: str(stage), message: str(message) });
  };

  const normalizeMarks = (marks = []) => normalizeAnalysisMarksForApi(marks, {
    sequenceDurationMs: nextSequenceDurationMs,
    mediaDurationMs: Number(nextMediaMetadata?.durationMs)
  });

  const addAnalysisTrack = (trackName, marks, pipelineKey = "") => {
    const name = str(trackName);
    const normalized = normalizeMarks(marks);
    if (!name || !normalized.length) return;
    trackMarksByName[name] = normalized;
    analysisTrackNames.push(name);
    if (pipelineKey && Object.prototype.hasOwnProperty.call(pipeline, pipelineKey)) {
      pipeline[pipelineKey] = true;
    }
  };

  if (!analysisBridge) {
    addDiag("Analysis service bridge unavailable in this runtime.");
    return {
      pipeline,
      diagnostics,
      trackMarksByName,
      analysisTrackNames,
      mediaMetadata: nextMediaMetadata,
      sequenceDurationMs: nextSequenceDurationMs,
      detectedTimeSignature,
      detectedTempoBpm,
      detectedTrackIdentity,
      serviceWebTempoEvidence,
      rawAnalysisData,
      sectionSuggestions,
      sectionStartByLabel,
      sectionTrackName
    };
  }

  try {
    pipeline.analysisServiceCalled = true;
    emitProgress("service_request", "Submitting the selected track to the analysis backend.");
    const analysisRes = await analysisBridge.runAudioAnalysisService(buildAudioAnalysisServiceRequest({
      filePath: audioPath,
      baseUrl,
      provider,
      apiKey,
      authBearer
    }));
    if (!analysisRes?.ok) {
      addDiag(`Audio analysis service failed: ${str(analysisRes?.error || "unknown error")}`);
      return {
        pipeline,
        diagnostics,
        trackMarksByName,
        analysisTrackNames,
        mediaMetadata: nextMediaMetadata,
        sequenceDurationMs: nextSequenceDurationMs,
        detectedTimeSignature,
        detectedTempoBpm,
        detectedTrackIdentity,
        serviceWebTempoEvidence,
        rawAnalysisData,
        sectionSuggestions,
        sectionStartByLabel,
        sectionTrackName
      };
    }

    pipeline.analysisServiceSucceeded = true;
    emitProgress("service_response", "Backend analysis returned raw timing and structure data.");
    const data = isPlainObject(analysisRes?.data) ? analysisRes.data : {};
    const dataMeta = isPlainObject(data?.meta) ? data.meta : {};
    for (const line of summarizeProviderSelection(dataMeta)) addDiag(line);

    const identityCapability = normalizeIdentityCapability(data);
    const timingCapability = normalizeTimingCapability(data);
    const chordCapability = normalizeChordCapability(data);
    const lyricsCapability = normalizeLyricsCapability(data);
    const structureCapability = normalizeStructureCapability(data);
    detectedTrackIdentity = identityCapability.title || identityCapability.artist || identityCapability.isrc
      ? {
          title: identityCapability.title,
          artist: identityCapability.artist,
          album: identityCapability.album,
          isrc: identityCapability.isrc,
          provider: identityCapability.provider
        }
      : null;
    serviceWebTempoEvidence = identityCapability.webTempoEvidence;
    const beats = timingCapability.beats;
    const bars = timingCapability.bars;
    const chords = chordCapability.chords;
    const sections = structureCapability.sections;
    const lyrics = lyricsCapability.lyrics;
    diagnostics.push(...identityCapability.diagnostics, ...timingCapability.diagnostics, ...chordCapability.diagnostics, ...lyricsCapability.diagnostics, ...structureCapability.diagnostics);
    let effectiveSections = sections;
    let lyricalSectionIndices = [];

    const serviceDurationMs = Number(data?.durationMs);
    if (Number.isFinite(serviceDurationMs) && serviceDurationMs > 1) {
      const roundedDuration = Math.round(serviceDurationMs);
      if (!Number.isFinite(nextSequenceDurationMs) || nextSequenceDurationMs <= 1) {
        nextSequenceDurationMs = roundedDuration;
      }
      if (!Number.isFinite(Number(nextMediaMetadata?.durationMs)) || Number(nextMediaMetadata?.durationMs) <= 1) {
        nextMediaMetadata = { ...(nextMediaMetadata || {}), durationMs: roundedDuration };
        pipeline.mediaMetadataRead = true;
      }
    }

    const tempoBpm = Number(timingCapability.bpm);
    const timeSignature = str(timingCapability.timeSignature);
    detectedTempoBpm = Number.isFinite(tempoBpm) ? tempoBpm : null;
    detectedTimeSignature = timeSignature;
    if (Number.isFinite(tempoBpm) || timeSignature) {
      addDiag(`${Number.isFinite(tempoBpm) ? `Service analysis summary: ${tempoBpm} BPM` : "Service analysis summary: BPM?"}${timeSignature ? ` / ${timeSignature}` : ""}`);
    }

    if (Array.isArray(lyrics) && lyrics.length >= 4 && typeof inferLyricStanzaPlan === "function") {
      const durationForSections =
        (Number.isFinite(serviceDurationMs) && serviceDurationMs > 1 ? Math.round(serviceDurationMs) : null) ||
        (Number.isFinite(nextSequenceDurationMs) && nextSequenceDurationMs > 1 ? Math.round(nextSequenceDurationMs) : null) ||
        (Number.isFinite(Number(nextMediaMetadata?.durationMs)) && Number(nextMediaMetadata.durationMs) > 1
          ? Math.round(Number(nextMediaMetadata.durationMs))
          : 0);
      const titleHintForStanzas = str(detectedTrackIdentity?.title) || (typeof audioTrackQueryFromPath === "function" ? audioTrackQueryFromPath(audioPath) : "");
      const stanzaPlan = inferLyricStanzaPlan(lyrics, durationForSections, titleHintForStanzas);
      if (Array.isArray(stanzaPlan?.sections) && stanzaPlan.sections.length) {
        effectiveSections = stanzaPlan.sections;
        lyricalSectionIndices = Array.isArray(stanzaPlan.lyricalIndices) ? stanzaPlan.lyricalIndices : [];
        addDiag(`Lyrics stanza plan: ${effectiveSections.length} sections (${lyricalSectionIndices.length} lyrical).`);
        if (Number(stanzaPlan?.titleAwareSplits || 0) > 0) {
          addDiag(`Lyrics stanza title-aware splits: ${Number(stanzaPlan.titleAwareSplits)}.`);
        }
      }
    }

    if (
      Array.isArray(effectiveSections) && effectiveSections.length >= 2 &&
      Array.isArray(lyrics) && lyrics.length >= 4 && lyricalSectionIndices.length &&
      typeof relabelSectionsWithLlm === "function"
    ) {
      const relabeled = await relabelSectionsWithLlm({
        sections: effectiveSections,
        lyrics,
        chords,
        lyricalIndices: lyricalSectionIndices,
        trackIdentity: detectedTrackIdentity,
        trackTitleHint: typeof audioTrackQueryFromPath === "function" ? audioTrackQueryFromPath(audioPath) : "",
        userManualStructureHint: null,
        timeSignature,
        tempoBpm
      });
      if (Array.isArray(relabeled?.sections) && relabeled.sections.length === effectiveSections.length) {
        effectiveSections = relabeled.sections;
        addDiag(str(relabeled.confidence) ? `LLM section relabel: ${str(relabeled.confidence)}` : "LLM section relabel: applied.");
        if (str(relabeled.rationale)) addDiag(`LLM section rationale: ${str(relabeled.rationale)}`);
        if (isPlainObject(relabeled?.trainingPackage)) {
          const pkgId = str(relabeled.trainingPackage.packageId || "unknown");
          const pkgVer = str(relabeled.trainingPackage.packageVersion || "?");
          const modId = str(relabeled.trainingPackage.moduleId || "audio_track_analysis");
          const modVer = str(relabeled.trainingPackage.moduleVersion || "?");
          const promptCount = Array.isArray(relabeled.trainingPackage.promptPaths) ? relabeled.trainingPackage.promptPaths.length : 0;
          const fewShotCount = Number(relabeled.trainingPackage.fewShotCount || 0);
          addDiag(`Training package: ${pkgId}@${pkgVer} module ${modId}@${modVer} prompts=${promptCount}, fewShot=${fewShotCount}`);
        } else if (str(relabeled?.trainingPackageError)) {
          addDiag(`Training package fallback: ${str(relabeled.trainingPackageError)}`);
        }
      }
    }

    if ((!Array.isArray(effectiveSections) || !effectiveSections.length)) {
      const durationForFallback =
        (Number.isFinite(serviceDurationMs) && serviceDurationMs > 1 ? Math.round(serviceDurationMs) : null) ||
        (Number.isFinite(nextSequenceDurationMs) && nextSequenceDurationMs > 1 ? Math.round(nextSequenceDurationMs) : null) ||
        (Number.isFinite(Number(nextMediaMetadata?.durationMs)) && Number(nextMediaMetadata.durationMs) > 1
          ? Math.round(Number(nextMediaMetadata.durationMs))
          : 0);
      const heuristicSections = buildFallbackSectionMarks({ durationMs: durationForFallback });
      if (heuristicSections.length) {
        effectiveSections = heuristicSections;
        addDiag(`Generated heuristic song sections from track duration (${heuristicSections.length} sections).`);
      }
    }

    if (Array.isArray(effectiveSections) && effectiveSections.length) {
      const finalLabels = effectiveSections.map((row) => str(row?.label)).filter(Boolean);
      if (finalLabels.length) addDiag(`Final song structure labels: ${finalLabels.join(", ")}`);
    }

    emitProgress("service_normalize", "Building beats, bars, sections, chords, and lyric tracks.");
    addAnalysisTrack("Analysis: Beats", beats, "beatTrackWritten");
    addAnalysisTrack("Analysis: Bars", bars, "barTrackWritten");
    addAnalysisTrack("Analysis: Chords", chords, "chordTrackWritten");
    addAnalysisTrack("Analysis: Lyrics", lyrics, "lyricsTrackWritten");
    addAnalysisTrack("Analysis: Song Structure", effectiveSections, "structureTrackWritten");

    if (beats.length || bars.length || chords.length) pipeline.timingDerived = true;
    if (lyrics.length) pipeline.lyricsDetected = true;
    if (Array.isArray(effectiveSections) && effectiveSections.length && typeof buildSectionSuggestions === "function") {
      const built = buildSectionSuggestions(normalizeMarks(effectiveSections));
      sectionTrackName = "Analysis: Song Structure";
      sectionSuggestions = Array.isArray(built?.labels) ? built.labels : [];
      sectionStartByLabel = isPlainObject(built?.startByLabel) ? built.startByLabel : {};
      pipeline.structureDerived = sectionSuggestions.length > 0;
    }

    rawAnalysisData = {
      bpm: Number.isFinite(tempoBpm) ? tempoBpm : null,
      timeSignature,
      beats,
      bars,
      chords,
      lyrics,
      sections: effectiveSections,
      meta: dataMeta
    };
  } catch (err) {
    addDiag(`Audio analysis service runtime failure: ${str(err?.message || err)}`);
  }

  return {
    pipeline,
    diagnostics,
    trackMarksByName,
    analysisTrackNames,
    mediaMetadata: nextMediaMetadata,
    sequenceDurationMs: nextSequenceDurationMs,
    detectedTimeSignature,
    detectedTempoBpm,
    detectedTrackIdentity,
    serviceWebTempoEvidence,
    rawAnalysisData,
    sectionSuggestions,
    sectionStartByLabel,
    sectionTrackName
  };
}
