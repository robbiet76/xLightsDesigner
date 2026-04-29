import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildLayerCompositionDeltas } from "./build-layer-composition-deltas.mjs";

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
  return filePath;
}

function observation(activeModelNames, extra = {}) {
  return {
    artifactType: "composition_stack_observation_v1",
    renderObservation: {
      macro: {
        activeModelNames,
        activeModelTotals: Object.fromEntries(activeModelNames.map((name) => [name, 10])),
        maxActiveNodeCount: activeModelNames.length * 10,
        meanSceneSpreadRatio: activeModelNames.length * 0.01,
        maxSceneSpreadRatio: activeModelNames.length * 0.02,
        dominantColorRole: "mixed",
        meanColorSpread: 0,
        multicolorFrameRatio: 0,
        centroidMotionMean: 0,
        brightnessDeltaMean: 0,
        brightnessDeltaMax: 0,
        nodeCountDeltaMean: 0,
        ...extra
      }
    }
  };
}

function setupRun() {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "xld-layer-deltas-"));
  const plan = {
    runId: "delta-test",
    experiments: [{
      experimentId: "group-model-interplay-mono_white",
      family: "group_model_interplay",
      paletteProfile: "mono_white",
      passes: [
        { passId: "empty_baseline" },
        { passId: "foundation_group_only" },
        { passId: "model_then_group_order_variant" },
        { passId: "foundation_effect_variant" },
        { passId: "foundation_brightness_variant" }
      ]
    }]
  };
  writeJson(path.join(runRoot, "training-plan.json"), plan);
  const checkpoints = [];
  [
    ["empty_baseline", observation([])],
    ["foundation_group_only", observation(["ArchGroup"])],
    ["model_then_group_order_variant", observation(["ArchGroup"])],
    ["foundation_effect_variant", observation(["ArchGroup"], {
      meanColorSpread: 0.2,
      colorSequenceChangeMean: 0.15,
      rgbSimilarityMean: 0.7
    })],
    ["foundation_brightness_variant", observation(["ArchGroup"], {
      brightnessDeltaMean: 0.1,
      brightnessDeltaMax: 0.3,
      meanEdgeSoftness: 0.2,
      activeNodeRetentionMean: 0.5,
      rgbSimilarityMean: 0.4,
      brightnessSimilarityMean: 0.6,
      openingToMiddleBrightnessDelta: 0.12
    })]
  ].forEach(([passId, obs]) => {
    const passDir = path.join(runRoot, "passes", passId);
    const observationRef = writeJson(path.join(passDir, "composition-stack-observation.json"), obs);
    const passPlanRef = writeJson(path.join(passDir, "pass-plan.json"), {
      compositionPass: passId === "foundation_brightness_variant" ? "render_setting_variant" : passId === "foundation_effect_variant" ? "effect_setting_variant" : "foundation",
      changeType: passId === "foundation_brightness_variant" ? "layer_render_setting" : passId === "foundation_effect_variant" ? "effect_setting" : "",
      comparisonBasePassId: passId === "foundation_brightness_variant" || passId === "foundation_effect_variant" ? "foundation_group_only" : "",
      placements: passId === "empty_baseline" ? [] : [{
        target: "ArchGroup",
        targetScope: "group",
        modelType: "arch",
        geometryProfile: "arch_grouped",
        effectName: "Bars",
        compositionPass: "foundation",
        layerIndex: 0,
        effectSettings: passId === "foundation_effect_variant" ? { barCount: 5, direction: "Left" } : { barCount: 3, direction: "Left" },
        layerSettings: passId === "foundation_brightness_variant" ? { mixMethod: "Normal", brightness: 65 } : { mixMethod: "Normal" },
        layerIntent: { blendRole: "foundation" }
      }]
    });
    const checkpointRef = writeJson(path.join(passDir, "checkpoint.json"), {
      status: "completed",
      experimentId: "group-model-interplay-mono_white",
      passId,
      learningId: `learning:${passId}`,
      observationRef
    });
    checkpoints.push({ checkpointRef, passPlanRef });
  });
  writeJson(path.join(runRoot, "checkpoints.json"), { checkpoints });
  return runRoot;
}

