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

function buildMemoryKey({ requestScope = {}, revisionRoles = [], signal = "", effectName = "" } = {}) {
  return [
    str(requestScope?.mode) || "unknown_scope",
    str(requestScope?.reviewStartLevel) || "unknown_level",
    uniqueStrings(revisionRoles).join("+") || "no_role",
    str(signal) || "no_signal",
    str(effectName) || "unknown_effect"
  ].join("::");
}

function collectPlannedEffectNames(planHandoff = null) {
  return uniqueStrings(
    arr(planHandoff?.commands)
      .map((row) => row?.params?.effectName)
  );
}

function collectEffectCommands(planHandoff = null, effectName = "") {
  const desired = str(effectName);
  return arr(planHandoff?.commands).filter((row) =>
    str(row?.cmd) === "effects.create" && str(row?.params?.effectName) === desired
  );
}

function buildAppliedParameterGuidance(planHandoff = null, effectName = "") {
  const commands = collectEffectCommands(planHandoff, effectName);
  const collected = new Map();
  for (const command of commands) {
    const guidancePriors = arr(command?.intent?.parameterPriorGuidance?.priors);
    for (const prior of guidancePriors) {
      const parameterName = str(prior?.parameterName);
      const recommendedAnchor = arr(prior?.recommendedAnchors)[0] || null;
      if (!parameterName || !recommendedAnchor) continue;
      const key = `${parameterName}::${JSON.stringify(recommendedAnchor?.parameterValue)}::${str(prior?.paletteMode)}`;
      if (collected.has(key)) continue;
      collected.set(key, {
        parameterName,
        appliedValue: recommendedAnchor?.parameterValue,
        paletteMode: str(prior?.paletteMode),
        confidence: str(prior?.confidence),
        recommendationMode: str(command?.intent?.parameterPriorGuidance?.recommendationMode),
        geometryProfile: str(prior?.geometryProfile),
        modelType: str(prior?.modelType),
        behaviorHints: uniqueStrings(recommendedAnchor?.behaviorHints),
        temporalSignatureHints: uniqueStrings(recommendedAnchor?.temporalSignatureHints)
      });
    }
  }
  return [...collected.values()].sort((a, b) =>
    a.parameterName.localeCompare(b.parameterName) ||
    String(a.appliedValue).localeCompare(String(b.appliedValue))
  );
}

const SHARED_SETTING_EXTRACTORS = Object.freeze([
  { key: "layerMethod", settingName: "T_CHOICE_LayerMethod" },
  { key: "effectLayerMix", settingName: "T_SLIDER_EffectLayerMix" },
  { key: "bufferStyle", settingName: "B_CHOICE_BufferStyle" },
  { key: "inTransitionType", settingName: "T_CHOICE_In_Transition_Type" },
  { key: "outTransitionType", settingName: "T_CHOICE_Out_Transition_Type" },
  { key: "layerMorph", settingName: "T_CHECKBOX_LayerMorph" }
]);

function normalizeSharedSettingValue(value) {
  if (typeof value === "boolean") return value;
  const text = str(value);
  if (!text) return "";
  if (text === "1") return true;
  if (text === "0") return false;
  return text;
}

function buildAppliedSharedSettingGuidance(planHandoff = null, effectName = "") {
  const commands = collectEffectCommands(planHandoff, effectName);
  const collected = new Map();
  for (const command of commands) {
    const settings = command?.params?.settings && typeof command.params.settings === "object"
      ? command.params.settings
      : {};
    for (const extractor of SHARED_SETTING_EXTRACTORS) {
      if (!Object.prototype.hasOwnProperty.call(settings, extractor.settingName)) continue;
      const appliedValue = normalizeSharedSettingValue(settings[extractor.settingName]);
      if (appliedValue === "") continue;
      const key = `${extractor.key}::${JSON.stringify(appliedValue)}`;
      if (collected.has(key)) continue;
      collected.set(key, {
        settingName: extractor.key,
        appliedValue
      });
    }
  }
  return [...collected.values()].sort((a, b) =>
    a.settingName.localeCompare(b.settingName) ||
    String(a.appliedValue).localeCompare(String(b.appliedValue))
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
  const requestScope = {
    mode: str(requestedScope?.requestScopeMode || planHandoff?.metadata?.requestScopeMode),
    reviewStartLevel: str(requestedScope?.reviewStartLevel || planHandoff?.metadata?.reviewStartLevel),
    sectionScopeKind: str(requestedScope?.sectionScopeKind || planHandoff?.metadata?.sectionScopeKind)
  };
  const critiqueSignals = uniqueStrings([...priorSignals, ...currentSignals]);

  return effectNames.map((effectName) => finalizeArtifact({
    artifactType: "effect_family_outcome_record_v1",
    artifactVersion: "1.0",
    storageClass: "general_training",
    projectKey: str(projectKey),
    sequencePath: str(sequencePath),
    historyEntryId: str(historyEntry?.historyEntryId),
    effectName: str(effectName),
    requestScope,
    revisionLevel: str(sequenceRevisionObjective?.ladderLevel),
    revisionRoles,
    targetIds,
    revisionAttempt: {
      summary: str(requestedScope?.summary || requestedScope?.executionObjective),
      roleKey: revisionRoles.join("+"),
      targetCount: targetIds.length,
      commandCount: collectEffectCommands(planHandoff, effectName).length
    },
    critiqueChange: {
      priorSignals,
      postSignals: currentSignals,
      resolvedSignals: outcome.resolvedSignals,
      persistedSignals: outcome.persistedSignals,
      newSignals: outcome.newSignals
    },
    memoryKeys: critiqueSignals.map((signal) => buildMemoryKey({
      requestScope,
      revisionRoles,
      signal,
      effectName
    })),
    appliedParameterGuidance: buildAppliedParameterGuidance(planHandoff, effectName),
    appliedSharedSettingGuidance: buildAppliedSharedSettingGuidance(planHandoff, effectName),
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
