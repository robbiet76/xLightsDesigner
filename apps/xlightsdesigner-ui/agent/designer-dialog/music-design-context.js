import { finalizeArtifact } from "../shared/artifact-ids.js";

function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
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

export function buildMusicDesignContext({
  analysisArtifact = null,
  analysisHandoff = null
} = {}) {
  const capabilities = analysisArtifact?.capabilities || {};
  const sections = arr(
    capabilities.structure?.sections ||
    analysisHandoff?.structure?.sections ||
    analysisArtifact?.structure ||
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

  return finalizeArtifact({
    artifactType: "music_design_context_v1",
    artifactVersion: "1.0",
    mediaId: str(analysisArtifact?.mediaId || analysisHandoff?.mediaId || ""),
    sectionArc,
    designCues: {
      revealMoments,
      holdMoments,
      lyricFocusMoments
    }
  });
}
