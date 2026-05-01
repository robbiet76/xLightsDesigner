function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueStrings(values = []) {
  return [...new Set(arr(values).map((row) => str(row)).filter(Boolean))];
}

function numOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function compactSubmodelEvidenceRow(submodel = {}) {
  const targetId = str(submodel?.id || submodel?.targetId || submodel?.name);
  if (!targetId) return null;
  const coverage = submodel?.nodeCoverage && typeof submodel.nodeCoverage === "object"
    ? submodel.nodeCoverage
    : {};
  return {
    targetId,
    parentId: str(submodel?.parentId),
    name: str(submodel?.name),
    siblingCount: Number(submodel?.siblingCount || 0),
    siblingIds: uniqueStrings(submodel?.siblingIds).slice(0, 16),
    overlappingSiblingIds: uniqueStrings(submodel?.overlappingSiblingIds).slice(0, 16),
    overlapsSibling: Boolean(submodel?.overlapsSibling),
    nodeCoverage: {
      nodeCount: numOrNull(coverage?.nodeCount) ?? 0,
      parentNodeCount: numOrNull(coverage?.parentNodeCount),
      ratio: numOrNull(coverage?.ratio)
    },
    structureHints: uniqueStrings(submodel?.structureHints).slice(0, 12)
  };
}

function buildSubmodelEvidence({ submodelsById = {}, targetIds = [], priorEvidence = null } = {}) {
  const targets = uniqueStrings(targetIds);
  if (!targets.length) return arr(priorEvidence?.submodelEvidence).map(compactSubmodelEvidenceRow).filter(Boolean).slice(0, 24);
  const submodels = submodelsById && typeof submodelsById === "object" && !Array.isArray(submodelsById)
    ? submodelsById
    : {};
  const selected = [];
  const seen = new Set();
  const pushRow = (row) => {
    const compact = compactSubmodelEvidenceRow(row);
    if (!compact || seen.has(compact.targetId)) return;
    seen.add(compact.targetId);
    selected.push(compact);
  };

  for (const targetId of targets) {
    if (submodels[targetId]) pushRow(submodels[targetId]);
    for (const submodel of Object.values(submodels)) {
      if (str(submodel?.parentId) === targetId) pushRow(submodel);
      if (selected.length >= 24) break;
    }
    if (selected.length >= 24) break;
  }

  return selected;
}

export function buildRenderValidationEvidence({
  priorEvidence = null,
  renderObservation = null,
  renderCritiqueContext = null,
  sectionNames = [],
  targetIds = [],
  submodelsById = {}
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
    targetIds: uniqueStrings(targetIds.length ? targetIds : prior.targetIds),
    submodelEvidence: buildSubmodelEvidence({
      submodelsById,
      targetIds: targetIds.length ? targetIds : prior.targetIds,
      priorEvidence: prior
    })
  };
}
