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
import {
  canonicalizeEffectNameAlias,
  resolveContextualEffectCandidates,
  resolveDirectCueEffectCandidates,
  resolveSectionIntentSummary,
} from "../shared/effect-semantics-registry.js";

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

function rotateOffset(values = [], offset = 0) {
  const rows = uniqueStrings(values);
  if (rows.length <= 1) return rows;
  const normalizedOffset = Math.max(0, Number(offset) || 0) % rows.length;
  return rows.slice(normalizedOffset).concat(rows.slice(0, normalizedOffset));
}

function classifySectionEffectPool(section = "", energy = "", density = "") {
  const lowerSection = str(section).toLowerCase();
  const normalizedEnergy = str(energy).toLowerCase();
  const normalizedDensity = str(density).toLowerCase();
  if (/intro/.test(lowerSection)) return ["Color Wash", "Candle", "Wave", "On"];
  if (/outro|coda/.test(lowerSection)) return ["Wave", "Spirals", "Color Wash", "On"];
  if (/bridge|middle 8|interlude|instrumental/.test(lowerSection)) return ["Bars", "Morph", "Shockwave", "Spirals"];
  if (/chorus|final chorus|drop|payoff|finale/.test(lowerSection) || normalizedEnergy === "high") {
    return ["Bars", "Meteors", "Pinwheel", "Wave", "Shimmer"];
  }
  if (/verse/.test(lowerSection)) return ["Color Wash", "Wave", "Butterfly", "Bars", "Circles"];
  if (normalizedDensity === "wide") return ["Bars", "Morph", "Wave", "Shockwave"];
  return ["Color Wash", "Wave", "Butterfly", "Bars"];
}

function diversifyWholeSequenceEffectHints({
  baseEffectHints = [],
  section = "",
  energy = "",
  density = "",
  sectionIndex = 0,
  repeatedRoleIndex = 0,
  previousEffectHints = []
} = {}) {
  const base = uniqueStrings(baseEffectHints);
  const sectionPool = classifySectionEffectPool(section, energy, density);
  const merged = rotateOffset(uniqueStrings([...base, ...sectionPool]), sectionIndex + repeatedRoleIndex);
  const previous = uniqueStrings(previousEffectHints).map((row) => str(row).toLowerCase());
  const previousPrimary = previous[0] || "";
  const previousSecondary = previous[1] || "";
  const filtered = merged.filter((effectName, idx) => {
    const lower = str(effectName).toLowerCase();
    if (idx === 0 && previousPrimary && lower === previousPrimary) return false;
    if (idx <= 1 && previousSecondary && lower === previousSecondary) return false;
    return true;
  });
  const diversified = filtered.length ? filtered : merged;
  const primary = diversified[0] || base[0] || sectionPool[0] || "Color Wash";
  const secondaryCandidates = diversified
    .slice(1)
    .filter((effectName) => str(effectName).toLowerCase() !== str(primary).toLowerCase());
  const secondary = secondaryCandidates[0] || base[1] || sectionPool[1] || "Wave";
  return uniqueStrings([primary, secondary]).slice(0, 2);
}

function canonicalizeDesignerEffectHint(value = "") {
  return canonicalizeEffectNameAlias(value);
}

function stripNegativeCueClauses(value = "") {
  const text = str(value);
  if (!text) return "";
  return text
    .replace(/\bdo not turn it into\b[\s\S]*$/i, "")
    .replace(/\brather than\b[\s\S]*$/i, "")
    .replace(/\binstead of\b[\s\S]*$/i, "")
    .replace(/,\s*not\b[\s\S]*$/i, "")
    .replace(/\bavoid\b[\s\S]*$/i, "")
    .trim();
}

