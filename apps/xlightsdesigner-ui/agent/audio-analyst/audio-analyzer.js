function basename(path) {
  const raw = String(path || "");
  if (!raw) return "audio track";
  const normalized = raw.replace(/\\/g, "/");
  const idx = normalized.lastIndexOf("/");
  return idx >= 0 ? normalized.slice(idx + 1) : normalized;
}

function median(values = []) {
  const nums = (values || []).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!nums.length) return null;
  const mid = Math.floor(nums.length / 2);
  if (nums.length % 2 === 1) return nums[mid];
  return (nums[mid - 1] + nums[mid]) / 2;
}

function inferTempoFromBeatMarks(marks = []) {
  const starts = (marks || [])
    .map((m) => Number(m?.startMs))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  if (starts.length < 3) return null;
  const deltas = [];
  for (let i = 1; i < starts.length; i += 1) {
    const d = starts[i] - starts[i - 1];
    if (d >= 200 && d <= 3000) deltas.push(d);
  }
  const medMs = median(deltas);
  if (!medMs || medMs <= 0) return null;
  const bpm = Math.round((60000 / medMs) * 10) / 10;
  return Number.isFinite(bpm) ? bpm : null;
}

function normalizeTrackNames(timingTracks = []) {
  return (Array.isArray(timingTracks) ? timingTracks : [])
    .map((t) => (typeof t === "string" ? t : t?.name || ""))
    .filter(Boolean);
}

function findTrackName(trackNames = [], pattern) {
  return (trackNames || []).find((name) => pattern.test(String(name || ""))) || "";
}

function extractSectionRowsFromMarks(marks = []) {
  const rows = [];
  for (const mark of Array.isArray(marks) ? marks : []) {
    const label = String(mark?.label || "").trim();
    const startMs = Number(mark?.startMs);
    if (!label || !Number.isFinite(startMs)) continue;
    rows.push({ label, startMs });
  }
  return rows.sort((a, b) => a.startMs - b.startMs);
}

function looksGenericSectionLabel(value = "") {
  return /^section\s+\d+$/i.test(String(value || "").trim());
}

export function analyzeAudioContext({
  audioPath = "",
  mediaMetadata = null,
  sectionSuggestions = [],
  sectionStartByLabel = {},
  timingTracks = [],
  trackMarksByName = {},
  songContextSummary = "",
  detectedTimeSignature = "",
  detectedTempoBpm = null
} = {}) {
  const trackName = basename(audioPath || "");
  const sections = Array.isArray(sectionSuggestions) ? sectionSuggestions.filter(Boolean) : [];
  const trackNames = normalizeTrackNames(timingTracks);
  const structureTrackName =
    findTrackName(trackNames, /^xd:\s*song\s*structure$/i) ||
    findTrackName(trackNames, /section|song|structure|phrase|form/i);

  const hasBeatTrack = trackNames.some((name) => /beat|bpm|tempo/i.test(name));
  const hasBarTrack = trackNames.some((name) => /\bbar(s)?\b/i.test(name));
  const hasChordTrack = trackNames.some((name) => /chord/i.test(name));
  const hasLyricsTrack = trackNames.some((name) => /lyric/i.test(name));
  const beatTrackName = trackNames.find((name) => /beat|bpm|tempo/i.test(name)) || "";
  const beatMarks = beatTrackName ? (trackMarksByName?.[beatTrackName] || []) : [];
  const structureMarks = structureTrackName ? (trackMarksByName?.[structureTrackName] || []) : [];
  const structureRows = extractSectionRowsFromMarks(structureMarks);
  const effectiveSections = structureRows.length
    ? Array.from(new Set(structureRows.map((row) => row.label))).filter((label) => !looksGenericSectionLabel(label))
    : sections;
  const inferredBpm = Number.isFinite(Number(detectedTempoBpm))
    ? Number(detectedTempoBpm)
    : inferTempoFromBeatMarks(beatMarks);
  const normalizedSignature = String(detectedTimeSignature || "").trim();
  const timeSignatureText = normalizedSignature || "unknown";
  const durationMs = Number(mediaMetadata?.durationMs);
  const channels = Number(mediaMetadata?.channels);
  const sampleRate = Number(mediaMetadata?.sampleRate);
  const sectionRows = structureRows.length
    ? structureRows.map((row) => `${row.label}@${Math.round(row.startMs)}ms`)
    : sections.map((label) => {
    const start = Number(sectionStartByLabel?.[label]);
    return Number.isFinite(start) ? `${label}@${Math.round(start)}ms` : `${label}@?`;
  });

  return {
    source: audioPath || "(none)",
    trackName,
    structure: effectiveSections,
    timing: {
      tempoEstimate: inferredBpm || (hasBeatTrack ? "derived-from-beat-track" : "pending"),
      timeSignature: timeSignatureText,
      hasBeatTrack,
      hasBarTrack,
      hasChordTrack,
      hasLyricsTrack
    },
    media: {
      durationMs: Number.isFinite(durationMs) ? durationMs : null,
      channels: Number.isFinite(channels) ? channels : null,
      sampleRate: Number.isFinite(sampleRate) ? sampleRate : null
    },
    pipeline: {
      mediaAttached: Boolean(audioPath),
      mediaMetadataRead: Boolean(mediaMetadata && Object.keys(mediaMetadata || {}).length),
      structureDerived: effectiveSections.length > 0,
      timingDerived: Boolean(inferredBpm || hasBeatTrack || hasBarTrack),
      lyricsDetected: hasLyricsTrack,
      webContextDerived: Boolean(String(songContextSummary || "").trim())
    },
    summaryLines: [
      `Audio source: ${trackName || "(none)"}`,
      `Media metadata: ${Number.isFinite(durationMs) ? `${Math.round(durationMs)}ms` : "duration pending"}, ${Number.isFinite(channels) ? `${channels}ch` : "ch?"}, ${Number.isFinite(sampleRate) ? `${sampleRate}Hz` : "rate?"}`,
      `Song structure: ${(effectiveSections.length ? effectiveSections.join(", ") : "generic or unavailable")}`,
      `Section map: ${sectionRows.length ? sectionRows.join(" | ") : "pending"}`,
      `Song context: ${String(songContextSummary || "").trim() || "pending"}`,
      `Tempo/time signature: ${inferredBpm ? `${inferredBpm} BPM (inferred)` : (hasBeatTrack ? "beat track detected (BPM pending)" : "pending explicit beat analysis")} / ${timeSignatureText}`,
      `Timing tracks: beat=${hasBeatTrack ? "yes" : "no"}, bars=${hasBarTrack ? "yes" : "no"}, chords=${hasChordTrack ? "yes" : "no"}, lyrics=${hasLyricsTrack ? "yes" : "no"}`,
      `Creative brief seed: ${effectiveSections.length ? "structure-aware" : "needs semantic section analysis"}`
    ]
  };
}
