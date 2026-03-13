import { buildProposalFromIntent } from "../designer-dialog/planner.js";
import { buildProposalBundle } from "../designer-dialog/designer-dialog-contracts.js";
import { buildProposalLifecycle } from "../designer-dialog/designer-dialog-lifecycle.js";
import { buildCanonicalSequenceIntentHandoff } from "./sequence-intent-handoff.js";
import { buildSequencingStrategy } from "./sequencing-strategy.js";

function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function summarizeScope({ sections = [], targetIds = [], tagNames = [] } = {}) {
  const parts = [];
  if (arr(sections).length) parts.push(`sections: ${arr(sections).slice(0, 3).join(", ")}`);
  if (arr(targetIds).length) parts.push(`targets: ${arr(targetIds).slice(0, 3).join(", ")}`);
  if (arr(tagNames).length) parts.push(`tags: ${arr(tagNames).slice(0, 3).join(", ")}`);
  return parts.join(" | ");
}

function estimateImpact(proposalLines = []) {
  return Math.max(arr(proposalLines).length * 8, 0);
}

function normalizeCatalog(effectCatalog = null) {
  return effectCatalog && typeof effectCatalog === "object" && effectCatalog.byName && typeof effectCatalog.byName === "object"
    ? effectCatalog.byName
    : {};
}

function detectRequestedEffectPhrase(promptText = "") {
  const text = str(promptText);
  if (!text) return "";
  const match = text.match(/\b(?:add|apply|put|make|set)\s+(?:a|an)?\s*([a-z0-9][a-z0-9 +_-]{0,40}?)\s+effect\b/i);
  return str(match?.[1] || "");
}

function matchRequestedEffectName(effectPhrase = "", effectCatalog = null) {
  const phrase = str(effectPhrase).toLowerCase();
  if (!phrase) return "";
  const byName = normalizeCatalog(effectCatalog);
  const exact = Object.keys(byName).find((name) => str(name).toLowerCase() === phrase);
  if (exact) return exact;
  const squashedPhrase = phrase.replace(/\s+/g, "");
  const squashed = Object.keys(byName).find((name) => str(name).toLowerCase().replace(/\s+/g, "") === squashedPhrase);
  return squashed || "";
}

export function executeDirectSequenceRequestOrchestration({
  requestId = "",
  sequenceRevision = "unknown",
  promptText = "",
  selectedSections = [],
  selectedTagNames = [],
  selectedTargetIds = [],
  analysisHandoff = null,
  models = [],
  submodels = [],
  displayElements = [],
  effectCatalog = null,
  metadataAssignments = [],
  elevatedRiskConfirmed = false
} = {}) {
  const plan = buildProposalFromIntent({
    promptText,
    selectedSections,
    selectedTagNames,
    selectedTargetIds,
    creativeBrief: null,
    directorPreferences: null,
    models,
    submodels,
    displayElements,
    metadataAssignments
  });
  const requestedEffectPhrase = str(arr(plan.normalizedIntent?.effectOverrides)[0] || detectRequestedEffectPhrase(promptText));
  const matchedEffectName = matchRequestedEffectName(requestedEffectPhrase, effectCatalog);
  if (matchedEffectName) {
    plan.normalizedIntent.effectOverrides = [matchedEffectName];
    plan.proposalLines = buildSequencingStrategy(plan.normalizedIntent, plan.targets);
  }

  const unresolvedTargets = arr(plan.unresolvedTargets);
  const unresolvedWarnings = unresolvedTargets.map((target) => {
    const name = str(target?.name || target?.id);
    return `Requested target ${name} is not a writable sequencer element in the current sequence. Add it to the sequence display elements or choose a visible sequencer target instead.`;
  });
  const effectCatalogLoaded = Object.keys(normalizeCatalog(effectCatalog)).length > 0;
  const unknownEffectRequested = Boolean(requestedEffectPhrase) && !matchedEffectName;
  const proposalLines = unresolvedTargets.length && !arr(plan.targets).length
    ? []
    : unknownEffectRequested
      ? []
      : arr(plan.proposalLines);
  const guidedQuestions = unresolvedTargets.length && !arr(plan.targets).length
    ? ["Choose a visible sequencer target for this request before applying changes."]
    : unknownEffectRequested
      ? [
          effectCatalogLoaded
            ? `Choose a loaded xLights effect name for "${requestedEffectPhrase}" before applying changes.`
            : "Refresh the xLights effect library before using direct effect names in sequencer requests."
        ]
      : [];

  const proposalBundle = buildProposalBundle({
    proposalId: `proposal-${Date.now()}`,
    summary: str(promptText || "Sequence draft generated from direct technical request."),
    baseRevision: str(sequenceRevision || "unknown"),
    scope: {
      sections: arr(selectedSections),
      targetIds: arr(selectedTargetIds),
      tagNames: arr(selectedTagNames),
      summary: summarizeScope({
        sections: selectedSections,
        targetIds: selectedTargetIds,
        tagNames: selectedTagNames
      })
    },
    constraints: {
      changeTolerance: str(plan.normalizedIntent?.changeTolerance || "moderate"),
      preserveTimingTracks: plan.normalizedIntent?.preserveTimingTracks !== false,
      preserveDisplayOrder: plan.normalizedIntent?.preservationConstraints?.preserveDisplayOrder !== false,
      allowGlobalRewrite: Boolean(plan.normalizedIntent?.preservationConstraints?.allowGlobalRewrite)
    },
    lifecycle: buildProposalLifecycle(sequenceRevision),
    proposalLines,
    guidedQuestions,
    assumptions: arr(plan.normalizedIntent?.assumptions),
    riskNotes: [
      ...(!analysisHandoff
        ? ["Proceeding without analysis_handoff_v1. This direct technical request is in degraded mode."]
        : []),
      ...(unknownEffectRequested
        ? [
            effectCatalogLoaded
              ? `Requested effect "${requestedEffectPhrase}" does not match a loaded xLights effect name.`
              : "Effect catalog is unavailable, so direct effect-name matching cannot be validated."
          ]
        : []),
      ...unresolvedWarnings
    ],
    impact: {
      summary: "Direct technical sequencing request normalized for review/apply.",
      estimatedImpact: estimateImpact(plan.proposalLines)
    }
  });

  const intentHandoff = buildCanonicalSequenceIntentHandoff({
    normalizedIntent: plan.normalizedIntent,
    intentText: promptText,
    creativeBrief: null,
    elevatedRiskConfirmed,
    resolvedTargetIds: arr(plan.targets).map((row) => str(row?.id || row?.name)).filter(Boolean)
  });

  return {
    ok: true,
    creativeBrief: null,
    proposalBundle,
    intentHandoff,
    proposalLines: arr(proposalBundle.proposalLines),
    guidedQuestions,
    warnings: [
      ...(!analysisHandoff
        ? ["Proceeding without analysis_handoff_v1. Direct sequencing request should be reviewed conservatively."]
        : []),
      ...(unknownEffectRequested
        ? [
            effectCatalogLoaded
              ? `Requested effect "${requestedEffectPhrase}" does not match a loaded xLights effect name.`
              : "Effect catalog unavailable. Refresh xLights effects before direct effect requests."
          ]
        : []),
      ...unresolvedWarnings
    ],
    summary: proposalBundle.summary,
    mode: "direct_sequence_request"
  };
}
