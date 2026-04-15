import { finalizeArtifact } from "../shared/artifact-ids.js";

function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function unique(values = []) {
  return [...new Set(arr(values).map((row) => str(row)).filter(Boolean))];
}

function inferPrimaryMotion(text = "") {
  const lower = str(text).toLowerCase();
  if (/\bhold\b|\bsteady\b|\bsolid\b|\bminimal movement\b|\bstill\b/.test(lower)) return "hold";
  if (/\bspin\b|\bpinwheel\b|\bradial spin\b/.test(lower)) return "spin";
  if (/\bshockwave\b|\bburst\b|\bring burst\b|\bradial expansion\b/.test(lower)) return "burst";
  if (/\bshimmer\b/.test(lower)) return "shimmer";
  if (/\btwinkle\b|\bsparkle\b/.test(lower)) return "shimmer";
  if (/\bchase\b|\btravel\b|\bdirectional\b/.test(lower)) return "chase";
  if (/\bspiral\b|\bflow\b|\bflowing\b|\bdrift\b/.test(lower)) return "drift";
  if (/\bwash\b/.test(lower)) return "hold";
  return "hold";
}

function inferPrimaryTexture(text = "") {
  const lower = str(text).toLowerCase();
  if (/\bsegmented\b|\bbands\b|\bbar(s)?\b/.test(lower)) return "segmented";
  if (/\bshimmer\b|\btwinkle\b|\bsparkle\b|\btexture\b/.test(lower)) return "sparkling";
  if (/\bsolid\b|\bhold\b/.test(lower)) return "solid";
  if (/\bwash\b|\bsmooth\b|\bsoft\b/.test(lower)) return "smooth";
  if (/\bpinwheel\b|\bspiral\b|\bshockwave\b/.test(lower)) return "banded";
  return "smooth";
}

function inferEnergyLevel(text = "") {
  const lower = str(text).toLowerCase();
  if (/\brestrained\b|\bsoft\b|\bgentle\b|\bcalm\b/.test(lower)) return "restrained";
  if (/\bbold\b|\bfinal chorus\b|\baggressive\b|\bstrong\b/.test(lower)) return "aggressive";
  return "moderate";
}

function inferCoverageLevel(text = "") {
  const lower = str(text).toLowerCase();
  if (/\bbroad\b|\bfull\b|\bcoverage\b|\bfill\b|\bwash\b/.test(lower)) return "broad";
  if (/\bsingle\b|\bfocused\b|\blead\b/.test(lower)) return "focused";
  return "focused";
}

function inferTransitionCharacter(text = "") {
  const lower = str(text).toLowerCase();
  if (/\bgentle\b|\bsoft\b|\bdissolve\b/.test(lower)) return "gentle";
  if (/\bdirectional\b|\btravel\b|\bchase\b/.test(lower)) return "directional";
  if (/\bhard\b|\bsnap\b|\bstrobe\b/.test(lower)) return "hard";
  return "gentle";
}

function inferCompositionGoal({ promptText = "", sections = [], targetIds = [] } = {}) {
  const summary = str(promptText) || "Translate the requested scoped lighting picture.";
  return {
    summary,
    primaryRead: targetIds.length ? `${targetIds[0]} should carry the most readable visual idea.` : "",
    secondaryRead: targetIds.length > 1 ? `${targetIds.slice(1, 3).join(", ")} should support without stealing focus.` : "",
    antiRead: "",
    developmentArc: sections.length ? `Express a coherent ${sections.join(", ")} section picture without losing scope discipline.` : "Express a coherent scoped lighting picture."
  };
}

function buildSectionRoles(sections = [], promptText = "") {
  const lower = str(promptText).toLowerCase();
  return unique(sections).map((section) => ({
    section,
    role: /\bintro\b/i.test(section)
      ? "setup"
      : /\bbridge\b/i.test(section)
        ? "release"
        : /\boutro\b/i.test(section)
          ? "hold"
          : /\bchorus\b/i.test(section)
            ? "build"
            : "setup",
    intendedChange: /\bbuild\b|\blift\b|\bbloom\b/.test(lower)
      ? "increase visual emphasis across the section"
      : /\bhold\b|\bsteady\b/.test(lower)
        ? "preserve stable visual identity"
        : "",
    mustPreserve: []
  }));
}

