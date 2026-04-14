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

function normalizeEnergyLabel(value = "") {
  const lower = str(value).toLowerCase();
  if (!lower) return "unknown";
  if (/(low|quiet|soft|gentle|restrained)/.test(lower)) return "low";
  if (/(high|big|dense|intense|peak|lift)/.test(lower)) return "high";
  return "medium";
}

function normalizeDensityLabel(value = "") {
  const lower = str(value).toLowerCase();
  if (!lower) return "unknown";
  if (/(sparse|open|light|restrained)/.test(lower)) return "sparse";
  if (/(dense|busy|thick|full|broad)/.test(lower)) return "dense";
  return "moderate";
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

function inferBalanceRead(ratio = 0) {
  if (!Number.isFinite(Number(ratio))) return "unknown";
  const value = Number(ratio);
  if (value < 0.15) return "balanced";
  if (value < 0.35) return "slightly_off";
  return "imbalanced";
}

function buildWindowComparisons(windows = []) {
  const rows = arr(windows)
    .map((row) => (isPlainObject(row) ? row : null))
    .filter(Boolean)
    .map((row) => ({
      label: str(row?.label),
      leadModel: str(row?.leadModel),
      breadthRead: inferBreadthRead(Number(row?.meanSceneSpreadRatio || 0)),
      temporalRead: str(row?.temporalRead || "unknown") || "unknown",
      activeModelNames: uniqueStrings(row?.activeModelNames),
      startMs: Number(row?.startMs || 0),
      endMs: Number(row?.endMs || 0)
    }));
  const comparisons = [];
  for (let i = 0; i < rows.length - 1; i += 1) {
    const current = rows[i];
    const next = rows[i + 1];
    const sameLeadModel = Boolean(current.leadModel) && current.leadModel === next.leadModel;
    const sameBreadthRead = current.breadthRead === next.breadthRead;
    const sameTemporalRead = current.temporalRead === next.temporalRead;
    const activeA = new Set(current.activeModelNames);
    const activeB = new Set(next.activeModelNames);
    const union = new Set([...activeA, ...activeB]);
    const intersection = [...activeA].filter((id) => activeB.has(id));
    const overlapRatio = union.size ? intersection.length / union.size : 1;
    comparisons.push({
      fromLabel: current.label || `window_${i + 1}`,
      toLabel: next.label || `window_${i + 2}`,
      sameLeadModel,
      sameBreadthRead,
      sameTemporalRead,
      overlapRatio: Number(overlapRatio.toFixed(4)),
      windowsReadSimilarly: sameLeadModel && sameBreadthRead && sameTemporalRead && overlapRatio >= 0.8
    });
  }
  return comparisons;
}

function buildMusicSectionIndex(musicDesignContext = null) {
  const sectionArc = arr(musicDesignContext?.sectionArc);
  const index = new Map();
  for (const row of sectionArc) {
    const label = str(row?.label);
    if (!label) continue;
    index.set(label.toLowerCase(), {
      label,
      energy: normalizeEnergyLabel(row?.energy),
      density: normalizeDensityLabel(row?.density)
    });
  }
  return index;
}

function collectObservedWindowLabels(observation = null) {
  const labels = uniqueStrings(arr(observation?.windows).map((row) => row?.label));
  if (labels.length) return labels;
  return uniqueStrings(arr(observation?.source?.windows).map((row) => row?.label));
}

function summarizeMusicExpectation({ musicDesignContext = null, renderObservation = null, sequencingDesignHandoff = null } = {}) {
  const musicIndex = buildMusicSectionIndex(musicDesignContext);
  const candidateLabels = uniqueStrings([
    ...collectObservedWindowLabels(renderObservation),
    ...arr(sequencingDesignHandoff?.scope?.sections)
  ]);
  const matchedSections = candidateLabels
    .map((label) => musicIndex.get(str(label).toLowerCase()))
    .filter(Boolean);
  const energies = uniqueStrings(matchedSections.map((row) => row.energy));
  const densities = uniqueStrings(matchedSections.map((row) => row.density));
  return {
    matchedSections,
    highestEnergy: energies.includes("high") ? "high" : (energies.includes("medium") ? "medium" : (energies[0] || "unknown")),
    densityBias: densities.includes("dense") ? "dense" : (densities.includes("moderate") ? "moderate" : (densities[0] || "unknown"))
  };
}

function toExpectedMusicSections(rows = []) {
  return arr(rows).map((row) => ({
    label: str(row?.label),
    energy: normalizeEnergyLabel(row?.energy),
    density: normalizeDensityLabel(row?.density)
  })).filter((row) => row.label);
}

function inferLocalizedFocusExpected({ handoff = null, broadCoverageExpected = false, restrainedCoverageExpected = false } = {}) {
  if (broadCoverageExpected) return false;
  const primaryTargets = uniqueStrings(handoff?.focusPlan?.primaryTargets || handoff?.focusPlan?.primaryTargetIds);
  const supportTargets = uniqueStrings(handoff?.focusPlan?.secondaryTargets || handoff?.focusPlan?.secondaryTargetIds);
  const targetIds = uniqueStrings(handoff?.scope?.targetIds);
  const explicitTargets = uniqueStrings([...primaryTargets, ...supportTargets, ...targetIds]);
  if (restrainedCoverageExpected && explicitTargets.length <= 3) return true;
  if (primaryTargets.length <= 2 && supportTargets.length <= 1 && explicitTargets.length <= 3) return true;
  return false;
}

export function buildRenderCritiqueContext({
  renderObservation = null,
  designSceneContext = null,
  sequencingDesignHandoff = null,
  musicDesignContext = null
} = {}) {
  const observation = isPlainObject(renderObservation) ? renderObservation : null;
  if (!observation) return null;

  const scene = isPlainObject(designSceneContext) ? designSceneContext : null;
  const handoff = isPlainObject(sequencingDesignHandoff) ? sequencingDesignHandoff : null;
  const macro = isPlainObject(observation?.macro) ? observation.macro : {};
  const source = isPlainObject(observation?.source) ? observation.source : {};

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
  const windowComparisons = buildWindowComparisons(observation?.windows);
  const densityTargets = uniqueStrings(
    arr(handoff?.sectionDirectives).map((row) => str(row?.densityTarget))
  ).map((row) => row.toLowerCase());
  const musicExpectation = summarizeMusicExpectation({
    musicDesignContext,
    renderObservation: observation,
    sequencingDesignHandoff: handoff
  });
  const broadCoverageExpected =
    broadCoverageDomains.length > 0 ||
    densityTargets.some((row) => ["high", "dense", "full", "broad"].includes(row)) ||
    musicExpectation.highestEnergy === "high" ||
    musicExpectation.densityBias === "dense";
  const restrainedCoverageExpected =
    densityTargets.some((row) => ["low", "sparse", "restrained"].includes(row)) ||
    musicExpectation.highestEnergy === "low" ||
    musicExpectation.densityBias === "sparse";
  const localizedFocusExpected = inferLocalizedFocusExpected({
    handoff,
    broadCoverageExpected,
    restrainedCoverageExpected
  });

  return {
    artifactType: "sequence_render_critique_context_v1",
    artifactVersion: 1,
    source: {
      renderObservationArtifactId: str(observation?.artifactId),
      designSceneContextArtifactId: str(scene?.artifactId),
      sequencingDesignHandoffArtifactId: str(handoff?.artifactId),
      musicDesignContextArtifactId: str(musicDesignContext?.artifactId)
    },
    expected: {
      primaryFocusTargetIds,
      supportTargetIds,
      preferredVisualFamilies,
      broadCoverageDomains,
      detailCoverageDomains,
      designSummary: str(handoff?.designSummary),
      musicSections: toExpectedMusicSections(musicExpectation.matchedSections),
      musicEnergyRead: musicExpectation.highestEnergy,
      musicDensityRead: musicExpectation.densityBias
    },
    observed: {
      activeModelNames: observedActiveModels,
      activeFamilyNames: observedFamilyNames,
      leadModel: observedLeadModel,
      leadModelShare: Number(macro.leadModelShare || 0),
      sampledStartMs: Number(source.startMs || 0),
      sampledEndMs: Number(source.endMs || 0),
      samplingMode: str(source.samplingMode || "full") || "full",
      sampledModelCount: Number(source.sampledModelCount || 0),
      windowCount: Number(source.windowCount || 0),
      meanSceneSpreadRatio: spreadRatio,
      breadthRead: inferBreadthRead(spreadRatio),
      activeCoverageRatio: Number(macro.activeCoverageRatio || 0),
      coverageGapCount: Number(macro.coverageGapCount || 0),
      coverageGapRegions: uniqueStrings(macro.coverageGapRegions),
      coverageRead: str(macro.coverageRead || "unknown") || "unknown",
      leftRightBalanceRatio: Number(macro.leftRightBalanceRatio || 0),
      leftRightBalanceRead: inferBalanceRead(Number(macro.leftRightBalanceRatio || 0)),
      topBottomBalanceRatio: Number(macro.topBottomBalanceRatio || 0),
      topBottomBalanceRead: inferBalanceRead(Number(macro.topBottomBalanceRatio || 0)),
      maxActiveModelRatio: Number(macro.maxActiveModelRatio || 0),
      temporalRead: str(macro.temporalRead || "unknown") || "unknown",
      energyVariation: Number(macro.energyVariation || 0),
      activeModelVariation: Number(macro.activeModelVariation || 0),
      distinctLeadModelCount: Number(macro.distinctLeadModelCount || 0)
    },
    comparison: {
      observedFocusTargets,
      missingPrimaryFocusTargets: primaryFocusTargetIds.filter((targetId) => !observedModelSet.has(targetId)),
      leadMatchesPrimaryFocus,
      leadIsKnownFocalCandidate,
      broadCoverageExpected,
      restrainedCoverageExpected,
      localizedFocusExpected,
      musicalLiftExpected: musicExpectation.highestEnergy === "high" || musicExpectation.densityBias === "dense",
      restrainedMomentExpected: musicExpectation.highestEnergy === "low" || musicExpectation.densityBias === "sparse",
      renderUsesBroadScene: spreadRatio >= 0.03,
      renderUsesTightFocus: spreadRatio < 0.01,
      renderCoverageTooSparse: broadCoverageExpected && Number(macro.activeCoverageRatio || 0) < 0.2,
      renderCoverageTooBroad: restrainedCoverageExpected && Number(macro.activeCoverageRatio || 0) > 0.45,
      renderHasDisplayGaps: Number(macro.coverageGapCount || 0) >= 2,
      renderIsLeftRightImbalanced: Number(macro.leftRightBalanceRatio || 0) >= 0.35,
      renderIsTopBottomImbalanced: Number(macro.topBottomBalanceRatio || 0) >= 0.35,
      adjacentWindowComparisons: windowComparisons
    }
  };
}
