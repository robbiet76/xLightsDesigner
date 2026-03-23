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
  const metadataFilter = String(state.ui?.metadataFilterMetadata || "");
  const metadataFilterDimension = String(state.ui?.metadataFilterDimension || "overall");
  const filteredModels = modelOptions.filter((m) => {
    const rowName = str(m?.raw?.displayName).toLowerCase();
    const rowType = str(m?.raw?.type).toLowerCase();
    const assignment = assignmentByTargetId.get(String(m.id));
    const normalized = normalizedByTargetId.get(String(m.id));
    const rowTags = escapeTagList(assignment?.tags).join(", ").toLowerCase();
    const rowSupport = str(normalized?.semantics?.supportState).toLowerCase();
    const rowMetadataCompleteness = str(
      metadataFilterDimension === "overall"
        ? normalized?.semantics?.metadataCompleteness?.overall
        : normalized?.semantics?.metadataCompleteness?.[metadataFilterDimension]
    ).toLowerCase();
    if (!matchesMetadataFilterValue(rowName, nameFilter)) return false;
    if (!matchesMetadataFilterValue(rowType, typeFilter)) return false;
    if (!matchesMetadataFilterValue(rowTags, tagsFilter)) return false;
    if (!matchesMetadataFilterValue(rowSupport, supportFilter)) return false;
    if (!matchesMetadataFilterValue(rowMetadataCompleteness, metadataFilter)) return false;
    return true;
  });
  const submodelCount = modelOptions.filter((target) => target.raw.type === "submodel").length;
  const selectedIds = new Set(normalizeMetadataSelectionIds(state.ui?.metadataSelectionIds));
  const selectedCount = selectedIds.size;
  const selectedEditorTags = normalizeMetadataSelectedTags(state.ui?.metadataSelectedTags);
  const draftTagName = str(state.ui?.metadataNewTag);
  const activeTargetId = str(state.ui?.metadataTargetId || filteredModels[0]?.id || "");
  const activeTarget = activeTargetId ? modelOptions.find((target) => str(target.id) === activeTargetId) : null;
  const activeAssignment = activeTargetId ? assignmentByTargetId.get(activeTargetId) : null;
  const activeNormalized = activeTargetId ? normalizedByTargetId.get(activeTargetId) : null;
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
        category: str(tag.category || ""),
        source: str(tag.source || ""),
        controlled: tag.controlled === true,
        selected: selectedEditorTags.includes(str(tag.name))
      })),
      selectedTagNames: selectedEditorTags,
      selectedCount,
      hasVisibleTargets,
      hasSelectedTargets,
      hasSelectedTags,
      activeTargetId,
      metadataFilterDimension,
      targetsSummary: {
        total: modelOptions.length,
        submodelCount,
        trainedSupportedModels: normalizedRecords.filter((row) => row.targetKind === "model" && row.training?.trainedSupportState === "trained_supported").length,
        runtimeOnlyModels: normalizedRecords.filter((row) => row.targetKind === "model" && row.training?.trainedSupportState !== "trained_supported").length,
        metadataReadyModels: normalizedRecords.filter((row) => row.targetKind === "model" && row.semantics?.metadataCompleteness?.overall === "metadata_ready").length,
        metadataPartialModels: normalizedRecords.filter((row) => row.targetKind === "model" && row.semantics?.metadataCompleteness?.overall === "metadata_partial").length,
        metadataNeededModels: normalizedRecords.filter((row) => row.targetKind === "model" && row.semantics?.metadataCompleteness?.overall === "metadata_needed").length,
        controlledTagCount: tags.filter((row) => row.controlled === true).length,
        customTagCount: tags.filter((row) => row.controlled !== true).length
      },
      activeTarget: activeNormalized
        ? {
            id: activeTargetId,
            displayName: str(activeTarget?.raw?.displayName || activeNormalized?.identity?.displayName || activeTargetId),
            type: str(activeTarget?.raw?.type || activeNormalized?.targetKind),
            canonicalType: str(activeNormalized?.identity?.canonicalType),
            supportState: str(activeNormalized?.semantics?.supportState),
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
            trainedSupportState: str(activeNormalized?.training?.trainedSupportState),
            trainedBuckets: escapeTagList(activeNormalized?.training?.trainedModelBuckets),
            inferredRole: str(activeNormalized?.semantics?.inferredRole),
            inferredSemanticTraits: escapeTagList(activeNormalized?.semantics?.inferredSemanticTraits),
            userTags: escapeTagList(activeAssignment?.tags || activeNormalized?.user?.tags),
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
          tags: escapeTagList(assignment?.tags),
          selected: selectedIds.has(str(m.id)),
          focused: activeTargetId === str(m.id),
          supportState: str(normalized?.semantics?.supportState),
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
