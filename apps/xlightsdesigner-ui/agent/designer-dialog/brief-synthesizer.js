export function synthesizeCreativeBrief({
  goals = "",
  inspiration = "",
  notes = "",
  references = [],
  audioAnalysis = null,
  songContextSummary = "",
  latestIntent = "",
  designSceneContext = null,
  musicDesignContext = null
} = {}) {
  const refs = Array.isArray(references) ? references : [];
  const sectionMap = Array.isArray(audioAnalysis?.structure) ? audioAnalysis.structure : [];
  const refNames = refs.slice(0, 5).map((r) => String(r?.name || "").trim()).filter(Boolean);
  const scene = designSceneContext && typeof designSceneContext === "object" ? designSceneContext : {};
  const music = musicDesignContext && typeof musicDesignContext === "object" ? musicDesignContext : {};
  const musicArc = Array.isArray(music.sectionArc) ? music.sectionArc : [];
  const focalCandidates = Array.isArray(scene.focalCandidates) ? scene.focalCandidates.filter(Boolean) : [];
  const broadDomains = Array.isArray(scene?.coverageDomains?.broad) ? scene.coverageDomains.broad.filter(Boolean) : [];
  const detailDomains = Array.isArray(scene?.coverageDomains?.detail) ? scene.coverageDomains.detail.filter(Boolean) : [];
  const revealMoments = Array.isArray(music?.designCues?.revealMoments) ? music.designCues.revealMoments.filter(Boolean) : [];
  const holdMoments = Array.isArray(music?.designCues?.holdMoments) ? music.designCues.holdMoments.filter(Boolean) : [];
  const lyricFocusMoments = Array.isArray(music?.designCues?.lyricFocusMoments) ? music.designCues.lyricFocusMoments.filter(Boolean) : [];
  const sections = musicArc.length
    ? musicArc.map((section) => String(section?.label || "").trim()).filter(Boolean)
    : sectionMap.length
      ? sectionMap
      : ["Intro", "Verse", "Chorus", "Bridge", "Outro"];

  const moodEnergyArc = musicArc.length
    ? musicArc
        .slice(0, 6)
        .map((section) => {
          const label = String(section?.label || "").trim() || "Section";
          const energy = String(section?.energy || "unknown").trim() || "unknown";
          return `${label}: ${energy}`;
        })
        .join(" -> ")
    : "Start readable, escalate contrast at impact sections, resolve cleanly.";

  const narrativeParts = [];
  if (songContextSummary) narrativeParts.push(String(songContextSummary));
  if (revealMoments.length) narrativeParts.push(`Treat reveal moments around ${revealMoments.slice(0, 3).join(", ")}.`);
  if (holdMoments.length) narrativeParts.push(`Preserve restraint through ${holdMoments.slice(0, 3).join(", ")}.`);
  if (lyricFocusMoments.length) narrativeParts.push(`Let lyrical emphasis lead focus in ${lyricFocusMoments.slice(0, 3).join(", ")}.`);

  const visualParts = [];
  if (refNames.length) visualParts.push(`Reference cues from: ${refNames.join(", ")}`);
  if (focalCandidates.length) visualParts.push(`Favor focal candidates such as ${focalCandidates.slice(0, 3).join(", ")}.`);
  if (broadDomains.length) visualParts.push(`Use broad coverage domains like ${broadDomains.slice(0, 3).join(", ")} for base passes.`);
  if (detailDomains.length) visualParts.push(`Reserve detail domains like ${detailDomains.slice(0, 3).join(", ")} for refinement.`);

  return {
    summary: String(goals || inspiration || latestIntent || "Design direction inferred from audio + user intent."),
    goalsSummary: String(goals || "No explicit goals captured."),
    inspirationSummary: String(inspiration || "No explicit inspiration captured."),
    audioContext: String(audioAnalysis?.trackName || "Audio context pending."),
    sections,
    moodEnergyArc,
    narrativeCues: narrativeParts.length
      ? narrativeParts.join(" ")
      : "Tie transitions to phrasing and lyrical emphasis where available.",
    visualCues: visualParts.length
      ? visualParts.join(" ")
      : "No uploaded references.",
    hypotheses: [
      "Use focal-target contrast to clarify musical hierarchy.",
      "Preserve successful motifs and iterate surgically by section.",
      ...(broadDomains.length && detailDomains.length
        ? ["Establish broad coverage first, then refine with more detailed targets."]
        : []),
      ...(focalCandidates.length
        ? [`Keep focal hierarchy readable around ${focalCandidates.slice(0, 2).join(" and ")}.`]
        : []),
      ...(revealMoments.length
        ? [`Build contrast into reveal moments such as ${revealMoments.slice(0, 2).join(" and ")}.`]
        : []),
      ...(holdMoments.length
        ? [`Protect quieter hold sections such as ${holdMoments.slice(0, 2).join(" and ")} from unnecessary density.`]
        : [])
    ],
    notes: String(notes || "")
  };
}
