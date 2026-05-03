function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function sceneGraphValues(value = {}) {
  return value && typeof value === "object" && !Array.isArray(value) ? Object.values(value) : [];
}

function isCustomModel(model = {}) {
  return str(model?.displayAs || model?.type || model?.displayType).toLowerCase() === "custom";
}

function summarizeCustomModels(sceneGraph = {}) {
  const customModels = sceneGraphValues(sceneGraph?.modelsById).filter(isCustomModel);
  const submodels = sceneGraphValues(sceneGraph?.submodelsById);
  return {
    customModelCount: customModels.length,
    customModelsWithSubmodels: customModels.filter((model) => {
      const id = str(model?.id || model?.name);
      return id && submodels.some((submodel) => str(submodel?.parentId) === id);
    }).length
  };
}

function summarizeTargetBehaviorLearning(sequenceAgentRuntime = {}) {
  const learning = sequenceAgentRuntime?.targetBehaviorLearning && typeof sequenceAgentRuntime.targetBehaviorLearning === "object"
    ? sequenceAgentRuntime.targetBehaviorLearning
    : {};
  const records = arr(learning.records);
  const stats = records.reduce((totals, row) => {
    const rowStats = row?.stats && typeof row.stats === "object" ? row.stats : {};
    totals.sampleCount += Number(rowStats.sampleCount || 0);
    totals.positiveCount += Number(rowStats.positiveCount || 0);
    totals.negativeCount += Number(rowStats.negativeCount || 0);
    return totals;
  }, {
    sampleCount: Number(learning.sampleCount || 0),
    positiveCount: Number(learning.positiveCount || 0),
    negativeCount: Number(learning.negativeCount || 0)
  });
  return {
    targetBehaviorLearningCount: records.length || Number(learning.recordCount || 0),
    targetBehaviorLearningSubmodelCount: records.length
      ? records.filter((row) => str(row?.targetKind) === "submodel").length
      : Number(learning.submodelRecordCount || 0),
    targetBehaviorLearningCustomParentCount: records.length
      ? records.filter((row) => str(row?.parentContext?.customStructure?.profile)).length
      : Number(learning.customParentRecordCount || 0),
    targetBehaviorLearningArtifactPath: str(learning.artifactPath),
    targetBehaviorLearningStats: stats,
    targetBehaviorLearningSampleRecords: records.slice(0, 8).map((row) => ({
      recordId: str(row?.recordId),
      targetId: str(row?.targetId),
      targetKind: str(row?.targetKind),
      targetFingerprint: str(row?.targetFingerprint),
      parentId: str(row?.parentId || row?.parentContext?.targetId),
      effectName: str(row?.effectName || row?.effectFamily),
      probeScope: str(row?.probeScope),
      sampleCount: Number(row?.stats?.sampleCount || 0),
      positiveCount: Number(row?.stats?.positiveCount || 0),
      negativeCount: Number(row?.stats?.negativeCount || 0),
      nodeCoverageRatio: Number.isFinite(Number(row?.submodelContext?.nodeCoverage?.ratio))
        ? Number(row.submodelContext.nodeCoverage.ratio)
        : null,
      lastObservedAt: str(row?.stats?.lastObservedAt || row?.updatedAt || row?.observedAt)
    }))
  };
}

function summarizePlanTargetContext(agentPlan = {}) {
  const targetContext = agentPlan?.handoff?.metadata?.generativeSummary?.targetContext;
  if (!targetContext || typeof targetContext !== "object" || Array.isArray(targetContext)) return {};
  return {
    targetBehaviorAvailable: Boolean(targetContext.targetBehaviorAvailable),
    targetBehaviorMatchedRecordIds: arr(targetContext.targetBehaviorMatchedRecordIds).map((row) => str(row)).filter(Boolean).slice(0, 12),
    targetBehaviorEvidenceCandidateIds: arr(targetContext.targetBehaviorEvidenceCandidateIds).map((row) => str(row)).filter(Boolean).slice(0, 8),
    targetBehaviorStats: targetContext.targetBehaviorStats && typeof targetContext.targetBehaviorStats === "object"
      ? {
          sampleCount: Number(targetContext.targetBehaviorStats.sampleCount || 0),
          positiveCount: Number(targetContext.targetBehaviorStats.positiveCount || 0),
          negativeCount: Number(targetContext.targetBehaviorStats.negativeCount || 0)
        }
      : null,
    targetFingerprints: arr(targetContext.targetFingerprints).map((row) => str(row)).filter(Boolean).slice(0, 12)
  };
}

function formatTime(value = "", withSeconds = false) {
  const raw = str(value);
  if (!raw) return withSeconds ? "--:--:--" : "Never";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleTimeString([], withSeconds
    ? { hour: "2-digit", minute: "2-digit", second: "2-digit" }
    : { hour: "2-digit", minute: "2-digit" });
}

