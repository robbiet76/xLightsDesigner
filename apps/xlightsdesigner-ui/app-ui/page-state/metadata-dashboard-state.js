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

function humanizeRecommendationType(value = "") {
  const text = str(value).replace(/_/g, " ");
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : "";
}

function humanizeCompletenessLabel(value = "") {
  const text = str(value).replace(/^metadata_/, "").replace(/_/g, " ");
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : "";
}

function buildMetadataProgressSummary(targetsSummary = {}) {
  const ready = Number(targetsSummary?.metadataReadyModels || 0);
  const partial = Number(targetsSummary?.metadataPartialModels || 0);
  const needed = Number(targetsSummary?.metadataNeededModels || 0);
  const total = ready + partial + needed;
  if (!total) return "Layout metadata has not been analyzed yet.";
  return `${ready} ready, ${partial} partial, ${needed} still need attention.`;
}

function buildCommonPreferenceValues(preferencesByTargetId = {}, field = "") {
  const counts = new Map();
  for (const pref of Object.values(preferencesByTargetId || {})) {
    const values = Array.isArray(pref?.[field]) ? pref[field] : [];
    for (const value of values) {
      const raw = str(value);
      const key = raw.toLowerCase();
      if (!key) continue;
      const current = counts.get(key) || { value: raw, count: 0 };
      counts.set(key, { value: current.value, count: Number(current.count || 0) + 1 });
    }
  }
  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .map((row) => row.value);
}

function uniqueOrdered(values = []) {
  const out = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const raw = str(value);
    const key = raw.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(raw);
  }
  return out;
}

function buildSmartSuggestionOptions({
  field = "",
  active = {},
  projectValues = []
} = {}) {
  const baseByField = {
    semanticHints: [
      "character",
      "text",
      "image",
      "video",
      "outline",
      "radial",
      "linear",
      "beat-sync",
      "flood light",
      "spot light",
      "matrix-like",
      "tree-like",
      "face"
    ],
    effectAvoidances: [
      "dense texture",
      "fast motion",
      "sharp flashes",
      "large bursts",
      "full coverage",
      "rapid alternation",
      "strobing"
    ]
  };
  const selectedValues = Array.isArray(active?.[field]) ? active[field] : [];
  return uniqueOrdered([
    ...baseByField[field],
    ...selectedValues,
    ...projectValues
  ]).slice(0, 16);
}

function buildActiveTargetSummary(active = {}) {
  if (!active || typeof active !== "object") return "";
  const lines = [];
  const name = str(active.displayName);
  const type = str(active.canonicalType || active.type);
  const overall = humanizeCompletenessLabel(active.metadataCompleteness);
  if (name) lines.push(`Name: ${name}`);
  if (type) lines.push(`Type: ${type}`);
  if (overall) lines.push(`Metadata completeness: ${overall}`);

  const detail = active.metadataCompletenessDetail || {};
  const detailParts = [
    ["Structure", humanizeCompletenessLabel(detail.structure)],
    ["Semantic", humanizeCompletenessLabel(detail.semantic)],
    ["Role", humanizeCompletenessLabel(detail.role)],
    ["Submodel", humanizeCompletenessLabel(detail.submodel)],
    ["Sequencing", humanizeCompletenessLabel(detail.sequencing)]
  ].filter(([, value]) => value).map(([label, value]) => `${label} ${value.toLowerCase()}`);
  if (detailParts.length) lines.push(`Breakdown: ${detailParts.join(", ")}.`);

  const inferredRole = str(active.inferredRole);
  if (inferredRole) lines.push(`Inferred role: ${inferredRole}.`);

  const inferredTraits = escapeTagList(active.inferredSemanticTraits);
  if (inferredTraits.length) lines.push(`Inferred traits: ${inferredTraits.join(", ")}.`);

  const groups = escapeTagList(active.groupMemberships);
  if (groups.length) lines.push(`Groups: ${groups.join(", ")}.`);

  if (active.submodelMetadata && typeof active.submodelMetadata === "object") {
    const meta = active.submodelMetadata;
    const parts = [];
    if (meta.parentName || meta.parentId) parts.push(`parent ${str(meta.parentName || meta.parentId)}`);
    if (Number(meta.submodelCount || 0) > 0) parts.push(`${Number(meta.submodelCount)} submodels`);
    if (Number(meta.memberCount || 0) > 0) parts.push(`${Number(meta.memberCount)} group members`);
    if (Number(meta.nodeCount || 0) > 0) parts.push(`${Number(meta.nodeCount)} nodes`);
    if (parts.length) lines.push(`Structure: ${parts.join(", ")}.`);
  }

  const recommendations = Array.isArray(active.recommendations) ? active.recommendations : [];
  if (recommendations.length) {
    lines.push(`Recommended next metadata: ${recommendations.map((row) => str(row.message)).filter(Boolean).join(" ")}`);
  }

  const provenance = Array.isArray(active.provenanceFields) ? active.provenanceFields : [];
  if (provenance.length) {
    const topSources = Array.from(new Set(provenance.map((row) => str(row.source)).filter(Boolean))).slice(0, 4);
    if (topSources.length) lines.push(`Sources: ${topSources.join(", ")}.`);
  }
  const updatedAt = str(active.provenanceUpdatedAt);
  if (updatedAt) lines.push(`Updated: ${updatedAt}.`);

  return lines.join("\n");
}

