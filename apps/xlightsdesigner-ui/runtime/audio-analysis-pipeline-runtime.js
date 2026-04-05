export function createAudioAnalysisPipelineRuntime(deps = {}) {
  const {
    state,
    basenameOfPath = () => "",
    analyzeAudioContext,
    getDesktopAudioAnalysisBridge = () => null,
    getDesktopAgentConversationBridge = () => null,
    setAudioAnalysisProgress = () => {},
    render = () => {},
    buildAnalysisArtifactFromPipelineResult,
    buildAnalysisHandoffFromArtifact,
    buildAudioAnalysisQualityReport,
    runAudioAnalysisOrchestration,
    maybePromptForMissingIdentityMetadata,
    isPlainObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value),
    buildSectionSuggestions,
    areMetersCompatible,
    extractNumericCandidates,
    medianNumber,
    loadAudioTrainingPackageBundle
  } = deps;

  function buildAudioPipelineSummaryLines(pipeline = {}) {
    const checks = [
      ["Audio fingerprint captured", Boolean(pipeline?.fingerprintCaptured)],
      ["Tempo timing ready", Boolean(pipeline?.tempoReady)],
      ["Chord markers ready", Boolean(pipeline?.chordTrackWritten)],
      ["Structure markers ready", Boolean(pipeline?.structureTrackWritten)],
      ["Lyrics markers ready", Boolean(pipeline?.lyricsTrackWritten)],
      ["Song context derived", Boolean(pipeline?.webContextDerived)]
    ];
    if (pipeline?.structureTrackPreserved) checks.push(["Song structure preserved (manual edits)", true]);
    if (pipeline?.beatTrackPreserved) checks.push(["Beat track preserved (manual edits)", true]);
    if (pipeline?.barTrackPreserved) checks.push(["Bars track preserved (manual edits)", true]);
    if (pipeline?.chordTrackPreserved) checks.push(["Chords track preserved (manual edits)", true]);
    if (pipeline?.lyricsTrackPreserved) checks.push(["Lyrics track preserved (manual edits)", true]);
    return checks.map(([label, ok]) => `${label}: ${ok ? "PASS" : "PENDING"}`);
  }

  function formatAudioAnalysisSummary({ analysis = null, pipeline = null, webValidation = null } = {}) {
    const a = analysis && typeof analysis === "object" ? analysis : {};
    const trackName = String(a?.trackName || basenameOfPath(state.audioPathInput || "") || "(none)");
    const fpTitle = String(a?.trackIdentity?.title || "").trim();
    const fpArtist = String(a?.trackIdentity?.artist || "").trim();
    const fpIsrc = String(a?.trackIdentity?.isrc || "").trim();
    const fingerprintMatch = fpTitle && fpArtist ? `${fpTitle} - ${fpArtist}` : "unavailable";
    const durationMs = Number(a?.media?.durationMs);
    const channels = Number(a?.media?.channels);
    const sampleRate = Number(a?.media?.sampleRate);
    const structure = Array.isArray(a?.structure) ? a.structure.filter(Boolean) : [];
    const tempoEstimate = a?.timing?.tempoEstimate;
    const timeSignature = String(a?.timing?.timeSignature || "unknown");
    const songContextLine = (Array.isArray(a?.summaryLines) ? a.summaryLines : [])
      .find((line) => String(line || "").toLowerCase().startsWith("song context:"));
    const songContext = songContextLine
      ? String(songContextLine).slice("Song context:".length).trim()
      : "pending";
    const tempoText = Number.isFinite(Number(tempoEstimate))
      ? `${Number(tempoEstimate)} BPM (inferred)`
      : (String(tempoEstimate || "").trim() || "pending");

    const lines = [
      `Audio source: ${trackName}`,
      `Fingerprint match: ${fingerprintMatch}`,
      `Fingerprint ISRC: ${fpIsrc || "unavailable"}`,
      `Media metadata: ${Number.isFinite(durationMs) ? `${Math.round(durationMs)}ms` : "duration pending"}, ${Number.isFinite(channels) ? `${channels}ch` : "ch?"}, ${Number.isFinite(sampleRate) ? `${sampleRate}Hz` : "rate?"}`,
      `Song structure: ${structure.length ? structure.join(", ") : "pending"}`,
      `Tempo/time signature: ${tempoText} / ${timeSignature}`,
      "Pipeline checks:"
    ];
    for (const row of buildAudioPipelineSummaryLines(pipeline || {})) lines.push(`- ${row}`);
    if (webValidation && typeof webValidation === "object") {
      if (webValidation.ignored) {
        if (webValidation.reason === "non-informational-sources") lines.push("Web validation: ignored (non-informational sources)");
        else if (webValidation.reason === "unverifiable-sources") lines.push("Web validation: ignored (sources not track-specific)");
        else if (webValidation.reason === "low-confidence") lines.push("Web validation: ignored (low-confidence web evidence)");
        else lines.push("Web validation: ignored (non-exact track match)");
        lines.push(`Song context: ${songContext || "pending"}`);
        return lines.join("\n");
      }
      const sig = String(webValidation.timeSignature || "unknown");
      const bpm = Number(webValidation.tempoBpm);
      const conf = String(webValidation.confidence || "low");
      const conflict = Boolean(webValidation.conflict);
      if (conflict) lines.push("Web validation: conflict with service result (see diagnostics)");
      else lines.push(`Web validation: ${sig}${Number.isFinite(bpm) ? `, ${bpm} BPM` : ""} (${conf})`);
    }
    lines.push(`Song context: ${songContext || "pending"}`);
    return lines.join("\n");
  }

  function buildAudioAnalysisStubSummary() {
    const analysis = analyzeAudioContext({
      audioPath: state.audioPathInput,
      sectionSuggestions: state.sectionSuggestions,
      sectionStartByLabel: state.sectionStartByLabel,
      timingTracks: state.timingTracks
    });
    return formatAudioAnalysisSummary({
      analysis,
      pipeline: state.audioAnalysis?.pipeline || null
    });
  }

  function audioTrackQueryFromPath(audioPath = "") {
    const raw = basenameOfPath(audioPath);
    const noExt = raw.replace(/\.[a-z0-9]+$/i, "");
    return noExt.replace(/^\s*\d+\s*/, "").replace(/\s+/g, " ").trim();
  }

  function isLikelyInformationalSourceUrl(url = "") {
    const s = String(url || "").trim().toLowerCase();
    if (!s) return false;
    return !(
      s.includes("open.spotify.com") ||
      s.includes("music.apple.com") ||
      s.includes("youtube.com") ||
      s.includes("youtu.be") ||
      s.includes("deezer.com") ||
      s.includes("tidal.com") ||
      s.includes("soundcloud.com") ||
      s.includes("amazon.com/music") ||
      s.includes("shazam.com") ||
      s.includes("audd.io") ||
      s.includes("musicnotes.com") ||
      s.includes("sheetmusicplus.com") ||
      s.includes("sheetmusicdirect.com") ||
      s.includes("ultimate-guitar.com") ||
      s.includes("chordify.net") ||
      s.includes("tabs.ultimate-guitar.com") ||
      s.includes("tunebat.com")
    );
  }

  function normalizeTrackTokens(text = "") {
    return String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, " ")
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 3);
  }

  function sourceLooksTrackSpecific(url = "", title = "", artist = "") {
    const s = String(url || "").toLowerCase();
    if (!s) return false;
    const titleTokens = normalizeTrackTokens(title).slice(0, 6);
    const artistTokens = normalizeTrackTokens(artist).slice(0, 4);
    const hasTitle = titleTokens.some((t) => s.includes(t));
    const hasArtist = artistTokens.some((t) => s.includes(t));
    return hasTitle && hasArtist;
  }

  function beatsPerBarFromSignature(sig = "") {
    const m = String(sig || "").trim().match(/^(\d+)\s*\/\s*(\d+)$/);
    if (!m) return 4;
    const n = Number(m[1]);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 4;
  }

  function inferLyricStanzaPlan(lyrics = [], durationMs = 0, trackTitleHint = "") {
    const rows = (Array.isArray(lyrics) ? lyrics : [])
      .map((r) => ({
        startMs: Math.max(0, Math.round(Number(r?.startMs || 0))),
        endMs: Math.max(0, Math.round(Number(r?.endMs || 0))),
        label: String(r?.label || "").trim()
      }))
      .filter((r) => Number.isFinite(r.startMs) && Number.isFinite(r.endMs) && r.endMs > r.startMs)
      .sort((a, b) => a.startMs - b.startMs);
    const totalMs = Math.max(1, Math.round(Number(durationMs || 0)));
    if (!rows.length) return { sections: [], lyricalIndices: [] };

    const gaps = [];
    for (let i = 1; i < rows.length; i += 1) {
      const gap = rows[i].startMs - rows[i - 1].endMs;
      if (gap > 0) gaps.push(gap);
    }
    let stanzaGapMs = 6000;
    if (gaps.length) {
      const sorted = [...gaps].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const med = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
      const p75 = sorted[Math.floor((sorted.length - 1) * 0.75)];
      stanzaGapMs = Math.max(2500, Math.min(12000, Math.round(Math.max(p75 * 1.35, med * 2.1))));
    }

    const MAX_LINES_PER_STANZA = 6;
    const MAX_STANZA_MS = 16000;
    const stanzas = [];
    let a = 0;
    for (let i = 1; i < rows.length; i += 1) {
      const gap = rows[i].startMs - rows[i - 1].endMs;
      const lineCount = i - a;
      const stanzaSpan = rows[i - 1].endMs - rows[a].startMs;
      const shouldBreak = gap >= stanzaGapMs || lineCount >= MAX_LINES_PER_STANZA || stanzaSpan >= MAX_STANZA_MS;
      if (shouldBreak) {
        stanzas.push([a, i]);
        a = i;
      }
    }
    stanzas.push([a, rows.length]);

    const normalize = (text = "") => String(text || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
    const titleNorm = normalize(trackTitleHint);
    const shouldUseTitle = titleNorm.length >= 8;
    const refined = [];
    let titleAwareSplits = 0;
    for (const stanza of stanzas) {
      const [sIdx, eIdx] = stanza;
      const lineCount = Math.max(0, eIdx - sIdx);
      if (lineCount < 5) {
        refined.push(stanza);
        continue;
      }
      let splitAt = -1;
      if (shouldUseTitle) {
        const hitOffsets = [];
        for (let k = sIdx; k < eIdx; k += 1) {
          const lineNorm = normalize(rows[k]?.label || "");
          if (lineNorm && lineNorm.includes(titleNorm)) hitOffsets.push(k - sIdx);
        }
        if (hitOffsets.length >= 2) {
          const firstHit = hitOffsets[0];
          const linesAfter = lineCount - firstHit;
          if (firstHit >= 2 && linesAfter >= 2) splitAt = sIdx + firstHit;
        }
      }
      if (splitAt < 0) {
        const seen = new Map();
        for (let k = sIdx; k < eIdx; k += 1) {
          const lineNorm = normalize(rows[k]?.label || "");
          if (!lineNorm) continue;
          const prev = seen.get(lineNorm);
          if (Number.isInteger(prev)) {
            const offset = k - sIdx;
            const linesAfter = lineCount - offset;
            if (offset >= 2 && linesAfter >= 2) {
              splitAt = k;
              break;
            }
          } else {
            seen.set(lineNorm, k);
          }
        }
      }
      if (splitAt > sIdx && splitAt < eIdx) {
        refined.push([sIdx, splitAt], [splitAt, eIdx]);
        titleAwareSplits += 1;
      } else {
        refined.push(stanza);
      }
    }

    const sections = [];
    const lyricalIndices = [];
    const firstStart = rows[0].startMs;
    if (firstStart > 500) sections.push({ startMs: 0, endMs: firstStart, label: "Intro" });
    let prevEnd = firstStart;
    for (const [sIdx, eIdx] of refined) {
      const startMs = rows[sIdx].startMs;
      const endMs = rows[eIdx - 1].endMs;
      if (startMs - prevEnd >= stanzaGapMs) sections.push({ startMs: prevEnd, endMs: startMs, label: "Instrumental" });
      lyricalIndices.push(sections.length);
      sections.push({ startMs, endMs, label: "Lyrical" });
      prevEnd = endMs;
    }
    if (totalMs - prevEnd >= 500) {
      const tailLabel = (totalMs - prevEnd) <= Math.max(12000, stanzaGapMs * 2) ? "Outro" : "Instrumental";
      sections.push({ startMs: prevEnd, endMs: totalMs, label: tailLabel });
    }
    return { sections, lyricalIndices, titleAwareSplits };
  }

  function buildSectionLyricContextRows(sections = [], lyrics = [], lyricalIndices = []) {
    const sec = Array.isArray(sections) ? sections : [];
    const lyr = Array.isArray(lyrics) ? lyrics : [];
    const allow = new Set(Array.isArray(lyricalIndices) ? lyricalIndices : []);
    return sec.map((s, idx) => {
      if (!allow.has(idx)) return null;
      const startMs = Math.max(0, Math.round(Number(s?.startMs || 0)));
      const endMs = Math.max(startMs + 1, Math.round(Number(s?.endMs || (startMs + 1))));
      const lines = lyr.filter((row) => {
        const t = Number(row?.startMs);
        return Number.isFinite(t) && t >= startMs && t < endMs;
      }).slice(0, 14).map((row) => String(row?.label || "").trim()).filter(Boolean);
      return { index: idx, lineCount: lines.length, stanzaText: lines.join(" | ") };
    }).filter(Boolean);
  }

  function normalizeLyricLineForPattern(line = "") {
    return String(line || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  }

  function countSharedNormalizedLines(aLines = [], bLines = []) {
    const a = new Set((Array.isArray(aLines) ? aLines : []).map(normalizeLyricLineForPattern).filter(Boolean));
    const b = new Set((Array.isArray(bLines) ? bLines : []).map(normalizeLyricLineForPattern).filter(Boolean));
    if (!a.size || !b.size) return 0;
    let n = 0;
    for (const line of a) if (b.has(line)) n += 1;
    return n;
  }

  function parseChordLabelBasic(label = "") {
    const raw = String(label || "").trim();
    if (!raw || raw.toUpperCase() === "N") return null;
    const normalized = raw.replace(":", "");
    const match = normalized.match(/^([A-G](?:#|b)?)(.*)$/i);
    if (!match) return null;
    const root = String(match[1] || "").trim();
    const qualityRaw = String(match[2] || "").trim().toLowerCase();
    const rootPcMap = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
    const rootPc = rootPcMap[root];
    if (!Number.isFinite(rootPc)) return null;
    const isMinor = qualityRaw.startsWith("m") || qualityRaw.startsWith("min") || qualityRaw.includes("minor");
    const quality = isMinor ? "m" : "M";
    return { root, rootPc, quality, normalized: `${root}${quality === 'm' ? 'm' : ''}` };
  }

  function buildRelativeChordToken(chord, tonicPc) {
    if (!chord || !Number.isFinite(tonicPc)) return "";
    const rel = ((Number(chord.rootPc) - Number(tonicPc)) % 12 + 12) % 12;
    return `${rel}${chord.quality || 'M'}`;
  }

  function buildSectionChordContextRows(sections = [], chords = [], lyricalIndices = []) {
    const sec = Array.isArray(sections) ? sections : [];
    const rows = Array.isArray(chords) ? chords : [];
    const allow = new Set(Array.isArray(lyricalIndices) ? lyricalIndices : []);
    return sec.map((s, idx) => {
      if (!allow.has(idx)) return null;
      const startMs = Math.max(0, Math.round(Number(s?.startMs || 0)));
      const endMs = Math.max(startMs + 1, Math.round(Number(s?.endMs || (startMs + 1))));
      const overlapping = rows.map((row) => {
        const rs = Number(row?.startMs);
        const reRaw = Number(row?.endMs);
        const re = Number.isFinite(reRaw) ? reRaw : rs + 1;
        if (!Number.isFinite(rs) || !Number.isFinite(re)) return null;
        const os = Math.max(startMs, Math.round(rs));
        const oe = Math.min(endMs, Math.round(re));
        const dur = Math.max(0, oe - os);
        if (dur <= 0) return null;
        const parsed = parseChordLabelBasic(String(row?.label || ""));
        if (!parsed) return null;
        return { ...parsed, startMs: os, endMs: oe, durMs: dur };
      }).filter(Boolean).sort((a, b) => Number(a.startMs) - Number(b.startMs));
      const MIN_CHORD_MS = 180;
      const filtered = overlapping.filter((row) => Number(row?.durMs || 0) >= MIN_CHORD_MS);
      const active = filtered.length ? filtered : overlapping;
      const collapsed = [];
      for (const row of active) {
        const prev = collapsed[collapsed.length - 1];
        if (!prev || prev.normalized !== row.normalized) collapsed.push({ ...row });
        else { prev.endMs = row.endMs; prev.durMs += row.durMs; }
      }
      const byLabel = new Map();
      for (const row of collapsed) byLabel.set(row.normalized, (byLabel.get(row.normalized) || 0) + Number(row.durMs || 0));
      const dominant = [...byLabel.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
      const dominantParsed = parseChordLabelBasic(dominant);
      const tonicPc = Number.isFinite(dominantParsed?.rootPc) ? dominantParsed.rootPc : collapsed[0]?.rootPc;
      const progressionAbs = collapsed.map((row) => row.normalized);
      const progressionRel = collapsed.map((row) => buildRelativeChordToken(row, tonicPc)).filter(Boolean);
      const changes = Math.max(0, collapsed.length - 1);
      const sectionMs = Math.max(1, endMs - startMs);
      const changesPerMinute = Number((changes / (sectionMs / 60000)).toFixed(2));
      const cadence = progressionRel.slice(-3).join("->");
      const chordSeconds = Number((active.reduce((sum, row) => sum + Number(row?.durMs || 0), 0) / 1000).toFixed(2));
      return {
        index: idx,
        chordCount: active.length,
        chordSetSize: new Set(progressionAbs).size,
        progression: progressionAbs.slice(0, 10).join("->"),
        progressionRelative: progressionRel.slice(0, 10).join("->"),
        cadenceRelative: cadence,
        dominantChord: dominant || "",
        harmonicRhythmCpm: changesPerMinute,
        chordSeconds
      };
    }).filter(Boolean);
  }

  function progressionSimilarityScore(a = "", b = "") {
    const left = String(a || "").split("->").map((x) => x.trim()).filter(Boolean);
    const right = String(b || "").split("->").map((x) => x.trim()).filter(Boolean);
    if (!left.length || !right.length) return 0;
    const leftSet = new Set(left);
    const rightSet = new Set(right);
    const inter = [...leftSet].filter((tok) => rightSet.has(tok)).length;
    const union = new Set([...leftSet, ...rightSet]).size;
    if (!union) return 0;
    return Number((inter / union).toFixed(3));
  }

  function buildSongStructureEvidence(ctxRows = [], chordRows = [], trackIdentity = null, trackTitleHint = "") {
    const rows = Array.isArray(ctxRows) ? ctxRows : [];
    if (!rows.length) return [];
    const chordByIndex = new Map((Array.isArray(chordRows) ? chordRows : []).map((r) => [Number(r?.index), r]));
    const effectiveTitle = String(trackIdentity?.title || "").trim() || String(trackTitleHint || "").trim();
    const titlePhrase = normalizeLyricLineForPattern(effectiveTitle);
    const titleTokens = new Set(effectiveTitle.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).map((t) => t.trim()).filter((t) => t.length >= 3));
    const globalLineFreq = new Map();
    const rowLinesNormalized = rows.map((row) => String(row?.stanzaText || "").split("|").map((s) => normalizeLyricLineForPattern(s)).filter(Boolean));
    for (const line of rowLinesNormalized.flat()) globalLineFreq.set(line, (globalLineFreq.get(line) || 0) + 1);
    const seenLineSet = new Set();
    const seenProgressions = new Set();
    let prevProgression = "";
    const base = rows.map((row, idx) => {
      const text = String(row?.stanzaText || "").toLowerCase();
      const lines = text.split("|").map((s) => s.trim()).filter(Boolean);
      const normLines = rowLinesNormalized[idx] || [];
      const lineSet = new Set(lines);
      let repeatedLines = 0;
      for (const line of lineSet) if (seenLineSet.has(line)) repeatedLines += 1;
      for (const line of lineSet) seenLineSet.add(line);
      const tokens = text.replace(/[^a-z0-9\s]/g, " ").split(/\s+/).map((t) => t.trim()).filter(Boolean);
      let titleHits = 0;
      for (const token of tokens) if (titleTokens.has(token)) titleHits += 1;
      const tokenSet = new Set(tokens);
      const uniqueTokenRatio = tokenSet.size > 0 ? Number((tokenSet.size / Math.max(1, tokens.length)).toFixed(3)) : 0;
      const repeatedLineRatio = lineSet.size > 0 ? Number((repeatedLines / lineSet.size).toFixed(3)) : 0;
      const titleTokenRatio = titleTokens.size > 0 ? Number((titleHits / Math.max(1, tokens.length)).toFixed(3)) : 0;
      const titleLineHits = titlePhrase ? normLines.reduce((n, line) => n + (line.includes(titlePhrase) ? 1 : 0), 0) : 0;
      const titleLineRatio = normLines.length ? Number((titleLineHits / normLines.length).toFixed(3)) : 0;
      const globallyRepeatedLines = normLines.filter((line) => (globalLineFreq.get(line) || 0) >= 2).length;
      const globallyRepeatedLineRatio = normLines.length ? Number((globallyRepeatedLines / normLines.length).toFixed(3)) : 0;
      let maxLineOverlapWithAny = 0;
      for (let j = 0; j < rowLinesNormalized.length; j += 1) {
        if (j === idx) continue;
        maxLineOverlapWithAny = Math.max(maxLineOverlapWithAny, countSharedNormalizedLines(normLines, rowLinesNormalized[j] || []));
      }
      const chord = chordByIndex.get(Number(row?.index ?? idx)) || {};
      const progression = String(chord?.progression || "").trim();
      const progressionRelative = String(chord?.progressionRelative || "").trim();
      const progressionKey = progressionRelative || progression;
      const progressionSeenBefore = Boolean(progressionKey) && seenProgressions.has(progressionKey);
      if (progressionKey) seenProgressions.add(progressionKey);
      const progressionSimilarityToPrev = progressionSimilarityScore(progressionKey, prevProgression);
      prevProgression = progressionKey;
      return {
        index: Number(row?.index ?? idx),
        lineCount: Number(row?.lineCount || lines.length || 0),
        repeatedLineRatio,
        uniqueTokenRatio,
        titleTokenRatio,
        titleLineHits,
        titleLineRatio,
        globallyRepeatedLineRatio,
        maxLineOverlapWithAny,
        chordCount: Number(chord?.chordCount || 0),
        chordSetSize: Number(chord?.chordSetSize || 0),
        progression,
        progressionRelative,
        cadenceRelative: String(chord?.cadenceRelative || "").trim(),
        dominantChord: String(chord?.dominantChord || "").trim(),
        harmonicRhythmCpm: Number(chord?.harmonicRhythmCpm || 0),
        chordSeconds: Number(chord?.chordSeconds || 0),
        progressionSeenBefore,
        progressionSimilarityToPrev
      };
    });
    return base.map((row, idx) => {
      const prev = base[idx - 1] || null;
      const next = base[idx + 1] || null;
      const nextChorusLike = Boolean(next && (Number(next.titleLineRatio || 0) >= 0.2 || Number(next.globallyRepeatedLineRatio || 0) >= 0.4 || Number(next.repeatedLineRatio || 0) >= 0.35));
      const prevVerseLike = Boolean(prev && (Number(prev.uniqueTokenRatio || 0) >= 0.72 && Number(prev.titleLineRatio || 0) <= 0.15));
      return {
        ...row,
        nextTitleLineRatio: next ? Number(next.titleLineRatio || 0) : 0,
        nextGloballyRepeatedLineRatio: next ? Number(next.globallyRepeatedLineRatio || 0) : 0,
        nextRepeatedLineRatio: next ? Number(next.repeatedLineRatio || 0) : 0,
        nextLikelyChorus: nextChorusLike,
        prevLikelyVerse: prevVerseLike,
        transitionToHookScore: Number((((next ? Number(next.titleLineRatio || 0) * 0.5 : 0) + (next ? Number(next.globallyRepeatedLineRatio || 0) * 0.35 : 0) + (next ? Number(next.repeatedLineRatio || 0) * 0.15 : 0)).toFixed(3)))
      };
    });
  }

  function meanNumber(rows = [], key = "") {
    const vals = (Array.isArray(rows) ? rows : []).map((r) => Number(r?.[key])).filter((n) => Number.isFinite(n));
    if (!vals.length) return 0;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  function corpusSongProfile(song = {}) {
    const stanzas = Array.isArray(song?.stanzas) ? song.stanzas : [];
    if (!stanzas.length) return null;
    const labels = stanzas.map((s) => String(s?.draftLabel || "").trim());
    const chorusCount = labels.filter((l) => l.toLowerCase() === "chorus").length;
    const verseCount = labels.filter((l) => l.toLowerCase() === "verse").length;
    const avgRepeat = meanNumber(stanzas, "globallyRepeatedLineRatio");
    const avgTitleRatio = meanNumber(stanzas, "titleLineRatio");
    const avgLineCount = meanNumber(stanzas.map((s) => ({ lineCount: Array.isArray(s?.lines) ? s.lines.length : 0 })), "lineCount");
    return { stanzaCount: stanzas.length, chorusCount, verseCount, chorusRatio: stanzas.length ? chorusCount / stanzas.length : 0, avgRepeat, avgTitleRatio, avgLineCount };
  }

  function selectFewShotFromCorpus({ corpusSongs = [], structureEvidence = [], trackTitle = "", maxExamples = 3 } = {}) {
    const songs = Array.isArray(corpusSongs) ? corpusSongs : [];
    if (!songs.length) return [];
    const currentProfile = {
      stanzaCount: (Array.isArray(structureEvidence) ? structureEvidence : []).length,
      chorusRatio: meanNumber((Array.isArray(structureEvidence) ? structureEvidence : []).map((r) => ({ chorusLike: (Number(r?.titleLineRatio || 0) >= 0.2 || Number(r?.globallyRepeatedLineRatio || 0) >= 0.4) ? 1 : 0 })), "chorusLike"),
      avgRepeat: meanNumber(structureEvidence, "repeatedLineRatio"),
      avgTitleRatio: meanNumber(structureEvidence, "titleLineRatio"),
      avgLineCount: meanNumber(structureEvidence, "lineCount")
    };
    const tNorm = String(trackTitle || "").trim().toLowerCase();
    const candidates = [];
    for (const song of songs) {
      const profile = corpusSongProfile(song);
      if (!profile || profile.stanzaCount < 3 || profile.chorusCount < 1 || profile.verseCount < 1) continue;
      const sTitle = String(song?.title || "").trim();
      if (tNorm && sTitle.toLowerCase() === tNorm) continue;
      const dist =
        Math.abs(profile.chorusRatio - currentProfile.chorusRatio) * 1.8 +
        Math.abs(profile.avgRepeat - currentProfile.avgRepeat) * 2.0 +
        Math.abs(profile.avgTitleRatio - currentProfile.avgTitleRatio) * 1.6 +
        Math.abs(profile.avgLineCount - currentProfile.avgLineCount) * 0.2 +
        Math.abs(profile.stanzaCount - currentProfile.stanzaCount) * 0.15;
      candidates.push({ song, profile, dist });
    }
    candidates.sort((a, b) => a.dist - b.dist);
    return candidates.slice(0, Math.max(0, maxExamples)).map((c) => {
      const stanzas = Array.isArray(c.song?.stanzas) ? c.song.stanzas : [];
      return {
        track: `${String(c.song?.title || "").trim()} - ${String(c.song?.artist || "").trim()}`.trim(),
        lyricsSource: String(c.song?.lyricsSource || "").trim(),
        stanzaCount: stanzas.length,
        labels: stanzas.map((s) => String(s?.draftLabel || "").trim() || "Verse"),
        stanzas: stanzas.slice(0, 8).map((s, idx) => ({ index: Number(s?.index ?? idx), label: String(s?.draftLabel || "").trim() || "Verse", text: String(s?.text || "").trim().slice(0, 220) })),
        profile: { chorusRatio: Number(c.profile.chorusRatio.toFixed(3)), avgRepeat: Number(c.profile.avgRepeat.toFixed(3)), avgTitleRatio: Number(c.profile.avgTitleRatio.toFixed(3)) }
      };
    });
  }

  function extractFirstJsonObject(text = "") {
    const src = String(text || "");
    const start = src.indexOf("{");
    if (start < 0) return null;
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = start; i < src.length; i += 1) {
      const ch = src[i];
      if (inString) {
        if (escape) escape = false;
        else if (ch === "\\") escape = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') { inString = true; continue; }
      if (ch === "{") depth += 1;
      else if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          try { return JSON.parse(src.slice(start, i + 1)); } catch { return null; }
        }
      }
    }
    return null;
  }

  function normalizeSectionLabelBase(label = "") {
    const raw = String(label || "").trim();
    if (!raw) return "Section";
    const noSuffix = raw.replace(/\s+\d+$/, "").trim();
    return noSuffix || "Section";
  }

  function buildNumberedSectionLabels(labels = []) {
    const base = (Array.isArray(labels) ? labels : []).map((l) => normalizeSectionLabelBase(l));
    const totals = new Map();
    for (const b of base) totals.set(b, (totals.get(b) || 0) + 1);
    const counts = new Map();
    return base.map((b) => {
      const next = (counts.get(b) || 0) + 1;
      counts.set(b, next);
      return (totals.get(b) || 0) > 1 ? `${b} ${next}` : b;
    });
  }

  function parseLlmSectionLabelResult(text = "", expectedCount = 0) {
    const parsed = extractFirstJsonObject(text);
    if (!parsed || typeof parsed !== "object") return null;
    const rows = Array.isArray(parsed.sections) ? parsed.sections : [];
    if (!rows.length) return null;
    const labels = new Array(expectedCount).fill("");
    for (const row of rows) {
      const idx = Number(row?.index);
      const label = normalizeSectionLabelBase(String(row?.label || ""));
      if (!Number.isInteger(idx) || idx < 0 || idx >= expectedCount) continue;
      if (!label || label === "Section") continue;
      labels[idx] = label;
    }
    if (!labels.some(Boolean)) return null;
    return { labels, confidence: String(parsed.confidence || "").trim().toLowerCase(), rationale: String(parsed.rationale || "").trim() };
  }

  async function runSongContextResearch({ audioPath = "", sections = [], trackIdentity = null } = {}) {
    const bridge = getDesktopAgentConversationBridge();
    if (!bridge) return "";
    const tTitle = String(trackIdentity?.title || "").trim();
    const tArtist = String(trackIdentity?.artist || "").trim();
    const tIsrc = String(trackIdentity?.isrc || "").trim();
    const trackQuery = tTitle && tArtist ? `${tTitle} - ${tArtist}` : audioTrackQueryFromPath(audioPath);
    if (!trackQuery) return "";
    try {
      const userMessage = [
        `Research this exact track and return strict JSON only: ${trackQuery}.`,
        tIsrc ? `ISRC: ${tIsrc}` : "ISRC: unavailable",
        "Use informational sources (articles/reference/music analysis) and avoid streaming/catalog pages.",
        "If uncertain, reduce confidence and explain briefly.",
        "JSON keys only:",
        "- summary (single concise sentence, <=45 words)",
        "- styleEra (short phrase)",
        "- moodTheme (short phrase)",
        "- sequencingImplication (short phrase)",
        "- confidence (high|medium|low)",
        "- rationale (1 sentence)",
        "- sources (array of 1-3 URLs)"
      ].join("\n");
      const res = await bridge.runAgentConversation({
        userMessage,
        messages: [],
        context: { purpose: "song-context-research", sequenceName: state.activeSequence || "", sections: Array.isArray(sections) ? sections.slice(0, 12) : [] }
      });
      if (!res?.ok) return null;
      const parsed = extractFirstJsonObject(res.assistantMessage || "");
      if (!parsed || typeof parsed !== "object") return null;
      const sources = Array.isArray(parsed.sources) ? parsed.sources.map((s) => String(s || "").trim()).filter(Boolean).slice(0, 3) : [];
      const informativeSources = sources.filter((url) => isLikelyInformationalSourceUrl(url));
      const confidence = String(parsed.confidence || "").trim().toLowerCase();
      return {
        summary: String(parsed.summary || "").trim(),
        styleEra: String(parsed.styleEra || "").trim(),
        moodTheme: String(parsed.moodTheme || "").trim(),
        sequencingImplication: String(parsed.sequencingImplication || "").trim(),
        confidence: ["high", "medium", "low"].includes(confidence) ? confidence : "low",
        rationale: String(parsed.rationale || "").trim(),
        sources: informativeSources
      };
    } catch {
      return null;
    }
  }

  async function relabelSectionsWithLlm({ sections = [], lyrics = [], chords = [], lyricalIndices = [], trackIdentity = null, trackTitleHint = "", userManualStructureHint = null, timeSignature = "", tempoBpm = null } = {}) {
    const bridge = getDesktopAgentConversationBridge();
    const sec = Array.isArray(sections) ? sections : [];
    if (!bridge || !sec.length) return null;
    const targetIdx = Array.isArray(lyricalIndices) ? lyricalIndices.filter((i) => Number.isInteger(i) && i >= 0 && i < sec.length) : [];
    if (!targetIdx.length) return null;
    const ctxRows = buildSectionLyricContextRows(sec, lyrics, targetIdx);
    if (!ctxRows.length) return null;
    const chordRows = buildSectionChordContextRows(sec, chords, targetIdx);
    const structureEvidence = buildSongStructureEvidence(ctxRows, chordRows, trackIdentity, trackTitleHint);
    try {
      const pkgBundle = await loadAudioTrainingPackageBundle();
      const tTitle = String(trackIdentity?.title || "").trim() || String(trackTitleHint || "").trim();
      const tArtist = String(trackIdentity?.artist || "").trim();
      const trackName = tTitle && tArtist ? `${tTitle} - ${tArtist}` : (tTitle || "unknown track");
      const fewShotExamples = pkgBundle?.ok
        ? selectFewShotFromCorpus({ corpusSongs: pkgBundle.corpusSongs, structureEvidence, trackTitle: tTitle, maxExamples: 3 })
        : [];
      const packagedInstruction = pkgBundle?.ok ? String(pkgBundle.combinedPromptText || "").trim() : "";
      const fallbackInstruction = [
        "Interpret lyrical structure from stanza text first, then assign labels to stanza indices.",
        "Do not use timing cues for structure inference; use language/content and repetition patterns.",
        "Do not change stanza count. Output strict JSON only.",
        "Use this songwriting-structure rubric (compiled from Open Music Theory + NSAI songwriting guidance):",
        "- Verse: lyric-variant, advances story/details, less exact repetition.",
        "- Chorus/Refrain: lyric-invariant or highly repeated hook/title idea, emotional center, often same core words each return.",
        "- Pre-Chorus: short transitional stanza that increases tension and points into a chorus.",
        "- Pre-Chorus should usually have weaker title/hook repetition than the following Chorus.",
        "- Do not label the opening hook-heavy lyrical stanza as Pre-Chorus when it already carries the main recurring title phrase.",
        "- Post-Chorus/Hook: short tag after chorus reinforcing hook phrase.",
        "- Bridge: contrasting lyrical perspective/material, typically appears once, usually late song.",
        "- Intro/Outro/Instrumental: use only when stanza text indicates no active lyric narrative/hook content.",
        "- Refrain is usually a repeated line within a verse-like block; Chorus is a full recurring section.",
        "- If a stanza pivots from narrative lines into repeated title/hook lines, bias that hook-heavy portion toward Chorus.",
        "- If boundaries are coarse and cannot split internally, label the stanza containing recurring title/hook lines as Chorus when that hook reappears in later stanzas.",
        "- If exact title phrase appears in multiple lines of a stanza and reappears later, strongly prefer Chorus over Verse.",
        "Common cycle expectations in verse-chorus songs:",
        "- Verse -> (Pre-Chorus) -> Chorus -> (Post-Chorus), repeated.",
        "- Bridge usually before a final chorus return.",
        "Prioritize semantic/language evidence over pattern-only guesses when they conflict.",
        "Use stanza evidence metrics:",
        "- Higher repeatedLineRatio + titleTokenRatio suggests Chorus/Refrain.",
        "- High titleLineRatio or titleLineHits is strong Chorus/Refrain evidence.",
        "- High globallyRepeatedLineRatio or maxLineOverlapWithAny indicates repeated hook content (often Chorus/Refrain).",
        "- High nextLikelyChorus or transitionToHookScore suggests current stanza may be Pre-Chorus rather than Verse.",
        "- Higher uniqueTokenRatio with lower repetition suggests Verse.",
        "- A single high-novelty late section can indicate Bridge.",
        "- If title words recur in multiple stanzas, weight those stanzas toward Chorus/Refrain.",
        "- When uncertain between Verse vs Chorus, prefer Chorus if title/hook lines recur across 2+ stanzas.",
        "- Repeated relative chord progression/cadence across non-adjacent stanzas supports Chorus/Refrain.",
        "- High lyric novelty plus harmonic change (new progression, different cadence, different harmonic rhythm) can indicate Verse or Bridge.",
        "- Use progressionRelative and cadenceRelative more than absolute chord names for repetition checks.",
        "- progressionSimilarityToPrev near 1.0 suggests neighboring stanzas may be the same section type.",
        "Avoid one-label collapse unless evidence strongly supports it."
      ].join("\n");
      const instructionBlock = packagedInstruction || fallbackInstruction;
      const prompt = [
        instructionBlock,
        `Track: ${trackName}`,
        `Song title hint: ${tTitle || "unavailable"}`,
        `Tempo/time signature hint: ${Number.isFinite(Number(tempoBpm)) ? `${tempoBpm} BPM` : "unknown BPM"} / ${String(timeSignature || "unknown")}`,
        userManualStructureHint && typeof userManualStructureHint === "object"
          ? `User manual structure reference (authoritative when present): ${JSON.stringify(userManualStructureHint)}`
          : "User manual structure reference: none",
        "Allowed labels: Intro, Verse, Chorus, Pre-Chorus, Post-Chorus, Bridge, Instrumental, Outro, Refrain, Hook, Solo, Interlude, Breakdown, Tag.",
        "Return JSON with keys:",
        "- sections: array of {index:number,label:string} matching provided indices",
        "- confidence: high|medium|low",
        "- rationale: one short sentence",
        fewShotExamples.length ? `Few-shot reference examples (weakly supervised corpus, use as soft guidance not strict truth): ${JSON.stringify(fewShotExamples)}` : "Few-shot reference examples: none",
        `Stanza sequence data: ${JSON.stringify(ctxRows)}`,
        `Stanza chord data: ${JSON.stringify(chordRows)}`,
        `Stanza evidence data: ${JSON.stringify(structureEvidence)}`
      ].join("\n");
      const res = await bridge.runAgentConversation({ userMessage: prompt, messages: [], context: { purpose: "lyrics-section-labeling", sequenceName: state.activeSequence || "" } });
      if (!res?.ok) return null;
      const parsed = parseLlmSectionLabelResult(res.assistantMessage || "", sec.length);
      if (!parsed) return null;
      const rawLabels = parsed.labels.slice();
      const mergedBase = sec.map((s, i) => {
        const cur = normalizeSectionLabelBase(String(s?.label || ""));
        if (cur === "Lyrical") return rawLabels[i] || "Verse";
        return cur;
      });
      const numbered = buildNumberedSectionLabels(mergedBase);
      const relabeled = sec.map((s, i) => ({ ...s, label: numbered[i] || String(s?.label || "") }));
      return {
        sections: relabeled,
        confidence: parsed.confidence,
        rationale: parsed.rationale,
        trainingPackage: pkgBundle?.ok ? {
          packageId: String(pkgBundle.packageId || "").trim(),
          packageVersion: String(pkgBundle.packageVersion || "").trim(),
          moduleId: String(pkgBundle.moduleId || "").trim(),
          moduleVersion: String(pkgBundle.moduleVersion || "").trim(),
          promptPaths: Array.isArray(pkgBundle.promptPaths) ? pkgBundle.promptPaths : [],
          fewShotCount: fewShotExamples.length
        } : null,
        trainingPackageError: pkgBundle?.ok ? "" : String(pkgBundle?.error || "").trim()
      };
    } catch {
      return null;
    }
  }

  function buildWebValidationFromServiceEvidence({ evidence = null, trackIdentity = null } = {}) {
    if (!evidence || typeof evidence !== "object") return null;
    const sourceBpmValues = extractNumericCandidates(evidence.bpmValues).slice(0, 8);
    const sourceBarsValues = extractNumericCandidates(evidence.barsPerMinuteValues).slice(0, 8);
    const signatures = Array.isArray(evidence.timeSignatures) ? evidence.timeSignatures.map((s) => String(s || "").trim()).filter(Boolean) : [];
    const timeSignature = signatures.find((sig) => /^\d+\s*\/\s*\d+$/.test(sig)) || "unknown";
    const chosenBeatRaw = Number(evidence.chosenBeatBpm);
    const chosenBeatBpm = Number.isFinite(chosenBeatRaw) && chosenBeatRaw > 0 ? chosenBeatRaw : null;
    const tempoBpm = chosenBeatBpm != null ? chosenBeatBpm : medianNumber(sourceBpmValues.filter((n) => Number.isFinite(n) && n > 0));
    const sources = Array.isArray(evidence.sources) ? evidence.sources.map((s) => String(s || "").trim()).filter(Boolean).slice(0, 3) : [];
    if (!sources.length && !Number.isFinite(tempoBpm)) return null;
    const title = String(trackIdentity?.title || "").trim();
    const artist = String(trackIdentity?.artist || "").trim();
    const confidence = (sources.length > 0 && Number.isFinite(Number(tempoBpm))) ? "high" : (sources.length > 0 || Number.isFinite(Number(tempoBpm))) ? "medium" : "low";
    return {
      timeSignature,
      tempoBpm: Number.isFinite(Number(tempoBpm)) ? Number(tempoBpm) : null,
      confidence,
      rationale: "Deterministic BPM/time-signature evidence parsed from songbpm/getsongbpm.",
      alternates: [],
      sourceBpmValues,
      sourceBarsValues,
      chosenBeatBpm,
      matchedTitle: title,
      matchedArtist: artist,
      exactMatch: Boolean(title && artist),
      sources
    };
  }

  async function runSongContextWebFallback(audioPath = "") {
    const query = audioTrackQueryFromPath(audioPath);
    if (!query) return "";
    try {
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=3`;
      const res = await fetch(url);
      if (!res.ok) return "";
      const body = await res.json();
      const rows = Array.isArray(body?.results) ? body.results : [];
      if (!rows.length) return "";
      const top = rows[0];
      const artist = String(top?.artistName || "").trim();
      const track = String(top?.trackName || "").trim();
      const genre = String(top?.primaryGenreName || "").trim();
      const date = String(top?.releaseDate || "").trim();
      const year = date ? date.slice(0, 4) : "";
      const parts = [];
      if (track || artist) parts.push(`${track || query}${artist ? ` by ${artist}` : ""}`);
      if (genre) parts.push(`genre: ${genre}`);
      if (year) parts.push(`release: ${year}`);
      return parts.join(" | ");
    } catch {
      return "";
    }
  }

  function shouldEscalateAudioAnalysisProfile(report = {}) {
    const issues = Array.isArray(report?.topLevelIssues) ? report.topLevelIssues : [];
    const readiness = report?.readiness?.minimumContract || {};
    return Boolean(
      readiness.semanticSongStructurePresent === false ||
      issues.includes("generic_structure_labels_present") ||
      issues.includes("rhythm_provider_time_signature_disagreement") ||
      issues.includes("rhythm_provider_bar_grouping_disagreement")
    );
  }

  async function runAudioAnalysisPipeline({ analysisProfile = null, metadataPromptAttempted = false, disableInteractivePrompts = false } = {}) {
    const resolvedProvider = "librosa";
    const baseArgs = {
      audioPath: String(state.audioPathInput || "").trim(),
      analysisService: {
        baseUrl: String(state.ui.analysisServiceUrlDraft || "").trim().replace(/\/+$/, ""),
        provider: resolvedProvider,
        apiKey: String(state.ui.analysisServiceApiKeyDraft || "").trim(),
        authBearer: String(state.ui.analysisServiceAuthBearerDraft || "").trim()
      },
      analysisBridge: getDesktopAudioAnalysisBridge(),
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
      initialSectionSuggestions: state.sectionSuggestions || [],
      initialSectionStartByLabel: state.sectionStartByLabel || {},
      onProgress: ({ stage, message } = {}) => {
        setAudioAnalysisProgress(state.audioAnalysis, { stage, message });
        render();
      }
    };
    const requestedProfile = analysisProfile && typeof analysisProfile === "object" ? analysisProfile : { mode: "fast", allowEscalation: true };
    let out = await runAudioAnalysisOrchestration({ ...baseArgs, analysisProfile: requestedProfile });
    if (requestedProfile.mode === "fast" && requestedProfile.allowEscalation !== false) {
      const fastArtifact = buildAnalysisArtifactFromPipelineResult({
        audioPath: String(state.audioPathInput || "").trim(),
        result: out,
        requestedProvider: resolvedProvider,
        analysisBaseUrl: String(state.ui.analysisServiceUrlDraft || "").trim().replace(/\/+$/, "")
      });
      const fastReport = buildAudioAnalysisQualityReport(fastArtifact);
      const shouldEscalate = shouldEscalateAudioAnalysisProfile(fastReport);
      if (shouldEscalate) {
        const metadataPrompt = await maybePromptForMissingIdentityMetadata({
          audioPath: String(state.audioPathInput || "").trim(),
          artifact: fastArtifact,
          promptAttempted: metadataPromptAttempted,
          disableInteractivePrompts
        });
        if (metadataPrompt?.retagged) {
          setAudioAnalysisProgress(state.audioAnalysis, { stage: "identity_metadata_updated", message: "Applied user-supplied metadata and restarting analysis." });
          render();
          return runAudioAnalysisPipeline({ analysisProfile, metadataPromptAttempted: true, disableInteractivePrompts });
        }
        setAudioAnalysisProgress(state.audioAnalysis, { stage: "deep_analysis_escalation", message: "Fast analysis found weak structure or rhythm confidence. Escalating to deep analysis." });
        render();
        out = await runAudioAnalysisOrchestration({ ...baseArgs, analysisProfile: { mode: "deep", allowEscalation: false }, cachedModules: isPlainObject(fastArtifact?.modules) ? fastArtifact.modules : null });
      }
    }
    if (Array.isArray(out.sectionSuggestions) && out.sectionSuggestions.length) {
      state.ui.sectionTrackName = out.sectionTrackName || "Analysis: Song Structure";
      state.sectionSuggestions = out.sectionSuggestions;
      state.sectionStartByLabel = out.sectionStartByLabel || {};
    }
    return out;
  }

  function startAudioAnalysisProgressTicker() {
    const timeline = [
      { stage: "service_request", message: "Submitting the selected track to the Librosa analysis backend." },
      { stage: "timing_analysis", message: "Analyzing beat and bar timing with Librosa." },
      { stage: "structure_derivation", message: "Deriving song sections from timing and track duration." },
      { stage: "result_normalize", message: "Normalizing the analysis result for Lyric's dashboard." }
    ];
    let index = 0;
    let stopped = false;
    const applyStep = () => {
      if (stopped) return;
      const current = timeline[Math.min(index, timeline.length - 1)];
      setAudioAnalysisProgress(state.audioAnalysis, current);
      render();
    };
    applyStep();
    const intervalId = window.setInterval(() => {
      if (stopped) return;
      if (index < timeline.length - 1) index += 1;
      applyStep();
    }, 4000);
    return {
      stop() {
        stopped = true;
        window.clearInterval(intervalId);
      }
    };
  }

  function buildAnalysisHandoffFromPipelineResult(result = {}) {
    const artifact = buildAnalysisArtifactFromPipelineResult({
      audioPath: String(state.audioPathInput || "").trim(),
      result
    });
    return buildAnalysisHandoffFromArtifact(artifact, state.creative?.brief || null);
  }

  return {
    formatAudioAnalysisSummary,
    buildAudioAnalysisStubSummary,
    runAudioAnalysisPipeline,
    startAudioAnalysisProgressTicker,
    buildAnalysisHandoffFromPipelineResult,
    shouldEscalateAudioAnalysisProfile
  };
}
