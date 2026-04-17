import {
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

function containsWholePhrase(haystack = "", needle = "") {
  const text = str(haystack).toLowerCase();
  const phrase = str(needle).toLowerCase();
  if (!text || !phrase) return false;
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(text);
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
  fireworks: "Fireworks",
  lightning: "Lightning",
  meteors: "Meteors",
  on: "On",
  off: "Off"
});

export const EFFECT_FAMILY_BY_NAME = Object.freeze({
  "Color Wash": "wash",
  Shimmer: "sparkle",
  Bars: "rhythmic",
  On: "hold",
  Butterfly: "motion_texture",
  Circles: "particle_motion",
  Curtain: "transition_motion",
  Fan: "radial_motion",
  Fire: "organic_texture",
  Fireworks: "particle_motion",
  Lightning: "radial_motion",
  Morph: "path_motion",
  Meteors: "particle_motion",
  Pinwheel: "radial_motion",
  SingleStrand: "strand_pattern",
  Snowflakes: "particle_motion",
  Spirals: "motion_texture",
  Strobe: "rhythmic",
  "VU Meter": "audio_reactive",
  Wave: "motion_texture"
});

export const SAFE_EFFECT_FALLBACKS = Object.freeze({
  sparklyTexture: ["Shimmer", "Twinkle"],
  rhythmicMotion: ["Bars", "Marquee", "SingleStrand"],
  staticFill: ["On", "Color Wash"],
  default: ["Color Wash", "On", "Shimmer"]
});

export const TEMPLATE_EFFECT_PREFERENCES = Object.freeze([
  "On",
  "Bars",
  "Color Wash",
  "Butterfly",
  "Shimmer"
]);

export const SUMMARY_FALLBACK_RULES = Object.freeze([
  {
    key: "sparklyTexture",
    patterns: [/\b(shimmer|sparkle|twinkle|glitter)\b/],
    defaultEffect: "Shimmer"
  },
  {
    key: "rhythmicMotion",
    patterns: [/\b(bars|pulse|strobe|rhythm|chop)\b/],
    defaultEffect: "Bars"
  },
  {
    key: "staticFill",
    patterns: [/\b(on effect|solid|hold|steady)\b/],
    defaultEffect: "On"
  },
  {
    key: "default",
    patterns: [],
    defaultEffect: "Color Wash"
  }
]);

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

export const CONTEXTUAL_EFFECT_RULES = Object.freeze({
  lightingCue: {
    default: { primary: ["Color Wash", "Wave"], secondary: ["Butterfly", "Circles"] }
  },
  rhythm: {
    highNearEnd: { primary: ["Bars", "Shockwave"], secondary: ["Meteors", "Pinwheel"] },
    highDefault: { primary: ["Meteors", "Pinwheel"], secondary: ["Shimmer", "Bars"] },
    bridge: { primary: ["Bars", "Shockwave"], secondary: ["Wave", "Warp"] },
    default: { primary: ["Wave", "Circles"], secondary: ["Butterfly", "Twinkle"] }
  },
  framing: {
    default: { primary: ["Wave", "Butterfly"], secondary: ["Bars", "Circles"] }
  },
  genericFlow: {
    escalationVerseFlat: { primary: ["Shimmer", "Bars"], secondary: ["Wave", "Color Wash"] },
    escalationVerseOpen: { primary: ["Color Wash", "Candle"], secondary: ["Wave", "Butterfly"] },
    pulse: { primary: ["Bars", "Morph"], secondary: ["Shockwave", "Spirals"] },
    default: { primary: ["Color Wash", "Butterfly"], secondary: ["Shimmer", "Bars"] }
  }
});

export const SECTION_INTENT_SUMMARY_RULES = Object.freeze({
  lightingCue: {
    high: "build a clearer key-vs-fill hierarchy{warmClause} with stronger punch on the main reveal",
    low: "hold the lighting stack back{warmClause} with restrained washes and cleaner negative space",
    default: "shape the section like a lighting cue{warmClause} with readable support and controlled depth"
  },
  framing: {
    high: "frame the reveal{warmClause} with cleaner negative space and tighter focal contrast",
    low: "hold more negative space{warmClause} so the frame stays calm and uncluttered",
    default: "use cleaner framing{warmClause} with more negative space and clearer focal boundaries"
  },
  generic: {
    low: "keep the pass restrained{warmClause} with slower fades, cleaner spacing, and readable atmosphere",
    dense: "develop the section{warmClause} with richer layering while keeping the read controlled",
    default: "develop warmth and continuity{warmClause} with smooth motion and balanced supporting texture"
  }
});