function buildTargetRoles(targetIds = [], promptText = "") {
  const lower = str(promptText).toLowerCase();
  return unique(targetIds).map((targetId, index) => ({
    targetId,
    role: index === 0 ? "lead" : "support",
    importance: index === 0 ? "primary" : "secondary",
    focusBehavior: index === 0
      ? "steady_focus"
      : (/\bquiet\b|\bsecondary\b|\bsupport\b/.test(lower) ? "quiet_support" : "background_fill"),
    interactionNotes: index === 0 ? "Carry the clearest read." : "Support without stealing focus."
  }));
}

function buildBehaviorTargets({ sections = [], targetIds = [], promptText = "" } = {}) {
  const summary = str(promptText);
  const sectionLabel = unique(sections)[0] || "General";
  const primaryMotion = inferPrimaryMotion(summary);
  const primaryTexture = inferPrimaryTexture(summary);
  const energyLevel = inferEnergyLevel(summary);
  const coverageLevel = inferCoverageLevel(summary);
  const transitionCharacter = inferTransitionCharacter(summary);
  const targets = [];
  targets.push({
    appliesTo: "section",
    targetId: "",
    behaviorSummary: summary,
    motion: { primaryMotion },
    texture: { primaryTexture },
    energy: { energyLevel },
    coverage: { coverageLevel },
    hierarchy: { role: "lead" },
    transitions: { entryCharacter: transitionCharacter, exitCharacter: transitionCharacter },
    section: sectionLabel
  });
  for (const targetId of unique(targetIds)) {
    targets.push({
      appliesTo: "target",
      targetId,
      behaviorSummary: summary,
      motion: { primaryMotion },
      texture: { primaryTexture },
      energy: { energyLevel },
      coverage: { coverageLevel },
      hierarchy: { role: targetId === unique(targetIds)[0] ? "lead" : "support" },
      transitions: { entryCharacter: transitionCharacter, exitCharacter: transitionCharacter }
    });
  }
  return targets;
}

export function buildTranslationIntentV1({
  promptText = "",
  sections = [],
  targetIds = [],
  effectHints = [],
  source = {}
} = {}) {
  const normalizedSections = unique(sections);
  const normalizedTargetIds = unique(targetIds);
  const normalizedPrompt = str(promptText);
  const normalizedHints = unique(effectHints);
  const behaviorSeed = [normalizedPrompt, ...normalizedHints].join(" ").trim();
  return finalizeArtifact({
    artifactType: "translation_intent_v1",
    artifactVersion: "1.0",
    source,
    scope: {
      goalLevel: normalizedSections.length > 1 ? "section" : "prop",
      sectionScope: normalizedSections,
      targetScope: normalizedTargetIds,
      timeRangeMs: null
    },
    compositionGoal: inferCompositionGoal({
      promptText: normalizedPrompt,
      sections: normalizedSections,
      targetIds: normalizedTargetIds
    }),
    sectionRoles: buildSectionRoles(normalizedSections, behaviorSeed),
    targetRoles: buildTargetRoles(normalizedTargetIds, behaviorSeed),
    behaviorTargets: buildBehaviorTargets({
      sections: normalizedSections,
      targetIds: normalizedTargetIds,
      promptText: behaviorSeed
    }),
    realizationGuidance: {
      preferredFamilies: normalizedHints,
      discouragedFamilies: [],
      preferredPaletteModes: [],
      preferredSharedSettingBehaviors: [],
      allowedVariationAxes: ["family_choice", "parameter_anchor", "palette_mode"],
      evidenceStrength: "low"
    },
    successChecks: [
      "lead remains visually readable",
      "behavior stays within the requested motion and texture envelope"
    ],
    traceability: {
      promptSummary: normalizedPrompt,
      selectedSections: normalizedSections,
      selectedTargets: normalizedTargetIds,
      effectHints: normalizedHints
    }
  });
}
