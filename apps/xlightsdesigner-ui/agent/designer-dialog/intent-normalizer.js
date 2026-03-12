function cleanText(value) {
  return String(value || "").trim();
}

function extractTempoIntent(text) {
  const lower = text.toLowerCase();
  if (/(faster|higher energy|more energy|punchy|intense|bigger)/.test(lower)) return "increase";
  if (/(slower|calm|softer|lower energy|reduce energy)/.test(lower)) return "decrease";
  return "hold";
}

function extractMotionIntent(text) {
  const lower = text.toLowerCase();
  if (/(smooth|gentle|calm|float|slow)/.test(lower)) return "smooth";
  if (/(punch|sharp|staccato|impact|hit|burst)/.test(lower)) return "punchy";
  return "balanced";
}

function extractEffectOverrides(text) {
  const lower = text.toLowerCase();
  const known = ["on", "off", "twinkle", "bars", "pinwheel", "butterfly", "spirals", "meteors", "colorwash", "shimmer"];
  return known.filter((name) => lower.includes(name));
}

export function normalizeIntent({
  promptText = "",
  selectedSections = [],
  creativeBrief = null,
  selectedTagNames = [],
  selectedTargetIds = []
} = {}) {
  const goal = cleanText(promptText);
  const sections = Array.isArray(selectedSections) ? selectedSections.filter(Boolean) : [];
  const tags = Array.isArray(selectedTagNames) ? selectedTagNames.filter(Boolean) : [];
  const targetIds = Array.isArray(selectedTargetIds) ? selectedTargetIds.filter(Boolean) : [];

  return {
    goal,
    sections,
    tags,
    targetIds,
    tempoIntent: extractTempoIntent(goal),
    motionIntent: extractMotionIntent(goal),
    effectOverrides: extractEffectOverrides(goal),
    preserveTimingTracks: true,
    creativeBrief: creativeBrief && typeof creativeBrief === "object" ? creativeBrief : null
  };
}
