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
  rap: ["Bars", "Shockwave", "Wave", "Color Wash", "Meteors"],
  solo: ["Pinwheel", "Meteors", "Color Wash", "Wave", "Shimmer"],
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

function prioritizeConcreteTargets(targetIds = []) {
  const aggregatePattern = /(^|\/)(allmodels|allmodels_|.*_all$|.*_nofloods$|.*_nomatrix$)/i;
  const concrete = [];
  const aggregate = [];
  for (const targetId of uniqueStrings(targetIds)) {
    if (aggregatePattern.test(str(targetId))) aggregate.push(targetId);
    else concrete.push(targetId);
  }
  return concrete.length ? [...concrete, ...aggregate] : aggregate;
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
  const stableFocal = uniqueStrings(focalCandidates);
  const stableDetail = uniqueStrings(detailCoverageDomains);
  const stableFallback = uniqueStrings(fallbackTargetIds);
  const zones = spatialZones && typeof spatialZones === "object" ? spatialZones : {};
  const foreground = uniqueStrings(arr(zones.foreground));
  const background = uniqueStrings(arr(zones.background));
  const left = uniqueStrings(arr(zones.left));
  const right = uniqueStrings(arr(zones.right));
  const center = uniqueStrings(arr(zones.center));
  const key = str(section).toLowerCase();
  const lowerGoal = str(goal).toLowerCase();
  const uniformHierarchy = /same emphasis|share the same emphasis|visually even|even look|no real focal hierarchy|minimal hierarchy/.test(lowerGoal);
  const normalizedEnergy = str(energy).toLowerCase();
  const normalizedDensity = str(density).toLowerCase();
  const isPeak = normalizedEnergy === 'high' || /chorus|finale|outro payoff/.test(key);
  const isGentle = normalizedEnergy === 'low' || /intro|outro/.test(key);
  const isWide = normalizedDensity === "wide" || /bridge|instrumental|interlude/.test(key);
  const isRap = /(^|\b)(rap|rap section)\b/.test(key);
  const isSolo = /(^|\b)(solo|instrumental solo)\b/.test(key);
  const focusedRap = isRap && /\b(clipped|rhythmic delivery|narrower focus|tighten the motion)\b/.test(lowerGoal);
  const chorusLikeRap = isRap && /\b(singing-chorus language|broad.*chorus|same broad)\b/.test(lowerGoal);
  const focusedSolo = isSolo && /\b(feature|featured|spotlight|detour|narrower focus)\b/.test(lowerGoal);
  const chorusLikeSolo = isSolo && /\b(broad chorus pass|same broad chorus language|spread.*everywhere)\b/.test(lowerGoal);
  const restrainedSupport = !uniformHierarchy && /negative space|lighter framing|restrained|support|visual weight|impact budget|carry the weight|support lighter|large footprint|large-footprint/.test(lowerGoal);
  const impactBudgetGoal = /visual weight|impact budget|carry the weight|support lighter|large footprint|large-footprint/.test(lowerGoal);
  const floodedImpactBudgetGoal = /same weight|equal emphasis|flooding the whole layout|spend the visual impact budget immediately|whole layout whenever possible/.test(lowerGoal);
  const controlledFinale = isControlledFinaleGoal(lowerGoal);
  const floodedFinale = isFloodedFinaleGoal(lowerGoal);
  const variedHierarchy = !uniformHierarchy && isVariedHierarchyGoal(lowerGoal);
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
  if (floodedImpactBudgetGoal && !singleScope && !tagDriven) {
    return prioritizeConcreteTargets([
      ...focal.slice(0, 2),
      ...broad.slice(0, 2),
      ...detail.slice(0, 2),
      ...left.slice(0, 1),
      ...right.slice(0, 1),
      ...fallback.slice(0, 3)
    ]).slice(0, 8);
  }
  if (impactBudgetGoal && !singleScope && !tagDriven) {
    const stableSupport = prioritizeConcreteTargets([
      ...center.slice(0, 1),
      ...stableFocal.slice(0, 2),
      ...stableDetail.slice(0, 1),
      ...left.slice(0, 1),
      ...right.slice(0, 1),
      ...stableFallback.slice(0, 2)
    ]);
    if (isPeak || controlledFinale) {
      return stableSupport.slice(0, 5);
    }
    return stableSupport.slice(0, 4);
  }
  if (!uniformHierarchy && (/perimeter/.test(lowerGoal) || /frame\b|framing\b/.test(lowerGoal))) {
    if (restrainedSupport && !isPeak) {
      return prioritizeConcreteTargets([
        ...left.slice(0, 1),
        ...right.slice(0, 1),
        ...detail.slice(0, 1),
        ...focal.slice(0, 1),
        ...fallback.slice(0, 2)
      ]).slice(0, 5);
    }
    return prioritizeConcreteTargets([
      ...left.slice(0, 1),
      ...right.slice(0, 1),
      ...foreground.slice(0, 2),
      ...broad.slice(0, 2),
      ...center.slice(0, 1),
      ...focal.slice(0, 1),
      ...fallback.slice(0, 3)
    ]).slice(0, 8);
  }
  if (!uniformHierarchy && /centerpiece|center props|key light|focal/.test(lowerGoal)) {
    return prioritizeConcreteTargets([
      ...center.slice(0, 2),
      ...focal.slice(0, 2),
      ...detail.slice(0, 1),
      ...broad.slice(0, 2),
      ...fallback.slice(0, 3)
    ]).slice(0, 8);
  }
  if (singleScope || tagDriven) {
    if (focusedRap) {
      return prioritizeConcreteTargets([
        ...focal.slice(0, 2),
        ...detail.slice(0, 1),
        ...center.slice(0, 1),
        ...fallback.slice(0, 1)
      ]).slice(0, 4);
    }
    if (chorusLikeRap) {
      return prioritizeConcreteTargets([
        ...focal.slice(0, 2),
        ...detail.slice(0, 2),
        ...broad.slice(0, 2),
        ...fallback.slice(0, 2)
      ]).slice(0, 8);
    }
    if (focusedSolo) {
      return prioritizeConcreteTargets([
        ...focal.slice(0, 2),
        ...center.slice(0, 1),
        ...detail.slice(0, 1),
        ...fallback.slice(0, 1)
      ]).slice(0, 4);
    }
    if (chorusLikeSolo) {
      return prioritizeConcreteTargets([
        ...focal.slice(0, 2),
        ...detail.slice(0, 2),
        ...broad.slice(0, 2),
        ...fallback.slice(0, 2)
      ]).slice(0, 8);
    }
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
  if (variedHierarchy) {
    return prioritizeConcreteTargets([
      ...uniqueStrings(focalCandidates).slice(0, 2),
      ...uniqueStrings(detailCoverageDomains).slice(0, 1),
      ...uniqueStrings(fallbackTargetIds).slice(0, 1)
    ]).slice(0, 4);
  }
  if (restrainedSupport && !isPeak) {
    return prioritizeConcreteTargets([
      ...detail.slice(0, 1),
      ...left.slice(0, 1),
      ...right.slice(0, 1),
      ...focal.slice(0, 1),
      ...fallback.slice(0, 2)
    ]).slice(0, 5);
  }
  if (isPeak) {
    if (/final chorus|finale/.test(key) && controlledFinale) {
      return uniqueStrings([
        ...focal.slice(0, 2),
        ...detail.slice(0, 2),
        ...fallback.slice(0, 2)
      ]).slice(0, 5);
    }
    if (/final chorus|finale/.test(key) && floodedFinale) {
      return uniqueStrings([
        ...focal.slice(0, 2),
        ...detail.slice(0, 2),
        ...broad.slice(0, 2),
        ...fallback.slice(0, 2)
      ]).slice(0, 8);
    }
    return uniqueStrings([
      ...focal.slice(0, 2),
      ...detail.slice(0, 2),
      ...broad.slice(0, 2),
      ...fallback.slice(0, 2)
    ]).slice(0, 8);
  }
  if (focusedRap) {
    return prioritizeConcreteTargets([
      ...focal.slice(0, 2),
      ...detail.slice(0, 1),
      ...center.slice(0, 1),
      ...fallback.slice(0, 1)
    ]).slice(0, 4);
  }
  if (chorusLikeRap) {
    return prioritizeConcreteTargets([
      ...focal.slice(0, 2),
      ...detail.slice(0, 2),
      ...broad.slice(0, 2),
      ...fallback.slice(0, 2)
    ]).slice(0, 8);
  }
  if (focusedSolo) {
    return prioritizeConcreteTargets([
      ...focal.slice(0, 2),
      ...center.slice(0, 1),
      ...detail.slice(0, 1),
      ...fallback.slice(0, 1)
    ]).slice(0, 4);
  }
  if (chorusLikeSolo) {
    return prioritizeConcreteTargets([
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
  const uniformHierarchy = /same emphasis|share the same emphasis|visually even|even look|no real focal hierarchy|minimal hierarchy/.test(lowerGoal);
  const suspendedBridge = isSuspendedBridgeGoal(lowerGoal);
  const chorusLikeBridge = isChorusLikeBridgeGoal(lowerGoal);
  const controlledFinale = isControlledFinaleGoal(lowerGoal);
  const floodedFinale = isFloodedFinaleGoal(lowerGoal);
  const focusedDrop = isFocusedDropGoal(lowerGoal);
  const diffusedDrop = isDiffusedDropGoal(lowerGoal);
  const resolvingTag = isResolvingTagGoal(lowerGoal);
  const overblownTag = isOverblownTagGoal(lowerGoal);
  const resolvingCoda = isResolvingCodaGoal(lowerGoal);
  const overblownCoda = isOverblownCodaGoal(lowerGoal);
  const contrastingMiddle8 = isContrastingMiddle8Goal(lowerGoal);
  const chorusLikeMiddle8 = isChorusLikeMiddle8Goal(lowerGoal);
  const hookEchoPostChorus = isHookEchoPostChorusGoal(lowerGoal);
  const verseLikePostChorus = isVerseLikePostChorusGoal(lowerGoal);
  const escalationGoal = isEscalationPacingGoal(lowerGoal);
  const flattenedEscalation = isFlattenedEscalationGoal(lowerGoal);
  const focusedRap = /(^|\b)(rap|rap section)\b/.test(lowerSection)
    && /\b(clipped|rhythmic delivery|narrower focus|tighten the motion)\b/.test(lowerGoal);
  const chorusLikeRap = /(^|\b)(rap|rap section)\b/.test(lowerSection)
    && /\b(singing-chorus language|broad.*chorus|same broad)\b/.test(lowerGoal);
  const focusedSolo = /(^|\b)(solo|instrumental solo)\b/.test(lowerSection)
    && /\b(feature|featured|spotlight|detour|narrower focus)\b/.test(lowerGoal);
  const chorusLikeSolo = /(^|\b)(solo|instrumental solo)\b/.test(lowerSection)
    && /\b(broad chorus pass|same broad chorus language|spread.*everywhere)\b/.test(lowerGoal);
  if (!uniformHierarchy && /key light|fill|lighting cue|wash|silhouette|blackout|punch|visual weight|impact budget/.test(lowerGoal)) {
    if (normalizedEnergy === "high" || /chorus|final/.test(lowerSection)) {
      return smoothBias
        ? pickDistinctEffects(["Color Wash", "Wave"], nearEnd ? ["Spirals", "Shimmer"] : ["Candle", "Shimmer"])
        : pickDistinctEffects(["Color Wash", "Shimmer"], crispBias ? ["Bars", "Pinwheel"] : ["Pinwheel", "Fireworks", "Meteors"]);
    }
    if (/bridge/.test(lowerSection)) {
      return pickDistinctEffects(["Wave", "Bars"], ["Spirals", "Color Wash"]);
    }
    if (normalizedEnergy === "low" || /intro|outro|coda/.test(lowerSection)) {
      return pickDistinctEffects(["Color Wash", "Candle"], ["On", "Wave"]);
    }
    return pickDistinctEffects(["Color Wash", "Wave"], ["Butterfly", "Circles"]);
  }
  if (/\b(phrase|transition|release|breath)\b/.test(lowerGoal) && /bridge/.test(lowerSection)) {
    if (suspendedBridge) {
      return pickDistinctEffects(["Wave", "Color Wash"], ["Candle", "Spirals"]);
    }
    if (chorusLikeBridge) {
      return pickDistinctEffects(["Bars", "Shimmer"], ["Meteors", "Pinwheel"]);
    }
    return pickDistinctEffects(["Wave", "Bars"], ["Spirals", "Color Wash"]);
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
  if (!uniformHierarchy && /perimeter|frame|framing|negative space|centerpiece/.test(lowerGoal)) {
    if (normalizedEnergy === "high" || /chorus|final/.test(lowerSection)) {
      return pickDistinctEffects(["Color Wash", "Pinwheel"], ["Shimmer", "Spirals"]);
    }
    if (/bridge/.test(lowerSection)) {
      return pickDistinctEffects(["Wave", "Bars"], ["Spirals", "Color Wash"]);
    }
    if (normalizedEnergy === "low" || /intro|outro|coda/.test(lowerSection)) {
      return pickDistinctEffects(["Color Wash", "Candle"], ["Snowflakes", "On"]);
    }
    return pickDistinctEffects(["Wave", "Butterfly"], ["Bars", "Circles"]);
  }
  if (normalizedEnergy === "high" || /chorus|payoff|finale/.test(lowerSection)) {
    if (/drop/.test(lowerSection) && focusedDrop) {
      return pickDistinctEffects(["Shockwave", "Bars"], ["Meteors", "Pinwheel"]);
    }
    if (/drop/.test(lowerSection) && diffusedDrop) {
      return pickDistinctEffects(["Wave", "Color Wash"], ["Spirals", "Morph"]);
    }
    if (/final chorus|finale/.test(lowerSection) && controlledFinale) {
      return pickDistinctEffects(["Bars", "Wave"], ["Shimmer", "Color Wash"]);
    }
    if (/final chorus|finale/.test(lowerSection) && floodedFinale) {
      return pickDistinctEffects(["Bars", "Meteors"], ["Shimmer", "Pinwheel"]);
    }
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
  if (/tag/.test(lowerSection)) {
    if (resolvingTag) {
      return pickDistinctEffects(["Color Wash", "Candle"], ["Wave", "Shimmer"]);
    }
    if (overblownTag) {
      return pickDistinctEffects(["Bars", "Meteors"], ["Shimmer", "Pinwheel"]);
    }
    return pickDistinctEffects(["Wave", "Color Wash"], ["Candle", "Shimmer"]);
  }
  if (/coda/.test(lowerSection)) {
    if (resolvingCoda) {
      return pickDistinctEffects(["Wave", "Color Wash"], ["Candle", "On"]);
    }
    if (overblownCoda) {
      return pickDistinctEffects(["Bars", "Meteors"], ["Shimmer", "Pinwheel"]);
    }
    return pickDistinctEffects(["Color Wash", "Candle"], ["Wave", "On"]);
  }
  if (/middle 8/.test(lowerSection)) {
    if (contrastingMiddle8) {
      return pickDistinctEffects(["Wave", "Color Wash"], ["Candle", "Spirals"]);
    }
    if (chorusLikeMiddle8) {
      return pickDistinctEffects(["Bars", "Shimmer"], ["Meteors", "Pinwheel"]);
    }
    return pickDistinctEffects(["Wave", "Bars"], ["Spirals", "Color Wash"]);
  }
  if (/post-?chorus/.test(lowerSection)) {
    if (hookEchoPostChorus) {
      return pickDistinctEffects(["Shimmer", "Wave"], ["Color Wash", "Candle"]);
    }
    if (verseLikePostChorus) {
      return pickDistinctEffects(["Color Wash", "Candle"], ["Wave", "Butterfly"]);
    }
    return pickDistinctEffects(["Shimmer", "Color Wash"], ["Wave", "Bars"]);
  }
  if (focusedRap) {
    return pickDistinctEffects(FAMILY_POOLS.rap, ["Bars", "Shockwave"]);
  }
  if (chorusLikeRap) {
    return pickDistinctEffects(FAMILY_POOLS.chorus, FAMILY_POOLS.dense);
  }
  if (focusedSolo) {
    return pickDistinctEffects(FAMILY_POOLS.solo, ["Pinwheel", "Color Wash"]);
  }
  if (chorusLikeSolo) {
    return pickDistinctEffects(FAMILY_POOLS.chorus, FAMILY_POOLS.dense);
  }
  if (normalizedDensity === "wide" || /bridge|instrumental|interlude/.test(lowerSection)) {
    return pickDistinctEffects(FAMILY_POOLS.bridge, FAMILY_POOLS.wide);
  }
  if (escalationGoal && /verse 1/.test(lowerSection)) {
    return flattenedEscalation
      ? pickDistinctEffects(["Shimmer", "Bars"], ["Wave", "Color Wash"])
      : pickDistinctEffects(["Color Wash", "Candle"], ["Wave", "Butterfly"]);
  }
  if (normalizedEnergy === "low" || /intro|outro|coda/.test(lowerSection)) {
    return pickDistinctEffects(/outro|coda/.test(lowerSection) ? FAMILY_POOLS.outro : FAMILY_POOLS.intro, FAMILY_POOLS.gentle);
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
  const uniformHierarchy = /same emphasis|share the same emphasis|visually even|even look|no real focal hierarchy|minimal hierarchy/.test(lowerGoal);
  const warm = /warm|amber|gold|red|cinematic|glow|theatrical/.test(lowerGoal);
  const warmClause = warm ? ' with warm cinematic color and glow control' : '';
  const suspendedBridge = isSuspendedBridgeGoal(lowerGoal);
  const chorusLikeBridge = isChorusLikeBridgeGoal(lowerGoal);
  const controlledFinale = isControlledFinaleGoal(lowerGoal);
  const floodedFinale = isFloodedFinaleGoal(lowerGoal);
  const focusedDrop = isFocusedDropGoal(lowerGoal);
  const diffusedDrop = isDiffusedDropGoal(lowerGoal);
  const resolvingTag = isResolvingTagGoal(lowerGoal);
  const overblownTag = isOverblownTagGoal(lowerGoal);
  const resolvingCoda = isResolvingCodaGoal(lowerGoal);
  const overblownCoda = isOverblownCodaGoal(lowerGoal);
  const contrastingMiddle8 = isContrastingMiddle8Goal(lowerGoal);
  const chorusLikeMiddle8 = isChorusLikeMiddle8Goal(lowerGoal);
  const hookEchoPostChorus = isHookEchoPostChorusGoal(lowerGoal);
  const verseLikePostChorus = isVerseLikePostChorusGoal(lowerGoal);
  const focusedRap = /(^|\b)(rap|rap section)\b/.test(lowerSection)
    && /\b(clipped|rhythmic delivery|narrower focus|tighten the motion)\b/.test(lowerGoal);
  const chorusLikeRap = /(^|\b)(rap|rap section)\b/.test(lowerSection)
    && /\b(singing-chorus language|broad.*chorus|same broad)\b/.test(lowerGoal);
  const focusedSolo = /(^|\b)(solo|instrumental solo)\b/.test(lowerSection)
    && /\b(feature|featured|spotlight|detour|narrower focus)\b/.test(lowerGoal);
  const chorusLikeSolo = /(^|\b)(solo|instrumental solo)\b/.test(lowerSection)
    && /\b(broad chorus pass|same broad chorus language|spread.*everywhere)\b/.test(lowerGoal);
  if (!uniformHierarchy && /key light|fill|lighting cue|wash|silhouette|blackout|punch/.test(lowerGoal)) {
    if (normalizedEnergy === 'high' || /chorus|final chorus|finale/.test(lowerSection)) {
      return `build a clearer key-vs-fill hierarchy${warmClause} with stronger punch on the main reveal`;
    }
    if (/intro|outro|coda/.test(lowerSection) || normalizedEnergy === 'low') {
      return `hold the lighting stack back${warmClause} with restrained washes and cleaner negative space`;
    }
    return `shape the section like a lighting cue${warmClause} with readable support and controlled depth`;
  }
  if (!uniformHierarchy && /negative space|frame|framing|centerpiece|perimeter/.test(lowerGoal)) {
    if (normalizedEnergy === 'high' || /chorus|final chorus|finale/.test(lowerSection)) {
      return `frame the reveal${warmClause} with cleaner negative space and tighter focal contrast`;
    }
    if (normalizedEnergy === 'low' || /intro|outro|coda/.test(lowerSection)) {
      return `hold more negative space${warmClause} so the frame stays calm and uncluttered`;
    }
    return `use cleaner framing${warmClause} with more negative space and clearer focal boundaries`;
  }
  if (normalizedEnergy === 'high' || /chorus|final chorus|payoff/.test(lowerSection)) {
    if (/drop/.test(lowerSection)) {
      if (focusedDrop) {
        return `let the drop land${warmClause} with concentrated release, tighter impact, and a cleaner post-buildup hit`;
      }
      if (diffusedDrop) {
        return `keep the drop broader${warmClause} and more transitional so the release stays diffused rather than landing hard`;
      }
      return `let the drop open up${warmClause} with sharper release and a more concentrated impact window`;
    }
    if (/final chorus|finale/.test(lowerSection)) {
      if (controlledFinale) {
        return `push the final payoff${warmClause} with clear hero emphasis, controlled width, and restraint around the main reveal`;
      }
      if (floodedFinale) {
        return `push the final payoff${warmClause} as a full-yard flood with constant output and minimal restraint`;
      }
      return `push the final payoff${warmClause} with broader contrast, clearer hierarchy, and a stronger closing lift`;
    }
    if (/chorus/.test(lowerSection)) {
      return `open the main reveal${warmClause} with clearer focal emphasis and controlled contrast`;
    }
    return `build stronger visual payoff${warmClause} using layered shimmer, glow, and clearer focal emphasis`;
  }
  if (/bridge/.test(lowerSection)) {
    if (suspendedBridge) {
      return `hold the bridge transition wider${warmClause} with suspended motion, cleaner breath, and delayed release`;
    }
    if (chorusLikeBridge) {
      return `push the bridge harder${warmClause} like a payoff hit with denser overlay energy and less suspension`;
    }
    return `widen the picture${warmClause} with smoother transitions and controlled contrast lift`;
  }
  if (/tag/.test(lowerSection)) {
    if (resolvingTag) {
      return `let the tag resolve${warmClause} like a shorter afterglow, echoing the final hook without opening a new climax`;
    }
    if (overblownTag) {
      return `treat the tag${warmClause} like another full climax with the same density and payoff weight as the final chorus`;
    }
    return `let the tag settle${warmClause} with a cleaner echo and narrower closing energy`;
  }
  if (/coda/.test(lowerSection)) {
    if (resolvingCoda) {
      return `let the coda resolve${warmClause} as a final release with less information and lower payoff weight than the final chorus`;
    }
    if (overblownCoda) {
      return `treat the coda${warmClause} like another full climax instead of a final release`;
    }
    return `let the coda settle${warmClause} as a cleaner closing release with restrained afterglow`;
  }
  if (/middle 8/.test(lowerSection)) {
    if (contrastingMiddle8) {
      return `let the middle 8 open wider${warmClause} as a contrasting detour before the final lift instead of repeating chorus payoff language`;
    }
    if (chorusLikeMiddle8) {
      return `treat the middle 8${warmClause} like another chorus with the same payoff language and little contrast`;
    }
    return `give the middle 8${warmClause} a wider contrasting breath before the closing payoff`;
  }
  if (/post-?chorus/.test(lowerSection)) {
    if (hookEchoPostChorus) {
      return `let the post-chorus echo the hook${warmClause} with a lighter extension instead of opening a whole new section arc`;
    }
    if (verseLikePostChorus) {
      return `treat the post-chorus${warmClause} like a fresh verse-sized section with a new arc instead of reinforcing the hook`;
    }
    return `let the post-chorus${warmClause} reinforce the hook with a cleaner extension and lighter follow-through`;
  }
  if (focusedRap) {
    return `tighten the rap section${warmClause} around a clipped rhythmic delivery with narrower focus and stronger pulse control`;
  }
  if (chorusLikeRap) {
    return `treat the rap section${warmClause} like another broad singing chorus pass instead of tightening around the rhythmic delivery`;
  }
  if (focusedSolo) {
    return `feature the solo${warmClause} like a spotlighted detour with narrower focus and clearer individual emphasis`;
  }
  if (chorusLikeSolo) {
    return `treat the solo${warmClause} like another broad chorus pass with the same payoff language spread across the picture`;
  }
  if (normalizedEnergy === 'low' || /intro|outro|coda/.test(lowerSection)) {
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
  if (/\b(ignore the phrase release|ignore phrase release|ignore the chord changes|ignore chord changes|ignore the beat grid|ignore beat grid|ignore the beats|ignore beats|ignore the pulse)\b/.test(lowerGoal)) {
    return "section";
  }
  if (/\b(beat|downbeat|upbeat|pulse|beat grid)\b/.test(lowerGoal)) return "beat";
  if (/\b(chord|harmon(?:y|ic)|changes?)\b/.test(lowerGoal)) return "chord";
  if (/\b(pre-?chorus|lift)\b/.test(lowerGoal) && /\b(tension|hold|release|open(?:s|ing)? up|before chorus)\b/.test(lowerGoal)) {
    return "phrase";
  }
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
  for (const [section, beatRows] of modes.beat.entries()) {
    if (modes.phrase.has(section) || !Array.isArray(beatRows) || beatRows.length < 4) continue;
    const splitIndex = Math.max(1, beatRows.length - 2);
    const head = beatRows.slice(0, splitIndex);
    const tail = beatRows.slice(splitIndex);
    const phraseRows = [];
    if (head.length) {
      phraseRows.push({
        label: "Phrase Hold",
        trackName: "XD: Phrase Cues",
        startMs: head[0].startMs,
        endMs: head[head.length - 1].endMs
      });
    }
    if (tail.length) {
      phraseRows.push({
        label: "Phrase Release",
        trackName: "XD: Phrase Cues",
        startMs: tail[0].startMs,
        endMs: tail[tail.length - 1].endMs
      });
    }
    const validRows = phraseRows.filter((row) => Number.isFinite(row.startMs) && Number.isFinite(row.endMs) && row.endMs > row.startMs);
    if (validRows.length) {
      modes.phrase.set(section, validRows);
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
  const continuityPalette = isPaletteContinuityGoal(lowerGoal);
  const resetPalette = isPaletteResetGoal(lowerGoal);
  const warm = /warm|amber|gold|cinematic|theatrical|holiday/.test(lowerGoal);
  const cool = /cool|icy|blue|winter/.test(lowerGoal);
  const effect = str(effectName).toLowerCase();
  const nearEnd = sectionCount > 0 ? sectionIndex >= Math.max(0, sectionCount - 2) : false;
  const laterLift = Number(sectionIndex) >= 1;
  let temperature = warm ? "warm" : (cool ? "cool" : "neutral");
  if (continuityPalette) temperature = laterLift ? "warm" : "warm";
  if (resetPalette) temperature = laterLift ? "cool" : "warm";
  const colors = warm
    ? (["bars", "fireworks", "strobe", "meteors", "pinwheel"].includes(effect) ? ["amber", "gold", "deep red"] : ["warm gold", "amber"])
    : cool
      ? (["snowflakes", "snowstorm", "ripple", "wave"].includes(effect) ? ["ice blue", "cool white", "blue"] : ["ice blue", "cool white"])
      : nearEnd
        ? ["gold", "white"]
        : (["spirals", "butterfly", "circles", "galaxy"].includes(effect) ? ["warm gold", "purple"] : ["warm white", "amber"]);
  const resolvedColors = continuityPalette
    ? (laterLift ? ["amber", "warm gold", "white"] : ["warm white", "amber"])
    : resetPalette
      ? (laterLift ? ["ice blue", "cool white", "blue"] : ["warm white", "amber"])
      : colors;
  return {
    colors: resolvedColors,
    temperature,
    contrast: ["bars", "shockwave", "strobe", "meteors", "pinwheel"].includes(effect) ? "high" : "medium",
    brightness: ["shimmer", "fireworks", "strobe", "meteors"].includes(effect) ? "high" : "medium_high",
    accentUsage: ["bars", "shockwave", "strobe", "pinwheel"].includes(effect) ? "accent" : "primary"
  };
}

function inferPlacementSettingsIntent({ effectName = "", energy = "", density = "", effectIndex = 0, targetRole = "primary", goal = "" } = {}) {
  const effect = str(effectName).toLowerCase();
  const normalizedEnergy = str(energy).toLowerCase();
  const normalizedDensity = str(density).toLowerCase();
  const supportTarget = targetRole === "support";
  const lowerGoal = str(goal).toLowerCase();
  const restrained = isRestrainedRenderGoal(lowerGoal);
  const busyTexture = isBusyTextureGoal(lowerGoal);
  const suspendedBridge = isSuspendedBridgeGoal(lowerGoal) || /delayed release/.test(lowerGoal);
  const chorusLikeBridge = isChorusLikeBridgeGoal(lowerGoal);
  const controlledFinale = isControlledFinaleGoal(lowerGoal);
  const floodedFinale = isFloodedFinaleGoal(lowerGoal);
  if (["shimmer", "twinkle", "galaxy", "fireworks"].includes(effect)) {
    return {
      intensity: restrained
        ? "medium"
        : (supportTarget ? "medium" : (normalizedEnergy === "high" ? "high" : "medium_high")),
      speed: suspendedBridge ? "slow" : (controlledFinale ? "medium" : (chorusLikeBridge || floodedFinale ? "fast" : (restrained ? "medium" : (normalizedEnergy === "high" ? "fast" : "medium")))),
      density: restrained ? "light" : (busyTexture ? "dense" : (normalizedDensity === "dense" ? "medium" : "light")),
      coverage: restrained
        ? "focused"
        : (supportTarget ? "focused" : (effectIndex === 0 ? "full" : "partial")),
      motion: "sparkle",
      variation: restrained ? "low" : (busyTexture ? "high" : (normalizedEnergy === "high" ? "medium" : "low"))
    };
  }
  if (["bars", "shockwave", "warp", "marquee", "singlestrand", "wave"].includes(effect)) {
    return {
      intensity: supportTarget ? "medium" : (normalizedEnergy === "high" ? "high" : "medium"),
      speed: suspendedBridge ? "slow" : (controlledFinale ? "medium_fast" : (chorusLikeBridge || floodedFinale ? "fast" : (restrained ? "medium" : (normalizedEnergy === "high" ? "medium_fast" : "medium")))),
      density: normalizedDensity === "wide" ? "medium" : "light",
      coverage: suspendedBridge
        ? "partial"
        : controlledFinale
        ? (supportTarget ? "focused" : (effectIndex === 0 ? "partial" : "focused"))
        : floodedFinale
        ? "full"
        : restrained
        ? "partial"
        : (supportTarget ? "focused" : (effectIndex === 0 ? "partial" : "focused")),
      motion: suspendedBridge ? "flowing" : "rhythmic",
      direction: "forward",
      thickness: normalizedDensity === "wide" ? "medium" : "thin"
    };
  }
  if (["pinwheel", "spirals", "butterfly", "circles", "fan", "morph", "ripple", "spirograph"].includes(effect)) {
    return {
      intensity: restrained ? "medium" : (supportTarget ? "medium" : (normalizedEnergy === "low" ? "medium" : "medium_high")),
      speed: restrained ? "medium" : (normalizedEnergy === "high" ? "fast" : "medium_fast"),
      density: busyTexture ? "medium" : (normalizedDensity === "dense" ? "medium" : "light"),
      coverage: restrained
        ? "partial"
        : (supportTarget ? "partial" : (effectIndex === 0 ? "full" : "partial")),
      motion: "wash",
      direction: normalizedDensity === "wide" ? "outward" : "forward",
      thickness: normalizedDensity === "dense" ? "medium" : "thin",
      variation: restrained ? "low" : "medium"
    };
  }
  if (["meteors", "fire", "lightning", "snowflakes", "snowstorm", "candle", "tendril"].includes(effect)) {
    return {
      intensity: restrained ? "medium" : (supportTarget ? "medium" : (normalizedEnergy === "high" ? "high" : "medium")),
      speed: restrained ? "medium" : (normalizedEnergy === "high" ? "fast" : "medium"),
      density: restrained ? "light" : (busyTexture ? "dense" : (normalizedDensity === "dense" ? "dense" : "medium")),
      coverage: restrained
        ? "partial"
        : (supportTarget ? "focused" : (effectIndex === 0 ? "full" : "focused")),
      motion: "rhythmic",
      direction: "reverse",
      thickness: "medium",
      variation: restrained ? "low" : "medium"
    };
  }
  return {
    intensity: supportTarget ? "medium" : (normalizedEnergy === "low" ? "medium" : "medium_high"),
    speed: restrained ? "slow" : (normalizedEnergy === "low" ? "slow" : "medium"),
    density: normalizedDensity === "dense" ? "medium" : "light",
    coverage: restrained ? "partial" : (supportTarget ? "focused" : (effectIndex === 0 ? "full" : "partial")),
    motion: "wash",
    variation: restrained ? "low" : (busyTexture ? "medium" : "low")
  };
}

function inferTargetRole({ goal = "", targetIndex = 0, singleScope = false } = {}) {
  const lowerGoal = str(goal).toLowerCase();
  const uniformHierarchy = /same emphasis|share the same emphasis|visually even|even look|no real focal hierarchy|minimal hierarchy/.test(lowerGoal);
  const leadWeighted = !uniformHierarchy && /key light|focal|focus|centerpiece|hero|lead/.test(lowerGoal);
  const supportWeighted = !uniformHierarchy && /fill|support|perimeter|frame\b|framing\b|background|negative space/.test(lowerGoal);
  if (targetIndex === 0) return leadWeighted || singleScope ? "lead" : "primary";
  if (supportWeighted) return "support";
  return "secondary";
}

function isRestrainedRenderGoal(goal = "") {
  return /\b(restrained|luminous base|smoother texture transitions|selective sparkle|readable atmosphere|cleaner spacing|hold the lighting stack back|impact budget|visual weight|carry the weight|support lighter)\b/.test(str(goal).toLowerCase());
}

function isBusyTextureGoal(goal = "") {
  return /\b(texture-heavy|texture heavy|frequent sparkle|constant overlay energy|busier|more constant overlay)\b/.test(str(goal).toLowerCase());
}

function isSuspendedBridgeGoal(goal = "") {
  const lowerGoal = str(goal).toLowerCase();
  if (/no suspended transition|without suspended transition|not suspended/.test(lowerGoal)) return false;
  return /wide and suspended|hold the breath|suspended transition|transition wide|phrase release/.test(lowerGoal);
}

function isChorusLikeBridgeGoal(goal = "") {
  return /second full-chorus payoff|full chorus|immediate big payoff|denser overlays|no suspended transition feeling/.test(str(goal).toLowerCase());
}

function isControlledFinaleGoal(goal = "") {
  return /final chorus feel big but still controlled|clear hero payoff|does not flatten|constant full-output wall/.test(str(goal).toLowerCase());
}

function isFloodedFinaleGoal(goal = "") {
  return /as huge as possible|flooding the whole yard evenly|constant full-output energy everywhere|removing most restraint/.test(str(goal).toLowerCase());
}

function isPaletteContinuityGoal(goal = "") {
  return /carry a coherent palette|feels connected|continuity forward|not like an unrelated color reset|rather than like an unrelated color reset/.test(str(goal).toLowerCase());
}

function isPaletteResetGoal(goal = "") {
  const lowerGoal = str(goal).toLowerCase();
  if (/not like an unrelated color reset|avoid an unrelated color reset|rather than like an unrelated color reset/.test(lowerGoal)) {
    return false;
  }
  return /unrelated palette|separate unrelated palette|more disconnected|unrelated color reset/.test(lowerGoal);
}

function isVariedHierarchyGoal(goal = "") {
  return /target variety|more props participate|broader participation|hero hierarchy|controlled support/.test(str(goal).toLowerCase());
}

function isEscalationPacingGoal(goal = "") {
  return /verse 1 stays measured|final chorus feels like the largest payoff|peaking too early|little escalation difference/.test(str(goal).toLowerCase());
}

function isFlattenedEscalationGoal(goal = "") {
  return /peak too early|nearly the same payoff intensity|little escalation difference/.test(str(goal).toLowerCase());
}

function isFocusedDropGoal(goal = "") {
  const lower = str(goal).toLowerCase();
  return /drop/.test(lower)
    && /release hit|lands? immediately|concentrated impact|cleaner landing|after the buildup|opens up hard/.test(lower);
}

function isDiffusedDropGoal(goal = "") {
  const lower = str(goal).toLowerCase();
  return /drop/.test(lower)
    && /broad and transitional|never really lands|release feels diffused|stretch(?:ing)? it like another transition/.test(lower);
}

function isResolvingTagGoal(goal = "") {
  const lower = str(goal).toLowerCase();
  return /tag/.test(lower)
    && /resolving echo|afterglow|less new information|final hook|short resolving|echo of the final/.test(lower);
}

function isOverblownTagGoal(goal = "") {
  const lower = str(goal).toLowerCase();
  return /tag/.test(lower)
    && /brand-?new climax|same full-payoff density|full payoff density|another climax|same as the final chorus/.test(lower);
}

function isResolvingCodaGoal(goal = "") {
  const lower = str(goal).toLowerCase();
  return /coda/.test(lower)
    && /resolving coda|final release|less information|closing release|lower payoff weight/.test(lower);
}

function isOverblownCodaGoal(goal = "") {
  const lower = str(goal).toLowerCase();
  return /coda/.test(lower)
    && /another full climax|reopen the energy|same payoff weight|full climax again/.test(lower);
}

function isContrastingMiddle8Goal(goal = "") {
  const lower = str(goal).toLowerCase();
  return /middle 8/.test(lower)
    && /contrasting detour|wider detour|before the final lift|not another chorus|new perspective|contrast/.test(lower);
}

function isChorusLikeMiddle8Goal(goal = "") {
  const lower = str(goal).toLowerCase();
  return /middle 8/.test(lower)
    && /same payoff language|another chorus|little contrast|reuse chorus payoff/.test(lower);
}

function isHookEchoPostChorusGoal(goal = "") {
  const lower = str(goal).toLowerCase();
  return /post-?chorus/.test(lower)
    && /reinforce the hook|lighter echo|echo the hook|after the chorus|hook extension/.test(lower);
}

function isVerseLikePostChorusGoal(goal = "") {
  const lower = str(goal).toLowerCase();
  return /post-?chorus/.test(lower)
    && /whole new section arc|new verse|verse-like|fresh narrative section/.test(lower);
}

function shouldLayerTarget({ goal = "", energy = "", targetIndex = 0, singleScope = false } = {}) {
  const lowerGoal = str(goal).toLowerCase();
  const normalizedEnergy = str(energy).toLowerCase();
  const uniformHierarchy = /same emphasis|share the same emphasis|visually even|even look|no real focal hierarchy|minimal hierarchy/.test(lowerGoal);
  const lightingOrCompositionScoped = !uniformHierarchy && /key light|fill|support|focal|centerpiece|perimeter|frame\b|framing\b|negative space|foreground|background/.test(lowerGoal);
  const variedHierarchy = !uniformHierarchy && isVariedHierarchyGoal(lowerGoal);
  if (targetIndex === 0) return true;
  if (isRestrainedRenderGoal(lowerGoal)) return false;
  if (variedHierarchy) return normalizedEnergy === "high" ? targetIndex === 1 : false;
  if (lightingOrCompositionScoped) return !singleScope && normalizedEnergy === "high" && targetIndex === 1;
  if (singleScope && targetIndex >= 1) return false;
  if (isBusyTextureGoal(lowerGoal)) return normalizedEnergy === "high" ? targetIndex <= 2 : targetIndex === 1;
  return normalizedEnergy === "high" && targetIndex === 1;
}

function inferPlacementLayerIntent({ effectIndex = 0, effectName = "", targetRole = "primary", energy = "", goal = "" } = {}) {
  const lower = str(effectName).toLowerCase();
  const normalizedEnergy = str(energy).toLowerCase();
  const lowerGoal = str(goal).toLowerCase();
  const restrained = isRestrainedRenderGoal(lowerGoal);
  const busyTexture = isBusyTextureGoal(lowerGoal);
  if (effectIndex === 0) {
    const isSupport = targetRole === "support";
    return {
      priority: isSupport ? "support" : "base",
      blendRole: isSupport ? "support_fill" : "foundation",
      overlayPolicy: "allow_overlay",
      mixAmount: isSupport
        ? "low"
        : restrained
          ? "medium"
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
    mixAmount: restrained
      ? "medium"
      : /key light|focus|focal|punch/.test(lowerGoal)
      ? "high"
      : busyTexture
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
  const restrained = isRestrainedRenderGoal(lowerGoal);
  const busyTexture = isBusyTextureGoal(lowerGoal);
  return {
    groupPolicy: isAggregate || supportWeighted ? "preserve_group_rendering" : "no_expand",
    bufferStyle: restrained
      ? (rhythmicWeighted ? "overlay_scaled" : "inherit")
      : (rhythmicWeighted || busyTexture)
        ? "overlay_scaled"
        : (supportWeighted ? "inherit" : "inherit"),
    expansionPolicy: isAggregate || supportWeighted ? "preserve" : "no_expand",
    riskTolerance: restrained ? "low" : (isAggregate || supportWeighted ? "low" : "medium")
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
            targetRole,
            goal
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
  const primarySections = (
    allowGlobalRewrite
      ? availableSections.map((row) => row.label)
      : explicitSections.length
        ? explicitSections
        : availableSections.map((row) => row.label)
  ).slice(0, 24);
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
        || (
          proposal.plan.resolutionSource === "goal_match"
          && !arr(proposal.plan.normalizedIntent?.targetIds).length
        )
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
