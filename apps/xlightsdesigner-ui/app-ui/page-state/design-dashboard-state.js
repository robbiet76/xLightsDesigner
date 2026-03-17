function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueStrings(values = []) {
  return [...new Set(arr(values).map((value) => str(value)).filter(Boolean))];
}

function summarizePalette(colors = []) {
  const list = uniqueStrings(colors);
  return {
    colors: list.slice(0, 5),
    count: list.length
  };
}

function buildConceptRows(executionPlan = null) {
  const plan = executionPlan && typeof executionPlan === "object" ? executionPlan : {};
  const sectionPlans = arr(plan.sectionPlans);
  const effectPlacements = arr(plan.effectPlacements);
  const placementsByDesignId = new Map();
  for (const placement of effectPlacements) {
    const designId = str(placement?.designId);
    if (!designId) continue;
    if (!placementsByDesignId.has(designId)) placementsByDesignId.set(designId, []);
    placementsByDesignId.get(designId).push(placement);
  }
  return sectionPlans
    .map((sectionPlan, index) => {
      const designId = str(sectionPlan?.designId || `DES-${String(index + 1).padStart(3, "0")}`);
      const placements = placementsByDesignId.get(designId) || [];
      const focusTargets = uniqueStrings(sectionPlan?.targetIds).slice(0, 3);
      const palette = summarizePalette(placements.flatMap((placement) => arr(placement?.paletteIntent?.colors)));
      const effectFamilies = uniqueStrings(placements.map((placement) => placement?.effectName));
      return {
        index: index + 1,
        designId,
        designAuthor: str(sectionPlan?.designAuthor || "designer"),
        anchor: str(sectionPlan?.section || "General"),
        intent: str(sectionPlan?.intentSummary || "No design intent summary yet."),
        focus: focusTargets,
        palette,
        effectFamilies,
        placementCount: placements.length
      };
    })
    .filter((row) => row.designId);
}

