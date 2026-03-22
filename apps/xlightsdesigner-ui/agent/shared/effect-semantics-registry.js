import {
  EFFECT_KEYWORDS,
  VISUAL_FAMILY_EFFECT_MAP,
  recommendTrainedEffectsForTargets,
  recommendTrainedEffectsForVisualFamilies
} from "../sequence-agent/trained-effect-knowledge.js";

function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueStrings(values = []) {
  const seen = new Set();
  const out = [];
  for (const value of arr(values).map((row) => str(row)).filter(Boolean)) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

export const EFFECT_NAME_ALIASES = Object.freeze({
  "color wash": "Color Wash",
  colorwash: "Color Wash",
  marquee: "Marquee",
  shimmer: "Shimmer",
  shockwave: "Shockwave",
  singlestrand: "SingleStrand",
  "single strand": "SingleStrand",
  twinkle: "Twinkle",
  spirals: "Spirals",
  spiral: "Spirals",
  bars: "Bars",
  pinwheel: "Pinwheel",
  butterfly: "Butterfly",
  meteors: "Meteors",
  on: "On",
  off: "Off"
});

export const DESIGNER_FAMILY_POOLS = Object.freeze({
  intro: ["Color Wash", "Candle", "On", "Snowflakes"],
  verse: ["Color Wash", "Butterfly", "Circles", "Wave", "Twinkle"],
  chorus: ["Shimmer", "Pinwheel", "Meteors", "Fireworks", "Color Wash"],
  bridge: ["Bars", "Morph", "Shockwave", "Spirals", "Ripple"],
  rap: ["Bars", "Shockwave", "Wave", "Color Wash", "Meteors"],
  solo: ["Pinwheel", "Meteors", "Color Wash", "Wave", "Shimmer"],
  outro: ["Spirals", "Wave", "Snowstorm", "Color Wash", "On"],
  wide: ["Bars", "Morph", "Shockwave", "Warp", "Ripple"],
  dense: ["Shimmer", "Pinwheel", "Meteors", "Galaxy", "Fireworks"],
  gentle: ["Color Wash", "Candle", "Snowflakes", "On", "Wave"],
  default: ["Color Wash", "Butterfly", "Shimmer", "Bars", "Twinkle"]
});

export const SAFE_EFFECT_FALLBACKS = Object.freeze({
  sparklyTexture: ["Shimmer", "Twinkle"],
  rhythmicMotion: ["Bars", "Marquee", "SingleStrand"],
  staticFill: ["On", "Color Wash"],
  cinematicWarmHigh: ["Shimmer", "Color Wash", "On"],
  cinematicWarmLow: ["Color Wash", "Shimmer", "On"],
  highEnergy: ["Shimmer", "Bars", "Pinwheel"],
  denseBridge: ["Bars", "Shimmer", "Color Wash"],
  default: ["Color Wash", "On", "Shimmer"],
  trainedOnAlternate: ["Color Wash", "Shimmer"]
});

export function canonicalizeEffectNameAlias(value = "") {
  const text = str(value);
  if (!text) return "";
  return EFFECT_NAME_ALIASES[text.toLowerCase()] || text;
}

export function pickDistinctEffects(primary = [], secondary = [], count = 2) {
  const out = [];
  for (const name of [...arr(primary), ...arr(secondary)]) {
    const effectName = str(name);
    if (!effectName || out.includes(effectName)) continue;
    out.push(effectName);
    if (out.length >= count) break;
  }
  return out;
}

export function firstAvailableEffect(effectNames = [], availableEffects = null) {
  const normalized = uniqueStrings(effectNames);
  if (!normalized.length) return "";
  if (!availableEffects || !(availableEffects instanceof Set) || !availableEffects.size) {
    return normalized[0] || "";
  }
  return normalized.find((row) => availableEffects.has(row)) || "";
}

export function chooseSafeFallbackChain(kind = "") {
  return SAFE_EFFECT_FALLBACKS[str(kind)] || [];
}

export function recommendEffectsForVisualFamilies(args = {}) {
  return recommendTrainedEffectsForVisualFamilies(args);
}

export function recommendEffectsForTargets(args = {}) {
  return recommendTrainedEffectsForTargets(args);
}

export function inferLegacyEffectCandidates(description = "", { limit = 3 } = {}) {
  const text = str(description).toLowerCase();
  const matches = [];

  for (const [alias, effectName] of Object.entries(EFFECT_NAME_ALIASES)) {
    if (!alias || !effectName) continue;
    if (text.includes(alias)) matches.push(effectName);
  }

  for (const [effectName, keywords] of Object.entries(EFFECT_KEYWORDS)) {
    if (arr(keywords).some((keyword) => text.includes(str(keyword).toLowerCase()))) {
      matches.push(effectName);
    }
  }

  return uniqueStrings(matches).slice(0, Math.max(1, Number(limit) || 3));
}

export { VISUAL_FAMILY_EFFECT_MAP };
