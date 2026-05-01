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

function summarizeEffectPayloadChecks(checks = []) {
  const effectRows = arr(checks).filter((row) => str(row?.kind) === "effect");
  const settingsRows = effectRows.filter((row) => Object.prototype.hasOwnProperty.call(row || {}, "settingsMatched"));
  const paletteRows = effectRows.filter((row) => Object.prototype.hasOwnProperty.call(row || {}, "paletteMatched"));
  const countMatched = (rows, fieldName) => rows.filter((row) => row?.[fieldName] === true).length;
  const failedTargets = (rows, fieldName) => rows
    .filter((row) => row?.[fieldName] === false)
    .map((row) => str(row?.target))
    .filter(Boolean)
    .slice(0, 8);
  const settingsMatched = countMatched(settingsRows, "settingsMatched");
  const paletteMatched = countMatched(paletteRows, "paletteMatched");
  return {
    effectPayloadChecks: effectRows.length,
    settingsChecked: settingsRows.length,
    settingsMatched,
    settingsFailed: settingsRows.length - settingsMatched,
    settingsMatchRatio: settingsRows.length ? Number((settingsMatched / settingsRows.length).toFixed(4)) : null,
    settingsFailedTargets: failedTargets(settingsRows, "settingsMatched"),
    paletteChecked: paletteRows.length,
    paletteMatched,
    paletteFailed: paletteRows.length - paletteMatched,
    paletteMatchRatio: paletteRows.length ? Number((paletteMatched / paletteRows.length).toFixed(4)) : null,
    paletteFailedTargets: failedTargets(paletteRows, "paletteMatched")
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

function commandSectionLabel(row = {}) {
  return str(
    row?.intent?.section
    || row?.intent?.sourceSectionLabel
    || row?.anchor?.section
    || row?.anchor?.sectionLabel
    || row?.anchor?.markLabel
  );
}

function placementSectionLabel(row = {}, designIdToSection = new Map()) {
  return str(
    row?.sourceSectionLabel
    || row?.section
    || row?.timingContext?.anchorLabel
    || designIdToSection.get(str(row?.designId))
  );
}

function buildMetadataAssignmentIndex(metadataAssignments = []) {
  const byTargetId = new Map();
  const byMetadataTerm = new Map();
  const addTerm = (term, assignment) => {
    const key = str(term).toLowerCase();
    if (!key) return;
    if (!byMetadataTerm.has(key)) byMetadataTerm.set(key, []);
    byMetadataTerm.get(key).push(assignment);
  };
  for (const assignment of arr(metadataAssignments)) {
    const targetId = str(assignment?.targetId);
    if (!targetId) continue;
    byTargetId.set(targetId, assignment);
    for (const tag of arr(assignment?.tags)) addTerm(tag, assignment);
    for (const hint of arr(assignment?.semanticHints)) addTerm(hint, assignment);
    for (const definition of arr(assignment?.visualHintDefinitions)) addTerm(definition?.name, assignment);
  }
  return { byTargetId, byMetadataTerm };
}

function mergeMetadataAssignments(assignments = [], targetId = "") {
  const rows = arr(assignments).filter(Boolean);
  if (!rows.length) return null;
  return {
    targetId: str(targetId),
    tags: uniqueStrings(rows.flatMap((row) => arr(row?.tags))),
    semanticHints: uniqueStrings(rows.flatMap((row) => arr(row?.semanticHints))),
    effectAvoidances: uniqueStrings(rows.flatMap((row) => arr(row?.effectAvoidances))),
    rolePreference: uniqueStrings(rows.map((row) => str(row?.rolePreference))).join(", "),
    visualHintDefinitions: rows.flatMap((row) => arr(row?.visualHintDefinitions).filter((definition) => definition && typeof definition === "object")),
    source: "xlightsdesigner_project_display_metadata_term_match"
  };
}

function resolveObservedTargetMetadata(targetId = "", assignmentIndex = {}) {
  const id = str(targetId);
  if (!id) return null;
  const direct = assignmentIndex.byTargetId?.get(id);
  if (direct) return direct;
  const termMatches = assignmentIndex.byMetadataTerm?.get(id.toLowerCase());
  return mergeMetadataAssignments(termMatches, id);
}

function inferXlightsStructuralMetadata(targetId = "", placementIntent = null) {
  const id = str(targetId);
  const lower = id.toLowerCase();
  const roleText = [
    ...arr(placementIntent?.targetRoles),
    ...arr(placementIntent?.compositionRoles),
    ...arr(placementIntent?.targetGranularities)
  ].join(" ").toLowerCase();
  const structural = [];
  if (/^allmodels/.test(lower)) structural.push("whole display group", "broad coverage scaffold");
  if (/fronthouse|frontprops/.test(lower)) structural.push("front display region", "broad support group");
  if (/border|outline/.test(lower)) structural.push("outline geometry", "display frame support");
  if (/gutter|eave/.test(lower)) structural.push("roofline geometry", "upper/lower house outline support");
  if (/^flood_front/.test(lower)) structural.push("front wash fixture", "atmosphere support");
  if (!structural.length) return null;
  const supportOnly = !roleText || /\b(group|target|foundation|support|background|texture)\b/.test(roleText);
  if (!supportOnly) return null;
  return {
    targetId: id,
    tags: uniqueStrings(["xLights structural layout", ...structural]),
    semanticHints: uniqueStrings(structural),
    visualHintDefinitions: [],
    effectAvoidances: [],
    rolePreference: /allmodels|fronthouse|frontprops/.test(lower) ? "foundation" : "support",
    source: "xlights_layout_structural_metadata"
  };
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
      section: commandSectionLabel(row)
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
    ...effectPlacements.map((row) => placementSectionLabel(row, designIdToSection)),
    ...windows.map((row) => str(row?.section))
  ]);
  const perSectionCounts = new Map(sectionLabels.map((label) => [label, 0]));
  for (const placement of effectPlacements) {
    const section = placementSectionLabel(placement, designIdToSection);
    if (!section) continue;
    perSectionCounts.set(section, (perSectionCounts.get(section) || 0) + 1);
  }
  const emptySections = Array.from(perSectionCounts.entries())
    .filter(([, count]) => Number(count || 0) === 0)
    .map(([label]) => label);
  const sectionEffectPatterns = new Map();
  for (const placement of effectPlacements) {
    const section = placementSectionLabel(placement, designIdToSection);
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
  const effectUsageQuality = summarizeEffectUsageQuality(effectCommands);
  const trainingUsageTrace = summarizeTrainingUsageTrace(effectCommands);
  const compositionTrainingTrace = summarizeCompositionTrainingTrace(effectCommands);
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
    multiLayerTargetCount,
    effectUsageQuality,
    trainingUsageTrace,
    compositionTrainingTrace
  };
}

