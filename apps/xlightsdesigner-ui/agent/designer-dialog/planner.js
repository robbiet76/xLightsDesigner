import { normalizeIntent } from "./intent-normalizer.js";
import { resolveTargetSelection } from "../sequence-agent/target-resolver.js";
import { buildSequencingStrategy } from "../sequence-agent/sequencing-strategy.js";

function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function prependUnique(lines = [], additions = []) {
  const normalized = new Set(arr(lines).map((line) => str(line).toLowerCase()).filter(Boolean));
  const merged = [];
  for (const line of arr(additions).map((row) => str(row)).filter(Boolean)) {
    const key = line.toLowerCase();
    if (normalized.has(key)) continue;
    normalized.add(key);
    merged.push(line);
  }
  return [...merged, ...arr(lines).map((row) => str(row)).filter(Boolean)];
}

function classifyGuidanceConcept(line = "") {
  const lower = str(line).toLowerCase();
  if (!lower) return "";
  if (/(warm welcoming base|little wonder|palette cool and crisp)/.test(lower)) return "mood";
  if (/(simplify the pass|tighten the focal read|keep the impact legible|adding more noise)/.test(lower)) return "readability_refine";
  if (/(focal clarity|lead visual anchor|clear focal hierarchy|focal accents)/.test(lower)) return "focal";
  if (/(broad base coverage|detail refinement)/.test(lower)) return "structure";
  if (/(stronger visual payoff|impact section|shape a reveal|escalation into the moment|lift feel bigger)/.test(lower)) return "impact";
  if (/(restrained and readable|calmer hold section|without extra clutter)/.test(lower)) return "hold";
  if (/(preserve groove|tighter transition timing|balance focal effects and ambient beds)/.test(lower)) return "generic_balance";
  return "";
}

function pruneRedundantLines(lines = [], normalizedIntent = null) {
  const intent = normalizedIntent && typeof normalizedIntent === "object" ? normalizedIntent : {};
  const isReadabilityRefinement =
    arr(intent.safetyConstraints).map((row) => str(row)).includes("preserve_readability") &&
    str(intent.tempoIntent) !== "increase";
  const seenConcepts = new Set();
  const out = [];
  let genericGeneralCount = 0;

  for (const line of arr(lines).map((row) => str(row)).filter(Boolean)) {
    const concept = classifyGuidanceConcept(line);
    if (isReadabilityRefinement && concept === "generic_balance") {
      continue;
    }
    if (concept && seenConcepts.has(concept)) {
      continue;
    }
    if (concept) seenConcepts.add(concept);
    const isGenericGeneral = /^general\s*\/\s*general\s*\//i.test(line);
    const isLightingStructureLine = /lighting stack|focal-versus-support|key-vs-fill/i.test(line);
    if (isGenericGeneral && !isLightingStructureLine) {
      genericGeneralCount += 1;
      if (genericGeneralCount > 2) {
        continue;
      }
    }
    out.push(line);
  }

  return out;
}

function readProfileSignal(profile = null, key = "") {
  const signal = profile?.preferences?.[key];
  if (!signal || typeof signal !== "object") return null;
  const weight = Number(signal.weight);
  const confidence = Number(signal.confidence);
  const evidenceCount = Number(signal.evidenceCount);
  if (!Number.isFinite(weight) || !Number.isFinite(confidence) || !Number.isFinite(evidenceCount)) return null;
  if (confidence < 0.35 || evidenceCount < 2 || Math.abs(weight) < 0.2) return null;
  return { weight, confidence, evidenceCount, notes: str(signal.notes) };
}

