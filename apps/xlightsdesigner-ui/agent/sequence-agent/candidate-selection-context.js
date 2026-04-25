function str(value = "") {
  return String(value || "").trim();
}

function normalizeChangeBias(changeBias = null) {
  const composition = changeBias && typeof changeBias?.composition === "object" ? changeBias.composition : null;
  const progression = changeBias && typeof changeBias?.progression === "object" ? changeBias.progression : null;
  const layering = changeBias && typeof changeBias?.layering === "object" ? changeBias.layering : null;
  const preservation = changeBias && typeof changeBias?.preservation === "object" ? changeBias.preservation : null;
  const normalized = {
    composition: composition
      ? {
          mismatch: Boolean(composition.mismatch),
          targetShape: str(composition.targetShape)
        }
      : null,
    progression: progression
      ? {
          mismatch: Boolean(progression.mismatch),
          temporalVariation: str(progression.temporalVariation)
        }
      : null,
    layering: layering
      ? {
          mismatch: Boolean(layering.mismatch),
          separation: str(layering.separation),
          density: str(layering.density)
        }
      : null,
    preservation: preservation
      ? {
          mismatch: Boolean(preservation.mismatch),
          existingEffects: str(preservation.existingEffects)
        }
      : null
  };
  const hasBias = Boolean(
    normalized.composition?.targetShape
    || normalized.progression?.temporalVariation
    || normalized.layering?.separation
    || normalized.layering?.density
    || normalized.preservation?.existingEffects
  );
  return hasBias ? normalized : null;
}

export function buildCandidateSelectionContext({
  requestId = "",
  phase = "",
  sequenceRevision = "",
  priorPassMemory = null,
  revisionRetryPressure = null,
  renderValidationEvidence = null,
  revisionFeedback = null
} = {}) {
  const phaseValue = str(phase) || "plan";
  const requestValue = str(requestId) || "request";
  const revisionValue = str(sequenceRevision) || "unknown";
  const critiqueRef = str(renderValidationEvidence?.sequenceCritiqueRef || renderValidationEvidence?.renderObservationRef);
  const changeBias = normalizeChangeBias(revisionFeedback?.nextDirection?.changeBias);
  const unresolvedSignals = Array.isArray(priorPassMemory?.unresolvedSignals)
    ? priorPassMemory.unresolvedSignals.map((row) => str(row)).filter(Boolean)
    : [];
  const retryPressureSignals = Array.isArray(revisionRetryPressure?.signals)
    ? revisionRetryPressure.signals.map((row) => str(row)).filter(Boolean)
    : Array.isArray(priorPassMemory?.retryPressureSignals)
      ? priorPassMemory.retryPressureSignals.map((row) => str(row)).filter(Boolean)
    : [];
  const seedParts = [phaseValue, requestValue, revisionValue];
  if (critiqueRef) seedParts.push(critiqueRef);
  if (unresolvedSignals.length) seedParts.push(unresolvedSignals.join(","));
  if (retryPressureSignals.length) seedParts.push(retryPressureSignals.join(","));
  if (changeBias?.composition?.targetShape) seedParts.push(`comp:${changeBias.composition.targetShape}`);
  if (changeBias?.progression?.temporalVariation) seedParts.push(`prog:${changeBias.progression.temporalVariation}`);
  if (changeBias?.layering?.density || changeBias?.layering?.separation) {
    seedParts.push(`layer:${changeBias.layering?.density || ""}:${changeBias.layering?.separation || ""}`);
  }
  if (changeBias?.preservation?.existingEffects) seedParts.push(`preserve:${changeBias.preservation.existingEffects}`);
  return {
    phase: phaseValue,
    seed: seedParts.join("::"),
    explorationEnabled: phaseValue !== "plan",
    unresolvedSignals,
    retryPressureSignals,
    changeBias
  };
}
