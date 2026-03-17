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

function extractSectionLabels(analysisHandoff = null) {
  const sections = Array.isArray(analysisHandoff?.structure?.sections) ? analysisHandoff.structure.sections : [];
  return sections
    .map((row) => {
      if (typeof row === "string") return str(row);
      return str(row?.label || row?.name || "");
    })
    .filter(Boolean);
}

function hasPromptSectionLanguage(promptText = "") {
  return /\b(intro|verse|pre-chorus|post-chorus|chorus|bridge|hook|outro|refrain)\b/i.test(str(promptText));
}

function inferPromptSections(promptText = "", analysisHandoff = null) {
  const prompt = str(promptText);
  if (!prompt) return [];
  const lower = prompt.toLowerCase();
  const matches = [];
  for (const label of extractSectionLabels(analysisHandoff)) {
    const normalized = label.toLowerCase();
    if (!normalized) continue;
    if (lower.includes(normalized)) {
      matches.push(label);
    }
  }
  return matches;
}

function detectCompoundDirectRequest({
  promptText = "",
  explicitSections = [],
  inferredSections = [],
  requestedEffectPhrase = "",
  normalizedEffectOverrides = []
} = {}) {
  const prompt = str(promptText);
  const lower = prompt.toLowerCase();
  const effects = arr(normalizedEffectOverrides).map((row) => str(row)).filter(Boolean);
  const sections = [...new Set([...arr(explicitSections), ...arr(inferredSections)].map((row) => str(row)).filter(Boolean))];
  const hasJoiner = /\b(and|then|also)\b|,/.test(lower);
  const hasSecondActionVerb = /\b(and|then|also)\b[^.]*\b(add|apply|put|make|set)\b/.test(lower);
  const hasMultipleEffects = effects.length > 1;
  const hasMultipleSections = sections.length > 1;
  const hasExplicitEffectPhrase = Boolean(str(requestedEffectPhrase));

  if (!hasJoiner) return { compound: false, reason: "" };
  if (hasMultipleEffects || hasMultipleSections || (hasSecondActionVerb && hasExplicitEffectPhrase)) {
    return {
      compound: true,
      reason: "This request contains multiple sequencing clauses. Split it into one effect/section instruction per request so Patch can preserve the intent exactly."
    };
  }
  return { compound: false, reason: "" };
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
  const explicitSections = arr(selectedSections).map((row) => str(row)).filter(Boolean);
  const inferredSections = explicitSections.length ? [] : inferPromptSections(promptText, analysisHandoff);
  const effectiveSections = explicitSections.length ? explicitSections : inferredSections;
  const promptHasSectionScope = explicitSections.length > 0 || hasPromptSectionLanguage(promptText);
  if (promptHasSectionScope && !effectiveSections.length) {
    const missingSectionReason = analysisHandoff
      ? "I could not map the requested section name from the current audio analysis. Re-run audio analysis or choose a detected section label."
      : "This request names a song section, but no audio analysis is loaded for the selected track. Analyze the track first so Patch can anchor the effect to real timing sections.";
    return {
      ok: false,
      creativeBrief: null,
      proposalBundle: null,
      intentHandoff: null,
      proposalLines: [],
      guidedQuestions: [],
      warnings: [missingSectionReason],
      summary: "direct sequence flow failed",
      mode: "direct_sequence_request"
    };
  }

  const requestedEffectPhrase = detectRequestedEffectPhrase(promptText);
  const compoundRequest = detectCompoundDirectRequest({
    promptText,
    explicitSections,
    inferredSections,
    requestedEffectPhrase,
    normalizedEffectOverrides: requestedEffectPhrase ? [requestedEffectPhrase] : []
  });
  if (compoundRequest.compound) {
    return {
      ok: false,
      creativeBrief: null,
      proposalBundle: null,
      intentHandoff: null,
      proposalLines: [],
      guidedQuestions: [
        "Split this into separate requests, for example one prompt per effect/section pair."
      ],
      warnings: [compoundRequest.reason],
      summary: "direct sequence flow blocked",
      mode: "direct_sequence_request"
    };
  }

  const plan = buildProposalFromIntent({
    promptText,
    selectedSections: effectiveSections,
    selectedTagNames,
    selectedTargetIds,
    creativeBrief: null,
    directorPreferences: null,
    models,
    submodels,
    displayElements,
    metadataAssignments
  });
  const normalizedEffectOverrides = arr(plan.normalizedIntent?.effectOverrides).map((row) => str(row)).filter(Boolean);
  const compoundNormalizedRequest = detectCompoundDirectRequest({
    promptText,
    explicitSections,
    inferredSections,
    requestedEffectPhrase,
    normalizedEffectOverrides
  });
  if (compoundNormalizedRequest.compound) {
    return {
      ok: false,
      creativeBrief: null,
      proposalBundle: null,
      intentHandoff: null,
      proposalLines: [],
      guidedQuestions: [
        "Split this into separate requests, for example one prompt per effect/section pair."
      ],
      warnings: [compoundNormalizedRequest.reason],
      summary: "direct sequence flow blocked",
      mode: "direct_sequence_request"
    };
  }

  const resolvedRequestedEffectPhrase = str(normalizedEffectOverrides[0] || requestedEffectPhrase);
  const matchedEffectName = matchRequestedEffectName(resolvedRequestedEffectPhrase, effectCatalog);
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
  const unknownEffectRequested = Boolean(resolvedRequestedEffectPhrase) && !matchedEffectName;
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
            ? `Choose a loaded xLights effect name for "${resolvedRequestedEffectPhrase}" before applying changes.`
            : "Refresh the xLights effect library before using direct effect names in sequencer requests."
        ]
      : [];

  const proposalBundle = buildProposalBundle({
    proposalId: `proposal-${Date.now()}`,
    summary: str(promptText || "Sequence draft generated from direct technical request."),
    baseRevision: str(sequenceRevision || "unknown"),
    scope: {
      sections: effectiveSections,
      targetIds: arr(selectedTargetIds),
      tagNames: arr(selectedTagNames),
      summary: summarizeScope({
        sections: effectiveSections,
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
              ? `Requested effect "${resolvedRequestedEffectPhrase}" does not match a loaded xLights effect name.`
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
              ? `Requested effect "${resolvedRequestedEffectPhrase}" does not match a loaded xLights effect name.`
              : "Effect catalog unavailable. Refresh xLights effects before direct effect requests."
          ]
        : []),
      ...unresolvedWarnings
    ],
    summary: proposalBundle.summary,
    mode: "direct_sequence_request"
  };
}
