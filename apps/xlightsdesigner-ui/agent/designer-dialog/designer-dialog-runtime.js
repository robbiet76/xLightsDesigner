import {
  buildCreativeBriefContract,
  buildDesignerDialogInput,
  buildDesignerDialogResult,
  buildIntentHandoffFromDesignerState,
  buildProposalBundle,
  classifyDesignerDialogFailureReason,
  validateDesignerDialogContractGate
} from "./designer-dialog-contracts.js";
import { buildClarificationPlan } from "./guided-dialog.js";
import { synthesizeCreativeBrief } from "./brief-synthesizer.js";
import { buildProposalFromIntent } from "./planner.js";
import { buildProposalLifecycle } from "./designer-dialog-lifecycle.js";
import { buildDesignSceneContext } from "./design-scene-context.js";
import { buildMusicDesignContext } from "./music-design-context.js";

function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function makeId(prefix = "designer") {
  const suffix = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${suffix}`;
}

function hasMeaningfulCreativeInput({
  promptText = "",
  goals = "",
  inspiration = "",
  notes = "",
  priorBrief = null
} = {}) {
  return Boolean(
    str(promptText) ||
    str(goals) ||
    str(inspiration) ||
    str(notes) ||
    str(priorBrief?.summary)
  );
}

function summarizeScope({ sections = [], targetIds = [], tagNames = [] } = {}) {
  const parts = [];
  if (arr(sections).length) parts.push(`sections: ${arr(sections).slice(0, 3).join(", ")}`);
  if (arr(targetIds).length) parts.push(`targets: ${arr(targetIds).slice(0, 3).join(", ")}`);
  if (arr(tagNames).length) parts.push(`tags: ${arr(tagNames).slice(0, 3).join(", ")}`);
  return parts.join(" | ");
}

function buildBriefTraceability({
  requestId = "",
  latestIntent = "",
  goals = "",
  inspiration = "",
  notes = "",
  references = [],
  audioAnalysis = null,
  songContextSummary = "",
  directorPreferences = null,
  directorProfile = null,
  designSceneContext = null,
  musicDesignContext = null,
  priorBrief = null
} = {}) {
  return {
    requestId: str(requestId),
    latestIntent: str(latestIntent),
    goals: str(goals),
    inspiration: str(inspiration),
    notes: str(notes),
    references: arr(references).map((row) => ({
      name: str(row?.name),
      path: str(row?.path),
      kind: str(row?.kind || row?.type)
    })).filter((row) => row.name || row.path),
    audio: {
      trackName: str(audioAnalysis?.trackName),
      sectionCount: arr(audioAnalysis?.structure).length,
      summaryLines: arr(audioAnalysis?.summaryLines).map((row) => str(row)).filter(Boolean)
    },
    songContextSummary: str(songContextSummary),
    directorPreferencesUsed: isPlainObject(directorPreferences) ? { ...directorPreferences } : undefined,
    directorProfileSignals: isPlainObject(directorProfile?.preferences)
      ? {
          preferenceKeys: Object.keys(directorProfile.preferences),
          summary: str(directorProfile?.summary || directorProfile?.profileSummary)
        }
      : undefined,
    designSceneSignals: isPlainObject(designSceneContext)
      ? {
          layoutMode: str(designSceneContext?.metadata?.layoutMode),
          focalCandidates: arr(designSceneContext.focalCandidates).slice(0, 8),
          broadCoverageDomains: arr(designSceneContext?.coverageDomains?.broad).slice(0, 8),
          detailCoverageDomains: arr(designSceneContext?.coverageDomains?.detail).slice(0, 8)
        }
      : undefined,
    musicDesignSignals: isPlainObject(musicDesignContext)
      ? {
          sectionArc: arr(musicDesignContext?.sectionArc).slice(0, 8).map((row) => ({
            label: str(row?.label),
            energy: str(row?.energy),
            density: str(row?.density)
          })),
          revealMoments: arr(musicDesignContext?.designCues?.revealMoments).slice(0, 8),
          holdMoments: arr(musicDesignContext?.designCues?.holdMoments).slice(0, 8),
          lyricFocusMoments: arr(musicDesignContext?.designCues?.lyricFocusMoments).slice(0, 8)
        }
      : undefined,
    priorBriefSummary: str(priorBrief?.summary)
  };
}

export function buildCreativeBriefArtifact({
  requestId = "",
  goals = "",
  inspiration = "",
  notes = "",
  references = [],
  audioAnalysis = null,
  songContextSummary = "",
  latestIntent = "",
  directorPreferences = null,
  directorProfile = null,
  designSceneContext = null,
  musicDesignContext = null,
  priorBrief = null
} = {}) {
  const synthesized = synthesizeCreativeBrief({
    goals,
    inspiration,
    notes,
    references,
    audioAnalysis,
    songContextSummary,
    latestIntent,
    designSceneContext,
    musicDesignContext
  });

  const hypotheses = [
    ...arr(synthesized.hypotheses),
    ...arr(directorPreferences?.focusPreference ? [
      `Honor the director's ${str(directorPreferences.focusPreference)} focus preference where it supports readability.`
    ] : []),
    ...arr(directorPreferences?.motionPreference ? [
      `Bias motion and pacing choices toward the director's ${str(directorPreferences.motionPreference)} motion preference.`
    ] : [])
  ].filter(Boolean);

  const brief = buildCreativeBriefContract(
    {
      ...synthesized,
      notes: [str(priorBrief?.notes), str(synthesized.notes)].filter(Boolean).join("\n").trim(),
      hypotheses
    },
    buildBriefTraceability({
      requestId,
      latestIntent,
      goals,
      inspiration,
      notes,
      references,
      audioAnalysis,
      songContextSummary,
      directorPreferences,
      directorProfile,
      designSceneContext,
      musicDesignContext,
      priorBrief
    })
  );

  return {
    brief,
    gate: validateDesignerDialogContractGate("brief", brief, requestId)
  };
}

function mergeCreativeBriefIntoProposalLines(lines = [], creativeBrief = null) {
  const base = arr(lines).map((row) => str(row)).filter(Boolean);
  if (base.some((row) => /\/\s+apply\s+.+\s+effect\b/i.test(row))) {
    return base.slice(0, 8);
  }
  return base.slice(0, 8);
}

