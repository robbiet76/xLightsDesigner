function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function str(value = "") {
  return String(value || "").trim();
}

function rows(value) {
  return Array.isArray(value) ? value.filter((row) => isPlainObject(row)) : [];
}

export function normalizeIdentityCapability(data = {}) {
  const meta = isPlainObject(data?.meta) ? data.meta : {};
  const identity = isPlainObject(meta?.trackIdentity) ? meta.trackIdentity : {};
  return {
    title: str(identity?.title),
    artist: str(identity?.artist),
    album: str(identity?.album),
    isrc: str(identity?.isrc),
    provider: str(identity?.provider),
    webTempoEvidence: isPlainObject(meta?.webTempoEvidence) ? meta.webTempoEvidence : null,
    diagnostics: []
  };
}

export function normalizeTimingCapability(data = {}) {
  const bpm = Number(data?.bpm);
  const timeSignature = str(data?.timeSignature);
  const beats = rows(data?.beats);
  const bars = rows(data?.bars);
  const diagnostics = [];
  if (!beats.length) diagnostics.push("Analysis service returned no beats.");
  if (!bars.length) diagnostics.push("Analysis service returned no bars.");
  return {
    bpm: Number.isFinite(bpm) ? bpm : null,
    timeSignature,
    beats,
    bars,
    diagnostics
  };
}

export function normalizeChordCapability(data = {}) {
  const meta = isPlainObject(data?.meta) ? data.meta : {};
  const chordMeta = isPlainObject(meta?.chordAnalysis) ? meta.chordAnalysis : {};
  const chords = rows(data?.chords);
  const diagnostics = [];
  if (str(chordMeta?.engine)) diagnostics.push(`Chord analysis engine: ${str(chordMeta.engine)}`);
  if (str(chordMeta?.avgMarginConfidence)) diagnostics.push(`Chord analysis confidence: ${str(chordMeta.avgMarginConfidence)}`);
  if (!chords.length) {
    diagnostics.push("Analysis service returned no chords.");
    if (str(chordMeta?.error)) diagnostics.push(`Chord analysis detail: ${str(chordMeta.error)}`);
  }
  return {
    chords,
    diagnostics
  };
}

export function normalizeLyricsCapability(data = {}) {
  const meta = isPlainObject(data?.meta) ? data.meta : {};
  const lyrics = rows(data?.lyrics);
  const diagnostics = [];
  if (Number.isFinite(Number(meta?.lyricsGlobalShiftMs)) && Number(meta.lyricsGlobalShiftMs) !== 0) {
    diagnostics.push(`Lyrics global shift suggested: ${Math.round(Number(meta.lyricsGlobalShiftMs))}ms.`);
  }
  if (!lyrics.length) {
    diagnostics.push("Analysis service returned no synced lyrics.");
    if (str(meta?.lyricsSourceError)) diagnostics.push(`Lyrics source detail: ${str(meta.lyricsSourceError)}`);
  }
  return {
    lyrics,
    diagnostics
  };
}

export function normalizeStructureCapability(data = {}) {
  const sections = rows(data?.sections);
  const diagnostics = [];
  if (!sections.length) diagnostics.push("Analysis service returned no song sections.");
  return {
    sections,
    diagnostics
  };
}
