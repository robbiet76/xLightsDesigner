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
  const proposalBundle = buildProposalBundle({
    proposalId: makeId("proposal"),
    summary: str(promptText || plan.normalizedIntent?.goal || "Designer proposal generated from current conversation."),
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
