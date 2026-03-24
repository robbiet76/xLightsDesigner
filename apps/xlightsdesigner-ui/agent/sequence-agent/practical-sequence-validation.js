import { buildArtifactId } from "../shared/artifact-ids.js";

function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function summarizeChecks(checks = []) {
  const rows = arr(checks);
  return {
    total: rows.length,
    passed: rows.filter((row) => row?.ok === true).length,
    failed: rows.filter((row) => row?.ok === false).length
  };
}

function compactFailures(checks = [], limit = 8) {
  return arr(checks)
    .filter((row) => row?.ok === false)
    .map((row) => ({
      kind: str(row?.kind),
      target: str(row?.target),
      detail: str(row?.detail)
    }))
    .filter((row) => row.kind || row.target || row.detail)
    .slice(0, limit);
}

function buildMetadataAssignmentIndex(metadataAssignments = []) {
  const out = new Map();
  for (const assignment of arr(metadataAssignments)) {
    const targetId = str(assignment?.targetId);
    if (!targetId) continue;
    out.set(targetId, assignment);
  }
  return out;
}

function summarizePlanQuality(planHandoff = null) {
  const commands = arr(planHandoff?.commands);
  const effectCommands = commands.filter((row) => str(row?.cmd) === "effects.create");
  const aggregatePattern = /(^|\/)(allmodels|allmodels_|.*_all$|.*_nofloods$|.*_nomatrix$|fronthouse$|frontprops$)/i;
  const durationMs = Number(planHandoff?.metadata?.sequenceSettings?.durationMs);
  const windows = effectCommands
    .map((row) => ({
      startMs: Number(row?.params?.startMs),
      endMs: Number(row?.params?.endMs),
      effectName: str(row?.params?.effectName),
      target: str(row?.params?.modelName)
    }))
    .filter((row) => Number.isFinite(row.startMs) && Number.isFinite(row.endMs) && row.endMs > row.startMs);
  const sortedWindows = windows
    .map((row) => ({ ...row }))
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
  const merged = [];
  for (const window of sortedWindows) {
    const last = merged[merged.length - 1];
    if (!last || window.startMs > last.endMs) {
      merged.push({ startMs: window.startMs, endMs: window.endMs });
      continue;
    }
    last.endMs = Math.max(last.endMs, window.endMs);
  }
  const coveredMs = merged.reduce((sum, row) => sum + Math.max(0, row.endMs - row.startMs), 0);
  const effectCounts = new Map();
  for (const row of windows) {
    const key = row.effectName.toLowerCase();
    effectCounts.set(key, (effectCounts.get(key) || 0) + 1);
  }
  const uniqueEffects = Array.from(new Set(windows.map((row) => row.effectName).filter(Boolean)));
  const dominantEffectCount = effectCounts.size ? Math.max(...effectCounts.values()) : 0;
  const sectionPlans = arr(planHandoff?.metadata?.sectionPlans);
  const effectPlacements = arr(planHandoff?.metadata?.effectPlacements);
  const sectionLabels = sectionPlans.map((row) => str(row?.section)).filter(Boolean);
  const perSectionCounts = new Map(sectionLabels.map((label) => [label, 0]));
  for (const placement of effectPlacements) {
    const section = str(placement?.sourceSectionLabel || placement?.section);
    if (!section) continue;
    perSectionCounts.set(section, (perSectionCounts.get(section) || 0) + 1);
  }
  const emptySections = Array.from(perSectionCounts.entries())
    .filter(([, count]) => Number(count || 0) === 0)
    .map(([label]) => label);
  const sectionEffectPatterns = new Map();
  for (const placement of effectPlacements) {
    const section = str(placement?.sourceSectionLabel || placement?.section);
    const effectName = str(placement?.effectName);
    if (!section || !effectName) continue;
    if (!sectionEffectPatterns.has(section)) sectionEffectPatterns.set(section, []);
    sectionEffectPatterns.get(section).push(effectName);
  }
  const repeatedSectionPatterns = new Map();
  for (const [section, effectNames] of sectionEffectPatterns.entries()) {
    const patternKey = uniqueStrings(effectNames).slice(0, 2).map((row) => row.toLowerCase()).join("|");
    if (!patternKey) continue;
    if (!repeatedSectionPatterns.has(patternKey)) repeatedSectionPatterns.set(patternKey, []);
    repeatedSectionPatterns.get(patternKey).push(section);
  }
  const repeatedSectionEffectPatterns = Array.from(repeatedSectionPatterns.entries())
    .filter(([, sections]) => arr(sections).length >= 3)
    .map(([pattern, sections]) => ({ pattern, sections }));
  const aggregateTargetCommands = windows.filter((row) => aggregatePattern.test(row.target));
  const aggregateTargetShare = windows.length > 0 ? aggregateTargetCommands.length / windows.length : 0;
  const coverageRatio = durationMs > 0 ? coveredMs / durationMs : 0;
  const dominantEffectShare = windows.length > 0 ? dominantEffectCount / windows.length : 0;
  const floatingBoundaryCommands = effectCommands
    .map((row) => ({
      target: str(row?.params?.modelName),
      effectName: str(row?.params?.effectName),
      basis: str(row?.anchor?.basis)
    }))
    .filter((row) => ["within_section", "explicit_window"].includes(row.basis));
  return {
    effectCommandCount: effectCommands.length,
    distinctEffectCount: uniqueEffects.length,
    distinctEffects: uniqueEffects,
    timelineCoverageRatio: coverageRatio,
    dominantEffectShare,
    aggregateTargetShare,
    perSectionPlacementCounts: Object.fromEntries(perSectionCounts),
    emptySections,
    repeatedSectionEffectPatterns,
    floatingBoundaryCount: floatingBoundaryCommands.length,
    floatingBoundaryCommands,
    targetCount: Array.from(new Set(windows.map((row) => row.target).filter(Boolean))).length
  };
}

