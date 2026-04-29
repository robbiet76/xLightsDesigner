import test from "node:test";
import assert from "node:assert/strict";

import { buildLayerCompositionTrainingPlan } from "./build-layer-composition-training-plan.mjs";
import { buildLayerCompositionPassExecution } from "./build-layer-composition-pass-execution.mjs";

const modelCatalog = {
  layoutName: "RenderTraining",
  showDir: "/tmp/render-training",
  fixtureSequencePath: "/tmp/render-training/RenderTraining-AnimationFixture.xsq",
  canonicalModels: {
    single_line_horizontal: { modelName: "SingleLineHorizontal", modelType: "single_line", geometryProfile: "single_line_horizontal", analyzerFamily: "linear" },
    arch_group: { modelName: "ArchGroup", modelType: "arch", geometryProfile: "arch_grouped", analyzerFamily: "linear" },
    arch_single: { modelName: "ArchSingle", modelType: "arch", geometryProfile: "arch_single", analyzerFamily: "linear" },
    spinner: { modelName: "Spinner", modelType: "spinner", geometryProfile: "spinner_standard", analyzerFamily: "radial" },
    star_triple_layer: { modelName: "StarTripleLayer", modelType: "star", geometryProfile: "star_multi_layer", analyzerFamily: "star" },
    tree_flat: { modelName: "TreeFlat", modelType: "tree_flat", geometryProfile: "tree_flat_single_layer", analyzerFamily: "tree" }
  }
};

test("pass execution maps placements to owned batch effects and timing marks", () => {
  const plan = buildLayerCompositionTrainingPlan({ modelCatalog, runId: "execution-test", runType: "smoke" });
  const experiment = plan.experiments.find((row) => row.experimentId === "group-model-interplay-rgb_primary");
  const pass = experiment.passes.find((row) => row.passId === "group_then_model");
  const passPlan = {
    ...pass,
    experimentId: experiment.experimentId,
    family: experiment.family,
    paletteProfile: experiment.paletteProfile,
    coverageKey: experiment.coverageKey
  };

  const execution = buildLayerCompositionPassExecution({ plan, passPlan });

  assert.equal(execution.artifactType, "layer_composition_pass_execution_v1");
  assert.equal(execution.ownedBatchPayload.track, "XD: Layer Composition Training");
  assert.equal(execution.ownedBatchPayload.marks.length > 1, true);
  assert.deepEqual(execution.ownedBatchPayload.marks[0], { label: "section-01", startMs: 0, endMs: 1000 });
  assert.equal(execution.ownedBatchPayload.marks.at(-1).endMs, 30000);
  assert.equal(execution.ownedBatchPayload.effects.length, 3);
  assert.equal(execution.ownedBatchPayload.effects[0].element, "ArchGroup");
  assert.equal(execution.ownedBatchPayload.effects[0].layer, 0);
  assert.match(execution.ownedBatchPayload.effects[0].settings, /E_SLIDER_Bars_Bar_Count=3/);
  assert.match(execution.ownedBatchPayload.effects[0].palette, /C_BUTTON_Palette2=#FF0000/);
  assert.match(execution.ownedBatchPayload.effects[0].palette, /C_CHECKBOX_Palette2=1/);
  assert.match(execution.ownedBatchPayload.effects[0].palette, /C_CHECKBOX_Palette1=0/);
  assert.equal(execution.directCommands.length, 1);
  assert.deepEqual(execution.directCommands[0].params.orderedIds, ["ArchGroup", "ArchSingle", "Spinner"]);
});

test("pass execution translates sampled effect intent settings into xLights serialized keys", () => {
  const plan = buildLayerCompositionTrainingPlan({ modelCatalog, runId: "execution-test", runType: "smoke" });
  const experiment = plan.experiments.find((row) => row.experimentId === "setting-sensitivity-edge-probe-rgb_primary");
  const pass = experiment.passes.find((row) => row.passId === "edge_stack_default");
  const passPlan = {
    ...pass,
    experimentId: experiment.experimentId,
    family: experiment.family,
    paletteProfile: experiment.paletteProfile,
    coverageKey: experiment.coverageKey
  };

  const execution = buildLayerCompositionPassExecution({ plan, passPlan });
  const settings = execution.ownedBatchPayload.effects.map((row) => row.settings).join(",");

  assert.match(settings, /E_SLIDER_Bars_Bar_Count=/);
  assert.match(settings, /E_CHOICE_Bars_Direction=/);
  assert.match(settings, /B_CHOICE_BufferStyle=/);
  assert.match(settings, /E_TEXTCTRL_Marquee_Skip_Size=/);
  assert.match(settings, /E_TEXTCTRL_Marquee_Speed=/);
  assert.doesNotMatch(settings, /(?:^|,)barCount=/);
  assert.doesNotMatch(settings, /(?:^|,)skipSize=/);
  assert.doesNotMatch(settings, /(?:^|,)renderStyle=/);
});

test("pass execution maps verified layer render settings into owned batch settings and palette strings", () => {
  const plan = buildLayerCompositionTrainingPlan({ modelCatalog, runId: "execution-test", runType: "smoke" });
  const experiment = plan.experiments.find((row) => row.experimentId === "same-target-layer-stack-mono_white");
  const pass = experiment.passes.find((row) => row.passId === "foundation_brightness_variant");
  const passPlan = {
    ...pass,
    experimentId: experiment.experimentId,
    family: experiment.family,
    paletteProfile: experiment.paletteProfile,
    coverageKey: experiment.coverageKey
  };

  const execution = buildLayerCompositionPassExecution({ plan, passPlan });

  assert.equal(execution.ownedBatchPayload.effects.length, 3);
  const foundation = execution.ownedBatchPayload.effects.find((row) => row.metadata.placementId === "st-mono_white-foundation-brightness-variant");
  assert.match(foundation.settings, /T_CHOICE_LayerMethod=Normal/);
  assert.match(foundation.palette, /C_SLIDER_Brightness=65/);
  assert.equal(execution.appliedLayerSettings.some((row) => row.settingName === "brightness" && row.serializedKey === "C_SLIDER_Brightness"), true);
  assert.equal(execution.unsupportedLayerSettings.length, 0);
});

test("pass execution captures unmapped layer settings as explicit gaps", () => {
  const plan = buildLayerCompositionTrainingPlan({ modelCatalog, runId: "execution-test", runType: "smoke" });
  const passPlan = {
    experimentId: "custom",
    paletteProfile: "mono_white",
    passId: "unsupported",
    displayElementOrder: ["ArchGroup"],
    placements: [{
      placementId: "unsupported-setting",
      target: "ArchGroup",
      targetScope: "group",
      effectName: "Bars",
      startMs: 1000,
      endMs: 5000,
      layerIndex: 0,
      layerSettings: { unsupportedFutureSetting: 1 }
    }]
  };

  const execution = buildLayerCompositionPassExecution({ plan, passPlan });

  assert.equal(execution.unsupportedLayerSettings.length, 1);
  assert.equal(execution.unsupportedLayerSettings[0].settingName, "unsupportedFutureSetting");
  assert.match(execution.unsupportedLayerSettings[0].reason, /No verified xLights serialized setting key/);
});