function normalizeSectionLabelForGoalMatch(value = "") {
  return str(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeSectionRoleKey(value = "") {
  const lower = str(value).toLowerCase();
  if (!lower) return "";
  if (/final chorus/.test(lower)) return "chorus";
  if (/chorus/.test(lower)) return "chorus";
  if (/verse/.test(lower)) return "verse";
  if (/bridge/.test(lower)) return "bridge";
  if (/intro/.test(lower)) return "intro";
  if (/outro/.test(lower)) return "outro";
  if (/pre-?chorus/.test(lower)) return "prechorus";
  if (/post-?chorus/.test(lower)) return "postchorus";
  if (/tag/.test(lower)) return "tag";
  if (/coda/.test(lower)) return "coda";
  if (/middle 8/.test(lower)) return "middle8";
  if (/solo/.test(lower)) return "solo";
  if (/rap/.test(lower)) return "rap";
  return "";
}

function extractSectionScopedGoal({
  goal = "",
  section = "",
  sectionNames = []
} = {}) {
  const rawGoal = str(goal);
  const sectionLabel = str(section);
  if (!rawGoal || !sectionLabel) return rawGoal;
  const normalizedSection = normalizeSectionLabelForGoalMatch(sectionLabel);
  if (!normalizedSection) return rawGoal;
  const clauses = rawGoal
    .split(/(?:(?<=[.?!;])\s+|\s*,\s*(?=then\b)|\s+\bthen\b\s+)/i)
    .map((row) => str(row))
    .filter(Boolean);
  if (!clauses.length) return rawGoal;
  const normalizedSections = arr(sectionNames)
    .map((row) => normalizeSectionLabelForGoalMatch(row))
    .filter(Boolean);
  const matchingClauses = clauses.filter((clause) => {
    const normalizedClause = normalizeSectionLabelForGoalMatch(clause);
    return normalizedClause.includes(normalizedSection);
  });
  const otherSections = normalizedSections.filter((row) => row !== normalizedSection);
  const genericClauses = clauses.filter((clause) => {
    const normalizedClause = normalizeSectionLabelForGoalMatch(clause);
    return !otherSections.some((other) => normalizedClause.includes(other));
  });
  if (matchingClauses.length) {
    return uniqueStrings([...matchingClauses, ...genericClauses]).join(". ");
  }
  return genericClauses.length ? genericClauses.join(". ") : rawGoal;
}

function resolveEffectOverrideHints(effectOverrides = [], goal = "") {
  const overrides = arr(effectOverrides).map((row) => canonicalizeDesignerEffectHint(row)).filter(Boolean);
  const lowerGoal = stripNegativeCueClauses(goal).toLowerCase();
  if (
    overrides.length === 1 &&
    overrides[0] === "On" &&
    /\b(solid steady hold|solid hold|steady hold|static hold|minimal movement)\b/.test(lowerGoal)
  ) {
    return ["Color Wash"];
  }
  return overrides;
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

function splitAggregateTargets(targetIds = []) {
  const aggregatePattern = /(^|\/)(allmodels|allmodels_|.*_all$|.*_nofloods$|.*_nomatrix$|fronthouse$|frontprops$)/i;
  const concrete = [];
  const aggregate = [];
  for (const targetId of uniqueStrings(targetIds)) {
    if (aggregatePattern.test(str(targetId))) aggregate.push(targetId);
    else concrete.push(targetId);
  }
  return { concrete, aggregate };
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
  goal = "",
  wholeSequence = false
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
  const concretePools = splitAggregateTargets([
    ...focal,
    ...detail,
    ...fallback,
    ...broad,
    ...foreground,
    ...background,
    ...left,
    ...right,
    ...center
  ]);
  const concreteFallback = concretePools.concrete;
  const aggregateFallback = concretePools.aggregate;
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
    return prioritizeConcreteTargets([
      ...foreground.slice(0, 1),
      ...background.slice(0, 2),
      ...center.slice(0, 1),
      ...focal.slice(0, 1),
      ...broad.slice(0, 1),
      ...fallback.slice(0, 2)
    ]).slice(0, 8);
  }
  if (/left side|left\b|right side|right\b/.test(lowerGoal)) {
    return prioritizeConcreteTargets([
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
      return prioritizeConcreteTargets([
        ...focal.slice(0, 2),
        ...detail.slice(0, 2),
        ...fallback.slice(0, 3),
        ...broad.slice(0, 1)
      ]).slice(0, 8);
    }
    return prioritizeConcreteTargets([
      ...focal.slice(0, 2),
      ...detail.slice(0, 2),
      ...fallback.slice(0, 3),
      ...broad.slice(0, 1)
    ]).slice(0, 8);
  }
  if (wholeSequence && !singleScope && !tagDriven) {
    const concreteOnly = prioritizeConcreteTargets([
      ...focal.slice(0, 3),
      ...detail.slice(0, 3),
      ...left.slice(0, 1),
      ...right.slice(0, 1),
      ...center.slice(0, 1),
      ...fallback.slice(0, 4),
      ...broad.slice(0, 1)
    ]).filter((targetId) => !aggregateFallback.includes(targetId));
    if (concreteOnly.length >= 6) {
      return concreteOnly.slice(0, isPeak ? 12 : (isWide ? 11 : 9));
    }
    return prioritizeConcreteTargets([
      ...concreteOnly,
      ...concreteFallback.slice(0, 6),
      ...aggregateFallback.slice(0, 1)
    ]).slice(0, isPeak ? 12 : 9);
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
      return prioritizeConcreteTargets([
        ...focal.slice(0, 2),
        ...detail.slice(0, 2),
        ...fallback.slice(0, 2)
      ]).slice(0, 5);
    }
    if (/final chorus|finale/.test(key) && floodedFinale) {
      return prioritizeConcreteTargets([
        ...focal.slice(0, 2),
        ...detail.slice(0, 2),
        ...broad.slice(0, 2),
        ...fallback.slice(0, 2)
      ]).slice(0, 8);
    }
    return prioritizeConcreteTargets([
      ...focal.slice(0, 2),
      ...detail.slice(0, 2),
      ...broad.slice(0, 2),
      ...fallback.slice(0, 2)
    ]).slice(0, 10);
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
    return prioritizeConcreteTargets([
      ...broad.slice(0, 1),
      ...detail.slice(0, 2),
      ...focal.slice(0, 1),
      ...fallback.slice(0, 2)
    ]).slice(0, 8);
  }
  if (isGentle) {
    return prioritizeConcreteTargets([
      ...detail.slice(0, 2),
      ...focal.slice(0, 1),
      ...fallback.slice(0, 3),
      ...broad.slice(0, 1)
    ]).slice(0, 7);
  }
  return prioritizeConcreteTargets([
    ...focal.slice(0, 2),
    ...detail.slice(0, 2),
    ...fallback.slice(0, 3),
    ...broad.slice(0, 1)
  ]).slice(0, 8);
}

function buildSectionEffectHints({
  section = "",
  energy = "",
  density = "",
  goal = "",
  sectionIndex = 0,
  sectionCount = 0,
  repeatedRoleIndex = 0,
  repeatedRoleCount = 0,
  directorPreferences = null,
  directorProfile = null
} = {}) {
  const lowerSection = str(section).toLowerCase();
  const positiveGoal = stripNegativeCueClauses(goal);
  const lowerGoal = positiveGoal.toLowerCase();
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
  const escalationGoal = isEscalationPacingGoal(lowerGoal);
  const flattenedEscalation = isFlattenedEscalationGoal(lowerGoal);
  const directCueCandidates = resolveDirectCueEffectCandidates({
    goalText: lowerGoal,
    smoothBias
  });
  if (directCueCandidates.length) {
    return directCueCandidates;
  }
  if (!uniformHierarchy && /key light|fill|lighting cue|wash|silhouette|blackout|punch|visual weight|impact budget/.test(lowerGoal)) {
    return resolveContextualEffectCandidates({ contextKey: "lightingCue", variant: "default" });
  }
  if (/rhythm|pulse|groove|drive/.test(lowerGoal)) {
    if (normalizedEnergy === "high" || /chorus|final/.test(lowerSection)) {
      return resolveContextualEffectCandidates({
        contextKey: "rhythm",
        variant: nearEnd ? "highNearEnd" : "highDefault"
      });
    }
    if (/bridge/.test(lowerSection)) {
      return resolveContextualEffectCandidates({ contextKey: "rhythm", variant: "bridge" });
    }
    return resolveContextualEffectCandidates({ contextKey: "rhythm", variant: "default" });
  }
  if (!uniformHierarchy && /perimeter|frame|framing|negative space|centerpiece/.test(lowerGoal)) {
    return resolveContextualEffectCandidates({ contextKey: "framing", variant: "default" });
  }
  if (escalationGoal && /verse 1/.test(lowerSection)) {
    return resolveContextualEffectCandidates({
      contextKey: "genericFlow",
      variant: flattenedEscalation ? "escalationVerseFlat" : "escalationVerseOpen"
    });
  }
  if (/pulse|rhythm|drive|movement/.test(lowerGoal)) {
    return resolveContextualEffectCandidates({ contextKey: "genericFlow", variant: "pulse" });
  }
  return resolveContextualEffectCandidates({ contextKey: "genericFlow", variant: "default" });
}

function buildSectionIntentSummary({ section = "", energy = "", density = "", goal = "" } = {}) {
  const lowerSection = str(section).toLowerCase();
  const normalizedEnergy = str(energy).toLowerCase();
  const normalizedDensity = str(density).toLowerCase();
  const lowerGoal = str(goal).toLowerCase();
  const uniformHierarchy = /same emphasis|share the same emphasis|visually even|even look|no real focal hierarchy|minimal hierarchy/.test(lowerGoal);
  const warm = /warm|amber|gold|red|cinematic|glow|theatrical/.test(lowerGoal);
  if (!uniformHierarchy && /key light|fill|lighting cue|wash|silhouette|blackout|punch/.test(lowerGoal)) {
    if (normalizedEnergy === 'high' || /chorus|final chorus|finale/.test(lowerSection)) {
      return resolveSectionIntentSummary({ summaryKey: "lightingCue", variant: "high", warm });
    }
    if (/intro|outro|coda/.test(lowerSection) || normalizedEnergy === 'low') {
      return resolveSectionIntentSummary({ summaryKey: "lightingCue", variant: "low", warm });
    }
    return resolveSectionIntentSummary({ summaryKey: "lightingCue", variant: "default", warm });
  }
  if (!uniformHierarchy && /negative space|frame|framing|centerpiece|perimeter/.test(lowerGoal)) {
    if (normalizedEnergy === 'high' || /chorus|final chorus|finale/.test(lowerSection)) {
      return resolveSectionIntentSummary({ summaryKey: "framing", variant: "high", warm });
    }
    if (normalizedEnergy === 'low' || /intro|outro|coda/.test(lowerSection)) {
      return resolveSectionIntentSummary({ summaryKey: "framing", variant: "low", warm });
    }
    return resolveSectionIntentSummary({ summaryKey: "framing", variant: "default", warm });
  }
  if (normalizedEnergy === 'low' || /intro|outro|coda/.test(lowerSection)) {
    return resolveSectionIntentSummary({ summaryKey: "generic", variant: "low", warm });
  }
  if (normalizedDensity === 'dense') {
    return resolveSectionIntentSummary({ summaryKey: "generic", variant: "dense", warm });
  }
  return resolveSectionIntentSummary({ summaryKey: "generic", variant: "default", warm });
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

function inferPlacementAnchorMode(goal = "", { passScope = "" } = {}) {
  const lowerGoal = str(goal).toLowerCase();
  const normalizedPassScope = str(passScope).toLowerCase();
  const explicitBeatLock = /\b(every beat|each beat|beat-by-beat|per-beat|beat locked every beat|lock to each beat)\b/.test(lowerGoal);
  const explicitPhraseLock = /\b(phrase by phrase|per phrase|phrase-locked|phrase release|phrase transitions?)\b/.test(lowerGoal);
  if (/\b(ignore the phrase release|ignore phrase release|ignore the chord changes|ignore chord changes|ignore the beat grid|ignore beat grid|ignore the beats|ignore beats|ignore the pulse)\b/.test(lowerGoal)) {
    return "section";
  }
  if (normalizedPassScope === "whole_sequence" && !explicitBeatLock) {
    if (explicitPhraseLock) return "phrase";
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
  return modes;
}

function inferTargetLimitForSection({ energy = "", density = "" } = {}) {
  const normalizedEnergy = str(energy).toLowerCase();
  const normalizedDensity = str(density).toLowerCase();
  if (normalizedEnergy === "high") return 18;
  if (normalizedDensity === "wide") return 15;
  if (normalizedEnergy === "low") return 10;
  return 12;
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
  return {
    startMs: start,
    endMs: end
  };
}

function partitionRowsIntoSlices(rows = [], desiredSlices = 1) {
  const validRows = arr(rows).filter((row) => Number.isFinite(row?.startMs) && Number.isFinite(row?.endMs) && row.endMs > row.startMs);
  if (!validRows.length) return [];
  const sliceCount = Math.max(1, Math.min(validRows.length, Number(desiredSlices) || 1));
  const out = [];
  for (let idx = 0; idx < sliceCount; idx += 1) {
    const startIndex = Math.floor((idx * validRows.length) / sliceCount);
    const endIndex = Math.floor((((idx + 1) * validRows.length) / sliceCount)) - 1;
    const group = validRows.slice(startIndex, endIndex + 1);
    if (!group.length) continue;
    out.push({
      label: group.length === 1 ? group[0].label : `${group[0].label || idx + 1}-${group[group.length - 1].label || idx + 1}`,
      trackName: str(group[0].trackName),
      startMs: Number(group[0].startMs),
      endMs: Number(group[group.length - 1].endMs)
    });
  }
  return out.filter((row) => Number.isFinite(row.startMs) && Number.isFinite(row.endMs) && row.endMs > row.startMs);
}

function buildEqualSectionSlices({ startMs = 0, endMs = 0, count = 1, trackName = "XD: Song Structure", labelPrefix = "Slice" } = {}) {
  const start = Number(startMs);
  const end = Number(endMs);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
  const sliceCount = Math.max(1, Number(count) || 1);
  if (sliceCount === 1) {
    return [{ label: labelPrefix, trackName, startMs: start, endMs: end }];
  }
  const total = end - start;
  const out = [];
  for (let idx = 0; idx < sliceCount; idx += 1) {
    const sliceStart = start + Math.floor((total * idx) / sliceCount);
    const sliceEnd = idx === sliceCount - 1
      ? end
      : start + Math.floor((total * (idx + 1)) / sliceCount);
    if (sliceEnd <= sliceStart) continue;
    out.push({
      label: `${labelPrefix} ${idx + 1}`,
      trackName,
      startMs: sliceStart,
      endMs: sliceEnd
    });
  }
  return out;
}

function derivePlacementSlices({
  timed = null,
  cueWindowIndex = null,
  passScope = "",
  energy = "",
  density = "",
  targetRole = "primary",
  effectIndex = 0
} = {}) {
  const startMs = Number(timed?.startMs);
  const endMs = Number(timed?.endMs);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return [];
  if (str(passScope).toLowerCase() !== "whole_sequence") {
    return [{
      label: str(timed?.label || "Section"),
      trackName: "XD: Song Structure",
      startMs,
      endMs,
      alignmentMode: "section_span"
    }];
  }

  const normalizedEnergy = str(energy).toLowerCase();
  const normalizedDensity = str(density).toLowerCase();
  const supportTarget = targetRole === "support" || targetRole === "secondary";
  const desiredSlices = normalizedEnergy === "high"
    ? (supportTarget ? 3 : 4)
    : normalizedEnergy === "low"
      ? (supportTarget ? 1 : 2)
      : (supportTarget ? 2 : 3);
  const beats = cueWindowIndex?.beat?.get(str(timed?.label)) || [];
  const phrases = cueWindowIndex?.phrase?.get(str(timed?.label)) || [];
  const chords = cueWindowIndex?.chord?.get(str(timed?.label)) || [];

  let sourceSlices = [];
  let alignmentMode = "section_span";
  if (normalizedEnergy === "high" && beats.length >= 3) {
    sourceSlices = partitionRowsIntoSlices(beats, desiredSlices);
    alignmentMode = "beat_group";
  } else if (phrases.length >= 2) {
    sourceSlices = partitionRowsIntoSlices(phrases, desiredSlices);
    alignmentMode = "phrase_group";
  } else if (chords.length >= 2 && (normalizedEnergy !== "low" || normalizedDensity === "wide")) {
    sourceSlices = partitionRowsIntoSlices(chords, desiredSlices);
    alignmentMode = "chord_group";
  } else {
    sourceSlices = buildEqualSectionSlices({
      startMs,
      endMs,
      count: desiredSlices,
      trackName: "XD: Song Structure",
      labelPrefix: str(timed?.label || "Section")
    });
    alignmentMode = desiredSlices > 1 ? "section_slice" : "section_span";
  }

  const filteredSlices = sourceSlices
    .filter((row) => Number.isFinite(row?.startMs) && Number.isFinite(row?.endMs) && row.endMs > row.startMs)
    .map((row) => ({
      label: str(row?.label || timed?.label || "Section"),
      trackName: str(row?.trackName || "XD: Song Structure"),
      startMs: Number(row.startMs),
      endMs: Number(row.endMs),
      alignmentMode
    }));
  if (!filteredSlices.length) {
    return [{
      label: str(timed?.label || "Section"),
      trackName: "XD: Song Structure",
      startMs,
      endMs,
      alignmentMode: "section_span"
    }];
  }

  if (effectIndex > 0 && filteredSlices.length > 1) {
    return filteredSlices.filter((_, idx) => idx % 2 === (supportTarget ? 1 : 0));
  }
  return filteredSlices;
}

function buildEffectPlacements({ sectionPlans = [], timedSections = new Map(), goal = "", musicDesignContext = null, passScope = "" } = {}) {
  const placements = [];
  const plans = arr(sectionPlans);
  const sectionCount = plans.length;
  const anchorMode = inferPlacementAnchorMode(goal, { passScope });
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
        const cueWindow = cueWindows.length && passScope !== "whole_sequence"
          ? cueWindows[Math.min(effectIndex, cueWindows.length - 1)]
          : null;
        const sliceWindows = cueWindow
          ? [{
              label: cueWindow.label,
              trackName: cueWindow.trackName,
              startMs: cueWindow.startMs,
              endMs: cueWindow.endMs,
              alignmentMode: `${anchorMode}_window`
            }]
          : derivePlacementSlices({
              timed: { ...timed, label: section },
              cueWindowIndex,
              passScope,
              energy: plan?.energy,
              density: plan?.density,
              targetRole,
              effectIndex
            });
        for (let sliceIndex = 0; sliceIndex < sliceWindows.length; sliceIndex += 1) {
          const window = sliceWindows[sliceIndex];
          placements.push({
            placementId: `placement-${sectionIndex + 1}-${targetIndex + 1}-${effectIndex + 1}-${sliceIndex + 1}`,
            designId: str(plan?.designId),
            designRevision: Number.isInteger(Number(plan?.designRevision)) ? Number(plan.designRevision) : 0,
            designAuthor: str(plan?.designAuthor || "designer"),
            targetId,
            layerIndex: effectIndex,
            effectName,
            startMs: window.startMs,
            endMs: window.endMs,
            timingContext: {
              trackName: window?.trackName || "XD: Song Structure",
              anchorLabel: window?.label || section,
              anchorStartMs: window?.startMs || timed.startMs,
              anchorEndMs: window?.endMs || timed.endMs,
              alignmentMode: str(window?.alignmentMode || "section_span")
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
  const sharedRevisionDesignId = reviseInPlace && !allowGlobalRewrite && explicitSections.length
    ? str(intent?.designId || "DES-001")
    : "";
  const sharedRevisionDesignRevision = reviseInPlace && !allowGlobalRewrite && explicitSections.length
    ? (Number.isInteger(Number(intent?.designRevision)) ? Number(intent.designRevision) : 0)
    : 0;
  const sharedRevisionDesignAuthor = reviseInPlace && !allowGlobalRewrite && explicitSections.length
    ? str(intent?.designAuthor || "designer") || "designer"
    : "designer";
  const useGlobalEffectOverrides = arr(intent.effectOverrides).length > 0 && explicitSections.length <= 1;
  const primarySections = (
    allowGlobalRewrite
      ? availableSections.map((row) => row.label)
      : explicitSections.length
        ? explicitSections
        : availableSections.map((row) => row.label)
  ).slice(0, 24);
  const normalizedSections = (primarySections.length ? primarySections : availableSections.map((row) => row.label))
    .slice(0, 24);
  let previousWholeSequenceEffectHints = [];
  const sectionPlans = normalizedSections
    .map((label, idx) => {
      const match = availableSections.find((row) => str(row.label) === str(label));
      const energy = str(match?.energy);
      const density = str(match?.density);
      const currentRole = normalizeSectionRoleKey(label);
      const repeatedRoleSections = currentRole
        ? normalizedSections.filter((name) => normalizeSectionRoleKey(name) === currentRole)
        : [];
      const repeatedRoleIndex = Math.max(0, repeatedRoleSections.findIndex((name) => str(name) === str(label)));
      const repeatedRoleCount = repeatedRoleSections.length;
      const sectionGoal = extractSectionScopedGoal({
        goal: intent.goal || "",
        section: label,
        sectionNames: normalizedSections
      });
      const effectHintGoal = passScope === "single_section"
        ? uniqueStrings([sectionGoal, str(intent.goal || "")]).join(". ")
        : sectionGoal;
      const baseEffectHints = useGlobalEffectOverrides
        ? resolveEffectOverrideHints(intent.effectOverrides, intent.goal || "")
        : buildSectionEffectHints({
            section: label,
            energy,
            density,
            goal: effectHintGoal,
            sectionIndex: idx,
            sectionCount: normalizedSections.length,
            repeatedRoleIndex,
            repeatedRoleCount,
            directorPreferences,
            directorProfile
          });
      const resolvedEffectHints = passScope === "whole_sequence"
        ? diversifyWholeSequenceEffectHints({
            baseEffectHints: rotateOffset(baseEffectHints, idx + repeatedRoleIndex),
            section: label,
            energy,
            density,
            sectionIndex: idx,
            repeatedRoleIndex,
            previousEffectHints: previousWholeSequenceEffectHints
          })
        : baseEffectHints;
      if (passScope === "whole_sequence") {
        previousWholeSequenceEffectHints = resolvedEffectHints;
      }
      return {
        designId: sharedRevisionDesignId || `DES-${String(idx + 1).padStart(3, "0")}`,
        designRevision: sharedRevisionDesignId ? sharedRevisionDesignRevision : 0,
        designAuthor: sharedRevisionDesignId ? sharedRevisionDesignAuthor : "designer",
        section: str(label),
        energy,
        density,
        intentSummary: buildSectionIntentSummary({
          section: label,
          energy,
          density,
          goal: sectionGoal
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
          wholeSequence: passScope === "whole_sequence",
          energy,
          density,
          section: label,
          goal: intent.goal || ""
        }).slice(0, 40),
        effectHints: resolvedEffectHints
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
      requestId: resolvedRequestId,
      normalizedIntent: proposal.plan.normalizedIntent,
      intentText: promptText,
      creativeBrief: brief,
      proposalBundle: proposal.proposalBundle,
      baseRevision: sequenceRevision,
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
      sequencingDesignHandoff: handoff?.sequencingDesignHandoff || null,
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
