import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildLayerCompositionTrainingPlan } from "./build-layer-composition-training-plan.mjs";
import { buildLayerCompositionExecutionScaffold } from "./run-layer-composition-execution-scaffold.mjs";
import {
  appendLayerCompositionAdaptiveRefill,
  buildLayerCompositionAdaptiveRefillPlan
} from "./build-layer-composition-adaptive-refill.mjs";

const modelCatalog = {
  layoutName: "RenderTraining",
  showDir: "/tmp/render-training",
  fixtureSequencePath: "/tmp/render-training/RenderTraining-AnimationFixture.xsq",
  canonicalModels: {
    single_line_horizontal: { modelName: "SingleLineHorizontal", modelType: "single_line", geometryProfile: "single_line_horizontal", analyzerFamily: "linear" },
    arch_group: { modelName: "ArchGroup", modelType: "arch", geometryProfile: "arch_grouped", analyzerFamily: "linear" },
    arch_single: { modelName: "ArchSingle", modelType: "arch", geometryProfile: "arch_single", analyzerFamily: "linear" },
    spinner: { modelName: "Spinner", modelType: "spinner_standard", geometryProfile: "spinner_standard", analyzerFamily: "radial" },
    star_triple_layer: { modelName: "StarTripleLayer", modelType: "star", geometryProfile: "star_multi_layer", analyzerFamily: "star" },
    tree_flat: { modelName: "TreeFlat", modelType: "tree_flat", geometryProfile: "tree_flat_single_layer", analyzerFamily: "tree" }
  }
};

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "xld-layer-refill-"));
}

test("adaptive refill plan creates deterministic deeper setting probes from high-priority experiments", () => {
  const plan = buildLayerCompositionTrainingPlan({ modelCatalog, runId: "refill-run", runType: "overnight" });
  const refill = buildLayerCompositionAdaptiveRefillPlan({ plan, refillAttempt: 1 });
  const experimentIds = refill.experiments.map((experiment) => experiment.experimentId);
  const allPasses = refill.experiments.flatMap((experiment) => experiment.passes);
  const bandSizePass = allPasses.find((pass) => pass.refillSourcePassId === "structure_effect_band_size_ab");
  const reversePass = allPasses.find((pass) => pass.refillSourcePassId === "structure_effect_reverse_ab");

  assert.equal(refill.status, "adaptive_refill_plan");
  assert.equal(experimentIds.some((id) => id.includes("setting-attribution-probe-mono_white-refill_001")), true);
  assert.equal(experimentIds.some((id) => id.includes("low-movement-setting-geometry-probe-tree_flat-rgb_primary-refill_001")), true);
  assert.equal(experimentIds.some((id) => id.includes("same-target-layer-stack-rgb_primary-render-refill_001")), true);
  assert.equal(experimentIds.some((id) => id.includes("setting-sensitivity-edge-probe-rgb_primary-render-refill_001")), true);
  assert.equal(experimentIds.some((id) => id.includes("manifest_sample_effect_survey")), true);
  assert.equal(experimentIds.some((id) => id.includes("arch_single")), false);
  assert.equal(bandSizePass.placements[0].effectSettings.bandSize, 1);
  assert.equal(bandSizePass.learningSeed.learningId.includes("adaptive_refill:refill_001:bandSize:1"), true);
  assert.equal(reversePass, undefined);
  assert.equal(allPasses.filter((pass) => pass.passId !== "empty_baseline").every((pass) => pass.passId.includes("refill_001")), true);
});

test("adaptive refill adds broad manifest sample effect survey experiments", () => {
  const plan = buildLayerCompositionTrainingPlan({ modelCatalog, runId: "refill-run", runType: "overnight" });
  const refill = buildLayerCompositionAdaptiveRefillPlan({ plan, refillAttempt: 1 });
  const surveyExperiments = refill.experiments.filter((experiment) => experiment.family === "manifest_sample_effect_survey");
  const samplePasses = surveyExperiments.flatMap((experiment) => experiment.passes.filter((pass) => pass.changeType === "manifest_sample_effect"));

  assert.equal(surveyExperiments.length > 0, true);
  assert.equal(samplePasses.length, surveyExperiments.length);
  assert.equal(samplePasses.every((pass) => pass.learningSeed?.learningId), true);
  assert.equal(samplePasses.every((pass) => pass.placements[0].layerIntent.trainingSampleRef?.sampleId), true);
  assert.equal(new Set(surveyExperiments.map((experiment) => experiment.paletteProfile)).has("mono_white"), true);
  assert.equal(new Set(surveyExperiments.map((experiment) => experiment.paletteProfile)).has("rgb_primary"), true);
});