function buildSceneGuidanceLines({ designSceneContext = null, sections = [] } = {}) {
  const scene = designSceneContext && typeof designSceneContext === "object" ? designSceneContext : {};
  const broad = arr(scene?.coverageDomains?.broad).filter(Boolean);
  const detail = arr(scene?.coverageDomains?.detail).filter(Boolean);
  const focal = arr(scene?.focalCandidates).filter(Boolean);
  const zones = scene?.spatialZones && typeof scene.spatialZones === "object" ? scene.spatialZones : {};
  const scope = arr(sections).filter(Boolean).join(", ") || "General";
  const lines = [];
  const lowerGoal = str(scene?.goalHint).toLowerCase();

  const firstForeground = arr(zones.foreground).filter(Boolean)[0] || "";
  const firstBackground = arr(zones.background).filter(Boolean)[0] || "";
  const firstLeft = arr(zones.left).filter(Boolean)[0] || "";
  const firstRight = arr(zones.right).filter(Boolean)[0] || "";

  if (/foreground/.test(lowerGoal) && firstForeground) {
    lines.push(`${scope} / ${firstForeground} / keep the foreground calmer so the nearer layer does not crowd the frame`);
  }
  if (/background/.test(lowerGoal) && firstBackground) {
    lines.push(`${scope} / ${firstBackground} / let the background open up with broader support to add depth behind the focal layer`);
  }
  if (/left side|left\b/.test(lowerGoal) && firstLeft) {
    lines.push(`${scope} / ${firstLeft} / keep the left side gentler and less pushy in the opening read`);
  }
  if (/right side|right\b/.test(lowerGoal) && firstRight) {
    lines.push(`${scope} / ${firstRight} / let the right side carry more lift and definition than the left`);
  }

  if (broad.length) {
    lines.push(`${scope} / ${broad[0]} / establish broad base coverage before detail refinement`);
  }
  if (focal.length) {
    lines.push(`${scope} / ${focal[0]} / preserve focal clarity as the lead visual anchor`);
  }
  if (detail.length) {
    lines.push(`${scope} / ${detail[0]} / use detail refinement only after the base pass reads cleanly`);
  }
  return lines;
}

function buildIntentGuidanceLines({ normalizedIntent = null } = {}) {
  const intent = normalizedIntent && typeof normalizedIntent === "object" ? normalizedIntent : {};
  const sections = arr(intent.sections).filter(Boolean);
  const scope = sections.join(", ") || "General";
  const lines = [];
  const goal = str(intent.goal).toLowerCase();
  const colorDirection = str(intent.colorDirection);
  const styleDirection = str(intent.styleDirection);
  const motionIntent = str(intent.motionIntent);
  const tempoIntent = str(intent.tempoIntent);
  const safety = new Set(arr(intent.safetyConstraints).map((row) => str(row)));

  if (colorDirection === "warm" || /warm|welcoming|magical/.test(goal)) {
    lines.push(`${scope} / General / build a warm welcoming base that still leaves room for a little wonder`);
  } else if (colorDirection === "cool") {
    lines.push(`${scope} / General / keep the palette cool and crisp without flattening the musical lift`);
  }

  if (/(department store holiday window|elegant|glowing|theatrical)/.test(goal)) {
    lines.push(`${scope} / General / keep the picture elegant and glowing with a composed theatrical frame instead of busy motion`);
  }

  if (/(breath|pauses for a breath|pause for a breath|opens up)/.test(goal)) {
    lines.push(`${scope} / General / shape the phrase as a held breath before the next section opens with clearer release`);
  }

  if (safety.has("preserve_readability") || /cleaner|focused|focus/.test(goal)) {
    lines.push(`${scope} / General / simplify the pass and tighten the focal read so the moment lands more clearly`);
  }

  if (styleDirection === "cinematic") {
    lines.push(`${scope} / General / let the phrasing breathe with broader cinematic transitions instead of busy accents`);
    lines.push(`${scope} / General / shape the pass like a lighting stack with restrained base washes and clearer focal-versus-support separation`);
  } else if (styleDirection === "punchy" || motionIntent === "punchy" || tempoIntent === "increase") {
    lines.push(`${scope} / General / let the lift feel bigger through sharper contrast without turning chaotic`);
  } else if (styleDirection === "smooth" || motionIntent === "smooth") {
    lines.push(`${scope} / General / favor smooth motion and connected transitions over choppy texture changes`);
  }

  return lines;
}