export function canonicalizeEffectNameAlias(value = "") {
  const text = str(value);
  if (!text) return "";
  return EFFECT_NAME_ALIASES[text.toLowerCase()] || text;
}

export function getCanonicalEffectFamily(effectName = "") {
  return EFFECT_FAMILY_BY_NAME[canonicalizeEffectNameAlias(effectName)] || "";
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

export function buildEffectAvoidanceSet(effectAvoidances = []) {
  const blocked = new Set();
  for (const raw of arr(effectAvoidances)) {
    const text = str(raw);
    if (!text) continue;
    const canonical = canonicalizeEffectNameAlias(text);
    if (canonical) {
      blocked.add(canonical.toLowerCase());
      const family = getCanonicalEffectFamily(canonical);
      if (family) blocked.add(`family:${family.toLowerCase()}`);
      continue;
    }
    blocked.add(text.toLowerCase());
  }
  return blocked;
}

export function filterAvoidedEffects(effectNames = [], effectAvoidances = []) {
  const normalized = uniqueStrings(effectNames);
  if (!normalized.length) return [];
  const blocked = buildEffectAvoidanceSet(effectAvoidances);
  if (!blocked.size) return normalized;
  return normalized.filter((name) => {
    const canonical = canonicalizeEffectNameAlias(name);
    const family = getCanonicalEffectFamily(canonical);
    if (blocked.has(canonical.toLowerCase())) return false;
    if (family && blocked.has(`family:${family.toLowerCase()}`)) return false;
    return true;
  });
}

export function chooseSafeFallbackChain(kind = "") {
  return SAFE_EFFECT_FALLBACKS[str(kind)] || [];
}

export function choosePreferredTemplateEffect(effectCatalog = null) {
  const byName = effectCatalog && typeof effectCatalog === "object" && effectCatalog.byName && typeof effectCatalog.byName === "object"
    ? effectCatalog.byName
    : {};
  for (const name of TEMPLATE_EFFECT_PREFERENCES) {
    if (Object.prototype.hasOwnProperty.call(byName, name)) return name;
  }
  const names = Object.keys(byName);
  return names.length ? names[0] : "";
}

function stripNegativeCueClauses(value = "") {
  const text = str(value);
  if (!text) return "";
  return text
    .replace(/do not turn it into[\s\S]*?(?=[.?!]|$)/gi, " ")
    .replace(/rather than[\s\S]*?(?=[.?!]|$)/gi, " ")
    .replace(/instead of[\s\S]*?(?=[.?!]|$)/gi, " ")
    .replace(/avoid[\s\S]*?(?=[.?!]|$)/gi, " ")
    .replace(/without[\s\S]*?(?=[.?!]|$)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveDirectCueEffectCandidates({
  goalText = "",
  smoothBias = false
} = {}) {
  const text = stripNegativeCueClauses(goalText).toLowerCase();
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

export function resolveSummaryFallbackEffect(summary = "", availableEffects = null) {
  const text = str(summary).toLowerCase();
  for (const rule of SUMMARY_FALLBACK_RULES) {
    const patterns = arr(rule.patterns);
    const mode = str(rule.mode || "any").toLowerCase();
    const matched = !patterns.length
      ? true
      : (mode === "all"
          ? patterns.every((pattern) => pattern?.test?.(text))
          : patterns.some((pattern) => pattern?.test?.(text)));
    if (!matched) continue;
    return firstAvailableEffect(chooseSafeFallbackChain(rule.key), availableEffects) || str(rule.defaultEffect);
  }
  return "";
}

export function selectPreferredEffect(effectNames = [], { availableEffects = null, effectAvoidances = [] } = {}) {
  const filtered = filterAvoidedEffects(effectNames, effectAvoidances);
  return firstAvailableEffect(filtered, availableEffects);
}

export function resolveSectionIntentSummary({
  summaryKey = "",
  variant = "default",
  warm = false
} = {}) {
  const summaryRules = SECTION_INTENT_SUMMARY_RULES[str(summaryKey)] || null;
  if (!summaryRules) return "";
  const template = summaryRules[str(variant)] || summaryRules.default || "";
  if (!template) return "";
  const warmClause = warm ? " with warm cinematic color and glow control" : "";
  return str(template).replaceAll("{warmClause}", warmClause);
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
    if (containsWholePhrase(text, alias)) matches.push(effectName);
  }

  return uniqueStrings(matches).slice(0, Math.max(1, Number(limit) || 3));
}