function summarizeObservedTargetMetadata(observedTargets = [], metadataAssignments = []) {
  const targetIds = Array.from(new Set(arr(observedTargets).map((row) => str(row)).filter(Boolean)));
  const assignmentIndex = buildMetadataAssignmentIndex(metadataAssignments);
  const missingMetadataTargetIds = [];
  const roleOnlyTargetIds = [];
  const definedVisualHintTargetIds = [];
  const pendingVisualHintTargetIds = [];
  const pendingOnlyVisualHintTargetIds = [];

  for (const targetId of targetIds) {
    const assignment = assignmentIndex.get(targetId);
    if (!assignment) {
      missingMetadataTargetIds.push(targetId);
      continue;
    }

    const rolePreference = str(assignment?.rolePreference);
    const semanticHints = arr(assignment?.semanticHints).map((row) => str(row)).filter(Boolean);
    const effectAvoidances = arr(assignment?.effectAvoidances).map((row) => str(row)).filter(Boolean);
    const visualHintDefinitions = arr(assignment?.visualHintDefinitions).filter((row) => row && typeof row === "object");
    const definedDefinitions = visualHintDefinitions.filter((row) => str(row?.status).toLowerCase() === "defined");
    const pendingDefinitions = visualHintDefinitions.filter((row) => str(row?.status).toLowerCase() === "pending_definition");

    if (definedDefinitions.length) definedVisualHintTargetIds.push(targetId);
    if (pendingDefinitions.length) pendingVisualHintTargetIds.push(targetId);
    if (pendingDefinitions.length && !definedDefinitions.length) pendingOnlyVisualHintTargetIds.push(targetId);
    if (rolePreference && !semanticHints.length && !effectAvoidances.length && !visualHintDefinitions.length) {
      roleOnlyTargetIds.push(targetId);
    }
  }

  return {
    observedTargetCount: targetIds.length,
    missingMetadataTargetIds,
    roleOnlyTargetIds,
    definedVisualHintTargetIds,
    pendingVisualHintTargetIds,
    pendingOnlyVisualHintTargetIds,
    counts: {
      missingMetadata: missingMetadataTargetIds.length,
      roleOnly: roleOnlyTargetIds.length,
      definedVisualHints: definedVisualHintTargetIds.length,
      pendingVisualHints: pendingVisualHintTargetIds.length,
      pendingOnlyVisualHints: pendingOnlyVisualHintTargetIds.length
    }
  };
}

