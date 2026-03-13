import { buildProposalFromIntent } from "../designer-dialog/planner.js";
import { buildProposalBundle } from "../designer-dialog/designer-dialog-contracts.js";
import { buildProposalLifecycle } from "../designer-dialog/designer-dialog-lifecycle.js";
import { buildCanonicalSequenceIntentHandoff } from "./sequence-intent-handoff.js";

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
    metadataAssignments
  });

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
    proposalLines: arr(plan.proposalLines),
    guidedQuestions: [],
    assumptions: arr(plan.normalizedIntent?.assumptions),
    riskNotes: !analysisHandoff
      ? ["Proceeding without analysis_handoff_v1. This direct technical request is in degraded mode."]
      : [],
    impact: {
      summary: "Direct technical sequencing request normalized for review/apply.",
      estimatedImpact: estimateImpact(plan.proposalLines)
    }
  });

  const intentHandoff = buildCanonicalSequenceIntentHandoff({
    normalizedIntent: plan.normalizedIntent,
    intentText: promptText,
    creativeBrief: null,
    elevatedRiskConfirmed
  });

  return {
    ok: true,
    creativeBrief: null,
    proposalBundle,
    intentHandoff,
    proposalLines: arr(proposalBundle.proposalLines),
    guidedQuestions: [],
    warnings: !analysisHandoff
      ? ["Proceeding without analysis_handoff_v1. Direct sequencing request should be reviewed conservatively."]
      : [],
    summary: proposalBundle.summary,
    mode: "direct_sequence_request"
  };
}
