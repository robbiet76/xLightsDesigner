function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function uniqueStrings(values = []) {
  return [...new Set(arr(values).map((row) => str(row)).filter(Boolean))];
}

export function buildPriorPassMemory({ historySnapshot = null } = {}) {
  const snapshot = isPlainObject(historySnapshot) ? historySnapshot : null;
  const renderCritiqueContext = isPlainObject(snapshot?.renderCritiqueContext) ? snapshot.renderCritiqueContext : null;
  const sequenceRevisionObjective = isPlainObject(snapshot?.sequenceRevisionObjective) ? snapshot.sequenceRevisionObjective : null;
  const priorPlanMetadata = isPlainObject(snapshot?.planHandoff?.metadata) ? snapshot.planHandoff.metadata : null;
  if (!renderCritiqueContext && !sequenceRevisionObjective) return null;

  const revisionDelta = isPlainObject(priorPlanMetadata?.revisionDelta) ? priorPlanMetadata.revisionDelta : null;
  const previousEffectNames = uniqueStrings(
    arr(revisionDelta?.current?.effectNames).length
      ? revisionDelta.current.effectNames
      : arr(priorPlanMetadata?.effectStrategy?.seedRecommendations).map((row) => row?.effectName)
  );
  const previousTargetIds = uniqueStrings(
    arr(revisionDelta?.current?.targetIds).length
      ? revisionDelta.current.targetIds
      : arr(priorPlanMetadata?.effectStrategy?.seedRecommendations).flatMap((row) => arr(row?.targetIds))
  );

  const comparison = isPlainObject(renderCritiqueContext?.comparison) ? renderCritiqueContext.comparison : {};
  const observed = isPlainObject(renderCritiqueContext?.observed) ? renderCritiqueContext.observed : {};
  const unresolvedSignals = uniqueStrings([
    comparison.leadMatchesPrimaryFocus === false ? "lead_mismatch" : "",
    str(observed.temporalRead) === "flat" ? "flat_development" : "",
    arr(comparison.adjacentWindowComparisons).some((row) => row?.windowsReadSimilarly || row?.sameLeadModel)
      ? "weak_section_contrast"
      : "",
    comparison.renderCoverageTooSparse ? "under_coverage" : "",
    comparison.renderCoverageTooBroad ? "over_coverage" : ""
  ]);

  return {
    artifactType: "sequencer_prior_pass_memory_v1",
    artifactVersion: 1,
    previousRevisionLevel: str(sequenceRevisionObjective?.ladderLevel),
    previousOwner: str(sequenceRevisionObjective?.scope?.nextOwner),
    previousRevisionRoles: arr(sequenceRevisionObjective?.scope?.revisionRoles),
    previousRevisionTargets: arr(sequenceRevisionObjective?.scope?.revisionTargets),
    previousLeadModel: str(observed.leadModel),
    previousBreadthRead: str(observed.breadthRead),
    previousTemporalRead: str(observed.temporalRead),
    previousCoverageRead: str(observed.coverageRead),
    previousEffectNames,
    previousTargetIds,
    unresolvedSignals
  };
}
