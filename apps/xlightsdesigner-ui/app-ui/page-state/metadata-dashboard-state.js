function str(value = "") {
  return String(value || "").trim();
}

function escapeTagList(tags = []) {
  return Array.isArray(tags) ? tags.map((tag) => str(tag)).filter(Boolean) : [];
}

function mapProvenanceFields(fields = {}) {
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) return [];
  return Object.entries(fields).map(([field, meta]) => ({
    field: str(field),
    source: str(meta?.source || ""),
    detail: str(meta?.detail || "")
  })).filter((row) => row.field);
}

function summarizeRecommendations(records = []) {
  const summary = {
    total: 0,
    byType: {},
    highPriority: 0
  };
  for (const record of Array.isArray(records) ? records : []) {
    for (const recommendation of Array.isArray(record?.recommendations) ? record.recommendations : []) {
      const type = str(recommendation?.type || "unknown");
      const priority = str(recommendation?.priority || "");
      if (!type) continue;
      summary.total += 1;
      summary.byType[type] = Number(summary.byType[type] || 0) + 1;
      if (priority === "high") summary.highPriority += 1;
    }
  }
  return {
    total: summary.total,
    highPriority: summary.highPriority,
    items: Object.entries(summary.byType)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type))
  };
}

export function buildMetadataDashboardState({
  state = {},
  helpers = {}
} = {}) {
  const {
    buildMetadataTargets = () => [],
    buildNormalizedTargetMetadataRecords = () => [],
    matchesMetadataFilterValue = () => true,
    normalizeMetadataSelectionIds = () => []
  } = helpers;

  const hasLoadedSubmodels = (state.submodels || []).length > 0;
  const metadataTargets = buildMetadataTargets({ includeSubmodels: hasLoadedSubmodels });
  const modelOptions = metadataTargets
    .map((target) => ({ id: target.id, name: target.displayName, raw: target }))
    .filter((target) => target.id);
  const assignments = state.metadata?.assignments || [];
  const assignmentByTargetId = new Map(assignments.map((a) => [String(a.targetId), a]));
  const normalizedRecords = buildNormalizedTargetMetadataRecords();
  const normalizedByTargetId = new Map(normalizedRecords.map((row) => [String(row.targetId), row]));
  const nameFilter = String(state.ui?.metadataFilterName || "");
  const typeFilter = String(state.ui?.metadataFilterType || "");
  const metadataFilter = String(state.ui?.metadataFilterMetadata || "");
  const metadataFilterDimension = String(state.ui?.metadataFilterDimension || "overall");
  const filteredModels = modelOptions.filter((m) => {
    const rowName = str(m?.raw?.displayName).toLowerCase();
    const rowType = str(m?.raw?.type).toLowerCase();
    const normalized = normalizedByTargetId.get(String(m.id));
    const rowMetadataCompleteness = str(
      metadataFilterDimension === "overall"
        ? normalized?.semantics?.metadataCompleteness?.overall
        : normalized?.semantics?.metadataCompleteness?.[metadataFilterDimension]
    ).toLowerCase();
    if (!matchesMetadataFilterValue(rowName, nameFilter)) return false;
    if (!matchesMetadataFilterValue(rowType, typeFilter)) return false;
    if (!matchesMetadataFilterValue(rowMetadataCompleteness, metadataFilter)) return false;
    return true;
  });
  const submodelCount = modelOptions.filter((target) => target.raw.type === "submodel").length;
  const selectedIds = new Set(normalizeMetadataSelectionIds(state.ui?.metadataSelectionIds));
  const selectedCount = selectedIds.size;
  const activeTargetId = str(state.ui?.metadataTargetId || filteredModels[0]?.id || "");
  const activeTarget = activeTargetId ? modelOptions.find((target) => str(target.id) === activeTargetId) : null;
  const activeNormalized = activeTargetId ? normalizedByTargetId.get(activeTargetId) : null;
  const hasVisibleTargets = filteredModels.length > 0;
  const hasSelectedTargets = selectedCount > 0;
  const submodelBanner = state.health?.submodelDiscoveryError
    ? `Submodels unavailable: ${state.health.submodelDiscoveryError}`
    : "No submodels found in current show data.";

  return {
    contract: "metadata_dashboard_state_v1",
    version: "1.0",
    page: "metadata",
    title: "Metadata",
    summary: `Targets: ${modelOptions.length} total (${submodelCount} submodels)`,
    status: "active",
    readiness: {
      ok: true,
      level: "ready",
      reasons: []
    },
    warnings: [],
    validationIssues: [],
    refs: {},
    data: {
      submodelsAvailable: hasLoadedSubmodels,
      submodelBanner,
      selectedCount,
      hasVisibleTargets,
      hasSelectedTargets,
      activeTargetId,
      metadataFilterDimension,
      targetsSummary: {
        total: modelOptions.length,
        submodelCount,
        metadataReadyModels: normalizedRecords.filter((row) => row.targetKind === "model" && row.semantics?.metadataCompleteness?.overall === "metadata_ready").length,
        metadataPartialModels: normalizedRecords.filter((row) => row.targetKind === "model" && row.semantics?.metadataCompleteness?.overall === "metadata_partial").length,
        metadataNeededModels: normalizedRecords.filter((row) => row.targetKind === "model" && row.semantics?.metadataCompleteness?.overall === "metadata_needed").length,
        recommendationSummary: summarizeRecommendations(normalizedRecords)
      },
      activeTarget: activeNormalized
        ? {
            id: activeTargetId,
            displayName: str(activeTarget?.raw?.displayName || activeNormalized?.identity?.displayName || activeTargetId),
            type: str(activeTarget?.raw?.type || activeNormalized?.targetKind),
            canonicalType: str(activeNormalized?.identity?.canonicalType),
            metadataCompleteness: str(activeNormalized?.semantics?.metadataCompleteness?.overall),
            metadataCompletenessDetail: activeNormalized?.semantics?.metadataCompleteness && typeof activeNormalized.semantics.metadataCompleteness === "object"
              ? {
                  structure: str(activeNormalized.semantics.metadataCompleteness.structure),
                  semantic: str(activeNormalized.semantics.metadataCompleteness.semantic),
                  role: str(activeNormalized.semantics.metadataCompleteness.role),
                  submodel: str(activeNormalized.semantics.metadataCompleteness.submodel),
                  sequencing: str(activeNormalized.semantics.metadataCompleteness.sequencing)
                }
              : null,
            inferredRole: str(activeNormalized?.semantics?.inferredRole),
            inferredSemanticTraits: escapeTagList(activeNormalized?.semantics?.inferredSemanticTraits),
            rolePreference: str(activeNormalized?.user?.rolePreference),
            semanticHints: escapeTagList(activeNormalized?.user?.semanticHints),
            submodelHints: escapeTagList(activeNormalized?.user?.submodelHints),
            effectAvoidances: escapeTagList(activeNormalized?.user?.effectAvoidances),
            confidence: Number(activeNormalized?.provenance?.confidence || 0),
            groupMemberships: escapeTagList(activeNormalized?.structure?.groupMemberships),
            submodelCount: Number(activeNormalized?.structure?.submodelCount || 0),
            memberCount: Number(activeNormalized?.structure?.memberCount || 0),
            submodelMetadata: activeNormalized?.structure?.submodelMetadata && typeof activeNormalized.structure.submodelMetadata === "object"
              ? {
                  hasSubmodels: activeNormalized.structure.submodelMetadata.hasSubmodels === true,
                  submodelCount: Number(activeNormalized.structure.submodelMetadata.submodelCount || 0),
                  memberCount: Number(activeNormalized.structure.submodelMetadata.memberCount || 0),
                  modelMemberCount: Number(activeNormalized.structure.submodelMetadata.modelMemberCount || 0),
                  submodelMemberCount: Number(activeNormalized.structure.submodelMetadata.submodelMemberCount || 0),
                  hasSubmodelMembers: activeNormalized.structure.submodelMetadata.hasSubmodelMembers === true,
                  parentId: str(activeNormalized.structure.submodelMetadata.parentId),
                  parentName: str(activeNormalized.structure.submodelMetadata.parentName),
                  nodeCount: Number(activeNormalized.structure.submodelMetadata.nodeCount || 0)
                }
              : null,
            recommendations: Array.isArray(activeNormalized?.recommendations)
              ? activeNormalized.recommendations.map((row) => ({
                  type: str(row?.type),
                  priority: str(row?.priority),
                  message: str(row?.message)
                })).filter((row) => row.message)
              : [],
            provenanceUpdatedAt: str(activeNormalized?.provenance?.updatedAt),
            provenanceFields: mapProvenanceFields(activeNormalized?.provenance?.fields)
          }
        : null,
      rows: filteredModels.slice(0, 200).map((m) => {
        const assignment = assignmentByTargetId.get(String(m.id));
        const normalized = normalizedByTargetId.get(String(m.id));
        return {
          id: str(m.id),
          displayName: str(m.raw?.displayName || "(unnamed)"),
          type: str(m.raw?.type),
          selected: selectedIds.has(str(m.id)),
          focused: activeTargetId === str(m.id),
          metadataCompleteness: str(normalized?.semantics?.metadataCompleteness?.overall),
          canonicalType: str(normalized?.identity?.canonicalType),
          inferredRole: str(normalized?.semantics?.inferredRole),
          inferredSemanticTraits: escapeTagList(normalized?.semantics?.inferredSemanticTraits),
          confidence: Number(normalized?.provenance?.confidence || 0),
          rolePreference: str(normalized?.user?.rolePreference)
        };
      })
    }
  };
}
