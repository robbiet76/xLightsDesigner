function str(value = "") {
  return String(value || "").trim();
}

function escapeTagList(tags = []) {
  return Array.isArray(tags) ? tags.map((tag) => str(tag)).filter(Boolean) : [];
}

export function buildMetadataDashboardState({
  state = {},
  helpers = {}
} = {}) {
  const {
    getMetadataTagRecords = () => [],
    buildMetadataTargets = () => [],
    buildNormalizedTargetMetadataRecords = () => [],
    matchesMetadataFilterValue = () => true,
    normalizeMetadataSelectionIds = () => [],
    normalizeMetadataSelectedTags = () => []
  } = helpers;

  const hasLoadedSubmodels = (state.submodels || []).length > 0;
  const metadataTargets = buildMetadataTargets({ includeSubmodels: hasLoadedSubmodels });
  const modelOptions = metadataTargets
    .map((target) => ({ id: target.id, name: target.displayName, raw: target }))
    .filter((target) => target.id);
  const assignments = state.metadata?.assignments || [];
  const tags = getMetadataTagRecords();
  const assignmentByTargetId = new Map(assignments.map((a) => [String(a.targetId), a]));
  const normalizedRecords = buildNormalizedTargetMetadataRecords();
  const normalizedByTargetId = new Map(normalizedRecords.map((row) => [String(row.targetId), row]));
  const nameFilter = String(state.ui?.metadataFilterName || "");
  const typeFilter = String(state.ui?.metadataFilterType || "");
  const tagsFilter = String(state.ui?.metadataFilterTags || "");
  const supportFilter = String(state.ui?.metadataFilterSupport || "");
  const filteredModels = modelOptions.filter((m) => {
    const rowName = str(m?.raw?.displayName).toLowerCase();
    const rowType = str(m?.raw?.type).toLowerCase();
    const assignment = assignmentByTargetId.get(String(m.id));
    const normalized = normalizedByTargetId.get(String(m.id));
    const rowTags = escapeTagList(assignment?.tags).join(", ").toLowerCase();
    const rowSupport = str(normalized?.semantics?.supportState).toLowerCase();
    if (!matchesMetadataFilterValue(rowName, nameFilter)) return false;
    if (!matchesMetadataFilterValue(rowType, typeFilter)) return false;
    if (!matchesMetadataFilterValue(rowTags, tagsFilter)) return false;
    if (!matchesMetadataFilterValue(rowSupport, supportFilter)) return false;
    return true;
  });
  const submodelCount = modelOptions.filter((target) => target.raw.type === "submodel").length;
  const selectedIds = new Set(normalizeMetadataSelectionIds(state.ui?.metadataSelectionIds));
  const selectedCount = selectedIds.size;
  const selectedEditorTags = normalizeMetadataSelectedTags(state.ui?.metadataSelectedTags);
  const draftTagName = str(state.ui?.metadataNewTag);
  const hasVisibleTargets = filteredModels.length > 0;
  const hasSelectedTargets = selectedCount > 0;
  const hasSelectedTags = selectedEditorTags.length > 0;
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
      draftTagName,
      tags: tags.map((tag) => ({
        name: str(tag.name),
        description: str(tag.description),
        selected: selectedEditorTags.includes(str(tag.name))
      })),
      selectedTagNames: selectedEditorTags,
      selectedCount,
      hasVisibleTargets,
      hasSelectedTargets,
      hasSelectedTags,
      targetsSummary: {
        total: modelOptions.length,
        submodelCount,
        trainedSupportedModels: normalizedRecords.filter((row) => row.targetKind === "model" && row.training?.trainedSupportState === "trained_supported").length,
        runtimeOnlyModels: normalizedRecords.filter((row) => row.targetKind === "model" && row.training?.trainedSupportState !== "trained_supported").length
      },
      rows: filteredModels.slice(0, 200).map((m) => {
        const assignment = assignmentByTargetId.get(String(m.id));
        const normalized = normalizedByTargetId.get(String(m.id));
        return {
          id: str(m.id),
          displayName: str(m.raw?.displayName || "(unnamed)"),
          type: str(m.raw?.type),
          tags: escapeTagList(assignment?.tags),
          selected: selectedIds.has(str(m.id)),
          supportState: str(normalized?.semantics?.supportState),
          canonicalType: str(normalized?.identity?.canonicalType),
          inferredRole: str(normalized?.semantics?.inferredRole),
          inferredSemanticTraits: escapeTagList(normalized?.semantics?.inferredSemanticTraits),
          confidence: Number(normalized?.provenance?.confidence || 0)
        };
      })
    }
  };
}
