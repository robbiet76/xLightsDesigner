function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function rows(value) {
  return arr(value).filter((row) => row && typeof row === "object" && !Array.isArray(row));
}

function finite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function median(values = []) {
  const nums = arr(values).map((row) => Number(row)).filter((row) => Number.isFinite(row)).sort((a, b) => a - b);
  if (!nums.length) return null;
  const mid = Math.floor(nums.length / 2);
  if (nums.length % 2) return nums[mid];
  return (nums[mid - 1] + nums[mid]) / 2;
}

function stddev(values = []) {
  const nums = arr(values).map((row) => Number(row)).filter((row) => Number.isFinite(row));
  if (nums.length < 2) return 0;
  const mean = nums.reduce((sum, row) => sum + row, 0) / nums.length;
  const variance = nums.reduce((sum, row) => sum + ((row - mean) ** 2), 0) / nums.length;
  return Math.sqrt(variance);
}

function coefficientOfVariation(values = []) {
  const med = median(values);
  if (!Number.isFinite(med) || med === 0) return null;
  const sd = stddev(values);
  return sd / med;
}

function looksGenericSectionLabel(value = "") {
  return /^section(?:\s+\d+)?$/i.test(str(value));
}

function hasGenericStructureLabels(artifact = {}) {
  const labels = rows(artifact?.structure?.sections).map((row) => str(row?.label)).filter(Boolean);
  return labels.some((row) => looksGenericSectionLabel(row));
}

function parseBeatsPerBarFromTimeSignature(value = "") {
  const match = /^(\d+)\s*\/\s*(\d+)$/.exec(str(value));
  if (!match) return null;
  const numerator = Number(match[1]);
  return Number.isFinite(numerator) && numerator > 0 ? numerator : null;
}

function hasSemanticStructureSections(artifact = {}) {
  const sections = rows(artifact?.structure?.sections);
  if (!sections.length) return false;
  return sections.some((row) => {
    const label = str(row?.label || row?.name);
    return label && !looksGenericSectionLabel(label) && str(row?.sectionType) !== "section";
  });
}

function hasCompleteSemanticSongStructure(artifact = {}) {
  const sections = rows(artifact?.structure?.sections);
  if (!sections.length) return false;
  if (hasGenericStructureLabels(artifact)) return false;
  return hasSemanticStructureSections(artifact);
}

function findSectionRowsWithin(rowsInput = [], startMs = 0, endMs = 0) {
  return rows(rowsInput).filter((row) => {
    const start = finite(row?.startMs);
    if (!Number.isFinite(start)) return false;
    return start >= startMs && start < endMs;
  });
}

