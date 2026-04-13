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

function pickPrimaryFocusTargets(handoff = null, designSceneContext = null) {
  const focusPlan = isPlainObject(handoff?.focusPlan) ? handoff.focusPlan : {};
  const fromHandoff = uniqueStrings(focusPlan.primaryTargets || focusPlan.primaryTargetIds);
  if (fromHandoff.length) return fromHandoff;
  return uniqueStrings(arr(designSceneContext?.focalCandidates).slice(0, 4));
}

function pickSupportTargets(handoff = null) {
  const focusPlan = isPlainObject(handoff?.focusPlan) ? handoff.focusPlan : {};
  return uniqueStrings(focusPlan.secondaryTargets || focusPlan.secondaryTargetIds);
}

function inferBreadthRead(spread = 0) {
  if (!Number.isFinite(Number(spread))) return "unknown";
  const value = Number(spread);
  if (value < 0.01) return "tight";
  if (value < 0.03) return "moderate";
  return "broad";
}

export function buildRenderCritiqueContext({
  renderObservation = null,
  designSceneContext = null,
  sequencingDesignHandoff = null
} = {}) {
  const observation = isPlainObject(renderObservation) ? renderObservation : null;
  if (!observation) return null;

  const scene = isPlainObject(designSceneContext) ? designSceneContext : null;
  const handoff = isPlainObject(sequencingDesignHandoff) ? sequencingDesignHandoff : null;
  const macro = isPlainObject(observation?.macro) ? observation.macro : {};

  const primaryFocusTargetIds = pickPrimaryFocusTargets(handoff, scene);
  const supportTargetIds = pickSupportTargets(handoff);
  const preferredVisualFamilies = uniqueStrings(
    arr(handoff?.sectionDirectives).flatMap((row) => arr(row?.preferredVisualFamilies))
  );
  const observedActiveModels = uniqueStrings(macro.activeModelNames);
  const observedLeadModel = str(macro.leadModel);
  const observedFamilyNames = uniqueStrings(Object.keys(macro.activeFamilyTotals || {}));
  const focalCandidateSet = new Set(uniqueStrings(scene?.focalCandidates));
  const primaryFocusSet = new Set(primaryFocusTargetIds);
  const observedModelSet = new Set(observedActiveModels);

  const observedFocusTargets = primaryFocusTargetIds.filter((targetId) => observedModelSet.has(targetId));
  const leadMatchesPrimaryFocus = Boolean(observedLeadModel && primaryFocusSet.has(observedLeadModel));
  const leadIsKnownFocalCandidate = Boolean(observedLeadModel && focalCandidateSet.has(observedLeadModel));
  const broadCoverageDomains = uniqueStrings(scene?.coverageDomains?.broad);
  const detailCoverageDomains = uniqueStrings(scene?.coverageDomains?.detail);
  const spreadRatio = Number(macro.meanSceneSpreadRatio || 0);

  return {
    artifactType: "sequence_render_critique_context_v1",
    artifactVersion: 1,
    source: {
      renderObservationArtifactId: str(observation?.artifactId),
      designSceneContextArtifactId: str(scene?.artifactId),
      sequencingDesignHandoffArtifactId: str(handoff?.artifactId)
    },
    expected: {
      primaryFocusTargetIds,
      supportTargetIds,
      preferredVisualFamilies,
      broadCoverageDomains,
      detailCoverageDomains,
      designSummary: str(handoff?.designSummary)
    },
    observed: {
      activeModelNames: observedActiveModels,
      activeFamilyNames: observedFamilyNames,
      leadModel: observedLeadModel,
      leadModelShare: Number(macro.leadModelShare || 0),
      meanSceneSpreadRatio: spreadRatio,
      breadthRead: inferBreadthRead(spreadRatio),
      maxActiveModelRatio: Number(macro.maxActiveModelRatio || 0)
    },
    comparison: {
      observedFocusTargets,
      missingPrimaryFocusTargets: primaryFocusTargetIds.filter((targetId) => !observedModelSet.has(targetId)),
      leadMatchesPrimaryFocus,
      leadIsKnownFocalCandidate,
      broadCoverageExpected: broadCoverageDomains.length > 0,
      renderUsesBroadScene: spreadRatio >= 0.03,
      renderUsesTightFocus: spreadRatio < 0.01
    }
  };
}