test("adaptive refill prioritizes weak quality evidence for revalidation", () => {
  const plan = buildLayerCompositionTrainingPlan({ modelCatalog, runId: "refill-run", runType: "overnight" });
  const qualityTrend = {
    artifactType: "layer_composition_quality_trend_v1",
    groups: [
      {
        experimentId: "group-model-interplay-mono_white",
        passId: "foundation_group_only",
        trendStatus: "regressing",
        latestDecision: "accept",
        latestOverallQuality: 0.61,
        latestRenderReviewRef: "/tmp/render-review.json"
      }
    ]
  };
  const refill = buildLayerCompositionAdaptiveRefillPlan({ plan, refillAttempt: 1, qualityTrend });
  const qualityExperiment = refill.experiments.find((experiment) => experiment.adaptiveRefill?.policy === "quality_trend_revalidation");

  assert.equal(refill.adaptiveRefill.qualityRevalidationExperimentCount, 1);
  assert.equal(qualityExperiment.experimentId, "group-model-interplay-mono_white-quality-refill_001");
  assert.equal(qualityExperiment.passes.some((pass) => pass.passId === "empty_baseline_refill_001"), true);
  const recheck = qualityExperiment.passes.find((pass) => pass.refillPolicy === "quality_trend_revalidation");
  assert.equal(recheck.passId, "foundation_group_only_refill_001_quality_recheck");
  assert.equal(recheck.learningSeed.evidenceFingerprintInputs.qualityTrendStatus, "regressing");
  assert.equal(recheck.placements[0].layerIntent.attributionRole, "quality_trend_revalidation");
});

test("adaptive refill ignores stable accepted quality evidence", () => {
  const plan = buildLayerCompositionTrainingPlan({ modelCatalog, runId: "refill-run", runType: "overnight" });
  const qualityTrend = {
    groups: [
      {
        experimentId: "group-model-interplay-mono_white",
        passId: "foundation_group_only",
        trendStatus: "stable",
        latestDecision: "accept",
        latestOverallQuality: 0.86
      }
    ]
  };
  const refill = buildLayerCompositionAdaptiveRefillPlan({ plan, refillAttempt: 1, qualityTrend });

  assert.equal(refill.adaptiveRefill.qualityRevalidationExperimentCount, 0);
  assert.equal(refill.experiments.some((experiment) => experiment.adaptiveRefill?.policy === "quality_trend_revalidation"), false);
});

test("adaptive refill stops when deterministic variant values are exhausted", () => {
  const plan = buildLayerCompositionTrainingPlan({ modelCatalog, runId: "refill-run", runType: "overnight" });
  const refill = buildLayerCompositionAdaptiveRefillPlan({ plan, refillAttempt: 17 });

  assert.equal(refill.experiments.length, 0);
});

test("adaptive refill creates deterministic render-setting depth probes", () => {
  const plan = buildLayerCompositionTrainingPlan({ modelCatalog, runId: "refill-run", runType: "overnight" });
  const refill = buildLayerCompositionAdaptiveRefillPlan({ plan, refillAttempt: 1 });
  const allPasses = refill.experiments.flatMap((experiment) => experiment.passes);
  const brightnessPass = allPasses.find((pass) => pass.refillSourcePassId === "foundation_brightness_variant");
  const fadePass = allPasses.find((pass) => pass.refillSourcePassId === "detail_fade_variant");

  assert.equal(brightnessPass.placements[0].layerSettings.brightness, 20);
  assert.equal(brightnessPass.passId.includes("brightness_20"), true);
  assert.equal(brightnessPass.refillPolicy, "deterministic_render_setting_probe");
  assert.equal(fadePass.placements.some((placement) => placement.layerSettings.fadeIn === "0.10"), true);
  assert.equal(fadePass.placements.some((placement) => placement.layerSettings.fadeOut === "0.10"), true);
  assert.equal(fadePass.passId.includes("fadeIn_0.10"), true);
  assert.equal(fadePass.passId.includes("fadeOut_0.10"), true);
});

test("adaptive refill preserves zero-valued setting variants in pass ids", () => {
  const plan = buildLayerCompositionTrainingPlan({ modelCatalog, runId: "refill-run", runType: "overnight" });
  const refill = buildLayerCompositionAdaptiveRefillPlan({ plan, refillAttempt: 1 });
  const skipSizePass = refill.experiments
    .flatMap((experiment) => experiment.passes)
    .find((pass) => pass.refillSourcePassId === "structure_effect_skip_size_ab");

  assert.equal(skipSizePass.placements[0].effectSettings.skipSize, 0);
  assert.equal(skipSizePass.passId.includes("skipSize_0"), true);
  assert.equal(skipSizePass.learningSeed.learningId.includes("skipSize:0"), true);
});

test("adaptive refill appends new checkpoints without replacing existing run state", () => {
  const runRoot = tempDir();
  const plan = buildLayerCompositionTrainingPlan({ modelCatalog, runId: "refill-run", runType: "overnight" });
  const planPath = path.join(runRoot, "training-plan.json");
  fs.writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`);
  const initial = buildLayerCompositionExecutionScaffold({ plan, planPath, runRoot });
  const result = appendLayerCompositionAdaptiveRefill({ runRoot, plan, planPath, refillAttempt: 1 });
  const checkpoints = JSON.parse(fs.readFileSync(path.join(runRoot, "checkpoints.json"), "utf8"));

  assert.equal(result.status, "appended_pending_apply_render");
  assert.equal(result.appendedCheckpointCount > 0, true);
  assert.equal(checkpoints.checkpointCount, initial.passCount + result.appendedCheckpointCount);
  assert.equal(fs.existsSync(result.refillPlanRef), true);
  assert.equal(
    checkpoints.checkpoints.some((row) => row.experimentId.includes("refill_001") && row.passId.includes("refill_001")),
    true
  );
});
