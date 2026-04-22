function str(value = "") {
  return String(value || "").trim();
}

export function buildCandidateSelectionContext({
  requestId = "",
  phase = "",
  sequenceRevision = "",
  priorPassMemory = null,
  renderValidationEvidence = null
} = {}) {
  const phaseValue = str(phase) || "plan";
  const requestValue = str(requestId) || "request";
  const revisionValue = str(sequenceRevision) || "unknown";
  const critiqueRef = str(renderValidationEvidence?.sequenceCritiqueRef || renderValidationEvidence?.renderObservationRef);
  const unresolvedSignals = Array.isArray(priorPassMemory?.unresolvedSignals)
    ? priorPassMemory.unresolvedSignals.map((row) => str(row)).filter(Boolean)
    : [];
  const retryPressureSignals = Array.isArray(priorPassMemory?.retryPressureSignals)
    ? priorPassMemory.retryPressureSignals.map((row) => str(row)).filter(Boolean)
    : [];
  const seedParts = [phaseValue, requestValue, revisionValue];
  if (critiqueRef) seedParts.push(critiqueRef);
  if (unresolvedSignals.length) seedParts.push(unresolvedSignals.join(","));
  if (retryPressureSignals.length) seedParts.push(retryPressureSignals.join(","));
  return {
    phase: phaseValue,
    seed: seedParts.join("::"),
    explorationEnabled: phaseValue !== "plan",
    unresolvedSignals,
    retryPressureSignals
  };
}
