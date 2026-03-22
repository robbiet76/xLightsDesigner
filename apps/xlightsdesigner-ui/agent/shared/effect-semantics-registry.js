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
  Morph: "path_motion",
  Meteors: "particle_motion",
  Pinwheel: "radial_motion",
  SingleStrand: "strand_pattern",
  Snowflakes: "particle_motion",
  Spirals: "motion_texture",
  "VU Meter": "audio_reactive",
  Wave: "motion_texture"
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
    key: "cinematicWarmHigh",
    patterns: [/\b(warm|amber|gold|cinematic|glow|smooth)\b/, /\b(chorus|payoff|finale)\b/],
    mode: "all",
    defaultEffect: "Shimmer"
  },
  {
    key: "cinematicWarmLow",
    patterns: [/\b(warm|amber|gold|cinematic|glow|smooth)\b/],
    defaultEffect: "Color Wash"
  },
  {
    key: "highEnergy",
    patterns: [/\b(chorus|payoff|finale)\b/],
    defaultEffect: "Shimmer"
  },
  {
    key: "denseBridge",
    patterns: [/\bbridge\b/, /\bdense\b/],
    mode: "any",
    defaultEffect: "Bars"
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

export const REPEATED_ROLE_RULES = Object.freeze({
  chorus: {
    coherentBuild: {
      basePrimary: ["Shimmer", "Pinwheel"],
      baseSecondary: ["Bars", "Meteors"],
      growthPrimary: ["Shimmer", "Pinwheel", "Meteors"],
      growthSecondary: ["Bars", "Shockwave"]
    },
    unrelated: {
      alternates: [
        ["Bars", "Meteors"],
        ["Pinwheel", "Shimmer"],
        ["Color Wash", "Wave"]
      ]
    }
  },
  verse: {
    coherentSupport: {
      basePrimary: ["Color Wash", "Candle"],
      baseSecondary: ["Wave", "Spirals"]
    },
    unrelated: {
      alternates: [
        ["Color Wash", "Candle"],
        ["Spirals", "Wave"],
        ["Bars", "Shimmer"]
      ]
    }
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
  highEnergy: {
    dropFocused: "let the drop land{warmClause} with concentrated release, tighter impact, and a cleaner post-buildup hit",
    dropDiffused: "keep the drop broader{warmClause} and more transitional so the release stays diffused rather than landing hard",
    dropDefault: "let the drop open up{warmClause} with sharper release and a more concentrated impact window",
    finaleControlled: "push the final payoff{warmClause} with clear hero emphasis, controlled width, and restraint around the main reveal",
    finaleFlooded: "push the final payoff{warmClause} as a full-yard flood with constant output and minimal restraint",
    finaleDefault: "push the final payoff{warmClause} with broader contrast, clearer hierarchy, and a stronger closing lift",
    chorus: "open the main reveal{warmClause} with clearer focal emphasis and controlled contrast",
    default: "build stronger visual payoff{warmClause} using layered shimmer, glow, and clearer focal emphasis"
  },
  bridge: {
    suspended: "hold the bridge transition wider{warmClause} with suspended motion, cleaner breath, and delayed release",
    chorusLike: "push the bridge harder{warmClause} like a payoff hit with denser overlay energy and less suspension",
    default: "widen the picture{warmClause} with smoother transitions and controlled contrast lift"
  },
  tag: {
    resolving: "let the tag resolve{warmClause} like a shorter afterglow, echoing the final hook without opening a new climax",
    overblown: "treat the tag{warmClause} like another full climax with the same density and payoff weight as the final chorus",
    default: "let the tag settle{warmClause} with a cleaner echo and narrower closing energy"
  },
  coda: {
    resolving: "let the coda resolve{warmClause} as a final release with less information and lower payoff weight than the final chorus",
    overblown: "treat the coda{warmClause} like another full climax instead of a final release",
    default: "let the coda settle{warmClause} as a cleaner closing release with restrained afterglow"
  },
  middle8: {
    contrasting: "let the middle 8 open wider{warmClause} as a contrasting detour before the final lift instead of repeating chorus payoff language",
    chorusLike: "treat the middle 8{warmClause} like another chorus with the same payoff language and little contrast",
    default: "give the middle 8{warmClause} a wider contrasting breath before the closing payoff"
  },
  postChorus: {
    hookEcho: "let the post-chorus echo the hook{warmClause} with a lighter extension instead of opening a whole new section arc",
    verseLike: "treat the post-chorus{warmClause} like a fresh verse-sized section with a new arc instead of reinforcing the hook",
    default: "let the post-chorus{warmClause} reinforce the hook with a cleaner extension and lighter follow-through"
  },
  rap: {
    focused: "tighten the rap section{warmClause} around a clipped rhythmic delivery with narrower focus and stronger pulse control",
    chorusLike: "treat the rap section{warmClause} like another broad singing chorus pass instead of tightening around the rhythmic delivery"
  },
  solo: {
    focused: "feature the solo{warmClause} like a spotlighted detour with narrower focus and clearer individual emphasis",
    chorusLike: "treat the solo{warmClause} like another broad chorus pass with the same payoff language spread across the picture"
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

export function resolveRepeatedRoleEffectCandidates({
  roleKey = "",
  variant = "",
  repeatedRoleIndex = 0,
  repeatedRoleCount = 0
} = {}) {
  const roleRules = REPEATED_ROLE_RULES[str(roleKey)] || null;
  if (!roleRules) return [];
  const rule = roleRules[str(variant)] || null;
  if (!rule) return [];
  if (Array.isArray(rule.alternates) && rule.alternates.length) {
    const idx = Math.max(0, Number(repeatedRoleIndex) || 0) % rule.alternates.length;
    const next = rule.alternates[idx] || [];
    const secondary = rule.alternates[(idx + 1) % rule.alternates.length] || [];
    return pickDistinctEffects(next, secondary);
  }
  const count = Math.max(0, Number(repeatedRoleCount) || 0);
  const idx = Math.max(0, Number(repeatedRoleIndex) || 0);
  const useGrowth = count > 1 && idx >= count - 1 && (arr(rule.growthPrimary).length || arr(rule.growthSecondary).length);
  if (useGrowth) {
    return pickDistinctEffects(rule.growthPrimary, rule.growthSecondary);
  }
  return pickDistinctEffects(rule.basePrimary, rule.baseSecondary);
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