function buildMusicGuidanceLines({ musicDesignContext = null, sections = [], normalizedIntent = null } = {}) {
  const music = musicDesignContext && typeof musicDesignContext === "object" ? musicDesignContext : {};
  const intent = normalizedIntent && typeof normalizedIntent === "object" ? normalizedIntent : {};
  const sectionArc = arr(music.sectionArc);
  const reveals = arr(music?.designCues?.revealMoments).filter(Boolean);
  const holds = arr(music?.designCues?.holdMoments).filter(Boolean);
  const targetSections = arr(sections).filter(Boolean);
  const safety = new Set(arr(intent.safetyConstraints).map((row) => str(row)));
  const isReadabilityRefinement =
    safety.has("preserve_readability") &&
    str(intent.tempoIntent) !== "increase" &&
    str(intent.styleDirection) !== "punchy";
  const lines = [];

  for (const section of sectionArc) {
    const label = str(section?.label);
    if (!label) continue;
    if (targetSections.length && !targetSections.includes(label)) continue;
    const energy = str(section?.energy);
    if (energy === "high") {
      if (isReadabilityRefinement) {
        lines.push(`${label} / General / keep the impact legible by tightening the moment instead of adding more noise`);
      } else {
        lines.push(`${label} / General / build stronger visual payoff and clearer contrast at this impact section`);
      }
    } else if (energy === "low") {
      lines.push(`${label} / General / keep the pass restrained and readable to preserve space`);
    }
  }

  if (!isReadabilityRefinement) {
    for (const reveal of reveals.slice(0, 2)) {
      lines.push(`General / General / shape a reveal around ${str(reveal)} with clearer escalation into the moment`);
    }
  }
  for (const hold of holds.slice(0, 2)) {
    lines.push(`General / General / protect ${str(hold)} as a calmer hold section without extra clutter`);
  }

  return lines;
}

function buildPreferenceGuidanceLines({ directorProfile = null, normalizedIntent = null } = {}) {
  const sections = arr(normalizedIntent?.sections).filter(Boolean);
  const scope = sections.join(", ") || "General";
  const lines = [];
  const focusBias = readProfileSignal(directorProfile, "focusBias");
  const changeTolerance = readProfileSignal(directorProfile, "changeTolerance");
  const complexityTolerance = readProfileSignal(directorProfile, "complexityTolerance");

  if (focusBias?.weight > 0) {
    lines.push(`${scope} / General / keep the pass anchored around a clear focal hierarchy before broad expansion`);
  } else if (focusBias?.weight < 0) {
    lines.push(`${scope} / General / allow broader coverage to read before isolating focal accents`);
  }

  if (changeTolerance?.weight < 0) {
    lines.push(`${scope} / General / keep this pass incremental and preserve more of the current look`);
  } else if (changeTolerance?.weight > 0) {
    lines.push(`${scope} / General / allow a bolder revision pass where the design needs a stronger reset`);
  }

  if (complexityTolerance?.weight < 0) {
    lines.push(`${scope} / General / prefer cleaner readable choices over dense layering unless the moment demands it`);
  } else if (complexityTolerance?.weight > 0) {
    lines.push(`${scope} / General / tolerate denser layering when it strengthens the moment without losing clarity`);
  }

  return lines;
}

function normalizeName(value = "") {
  return String(value || "").trim().toLowerCase();
}

