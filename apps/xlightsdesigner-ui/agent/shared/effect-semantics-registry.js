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

export const DIRECT_CUE_RULES = Object.freeze([
  {
    patterns: [/\b(marquee|marching marquee|marquee-band|marquee band|segmented chaser|chaser)\b/],
    primary: ["Marquee"],
    secondary: ["Bars"]
  },
  {
    patterns: [/\b(segmented bars?|bars read|clean segmented|striped bars?)\b/],
    primary: ["Bars"],
    secondary: ["Marquee"]
  },
  {
    patterns: [/\b(shockwave|ring burst|ring|radial expansion|burst)\b/],
    primary: ["Shockwave"]
  },
  {
    patterns: [/\b(pinwheel|radial spin|radial rotation|clear radial spin|rotating radial)\b/],
    primary: ["Pinwheel"]
  },
  {
    patterns: [/\b(single\s*strand|traveling strand|travelling strand|directional traveling strand|directional chase|chase motion)\b/],
    primary: ["SingleStrand"],
    secondary: ["Bars"]
  },
  {
    patterns: [/\b(on effect|solid steady hold|solid hold|steady hold|static hold|minimal movement)\b/],
    primary: ["On"],
    secondary: ["Color Wash"]
  },
  {
    patterns: [/\b(flowing spiral motion|spiral motion|spiral flow|helical motion|helix motion)\b/],
    primary: ["Spirals"],
    secondary: ["Wave"]
  }
]);

export const SECTION_CONTEXT_RULES = Object.freeze({
  tag: {
    resolving: { primary: ["Color Wash", "Candle"], secondary: ["Wave", "Shimmer"] },
    overblown: { primary: ["Bars", "Meteors"], secondary: ["Shimmer", "Pinwheel"] },
    default: { primary: ["Wave", "Color Wash"], secondary: ["Candle", "Shimmer"] }
  },
  coda: {
    resolving: { primary: ["Wave", "Color Wash"], secondary: ["Candle", "On"] },
    overblown: { primary: ["Bars", "Meteors"], secondary: ["Shimmer", "Pinwheel"] },
    default: { primary: ["Color Wash", "Candle"], secondary: ["Wave", "On"] }
  },
  middle8: {
    contrasting: { primary: ["Wave", "Color Wash"], secondary: ["Candle", "Spirals"] },
    chorusLike: { primary: ["Bars", "Shimmer"], secondary: ["Meteors", "Pinwheel"] },
    default: { primary: ["Wave", "Bars"], secondary: ["Spirals", "Color Wash"] }
  },
  postChorus: {
    hookEcho: { primary: ["Shimmer", "Wave"], secondary: ["Color Wash", "Candle"] },
    verseLike: { primary: ["Color Wash", "Candle"], secondary: ["Wave", "Butterfly"] },
    default: { primary: ["Shimmer", "Color Wash"], secondary: ["Wave", "Bars"] }
  },
  rap: {
    focused: { primary: DESIGNER_FAMILY_POOLS.rap, secondary: ["Bars", "Shockwave"] },
    chorusLike: { primary: DESIGNER_FAMILY_POOLS.chorus, secondary: DESIGNER_FAMILY_POOLS.dense }
  },
  solo: {
    focused: { primary: DESIGNER_FAMILY_POOLS.solo, secondary: ["Pinwheel", "Color Wash"] },
    chorusLike: { primary: DESIGNER_FAMILY_POOLS.chorus, secondary: DESIGNER_FAMILY_POOLS.dense }
  }
});

