import { finalizeArtifact } from "../shared/artifact-ids.js";

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

function deriveDrilldownTargetIds(windows = [], comparisons = []) {
  return uniqueStrings(deriveDrilldownTargetEvidence(windows, comparisons).map((row) => row.targetId));
}

function addDrilldownEvidence(index, { targetId = "", reason = "", windowLabels = [] } = {}) {
  const id = str(targetId);
  if (!id) return;
  const existing = index.get(id) || {
    targetId: id,
    targetKind: "model_or_group",
    reasons: [],
    windowLabels: []
  };
  existing.reasons = uniqueStrings([...existing.reasons, reason]);
  existing.windowLabels = uniqueStrings([...existing.windowLabels, ...arr(windowLabels)]);
  index.set(id, existing);
}

function deriveDrilldownTargetEvidence(windows = [], comparisons = []) {
  const windowMap = new Map(
    arr(windows)
      .map((row) => (isPlainObject(row) ? row : null))
      .filter(Boolean)
      .map((row) => [str(row.label), row])
      .filter(([label]) => label)
  );
  const evidence = new Map();

  for (const comparison of arr(comparisons)) {
    if (!comparison?.windowsReadSimilarly && !comparison?.sameLeadModel) continue;
    const fromWindow = windowMap.get(str(comparison?.fromLabel));
    const toWindow = windowMap.get(str(comparison?.toLabel));
    const fromModels = new Set(uniqueStrings(fromWindow?.activeModelNames));
    const toModels = new Set(uniqueStrings(toWindow?.activeModelNames));
    const sharedModels = [...fromModels].filter((id) => toModels.has(id));
    if (sharedModels.length) {
      for (const targetId of sharedModels) {
        addDrilldownEvidence(evidence, {
          targetId,
          reason: comparison?.windowsReadSimilarly ? "adjacent_windows_read_similarly" : "same_lead_model",
          windowLabels: [comparison?.fromLabel, comparison?.toLabel]
        });
      }
      continue;
    }
    for (const targetId of [str(fromWindow?.leadModel), str(toWindow?.leadModel)]) {
      addDrilldownEvidence(evidence, {
        targetId,
        reason: "same_lead_model",
        windowLabels: [comparison?.fromLabel, comparison?.toLabel]
      });
    }
  }

  for (const window of arr(windows)) {
    if (str(window?.sampleDetail).toLowerCase() !== "drilldown") continue;
    if (str(window?.temporalRead).toLowerCase() !== "flat") continue;
    for (const targetId of [str(window?.leadModel), ...uniqueStrings(window?.activeModelNames).slice(0, 4)]) {
      addDrilldownEvidence(evidence, {
        targetId,
        reason: "flat_drilldown_window",
        windowLabels: [window?.label]
      });
    }
  }

  return [...evidence.values()].map((row) => ({
    ...row,
    reasons: uniqueStrings(row.reasons),
    windowLabels: uniqueStrings(row.windowLabels)
  }));
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

function inferRequestedScopeMeta(handoff = null) {
  const requestedScope = isPlainObject(handoff?.scope?.requestedScope) ? handoff.scope.requestedScope : null;
  return {
    mode: str(requestedScope?.mode),
    reviewStartLevel: str(requestedScope?.reviewStartLevel),
    sectionScopeKind: str(requestedScope?.sectionScopeKind)
  };
}

function clamp01(value = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function scoreFromThreshold(value = 0, goodAt = 1, badAt = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  const high = Number(goodAt);
  const low = Number(badAt);
  if (!Number.isFinite(high) || !Number.isFinite(low) || high === low) return clamp01(n);
  return clamp01((n - low) / (high - low));
}

function issuePenalty(issues = [], weights = {}) {
  return arr(issues).reduce((sum, issue) => sum + Number(weights[issue] || 0), 0);
}

function scoreBand(score = 0) {
  const value = Number(score || 0);
  return value >= 0.8 ? "strong" : value >= 0.6 ? "acceptable" : value >= 0.35 ? "weak" : "very_low";
}

function payloadMatchRatio(payloadSummary = null, fieldName = "") {
  const summary = isPlainObject(payloadSummary) ? payloadSummary : {};
  const ratio = Number(summary?.[`${fieldName}MatchRatio`]);
  if (Number.isFinite(ratio)) return clamp01(ratio);
  const checked = Number(summary?.[`${fieldName}Checked`]);
  const matched = Number(summary?.[`${fieldName}Matched`]);
  if (Number.isFinite(checked) && checked > 0 && Number.isFinite(matched)) return clamp01(matched / checked);
  return null;
}

function buildCompositionExpectation(compositionPlan = null) {
  const plan = isPlainObject(compositionPlan) ? compositionPlan : null;
  if (!plan) return null;
  const sections = arr(plan.sections)
    .map((row) => ({
      section: str(row?.section),
      sectionBucket: str(row?.sectionBucket),
      progressionIntent: str(row?.progressionIntent),
      focalRegion: uniqueStrings(row?.focalRegion),
      supportRegion: uniqueStrings(row?.supportRegion),
      accentRegion: uniqueStrings(row?.accentRegion),
      backgroundRegion: uniqueStrings(row?.backgroundRegion),
      layerStackTargets: uniqueStrings(row?.layerStackTargets),
      expectedBalance: isPlainObject(row?.expectedBalance) ? {
        spatialBreadth: str(row.expectedBalance.spatialBreadth),
        leftRightBalance: str(row.expectedBalance.leftRightBalance),
        topBottomBalance: str(row.expectedBalance.topBottomBalance),
        negativeSpace: str(row.expectedBalance.negativeSpace)
      } : {}
    }))
    .filter((row) => row.section);
  return {
    artifactType: str(plan.artifactType),
    sectionCount: sections.length,
    sections,
    targetRoles: isPlainObject(plan.targetRoles) ? {
      activeTargets: uniqueStrings(plan.targetRoles.activeTargets),
      layeredTargets: uniqueStrings(plan.targetRoles.layeredTargets),
      foundation: uniqueStrings(plan.targetRoles.foundation),
      motion: uniqueStrings(plan.targetRoles.motion),
      accent: uniqueStrings(plan.targetRoles.accent)
    } : {},
    balance: isPlainObject(plan.balance) ? plan.balance : {},
    totals: isPlainObject(plan.totals) ? plan.totals : {}
  };
}

function aliasesForObservedTarget(targetId = "", metadataAssignments = []) {
  const aliases = new Set();
  const add = (value = "") => {
    const key = str(value).toLowerCase();
    if (key) aliases.add(key);
  };
  const target = str(targetId);
  add(target);
  if (target) {
    add("AllModels");
    add("AllModels_NoMatrix");
    add("AllModels_NoMatrix_Floods");
    add("AllModels_NoFloods");
  }
  if (/^border-/i.test(target)) add("Borders");
  if (/^border-/i.test(target)) add("Outlines");
  if (/^flood_/i.test(target)) add("Floods");
  if (/^flood_house-/i.test(target)) add("Floods House");
  if (/^flood_house-/i.test(target)) add("FrontHouse");
  if (/^flood_tree-/i.test(target)) add("Floods Trees");
  if (/snowflake/i.test(target)) add("Snowflakes");
  if (/snowflake_large/i.test(target)) add("Snowflakes_Large");
  if (/snowflake_small/i.test(target)) add("Snowflakes_Small");
  if (/^snowflake_large-(03|04)$/i.test(target) || /^snowflake_small-(01|04|05)$/i.test(target)) add("Snowflakes_Even");
  if (/^snowflake_large-(01|02|05)$/i.test(target) || /^snowflake_small-(02|03)$/i.test(target)) add("Snowflakes_Odd");
  if (/^candycane-/i.test(target)) add("CandyCanes");
  if (/^minicane-/i.test(target)) add("MiniCanes");
  if (/^present-/i.test(target)) add("Presents");
  if (/^uppergutter-/i.test(target)) add("UpperGutters");
  if (/gutter/i.test(target)) add("Gutters");
  if (/gutter/i.test(target)) add("Outlines");
  if (/garland/i.test(target)) add("Garland");
  if (/garland/i.test(target)) add("Outlines");
  if (/icicles/i.test(target)) add("Eaves");
  if (/icicles/i.test(target)) add("FrontHouse");
  if (/^wreath-|^miniwreath-/i.test(target)) add("Wreathes");
  if (/^wreath-|^miniwreath-/i.test(target)) add("Wreathes_All");
  if (/^wreath-|^miniwreath-/i.test(target)) add("FrontHouse");
  if (/^shrub-/i.test(target)) add("Shrubs");
  if (/^shrub-/i.test(target)) add("FrontHouse");
  if (/^spinner-/i.test(target)) add("Spinners");
  if (/^spinner-|^spiraltree|^snowball|^snowman|^present-/i.test(target)) add("FrontProps");
  if (/^northpole|^np-/i.test(target)) add("NorthPoleSign");
  const assignment = arr(metadataAssignments).find((row) => str(row?.targetId).toLowerCase() === target.toLowerCase());
  if (assignment) {
    for (const tag of arr(assignment?.tags)) add(tag);
    for (const hint of arr(assignment?.semanticHints)) add(hint);
    for (const definition of arr(assignment?.visualHintDefinitions)) add(definition?.name);
  }
  return aliases;
}

function buildObservedTargetAliasSet({ observedTargetIds = [], metadataAssignments = [] } = {}) {
  const aliases = new Set();
  const observedIds = uniqueStrings(observedTargetIds);
  for (const targetId of observedIds) {
    for (const alias of aliasesForObservedTarget(targetId, metadataAssignments)) aliases.add(alias);
  }
  if (observedIds.length) {
    aliases.add("allmodels");
    aliases.add("allmodels_nomatrix");
    aliases.add("allmodels_nomatrix_floods");
    aliases.add("allmodels_nofloods");
  }
  return aliases;
}

function targetAliasObserved(targetId = "", aliasSet = new Set()) {
  const text = str(targetId);
  return aliasSet.has(text.toLowerCase()) || aliasSet.has(text);
}

function compareCompositionToRender({
  compositionExpectation = null,
  observed = {},
  windowComparisons = [],
  metadataAssignments = []
} = {}) {
  const expected = compositionExpectation && typeof compositionExpectation === "object" ? compositionExpectation : null;
  if (!expected) {
    return {
      available: false,
      observedCompositionFocusTargets: [],
      missingCompositionFocusTargets: [],
      observedCompositionSupportTargets: [],
      missingCompositionSupportTargets: [],
      observedCompositionAccentTargets: [],
      missingCompositionAccentTargets: [],
      observedCompositionLayerStackTargets: [],
      missingCompositionLayerStackTargets: [],
      weakCompositionLayerStackTargets: [],
      underusedCompositionRegions: [],
      overusedCompositionTargets: [],
      dominantUnplannedTargets: [],
      sectionTransitionsTooSimilar: [],
      nextPassChangeBias: [],
      expectedProgressionIntents: [],
      renderProgressionTooFlat: false,
      renderSpatialBalanceMismatch: false
    };
  }
  const observedSet = new Set(uniqueStrings(observed.activeModelNames));
  const observedAliasSet = buildObservedTargetAliasSet({
    observedTargetIds: observed.activeModelNames,
    metadataAssignments
  });
  const focalTargets = uniqueStrings(arr(expected.sections).flatMap((row) => row.focalRegion));
  const supportTargets = uniqueStrings(arr(expected.sections).flatMap((row) => row.supportRegion));
  const accentTargets = uniqueStrings(arr(expected.sections).flatMap((row) => row.accentRegion));
  const backgroundTargets = uniqueStrings(arr(expected.sections).flatMap((row) => row.backgroundRegion));
  const layerStackTargets = uniqueStrings([
    ...arr(expected.sections).flatMap((row) => row.layerStackTargets),
    ...arr(expected.targetRoles?.layeredTargets)
  ]);
  const expectedProgressionIntents = uniqueStrings(arr(expected.sections).map((row) => row.progressionIntent));
  const expectedBroad = arr(expected.sections).some((row) => str(row?.expectedBalance?.spatialBreadth).includes("broad"));
  const renderProgressionTooFlat =
    expectedProgressionIntents.length >= 3 &&
    Number(observed.activeModelVariation || 0) <= 1 &&
    Number(observed.energyVariation || 0) < 0.08 &&
    arr(windowComparisons).some((row) => row?.windowsReadSimilarly);
  const expectedTargets = new Set(uniqueStrings([
    ...focalTargets,
    ...supportTargets,
    ...accentTargets,
    ...backgroundTargets,
    ...layerStackTargets,
    ...arr(expected.targetRoles?.activeTargets)
  ]).map((row) => row.toLowerCase()));
  const overusedCompositionTargets = uniqueStrings(observed.activeModelNames)
    .filter((targetId) => ![...aliasesForObservedTarget(targetId, metadataAssignments)].some((alias) => expectedTargets.has(alias)));
  const dominantUnplannedTargets = overusedCompositionTargets.filter((targetId) => targetId === str(observed.leadModel) && Number(observed.leadModelShare || 0) >= 0.4);
  const missingFocusTargets = focalTargets.filter((targetId) => !targetAliasObserved(targetId, observedAliasSet));
  const missingSupportTargets = supportTargets.filter((targetId) => !targetAliasObserved(targetId, observedAliasSet));
  const missingAccentTargets = accentTargets.filter((targetId) => !targetAliasObserved(targetId, observedAliasSet));
  const missingLayerStackTargets = layerStackTargets.filter((targetId) => !targetAliasObserved(targetId, observedAliasSet));
  const weakLayerStackTargets = layerStackTargets
    .filter((targetId) => targetAliasObserved(targetId, observedAliasSet))
    .filter(() => str(observed.temporalRead).toLowerCase() === "flat" || Number(observed.energyVariation || 0) < 0.08);
  const sectionTransitionsTooSimilar = arr(windowComparisons)
    .filter((row) => row?.windowsReadSimilarly)
    .map((row) => ({
      fromLabel: str(row?.fromLabel),
      toLabel: str(row?.toLabel),
      overlapRatio: Number(row?.overlapRatio || 0)
    }));
  const underusedCompositionRegions = [
    missingFocusTargets.length ? "focal" : "",
    missingSupportTargets.length ? "support" : "",
    missingAccentTargets.length ? "accent" : "",
    missingLayerStackTargets.length ? "layer_stack" : ""
  ].filter(Boolean);
  const nextPassChangeBias = uniqueStrings([
    missingFocusTargets.length ? "add_or_strengthen_missing_focal_targets" : "",
    missingSupportTargets.length || missingAccentTargets.length ? "rebalance_underused_support_or_accent_regions" : "",
    missingLayerStackTargets.length || weakLayerStackTargets.length ? "increase_layer_stack_observable_difference" : "",
    sectionTransitionsTooSimilar.length ? "differentiate_adjacent_section_transitions" : "",
    dominantUnplannedTargets.length ? "reduce_unplanned_dominant_targets" : "",
    expectedBroad && Number(observed.activeCoverageRatio || 0) < 0.12 ? "widen_spatial_coverage" : ""
  ]);
  return {
    available: true,
    observedCompositionFocusTargets: focalTargets.filter((targetId) => targetAliasObserved(targetId, observedAliasSet)),
    missingCompositionFocusTargets: missingFocusTargets,
    observedCompositionSupportTargets: supportTargets.filter((targetId) => targetAliasObserved(targetId, observedAliasSet)),
    missingCompositionSupportTargets: missingSupportTargets,
    observedCompositionAccentTargets: accentTargets.filter((targetId) => targetAliasObserved(targetId, observedAliasSet)),
    missingCompositionAccentTargets: missingAccentTargets,
    observedCompositionLayerStackTargets: layerStackTargets.filter((targetId) => targetAliasObserved(targetId, observedAliasSet)),
    missingCompositionLayerStackTargets: missingLayerStackTargets,
    weakCompositionLayerStackTargets: weakLayerStackTargets,
    underusedCompositionRegions,
    overusedCompositionTargets,
    dominantUnplannedTargets,
    sectionTransitionsTooSimilar,
    nextPassChangeBias,
    expectedProgressionIntents,
    renderProgressionTooFlat,
    renderSpatialBalanceMismatch: expectedBroad && Number(observed.activeCoverageRatio || 0) < 0.12
  };
}

function buildRenderQualityAssessment({
  observed = {},
  comparison = {},
  windowComparisons = [],
  compositionComparison = null,
  practicalValidation = null
} = {}) {
  const issues = [];
  let issuePenaltyScore = 1;
  const activeCoverageRatio = Number(observed.activeCoverageRatio || 0);
  const coverageGapCount = Number(observed.coverageGapCount || 0);
  const distinctLeadModelCount = Number(observed.distinctLeadModelCount || 0);
  const activeModelVariation = Number(observed.activeModelVariation || 0);
  const energyVariation = Number(observed.energyVariation || 0);
  const activeModelCount = arr(observed.activeModelNames).length;
  const similarWindowCount = arr(windowComparisons).filter((row) => row?.windowsReadSimilarly).length;

  if (activeCoverageRatio < 0.08 && !comparison.localizedFocusExpected) {
    issuePenaltyScore -= 0.28;
    issues.push("display_coverage_too_sparse");
  } else if (activeCoverageRatio < 0.05) {
    issuePenaltyScore -= 0.18;
    issues.push("very_low_observed_coverage");
  }
  if (coverageGapCount >= 3 && !comparison.localizedFocusExpected) {
    issuePenaltyScore -= 0.18;
    issues.push("large_display_regions_unused");
  } else if (coverageGapCount >= 3) {
    issuePenaltyScore -= 0.1;
    issues.push("coverage_gaps_present");
  }
  if (comparison.leadMatchesPrimaryFocus === false && arr(comparison.missingPrimaryFocusTargets).length) {
    issuePenaltyScore -= 0.16;
    issues.push("design_focus_not_observed");
  }
  if (comparison.leadIsKnownFocalCandidate === false && str(observed.leadModel)) {
    issuePenaltyScore -= 0.08;
    issues.push("lead_model_not_expected_focal_candidate");
  }
  if (comparison.renderIsLeftRightImbalanced) {
    issuePenaltyScore -= 0.08;
    issues.push("left_right_imbalance");
  }
  if (comparison.renderIsTopBottomImbalanced) {
    issuePenaltyScore -= 0.08;
    issues.push("top_bottom_imbalance");
  }
  if (similarWindowCount >= 1) {
    issuePenaltyScore -= Math.min(0.16, similarWindowCount * 0.08);
    issues.push("adjacent_sections_read_too_similarly");
  }
  if (distinctLeadModelCount <= 1 && activeModelCount >= 6) {
    issuePenaltyScore -= 0.08;
    issues.push("lead_focus_does_not_progress");
  }
  if (activeModelVariation <= 1 && energyVariation < 0.08 && activeModelCount >= 6) {
    issuePenaltyScore -= 0.1;
    issues.push("weak_temporal_progression");
  }
  if (compositionComparison?.available && arr(compositionComparison.missingCompositionFocusTargets).length) {
    issuePenaltyScore -= 0.1;
    issues.push("composition_focus_not_observed");
  }
  if (compositionComparison?.renderSpatialBalanceMismatch) {
    issuePenaltyScore -= 0.08;
    issues.push("composition_spatial_breadth_not_observed");
  }
  if (compositionComparison?.renderProgressionTooFlat) {
    issuePenaltyScore -= 0.08;
    issues.push("composition_progression_too_flat");
  }
  if (compositionComparison?.available && arr(compositionComparison.underusedCompositionRegions).length) {
    issuePenaltyScore -= 0.06;
    issues.push("composition_regions_underused");
  }
  if (compositionComparison?.available && arr(compositionComparison.weakCompositionLayerStackTargets).length) {
    issuePenaltyScore -= 0.06;
    issues.push("composition_layer_stack_not_observable");
  }
  if (compositionComparison?.available && arr(compositionComparison.dominantUnplannedTargets).length) {
    issuePenaltyScore -= 0.06;
    issues.push("composition_unplanned_target_dominates");
  }

  const uniqueIssues = uniqueStrings(issues);
  const broadCoverageExpectedForScore = Boolean(comparison.broadCoverageExpected || compositionComparison?.renderSpatialBalanceMismatch);
  const localizedFocusExpectedForScore = Boolean(comparison.localizedFocusExpected && !broadCoverageExpectedForScore);
  const coverageScore = clamp01(
    (localizedFocusExpectedForScore ? 0.75 : scoreFromThreshold(activeCoverageRatio, broadCoverageExpectedForScore ? 0.32 : 0.18, 0.04)) -
    (localizedFocusExpectedForScore ? Math.min(0.2, coverageGapCount * 0.03) : Math.min(0.45, coverageGapCount * 0.09))
  );
  const designIntentScore = clamp01(
    1 -
    issuePenalty(uniqueIssues, {
      design_focus_not_observed: 0.42,
      lead_model_not_expected_focal_candidate: 0.18
    })
  );
  const spatialBalanceScore = clamp01(
    1 -
    Math.min(0.45, Number(observed.leftRightBalanceRatio || 0)) -
    Math.min(0.45, Number(observed.topBottomBalanceRatio || 0)) -
    (compositionComparison?.renderSpatialBalanceMismatch ? 0.1 : 0)
  );
  const motionProgressionScore = clamp01(
    Math.max(
      scoreFromThreshold(energyVariation, 0.35, 0.02),
      scoreFromThreshold(activeModelVariation, 8, 0) * 0.8,
      scoreFromThreshold(distinctLeadModelCount, 4, 1)
    ) -
    (similarWindowCount ? Math.min(0.24, similarWindowCount * 0.08) : 0) -
    (compositionComparison?.renderProgressionTooFlat ? 0.18 : 0)
  );
  const compositionScore = compositionComparison?.available
    ? clamp01(
        1 -
        Math.min(0.45, arr(compositionComparison.missingCompositionFocusTargets).length * 0.18) -
        Math.min(0.24, arr(compositionComparison.underusedCompositionRegions).length * 0.08) -
        Math.min(0.18, arr(compositionComparison.weakCompositionLayerStackTargets).length * 0.06) -
        Math.min(0.18, arr(compositionComparison.dominantUnplannedTargets).length * 0.09) -
        Math.min(0.18, arr(compositionComparison.sectionTransitionsTooSimilar).length * 0.06)
      )
    : null;
  const payloadSummary = practicalValidation?.summary?.effectPayloadChecks || practicalValidation?.effectPayloadChecks || null;
  const effectConfigurationScore = payloadMatchRatio(payloadSummary, "settings");
  const paletteScore = payloadMatchRatio(payloadSummary, "palette");
  const sectionContrastScore = clamp01(1 - Math.min(0.4, similarWindowCount * 0.16));
  const dimensions = {
    coverageScore: Number(coverageScore.toFixed(3)),
    designIntentScore: Number(designIntentScore.toFixed(3)),
    compositionScore: compositionScore == null ? null : Number(compositionScore.toFixed(3)),
    spatialBalanceScore: Number(spatialBalanceScore.toFixed(3)),
    motionProgressionScore: Number(motionProgressionScore.toFixed(3)),
    sectionContrastScore: Number(sectionContrastScore.toFixed(3)),
    effectConfigurationScore,
    paletteScore
  };
  const weightedDimensions = [
    [coverageScore, 0.16],
    [designIntentScore, 0.16],
    [compositionScore == null ? 0.65 : compositionScore, 0.18],
    [spatialBalanceScore, 0.1],
    [motionProgressionScore, 0.12],
    [sectionContrastScore, 0.06],
    [effectConfigurationScore == null ? 0.65 : effectConfigurationScore, 0.09],
    [paletteScore == null ? 0.65 : paletteScore, 0.08],
    [clamp01(issuePenaltyScore), 0.05]
  ];
  const weightedScore = weightedDimensions.reduce((sum, [value, weight]) => sum + (Number(value || 0) * weight), 0);
  const overallScore = Number(clamp01(weightedScore).toFixed(3));
  return {
    overallScore,
    legacyIssuePenaltyScore: Number(clamp01(issuePenaltyScore).toFixed(3)),
    band: scoreBand(overallScore),
    dimensions,
    dimensionBands: Object.fromEntries(
      Object.entries(dimensions).map(([key, value]) => [key, value == null ? "unmeasured" : scoreBand(value)])
    ),
    issues: uniqueIssues,
    basis: {
      activeCoverageRatio,
      coverageGapCount,
      distinctLeadModelCount,
      activeModelVariation,
      energyVariation,
      similarWindowCount,
      activeModelCount,
      compositionFocusMissingCount: arr(compositionComparison?.missingCompositionFocusTargets).length,
      compositionUnderusedRegionCount: arr(compositionComparison?.underusedCompositionRegions).length,
      compositionWeakLayerStackCount: arr(compositionComparison?.weakCompositionLayerStackTargets).length,
      effectPayloadChecks: Number(payloadSummary?.effectPayloadChecks || 0),
      settingsChecked: Number(payloadSummary?.settingsChecked || 0),
      settingsMatched: Number(payloadSummary?.settingsMatched || 0),
      paletteChecked: Number(payloadSummary?.paletteChecked || 0),
      paletteMatched: Number(payloadSummary?.paletteMatched || 0)
    }
  };
}

export function buildRenderCritiqueContext({
  renderObservation = null,
  designSceneContext = null,
  sequencingDesignHandoff = null,
  compositionPlan = null,
  musicDesignContext = null,
  metadataAssignments = [],
  practicalValidation = null
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
  const primaryFocusLowerSet = new Set(primaryFocusTargetIds.map((targetId) => targetId.toLowerCase()));
  const focalCandidateLowerSet = new Set(uniqueStrings(scene?.focalCandidates).map((targetId) => targetId.toLowerCase()));
  const observedModelSet = new Set(observedActiveModels);
  const observedAliasSet = buildObservedTargetAliasSet({
    observedTargetIds: observedActiveModels,
    metadataAssignments
  });
  const leadAliases = aliasesForObservedTarget(observedLeadModel, metadataAssignments);

  const observedFocusTargets = primaryFocusTargetIds.filter((targetId) =>
    observedModelSet.has(targetId) || targetAliasObserved(targetId, observedAliasSet)
  );
  const missingPrimaryFocusTargets = primaryFocusTargetIds.filter((targetId) =>
    !observedModelSet.has(targetId) && !targetAliasObserved(targetId, observedAliasSet)
  );
  const leadMatchesPrimaryFocus = Boolean(
    observedLeadModel &&
    (primaryFocusSet.has(observedLeadModel) || [...leadAliases].some((alias) => primaryFocusLowerSet.has(alias.toLowerCase())))
  );
  const leadIsKnownFocalCandidate = Boolean(
    observedLeadModel &&
    (leadMatchesPrimaryFocus ||
      focalCandidateSet.has(observedLeadModel) ||
      [...leadAliases].some((alias) => focalCandidateLowerSet.has(alias.toLowerCase())))
  );
  const broadCoverageDomains = uniqueStrings(scene?.coverageDomains?.broad);
  const detailCoverageDomains = uniqueStrings(scene?.coverageDomains?.detail);
  const spreadRatio = Number(macro.meanSceneSpreadRatio || 0);
  const windowComparisons = buildWindowComparisons(observation?.windows);
  const drilldownTargetEvidence = deriveDrilldownTargetEvidence(observation?.windows, windowComparisons);
  const drilldownTargetIds = uniqueStrings(drilldownTargetEvidence.map((row) => row.targetId));
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
  const requestedScope = inferRequestedScopeMeta(handoff);
  const narrowRequestScope = ["target_refinement", "section_target_refinement"].includes(requestedScope.mode);
  const problematicGapsExpected =
    !localizedFocusExpected &&
    !narrowRequestScope &&
    (broadCoverageExpected || !restrainedCoverageExpected);

  const expected = {
    primaryFocusTargetIds,
    supportTargetIds,
    preferredVisualFamilies,
    broadCoverageDomains,
    detailCoverageDomains,
    designSummary: str(handoff?.designSummary),
    requestedScope,
    musicSections: toExpectedMusicSections(musicExpectation.matchedSections),
    musicEnergyRead: musicExpectation.highestEnergy,
    musicDensityRead: musicExpectation.densityBias,
    effectPayloadChecks: practicalValidation?.summary?.effectPayloadChecks || practicalValidation?.effectPayloadChecks || null
  };
  const observed = {
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
  };
  const compositionExpectation = buildCompositionExpectation(compositionPlan);
  const compositionComparison = compareCompositionToRender({
    compositionExpectation,
    observed,
    windowComparisons,
    metadataAssignments
  });
  const comparison = {
    observedFocusTargets,
    missingPrimaryFocusTargets,
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
    renderHasProblematicGaps: problematicGapsExpected && Number(macro.coverageGapCount || 0) >= 2,
    renderIsLeftRightImbalanced: Number(macro.leftRightBalanceRatio || 0) >= 0.35,
    renderIsTopBottomImbalanced: Number(macro.topBottomBalanceRatio || 0) >= 0.35,
    adjacentWindowComparisons: windowComparisons,
    drilldownTargetIds,
    drilldownTargetEvidence,
    composition: compositionComparison
  };

  return finalizeArtifact({
    artifactType: "sequence_render_critique_context_v1",
    artifactVersion: "1.0",
    source: {
      renderObservationArtifactId: str(observation?.artifactId),
      designSceneContextArtifactId: str(scene?.artifactId),
      sequencingDesignHandoffArtifactId: str(handoff?.artifactId),
      compositionPlanArtifactType: str(compositionExpectation?.artifactType),
      musicDesignContextArtifactId: str(musicDesignContext?.artifactId),
      samplingDetail: str(source?.samplingDetail)
    },
    expected: {
      ...expected,
      composition: compositionExpectation
    },
    observed,
    comparison,
    quality: buildRenderQualityAssessment({ observed, comparison, windowComparisons, compositionComparison, practicalValidation })
  });
}
