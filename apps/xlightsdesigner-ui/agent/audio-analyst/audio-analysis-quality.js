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
  return /^section\s+\d+$/i.test(str(value));
}

function extractSummaryLine(artifact = {}, prefix = "") {
  return arr(artifact?.briefSeed?.summaryLines).find((line) => str(line).toLowerCase().startsWith(prefix.toLowerCase())) || "";
}

function inferStructureRelabeling(artifact = {}) {
  const summaryLine = extractSummaryLine(artifact, "Song structure:");
  const summaryTail = summaryLine.replace(/^song structure:\s*/i, "");
  const summaryLabels = summaryTail
    .split(/\s*,\s*/)
    .map((row) => str(row))
    .filter(Boolean);
  const artifactLabels = rows(artifact?.structure?.sections).map((row) => str(row?.label)).filter(Boolean);
  if (!summaryLabels.length || !artifactLabels.length) return false;
  const summaryAllGeneric = summaryLabels.every((row) => looksGenericSectionLabel(row));
  const artifactAnySemantic = artifactLabels.some((row) => !looksGenericSectionLabel(row));
  return summaryAllGeneric && artifactAnySemantic;
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

  if (inferStructureRelabeling(artifact)) issues.push("generic_structure_labels_promoted_to_semantic_labels");
  if (diagnostics.some((row) => /Generated heuristic song sections/i.test(row))) issues.push("heuristic_song_structure_generated");
  if (!lyricsCount) issues.push("no_synced_lyrics");
  if (!chordCount) issues.push("no_chords");
  if (harmonicConfidence && Number.isFinite(Number(harmonicConfidence)) && Number(harmonicConfidence) < 0.2) {
    issues.push("very_low_harmonic_confidence");
  }
  if (timeSignature === "2/4" && Number.isFinite(medianBpb) && medianBpb <= 2.1) {
    issues.push("timing_locked_to_duple_meter");
  }
  if (sectionMetrics.some((row) => arr(row?.issues).includes("missing_lyrics"))) {
    issues.push("phrase_logic_would_depend_on_non-lyric_fallbacks");
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
      inferStructureRelabeling(artifact) ? "section semantics depend on relabeling, not direct service labels" : null
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
      harmonicConfidence: str(artifact?.harmonic?.confidence)
    },
    provenance: {
      structureSource: str(artifact?.structure?.source),
      structureRelabeledFromGeneric: inferStructureRelabeling(artifact),
      diagnostics: arr(artifact?.diagnostics?.warnings).map((row) => str(row)).filter(Boolean)
    },
    serviceAssessment: buildServiceAssessment(artifact),
    topLevelIssues,
    sections: sectionMetrics
  };
}
