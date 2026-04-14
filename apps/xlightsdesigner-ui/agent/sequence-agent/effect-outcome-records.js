import { finalizeArtifact } from "../shared/artifact-ids.js";

function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueStrings(values = []) {
  return [...new Set(arr(values).map((row) => str(row)).filter(Boolean))];
}

function collectCurrentUnresolvedSignals(renderCritiqueContext = null) {
  const comparison = renderCritiqueContext && typeof renderCritiqueContext?.comparison === "object"
    ? renderCritiqueContext.comparison
    : {};
  const observed = renderCritiqueContext && typeof renderCritiqueContext?.observed === "object"
    ? renderCritiqueContext.observed
    : {};
  return uniqueStrings([
    comparison.leadMatchesPrimaryFocus === false ? "lead_mismatch" : "",
    str(observed.temporalRead) === "flat" ? "flat_development" : "",
    arr(comparison.adjacentWindowComparisons).some((row) => row?.windowsReadSimilarly || row?.sameLeadModel)
      ? "weak_section_contrast"
      : "",
    comparison.renderCoverageTooSparse ? "under_coverage" : "",
    comparison.renderCoverageTooBroad ? "over_coverage" : ""
  ]);
}

function deriveOutcomeSummary({ priorSignals = [], currentSignals = [] } = {}) {
  const prior = new Set(uniqueStrings(priorSignals));
  const current = new Set(uniqueStrings(currentSignals));
  const resolvedSignals = [...prior].filter((row) => !current.has(row));
  const persistedSignals = [...prior].filter((row) => current.has(row));
  const newSignals = [...current].filter((row) => !prior.has(row));
  const improved = resolvedSignals.length > 0 && newSignals.length === 0;
  let status = "unchanged";
  if (improved) {
    status = "improved";
  } else if (resolvedSignals.length > 0 && newSignals.length > 0) {
    status = "mixed";
  } else if (!resolvedSignals.length && newSignals.length > 0) {
    status = "regressed";
  }
  return {
    status,
    improved,
    resolvedSignals,
    persistedSignals,
    newSignals
  };
}

function collectPlannedEffectNames(planHandoff = null) {
  return uniqueStrings(
    arr(planHandoff?.commands)
      .map((row) => row?.params?.effectName)
  );
}

export function buildEffectFamilyOutcomeRecords({
  planHandoff = null,
  applyResult = null,
  renderObservation = null,
  renderCritiqueContext = null,
  sequenceRevisionObjective = null,
  historyEntry = null,
  projectKey = "",
  sequencePath = ""
} = {}) {
  const effectNames = collectPlannedEffectNames(planHandoff);
  if (!effectNames.length) return [];

  const requestedScope = planHandoff?.metadata?.sequencerRevisionBrief && typeof planHandoff.metadata.sequencerRevisionBrief === "object"
    ? planHandoff.metadata.sequencerRevisionBrief
    : {};
  const priorPassMemory = planHandoff?.metadata?.priorPassMemory && typeof planHandoff.metadata.priorPassMemory === "object"
    ? planHandoff.metadata.priorPassMemory
    : {};
  const priorSignals = uniqueStrings(priorPassMemory?.unresolvedSignals);
  const currentSignals = collectCurrentUnresolvedSignals(renderCritiqueContext);
  const outcome = deriveOutcomeSummary({ priorSignals, currentSignals });
  const revisionRoles = uniqueStrings([
    ...arr(sequenceRevisionObjective?.scope?.revisionRoles),
    ...arr(sequenceRevisionObjective?.sequencerDirection?.revisionRoles),
    ...arr(requestedScope?.revisionRoles)
  ]);
  const targetIds = uniqueStrings([
    ...arr(sequenceRevisionObjective?.scope?.revisionTargets),
    ...arr(requestedScope?.targetScope),
    ...arr(requestedScope?.revisionTargets),
    ...arr(requestedScope?.focusTargets)
  ]);

  return effectNames.map((effectName) => finalizeArtifact({
    artifactType: "effect_family_outcome_record_v1",
    artifactVersion: "1.0",
    storageClass: "general_training",
    projectKey: str(projectKey),
    sequencePath: str(sequencePath),
    historyEntryId: str(historyEntry?.historyEntryId),
    effectName: str(effectName),
    requestScope: {
      mode: str(requestedScope?.requestScopeMode || planHandoff?.metadata?.requestScopeMode),
      reviewStartLevel: str(requestedScope?.reviewStartLevel || planHandoff?.metadata?.reviewStartLevel),
      sectionScopeKind: str(requestedScope?.sectionScopeKind || planHandoff?.metadata?.sectionScopeKind)
    },
    revisionLevel: str(sequenceRevisionObjective?.ladderLevel),
    revisionRoles,
    targetIds,
    priorSignals,
    postSignals: currentSignals,
    resolvedSignals: outcome.resolvedSignals,
    persistedSignals: outcome.persistedSignals,
    newSignals: outcome.newSignals,
    outcome: {
      status: outcome.status,
      improved: outcome.improved,
      resolvedCount: outcome.resolvedSignals.length,
      persistedCount: outcome.persistedSignals.length,
      newCount: outcome.newSignals.length
    },
    renderedRead: {
      leadModel: str(renderObservation?.leadModel || renderCritiqueContext?.observed?.leadModel),
      breadthRead: str(renderObservation?.breadthRead || renderCritiqueContext?.observed?.breadthRead),
      temporalRead: str(renderObservation?.temporalRead || renderCritiqueContext?.observed?.temporalRead),
      coverageRead: str(renderObservation?.coverageRead || renderCritiqueContext?.observed?.coverageRead)
    },
    applyStatus: str(applyResult?.status)
  }));
}