function buildMetadataGuidanceLines({ normalizedIntent = null, targets = [], metadataAssignments = [] } = {}) {
  const intent = normalizedIntent && typeof normalizedIntent === "object" ? normalizedIntent : {};
  const scope = arr(intent.sections).filter(Boolean).join(", ") || "General";
  const lowerGoal = str(intent.goal).toLowerCase();
  const tagNames = arr(intent.tags).map((row) => str(row)).filter(Boolean);
  if (!tagNames.length) return [];

  const tagsByTargetId = new Map();
  for (const assignment of metadataAssignments || []) {
    const targetId = str(assignment?.targetId);
    if (!targetId) continue;
    const tags = arr(assignment?.tags).map((row) => normalizeName(row)).filter(Boolean);
    if (tags.length) tagsByTargetId.set(targetId, tags);
  }

  const lines = [];
  for (const tagName of tagNames) {
    const normalizedTag = normalizeName(tagName);
    const target = arr(targets).find((row) => {
      const id = str(row?.id || row?.name);
      return id && arr(tagsByTargetId.get(id)).includes(normalizedTag);
    });
    if (!target) continue;
    const targetName = str(target?.name || target?.id);
    if (!targetName) continue;

    if (normalizedTag === "character") {
      lines.push(`${scope} / ${targetName} / let the character props carry the primary visual story without losing readability`);
    } else if (normalizedTag === "support") {
      if (/fill|key light|key-light/.test(lowerGoal)) {
        lines.push(`${scope} / ${targetName} / keep this support prop in a gentle fill role so it frames the lead read without competing`);
      } else {
        lines.push(`${scope} / ${targetName} / keep the support props subtle so they frame the moment without competing`);
      }
    } else if (normalizedTag === "lyric") {
      lines.push(`${scope} / ${targetName} / use the lyric props to underline the words with cleaner emphasis`);
    } else if (normalizedTag === "rhythm") {
      lines.push(`${scope} / ${targetName} / let the rhythm props carry the lift and pulse of the section`);
    } else if (normalizedTag === "focal" || normalizedTag === "hero" || normalizedTag === "lead") {
      if (/key light|key-light/.test(lowerGoal)) {
        lines.push(`${scope} / ${targetName} / treat this focal prop like the key-light lead so the main read stays dominant`);
      } else {
        lines.push(`${scope} / ${targetName} / preserve this tagged focal element as the clearest lead read`);
      }
    } else if (normalizedTag === "perimeter") {
      if (/fill|frame|framing|key light|key-light/.test(lowerGoal)) {
        lines.push(`${scope} / ${targetName} / let the perimeter props act as soft fill and framing rather than stealing focus`);
      } else {
        lines.push(`${scope} / ${targetName} / use the perimeter props to frame the scene without taking over the focal read`);
      }
    } else {
      lines.push(`${scope} / ${targetName} / honor the ${tagName} tag as a real semantic role in the pass`);
    }
  }

  return lines;
}

function applyDesignerContextToProposalLines({
  proposalLines = [],
  normalizedIntent = null,
  designSceneContext = null,
  musicDesignContext = null,
  directorProfile = null,
  metadataAssignments = [],
  targets = []
} = {}) {
  const sections = arr(normalizedIntent?.sections).filter(Boolean);
  const intentLines = buildIntentGuidanceLines({ normalizedIntent });
  const sceneLines = buildSceneGuidanceLines({
    designSceneContext: {
      ...(designSceneContext && typeof designSceneContext === "object" ? designSceneContext : {}),
      goalHint: str(normalizedIntent?.goal)
    },
    sections
  });
  const musicLines = buildMusicGuidanceLines({ musicDesignContext, sections, normalizedIntent });
  const preferenceLines = buildPreferenceGuidanceLines({ directorProfile, normalizedIntent });
  const metadataLines = buildMetadataGuidanceLines({ normalizedIntent, targets, metadataAssignments });
  return pruneRedundantLines(
    prependUnique(proposalLines, [...intentLines, ...sceneLines, ...musicLines, ...preferenceLines, ...metadataLines]),
    normalizedIntent
  ).slice(0, 8);
}

export function buildProposalFromIntent(input = {}) {
  const availableSectionNames = [
    ...arr(input?.musicDesignContext?.sectionArc).map((row) => str(row?.label)).filter(Boolean),
    ...arr(input?.analysisHandoff?.structure?.sections).map((row) => str(typeof row === "string" ? row : (row?.label || row?.name))).filter(Boolean)
  ];
  const normalizedIntent = normalizeIntent({
    ...input,
    availableSectionNames,
    metadataAssignments: input.metadataAssignments
  });
  const selection = resolveTargetSelection({
    normalizedIntent,
    models: input.models,
    submodels: input.submodels,
    metadataAssignments: input.metadataAssignments,
    displayElements: input.displayElements
  });
  const targets = selection.targets;
  const proposalLines = applyDesignerContextToProposalLines({
    proposalLines: buildSequencingStrategy(normalizedIntent, targets),
    normalizedIntent,
    designSceneContext: input.designSceneContext,
    musicDesignContext: input.musicDesignContext,
    directorProfile: input.directorProfile
    ,
    metadataAssignments: input.metadataAssignments,
    targets
  });

  return {
    normalizedIntent,
    targets,
    proposalLines,
    unresolvedTargets: selection.unresolvedTargets,
    resolutionSource: selection.resolutionSource || "none"
  };
}
