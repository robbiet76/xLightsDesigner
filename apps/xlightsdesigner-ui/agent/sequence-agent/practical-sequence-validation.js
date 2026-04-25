import { buildArtifactId } from "../shared/artifact-ids.js";

function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueStrings(values = []) {
  return [...new Set(arr(values).map((row) => str(row)).filter(Boolean))];
}

function summarizeChecks(checks = []) {
  const rows = arr(checks);
  return {
    total: rows.length,
    passed: rows.filter((row) => row?.ok === true).length,
    failed: rows.filter((row) => row?.ok === false).length
  };
}

function summarizePreservationChecks(checks = []) {
  const rows = arr(checks).filter((row) => str(row?.kind) === "effect-preservation");
  const failedRows = rows.filter((row) => row?.ok === false);
  return {
    total: rows.length,
    passed: rows.filter((row) => row?.ok === true).length,
    failed: failedRows.length,
    failedTargets: failedRows.map((row) => str(row?.target)).filter(Boolean).slice(0, 8)
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

function effectPlanKey(modelName = "", layerIndex = 0, startMs = 0, endMs = 0, effectName = "") {
  return [
    str(modelName),
    Number(layerIndex),
    Number(startMs),
    Number(endMs),
    str(effectName)
  ].join("|");
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
  const executionStrategy = planHandoff?.metadata?.executionStrategy && typeof planHandoff.metadata.executionStrategy === "object"
    ? planHandoff.metadata.executionStrategy
    : {};
  const windows = effectCommands
    .map((row) => ({
      startMs: Number(row?.params?.startMs),
      endMs: Number(row?.params?.endMs),
      effectName: str(row?.params?.effectName),
      target: str(row?.params?.modelName),
      section: str(row?.intent?.section || row?.anchor?.section || row?.anchor?.sectionLabel)
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
  const sectionPlans = arr(planHandoff?.metadata?.sectionPlans).length
    ? arr(planHandoff?.metadata?.sectionPlans)
    : arr(executionStrategy?.sectionPlans);
  const effectPlacements = arr(planHandoff?.metadata?.effectPlacements).length
    ? arr(planHandoff?.metadata?.effectPlacements)
    : arr(executionStrategy?.effectPlacements);
  const designIdToSection = new Map(
    sectionPlans
      .map((row) => [str(row?.designId), str(row?.section)])
      .filter(([designId, section]) => designId && section)
  );
  const placementCount = effectPlacements.length;
  const sectionLabels = uniqueStrings([
    ...sectionPlans.map((row) => str(row?.section)),
    ...effectPlacements.map((row) => str(row?.sourceSectionLabel || row?.section || designIdToSection.get(str(row?.designId)))),
    ...windows.map((row) => str(row?.section))
  ]);
  const perSectionCounts = new Map(sectionLabels.map((label) => [label, 0]));
  for (const placement of effectPlacements) {
    const section = str(placement?.sourceSectionLabel || placement?.section || designIdToSection.get(str(placement?.designId)));
    if (!section) continue;
    perSectionCounts.set(section, (perSectionCounts.get(section) || 0) + 1);
  }
  const emptySections = Array.from(perSectionCounts.entries())
    .filter(([, count]) => Number(count || 0) === 0)
    .map(([label]) => label);
  const sectionEffectPatterns = new Map();
  for (const placement of effectPlacements) {
    const section = str(placement?.sourceSectionLabel || placement?.section || designIdToSection.get(str(placement?.designId)));
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
  const durationMinutes = durationMs > 0 ? durationMs / 60000 : 0;
  const effectCommandsPerMinute = durationMinutes > 0 ? effectCommands.length / durationMinutes : 0;
  const placementsPerSection = sectionLabels.length > 0 ? placementCount / sectionLabels.length : 0;
  const activeTargetCount = Array.from(new Set(windows.map((row) => row.target).filter(Boolean))).length;
  const sectionPlanTargetCount = Array.from(
    new Set(sectionPlans.flatMap((row) => arr(row?.targetIds).map((targetId) => str(targetId)).filter(Boolean)))
  ).length;
  const scopedTargetCount = Math.max(
    1,
    Number(planHandoff?.metadata?.scope?.targetIds?.length || 0),
    Number(planHandoff?.metadata?.targetIds?.length || 0),
    Number(executionStrategy?.targetCount || 0),
    Number(sectionPlanTargetCount || 0),
    activeTargetCount
  );
  const activeTargetRatio = activeTargetCount > 0 ? activeTargetCount / scopedTargetCount : 0;
  const multiLayerTargetCount = Array.from(
    effectCommands.reduce((map, row) => {
      const target = str(row?.params?.modelName);
      const layerIndex = Number(row?.params?.layerIndex);
      if (!target || !Number.isFinite(layerIndex)) return map;
      if (!map.has(target)) map.set(target, new Set());
      map.get(target).add(layerIndex);
      return map;
    }, new Map()).entries()
  ).filter(([, layers]) => layers.size > 1).length;
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
    effectCommandsPerMinute,
    placementsPerSection,
    perSectionPlacementCounts: Object.fromEntries(perSectionCounts),
    emptySections,
    repeatedSectionEffectPatterns,
    floatingBoundaryCount: floatingBoundaryCommands.length,
    floatingBoundaryCommands,
    targetCount: activeTargetCount,
    activeTargetRatio,
    multiLayerTargetCount
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

function buildTimingTrackIndex(commands = []) {
  const tracks = new Map();
  for (const command of arr(commands)) {
    const cmd = str(command?.cmd);
    if (cmd !== "timing.insertMarks" && cmd !== "timing.replaceMarks") continue;
    const trackName = str(command?.params?.trackName);
    if (!trackName) continue;
    const marks = arr(command?.params?.marks)
      .map((row) => ({
        label: str(row?.label),
        startMs: Number(row?.startMs),
        endMs: Number(row?.endMs)
      }))
      .filter((row) => Number.isFinite(row.startMs) && Number.isFinite(row.endMs) && row.endMs > row.startMs)
      .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs || a.label.localeCompare(b.label));
    tracks.set(trackName, marks);
  }
  return tracks;
}

function countOverlappingMarks(marks = [], startMs = 0, endMs = 0, { labeledOnly = false } = {}) {
  return arr(marks).filter((mark) => {
    if (labeledOnly && !str(mark?.label)) return false;
    return Math.max(Number(mark?.startMs || 0), Number(startMs || 0)) < Math.min(Number(mark?.endMs || 0), Number(endMs || 0));
  });
}

function nearlyEqualMs(a, b, toleranceMs = 2) {
  const left = Number(a);
  const right = Number(b);
  return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) <= toleranceMs;
}

function boundaryTouchesTimingMark({ command = {}, timingTracks = new Map() } = {}) {
  const params = command?.params || {};
  const startMs = Number(params?.startMs);
  const endMs = Number(params?.endMs);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return false;
  if (str(command?.anchor?.kind) === "timing_track" && str(command?.anchor?.boundarySide)) return true;
  const anchorTrackName = str(command?.anchor?.trackName);
  const markSets = anchorTrackName && timingTracks.has(anchorTrackName)
    ? [timingTracks.get(anchorTrackName)]
    : Array.from(timingTracks.values());
  return markSets.some((marks) => arr(marks).some((mark) => (
    nearlyEqualMs(startMs, mark?.startMs)
    || nearlyEqualMs(startMs, mark?.endMs)
    || nearlyEqualMs(endMs, mark?.startMs)
    || nearlyEqualMs(endMs, mark?.endMs)
  )));
}

function boundaryTouchesAdjacentEffect({ command = {}, effectCommands = [] } = {}) {
  if (str(command?.anchor?.kind) === "adjacent_effect") return true;
  const params = command?.params || {};
  const target = str(params?.modelName);
  const layerIndex = Number(params?.layerIndex);
  const startMs = Number(params?.startMs);
  const endMs = Number(params?.endMs);
  if (!target || !Number.isFinite(layerIndex) || !Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return false;
  return arr(effectCommands).some((other) => {
    if (other === command) return false;
    const otherParams = other?.params || {};
    if (str(otherParams?.modelName) !== target) return false;
    if (Number(otherParams?.layerIndex) !== layerIndex) return false;
    const otherStart = Number(otherParams?.startMs);
    const otherEnd = Number(otherParams?.endMs);
    if (!Number.isFinite(otherStart) || !Number.isFinite(otherEnd) || otherEnd <= otherStart) return false;
    return nearlyEqualMs(startMs, otherEnd) || nearlyEqualMs(endMs, otherStart);
  });
}

function summarizeTimingFidelity(planHandoff = null) {
  const commands = arr(planHandoff?.commands);
  const timingTracks = buildTimingTrackIndex(commands);
  const structureMarks = timingTracks.get("XD: Song Structure") || [];
  const phraseMarks = timingTracks.get("XD: Phrase Cues") || [];
  const alignCommandsByEffectKey = new Map();
  const sectionTimingTrackNames = new Set();
  for (const command of commands) {
    if (str(command?.cmd) !== "effects.alignToTiming") continue;
    const params = command?.params || {};
    const timingTrackName = str(params?.timingTrackName);
    if (timingTrackName) sectionTimingTrackNames.add(timingTrackName);
    const effectKey = effectPlanKey(
      params?.modelName,
      params?.layerIndex,
      params?.startMs,
      params?.endMs,
      ""
    );
    if (!alignCommandsByEffectKey.has(effectKey)) alignCommandsByEffectKey.set(effectKey, []);
    alignCommandsByEffectKey.get(effectKey).push({
      timingTrackName,
      mode: str(params?.mode)
    });
  }
  for (const command of commands) {
    if (str(command?.cmd) !== "effects.create") continue;
    const anchorTrackName = str(command?.anchor?.trackName);
    if (anchorTrackName) sectionTimingTrackNames.add(anchorTrackName);
  }
  if (!sectionTimingTrackNames.size && structureMarks.length) sectionTimingTrackNames.add("XD: Song Structure");
  const sectionTimingMarks = Array.from(sectionTimingTrackNames)
    .flatMap((trackName) => timingTracks.get(trackName) || []);
  const effectCommands = commands.filter((command) => str(command?.cmd) === "effects.create");
  let withinStructureCount = 0;
  let crossingStructureCount = 0;
  let anchoredToStructureCount = 0;
  let alignedToStructureCount = 0;
  let withinSectionTimingCount = 0;
  let crossingSectionTimingCount = 0;
  let anchoredToSectionTimingCount = 0;
  let alignedToSectionTimingCount = 0;
  let phraseAwareEffectCount = 0;
  let alignedToPhraseCount = 0;
  let timingAwareEffectCount = 0;
  let timingBoundaryAnchoredCount = 0;
  let adjacentEffectAnchoredCount = 0;
  const crossingEffects = [];
  const freeFloatingEffects = [];

  for (const command of effectCommands) {
    const params = command?.params || {};
    const startMs = Number(params?.startMs);
    const endMs = Number(params?.endMs);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) continue;
    const anchorTrackName = str(command?.anchor?.trackName);
    const aligns = alignCommandsByEffectKey.get(effectPlanKey(
      params?.modelName,
      params?.layerIndex,
      params?.startMs,
      params?.endMs,
      ""
    )) || [];
    const overlaps = countOverlappingMarks(structureMarks, startMs, endMs);
    const sectionOverlaps = countOverlappingMarks(sectionTimingMarks, startMs, endMs);
    if (structureMarks.length) {
      if (overlaps.length <= 1) {
        withinStructureCount += 1;
      } else {
        crossingStructureCount += 1;
        crossingEffects.push({
          target: str(params?.modelName),
          effectName: str(params?.effectName),
          startMs,
          endMs
        });
      }
    }
    if (sectionTimingMarks.length) {
      if (sectionOverlaps.length <= 1) {
        withinSectionTimingCount += 1;
      } else {
        crossingSectionTimingCount += 1;
      }
    }
    const anchoredToStructure = anchorTrackName === "XD: Song Structure";
    const alignedToStructure = aligns.some((row) => row.timingTrackName === "XD: Song Structure");
    const anchoredToSectionTiming = sectionTimingTrackNames.has(anchorTrackName);
    const alignedToSectionTiming = aligns.some((row) => sectionTimingTrackNames.has(row.timingTrackName));
    const anchoredToPhrase = anchorTrackName === "XD: Phrase Cues";
    const alignedToPhrase = aligns.some((row) => row.timingTrackName === "XD: Phrase Cues");
    const phraseOverlapCount = countOverlappingMarks(phraseMarks, startMs, endMs, { labeledOnly: true }).length;
    if (anchoredToStructure) anchoredToStructureCount += 1;
    if (alignedToStructure) alignedToStructureCount += 1;
    if (anchoredToSectionTiming) anchoredToSectionTimingCount += 1;
    if (alignedToSectionTiming) alignedToSectionTimingCount += 1;
    if (alignedToPhrase) alignedToPhraseCount += 1;
    if (anchoredToPhrase || alignedToPhrase || phraseOverlapCount > 0) phraseAwareEffectCount += 1;
    if (anchoredToSectionTiming || alignedToSectionTiming || anchoredToPhrase || alignedToPhrase) timingAwareEffectCount += 1;
    const timingBoundaryAnchored = boundaryTouchesTimingMark({ command, timingTracks });
    const adjacentEffectAnchored = boundaryTouchesAdjacentEffect({ command, effectCommands });
    if (timingBoundaryAnchored) timingBoundaryAnchoredCount += 1;
    if (adjacentEffectAnchored) adjacentEffectAnchoredCount += 1;
    if (!timingBoundaryAnchored && !adjacentEffectAnchored) {
      freeFloatingEffects.push({
        target: str(params?.modelName),
        effectName: str(params?.effectName),
        startMs,
        endMs
      });
    }
  }

  return {
    effectCount: effectCommands.length,
    structureTrackPresent: structureMarks.length > 0,
    sectionTimingTrackPresent: sectionTimingMarks.length > 0,
    phraseTrackPresent: phraseMarks.length > 0,
    withinStructureCount,
    crossingStructureCount,
    anchoredToStructureCount,
    alignedToStructureCount,
    withinSectionTimingCount,
    crossingSectionTimingCount,
    anchoredToSectionTimingCount,
    alignedToSectionTimingCount,
    alignedToPhraseCount,
    phraseAwareEffectCount,
    timingAwareEffectCount,
    timingBoundaryAnchoredCount,
    adjacentEffectAnchoredCount,
    freeFloatingEffectCount: freeFloatingEffects.length,
    freeFloatingEffects,
    crossingEffects
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
  const preservationChecks = summarizePreservationChecks(verification?.checks);
  const designChecks = summarizeChecks(verification?.designChecks);
  const metadataCoverage = summarizeObservedTargetMetadata(designAlignment?.observedTargets, metadataAssignments);
  const planQuality = summarizePlanQuality(planHandoff);
  const timingFidelity = summarizeTimingFidelity(planHandoff);
  const qualityFailures = [];
  const timingFailures = [];
  const durationMs = Number(planHandoff?.metadata?.sequenceSettings?.durationMs || 0);
  const sectionCount = arr(planHandoff?.metadata?.sectionPlans).length;
  const passScope = str(planHandoff?.metadata?.executionStrategy?.passScope);
  const isSectionScoped = passScope === "single_section";
  const isWholeSongScale = durationMs >= 120000 || sectionCount >= 8;
  if (timingFidelity.sectionTimingTrackPresent && timingFidelity.crossingSectionTimingCount > 0) {
    timingFailures.push({
      kind: "crosses_section_timing_boundary",
      target: "sequence",
      detail: `${timingFidelity.crossingSectionTimingCount} effect commands cross reviewed timing-section boundaries.`
    });
  }
  if (
    timingFidelity.sectionTimingTrackPresent &&
    timingFidelity.effectCount > 0 &&
    timingFidelity.timingAwareEffectCount === 0
  ) {
    timingFailures.push({
      kind: "timing_ignored",
      target: "sequence",
      detail: "Effect commands did not anchor or align to the reviewed timing context."
    });
  }
  if (timingFidelity.freeFloatingEffectCount > 0) {
    timingFailures.push({
      kind: "free_floating_effect",
      target: "sequence",
      detail: `${timingFidelity.freeFloatingEffectCount} effect commands do not touch a timing mark boundary or adjacent effect boundary.`
    });
  }
  if (!isSectionScoped && planQuality.timelineCoverageRatio < 0.55) {
    qualityFailures.push({
      kind: "timeline_coverage",
      target: "sequence",
      detail: `Timeline coverage too low (${planQuality.timelineCoverageRatio.toFixed(3)}).`
    });
  }
  if (!isSectionScoped && planQuality.distinctEffectCount < 5) {
    qualityFailures.push({
      kind: "effect_diversity",
      target: "sequence",
      detail: `Effect diversity too low (${planQuality.distinctEffectCount} distinct effects).`
    });
  }
  if (!isSectionScoped && planQuality.dominantEffectShare > 0.45) {
    qualityFailures.push({
      kind: "effect_monoculture",
      target: "sequence",
      detail: `Dominant effect share too high (${planQuality.dominantEffectShare.toFixed(3)}).`
    });
  }
  if (!isSectionScoped && planQuality.aggregateTargetShare > 0.35) {
    qualityFailures.push({
      kind: "aggregate_target_overuse",
      target: "sequence",
      detail: `Aggregate target share too high (${planQuality.aggregateTargetShare.toFixed(3)}).`
    });
  }
  if (!isSectionScoped && planQuality.repeatedSectionEffectPatterns.length) {
    qualityFailures.push({
      kind: "section_effect_repetition",
      target: "sequence",
      detail: `Section effect patterns repeat too often: ${planQuality.repeatedSectionEffectPatterns.map((row) => `${row.pattern} -> ${row.sections.join(", ")}`).join(" ; ")}`
    });
  }
  if (!isSectionScoped && planQuality.emptySections.length) {
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
  if (!isSectionScoped && isWholeSongScale && planQuality.effectCommandCount < 200) {
    qualityFailures.push({
      kind: "effect_count_scale",
      target: "sequence",
      detail: `Whole-song effect command count too low (${planQuality.effectCommandCount}).`
    });
  }
  if (!isSectionScoped && isWholeSongScale && planQuality.effectCommandsPerMinute < 45) {
    qualityFailures.push({
      kind: "effect_density_scale",
      target: "sequence",
      detail: `Whole-song effect density too low (${planQuality.effectCommandsPerMinute.toFixed(1)} commands/minute).`
    });
  }
  if (!isSectionScoped && isWholeSongScale && planQuality.targetCount < 18) {
    qualityFailures.push({
      kind: "active_target_scale",
      target: "sequence",
      detail: `Whole-song active target breadth too low (${planQuality.targetCount} active targets).`
    });
  }
  if (!isSectionScoped && isWholeSongScale && planQuality.placementsPerSection < 8) {
    qualityFailures.push({
      kind: "section_density_scale",
      target: "sequence",
      detail: `Whole-song section placement density too low (${planQuality.placementsPerSection.toFixed(1)} placements/section).`
    });
  }
  if (!isSectionScoped && isWholeSongScale && planQuality.multiLayerTargetCount < 6) {
    qualityFailures.push({
      kind: "layer_utilization_scale",
      target: "sequence",
      detail: `Whole-song multi-layer usage too low (${planQuality.multiLayerTargetCount} multi-layer targets).`
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
      timingFailures.length === 0 &&
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
      preservationChecks,
      designChecks,
      metadataCoverage: metadataCoverage.counts,
      planQuality,
      timingFidelity
    },
    designAlignment: {
      primaryFocusTargetIds: arr(designAlignment?.primaryFocusTargetIds),
      coveredPrimaryFocusTargetIds: arr(designAlignment?.coveredPrimaryFocusTargetIds),
      uncoveredPrimaryFocusTargetIds: arr(designAlignment?.uncoveredPrimaryFocusTargetIds),
      preferredVisualFamilies: arr(designAlignment?.preferredVisualFamilies),
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
      timing: timingFailures,
      quality: qualityFailures
    }
  };

  artifact.artifactId = buildArtifactId(artifact.artifactType, artifact);
  return artifact;
}