function settingsSignature(command = {}) {
  const settings = command?.params?.settings && typeof command.params.settings === "object"
    ? command.params.settings
    : {};
  const sortedSettings = Object.fromEntries(Object.entries(settings).sort(([a], [b]) => a.localeCompare(b)));
  return JSON.stringify({
    effectName: str(command?.params?.effectName),
    settings: sortedSettings
  });
}

function commandSettingKeys(command = {}) {
  const settings = command?.params?.settings && typeof command.params.settings === "object"
    ? command.params.settings
    : {};
  return Object.keys(settings)
    .filter((key) => !/^T_|^B_/.test(key))
    .sort((a, b) => a.localeCompare(b));
}

function commandPaletteKeys(command = {}) {
  const settings = command?.params?.settings && typeof command.params.settings === "object"
    ? command.params.settings
    : {};
  const palette = command?.params?.palette && typeof command.params.palette === "object"
    ? command.params.palette
    : {};
  return uniqueStrings([
    ...Object.keys(settings).filter((key) => /^C_(BUTTON|CHECKBOX)_Palette\d+/.test(key)),
    ...Object.keys(palette)
  ]).sort((a, b) => a.localeCompare(b));
}

function summarizeTrainingUsageTrace(effectCommands = []) {
  const commands = arr(effectCommands);
  const rows = [];
  const byEffect = new Map();
  let configuredBehaviorCount = 0;
  let parameterPriorCount = 0;
  let sourcedPriorCount = 0;
  let palettePayloadCount = 0;
  let thinSettingCount = 0;
  let deterministicSelectionCount = 0;

  for (const [index, command] of commands.entries()) {
    const intent = command?.intent && typeof command.intent === "object" ? command.intent : {};
    const settingsIntent = intent?.settingsIntent && typeof intent.settingsIntent === "object" ? intent.settingsIntent : {};
    const parameterPriorGuidance = intent?.parameterPriorGuidance && typeof intent.parameterPriorGuidance === "object"
      ? intent.parameterPriorGuidance
      : {};
    const priors = arr(parameterPriorGuidance?.priors);
    const sourceRecordIds = uniqueStrings([
      ...priors.map((prior) => str(prior?.sourceRecordId)),
      ...priors.flatMap((prior) => arr(prior?.recommendedAnchors).map((anchor) => str(anchor?.sourceRecordId)))
    ]);
    const configuredBehaviorRecordId = str(settingsIntent?.configuredBehaviorRecordId || parameterPriorGuidance?.configuredBehaviorRecordId);
    const deterministicSelection = str(settingsIntent?.deterministicEffectSelection);
    const settingKeys = commandSettingKeys(command);
    const paletteKeys = commandPaletteKeys(command);
    const effectName = str(command?.params?.effectName);
    const gaps = uniqueStrings([
      configuredBehaviorRecordId ? "" : "missing_configured_behavior_record",
      priors.length ? "" : "missing_parameter_prior_guidance",
      sourceRecordIds.length ? "" : "missing_source_record_ids",
      settingKeys.length <= 1 && !configuredBehaviorRecordId ? "thin_settings_without_behavior_record" : "",
      paletteKeys.length ? "" : "missing_palette_payload"
    ]);

    if (configuredBehaviorRecordId) configuredBehaviorCount += 1;
    if (priors.length) parameterPriorCount += 1;
    if (sourceRecordIds.length) sourcedPriorCount += 1;
    if (paletteKeys.length) palettePayloadCount += 1;
    if (settingKeys.length <= 1 && !configuredBehaviorRecordId) thinSettingCount += 1;
    if (deterministicSelection) deterministicSelectionCount += 1;

    if (!byEffect.has(effectName)) {
      byEffect.set(effectName, {
        effectName,
        commandCount: 0,
        configuredBehaviorCount: 0,
        parameterPriorCount: 0,
        sourcedPriorCount: 0,
        palettePayloadCount: 0,
        thinSettingCount: 0
      });
    }
    const effectRow = byEffect.get(effectName);
    effectRow.commandCount += 1;
    if (configuredBehaviorRecordId) effectRow.configuredBehaviorCount += 1;
    if (priors.length) effectRow.parameterPriorCount += 1;
    if (sourceRecordIds.length) effectRow.sourcedPriorCount += 1;
    if (paletteKeys.length) effectRow.palettePayloadCount += 1;
    if (settingKeys.length <= 1 && !configuredBehaviorRecordId) effectRow.thinSettingCount += 1;

    rows.push({
      commandIndex: index,
      effectName,
      target: str(command?.params?.modelName),
      layerIndex: Number(command?.params?.layerIndex),
      startMs: Number(command?.params?.startMs),
      endMs: Number(command?.params?.endMs),
      section: commandSection(command),
      settingKeys,
      paletteKeys,
      configuredBehaviorRecordId,
      deterministicSelection,
      parameterPriorGuidance: {
        recommendationMode: str(parameterPriorGuidance?.recommendationMode),
        configuredBehaviorRecordId: str(parameterPriorGuidance?.configuredBehaviorRecordId),
        priorCount: priors.length,
        sourceRecordIds: sourceRecordIds.slice(0, 8),
        parameters: uniqueStrings(priors.map((prior) => str(prior?.parameterName))).slice(0, 8)
      },
      gaps
    });
  }

  const ratio = (count) => commands.length ? Number((count / commands.length).toFixed(3)) : 0;
  const effectRows = Array.from(byEffect.values())
    .map((row) => ({
      ...row,
      configuredBehaviorCoverage: row.commandCount ? Number((row.configuredBehaviorCount / row.commandCount).toFixed(3)) : 0,
      parameterPriorCoverage: row.commandCount ? Number((row.parameterPriorCount / row.commandCount).toFixed(3)) : 0,
      sourcedPriorCoverage: row.commandCount ? Number((row.sourcedPriorCount / row.commandCount).toFixed(3)) : 0,
      palettePayloadCoverage: row.commandCount ? Number((row.palettePayloadCount / row.commandCount).toFixed(3)) : 0
    }))
    .sort((a, b) => b.commandCount - a.commandCount || a.effectName.localeCompare(b.effectName));

  return {
    artifactType: "sequencer_training_usage_trace_v1",
    commandCount: commands.length,
    configuredBehaviorCount,
    parameterPriorCount,
    sourcedPriorCount,
    palettePayloadCount,
    thinSettingCount,
    deterministicSelectionCount,
    configuredBehaviorCoverage: ratio(configuredBehaviorCount),
    parameterPriorCoverage: ratio(parameterPriorCount),
    sourcedPriorCoverage: ratio(sourcedPriorCount),
    palettePayloadCoverage: ratio(palettePayloadCount),
    thinSettingShare: ratio(thinSettingCount),
    deterministicSelectionCoverage: ratio(deterministicSelectionCount),
    byEffect: effectRows,
    commands: rows
  };
}

