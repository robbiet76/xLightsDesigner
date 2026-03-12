export function synthesizeCreativeBrief({
  goals = "",
  inspiration = "",
  notes = "",
  references = [],
  audioAnalysis = null,
  songContextSummary = "",
  latestIntent = ""
} = {}) {
  const refs = Array.isArray(references) ? references : [];
  const sectionMap = Array.isArray(audioAnalysis?.structure) ? audioAnalysis.structure : [];
  const refNames = refs.slice(0, 5).map((r) => String(r?.name || "").trim()).filter(Boolean);

  return {
    summary: String(goals || inspiration || latestIntent || "Design direction inferred from audio + user intent."),
    goalsSummary: String(goals || "No explicit goals captured."),
    inspirationSummary: String(inspiration || "No explicit inspiration captured."),
    audioContext: String(audioAnalysis?.trackName || "Audio context pending."),
    sections: sectionMap.length ? sectionMap : ["Intro", "Verse", "Chorus", "Bridge", "Outro"],
    moodEnergyArc: "Start readable, escalate contrast at impact sections, resolve cleanly.",
    narrativeCues: String(songContextSummary || "Tie transitions to phrasing and lyrical emphasis where available."),
    visualCues: refNames.length ? `Reference cues from: ${refNames.join(", ")}` : "No uploaded references.",
    hypotheses: [
      "Use focal-target contrast to clarify musical hierarchy.",
      "Preserve successful motifs and iterate surgically by section."
    ],
    notes: String(notes || "")
  };
}
