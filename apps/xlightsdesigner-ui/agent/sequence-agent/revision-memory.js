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

function valuesChanged(current = [], previous = []) {
  const a = uniqueStrings(current);
  const b = uniqueStrings(previous);
  if (a.length !== b.length) return true;
  return a.some((value, index) => value !== b[index]);
}

function buildEffectOutcomeMemory(effectOutcomeRecords = []) {
  const records = arr(effectOutcomeRecords).filter(isPlainObject);
  const successful = records.filter((row) => row?.outcome?.improved === true || str(row?.outcome?.status) === "improved");
  const failed = records.filter((row) => row?.outcome?.improved !== true && str(row?.outcome?.status) !== "improved");
  const tendencies = buildEffectOutcomeTendencies(records);
  return {
    successfulMemoryKeys: uniqueStrings(successful.flatMap((row) => arr(row?.memoryKeys))),
    failedMemoryKeys: uniqueStrings(failed.flatMap((row) => arr(row?.memoryKeys))),
    successfulRevisionRoles: uniqueStrings(successful.flatMap((row) => arr(row?.revisionRoles))),
    failedRevisionRoles: uniqueStrings(failed.flatMap((row) => arr(row?.revisionRoles))),
    successfulEffects: uniqueStrings(successful.map((row) => row?.effectName)),
    failedEffects: uniqueStrings(failed.map((row) => row?.effectName)),
    tendencies
  };
}

function tendencyKeysForOutcomeRecord(row = {}) {
  const text = [
    ...arr(row?.revisionRoles),
    ...arr(row?.memoryKeys)
  ].map((value) => str(value).toLowerCase()).join(" ");
  return uniqueStrings([
    /(strengthen_lead|lead_mismatch)/.test(text) ? "focus" : "",
    /(reduce_competing_support|widen_support|over_coverage|under_coverage)/.test(text) ? "support_balance" : "",
    /(increase_section_contrast|weak_section_contrast)/.test(text) ? "section_contrast" : "",
    /(add_section_development|flat_development)/.test(text) ? "section_development" : ""
  ]);
}

function buildEffectOutcomeTendencies(records = []) {
  const buckets = {
    focus: { successfulEffects: [], failedEffects: [] },
    support_balance: { successfulEffects: [], failedEffects: [] },
    section_contrast: { successfulEffects: [], failedEffects: [] },
    section_development: { successfulEffects: [], failedEffects: [] }
  };
  for (const row of arr(records).filter(isPlainObject)) {
    const effectName = str(row?.effectName);
    if (!effectName) continue;
    const effectList = (row?.outcome?.improved === true || str(row?.outcome?.status) === "improved")
      ? "successfulEffects"
      : "failedEffects";
    for (const key of tendencyKeysForOutcomeRecord(row)) {
      buckets[key][effectList].push(effectName);
    }
  }
  return Object.fromEntries(Object.entries(buckets).map(([key, value]) => [
    key,
    {
      successfulEffects: uniqueStrings(value.successfulEffects),
      failedEffects: uniqueStrings(value.failedEffects)
    }
  ]));
}

function buildDrilldownMemory({ renderCritiqueContext = null, unresolvedSignals = [] } = {}) {
  const source = isPlainObject(renderCritiqueContext?.source) ? renderCritiqueContext.source : {};
  const comparison = isPlainObject(renderCritiqueContext?.comparison) ? renderCritiqueContext.comparison : {};
  const samplingDetail = str(source.samplingDetail).toLowerCase();
  const drilldownTargetIds = uniqueStrings(comparison.drilldownTargetIds);
  const drilldownTargetEvidence = arr(comparison.drilldownTargetEvidence).filter(isPlainObject);
  const instabilitySignals = uniqueStrings(unresolvedSignals).filter((row) => (
    row === "weak_section_contrast" || row === "flat_development"
  ));
  const eligible = drilldownTargetIds.length > 0 && ["drilldown", "mixed"].includes(samplingDetail);
  return {
    samplingDetail,
    sectionInstabilitySignals: instabilitySignals,
    heldAtSectionLevel: instabilitySignals.length > 0 && !eligible,
    eligible,
    targetIds: eligible ? drilldownTargetIds : [],
    targetEvidence: eligible ? drilldownTargetEvidence : [],
    withheldTargetIds: eligible ? [] : drilldownTargetIds,
    withheldTargetEvidence: eligible ? [] : drilldownTargetEvidence
  };
}

export function buildPriorPassMemory({ historySnapshot = null } = {}) {
  const snapshot = isPlainObject(historySnapshot) ? historySnapshot : null;
  const renderCritiqueContext = isPlainObject(snapshot?.renderCritiqueContext) ? snapshot.renderCritiqueContext : null;
  const sequenceRevisionObjective = isPlainObject(snapshot?.sequenceRevisionObjective) ? snapshot.sequenceRevisionObjective : null;
  const priorPlanMetadata = isPlainObject(snapshot?.planHandoff?.metadata) ? snapshot.planHandoff.metadata : null;
  const effectOutcomeMemory = buildEffectOutcomeMemory(snapshot?.effectOutcomeRecords);
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
  const currentDeltaEffects = uniqueStrings(revisionDelta?.current?.effectNames);
  const currentDeltaTargets = uniqueStrings(revisionDelta?.current?.targetIds);
  const previousDeltaEffects = uniqueStrings(revisionDelta?.previous?.effectNames);
  const previousDeltaTargets = uniqueStrings(revisionDelta?.previous?.targetIds);
  const introducedEffectNames = uniqueStrings(revisionDelta?.introduced?.effectNames);
  const introducedTargetIds = uniqueStrings(revisionDelta?.introduced?.targetIds);
  const lowChangeRetry = Boolean(
    revisionDelta &&
    unresolvedSignals.length &&
    !introducedEffectNames.length &&
    !introducedTargetIds.length &&
    !valuesChanged(currentDeltaEffects, previousDeltaEffects) &&
    !valuesChanged(currentDeltaTargets, previousDeltaTargets)
  );
  const retryPressureSignals = uniqueStrings([
    lowChangeRetry ? "low_change_retry" : ""
  ]);
  const drilldownMemory = buildDrilldownMemory({ renderCritiqueContext, unresolvedSignals });

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
    unresolvedSignals,
    retryPressureSignals,
    drilldownMemory,
    effectOutcomeMemory,
    revisionDeltaSummary: revisionDelta
      ? {
          currentEffectNames: currentDeltaEffects,
          currentTargetIds: currentDeltaTargets,
          previousEffectNames: previousDeltaEffects,
          previousTargetIds: previousDeltaTargets,
          introducedEffectNames,
          introducedTargetIds
        }
      : null
  };
}