function summarizeCompositionTrainingTrace(effectCommands = []) {
  const commands = arr(effectCommands);
  const byTarget = new Map();
  const bySectionWindow = new Map();
  let layerCompositionGuidanceCount = 0;
  let layerCompositionPriorCount = 0;
  let layerCompositionSourcedPriorCount = 0;

  for (const command of commands) {
    const intent = command?.intent && typeof command.intent === "object" ? command.intent : {};
    const settingsIntent = intent?.settingsIntent && typeof intent.settingsIntent === "object" ? intent.settingsIntent : {};
    const guidance = intent?.layerCompositionGuidance && typeof intent.layerCompositionGuidance === "object"
      ? intent.layerCompositionGuidance
      : {};
    const recommendations = arr(guidance?.recommendations);
    const priorIds = uniqueStrings([
      ...arr(settingsIntent?.layerCompositionPriorIds).map((row) => str(row)),
      ...recommendations.map((row) => str(row?.priorId))
    ]);
    const target = str(command?.params?.modelName);
    const layerIndex = Number(command?.params?.layerIndex);
    const section = commandSection(command);
    const startMs = Number(command?.params?.startMs);
    const endMs = Number(command?.params?.endMs);
    const targetGranularity = str(intent?.targetGranularity || settingsIntent?.targetGranularity);
    const sourceAggregateTargetId = str(intent?.sourceAggregateTargetId || settingsIntent?.sourceAggregateTargetId);

    if (guidance.artifactType === "sequencer_layer_composition_guidance_v1" || priorIds.length) {
      layerCompositionGuidanceCount += 1;
    }
    if (priorIds.length) layerCompositionPriorCount += 1;
    if (recommendations.some((row) => str(row?.sourceRefs?.observationRef))) {
      layerCompositionSourcedPriorCount += 1;
    }

    if (target && Number.isFinite(layerIndex)) {
      if (!byTarget.has(target)) byTarget.set(target, new Set());
      byTarget.get(target).add(layerIndex);
    }
    const windowKey = [
      section,
      Number.isFinite(startMs) ? startMs : "",
      Number.isFinite(endMs) ? endMs : ""
    ].join("|");
    if (!bySectionWindow.has(windowKey)) {
      bySectionWindow.set(windowKey, {
        section,
        startMs,
        endMs,
        groupTargets: new Set(),
        modelTargets: new Set(),
        sourceAggregateTargetIds: new Set()
      });
    }
    const window = bySectionWindow.get(windowKey);
    if (targetGranularity === "group") window.groupTargets.add(target);
    if (targetGranularity === "member" || targetGranularity === "model") window.modelTargets.add(target);
    if (sourceAggregateTargetId) window.sourceAggregateTargetIds.add(sourceAggregateTargetId);
  }

  const sameTargetLayerStackTargets = [...byTarget.entries()]
    .filter(([, layers]) => layers.size > 1)
    .map(([target, layers]) => ({
      target,
      layerCount: layers.size,
      layers: [...layers].sort((a, b) => a - b)
    }));
  const groupModelInterplayWindows = [...bySectionWindow.values()]
    .filter((row) => row.sourceAggregateTargetIds.size || (row.groupTargets.size && row.modelTargets.size))
    .map((row) => ({
      section: row.section,
      startMs: Number.isFinite(row.startMs) ? row.startMs : null,
      endMs: Number.isFinite(row.endMs) ? row.endMs : null,
      groupTargets: [...row.groupTargets],
      modelTargets: [...row.modelTargets],
      sourceAggregateTargetIds: [...row.sourceAggregateTargetIds]
    }));
  const ratio = (count) => commands.length ? Number((count / commands.length).toFixed(3)) : 0;
  return {
    artifactType: "sequencer_composition_training_trace_v1",
    commandCount: commands.length,
    layerCompositionGuidanceCount,
    layerCompositionPriorCount,
    layerCompositionSourcedPriorCount,
    layerCompositionGuidanceCoverage: ratio(layerCompositionGuidanceCount),
    layerCompositionPriorCoverage: ratio(layerCompositionPriorCount),
    layerCompositionSourcedPriorCoverage: ratio(layerCompositionSourcedPriorCount),
    groupModelInterplayWindowCount: groupModelInterplayWindows.length,
    groupModelInterplayWindows: groupModelInterplayWindows.slice(0, 20),
    sameTargetLayerStackTargetCount: sameTargetLayerStackTargets.length,
    sameTargetLayerStackTargets: sameTargetLayerStackTargets.slice(0, 20)
  };
}

