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

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function buildSubmodelProbePlan(renderValidationEvidence = null) {
  const evidenceRows = arr(renderValidationEvidence?.submodelEvidence)
    .map((row) => {
      const targetId = str(row?.targetId);
      if (!targetId) return null;
      const ratio = Number(row?.nodeCoverage?.ratio);
      const hints = arr(row?.structureHints).map((hint) => str(hint)).filter(Boolean);
      const overlappingSiblingIds = arr(row?.overlappingSiblingIds).map((id) => str(id)).filter(Boolean);
      const siblingIds = arr(row?.siblingIds).map((id) => str(id)).filter(Boolean);
      return {
        targetId,
        parentId: str(row?.parentId),
        nodeCoverageRatio: Number.isFinite(ratio) ? ratio : null,
        structureHints: hints,
        siblingCount: num(row?.siblingCount),
        overlappingSiblingIds,
        siblingIds
      };
    })
    .filter(Boolean);
  if (!evidenceRows.length) return null;

  const featureRows = evidenceRows.filter((row) => row.structureHints.some((hint) => hint.startsWith("feature_")));
  const overlappingRows = evidenceRows.filter((row) => row.overlappingSiblingIds.length);
  const smallRegionRows = evidenceRows.filter((row) => row.nodeCoverageRatio != null && row.nodeCoverageRatio > 0 && row.nodeCoverageRatio <= 0.12);
  const siblingRichRows = evidenceRows.filter((row) => row.siblingCount >= 2);
  const recommendedTargetIds = [
    ...featureRows.map((row) => row.targetId),
    ...smallRegionRows.map((row) => row.targetId),
    ...overlappingRows.map((row) => row.targetId),
    ...siblingRichRows.map((row) => row.targetId)
  ].filter(Boolean);
  const parentTargetIds = [...new Set(evidenceRows.map((row) => row.parentId).filter(Boolean))];
  const siblingPairProbeIds = overlappingRows
    .flatMap((row) => row.overlappingSiblingIds.map((siblingId) => [row.targetId, siblingId].sort().join(" + ")))
    .filter(Boolean);

  return {
    strategy: recommendedTargetIds.length ? "submodel_first_with_parent_control" : "parent_control_only",
    parentTargetIds: [...new Set(parentTargetIds)].slice(0, 12),
    recommendedSubmodelTargetIds: [...new Set(recommendedTargetIds)].slice(0, 24),
    siblingPairProbeIds: [...new Set(siblingPairProbeIds)].slice(0, 12),
    reasons: [
      featureRows.length ? "feature_submodels_present" : "",
      smallRegionRows.length ? "small_coverage_regions_present" : "",
      overlappingRows.length ? "overlapping_sibling_submodels_present" : "",
      siblingRichRows.length ? "multi_submodel_parent_present" : ""
    ].filter(Boolean)
  };
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
  const submodelProbePlan = buildSubmodelProbePlan(renderValidationEvidence);
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
  if (submodelProbePlan?.strategy) seedParts.push(`submodel:${submodelProbePlan.strategy}:${submodelProbePlan.recommendedSubmodelTargetIds.join(",")}`);
  return {
    phase: phaseValue,
    seed: seedParts.join("::"),
    explorationEnabled: phaseValue !== "plan",
    unresolvedSignals,
    retryPressureSignals,
    changeBias,
    submodelProbePlan
  };
}
