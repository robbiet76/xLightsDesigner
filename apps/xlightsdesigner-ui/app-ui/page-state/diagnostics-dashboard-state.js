function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
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
        desktopFileDialogReady: Boolean(state.health?.desktopFileDialogReady),
        desktopBridgeApiCount: Number(state.health?.desktopBridgeApiCount || 0),
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
        sceneGraphWarnings: arr(state.health?.sceneGraphWarnings).map((row) => str(row)).filter(Boolean),
        effectCatalogError: str(state.health?.effectCatalogError),
        hasSequencingApplyBatchPlan: Boolean(state.health?.hasSequencingApplyBatchPlan),
        hasJobsGet: Boolean(state.health?.hasJobsGet),
        sequenceOpen: Boolean(state.health?.sequenceOpen),
        buildLabel: str(buildLabel)
      }
    }
  };
}