function buildProposalRiskNotes({ clarificationPlan = null, normalizedIntent = null } = {}) {
  const notes = [];
  const plan = clarificationPlan || {};
  const intent = normalizedIntent || {};

  if (arr(plan.questions).length) {
    notes.push("Proposal generated with open clarification items that may refine scope or emphasis.");
  }
  if (str(intent.changeTolerance) === "aggressive") {
    notes.push("Proposal reflects aggressive change tolerance and may replace more existing content.");
  }
  if (intent?.preservationConstraints?.allowGlobalRewrite) {
    notes.push("Proposal allows broad sequence impact if the user confirms a whole-sequence pass.");
  }

  return notes;
}

function estimateImpact({ proposalLines = [], targets = [] } = {}) {
  return Math.max(arr(proposalLines).length * 8, arr(targets).length * 5);
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

function rotateStrings(values = [], seed = "") {
  const rows = uniqueStrings(values);
  if (rows.length <= 1) return rows;
  const text = str(seed);
  let hash = 0;
  for (let idx = 0; idx < text.length; idx += 1) {
    hash = ((hash * 31) + text.charCodeAt(idx)) >>> 0;
  }
  const offset = hash % rows.length;
  return rows.slice(offset).concat(rows.slice(0, offset));
}

const FAMILY_POOLS = {
  intro: ["Color Wash", "Candle", "On", "Snowflakes"],
  verse: ["Color Wash", "Butterfly", "Circles", "Wave", "Twinkle"],
  chorus: ["Shimmer", "Pinwheel", "Meteors", "Fireworks", "Color Wash"],
  bridge: ["Bars", "Morph", "Shockwave", "Spirals", "Ripple"],
  outro: ["Spirals", "Wave", "Snowstorm", "Color Wash", "On"],
  wide: ["Bars", "Morph", "Shockwave", "Warp", "Ripple"],
  dense: ["Shimmer", "Pinwheel", "Meteors", "Galaxy", "Fireworks"],
  gentle: ["Color Wash", "Candle", "Snowflakes", "On", "Wave"],
  default: ["Color Wash", "Butterfly", "Shimmer", "Bars", "Twinkle"]
};

function pickDistinctEffects(primary = [], secondary = [], count = 2) {
  const out = [];
  for (const name of [...arr(primary), ...arr(secondary)]) {
    const effectName = str(name);
    if (!effectName || out.includes(effectName)) continue;
    out.push(effectName);
    if (out.length >= count) break;
  }
  return out;
}

function chooseExecutionTargets({
  explicitTargetIds = [],
  fallbackTargetIds = [],
  broadCoverageDomains = [],
  focalCandidates = [],
  detailCoverageDomains = [],
  spatialZones = {},
  singleScope = false,
  tagDriven = false,
  energy = "",
  density = "",
  section = "",
  goal = ""
} = {}) {
  const explicit = uniqueStrings(explicitTargetIds);
  if (explicit.length) return explicit.slice(0, 8);
  const broad = rotateStrings(broadCoverageDomains, section);
  const focal = rotateStrings(focalCandidates, `${section}:focal`);
  const detail = rotateStrings(detailCoverageDomains, `${section}:detail`);
  const fallback = rotateStrings(fallbackTargetIds, `${section}:fallback`);
  const zones = spatialZones && typeof spatialZones === "object" ? spatialZones : {};
  const foreground = uniqueStrings(arr(zones.foreground));
  const background = uniqueStrings(arr(zones.background));
  const left = uniqueStrings(arr(zones.left));
  const right = uniqueStrings(arr(zones.right));
  const center = uniqueStrings(arr(zones.center));
  const key = str(section).toLowerCase();
  const lowerGoal = str(goal).toLowerCase();
  const normalizedEnergy = str(energy).toLowerCase();
  const normalizedDensity = str(density).toLowerCase();
  const isPeak = normalizedEnergy === 'high' || /chorus|finale|outro payoff/.test(key);
  const isGentle = normalizedEnergy === 'low' || /intro|outro/.test(key);
  const isWide = normalizedDensity === "wide" || /bridge|instrumental|interlude/.test(key);
  if (/foreground/.test(lowerGoal) || /background/.test(lowerGoal)) {
    return uniqueStrings([
      ...foreground.slice(0, 1),
      ...background.slice(0, 2),
      ...center.slice(0, 1),
      ...focal.slice(0, 1),
      ...broad.slice(0, 1),
      ...fallback.slice(0, 2)
    ]).slice(0, 8);
  }
  if (/left side|left\b|right side|right\b/.test(lowerGoal)) {
    return uniqueStrings([
      ...left.slice(0, 2),
      ...right.slice(0, 2),
      ...center.slice(0, 1),
      ...fallback.slice(0, 2)
    ]).slice(0, 8);
  }
  if (/perimeter/.test(lowerGoal) || /frame\b|framing\b/.test(lowerGoal)) {
    return uniqueStrings([
      ...left.slice(0, 1),
      ...right.slice(0, 1),
      ...foreground.slice(0, 2),
      ...center.slice(0, 1),
      ...focal.slice(0, 1),
      ...fallback.slice(0, 2)
    ]).slice(0, 8);
  }
  if (/centerpiece|center props|key light|focal/.test(lowerGoal)) {
    return uniqueStrings([
      ...center.slice(0, 2),
      ...focal.slice(0, 2),
      ...detail.slice(0, 1),
      ...fallback.slice(0, 2)
    ]).slice(0, 8);
  }
  if (singleScope || tagDriven) {
    if (isGentle) {
      return uniqueStrings([
        ...focal.slice(0, 2),
        ...detail.slice(0, 2),
        ...fallback.slice(0, 3),
        ...broad.slice(0, 1)
      ]).slice(0, 8);
    }
    return uniqueStrings([
      ...focal.slice(0, 2),
      ...detail.slice(0, 2),
      ...fallback.slice(0, 3),
      ...broad.slice(0, 1)
    ]).slice(0, 8);
  }
  if (isPeak) {
    return uniqueStrings([
      ...focal.slice(0, 2),
      ...detail.slice(0, 2),
      ...broad.slice(0, 2),
      ...fallback.slice(0, 2)
    ]).slice(0, 8);
  }
  if (isWide) {
    return uniqueStrings([
      ...broad.slice(0, 1),
      ...detail.slice(0, 2),
      ...focal.slice(0, 1),
      ...fallback.slice(0, 2)
    ]).slice(0, 8);
  }
  if (isGentle) {
    return uniqueStrings([
      ...broad.slice(0, 2),
      ...detail.slice(0, 1),
      ...fallback.slice(0, 2)
    ]).slice(0, 8);
  }
  return uniqueStrings([
    ...broad.slice(0, 2),
    ...focal.slice(0, 1),
    ...detail.slice(0, 1),
    ...fallback.slice(0, 2)
  ]).slice(0, 8);
}

function buildSectionEffectHints({
  section = "",
  energy = "",
  density = "",
  goal = "",
  sectionIndex = 0,
  sectionCount = 0,
  directorPreferences = null,
  directorProfile = null
} = {}) {
  const lowerSection = str(section).toLowerCase();
  const lowerGoal = str(goal).toLowerCase();
  const normalizedEnergy = str(energy).toLowerCase();
  const normalizedDensity = str(density).toLowerCase();
  const motionPreference = str(
    directorPreferences?.motionPreference
    || directorProfile?.preferences?.motionPreference
  ).toLowerCase();
  const focusPreference = str(
    directorPreferences?.focusPreference
    || directorProfile?.preferences?.focusPreference
  ).toLowerCase();
  const count = Number.isFinite(Number(sectionCount)) ? Math.max(0, Number(sectionCount)) : 0;
  const idx = Number.isFinite(Number(sectionIndex)) ? Math.max(0, Number(sectionIndex)) : 0;
  const nearStart = count > 1 ? idx === 0 : idx === 0;
  const nearPeak = count > 2 ? idx >= 1 && idx <= Math.max(1, count - 2) : false;
  const nearEnd = count > 1 ? idx === count - 1 : idx === 0;
  const crispBias = motionPreference === "controlled" || focusPreference === "crisp-focal" || /clarity|clean read|focused/.test(lowerGoal);
  const smoothBias = !crispBias && (motionPreference === "smooth" || /cinematic|emotionally open|glow/.test(lowerGoal));
  if (/key light|fill|lighting cue|wash|silhouette|blackout|punch/.test(lowerGoal)) {
    if (normalizedEnergy === "high" || /chorus|final/.test(lowerSection)) {
      return smoothBias
        ? pickDistinctEffects(["Color Wash", "Wave"], nearEnd ? ["Spirals", "Shimmer"] : ["Candle", "Shimmer"])
        : pickDistinctEffects(["Color Wash", "Shimmer"], crispBias ? ["Bars", "Pinwheel"] : ["Pinwheel", "Fireworks", "Meteors"]);
    }
    if (/bridge/.test(lowerSection)) {
      return pickDistinctEffects(["Bars", "Spirals"], ["Shockwave", "Wave"]);
    }
    if (normalizedEnergy === "low" || /intro|outro/.test(lowerSection)) {
      return pickDistinctEffects(["Color Wash", "Candle"], ["On", "Wave"]);
    }
    return pickDistinctEffects(["Color Wash", "Wave"], ["Butterfly", "Circles"]);
  }
  if (/rhythm|pulse|groove|drive/.test(lowerGoal)) {
    if (normalizedEnergy === "high" || /chorus|final/.test(lowerSection)) {
      return nearEnd
        ? pickDistinctEffects(["Bars", "Shockwave"], ["Meteors", "Pinwheel"])
        : pickDistinctEffects(["Meteors", "Pinwheel"], ["Shimmer", "Bars"]);
    }
    if (/bridge/.test(lowerSection)) {
      return pickDistinctEffects(["Bars", "Shockwave"], ["Wave", "Warp"]);
    }
    return pickDistinctEffects(["Wave", "Circles"], ["Butterfly", "Twinkle"]);
  }
  if (/perimeter|frame|framing|negative space|centerpiece/.test(lowerGoal)) {
    if (normalizedEnergy === "high" || /chorus|final/.test(lowerSection)) {
      return pickDistinctEffects(["Color Wash", "Pinwheel"], ["Shimmer", "Spirals"]);
    }
    if (normalizedEnergy === "low" || /intro|outro/.test(lowerSection)) {
      return pickDistinctEffects(["Color Wash", "Candle"], ["Snowflakes", "On"]);
    }
    return pickDistinctEffects(["Wave", "Butterfly"], ["Bars", "Circles"]);
  }
  if (normalizedEnergy === "high" || /chorus|payoff|finale/.test(lowerSection)) {
    if (smoothBias) {
      return nearEnd
        ? pickDistinctEffects(["Spirals", "Wave"], ["Color Wash", "Shimmer"])
        : pickDistinctEffects(["Color Wash", "Wave"], ["Shimmer", "Butterfly"]);
    }
    if (crispBias) {
      return nearEnd
        ? pickDistinctEffects(["Bars", "Meteors"], ["Shimmer", "Pinwheel"])
        : pickDistinctEffects(["Shimmer", "Bars"], ["Pinwheel", "Color Wash"]);
    }
    return nearEnd
      ? pickDistinctEffects(["Bars", "Meteors"], ["Shimmer", "Fireworks", "Pinwheel"])
      : pickDistinctEffects(FAMILY_POOLS.chorus, FAMILY_POOLS.dense);
  }
  if (normalizedDensity === "wide" || /bridge|instrumental|interlude/.test(lowerSection)) {
    return pickDistinctEffects(FAMILY_POOLS.bridge, FAMILY_POOLS.wide);
  }
  if (normalizedEnergy === "low" || /intro|outro/.test(lowerSection)) {
    return pickDistinctEffects(/outro/.test(lowerSection) ? FAMILY_POOLS.outro : FAMILY_POOLS.intro, FAMILY_POOLS.gentle);
  }
  if (nearPeak) {
    return pickDistinctEffects(FAMILY_POOLS.dense, FAMILY_POOLS.chorus);
  }
  if (nearEnd) {
    return pickDistinctEffects(FAMILY_POOLS.outro, FAMILY_POOLS.bridge);
  }
  if (nearStart) {
    return pickDistinctEffects(FAMILY_POOLS.intro, FAMILY_POOLS.gentle);
  }
  if (/pulse|rhythm|drive|movement/.test(lowerGoal)) {
    return pickDistinctEffects(FAMILY_POOLS.bridge, FAMILY_POOLS.default);
  }
  return pickDistinctEffects(FAMILY_POOLS.verse, FAMILY_POOLS.default);
}

function buildSectionIntentSummary({ section = "", energy = "", density = "", goal = "" } = {}) {
  const label = str(section);
  const lowerSection = label.toLowerCase();
  const normalizedEnergy = str(energy).toLowerCase();
  const normalizedDensity = str(density).toLowerCase();
  const lowerGoal = str(goal).toLowerCase();
  const warm = /warm|amber|gold|red|cinematic|glow|theatrical/.test(lowerGoal);
  const warmClause = warm ? ' with warm cinematic color and glow control' : '';
  if (/key light|fill|lighting cue|wash|silhouette|blackout|punch/.test(lowerGoal)) {
    if (normalizedEnergy === 'high' || /chorus|final chorus|finale/.test(lowerSection)) {
      return `build a clearer key-vs-fill hierarchy${warmClause} with stronger punch on the main reveal`;
    }
    if (/intro|outro/.test(lowerSection) || normalizedEnergy === 'low') {
      return `hold the lighting stack back${warmClause} with restrained washes and cleaner negative space`;
    }
    return `shape the section like a lighting cue${warmClause} with readable support and controlled depth`;
  }
  if (/negative space|frame|framing|centerpiece|perimeter/.test(lowerGoal)) {
    if (normalizedEnergy === 'high' || /chorus|final chorus|finale/.test(lowerSection)) {
      return `frame the reveal${warmClause} with cleaner negative space and tighter focal contrast`;
    }
    if (normalizedEnergy === 'low' || /intro|outro/.test(lowerSection)) {
      return `hold more negative space${warmClause} so the frame stays calm and uncluttered`;
    }
    return `use cleaner framing${warmClause} with more negative space and clearer focal boundaries`;
  }
  if (normalizedEnergy === 'high' || /chorus|final chorus|payoff/.test(lowerSection)) {
    if (/final chorus|finale/.test(lowerSection)) {
      return `push the final payoff${warmClause} with broader contrast, clearer hierarchy, and a stronger closing lift`;
    }
    if (/chorus/.test(lowerSection)) {
      return `open the main reveal${warmClause} with clearer focal emphasis and controlled contrast`;
    }
    return `build stronger visual payoff${warmClause} using layered shimmer, glow, and clearer focal emphasis`;
  }
  if (/bridge/.test(lowerSection)) {
    return `widen the picture${warmClause} with smoother transitions and controlled contrast lift`;
  }
  if (normalizedEnergy === 'low' || /intro|outro/.test(lowerSection)) {
    return `keep the pass restrained${warmClause} with slower fades, cleaner spacing, and readable atmosphere`;
  }
  if (normalizedDensity === 'dense') {
    return `develop the section${warmClause} with richer layering while keeping the read controlled`;
  }
  return `develop warmth and continuity${warmClause} with smooth motion and balanced supporting texture`;
}

function sanitizeDesignerSummaryText(promptText = "") {
  const raw = str(promptText);
  if (!raw) return "";
  const stripped = raw.replace(
    /^Revise existing design concept\s+D[\d.]+\s+in place\.\s+Keep the same concept identity and limit changes to sections .*? and targets .*?\.\s*/i,
    ""
  );
  return str(stripped || raw);
}

function buildTimedSectionMap(analysisHandoff = null) {
  const map = new Map();
  for (const row of arr(analysisHandoff?.structure?.sections)) {
    const label = str(row?.label || row?.name);
    const startMs = Number(row?.startMs);
    const endMs = Number(row?.endMs);
    if (!label || !Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) continue;
    map.set(label, {
      label,
      startMs,
      endMs,
      energy: str(row?.energy),
      density: str(row?.density)
    });
  }
  return map;
}

function inferPlacementAnchorMode(goal = "") {
  const lowerGoal = str(goal).toLowerCase();
  if (/\b(beat|downbeat|upbeat|pulse|beat grid)\b/.test(lowerGoal)) return "beat";
  if (/\b(chord|harmon(?:y|ic)|changes?)\b/.test(lowerGoal)) return "chord";
  if (/\b(phrase|transition|release|breath)\b/.test(lowerGoal)) return "phrase";
  return "section";
}

function buildCueWindowIndex(musicDesignContext = null) {
  const cues = musicDesignContext?.designCues?.cueWindowsBySection;
  const modes = {
    beat: new Map(),
    chord: new Map(),
    phrase: new Map()
  };
  if (!cues || typeof cues !== "object") return modes;
  for (const [section, sectionCues] of Object.entries(cues)) {
    const key = str(section);
    if (!key || !sectionCues || typeof sectionCues !== "object") continue;
    for (const mode of Object.keys(modes)) {
      const rows = arr(sectionCues?.[mode])
        .map((row) => ({
          label: str(row?.label),
          trackName: str(row?.trackName),
          startMs: Number(row?.startMs),
          endMs: Number(row?.endMs)
        }))
        .filter((row) => row.label && row.trackName && Number.isFinite(row.startMs) && Number.isFinite(row.endMs) && row.endMs > row.startMs);
      if (rows.length) {
        modes[mode].set(key, rows);
      }
    }
  }
  return modes;
}

function inferTargetLimitForSection({ energy = "", density = "" } = {}) {
  const normalizedEnergy = str(energy).toLowerCase();
  const normalizedDensity = str(density).toLowerCase();
  if (normalizedEnergy === "high") return 6;
  if (normalizedDensity === "wide") return 5;
  if (normalizedEnergy === "low") return 3;
  return 4;
}

function inferPlacementPaletteIntent({ goal = "", effectName = "", sectionIndex = 0, sectionCount = 0 } = {}) {
  const lowerGoal = str(goal).toLowerCase();
  const warm = /warm|amber|gold|cinematic|theatrical|holiday/.test(lowerGoal);
  const cool = /cool|icy|blue|winter/.test(lowerGoal);
  const effect = str(effectName).toLowerCase();
  const nearEnd = sectionCount > 0 ? sectionIndex >= Math.max(0, sectionCount - 2) : false;
  const colors = warm
    ? (["bars", "fireworks", "strobe", "meteors", "pinwheel"].includes(effect) ? ["amber", "gold", "deep red"] : ["warm gold", "amber"])
    : cool
      ? (["snowflakes", "snowstorm", "ripple", "wave"].includes(effect) ? ["ice blue", "cool white", "blue"] : ["ice blue", "cool white"])
      : nearEnd
        ? ["gold", "white"]
        : (["spirals", "butterfly", "circles", "galaxy"].includes(effect) ? ["warm gold", "purple"] : ["warm white", "amber"]);
  return {
    colors,
    temperature: warm ? "warm" : (cool ? "cool" : "neutral"),
    contrast: ["bars", "shockwave", "strobe", "meteors", "pinwheel"].includes(effect) ? "high" : "medium",
    brightness: ["shimmer", "fireworks", "strobe", "meteors"].includes(effect) ? "high" : "medium_high",
    accentUsage: ["bars", "shockwave", "strobe", "pinwheel"].includes(effect) ? "accent" : "primary"
  };
}

function inferPlacementSettingsIntent({ effectName = "", energy = "", density = "", effectIndex = 0, targetRole = "primary" } = {}) {
  const effect = str(effectName).toLowerCase();
  const normalizedEnergy = str(energy).toLowerCase();
  const normalizedDensity = str(density).toLowerCase();
  const supportTarget = targetRole === "support";
  if (["shimmer", "twinkle", "galaxy", "fireworks"].includes(effect)) {
    return {
      intensity: supportTarget ? "medium" : (normalizedEnergy === "high" ? "high" : "medium_high"),
      speed: normalizedEnergy === "high" ? "fast" : "medium",
      density: normalizedDensity === "dense" ? "medium" : "light",
      coverage: supportTarget ? "focused" : (effectIndex === 0 ? "full" : "partial"),
      motion: "sparkle",
      variation: normalizedEnergy === "high" ? "medium" : "low"
    };
  }
  if (["bars", "shockwave", "warp", "marquee", "singlestrand", "wave"].includes(effect)) {
    return {
      intensity: supportTarget ? "medium" : (normalizedEnergy === "high" ? "high" : "medium"),
      speed: normalizedEnergy === "high" ? "medium_fast" : "medium",
      density: normalizedDensity === "wide" ? "medium" : "light",
      coverage: supportTarget ? "focused" : (effectIndex === 0 ? "partial" : "focused"),
      motion: "rhythmic",
      direction: "forward",
      thickness: normalizedDensity === "wide" ? "medium" : "thin"
    };
  }
  if (["pinwheel", "spirals", "butterfly", "circles", "fan", "morph", "ripple", "spirograph"].includes(effect)) {
    return {
      intensity: supportTarget ? "medium" : (normalizedEnergy === "low" ? "medium" : "medium_high"),
      speed: normalizedEnergy === "high" ? "fast" : "medium_fast",
      density: normalizedDensity === "dense" ? "medium" : "light",
      coverage: supportTarget ? "partial" : (effectIndex === 0 ? "full" : "partial"),
      motion: "wash",
      direction: normalizedDensity === "wide" ? "outward" : "forward",
      thickness: normalizedDensity === "dense" ? "medium" : "thin",
      variation: "medium"
    };
  }
  if (["meteors", "fire", "lightning", "snowflakes", "snowstorm", "candle", "tendril"].includes(effect)) {
    return {
      intensity: supportTarget ? "medium" : (normalizedEnergy === "high" ? "high" : "medium"),
      speed: normalizedEnergy === "high" ? "fast" : "medium",
      density: normalizedDensity === "dense" ? "dense" : "medium",
      coverage: supportTarget ? "focused" : (effectIndex === 0 ? "full" : "focused"),
      motion: "rhythmic",
      direction: "reverse",
      thickness: "medium",
      variation: "medium"
    };
  }
  return {
    intensity: supportTarget ? "medium" : (normalizedEnergy === "low" ? "medium" : "medium_high"),
    speed: normalizedEnergy === "low" ? "slow" : "medium",
    density: normalizedDensity === "dense" ? "medium" : "light",
    coverage: supportTarget ? "focused" : (effectIndex === 0 ? "full" : "partial"),
    motion: "wash",
    variation: "low"
  };
}

function inferTargetRole({ goal = "", targetIndex = 0, singleScope = false } = {}) {
  const lowerGoal = str(goal).toLowerCase();
  const leadWeighted = /key light|focal|focus|centerpiece|hero|lead/.test(lowerGoal);
  const supportWeighted = /fill|support|perimeter|frame\b|framing\b|background|negative space/.test(lowerGoal);
  if (targetIndex === 0) return leadWeighted || singleScope ? "lead" : "primary";
  if (supportWeighted) return "support";
  return "secondary";
}

function shouldLayerTarget({ goal = "", energy = "", targetIndex = 0, singleScope = false } = {}) {
  const lowerGoal = str(goal).toLowerCase();
  const normalizedEnergy = str(energy).toLowerCase();
  const lightingOrCompositionScoped = /key light|fill|support|focal|centerpiece|perimeter|frame\b|framing\b|negative space|foreground|background/.test(lowerGoal);
  if (targetIndex === 0) return true;
  if (lightingOrCompositionScoped) return !singleScope && normalizedEnergy === "high" && targetIndex === 1;
  if (singleScope && targetIndex >= 1) return false;
  return normalizedEnergy === "high" && targetIndex === 1;
}

function inferPlacementLayerIntent({ effectIndex = 0, effectName = "", targetRole = "primary", energy = "", goal = "" } = {}) {
  const lower = str(effectName).toLowerCase();
  const normalizedEnergy = str(energy).toLowerCase();
  const lowerGoal = str(goal).toLowerCase();
  if (effectIndex === 0) {
    const isSupport = targetRole === "support";
    return {
      priority: isSupport ? "support" : "base",
      blendRole: isSupport ? "support_fill" : "foundation",
      overlayPolicy: "allow_overlay",
      mixAmount: isSupport
        ? "low"
        : normalizedEnergy === "high"
          ? "high"
          : "medium"
    };
  }
  const rhythmicOverlay = ["bars", "shockwave", "meteors", "strobe", "wave"].includes(lower);
  return {
    priority: "foreground",
    blendRole: rhythmicOverlay ? "rhythmic_overlay" : "accent_overlay",
    overlayPolicy: "allow_overlay",
    mixAmount: /key light|focus|focal|punch/.test(lowerGoal)
      ? "high"
      : rhythmicOverlay
        ? "medium_high"
        : "medium"
  };
}

function inferPlacementRenderIntent({ targetId = "", targetRole = "primary", goal = "", effectName = "" } = {}) {
  const lower = str(targetId).toLowerCase();
  const isAggregate = /allmodels|group|train_|upperprops|wreathes|nofloods|nomatrix/.test(lower);
  const lowerGoal = str(goal).toLowerCase();
  const effect = str(effectName).toLowerCase();
  const supportWeighted = targetRole === "support" || /fill|support|perimeter|frame\b|framing\b|background|negative space/.test(lowerGoal);
  const rhythmicWeighted = /rhythm|pulse|drive|beat/.test(lowerGoal) || ["bars", "shockwave", "meteors", "wave"].includes(effect);
  return {
    groupPolicy: isAggregate || supportWeighted ? "preserve_group_rendering" : "no_expand",
    bufferStyle: rhythmicWeighted ? "overlay_scaled" : (supportWeighted ? "inherit" : "inherit"),
    expansionPolicy: isAggregate || supportWeighted ? "preserve" : "no_expand",
    riskTolerance: isAggregate || supportWeighted ? "low" : "medium"
  };
}

function buildPlacementWindow({ startMs = 0, endMs = 0, effectIndex = 0, effectCount = 1, energy = "" } = {}) {
  const start = Number(startMs);
  const end = Number(endMs);
  const duration = Math.max(1, end - start);
  const normalizedEnergy = str(energy).toLowerCase();
  if (effectCount <= 1 || effectIndex <= 0) {
    return { startMs: start, endMs: end };
  }
  if (effectIndex === 1) {
    const offsetStart = normalizedEnergy === "high" ? 0.18 : 0.24;
    const offsetEnd = normalizedEnergy === "high" ? 0.82 : 0.76;
    return {
      startMs: Math.round(start + (duration * offsetStart)),
      endMs: Math.round(start + (duration * offsetEnd))
    };
  }
  return {
    startMs: Math.round(start + (duration * 0.52)),
    endMs: Math.round(start + (duration * 0.92))
  };
}

function buildEffectPlacements({ sectionPlans = [], timedSections = new Map(), goal = "", musicDesignContext = null, passScope = "" } = {}) {
  const placements = [];
  const plans = arr(sectionPlans);
  const sectionCount = plans.length;
  const anchorMode = inferPlacementAnchorMode(goal);
  const cueWindowIndex = buildCueWindowIndex(musicDesignContext);
  for (let sectionIndex = 0; sectionIndex < plans.length; sectionIndex += 1) {
    const plan = plans[sectionIndex];
    const section = str(plan?.section);
    const timed = timedSections.get(section);
    if (!timed) continue;
    const cueWindows = anchorMode === "section" ? [] : arr(cueWindowIndex?.[anchorMode]?.get(section));
    const targets = arr(plan?.targetIds).map((row) => str(row)).filter(Boolean).slice(0, inferTargetLimitForSection({
      energy: plan?.energy,
      density: plan?.density
    }));
    const effectHints = arr(plan?.effectHints).map((row) => str(row)).filter(Boolean);
    if (!targets.length || !effectHints.length) continue;
    for (let targetIndex = 0; targetIndex < targets.length; targetIndex += 1) {
      const targetId = targets[targetIndex];
      const targetRole = inferTargetRole({
        goal,
        targetIndex,
        singleScope: passScope === "single_section"
      });
      const perTargetEffectHints = shouldLayerTarget({
        goal,
        energy: plan?.energy,
        targetIndex,
        singleScope: passScope === "single_section"
      })
        ? effectHints.slice(0, Math.min(2, effectHints.length))
        : effectHints.slice(0, 1);
      for (let effectIndex = 0; effectIndex < perTargetEffectHints.length; effectIndex += 1) {
        const effectName = perTargetEffectHints[effectIndex];
        const cueWindow = cueWindows.length ? cueWindows[Math.min(effectIndex, cueWindows.length - 1)] : null;
        const window = cueWindow
          ? { startMs: cueWindow.startMs, endMs: cueWindow.endMs }
          : buildPlacementWindow({
              startMs: timed.startMs,
              endMs: timed.endMs,
              effectIndex,
              effectCount: perTargetEffectHints.length,
              energy: plan?.energy
            });
        placements.push({
          placementId: `placement-${sectionIndex + 1}-${targetIndex + 1}-${effectIndex + 1}`,
          designId: str(plan?.designId),
          designRevision: Number.isInteger(Number(plan?.designRevision)) ? Number(plan.designRevision) : 0,
          designAuthor: str(plan?.designAuthor || "designer"),
          targetId,
          layerIndex: effectIndex,
          effectName,
          startMs: window.startMs,
          endMs: window.endMs,
          timingContext: {
            trackName: cueWindow?.trackName || "XD: Song Structure",
            anchorLabel: cueWindow?.label || section,
            anchorStartMs: cueWindow?.startMs || timed.startMs,
            anchorEndMs: cueWindow?.endMs || timed.endMs,
            alignmentMode: cueWindow ? `${anchorMode}_window` : effectIndex === 0 ? "section_span" : "within_section"
          },
          creative: {
            role: effectIndex === 0
              ? (targetRole === "support" ? "section_support" : "section_foundation")
              : "section_accent",
            purpose: str(plan?.intentSummary),
            notes: effectIndex === 0
              ? `Primary ${effectName} layer for ${section}.`
              : `Overlay ${effectName} accent for ${section}.`
          },
          settingsIntent: inferPlacementSettingsIntent({
            effectName,
            energy: plan?.energy,
            density: plan?.density,
            effectIndex,
            targetRole
          }),
          paletteIntent: inferPlacementPaletteIntent({
            goal,
            effectName,
            sectionIndex,
            sectionCount
          }),
          layerIntent: inferPlacementLayerIntent({
            effectIndex,
            effectName,
            targetRole,
            energy: plan?.energy,
            goal
          }),
          renderIntent: inferPlacementRenderIntent({
            targetId,
            targetRole,
            goal,
            effectName
          }),
          constraints: {
            mustAlignToTiming: true,
            preserveExistingEffects: false,
            mustNotOverlap: false
          },
          sourceSectionLabel: section
        });
      }
    }
  }
  return placements;
}

function buildDesignerExecutionPlan({
  normalizedIntent = null,
  analysisHandoff = null,
  musicDesignContext = null,
  designSceneContext = null,
  targets = [],
  directorPreferences = null,
  directorProfile = null
} = {}) {
  const intent = isPlainObject(normalizedIntent) ? normalizedIntent : {};
  const targetIds = arr(intent.targetIds).filter(Boolean);
  const tagNames = arr(intent.tags).filter(Boolean);
  const explicitSections = arr(intent.sections).filter(Boolean);
  const sectionArc = arr(musicDesignContext?.sectionArc)
    .map((row) => ({
      label: str(row?.label),
      energy: str(row?.energy),
      density: str(row?.density)
    }))
    .filter((row) => row.label);
  const analyzedSections = arr(analysisHandoff?.structure?.sections)
    .map((row) => ({
      label: str(row?.label || row?.name),
      energy: str(row?.energy),
      density: str(row?.density)
    }))
    .filter((row) => row.label);
  const availableSections = sectionArc.length ? sectionArc : analyzedSections;
  const scene = isPlainObject(designSceneContext) ? designSceneContext : {};
  const broadCoverageDomains = arr(scene?.coverageDomains?.broad).map((row) => str(row)).filter(Boolean);
  const detailCoverageDomains = arr(scene?.coverageDomains?.detail).map((row) => str(row)).filter(Boolean);
  const focalCandidates = arr(scene?.focalCandidates).map((row) => str(row)).filter(Boolean);
  const spatialZones = scene?.spatialZones && typeof scene.spatialZones === "object" ? scene.spatialZones : {};
  const resolvedTargetIds = arr(targets).map((row) => str(row?.id || row?.name)).filter(Boolean);
  const lowerGoal = str(intent.goal).toLowerCase();
  const hasSpatialDirective = /foreground|background|left side|right side|perimeter|frame\b|framing\b|centerpiece|center props|negative space/.test(lowerGoal);
  const explicitTagScope = str(intent?.tagScopeMode).toLowerCase() === "explicit";
  const scopedTargetIds = targetIds.length ? targetIds : (explicitTagScope && tagNames.length && !hasSpatialDirective ? resolvedTargetIds : []);
  const timedSections = buildTimedSectionMap(analysisHandoff);
  const allowGlobalRewrite = Boolean(intent?.preservationConstraints?.allowGlobalRewrite);
  const reviseInPlace = str(intent?.mode).toLowerCase() === "revise";
  const passScope = allowGlobalRewrite
    ? "whole_sequence"
    : explicitSections.length > 1
      ? "multi_section"
      : explicitSections.length === 1
        ? "single_section"
        : "whole_sequence";
  const sharedRevisionDesignId = reviseInPlace && !allowGlobalRewrite && explicitSections.length ? "DES-001" : "";
  const primarySections = (explicitSections.length ? explicitSections : availableSections.map((row) => row.label)).slice(0, 24);
  const normalizedSections = (primarySections.length ? primarySections : availableSections.map((row) => row.label))
    .slice(0, 24);
  const sectionPlans = normalizedSections
    .map((label, idx) => {
      const match = availableSections.find((row) => str(row.label) === str(label));
      const energy = str(match?.energy);
      const density = str(match?.density);
      return {
        designId: sharedRevisionDesignId || `DES-${String(idx + 1).padStart(3, "0")}`,
        designRevision: 0,
        designAuthor: "designer",
        section: str(label),
        energy,
        density,
        intentSummary: buildSectionIntentSummary({
          section: label,
          energy,
          density,
          goal: intent.goal || ""
        }),
        targetIds: chooseExecutionTargets({
          explicitTargetIds: scopedTargetIds,
          fallbackTargetIds: resolvedTargetIds,
          broadCoverageDomains,
          detailCoverageDomains,
          focalCandidates,
          spatialZones,
          singleScope: passScope === "single_section",
          tagDriven: tagNames.length > 0,
          energy,
          density,
          section: label,
          goal: intent.goal || ""
        }).slice(0, 40),
        effectHints: arr(intent.effectOverrides).length
          ? arr(intent.effectOverrides).map((row) => str(row)).filter(Boolean)
          : buildSectionEffectHints({
              section: label,
              energy,
              density,
              goal: intent.goal || "",
              sectionIndex: idx,
              sectionCount: normalizedSections.length,
              directorPreferences,
              directorProfile
            })
      };
    });
  const effectPlacements = buildEffectPlacements({
    sectionPlans,
    timedSections,
    goal: intent.goal || "",
    musicDesignContext,
    passScope
  });

  return {
    passScope,
    implementationMode: passScope === "whole_sequence" ? "whole_sequence_pass" : "section_pass",
    routePreference: "designer_to_sequence_agent",
    reviewMode: "designer_review_required",
    shouldUseFullSongStructureTrack: true,
    sectionCount: primarySections.length,
    targetCount: (targetIds.length ? targetIds : arr(targets)).length,
    primarySections,
    sectionPlans,
    effectPlacements
  };
}

export function buildProposalBundleArtifact({
  requestId = "",
  sequenceRevision = "unknown",
  promptText = "",
  creativeBrief = null,
  analysisHandoff = null,
  selectedSections = [],
  selectedTagNames = [],
  selectedTargetIds = [],
  directorPreferences = null,
  models = [],
  submodels = [],
  displayElements = [],
  metadataAssignments = [],
  directorProfile = null,
  designSceneContext = null,
  musicDesignContext = null
} = {}) {
  const resolvedSceneContext = isPlainObject(designSceneContext)
    ? designSceneContext
    : buildDesignSceneContext({
        sceneGraph: {
          modelsById: Object.fromEntries(arr(models).map((row) => [str(row?.id || row?.name), row])),
          groupsById: {},
          submodelsById: Object.fromEntries(arr(submodels).map((row) => [str(row?.id || row?.name), row])),
          stats: { layoutMode: "unknown" }
        },
        revision: "unknown"
      });
  const resolvedMusicContext = isPlainObject(musicDesignContext)
    ? musicDesignContext
    : buildMusicDesignContext({
        analysisArtifact: null,
        analysisHandoff
      });
  const input = buildDesignerDialogInput({
    requestId,
    sequenceRevision,
    route: "design",
    selection: {
      sectionNames: selectedSections,
      targetIds: selectedTargetIds,
      tagNames: selectedTagNames
    },
    promptText,
    creativeBrief,
    analysisHandoff,
    directorProfile,
    designSceneContext: resolvedSceneContext,
    musicDesignContext: resolvedMusicContext
  });
  const inputGate = validateDesignerDialogContractGate("input", input, requestId);
  const plan = buildProposalFromIntent({
    promptText,
    selectedSections,
    creativeBrief,
    selectedTagNames,
    selectedTargetIds,
    directorPreferences,
    directorProfile,
    designSceneContext: resolvedSceneContext,
    musicDesignContext: resolvedMusicContext,
    models,
    submodels,
    displayElements,
    metadataAssignments
  });
  const clarificationPlan = buildClarificationPlan({
    normalizedIntent: plan.normalizedIntent,
    targets: plan.targets,
    analysisHandoff,
    directorPreferences
  });
  const proposalLines = mergeCreativeBriefIntoProposalLines(plan.proposalLines, creativeBrief);
  const executionPlan = buildDesignerExecutionPlan({
    normalizedIntent: plan.normalizedIntent,
    analysisHandoff,
    musicDesignContext: resolvedMusicContext,
    designSceneContext: resolvedSceneContext,
    targets: plan.targets,
    directorPreferences,
    directorProfile
  });
  const proposalBundle = buildProposalBundle({
    proposalId: makeId("proposal"),
    summary: sanitizeDesignerSummaryText(promptText || plan.normalizedIntent?.goal || "Designer proposal generated from current conversation."),
    baseRevision: str(sequenceRevision || "unknown"),
    scope: {
      sections: arr(plan.normalizedIntent?.sections),
      targetIds: arr(plan.normalizedIntent?.targetIds),
      tagNames: arr(plan.normalizedIntent?.tags),
      summary: summarizeScope({
        sections: plan.normalizedIntent?.sections,
        targetIds: plan.normalizedIntent?.targetIds,
        tagNames: plan.normalizedIntent?.tags
      })
    },
    constraints: {
      changeTolerance: str(plan.normalizedIntent?.changeTolerance || "moderate"),
      preserveTimingTracks: plan.normalizedIntent?.preservationConstraints?.preserveTimingTracks !== false,
      preserveDisplayOrder: plan.normalizedIntent?.preservationConstraints?.preserveDisplayOrder !== false,
      allowGlobalRewrite: Boolean(plan.normalizedIntent?.preservationConstraints?.allowGlobalRewrite)
    },
    lifecycle: buildProposalLifecycle(sequenceRevision),
    proposalLines,
    guidedQuestions: arr(clarificationPlan.questions).map((row) => str(row.question)).filter(Boolean),
    assumptions: arr(clarificationPlan.assumptions),
    riskNotes: [
      ...buildProposalRiskNotes({
        clarificationPlan,
        normalizedIntent: plan.normalizedIntent
      }),
      ...arr(plan.normalizedIntent?.safetyConstraints).map((row) => `Honor safety constraint: ${str(row)}`)
    ],
    impact: {
      estimatedImpact: estimateImpact({ proposalLines, targets: plan.targets }),
      resolvedTargetCount: arr(plan.targets).length,
      assumptionCount: arr(clarificationPlan.assumptions).length
    },
    executionPlan,
    traceability: {
      directorProfileSignals: isPlainObject(directorProfile?.preferences)
        ? {
            preferenceKeys: Object.keys(directorProfile.preferences),
            summary: str(directorProfile?.summary || directorProfile?.profileSummary)
          }
        : {
            preferenceKeys: [],
            summary: ""
          },
      designSceneSignals: {
        layoutMode: str(resolvedSceneContext?.metadata?.layoutMode),
        focalCandidates: arr(resolvedSceneContext?.focalCandidates).slice(0, 8),
        broadCoverageDomains: arr(resolvedSceneContext?.coverageDomains?.broad).slice(0, 8),
        detailCoverageDomains: arr(resolvedSceneContext?.coverageDomains?.detail).slice(0, 8)
      },
      musicDesignSignals: {
        sectionArc: arr(resolvedMusicContext?.sectionArc).slice(0, 8).map((row) => ({
          label: str(row?.label),
          energy: str(row?.energy),
          density: str(row?.density)
        })),
        revealMoments: arr(resolvedMusicContext?.designCues?.revealMoments).slice(0, 8),
        holdMoments: arr(resolvedMusicContext?.designCues?.holdMoments).slice(0, 8),
        lyricFocusMoments: arr(resolvedMusicContext?.designCues?.lyricFocusMoments).slice(0, 8)
      }
    }
  });

  return {
    input,
    inputGate,
    plan,
    clarificationPlan,
    proposalBundle,
    proposalGate: validateDesignerDialogContractGate("proposal", proposalBundle, requestId)
  };
}

export function executeDesignerDialogFlow({
  requestId = "",
  sequenceRevision = "unknown",
  promptText = "",
  selectedSections = [],
  selectedTagNames = [],
  selectedTargetIds = [],
  goals = "",
  inspiration = "",
  notes = "",
  references = [],
  audioAnalysis = null,
  songContextSummary = "",
  analysisHandoff = null,
  analysisArtifact = null,
  directorPreferences = null,
  directorProfile = null,
  designSceneContext = null,
  musicDesignContext = null,
  priorBrief = null,
  elevatedRiskConfirmed = false,
  models = [],
  submodels = [],
  displayElements = [],
  metadataAssignments = []
} = {}) {
  try {
    if (!hasMeaningfulCreativeInput({ promptText, goals, inspiration, notes, priorBrief })) {
      return buildDesignerDialogResult({
        requestId,
        status: "failed",
        failureReason: "clarification",
        warnings: ["Designer kickoff needs at least one meaningful creative input before proposal generation can proceed."],
        summary: "Designer kickoff needs clarification."
      });
    }
    const resolvedRequestId = str(requestId || makeId("designer"));
    const { brief, gate: briefGate } = buildCreativeBriefArtifact({
      requestId: resolvedRequestId,
      goals,
      inspiration,
      notes,
      references,
      audioAnalysis,
      songContextSummary,
      latestIntent: promptText,
      directorPreferences,
      directorProfile,
      designSceneContext,
      musicDesignContext,
      priorBrief
    });
    const proposal = buildProposalBundleArtifact({
      requestId: resolvedRequestId,
      sequenceRevision,
      promptText,
      creativeBrief: brief,
      analysisHandoff,
      analysisArtifact,
      selectedSections,
      selectedTagNames,
      selectedTargetIds,
      directorPreferences,
      directorProfile,
      designSceneContext,
      musicDesignContext,
      models,
      submodels,
      displayElements,
      metadataAssignments
    });
    const handoff = buildIntentHandoffFromDesignerState({
      normalizedIntent: proposal.plan.normalizedIntent,
      intentText: promptText,
      creativeBrief: brief,
      elevatedRiskConfirmed,
      executionStrategy: proposal.proposalBundle?.executionPlan || null,
      resolvedTargetIds: proposal.plan.resolutionSource === "fallback"
        ? []
        : arr(proposal.plan.targets).map((row) => str(row?.id || row?.name)).filter(Boolean)
    });

    const warnings = [];
    if (!analysisHandoff) {
      warnings.push("Proceeding without analysis_handoff_v1. Proposal is in degraded mode and should be reviewed more conservatively.");
    }
    if (!briefGate.ok) warnings.push(...briefGate.report.errors);
    if (!proposal.inputGate.ok) warnings.push(...proposal.inputGate.report.errors);
    if (!proposal.proposalGate.ok) warnings.push(...proposal.proposalGate.report.errors);

    return buildDesignerDialogResult({
      requestId: resolvedRequestId,
      status: warnings.length ? "partial" : "ok",
      failureReason: warnings.length ? "proposal_generation" : null,
      creativeBrief: brief,
      proposalBundle: proposal.proposalBundle,
      handoff,
      warnings,
      summary: proposal.proposalBundle.summary
    });
  } catch (err) {
    return buildDesignerDialogResult({
      requestId,
      status: "failed",
      failureReason: classifyDesignerDialogFailureReason("runtime", err?.message || ""),
      warnings: [str(err?.message || "Designer flow failed.")],
      summary: "Designer flow failed."
    });
  }
}
