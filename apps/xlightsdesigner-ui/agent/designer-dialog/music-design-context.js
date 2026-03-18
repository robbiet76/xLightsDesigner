import { finalizeArtifact } from "../shared/artifact-ids.js";

function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function finiteOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function rows(value) {
  return arr(value).filter((row) => row && typeof row === "object" && !Array.isArray(row));
}

function normalizeEnergyLabel(value = "") {
  const lower = str(value).toLowerCase();
  if (!lower) return "unknown";
  if (/(low|quiet|soft|gentle)/.test(lower)) return "low";
  if (/(high|big|dense|intense|peak)/.test(lower)) return "high";
  return "medium";
}

function normalizeDensityLabel(value = "") {
  const lower = str(value).toLowerCase();
  if (!lower) return "unknown";
  if (/(sparse|open|light)/.test(lower)) return "sparse";
  if (/(dense|busy|thick|full)/.test(lower)) return "dense";
  return "moderate";
}

function inferSectionEnergy(section = {}) {
  const label = str(section?.label || section?.name);
  if (/intro|outro|ending/i.test(label)) return "low";
  if (/bridge|verse/i.test(label)) return "medium";
  if (/chorus|drop|finale|solo/i.test(label)) return "high";
  return normalizeEnergyLabel(section?.energy || section?.energyLabel || "");
}

function inferSectionDensity(section = {}) {
  const label = str(section?.label || section?.name);
  if (/intro|outro/i.test(label)) return "sparse";
  if (/verse|bridge/i.test(label)) return "moderate";
  if (/chorus|drop|finale/i.test(label)) return "dense";
  return normalizeDensityLabel(section?.density || section?.densityLabel || "");
}

function overlapsWindow(row = {}, startMs = 0, endMs = 0) {
  const start = finiteOrNull(row?.startMs);
  const endRaw = finiteOrNull(row?.endMs);
  const end = endRaw != null ? endRaw : (start != null ? start + 1 : null);
  if (start == null || end == null || end <= start) return false;
  return Math.max(startMs, start) < Math.min(endMs, end);
}

function clipWindow(row = {}, startMs = 0, endMs = 0, fallbackLabel = "") {
  const start = finiteOrNull(row?.startMs);
  const endRaw = finiteOrNull(row?.endMs);
  const end = endRaw != null ? endRaw : (start != null ? start + 1 : null);
  if (start == null || end == null || end <= start) return null;
  const clippedStart = Math.max(startMs, Math.round(start));
  const clippedEnd = Math.min(endMs, Math.round(end));
  if (clippedEnd <= clippedStart) return null;
  return {
    label: str(row?.label || fallbackLabel || "Cue"),
    trackName: "",
    startMs: clippedStart,
    endMs: clippedEnd
  };
}

function deriveFallbackPhraseWindows({ startMs = 0, endMs = 0, bars = [], beats = [] } = {}) {
  const barWindows = rows(bars)
    .filter((row) => overlapsWindow(row, startMs, endMs))
    .map((row, index) => clipWindow(row, startMs, endMs, `Phrase ${index + 1}`))
    .filter(Boolean);
  if (barWindows.length >= 2) {
    const head = barWindows.slice(0, Math.max(1, Math.ceil(barWindows.length / 2)));
    const tail = barWindows.slice(Math.max(1, Math.ceil(barWindows.length / 2)));
    const windows = [];
    const merge = (rowsToMerge = [], label = "") => {
      if (!rowsToMerge.length) return null;
      return {
        label,
        trackName: "XD: Phrase Cues",
        startMs: rowsToMerge[0].startMs,
        endMs: rowsToMerge[rowsToMerge.length - 1].endMs
      };
    };
    const first = merge(head, "Phrase Hold");
    const second = merge(tail, "Phrase Release");
    if (first) windows.push(first);
    if (second && second.startMs > first?.startMs) windows.push(second);
    if (windows.length) return windows.slice(0, 2);
  }

  const beatWindows = rows(beats)
    .filter((row) => overlapsWindow(row, startMs, endMs))
    .map((row, index) => clipWindow(row, startMs, endMs, `Beat ${index + 1}`))
    .filter(Boolean);
  if (beatWindows.length >= 4) {
    const splitIndex = Math.max(1, beatWindows.length - 2);
    const head = beatWindows.slice(0, splitIndex);
    const tail = beatWindows.slice(splitIndex);
    const merged = [];
    if (head.length) {
      merged.push({
        label: "Phrase Hold",
        trackName: "XD: Phrase Cues",
        startMs: head[0].startMs,
        endMs: head[head.length - 1].endMs
      });
    }
    if (tail.length) {
      merged.push({
        label: "Phrase Release",
        trackName: "XD: Phrase Cues",
        startMs: tail[0].startMs,
        endMs: tail[tail.length - 1].endMs
      });
    }
    return merged.filter((row) => row.endMs > row.startMs).slice(0, 2);
  }

  return [];
}

