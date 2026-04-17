function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueStrings(values = []) {
  return [...new Set(arr(values).map((row) => str(row)).filter(Boolean))];
}

export function buildRenderValidationEvidence({
  priorEvidence = null,
  renderObservation = null,
  renderCritiqueContext = null,
  sectionNames = [],
  targetIds = []
} = {}) {
  const prior = priorEvidence && typeof priorEvidence === "object" && !Array.isArray(priorEvidence)
    ? priorEvidence
    : {};
  const scopeLevel = str(prior.scopeLevel)
    || str(renderCritiqueContext?.scopeLevel)
    || (sectionNames.length ? "section_window" : targetIds.length ? "target_window" : "macro_window");

  return {
    renderObservationRef: str(renderObservation?.artifactId) || str(prior.renderObservationRef) || null,
    compositionObservationRef: str(prior.compositionObservationRef) || null,
    layeringObservationRef: str(prior.layeringObservationRef) || null,
    progressionObservationRef: str(prior.progressionObservationRef) || null,
    sequenceCritiqueRef: str(prior.sequenceCritiqueRef) || null,
    renderCritiqueContextRef: str(renderCritiqueContext?.artifactId) || str(prior.renderCritiqueContextRef) || null,
    scopeLevel,
    sectionNames: uniqueStrings(sectionNames.length ? sectionNames : prior.sectionNames),
    targetIds: uniqueStrings(targetIds.length ? targetIds : prior.targetIds)
  };
}