export function buildPracticalSequenceValidation({
  planHandoff = null,
  applyResult = null,
  verification = null
} = {}) {
  const meta = planHandoff?.metadata && typeof planHandoff.metadata === "object" ? planHandoff.metadata : {};
  const designContext = verification?.designContext && typeof verification.designContext === "object"
    ? verification.designContext
    : {};
  const designAlignment = verification?.designAlignment && typeof verification.designAlignment === "object"
    ? verification.designAlignment
    : {};
  const metadataAssignments = arr(meta?.metadataAssignments);
  const readbackChecks = summarizeChecks(verification?.checks);
  const designChecks = summarizeChecks(verification?.designChecks);
  const metadataCoverage = summarizeObservedTargetMetadata(designAlignment?.observedTargets, metadataAssignments);
  const planQuality = summarizePlanQuality(planHandoff);
  const qualityFailures = [];
  if (planQuality.timelineCoverageRatio < 0.55) {
    qualityFailures.push({
      kind: "timeline_coverage",
      target: "sequence",
      detail: `Timeline coverage too low (${planQuality.timelineCoverageRatio.toFixed(3)}).`
    });
  }
  if (planQuality.distinctEffectCount < 5) {
    qualityFailures.push({
      kind: "effect_diversity",
      target: "sequence",
      detail: `Effect diversity too low (${planQuality.distinctEffectCount} distinct effects).`
    });
  }
  if (planQuality.dominantEffectShare > 0.45) {
    qualityFailures.push({
      kind: "effect_monoculture",
      target: "sequence",
      detail: `Dominant effect share too high (${planQuality.dominantEffectShare.toFixed(3)}).`
    });
  }
  if (planQuality.aggregateTargetShare > 0.35) {
    qualityFailures.push({
      kind: "aggregate_target_overuse",
      target: "sequence",
      detail: `Aggregate target share too high (${planQuality.aggregateTargetShare.toFixed(3)}).`
    });
  }
  if (planQuality.repeatedSectionEffectPatterns.length) {
    qualityFailures.push({
      kind: "section_effect_repetition",
      target: "sequence",
      detail: `Section effect patterns repeat too often: ${planQuality.repeatedSectionEffectPatterns.map((row) => `${row.pattern} -> ${row.sections.join(", ")}`).join(" ; ")}`
    });
  }
  if (planQuality.emptySections.length) {
    qualityFailures.push({
      kind: "empty_sections",
      target: "sequence",
      detail: `No placements generated for sections: ${planQuality.emptySections.join(", ")}`
    });
  }
  if (planQuality.floatingBoundaryCount > 0) {
    qualityFailures.push({
      kind: "floating_boundaries",
      target: "sequence",
      detail: `${planQuality.floatingBoundaryCount} effect commands are not anchored to timing marks or aligned effect boundaries.`
    });
  }

  const artifact = {
    artifactType: "practical_sequence_validation_v1",
    artifactVersion: "1.0",
    createdAt: new Date().toISOString(),
    planId: str(planHandoff?.planId),
    applyResultId: str(applyResult?.artifactId),
    status: str(applyResult?.status || "unknown"),
    overallOk: Boolean(
      verification?.revisionAdvanced === true &&
      verification?.expectedMutationsPresent === true &&
      designChecks.failed === 0 &&
      qualityFailures.length === 0
    ),
    designSummary: str(designContext?.designSummary || meta?.sequencingDesignHandoffSummary),
    sectionDirectiveCount: Number(designContext?.sectionDirectiveCount || meta?.sequencingSectionDirectiveCount || 0),
    trainingKnowledge: meta?.trainingKnowledge && typeof meta.trainingKnowledge === "object"
      ? meta.trainingKnowledge
      : (designContext?.trainingKnowledge && typeof designContext.trainingKnowledge === "object" ? designContext.trainingKnowledge : {}),
    summary: {
      revisionAdvanced: verification?.revisionAdvanced === true,
      expectedMutationsPresent: verification?.expectedMutationsPresent === true,
      readbackChecks,
      designChecks,
      metadataCoverage: metadataCoverage.counts,
      planQuality
    },
    designAlignment: {
      primaryFocusTargetIds: arr(designAlignment?.primaryFocusTargetIds),
      coveredPrimaryFocusTargetIds: arr(designAlignment?.coveredPrimaryFocusTargetIds),
      uncoveredPrimaryFocusTargetIds: arr(designAlignment?.uncoveredPrimaryFocusTargetIds),
      preferredVisualFamilies: arr(designAlignment?.preferredVisualFamilies),
      preferredEffectHints: arr(designAlignment?.preferredEffectHints),
      observedTargets: arr(designAlignment?.observedTargets),
      observedEffectNames: arr(designAlignment?.observedEffectNames),
      roleCoverage: arr(designAlignment?.roleCoverage)
    },
    metadataCoverage,
    planQuality,
    failures: {
      readback: compactFailures(verification?.checks),
      design: compactFailures(verification?.designChecks),
      metadata: [
        ...metadataCoverage.missingMetadataTargetIds.map((targetId) => ({
          kind: "missing_metadata",
          target: targetId,
          detail: "Observed target has no metadata assignment."
        })),
        ...metadataCoverage.pendingOnlyVisualHintTargetIds.map((targetId) => ({
          kind: "pending_visual_hint_definition",
          target: targetId,
          detail: "Observed target relies on visual hints that are still pending definition."
        }))
      ],
      quality: qualityFailures
    }
  };

  artifact.artifactId = buildArtifactId(artifact.artifactType, artifact);
  return artifact;
}
