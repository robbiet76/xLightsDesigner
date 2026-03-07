function basename(path) {
  const raw = String(path || "");
  if (!raw) return "audio track";
  const normalized = raw.replace(/\\/g, "/");
  const idx = normalized.lastIndexOf("/");
  return idx >= 0 ? normalized.slice(idx + 1) : normalized;
}

export function analyzeAudioContext({
  audioPath = "",
  sectionSuggestions = [],
  timingTracks = []
} = {}) {
  const trackName = basename(audioPath || "");
  const sections = Array.isArray(sectionSuggestions) ? sectionSuggestions.filter(Boolean) : [];
  const trackNames = (Array.isArray(timingTracks) ? timingTracks : [])
    .map((t) => (typeof t === "string" ? t : t?.name || ""))
    .filter(Boolean);

  const hasBeatTrack = trackNames.some((name) => /beat|bpm|tempo/i.test(name));
  const hasLyricsTrack = trackNames.some((name) => /lyric/i.test(name));

  return {
    source: audioPath || "(none)",
    trackName,
    structure: sections.length ? sections : ["Intro", "Verse", "Chorus", "Bridge", "Outro"],
    timing: {
      tempoEstimate: hasBeatTrack ? "derived-from-beat-track" : "pending",
      timeSignature: "4/4 (assumed until explicit track analysis)",
      hasBeatTrack,
      hasLyricsTrack
    },
    summaryLines: [
      `Audio source: ${trackName || "(none)"}`,
      `Song structure: ${(sections.length ? sections : ["pending"]).join(", ")}`,
      `Tempo/time signature: ${hasBeatTrack ? "beat track detected" : "pending explicit beat analysis"}`,
      `Lyrics context: ${hasLyricsTrack ? "lyrics timing track detected" : "lyrics timing pending"}`
    ]
  };
}