export function buildDiagnosticsDashboardState({
  state = {},
  helpers = {}
} = {}) {
  const {
    getDiagnosticsCounts = () => ({ total: 0, warning: 0, actionRequired: 0 }),
    buildLabel = ""
  } = helpers;
  const counts = getDiagnosticsCounts();
  const filter = str(state.ui?.diagnosticsFilter || "all");
  const rows = arr(state.diagnostics);
  const filteredRows = filter === "all" ? rows : rows.filter((d) => d.level === filter);
  const customModelSummary = summarizeCustomModels(state.sceneGraph || {});
  const targetBehaviorSummary = summarizeTargetBehaviorLearning(state.sequenceAgentRuntime || {});
  const planTargetContext = summarizePlanTargetContext(state.agentPlan || {});
  const applyHistory = arr(state.applyHistory).slice(0, 12);
  return {
    contract: "diagnostics_dashboard_state_v1",
    version: "1.0",
    page: "diagnostics",
    title: "Diagnostics",
    summary: "Operator surface for runtime health, warnings, exports, and recent apply history.",
    status: state.ui?.diagnosticsOpen ? "open" : "closed",
    readiness: {
      ok: true,
      level: "ready",
      reasons: []
    },
    warnings: [],
    validationIssues: [],
    refs: {},
    data: {
      counts,
      filter,
      filteredRows: filteredRows.map((row) => ({
        level: str(row?.level || "info"),
        text: str(row?.text),
        details: str(row?.details),
        timeLabel: formatTime(row?.ts, true)
      })),
      recentApplies: applyHistory.map((entry) => ({
        status: str(entry?.status || "unknown"),
        commandCount: Number(entry?.commandCount || 0),
        timeLabel: formatTime(entry?.createdAt, true),
        applyStage: str(entry?.applyStage),
        summary: str(entry?.summary)
      })),
      health: {
        lastCheckedAt: formatTime(state.health?.lastCheckedAt),
        runtimeReady: Boolean(state.health?.runtimeReady),
        appFileDialogReady: Boolean(state.health?.appFileDialogReady),
        appBridgeApiCount: Number(state.health?.appBridgeApiCount || 0),
        xlightsVersion: str(state.health?.xlightsVersion || "not reported"),
        compatibilityStatus: str(state.health?.compatibilityStatus),
        agentProvider: str(state.health?.agentProvider || "openai"),
        agentModel: str(state.health?.agentModel || "(default env model)"),
        agentConfigured: Boolean(state.health?.agentConfigured),
        agentLayerReady: Boolean(state.health?.agentLayerReady),
        agentActiveRole: str(state.health?.agentActiveRole || "idle"),
        agentRegistryVersion: str(state.health?.agentRegistryVersion || "unknown"),
        agentRegistryValid: Boolean(state.health?.agentRegistryValid),
        agentRegistryErrors: arr(state.health?.agentRegistryErrors).map((row) => str(row)).filter(Boolean),
        agentHandoffsReady: str(state.health?.agentHandoffsReady || "0/3"),
        orchestrationLastRunId: str(state.health?.orchestrationLastRunId || "none"),
        orchestrationLastStatus: str(state.health?.orchestrationLastStatus || "none"),
        orchestrationLastSummary: str(state.health?.orchestrationLastSummary || "none"),
        capabilitiesCount: Number(state.health?.capabilitiesCount || 0),
        effectCatalogReady: Boolean(state.health?.effectCatalogReady),
        effectDefinitionCount: Number(state.health?.effectDefinitionCount || 0),
        sceneGraphReady: Boolean(state.health?.sceneGraphReady),
        sceneGraphSource: str(state.health?.sceneGraphSource || "unknown"),
        sceneGraphLayoutMode: str(state.health?.sceneGraphLayoutMode || "2d").toUpperCase(),
        sceneGraphSpatialNodeCount: Number(state.health?.sceneGraphSpatialNodeCount || 0),
        customModelCount: customModelSummary.customModelCount,
        customModelsWithSubmodels: customModelSummary.customModelsWithSubmodels,
        targetBehaviorLearningCount: targetBehaviorSummary.targetBehaviorLearningCount,
        targetBehaviorLearningSubmodelCount: targetBehaviorSummary.targetBehaviorLearningSubmodelCount,
        targetBehaviorLearningCustomParentCount: targetBehaviorSummary.targetBehaviorLearningCustomParentCount,
        targetBehaviorLearningArtifactPath: targetBehaviorSummary.targetBehaviorLearningArtifactPath,
        targetBehaviorLearningStats: targetBehaviorSummary.targetBehaviorLearningStats,
        sceneGraphWarnings: arr(state.health?.sceneGraphWarnings).map((row) => str(row)).filter(Boolean),
        effectCatalogError: str(state.health?.effectCatalogError),
        hasSequencingApplyBatchPlan: Boolean(state.health?.hasSequencingApplyBatchPlan),
        hasJobsGet: Boolean(state.health?.hasJobsGet),
        sequenceOpen: Boolean(state.health?.sequenceOpen),
        buildLabel: str(buildLabel)
      },
      targetBehaviorEvidence: {
        artifactPath: targetBehaviorSummary.targetBehaviorLearningArtifactPath,
        records: targetBehaviorSummary.targetBehaviorLearningSampleRecords,
        stats: targetBehaviorSummary.targetBehaviorLearningStats,
        planContext: planTargetContext
      }
    }
  };
}