function commandDurationMs(command = {}) {
  const startMs = Number(command?.params?.startMs);
  const endMs = Number(command?.params?.endMs);
  return Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs ? endMs - startMs : 0;
}

function commandSection(command = {}) {
  return str(command?.intent?.sourceSectionLabel || command?.intent?.section || command?.metadata?.sourceSectionLabel);
}

function summarizeEffectUsageQuality(effectCommands = []) {
  const commands = arr(effectCommands);
  const count = commands.length;
  if (!count) {
    return {
      score: 0,
      band: "very_low",
      issueKinds: ["no_effect_commands"],
      commandCount: 0,
      dimensions: {
        effectKnowledgeCoverageScore: 0,
        configurationRichnessScore: 0,
        repetitionControlScore: 0,
        sectionContrastScore: 0,
        timingShapeScore: 0,
        genericEffectControlScore: 0
      }
    };
  }
  let configuredBehaviorCount = 0;
  let parameterPriorCount = 0;
  let thinSettingCount = 0;
  let longWindowCount = 0;
  let bareOnCount = 0;
  const signatureCounts = new Map();
  const sectionSignatureCounts = new Map();
  for (const command of commands) {
    if (str(command?.intent?.settingsIntent?.configuredBehaviorRecordId)) configuredBehaviorCount += 1;
    if (arr(command?.intent?.parameterPriorGuidance?.priors).length) parameterPriorCount += 1;
    const settings = command?.params?.settings && typeof command.params.settings === "object"
      ? command.params.settings
      : {};
    const settingKeyCount = Object.keys(settings).filter((key) => !/^T_|^B_/.test(key)).length;
    const effectName = str(command?.params?.effectName);
    if (effectName === "On" && settingKeyCount === 0) bareOnCount += 1;
    if (settingKeyCount <= 1 && !str(command?.intent?.settingsIntent?.configuredBehaviorRecordId)) thinSettingCount += 1;
    if (commandDurationMs(command) > 10000) longWindowCount += 1;
    const signature = settingsSignature(command);
    signatureCounts.set(signature, (signatureCounts.get(signature) || 0) + 1);
    const section = commandSection(command);
    if (section) {
      if (!sectionSignatureCounts.has(section)) sectionSignatureCounts.set(section, new Map());
      const sectionMap = sectionSignatureCounts.get(section);
      sectionMap.set(signature, (sectionMap.get(signature) || 0) + 1);
    }
  }
  const exactSignatureDominance = Math.max(0, ...signatureCounts.values()) / count;
  const configuredBehaviorCoverage = configuredBehaviorCount / count;
  const parameterPriorCoverage = parameterPriorCount / count;
  const thinSettingShare = thinSettingCount / count;
  const bareOnShare = bareOnCount / count;
  const longWindowShare = longWindowCount / count;
  const maxSectionSignatureShare = Math.max(
    0,
    ...Array.from(sectionSignatureCounts.values()).map((sectionMap) => {
      const sectionTotal = Array.from(sectionMap.values()).reduce((sum, value) => sum + value, 0);
      return sectionTotal > 0 ? Math.max(...sectionMap.values()) / sectionTotal : 0;
    })
  );
  const issueKinds = uniqueStrings([
    configuredBehaviorCoverage < 0.6 ? "low_configured_behavior_coverage" : "",
    thinSettingShare > 0.25 ? "generic_or_thin_effect_settings" : "",
    bareOnShare > 0.08 ? "bare_on_overuse" : "",
    exactSignatureDominance > 0.14 ? "dominant_repeated_effect_configuration" : "",
    maxSectionSignatureShare > 0.3 ? "section_level_configuration_repetition" : "",
    longWindowShare > 0.18 ? "long_unmusical_effect_blocks" : "",
    parameterPriorCoverage < 0.75 ? "low_parameter_prior_coverage" : ""
  ].filter(Boolean));
  const clampScore = (value = 0) => Math.max(0, Math.min(1, Number(value || 0)));
  const dimensions = {
    effectKnowledgeCoverageScore: clampScore((configuredBehaviorCoverage * 0.7) + (parameterPriorCoverage * 0.3)),
    configurationRichnessScore: clampScore(1 - Math.max(0, thinSettingShare - 0.15) / 0.65),
    repetitionControlScore: clampScore(1 - Math.max(0, exactSignatureDominance - 0.1) / 0.35),
    sectionContrastScore: clampScore(1 - Math.max(0, maxSectionSignatureShare - 0.22) / 0.45),
    timingShapeScore: clampScore(1 - Math.max(0, longWindowShare - 0.12) / 0.5),
    genericEffectControlScore: clampScore(1 - Math.max(0, bareOnShare - 0.04) / 0.25)
  };
  const score = clampScore(
    (dimensions.effectKnowledgeCoverageScore * 0.24) +
    (dimensions.configurationRichnessScore * 0.22) +
    (dimensions.repetitionControlScore * 0.18) +
    (dimensions.sectionContrastScore * 0.14) +
    (dimensions.timingShapeScore * 0.12) +
    (dimensions.genericEffectControlScore * 0.1)
  );
  return {
    score: Number(score.toFixed(3)),
    band: score >= 0.8 ? "strong" : score >= 0.65 ? "acceptable" : score >= 0.4 ? "weak" : "very_low",
    dimensions: Object.fromEntries(Object.entries(dimensions).map(([key, value]) => [key, Number(value.toFixed(3))])),
    issueKinds,
    commandCount: count,
    configuredBehaviorCoverage: Number(configuredBehaviorCoverage.toFixed(3)),
    parameterPriorCoverage: Number(parameterPriorCoverage.toFixed(3)),
    thinSettingShare: Number(thinSettingShare.toFixed(3)),
    bareOnShare: Number(bareOnShare.toFixed(3)),
    exactSignatureDominance: Number(exactSignatureDominance.toFixed(3)),
    maxSectionSignatureShare: Number(maxSectionSignatureShare.toFixed(3)),
    longWindowShare: Number(longWindowShare.toFixed(3)),
    topRepeatedConfigurations: Array.from(signatureCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([signature, occurrences]) => ({ signature, occurrences }))
  };
}

