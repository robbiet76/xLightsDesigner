import { finalizeArtifact } from "../shared/artifact-ids.js";

function str(value = "") {
  return String(value || "").trim();
}

function inferIntentModeFromGoal(goal = "") {
  const lower = str(goal).toLowerCase();
  if (!lower) return "revise";
  if (/(analyz|audit|diagnos|review)/.test(lower)) return "analyze";
  if (/(polish|tighten|clean up|clean-up|refine)/.test(lower)) return "polish";
  if (/(create|build from scratch|new sequence|start from nothing)/.test(lower)) return "create";
  return "revise";
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function buildDefaultExecutionStrategy(normalizedIntent = {}, selectedSections = []) {
  const sections = Array.isArray(selectedSections) ? selectedSections.filter(Boolean) : [];
  const allowGlobalRewrite = Boolean(
    normalizedIntent?.preservationConstraints?.allowGlobalRewrite ??
    normalizedIntent?.allowGlobalRewrite
  );
  const passScope = allowGlobalRewrite
    ? "whole_sequence"
    : sections.length > 1
      ? "multi_section"
      : sections.length === 1
        ? "single_section"
        : "whole_sequence";
  return {
    passScope,
    implementationMode: passScope === "whole_sequence" ? "whole_sequence_pass" : "section_pass",
    routePreference: "designer_to_sequence_agent",
    shouldUseFullSongStructureTrack: true,
    sectionCount: sections.length,
    primarySections: sections.slice(0, 24)
  };
}

export function buildCanonicalSequenceIntentHandoff({
  normalizedIntent = {},
  intentText = "",
  creativeBrief = null,
  elevatedRiskConfirmed = false,
  resolvedTargetIds = null,
  executionStrategy = null
} = {}) {
  const selectedTargetIds = Array.isArray(resolvedTargetIds) && resolvedTargetIds.length
    ? resolvedTargetIds
    : (Array.isArray(normalizedIntent?.targetIds) ? normalizedIntent.targetIds : []);
  const selectedTags = Array.isArray(normalizedIntent?.tags) ? normalizedIntent.tags : [];
  const selectedSections = Array.isArray(normalizedIntent?.sections) ? normalizedIntent.sections : [];
  const goal = str(normalizedIntent?.goal || intentText);
  const mode = inferIntentModeFromGoal(goal);
  const normalizedExecutionStrategy = isPlainObject(executionStrategy)
    ? executionStrategy
    : buildDefaultExecutionStrategy(normalizedIntent, selectedSections);
  return finalizeArtifact({
    artifactType: "intent_handoff_v1",
    artifactVersion: "1.0",
    goal,
    mode,
    scope: {
      targetIds: selectedTargetIds,
      tagNames: selectedTags,
      sections: selectedSections,
      timeRangeMs: null
    },
    constraints: {
      changeTolerance: str(normalizedIntent?.changeTolerance || (mode === "polish" ? "low" : "medium")),
      preserveTimingTracks: normalizedIntent?.preserveTimingTracks !== false,
      allowGlobalRewrite: Boolean(
        normalizedIntent?.preservationConstraints?.allowGlobalRewrite ??
        (mode === "create")
      )
    },
    directorPreferences: {
      styleDirection: str(creativeBrief?.mood || creativeBrief?.styleDirection || normalizedIntent?.styleDirection || ""),
      energyArc: str(normalizedIntent?.tempoIntent || "hold"),
      focusElements: selectedTargetIds.slice(0, 40),
      colorDirection: str(creativeBrief?.paletteIntent || creativeBrief?.colorDirection || normalizedIntent?.colorDirection || "")
    },
    executionStrategy: normalizedExecutionStrategy,
    approvalPolicy: {
      requiresExplicitApprove: true,
      elevatedRiskConfirmed: Boolean(elevatedRiskConfirmed)
    }
  });
}