function buildCueWindowsBySection({
  sections = [],
  beats = [],
  chords = [],
  bars = [],
  lyricLines = []
} = {}) {
  const out = {};
  for (const section of rows(sections)) {
    const label = str(section?.label || section?.name);
    const startMs = Math.round(finiteOrNull(section?.startMs) ?? -1);
    const endMs = Math.round(finiteOrNull(section?.endMs) ?? -1);
    if (!label || startMs < 0 || endMs <= startMs) continue;

    const beatWindows = rows(beats)
      .filter((row) => overlapsWindow(row, startMs, endMs))
      .map((row, index) => {
        const clipped = clipWindow(row, startMs, endMs, `Beat ${index + 1}`);
        return clipped ? { ...clipped, trackName: "XD: Beat Grid" } : null;
      })
      .filter(Boolean)
      .slice(0, 16);

    const chordWindows = rows(chords)
      .filter((row) => overlapsWindow(row, startMs, endMs))
      .map((row, index) => {
        const clipped = clipWindow(row, startMs, endMs, `Chord ${index + 1}`);
        return clipped ? { ...clipped, trackName: "XD: Chord Changes" } : null;
      })
      .filter(Boolean)
      .slice(0, 8);

    let phraseWindows = rows(lyricLines)
      .filter((row) => overlapsWindow(row, startMs, endMs))
      .map((row, index) => {
        const clipped = clipWindow(row, startMs, endMs, `Phrase ${index + 1}`);
        return clipped ? { ...clipped, trackName: "XD: Phrase Cues" } : null;
      })
      .filter(Boolean)
      .slice(0, 8);
    if (!phraseWindows.length) {
      phraseWindows = deriveFallbackPhraseWindows({
        startMs,
        endMs,
        bars,
        beats
      });
    }

    if (beatWindows.length || chordWindows.length || phraseWindows.length) {
      out[label] = {};
      if (beatWindows.length) out[label].beat = beatWindows;
      if (chordWindows.length) out[label].chord = chordWindows;
      if (phraseWindows.length) out[label].phrase = phraseWindows;
    }
  }
  return out;
}

export function buildMusicDesignContext({
  analysisArtifact = null,
  analysisHandoff = null
} = {}) {
  const capabilities = analysisArtifact?.capabilities || {};
  const sections = arr(
    capabilities.structure?.sections ||
    analysisArtifact?.structure?.sections ||
    analysisArtifact?.structure ||
    analysisHandoff?.structure?.sections ||
    []
  );

  const sectionArc = sections.map((section) => ({
    label: str(section?.label || section?.name || "Section"),
    energy: inferSectionEnergy(section),
    density: inferSectionDensity(section)
  }));

  const revealMoments = [];
  for (let i = 1; i < sectionArc.length; i += 1) {
    const prev = sectionArc[i - 1];
    const cur = sectionArc[i];
    if (prev.energy !== "high" && cur.energy === "high") {
      revealMoments.push(`${prev.label}->${cur.label}`);
    }
  }

  const lyricSections = arr(analysisHandoff?.lyrics?.sections || []);
  const lyricFocusMoments = lyricSections
    .map((row) => str(row?.label || row?.section))
    .filter(Boolean)
    .slice(0, 8);

  const holdMoments = sectionArc
    .filter((row) => row.energy === "low")
    .map((row) => row.label)
    .slice(0, 8);

  const beats = rows(analysisArtifact?.timing?.beats);
  const bars = rows(analysisArtifact?.timing?.bars);
  const chords = rows(analysisArtifact?.harmonic?.chords);
  const lyricLines = rows(analysisArtifact?.lyrics?.lines);
  const cueWindowsBySection = buildCueWindowsBySection({
    sections,
    beats,
    bars,
    chords,
    lyricLines
  });

  return finalizeArtifact({
    artifactType: "music_design_context_v1",
    artifactVersion: "1.0",
    mediaId: str(analysisArtifact?.mediaId || analysisHandoff?.mediaId || ""),
    sectionArc,
    designCues: {
      revealMoments,
      holdMoments,
      lyricFocusMoments,
      cueWindowsBySection
    }
  });
}
