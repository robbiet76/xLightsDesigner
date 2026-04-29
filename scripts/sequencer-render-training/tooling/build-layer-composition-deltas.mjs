import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function str(value = "") {
  return String(value || "").trim();
}

function num(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function observationMacro(observation = {}) {
  return observation?.renderObservation?.macro && typeof observation.renderObservation.macro === "object"
    ? observation.renderObservation.macro
    : {};
}

function loadCompletedCheckpoints(runRoot) {
  const bundle = readJson(path.join(runRoot, "checkpoints.json"));
  return arr(bundle.checkpoints)
    .map((row) => ({
      ...readJson(row.checkpointRef),
      passPlanRef: str(row.passPlanRef),
      passExecutionRef: str(row.passExecutionRef)
    }))
    .filter((row) => str(row.status) === "completed" && str(row.observationRef))
    .map((row) => ({
      ...row,
      passPlan: row.passPlanRef && fs.existsSync(row.passPlanRef) ? readJson(row.passPlanRef) : {},
      observation: readJson(row.observationRef)
    }));
}

function sortedExperimentPasses(plan = {}, checkpoints = []) {
  const byKey = new Map(checkpoints.map((row) => [`${row.experimentId}::${row.passId}`, row]));
  const plannedExperimentIds = new Set(arr(plan.experiments).map((experiment) => str(experiment.experimentId)));
  const out = [];
  for (const experiment of arr(plan.experiments)) {
    const passes = arr(experiment.passes)
      .map((pass) => byKey.get(`${experiment.experimentId}::${pass.passId}`))
      .filter(Boolean);
    out.push({ experiment, passes });
  }
  const refillGroups = new Map();
  for (const checkpoint of checkpoints) {
    if (plannedExperimentIds.has(str(checkpoint.experimentId))) continue;
    if (!refillGroups.has(str(checkpoint.experimentId))) {
      const passPlan = checkpoint.passPlan || {};
      refillGroups.set(str(checkpoint.experimentId), {
        experiment: {
          experimentId: str(checkpoint.experimentId),
          family: str(passPlan.family),
          paletteProfile: str(passPlan.paletteProfile),
          coverageKey: str(passPlan.coverageKey),
          adaptiveRefill: true,
          refillSource: "checkpoint_pass_plan"
        },
        passes: []
      });
    }
    refillGroups.get(str(checkpoint.experimentId)).passes.push(checkpoint);
  }
  for (const group of refillGroups.values()) {
    out.push(group);
  }
  return out;
}

function setDiff(right = [], left = []) {
  const leftSet = new Set(arr(left).map(str));
  return arr(right).map(str).filter((value) => value && !leftSet.has(value));
}

function metricSnapshot(macro = {}) {
  return {
    activeModelNames: arr(macro.activeModelNames).map(str).filter(Boolean),
    activeModelCount: arr(macro.activeModelNames).length,
    activeModelTotals: macro.activeModelTotals || {},
    activeFamilyTotals: macro.activeFamilyTotals || {},
    leadModel: macro.leadModel || null,
    leadModelShare: num(macro.leadModelShare),
    maxActiveModelRatio: num(macro.maxActiveModelRatio),
    maxActiveNodeCount: num(macro.maxActiveNodeCount),
    meanSceneSpreadRatio: num(macro.meanSceneSpreadRatio),
    maxSceneSpreadRatio: num(macro.maxSceneSpreadRatio),
    dominantColorRole: str(macro.dominantColorRole || "unknown"),
    colorRoleTotals: macro.colorRoleTotals || {},
    meanColorSpread: num(macro.meanColorSpread),
    multicolorFrameRatio: num(macro.multicolorFrameRatio),
    centroidMotionMean: num(macro.centroidMotionMean),
    centroidMotionMax: num(macro.centroidMotionMax),
    brightnessDeltaMean: num(macro.brightnessDeltaMean),
    brightnessDeltaMax: num(macro.brightnessDeltaMax),
    nodeCountDeltaMean: num(macro.nodeCountDeltaMean),
    pulsePeakCount: num(macro.pulsePeakCount),
    burstFrameRatio: num(macro.burstFrameRatio),
    holdFrameRatio: num(macro.holdFrameRatio),
    meanModelActiveNodeRatio: num(macro.meanModelActiveNodeRatio),
    modelActiveNodeRatioStddevMean: num(macro.modelActiveNodeRatioStddevMean),
    meanModelBrightnessStddev: num(macro.meanModelBrightnessStddev),
    meanEdgeSoftness: num(macro.meanEdgeSoftness),
    meanColorBoundarySoftness: num(macro.meanColorBoundarySoftness),
    meanAdjacentColorDelta: num(macro.meanAdjacentColorDelta),
    activeNodeRetentionMean: num(macro.activeNodeRetentionMean),
    rgbSimilarityMean: num(macro.rgbSimilarityMean),
    brightnessSimilarityMean: num(macro.brightnessSimilarityMean),
    colorSequenceChangeMean: num(macro.colorSequenceChangeMean),
    colorSequenceChangeMax: num(macro.colorSequenceChangeMax),
    openingBrightnessMean: num(macro.openingBrightnessMean),
    middleBrightnessMean: num(macro.middleBrightnessMean),
    closingBrightnessMean: num(macro.closingBrightnessMean),
    openingToMiddleBrightnessDelta: num(macro.openingToMiddleBrightnessDelta),
    middleToClosingBrightnessDelta: num(macro.middleToClosingBrightnessDelta),
    openingActiveNodeMean: num(macro.openingActiveNodeMean),
    closingActiveNodeMean: num(macro.closingActiveNodeMean),
    openingToClosingActiveNodeDelta: num(macro.openingToClosingActiveNodeDelta)
  };
}

function stableValue(value) {
  if (value === undefined) return null;
  if (value === null) return null;
  if (Array.isArray(value)) return value.map(stableValue);
  if (typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

function sameValue(left, right) {
  return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right));
}

function deltaSnapshot(current = {}, reference = {}) {
  const c = metricSnapshot(current);
  const r = metricSnapshot(reference);
  return {
    addedActiveModels: setDiff(c.activeModelNames, r.activeModelNames),
    removedActiveModels: setDiff(r.activeModelNames, c.activeModelNames),
    activeModelCountDelta: c.activeModelCount - r.activeModelCount,
    maxActiveNodeCountDelta: c.maxActiveNodeCount - r.maxActiveNodeCount,
    meanSceneSpreadRatioDelta: c.meanSceneSpreadRatio - r.meanSceneSpreadRatio,
    maxSceneSpreadRatioDelta: c.maxSceneSpreadRatio - r.maxSceneSpreadRatio,
    meanColorSpreadDelta: c.meanColorSpread - r.meanColorSpread,
    multicolorFrameRatioDelta: c.multicolorFrameRatio - r.multicolorFrameRatio,
    centroidMotionMeanDelta: c.centroidMotionMean - r.centroidMotionMean,
    brightnessDeltaMeanDelta: c.brightnessDeltaMean - r.brightnessDeltaMean,
    brightnessDeltaMaxDelta: c.brightnessDeltaMax - r.brightnessDeltaMax,
    nodeCountDeltaMeanDelta: c.nodeCountDeltaMean - r.nodeCountDeltaMean,
    meanModelActiveNodeRatioDelta: c.meanModelActiveNodeRatio - r.meanModelActiveNodeRatio,
    modelActiveNodeRatioStddevMeanDelta: c.modelActiveNodeRatioStddevMean - r.modelActiveNodeRatioStddevMean,
    meanModelBrightnessStddevDelta: c.meanModelBrightnessStddev - r.meanModelBrightnessStddev,
    meanEdgeSoftnessDelta: c.meanEdgeSoftness - r.meanEdgeSoftness,
    meanColorBoundarySoftnessDelta: c.meanColorBoundarySoftness - r.meanColorBoundarySoftness,
    meanAdjacentColorDeltaDelta: c.meanAdjacentColorDelta - r.meanAdjacentColorDelta,
    activeNodeRetentionMeanDelta: c.activeNodeRetentionMean - r.activeNodeRetentionMean,
    rgbSimilarityMeanDelta: c.rgbSimilarityMean - r.rgbSimilarityMean,
    brightnessSimilarityMeanDelta: c.brightnessSimilarityMean - r.brightnessSimilarityMean,
    colorSequenceChangeMeanDelta: c.colorSequenceChangeMean - r.colorSequenceChangeMean,
    colorSequenceChangeMaxDelta: c.colorSequenceChangeMax - r.colorSequenceChangeMax,
    openingToMiddleBrightnessDeltaDelta: c.openingToMiddleBrightnessDelta - r.openingToMiddleBrightnessDelta,
    middleToClosingBrightnessDeltaDelta: c.middleToClosingBrightnessDelta - r.middleToClosingBrightnessDelta,
    openingToClosingActiveNodeDeltaDelta: c.openingToClosingActiveNodeDelta - r.openingToClosingActiveNodeDelta,
    dominantColorRoleChanged: c.dominantColorRole !== r.dominantColorRole,
    current: c,
    reference: r
  };
}

function placementIdentity(placement = {}, index = 0) {
  return [
    str(placement.targetScope),
    str(placement.target),
    str(placement.effectName),
    str(placement.compositionPass),
    Number.isFinite(Number(placement.layerIndex)) ? Number(placement.layerIndex) : "layer_unknown",
    str(placement.layerIntent?.blendRole),
    index
  ].join("|");
}

function placementLayerSummary(placement = {}) {
  return {
    placementId: str(placement.placementId),
    target: str(placement.target),
    targetScope: str(placement.targetScope),
    effectName: str(placement.effectName),
    compositionPass: str(placement.compositionPass),
    layerIndex: Number.isFinite(Number(placement.layerIndex)) ? Number(placement.layerIndex) : null,
    layerBlendRole: str(placement.layerIntent?.blendRole)
  };
}

function diffLayerSettings(basePassPlan = {}, variantPassPlan = {}) {
  const basePlacements = arr(basePassPlan.placements);
  const variantPlacements = arr(variantPassPlan.placements);
  const baseByIdentity = new Map(basePlacements.map((placement, index) => [placementIdentity(placement, index), placement]));
  const diffs = [];

  variantPlacements.forEach((variantPlacement, index) => {
    const basePlacement = baseByIdentity.get(placementIdentity(variantPlacement, index)) || basePlacements[index] || {};
    const baseSettings = basePlacement.layerSettings && typeof basePlacement.layerSettings === "object"
      ? basePlacement.layerSettings
      : {};
    const variantSettings = variantPlacement.layerSettings && typeof variantPlacement.layerSettings === "object"
      ? variantPlacement.layerSettings
      : {};
    const settingNames = [...new Set([...Object.keys(baseSettings), ...Object.keys(variantSettings)])].sort();
    for (const settingName of settingNames) {
      if (sameValue(baseSettings[settingName], variantSettings[settingName])) continue;
      diffs.push({
        settingName,
        baselineValue: stableValue(baseSettings[settingName]),
        variantValue: stableValue(variantSettings[settingName]),
        affectedLayer: placementLayerSummary(variantPlacement),
        baselinePlacementId: str(basePlacement.placementId),
        variantPlacementId: str(variantPlacement.placementId)
      });
    }
  });

  return diffs;
}

function diffEffectSettings(basePassPlan = {}, variantPassPlan = {}) {
  const basePlacements = arr(basePassPlan.placements);
  const variantPlacements = arr(variantPassPlan.placements);
  const baseByIdentity = new Map(basePlacements.map((placement, index) => [placementIdentity(placement, index), placement]));
  const diffs = [];

  variantPlacements.forEach((variantPlacement, index) => {
    const basePlacement = baseByIdentity.get(placementIdentity(variantPlacement, index)) || basePlacements[index] || {};
    const baseSettings = basePlacement.effectSettings && typeof basePlacement.effectSettings === "object"
      ? basePlacement.effectSettings
      : {};
    const variantSettings = variantPlacement.effectSettings && typeof variantPlacement.effectSettings === "object"
      ? variantPlacement.effectSettings
      : {};
    const settingNames = [...new Set([...Object.keys(baseSettings), ...Object.keys(variantSettings)])].sort();
    for (const settingName of settingNames) {
      if (sameValue(baseSettings[settingName], variantSettings[settingName])) continue;
      diffs.push({
        settingName,
        baselineValue: stableValue(baseSettings[settingName]),
        variantValue: stableValue(variantSettings[settingName]),
        affectedLayer: placementLayerSummary(variantPlacement),
        baselinePlacementId: str(basePlacement.placementId),
        variantPlacementId: str(variantPlacement.placementId)
      });
    }
  });

  return diffs;
}

function summarizePlacements(passPlan = {}) {
  const placements = arr(passPlan.placements);
  return {
    placementCount: placements.length,
    targetIds: [...new Set(placements.map((row) => str(row.target)).filter(Boolean))],
    targetScopes: [...new Set(placements.map((row) => str(row.targetScope)).filter(Boolean))],
    modelTypes: [...new Set(placements.map((row) => str(row.modelType)).filter(Boolean))],
    geometryProfiles: [...new Set(placements.map((row) => str(row.geometryProfile)).filter(Boolean))],
    effectNames: [...new Set(placements.map((row) => str(row.effectName)).filter(Boolean))],
    compositionPasses: [...new Set(placements.map((row) => str(row.compositionPass)).filter(Boolean))],
    layerIndexes: [...new Set(placements.map((row) => Number(row.layerIndex)).filter(Number.isFinite))].sort((a, b) => a - b),
    layerBlendRoles: [...new Set(placements.map((row) => str(row.layerIntent?.blendRole)).filter(Boolean))],
    hasGroupScope: placements.some((row) => str(row.targetScope) === "group"),
    hasModelScope: placements.some((row) => str(row.targetScope) === "model"),
    hasMultipleLayers: new Set(placements.map((row) => Number(row.layerIndex)).filter(Number.isFinite)).size > 1,
    hasLayerSettings: placements.some((row) => Object.keys(row.layerSettings || {}).length > 0)
  };
}

function interpretRenderSettingDelta(metricDeltas = {}, settingName = "") {
  const interpreted = [];
  if (Math.abs(num(metricDeltas.meanSceneSpreadRatioDelta)) > 0.001) {
    interpreted.push(metricDeltas.meanSceneSpreadRatioDelta > 0 ? "scene_spread_increased" : "scene_spread_decreased");
  }
  if (Math.abs(num(metricDeltas.meanColorSpreadDelta)) > 0.001 || Math.abs(num(metricDeltas.multicolorFrameRatioDelta)) > 0.001) {
    interpreted.push(
      metricDeltas.meanColorSpreadDelta >= 0 || metricDeltas.multicolorFrameRatioDelta >= 0
        ? "color_variety_increased"
        : "color_variety_decreased"
    );
  }
  if (Math.abs(num(metricDeltas.centroidMotionMeanDelta)) > 0.01) {
    interpreted.push(metricDeltas.centroidMotionMeanDelta > 0 ? "motion_read_increased" : "motion_read_decreased");
  }
  if (Math.abs(num(metricDeltas.brightnessDeltaMeanDelta)) > 0.001 || Math.abs(num(metricDeltas.brightnessDeltaMaxDelta)) > 0.001) {
    interpreted.push(metricDeltas.brightnessDeltaMeanDelta >= 0 ? "brightness_variation_increased" : "brightness_variation_decreased");
  }
  if (Math.abs(num(metricDeltas.meanEdgeSoftnessDelta)) > 0.001) {
    interpreted.push(metricDeltas.meanEdgeSoftnessDelta > 0 ? "edge_softness_increased" : "edge_softness_decreased");
  }
  if (Math.abs(num(metricDeltas.meanColorBoundarySoftnessDelta)) > 0.001) {
    interpreted.push(metricDeltas.meanColorBoundarySoftnessDelta > 0 ? "color_boundary_softness_increased" : "color_boundary_softness_decreased");
  }
  if (Math.abs(num(metricDeltas.activeNodeRetentionMeanDelta)) > 0.001) {
    interpreted.push(metricDeltas.activeNodeRetentionMeanDelta > 0 ? "active_node_persistence_increased" : "active_node_persistence_decreased");
  }
  if (Math.abs(num(metricDeltas.rgbSimilarityMeanDelta)) > 0.001 || Math.abs(num(metricDeltas.brightnessSimilarityMeanDelta)) > 0.001) {
    interpreted.push(
      metricDeltas.rgbSimilarityMeanDelta >= 0 || metricDeltas.brightnessSimilarityMeanDelta >= 0
        ? "frame_to_frame_similarity_increased"
        : "frame_to_frame_similarity_decreased"
    );
  }
  if (Math.abs(num(metricDeltas.colorSequenceChangeMeanDelta)) > 0.001 || Math.abs(num(metricDeltas.colorSequenceChangeMaxDelta)) > 0.001) {
    interpreted.push(metricDeltas.colorSequenceChangeMeanDelta >= 0 ? "color_position_motion_increased" : "color_position_motion_decreased");
  }
  if (Math.abs(num(metricDeltas.openingToMiddleBrightnessDeltaDelta)) > 0.001 || Math.abs(num(metricDeltas.middleToClosingBrightnessDeltaDelta)) > 0.001) {
    interpreted.push("fade_or_ramp_profile_changed");
  }
  if (Math.abs(num(metricDeltas.meanModelBrightnessStddevDelta)) > 0.001) {
    interpreted.push(metricDeltas.meanModelBrightnessStddevDelta > 0 ? "model_texture_contrast_increased" : "model_texture_contrast_decreased");
  }
  if (str(settingName).toLowerCase().includes("brightness") && num(metricDeltas.maxActiveNodeCountDelta) === 0 && num(metricDeltas.brightnessDeltaMaxDelta) <= 0) {
    interpreted.push("possible_brightness_clipping_or_no_visible_gain");
  }
  if (!interpreted.length) interpreted.push("no_macro_setting_delta_detected");
  return [...new Set(interpreted)];
}

function buildRenderSettingDeltaObservations({
  runId = "",
  experiment = {},
  pass = {},
  comparisonBase = null
} = {}) {
  if (!comparisonBase) return [];
  const changeType = str(pass.passPlan?.changeType || pass.changeType);
  const compositionPass = str(pass.passPlan?.compositionPass || pass.compositionPass);
  if (changeType !== "layer_render_setting" && compositionPass !== "render_setting_variant") return [];
  const settingDiffs = diffLayerSettings(comparisonBase.passPlan, pass.passPlan);
  if (!settingDiffs.length) return [];
  const metricDeltas = deltaSnapshot(observationMacro(pass.observation), observationMacro(comparisonBase.observation));
  return settingDiffs.map((settingDiff) => ({
    artifactType: "render_setting_delta_observation_v1",
    artifactVersion: 1,
    runId: str(runId),
    experimentId: str(experiment.experimentId),
    fromPassId: str(comparisonBase.passId),
    toPassId: str(pass.passId),
    settingName: settingDiff.settingName,
    baselineValue: settingDiff.baselineValue,
    variantValue: settingDiff.variantValue,
    affectedLayer: settingDiff.affectedLayer,
    changedPlacementIds: [settingDiff.baselinePlacementId, settingDiff.variantPlacementId].filter(Boolean),
    metricDeltas,
    interpretedDeltas: interpretRenderSettingDelta(metricDeltas, settingDiff.settingName),
    confidence: "smoke_observed",
    rawEvidenceRefs: [str(comparisonBase.observationRef), str(pass.observationRef)].filter(Boolean)
  }));
}

function buildEffectSettingDeltaObservations({
  runId = "",
  experiment = {},
  pass = {},
  comparisonBase = null
} = {}) {
  if (!comparisonBase) return [];
  const changeType = str(pass.passPlan?.changeType || pass.changeType);
  const compositionPass = str(pass.passPlan?.compositionPass || pass.compositionPass);
  if (changeType !== "effect_setting" && compositionPass !== "effect_setting_variant") return [];
  const settingDiffs = diffEffectSettings(comparisonBase.passPlan, pass.passPlan);
  if (!settingDiffs.length) return [];
  const metricDeltas = deltaSnapshot(observationMacro(pass.observation), observationMacro(comparisonBase.observation));
  return settingDiffs.map((settingDiff) => ({
    artifactType: "effect_setting_delta_observation_v1",
    artifactVersion: 1,
    runId: str(runId),
    experimentId: str(experiment.experimentId),
    fromPassId: str(comparisonBase.passId),
    toPassId: str(pass.passId),
    settingName: settingDiff.settingName,
    baselineValue: settingDiff.baselineValue,
    variantValue: settingDiff.variantValue,
    affectedLayer: settingDiff.affectedLayer,
    changedPlacementIds: [settingDiff.baselinePlacementId, settingDiff.variantPlacementId].filter(Boolean),
    metricDeltas,
    interpretedDeltas: interpretRenderSettingDelta(metricDeltas, settingDiff.settingName),
    confidence: "smoke_observed",
    rawEvidenceRefs: [str(comparisonBase.observationRef), str(pass.observationRef)].filter(Boolean)
  }));
}

function equivalentWithinTolerance(left = {}, right = {}, tolerance = 0.000001) {
  const important = [
    "activeModelCount",
    "maxActiveNodeCount",
    "meanSceneSpreadRatio",
    "maxSceneSpreadRatio",
    "meanColorSpread",
    "multicolorFrameRatio",
    "centroidMotionMean",
    "brightnessDeltaMean",
    "nodeCountDeltaMean"
  ];
  const l = metricSnapshot(left);
  const r = metricSnapshot(right);
  return important.every((key) => Math.abs(num(l[key]) - num(r[key])) <= tolerance)
    && JSON.stringify(l.activeModelNames) === JSON.stringify(r.activeModelNames)
    && l.dominantColorRole === r.dominantColorRole;
}

function inferCandidateLearning({ pass, baselineDelta, previousDelta, equivalentToPass = "" } = {}) {
  const statements = [];
  if (baselineDelta.addedActiveModels.length) {
    statements.push(`activates ${baselineDelta.addedActiveModels.join(", ")}`);
  }
  if (baselineDelta.maxActiveNodeCountDelta > 0) {
    statements.push(`adds ${baselineDelta.maxActiveNodeCountDelta} active nodes over baseline`);
  }
  if (Math.abs(baselineDelta.meanSceneSpreadRatioDelta) > 0.001) {
    statements.push(`${baselineDelta.meanSceneSpreadRatioDelta > 0 ? "increases" : "reduces"} scene spread`);
  }
  if (baselineDelta.multicolorFrameRatioDelta > 0 || baselineDelta.meanColorSpreadDelta > 0) {
    statements.push("increases observed color variety");
  }
  if (Math.abs(previousDelta.centroidMotionMeanDelta) > 0.01) {
    statements.push(`${previousDelta.centroidMotionMeanDelta > 0 ? "adds" : "reduces"} centroid motion versus previous pass`);
  }
  if (equivalentToPass) {
    statements.push(`renders equivalent to ${equivalentToPass} for measured macro metrics`);
  }
  return {
    learningId: str(pass.learningId),
    passId: str(pass.passId),
    confidence: statements.length ? "smoke_observed" : "no_macro_change_detected",
    statements
  };
}

export function buildLayerCompositionDeltas({ runRoot } = {}) {
  const root = path.resolve(str(runRoot));
  if (!root) throw new Error("runRoot is required");
  const plan = readJson(path.join(root, "training-plan.json"));
  const checkpoints = loadCompletedCheckpoints(root);
  const experimentGroups = sortedExperimentPasses(plan, checkpoints);
  const experiments = [];
  const observationsByPass = new Map(checkpoints.map((row) => [`${row.experimentId}::${row.passId}`, row.observation]));
  const renderSettingDeltaObservations = [];
  const effectSettingDeltaObservations = [];

  for (const { experiment, passes } of experimentGroups) {
    const baseline = passes.find((row) => row.passId === "empty_baseline") || passes[0];
    const baselineMacro = observationMacro(baseline?.observation);
    const passDeltas = [];
    for (let index = 0; index < passes.length; index += 1) {
      const pass = passes[index];
      const previous = index > 0 ? passes[index - 1] : baseline;
      const currentMacro = observationMacro(pass.observation);
      const baselineDelta = deltaSnapshot(currentMacro, baselineMacro);
      const previousDelta = deltaSnapshot(currentMacro, observationMacro(previous.observation));
      const placementSummary = summarizePlacements(pass.passPlan);
      const comparisonBasePassId = str(pass.passPlan?.comparisonBasePassId);
      const comparisonBase = comparisonBasePassId
        ? passes.find((candidate) => str(candidate.passId) === comparisonBasePassId)
        : null;
      const passRenderSettingDeltas = buildRenderSettingDeltaObservations({
        runId: plan.runId,
        experiment,
        pass,
        comparisonBase
      });
      const passEffectSettingDeltas = buildEffectSettingDeltaObservations({
        runId: plan.runId,
        experiment,
        pass,
        comparisonBase
      });
      renderSettingDeltaObservations.push(...passRenderSettingDeltas);
      effectSettingDeltaObservations.push(...passEffectSettingDeltas);
      let equivalentToPass = "";
      if (pass.passId.includes("order_variant") || pass.passId.includes("reversed")) {
        const prior = passes.slice(0, index).find((candidate) => equivalentWithinTolerance(
          currentMacro,
          observationMacro(candidate.observation)
        ));
        equivalentToPass = str(prior?.passId);
      }
      passDeltas.push({
        passId: pass.passId,
        learningId: pass.learningId,
        observationRef: pass.observationRef,
        passPlanRef: pass.passPlanRef,
        placementSummary,
        comparisonBasePassId,
        changedLayerSettings: passRenderSettingDeltas.map((row) => ({
          settingName: row.settingName,
          baselineValue: row.baselineValue,
          variantValue: row.variantValue,
          affectedLayer: row.affectedLayer
        })),
        changedEffectSettings: passEffectSettingDeltas.map((row) => ({
          settingName: row.settingName,
          baselineValue: row.baselineValue,
          variantValue: row.variantValue,
          affectedLayer: row.affectedLayer
        })),
        renderSettingDeltas: passRenderSettingDeltas,
        effectSettingDeltas: passEffectSettingDeltas,
        baselineDelta,
        previousDelta,
        equivalentToPass,
        candidateLearning: inferCandidateLearning({ pass, baselineDelta, previousDelta, equivalentToPass })
      });
    }
    experiments.push({
      experimentId: experiment.experimentId,
      family: experiment.family,
      paletteProfile: experiment.paletteProfile,
      passCount: passDeltas.length,
      completedPassCount: passes.length,
      baselinePassId: baseline?.passId || "",
      passDeltas
    });
  }

  return {
    artifactType: "layer_composition_delta_summary_v1",
    artifactVersion: 1,
    generatedAt: new Date().toISOString(),
    runId: str(plan.runId),
    runRoot: root,
    experimentCount: experiments.length,
    completedObservationCount: checkpoints.length,
    experiments,
    renderSettingDeltaObservationCount: renderSettingDeltaObservations.length,
    renderSettingDeltaObservations,
    effectSettingDeltaObservationCount: effectSettingDeltaObservations.length,
    effectSettingDeltaObservations,
    candidateLearningCount: experiments.reduce((total, experiment) => total + experiment.passDeltas.length, 0),
    candidateLearnings: experiments.flatMap((experiment) => experiment.passDeltas.map((pass) => ({
      experimentId: experiment.experimentId,
      family: experiment.family,
      paletteProfile: experiment.paletteProfile,
      ...pass.candidateLearning
    })))
  };
}

function parseArgs(argv) {
  const args = { runRoot: "", outPath: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--run-root") args.runRoot = argv[++index];
    else if (arg === "--out") args.outPath = argv[++index];
    else if (arg === "--help") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return `Usage:
  node scripts/sequencer-render-training/tooling/build-layer-composition-deltas.mjs --run-root <run-dir> --out <delta-summary.json>
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(usage());
    return;
  }
  if (!args.runRoot) throw new Error("--run-root is required");
  if (!args.outPath) throw new Error("--out is required");
  const summary = buildLayerCompositionDeltas({ runRoot: args.runRoot });
  writeJson(args.outPath, summary);
  process.stdout.write(`${args.outPath}\n`);
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch((error) => {
    console.error(error?.stack || String(error));
    process.exit(1);
  });
}