export function buildDesignDashboardState({
  state = {}
} = {}) {
  const runtime = state.creative?.runtime && typeof state.creative.runtime === "object"
    ? state.creative.runtime
    : null;
  const brief = state.creative?.brief && typeof state.creative.brief === "object"
    ? state.creative.brief
    : null;
  const bundle = state.creative?.proposalBundle && typeof state.creative.proposalBundle === "object"
    ? state.creative.proposalBundle
    : null;
  const references = arr(state.creative?.references);
  const swatches = arr(state.inspiration?.paletteSwatches).filter(Boolean);
  const assumptions = arr(bundle?.assumptions).filter(Boolean).slice(0, 3);
  const guidedQuestions = arr(bundle?.guidedQuestions).filter(Boolean).slice(0, 3);
  const warnings = arr(runtime?.warnings).filter(Boolean).slice(0, 3);
  const designSignals = bundle?.traceability?.designSceneSignals || {};
  const musicSignals = bundle?.traceability?.musicDesignSignals || {};
  const executionPlan = bundle?.executionPlan && typeof bundle.executionPlan === "object"
    ? bundle.executionPlan
    : null;
  const conceptRows = buildConceptRows(executionPlan);
  const planPlacements = arr(executionPlan?.effectPlacements);
  const planEffectFamilies = uniqueStrings(planPlacements.map((row) => row?.effectName));
  const planLayers = uniqueStrings(planPlacements.map((row) => Number.isFinite(Number(row?.layerIndex)) ? `L${Number(row.layerIndex)}` : ""));
  const focal = arr(designSignals?.focalCandidates).filter(Boolean).slice(0, 3);
  const broad = arr(designSignals?.broadCoverageDomains).filter(Boolean).slice(0, 3);
  const reveals = arr(musicSignals?.revealMoments).filter(Boolean).slice(0, 3);
  const holds = arr(musicSignals?.holdMoments).filter(Boolean).slice(0, 3);
  const sourceLabel = runtime?.source === "cloud_normalized"
    ? "Cloud Designer"
    : runtime?.source === "local_runtime"
      ? "Local Fallback"
      : "Idle";

  const applyHistory = arr(state.applyHistory);
  const lastApply = applyHistory.length ? applyHistory[0] : null;
  const lastAppliedSnapshot =
    state.ui?.reviewHistorySnapshot &&
    typeof state.ui.reviewHistorySnapshot === "object" &&
    state.ui.reviewHistorySnapshot.historyEntryId === str(lastApply?.historyEntryId)
      ? state.ui.reviewHistorySnapshot
      : null;

  const validationIssues = [];
  if (!brief && !bundle && !runtime) {
    validationIssues.push({
      code: "no_design_state",
      severity: "info",
      message: "No design state has been captured yet."
    });
  }
  if (arr(bundle?.guidedQuestions).length > 0) {
    validationIssues.push({
      code: "designer_needs_input",
      severity: "warning",
      message: "Designer still has open questions that may block refinement."
    });
  }

  let status = "idle";
  let readinessLevel = "idle";
  if (bundle || brief || runtime) {
    status = guidedQuestions.length ? "needs_input" : "active";
    readinessLevel = guidedQuestions.length ? "partial" : "ready";
  }

  return {
    contract: "design_dashboard_state_v1",
    version: "1.0",
    page: "design",
    title: "Design",
    summary: str(runtime?.summary || brief?.summary || "Conversation-driven design state will appear here as the designer works."),
    status,
    readiness: {
      ok: Boolean(brief || bundle || runtime),
      level: readinessLevel,
      reasons: validationIssues.map((issue) => issue.code)
    },
    warnings,
    validationIssues,
    refs: {
      briefId: str(brief?.artifactId || null),
      proposalId: str(bundle?.artifactId || null),
      lastApplyHistoryEntryId: str(lastApply?.historyEntryId || null)
    },
    data: {
      sourceLabel,
      runtime: {
        status: str(runtime?.status || "idle"),
        assistantMessage: str(runtime?.assistantMessage || "The designer’s current reasoning, assumptions, and active focus will be summarized here.")
      },
      counts: {
        proposalLines: arr(bundle?.proposalLines).length,
        openQuestions: guidedQuestions.length,
        briefSections: arr(brief?.sections).length,
        hypotheses: arr(brief?.hypotheses).length,
        designConcepts: conceptRows.length,
        effectPlacements: planPlacements.length
      },
      brief: {
        summary: str(brief?.summary || "No creative brief captured yet."),
        goalsSummary: str(brief?.goalsSummary || "The designer will capture the overall sequence goal, mood, and section priorities here as the conversation develops."),
        sectionsCount: arr(brief?.sections).length,
        hypothesesCount: arr(brief?.hypotheses).length
      },
      focus: {
        focal,
        broad
      },
      musicCues: {
        reveals,
        holds
      },
      assumptions,
      guidedQuestions,
      references: {
        count: references.length,
        names: references.slice(0, 3).map((ref) => str(ref?.name || ref?.id || "reference")).filter(Boolean)
      },
      palette: {
        count: swatches.length,
        swatches: swatches.slice(0, 5)
      },
      executionPlan: {
        passScope: str(executionPlan?.passScope || "unknown"),
        sectionCount: Number(executionPlan?.sectionCount || 0),
        targetCount: Number(executionPlan?.targetCount || 0),
        designConceptCount: conceptRows.length,
        effectPlacementCount: planPlacements.length,
        effectFamilyCount: planEffectFamilies.length,
        layerCount: planLayers.length,
        conceptRows
      },
      lastAppliedSnapshot: lastAppliedSnapshot
        ? {
            briefSummary: str(lastAppliedSnapshot.creativeBrief?.summary || lastApply?.summary || "No applied brief summary."),
            proposalLines: arr(lastAppliedSnapshot.proposalBundle?.proposalLines).slice(0, 4),
            audioTitle: str(lastAppliedSnapshot.analysisArtifact?.trackIdentity?.title || "Unknown audio"),
            layoutMode: str(lastAppliedSnapshot.designSceneContext?.layoutMode || "unknown")
          }
        : null
    }
  };
}