function buildRecommendationWorklist(records = []) {
  return (Array.isArray(records) ? records : [])
    .flatMap((record) => {
      const displayName = str(record?.identity?.displayName || record?.targetId);
      const targetId = str(record?.targetId);
      const type = str(record?.identity?.canonicalType || record?.targetKind);
      return (Array.isArray(record?.recommendations) ? record.recommendations : []).map((recommendation, index) => ({
        key: `${targetId}:${index}`,
        targetId,
        displayName,
        targetType: type,
        type: str(recommendation?.type),
        typeLabel: humanizeRecommendationType(recommendation?.type),
        priority: str(recommendation?.priority || "normal"),
        message: str(recommendation?.message)
      })).filter((row) => row.targetId && row.message);
    })
    .sort((a, b) => {
      const priorityRank = (value) => (value === "high" ? 0 : value === "medium" ? 1 : 2);
      return priorityRank(a.priority) - priorityRank(b.priority)
        || a.displayName.localeCompare(b.displayName)
        || a.message.localeCompare(b.message);
    });
}

function buildRecommendationTypeSummary(worklist = []) {
  const counts = new Map();
  for (const row of Array.isArray(worklist) ? worklist : []) {
    const key = str(row?.type);
    if (!key) continue;
    counts.set(key, Number(counts.get(key) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([type, count]) => ({
      type,
      typeLabel: humanizeRecommendationType(type),
      count
    }))
    .sort((a, b) => b.count - a.count || a.typeLabel.localeCompare(b.typeLabel));
}

function completenessRank(value = "") {
  const key = str(value);
  if (key === "metadata_needed") return 0;
  if (key === "metadata_partial") return 1;
  if (key === "metadata_ready") return 2;
  return 3;
}

function buildGuidedTargetOrder({ modelOptions = [], normalizedRecords = [], recommendationWorklist = [] } = {}) {
  const normalizedByTargetId = new Map(
    (Array.isArray(normalizedRecords) ? normalizedRecords : []).map((row) => [str(row?.targetId), row])
  );
  const unique = [];
  const seen = new Set();
  for (const row of Array.isArray(recommendationWorklist) ? recommendationWorklist : []) {
    const id = str(row?.targetId);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    unique.push(id);
  }
  const remaining = (Array.isArray(modelOptions) ? modelOptions : [])
    .map((row) => ({
      id: str(row?.id),
      name: str(row?.name || row?.raw?.displayName || row?.id),
      completeness: str(normalizedByTargetId.get(str(row?.id))?.semantics?.metadataCompleteness?.overall)
    }))
    .filter((row) => row.id && !seen.has(row.id))
    .sort((a, b) => completenessRank(a.completeness) - completenessRank(b.completeness) || a.name.localeCompare(b.name))
    .map((row) => row.id);
  return [...unique, ...remaining];
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
  const preferencesByTargetId = state.metadata?.preferencesByTargetId && typeof state.metadata.preferencesByTargetId === "object"
    ? state.metadata.preferencesByTargetId
    : {};
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
  const recommendationSummary = summarizeRecommendations(normalizedRecords);
  const recommendationWorklist = buildRecommendationWorklist(normalizedRecords);
  const primaryRecommendation = recommendationWorklist[0] || null;
  const guidedTargetOrder = buildGuidedTargetOrder({ modelOptions, normalizedRecords, recommendationWorklist });
  const activeTargetId = str(state.ui?.metadataTargetId || guidedTargetOrder[0] || filteredModels[0]?.id || "");
  const activeTarget = activeTargetId ? modelOptions.find((target) => str(target.id) === activeTargetId) : null;
  const activeNormalized = activeTargetId ? normalizedByTargetId.get(activeTargetId) : null;
  const hasVisibleTargets = filteredModels.length > 0;
  const hasSelectedTargets = selectedCount > 0;
  const submodelBanner = state.health?.submodelDiscoveryError
    ? `Submodels unavailable: ${state.health.submodelDiscoveryError}`
    : "No submodels found in current show data.";
  const activeTargetData = activeNormalized
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
        semanticHints: escapeTagList([
          ...escapeTagList(activeNormalized?.user?.semanticHints),
          ...escapeTagList(activeNormalized?.user?.submodelHints)
        ]),
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
    : null;
  if (activeTargetData) {
    activeTargetData.smartOptions = {
      semanticHints: buildSmartSuggestionOptions({
        field: "semanticHints",
        active: activeTargetData,
        projectValues: buildCommonPreferenceValues(preferencesByTargetId, "semanticHints")
      }),
      effectAvoidances: buildSmartSuggestionOptions({
        field: "effectAvoidances",
        active: activeTargetData,
        projectValues: buildCommonPreferenceValues(preferencesByTargetId, "effectAvoidances")
      })
    };
    activeTargetData.summaryText = buildActiveTargetSummary(activeTargetData);
  }
  const activeGuidedIndex = guidedTargetOrder.indexOf(activeTargetId);
  const previousGuidedTargetId = activeGuidedIndex > 0 ? guidedTargetOrder[activeGuidedIndex - 1] : "";
  const nextGuidedTargetId = activeGuidedIndex >= 0 && activeGuidedIndex < guidedTargetOrder.length - 1 ? guidedTargetOrder[activeGuidedIndex + 1] : "";
  const callToAction = recommendationSummary.total
    ? {
        title: recommendationSummary.highPriority
          ? `${recommendationSummary.highPriority} high-impact metadata updates recommended`
          : `${recommendationSummary.total} metadata updates recommended`,
        body: "You do not need to fill out metadata for every target. Start with the recommended items below to improve target selection, submodel use, and sequencing quality.",
        actionLabel: primaryRecommendation ? `Review ${primaryRecommendation.displayName}` : "Review recommendations",
        actionTargetId: primaryRecommendation?.targetId || ""
      }
    : {
        title: "No metadata action is required right now",
        body: "The app is managing the current metadata state. Revisit this page when the sequencer highlights new recommendations or you want to refine a specific target.",
        actionLabel: activeTargetData ? `Review ${activeTargetData.displayName}` : "",
        actionTargetId: activeTargetData?.id || ""
      };

  return {
    contract: "metadata_dashboard_state_v1",
    version: "1.0",
    page: "metadata",
    title: "Layout",
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
      metadataView: str(state.ui?.metadataView || "guided") === "grid" ? "grid" : "guided",
      callToAction,
      primaryRecommendation,
      recommendationTypeSummary: buildRecommendationTypeSummary(recommendationWorklist).slice(0, 3),
      guidedTargetOrder,
      guidedIndex: activeGuidedIndex >= 0 ? activeGuidedIndex + 1 : 0,
      guidedTotal: guidedTargetOrder.length,
      previousGuidedTargetId,
      nextGuidedTargetId,
      targetsSummary: {
        total: modelOptions.length,
        submodelCount,
        metadataReadyModels: normalizedRecords.filter((row) => row.targetKind === "model" && row.semantics?.metadataCompleteness?.overall === "metadata_ready").length,
        metadataPartialModels: normalizedRecords.filter((row) => row.targetKind === "model" && row.semantics?.metadataCompleteness?.overall === "metadata_partial").length,
        metadataNeededModels: normalizedRecords.filter((row) => row.targetKind === "model" && row.semantics?.metadataCompleteness?.overall === "metadata_needed").length,
        recommendationSummary
      },
      progressSummary: buildMetadataProgressSummary({
        metadataReadyModels: normalizedRecords.filter((row) => row.targetKind === "model" && row.semantics?.metadataCompleteness?.overall === "metadata_ready").length,
        metadataPartialModels: normalizedRecords.filter((row) => row.targetKind === "model" && row.semantics?.metadataCompleteness?.overall === "metadata_partial").length,
        metadataNeededModels: normalizedRecords.filter((row) => row.targetKind === "model" && row.semantics?.metadataCompleteness?.overall === "metadata_needed").length
      }),
      activeTarget: activeTargetData,
      rows: filteredModels.slice(0, 200).map((m) => {
        const normalized = normalizedByTargetId.get(String(m.id));
        const visualHints = escapeTagList([
          ...escapeTagList(normalized?.user?.semanticHints),
          ...escapeTagList(normalized?.user?.submodelHints)
        ]);
        const effectAvoidances = escapeTagList(normalized?.user?.effectAvoidances);
        return {
          id: str(m.id),
          displayName: str(m.raw?.displayName || "(unnamed)"),
          type: str(m.raw?.type),
          selected: selectedIds.has(str(m.id)),
          focused: activeTargetId === str(m.id),
          canonicalType: str(normalized?.identity?.canonicalType),
          rolePreference: str(normalized?.user?.rolePreference),
          visualHints,
          effectAvoidances
        };
      })
    }
  };
}