function buildSectionMetric(section = {}, beats = [], bars = [], chords = [], lyrics = []) {
  const label = str(section?.label || section?.name || "Section");
  const startMs = finite(section?.startMs);
  const endMs = finite(section?.endMs);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return null;
  }
  const durationMs = endMs - startMs;
  const sectionBeats = findSectionRowsWithin(beats, startMs, endMs);
  const sectionBars = findSectionRowsWithin(bars, startMs, endMs);
  const sectionChords = findSectionRowsWithin(chords, startMs, endMs);
  const sectionLyrics = rows(lyrics).filter((row) => {
    const s = finite(row?.startMs);
    const e = finite(row?.endMs);
    if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return false;
    return Math.max(startMs, s) < Math.min(endMs, e);
  });
  const beatIntervals = [];
  for (let index = 1; index < sectionBeats.length; index += 1) {
    const prev = finite(sectionBeats[index - 1]?.startMs);
    const cur = finite(sectionBeats[index]?.startMs);
    if (!Number.isFinite(prev) || !Number.isFinite(cur) || cur <= prev) continue;
    beatIntervals.push(cur - prev);
  }
  const medianBeatMs = median(beatIntervals);
  const avgBeatMs = beatIntervals.length
    ? beatIntervals.reduce((sum, row) => sum + row, 0) / beatIntervals.length
    : null;
  const beatCv = coefficientOfVariation(beatIntervals);
  const beatsPerBarObserved = sectionBars.length ? sectionBeats.length / sectionBars.length : null;
  const issues = [];
  if (!sectionBeats.length) issues.push("missing_beats");
  if (!sectionBars.length) issues.push("missing_bars");
  if (!sectionLyrics.length) issues.push("missing_lyrics");
  if (!sectionChords.length) issues.push("missing_chords");
  if (Number.isFinite(beatCv) && beatCv > 0.08) issues.push("irregular_beat_intervals");
  return {
    label,
    startMs,
    endMs,
    durationMs,
    durationSec: Math.round((durationMs / 1000) * 100) / 100,
    beatCount: sectionBeats.length,
    barCount: sectionBars.length,
    chordCount: sectionChords.length,
    lyricLineCount: sectionLyrics.length,
    beatsPerBarObserved: Number.isFinite(beatsPerBarObserved) ? Math.round(beatsPerBarObserved * 100) / 100 : null,
    avgBeatMs: Number.isFinite(avgBeatMs) ? Math.round(avgBeatMs * 100) / 100 : null,
    medianBeatMs: Number.isFinite(medianBeatMs) ? Math.round(medianBeatMs * 100) / 100 : null,
    bpmFromMedianBeat: Number.isFinite(medianBeatMs) && medianBeatMs > 0 ? Math.round((60000 / medianBeatMs) * 100) / 100 : null,
    beatIntervalCv: Number.isFinite(beatCv) ? Math.round(beatCv * 1000) / 1000 : null,
    issues
  };
}

function buildTopLevelIssues(artifact = {}, sectionMetrics = []) {
  const issues = [];
  const timeSignature = str(artifact?.timing?.timeSignature);
  const harmonicConfidence = str(artifact?.harmonic?.confidence);
  const lyricsCount = rows(artifact?.lyrics?.lines).length;
  const chordCount = rows(artifact?.harmonic?.chords).length;
  const diagnostics = arr(artifact?.diagnostics?.warnings).map((row) => str(row));
  const allBpb = sectionMetrics.map((row) => row?.beatsPerBarObserved).filter((row) => Number.isFinite(row));
  const medianBpb = median(allBpb);
  const expectedBpb = parseBeatsPerBarFromTimeSignature(timeSignature);
  const providerAgreement = artifact?.modules?.rhythm?.data?.providerAgreement;

  if (hasGenericStructureLabels(artifact)) issues.push("generic_structure_labels_present");
  if (!hasCompleteSemanticSongStructure(artifact)) issues.push("missing_semantic_song_structure");
  if (diagnostics.some((row) => /Generated heuristic song sections/i.test(row))) issues.push("heuristic_song_structure_generated");
  if (!rows(artifact?.timing?.beats).length) issues.push("missing_beats");
  if (!rows(artifact?.timing?.bars).length) issues.push("missing_bars");
  if (!lyricsCount) issues.push("no_synced_lyrics");
  if (!chordCount) issues.push("no_chords");
  if (harmonicConfidence && Number.isFinite(Number(harmonicConfidence)) && Number(harmonicConfidence) < 0.2) {
    issues.push("very_low_harmonic_confidence");
  }
  if (Number.isFinite(expectedBpb) && Number.isFinite(medianBpb) && Math.abs(medianBpb - expectedBpb) > 0.35) {
    issues.push("bars_do_not_match_time_signature");
  }
  if (providerAgreement?.enabled && providerAgreement?.available && providerAgreement?.agreedOnTimeSignature === false) {
    issues.push("rhythm_provider_time_signature_disagreement");
  }
  if (providerAgreement?.enabled && providerAgreement?.available && providerAgreement?.agreedOnBeatsPerBar === false) {
    issues.push("rhythm_provider_bar_grouping_disagreement");
  }
  if (timeSignature === "2/4" && Number.isFinite(medianBpb) && medianBpb <= 2.1) {
    issues.push("timing_locked_to_duple_meter");
  }
  return issues;
}