export const CONTEXTUAL_EFFECT_RULES = Object.freeze({
  lightingCue: {
    highSmooth: { primary: ["Color Wash", "Wave"], secondary: ["Spirals", "Shimmer"] },
    highCrisp: { primary: ["Color Wash", "Shimmer"], secondary: ["Bars", "Pinwheel"] },
    highDefault: { primary: ["Color Wash", "Shimmer"], secondary: ["Pinwheel", "Fireworks", "Meteors"] },
    bridge: { primary: ["Wave", "Bars"], secondary: ["Spirals", "Color Wash"] },
    low: { primary: ["Color Wash", "Candle"], secondary: ["On", "Wave"] },
    default: { primary: ["Color Wash", "Wave"], secondary: ["Butterfly", "Circles"] }
  },
  phraseBridge: {
    suspended: { primary: ["Wave", "Color Wash"], secondary: ["Candle", "Spirals"] },
    chorusLike: { primary: ["Bars", "Shimmer"], secondary: ["Meteors", "Pinwheel"] },
    default: { primary: ["Wave", "Bars"], secondary: ["Spirals", "Color Wash"] }
  },
  rhythm: {
    highNearEnd: { primary: ["Bars", "Shockwave"], secondary: ["Meteors", "Pinwheel"] },
    highDefault: { primary: ["Meteors", "Pinwheel"], secondary: ["Shimmer", "Bars"] },
    bridge: { primary: ["Bars", "Shockwave"], secondary: ["Wave", "Warp"] },
    default: { primary: ["Wave", "Circles"], secondary: ["Butterfly", "Twinkle"] }
  },
  framing: {
    high: { primary: ["Color Wash", "Pinwheel"], secondary: ["Shimmer", "Spirals"] },
    bridge: { primary: ["Wave", "Bars"], secondary: ["Spirals", "Color Wash"] },
    low: { primary: ["Color Wash", "Candle"], secondary: ["Snowflakes", "On"] },
    default: { primary: ["Wave", "Butterfly"], secondary: ["Bars", "Circles"] }
  },
  highEnergy: {
    dropFocused: { primary: ["Shockwave", "Bars"], secondary: ["Meteors", "Pinwheel"] },
    dropDiffused: { primary: ["Wave", "Color Wash"], secondary: ["Spirals", "Morph"] },
    finaleControlled: { primary: ["Bars", "Wave"], secondary: ["Shimmer", "Color Wash"] },
    finaleFlooded: { primary: ["Bars", "Meteors"], secondary: ["Shimmer", "Pinwheel"] },
    smoothNearEnd: { primary: ["Spirals", "Wave"], secondary: ["Color Wash", "Shimmer"] },
    smoothDefault: { primary: ["Color Wash", "Wave"], secondary: ["Shimmer", "Butterfly"] },
    crispNearEnd: { primary: ["Bars", "Meteors"], secondary: ["Shimmer", "Pinwheel"] },
    crispDefault: { primary: ["Shimmer", "Bars"], secondary: ["Pinwheel", "Color Wash"] },
    nearEnd: { primary: ["Bars", "Meteors"], secondary: ["Shimmer", "Fireworks", "Pinwheel"] },
    default: { primary: DESIGNER_FAMILY_POOLS.chorus, secondary: DESIGNER_FAMILY_POOLS.dense }
  },
  genericFlow: {
    wide: { primary: DESIGNER_FAMILY_POOLS.bridge, secondary: DESIGNER_FAMILY_POOLS.wide },
    escalationVerseFlat: { primary: ["Shimmer", "Bars"], secondary: ["Wave", "Color Wash"] },
    escalationVerseOpen: { primary: ["Color Wash", "Candle"], secondary: ["Wave", "Butterfly"] },
    low: { primary: DESIGNER_FAMILY_POOLS.intro, secondary: DESIGNER_FAMILY_POOLS.gentle },
    lowOutro: { primary: DESIGNER_FAMILY_POOLS.outro, secondary: DESIGNER_FAMILY_POOLS.gentle },
    nearPeak: { primary: DESIGNER_FAMILY_POOLS.dense, secondary: DESIGNER_FAMILY_POOLS.chorus },
    nearEnd: { primary: DESIGNER_FAMILY_POOLS.outro, secondary: DESIGNER_FAMILY_POOLS.bridge },
    nearStart: { primary: DESIGNER_FAMILY_POOLS.intro, secondary: DESIGNER_FAMILY_POOLS.gentle },
    pulse: { primary: DESIGNER_FAMILY_POOLS.bridge, secondary: DESIGNER_FAMILY_POOLS.default },
    default: { primary: DESIGNER_FAMILY_POOLS.verse, secondary: DESIGNER_FAMILY_POOLS.default }
  }
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

export function resolveDirectCueEffectCandidates({
  goalText = "",
  smoothBias = false
} = {}) {
  const text = str(goalText).toLowerCase();
  if (!text) return [];

  for (const rule of DIRECT_CUE_RULES) {
    if (arr(rule.patterns).some((pattern) => pattern?.test?.(text))) {
      return pickDistinctEffects(rule.primary, rule.secondary);
    }
  }

  if (/\b(spiral|spirals|helical|helix)\b/.test(text)) {
    return pickDistinctEffects(["Spirals"], smoothBias ? ["Shimmer"] : ["Color Wash"]);
  }

  if ((/\b(twinkle|shimmer)\b/.test(text) || /\btexture-?led|soft(er)? texture|soft texture\b/.test(text))
    && !/\b(directional|segmented|bars?)\b/.test(text)) {
    return pickDistinctEffects(["Shimmer", "Twinkle"], smoothBias ? ["Color Wash"] : ["Bars"]);
  }

  return [];
}

export function resolveSectionContextEffectCandidates({
  sectionKey = "",
  variant = "default"
} = {}) {
  const sectionRules = SECTION_CONTEXT_RULES[str(sectionKey)] || null;
  if (!sectionRules) return [];
  const rule = sectionRules[str(variant)] || sectionRules.default || null;
  if (!rule) return [];
  return pickDistinctEffects(rule.primary, rule.secondary);
}

export function resolveContextualEffectCandidates({
  contextKey = "",
  variant = "default"
} = {}) {
  const contextRules = CONTEXTUAL_EFFECT_RULES[str(contextKey)] || null;
  if (!contextRules) return [];
  const rule = contextRules[str(variant)] || contextRules.default || null;
  if (!rule) return [];
  return pickDistinctEffects(rule.primary, rule.secondary);
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