function buildPlacementIntentIndex(effectPlacements = []) {
  const index = new Map();
  for (const placement of arr(effectPlacements)) {
    const targetId = str(placement?.targetId);
    if (!targetId) continue;
    const key = targetId.toLowerCase();
    const existing = index.get(key) || {
      targetId,
      placementCount: 0,
      spatialCoveragePlacementCount: 0,
      compositionRoles: [],
      targetRoles: [],
      targetGranularities: []
    };
    existing.placementCount += 1;
    if (placement?.spatialCoverageFiller === true || placement?.settingsIntent?.spatialCoverageFiller === true) {
      existing.spatialCoveragePlacementCount += 1;
    }
    existing.compositionRoles = uniqueStrings([...existing.compositionRoles, str(placement?.compositionRole)]);
    existing.targetRoles = uniqueStrings([...existing.targetRoles, str(placement?.targetRole)]);
    existing.targetGranularities = uniqueStrings([...existing.targetGranularities, str(placement?.targetGranularity)]);
    index.set(key, existing);
  }
  return index;
}

function summarizeObservedTargetMetadata(observedTargets = [], metadataAssignments = [], effectPlacements = []) {
  const targetIds = Array.from(new Set(arr(observedTargets).map((row) => str(row)).filter(Boolean)));
  const assignmentIndex = buildMetadataAssignmentIndex(metadataAssignments);
  const placementIntentIndex = buildPlacementIntentIndex(effectPlacements);
  const missingMetadataTargetIds = [];
  const layoutDerivedSupportTargetIds = [];
  const xlightsDerivedStructuralTargetIds = [];
  const roleOnlyTargetIds = [];
  const definedVisualHintTargetIds = [];
  const pendingVisualHintTargetIds = [];
  const pendingOnlyVisualHintTargetIds = [];

  for (const targetId of targetIds) {
    const assignment = resolveObservedTargetMetadata(targetId, assignmentIndex);
    const placementIntent = placementIntentIndex.get(targetId.toLowerCase());
    const effectiveAssignment = assignment || inferXlightsStructuralMetadata(targetId, placementIntent);
    if (!effectiveAssignment) {
      const spatialCoverageOnly = placementIntent?.placementCount > 0
        && placementIntent.spatialCoveragePlacementCount === placementIntent.placementCount;
      if (spatialCoverageOnly) {
        layoutDerivedSupportTargetIds.push(targetId);
        continue;
      }
      missingMetadataTargetIds.push(targetId);
      continue;
    }
    if (!assignment && effectiveAssignment?.source === "xlights_layout_structural_metadata") {
      xlightsDerivedStructuralTargetIds.push(targetId);
    }

    const rolePreference = str(effectiveAssignment?.rolePreference);
    const semanticHints = arr(effectiveAssignment?.semanticHints).map((row) => str(row)).filter(Boolean);
    const effectAvoidances = arr(effectiveAssignment?.effectAvoidances).map((row) => str(row)).filter(Boolean);
    const visualHintDefinitions = arr(effectiveAssignment?.visualHintDefinitions).filter((row) => row && typeof row === "object");
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
    layoutDerivedSupportTargetIds,
    xlightsDerivedStructuralTargetIds,
    roleOnlyTargetIds,
    definedVisualHintTargetIds,
    pendingVisualHintTargetIds,
    pendingOnlyVisualHintTargetIds,
    counts: {
      missingMetadata: missingMetadataTargetIds.length,
      layoutDerivedSupportTargets: layoutDerivedSupportTargetIds.length,
      xlightsDerivedStructuralTargets: xlightsDerivedStructuralTargetIds.length,
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

function normalizeCompositionPlan(planHandoff = null) {
  const meta = planHandoff?.metadata && typeof planHandoff.metadata === "object" ? planHandoff.metadata : {};
  const nested = meta?.effectStrategy?.compositionPlan;
  const direct = meta?.compositionPlan;
  const plan = nested && typeof nested === "object"
    ? nested
    : (direct && typeof direct === "object" ? direct : null);
  return plan && str(plan?.artifactType) === "composition_plan_v1" ? plan : null;
}

function summarizeCompositionCoverage(planHandoff = null) {
  const compositionPlan = normalizeCompositionPlan(planHandoff);
  const commands = arr(planHandoff?.commands);
  const effectCommands = commands.filter((row) => str(row?.cmd) === "effects.create");
  const observedTargets = new Set(effectCommands.map((row) => str(row?.params?.modelName)).filter(Boolean));
  const observedSections = new Set(effectCommands
    .map((row) => commandSectionLabel(row))
    .filter(Boolean));
  const observedLayeredTargets = new Set();
  const layersByTarget = new Map();
  for (const command of effectCommands) {
    const target = str(command?.params?.modelName);
    const layerIndex = Number(command?.params?.layerIndex);
    if (!target || !Number.isFinite(layerIndex)) continue;
    if (!layersByTarget.has(target)) layersByTarget.set(target, new Set());
    layersByTarget.get(target).add(layerIndex);
  }
  for (const [target, layers] of layersByTarget.entries()) {
    if (layers.size > 1) observedLayeredTargets.add(target);
  }

  if (!compositionPlan) {
    return {
      available: false,
      artifactType: "",
      plannedSectionCount: 0,
      coveredSectionCount: 0,
      sectionCoverageRatio: 0,
      plannedFocusTargetCount: 0,
      coveredFocusTargetCount: 0,
      missingFocusTargets: [],
      plannedSupportTargetCount: 0,
      coveredSupportTargetCount: 0,
      missingSupportTargets: [],
      plannedAccentTargetCount: 0,
      coveredAccentTargetCount: 0,
      missingAccentTargets: [],
      plannedLayerStackTargetCount: 0,
      coveredLayerStackTargetCount: 0,
      missingLayerStackTargets: [],
      plannedSpatialBreadths: [],
      plannedProgressionIntents: []
    };
  }

  const sections = arr(compositionPlan?.sections);
  const targetValues = (value) => (Array.isArray(value) ? value : [value])
    .map((target) => str(target))
    .filter(Boolean);
  const sectionTargets = (fieldName) => uniqueStrings(sections.flatMap((row) => targetValues(row?.[fieldName])));
  const plannedSectionLabels = uniqueStrings(sections.map((row) => str(row?.section)));
  const missingSections = plannedSectionLabels.filter((section) => !observedSections.has(section));
  const plannedFocusTargets = sectionTargets("focalRegion");
  const plannedSupportTargets = sectionTargets("supportRegion");
  const plannedAccentTargets = sectionTargets("accentRegion");
  const plannedLayerStackTargets = uniqueStrings(sections.flatMap((row) => arr(row?.layerStackTargets).map((target) => str(target))));
  const countCovered = (targets, observedSet = observedTargets) => targets.filter((target) => observedSet.has(target)).length;
  const missingTargets = (targets, observedSet = observedTargets) => targets.filter((target) => !observedSet.has(target));
  return {
    available: true,
    artifactType: str(compositionPlan?.artifactType),
    plannedSectionCount: plannedSectionLabels.length,
    coveredSectionCount: plannedSectionLabels.length - missingSections.length,
    sectionCoverageRatio: plannedSectionLabels.length > 0
      ? (plannedSectionLabels.length - missingSections.length) / plannedSectionLabels.length
      : 0,
    missingSections,
    plannedFocusTargetCount: plannedFocusTargets.length,
    coveredFocusTargetCount: countCovered(plannedFocusTargets),
    missingFocusTargets: missingTargets(plannedFocusTargets),
    plannedSupportTargetCount: plannedSupportTargets.length,
    coveredSupportTargetCount: countCovered(plannedSupportTargets),
    missingSupportTargets: missingTargets(plannedSupportTargets),
    plannedAccentTargetCount: plannedAccentTargets.length,
    coveredAccentTargetCount: countCovered(plannedAccentTargets),
    missingAccentTargets: missingTargets(plannedAccentTargets),
    plannedLayerStackTargetCount: plannedLayerStackTargets.length,
    coveredLayerStackTargetCount: countCovered(plannedLayerStackTargets, observedLayeredTargets),
    missingLayerStackTargets: missingTargets(plannedLayerStackTargets, observedLayeredTargets),
    plannedSpatialBreadths: uniqueStrings(sections.map((row) => str(row?.expectedBalance?.spatialBreadth))),
    plannedProgressionIntents: uniqueStrings(sections.map((row) => str(row?.progressionIntent)))
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
  const effectPayloadChecks = summarizeEffectPayloadChecks(verification?.checks);
  const preservationChecks = summarizePreservationChecks(verification?.checks);
  const designChecks = summarizeChecks(verification?.designChecks);
  const effectPlacements = arr(planHandoff?.metadata?.effectPlacements).length
    ? arr(planHandoff?.metadata?.effectPlacements)
    : arr(planHandoff?.scope?.executionStrategy?.effectPlacements);
  const metadataCoverage = summarizeObservedTargetMetadata(designAlignment?.observedTargets, metadataAssignments, effectPlacements);
  const planQuality = summarizePlanQuality(planHandoff);
  const timingFidelity = summarizeTimingFidelity(planHandoff);
  const compositionCoverage = summarizeCompositionCoverage(planHandoff);
  const trainingUsageTrace = planQuality.trainingUsageTrace || summarizeTrainingUsageTrace([]);
  const compositionTrainingTrace = planQuality.compositionTrainingTrace || summarizeCompositionTrainingTrace([]);
  const qualityFailures = [];
  const timingFailures = [];
  const durationMs = Number(planHandoff?.metadata?.sequenceSettings?.durationMs || 0);
  const sectionCount = Math.max(
    arr(planHandoff?.metadata?.sectionPlans).length,
    arr(planHandoff?.metadata?.effectStrategy?.compositionPlan?.sections).length,
    arr(planHandoff?.metadata?.compositionPlan?.sections).length
  );
  const passScope = str(planHandoff?.metadata?.executionStrategy?.passScope);
  const isSectionScoped = passScope === "single_section" && sectionCount <= 1;
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
  if (!isSectionScoped && isWholeSongScale && planQuality.effectUsageQuality?.score < 0.65) {
    qualityFailures.push({
      kind: "effect_usage_taste",
      target: "sequence",
      detail: `Effect usage quality is weak (${planQuality.effectUsageQuality.score}): ${arr(planQuality.effectUsageQuality.issueKinds).join(", ")}.`
    });
  }
  if (!isSectionScoped && isWholeSongScale && trainingUsageTrace.configuredBehaviorCoverage < 0.6) {
    qualityFailures.push({
      kind: "training_usage_trace_coverage",
      target: "sequence",
      detail: `Configured behavior coverage too low (${trainingUsageTrace.configuredBehaviorCoverage}); parameter prior coverage=${trainingUsageTrace.parameterPriorCoverage}, sourced prior coverage=${trainingUsageTrace.sourcedPriorCoverage}.`
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
  if (!isSectionScoped && compositionCoverage.available && compositionCoverage.missingSections.length) {
    qualityFailures.push({
      kind: "composition_section_coverage",
      target: "sequence",
      detail: `Composition sections without effect coverage: ${compositionCoverage.missingSections.join(", ")}`
    });
  }
  if (!isSectionScoped && compositionCoverage.available && compositionCoverage.missingFocusTargets.length) {
    qualityFailures.push({
      kind: "composition_focus_coverage",
      target: "sequence",
      detail: `Planned focal targets not covered by effect commands: ${compositionCoverage.missingFocusTargets.join(", ")}`
    });
  }
  if (!isSectionScoped && compositionCoverage.available && compositionCoverage.missingLayerStackTargets.length) {
    qualityFailures.push({
      kind: "composition_layer_coverage",
      target: "sequence",
      detail: `Planned layered targets not covered by multiple layers: ${compositionCoverage.missingLayerStackTargets.join(", ")}`
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
      effectPayloadChecks,
      preservationChecks,
      designChecks,
      metadataCoverage: metadataCoverage.counts,
      planQuality,
      timingFidelity,
      compositionCoverage,
      trainingUsageTrace,
      compositionTrainingTrace
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
    compositionCoverage,
    trainingUsageTrace,
    compositionTrainingTrace,
    effectPayloadChecks,
    failures: {
      readback: compactFailures(verification?.checks),
      design: compactFailures(verification?.designChecks),
      metadata: [
        ...metadataCoverage.missingMetadataTargetIds.map((targetId) => ({
          kind: "missing_metadata",
          target: targetId,
          detail: "Observed target has no metadata assignment."
        })),
        ...metadataCoverage.layoutDerivedSupportTargetIds.map((targetId) => ({
          kind: "layout_derived_support_target",
          target: targetId,
          detail: "Observed target was selected only as deterministic spatial support from layout geometry."
        })),
        ...metadataCoverage.xlightsDerivedStructuralTargetIds.map((targetId) => ({
          kind: "xlights_structural_metadata",
          target: targetId,
          detail: "Observed target is covered by xLights-derived structural display metadata."
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