test("delta builder compares passes against baseline and detects equivalent order variants", () => {
  const runRoot = setupRun();
  const summary = buildLayerCompositionDeltas({ runRoot });

  assert.equal(summary.artifactType, "layer_composition_delta_summary_v1");
  assert.equal(summary.completedObservationCount, 5);
  const experiment = summary.experiments[0];
  assert.equal(experiment.passDeltas.length, 5);
  const foundation = experiment.passDeltas.find((row) => row.passId === "foundation_group_only");
  assert.deepEqual(foundation.baselineDelta.addedActiveModels, ["ArchGroup"]);
  assert.equal(foundation.baselineDelta.maxActiveNodeCountDelta, 10);
  assert.deepEqual(foundation.placementSummary.effectNames, ["Bars"]);
  assert.deepEqual(foundation.placementSummary.targetScopes, ["group"]);
  assert.equal(foundation.placementSummary.hasGroupScope, true);
  const orderVariant = experiment.passDeltas.find((row) => row.passId === "model_then_group_order_variant");
  assert.equal(orderVariant.equivalentToPass, "foundation_group_only");
  const settingVariant = experiment.passDeltas.find((row) => row.passId === "foundation_brightness_variant");
  assert.equal(settingVariant.comparisonBasePassId, "foundation_group_only");
  assert.deepEqual(settingVariant.changedLayerSettings.map((row) => row.settingName), ["brightness"]);
  assert.equal(settingVariant.renderSettingDeltas[0].artifactType, "render_setting_delta_observation_v1");
  assert.equal(settingVariant.renderSettingDeltas[0].settingName, "brightness");
  assert.equal(settingVariant.renderSettingDeltas[0].variantValue, 65);
  assert.equal(settingVariant.renderSettingDeltas[0].metricDeltas.brightnessDeltaMeanDelta, 0.1);
  assert.equal(settingVariant.renderSettingDeltas[0].metricDeltas.meanEdgeSoftnessDelta, 0.2);
  assert.equal(settingVariant.renderSettingDeltas[0].metricDeltas.activeNodeRetentionMeanDelta, 0.5);
  assert.equal(settingVariant.renderSettingDeltas[0].interpretedDeltas.includes("edge_softness_increased"), true);
  assert.equal(settingVariant.renderSettingDeltas[0].interpretedDeltas.includes("active_node_persistence_increased"), true);
  assert.equal(summary.renderSettingDeltaObservationCount, 1);
  assert.equal(summary.renderSettingDeltaObservations[0].toPassId, "foundation_brightness_variant");
  const effectVariant = experiment.passDeltas.find((row) => row.passId === "foundation_effect_variant");
  assert.equal(effectVariant.comparisonBasePassId, "foundation_group_only");
  assert.deepEqual(effectVariant.changedEffectSettings.map((row) => row.settingName), ["barCount"]);
  assert.equal(effectVariant.effectSettingDeltas[0].artifactType, "effect_setting_delta_observation_v1");
  assert.equal(effectVariant.effectSettingDeltas[0].variantValue, 5);
  assert.equal(effectVariant.effectSettingDeltas[0].metricDeltas.colorSequenceChangeMeanDelta, 0.15);
  assert.equal(effectVariant.effectSettingDeltas[0].interpretedDeltas.includes("color_position_motion_increased"), true);
  assert.equal(summary.effectSettingDeltaObservationCount, 1);
  assert.equal(summary.effectSettingDeltaObservations[0].toPassId, "foundation_effect_variant");
  assert.equal(summary.candidateLearnings.some((row) => row.statements.some((text) => text.includes("renders equivalent"))), true);
});