function buildServiceAssessment(artifact = {}) {
  const providerUsed = str(artifact?.provenance?.service?.providerUsed);
  const lyricsSource = str(artifact?.lyrics?.source);
  const chordSource = str(artifact?.capabilities?.harmonic?.source || artifact?.provenance?.service?.providerUsed);
  const sources = [];
  if (providerUsed) sources.push({ capability: "timing+sections", provider: providerUsed });
  if (lyricsSource) sources.push({ capability: "lyrics", provider: lyricsSource });
  if (chordSource) sources.push({ capability: "harmonic", provider: chordSource });
  return {
    providerUsed,
    sources,
    gaps: [
      rows(artifact?.lyrics?.lines).length ? null : "lyrics service unavailable or disabled",
      rows(artifact?.harmonic?.chords).length ? null : "harmonic analysis yielded no usable chords",
      hasGenericStructureLabels(artifact) ? "structure labels are generic and do not carry trusted semantics" : null
    ].filter(Boolean)
  };
}

export function buildAudioAnalysisQualityReport(artifact = {}) {
  const beats = rows(artifact?.timing?.beats);
  const bars = rows(artifact?.timing?.bars);
  const chords = rows(artifact?.harmonic?.chords);
  const lyrics = rows(artifact?.lyrics?.lines);
  const sections = rows(artifact?.structure?.sections);
  const sectionMetrics = sections
    .map((row) => buildSectionMetric(row, beats, bars, chords, lyrics))
    .filter(Boolean);
  const topLevelIssues = buildTopLevelIssues(artifact, sectionMetrics);
  const expectedBeatsPerBar = parseBeatsPerBarFromTimeSignature(artifact?.timing?.timeSignature);
  const observedBeatsPerBar = median(sectionMetrics.map((row) => row?.beatsPerBarObserved).filter((row) => Number.isFinite(row)));
  const readiness = {
    minimumContract: {
      beatsPresent: beats.length > 0,
      barsPresent: bars.length > 0,
      semanticSongStructurePresent: hasCompleteSemanticSongStructure(artifact),
      barsMatchTimeSignature:
        !Number.isFinite(expectedBeatsPerBar) || !Number.isFinite(observedBeatsPerBar)
          ? false
          : Math.abs(observedBeatsPerBar - expectedBeatsPerBar) <= 0.35
    }
  };
  readiness.ok = Boolean(
    readiness.minimumContract.beatsPresent &&
    readiness.minimumContract.barsPresent &&
    readiness.minimumContract.semanticSongStructurePresent &&
    readiness.minimumContract.barsMatchTimeSignature
  );
  return {
    artifactType: "audio_analysis_quality_report_v1",
    createdAt: new Date().toISOString(),
    trackIdentity: {
      title: str(artifact?.identity?.title || artifact?.media?.fileName),
      artist: str(artifact?.identity?.artist)
    },
    summary: {
      bpm: finite(artifact?.timing?.bpm),
      timeSignature: str(artifact?.timing?.timeSignature),
      beatCount: beats.length,
      barCount: bars.length,
      chordCount: chords.length,
      lyricCount: lyrics.length,
      sectionCount: sections.length,
      timingConfidence: str(artifact?.capabilities?.timing?.confidence),
      structureConfidence: str(artifact?.structure?.confidence),
      harmonicConfidence: str(artifact?.harmonic?.confidence),
      rhythmProviderAgreement: artifact?.modules?.rhythm?.data?.providerAgreement || null
    },
    provenance: {
      structureSource: str(artifact?.structure?.source),
      structureHasOnlyGenericLabels: hasGenericStructureLabels(artifact),
      diagnostics: arr(artifact?.diagnostics?.warnings).map((row) => str(row)).filter(Boolean)
    },
    readiness,
    serviceAssessment: buildServiceAssessment(artifact),
    topLevelIssues,
    sections: sectionMetrics
  };
}
