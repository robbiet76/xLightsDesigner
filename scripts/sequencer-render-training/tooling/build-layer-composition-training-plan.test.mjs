import test from "node:test";
import assert from "node:assert/strict";

import {
  buildLayerCompositionTrainingPlan,
  RUNTIME_BUDGETS
} from "./build-layer-composition-training-plan.mjs";

const modelCatalog = {
  layoutName: "RenderTraining",
  showDir: "/tmp/render-training",
  fixtureSequencePath: "/tmp/render-training/RenderTraining-AnimationFixture.xsq",
  canonicalModels: {
    single_line_horizontal: {
      modelName: "SingleLineHorizontal",
      modelType: "single_line",
      geometryProfile: "single_line_horizontal",
      analyzerFamily: "linear"
    },
    arch_group: {
      modelName: "ArchGroup",
      modelType: "arch",
      geometryProfile: "arch_grouped",
      analyzerFamily: "linear"
    },
    arch_single: {
      modelName: "ArchSingle",
      modelType: "arch",
      geometryProfile: "arch_single",
      analyzerFamily: "linear"
    },
    spinner: {
      modelName: "Spinner",
      modelType: "spinner",
      geometryProfile: "spinner_standard",
      analyzerFamily: "radial"
    },
    star_triple_layer: {
      modelName: "StarTripleLayer",
      modelType: "star",
      geometryProfile: "star_multi_layer",
      analyzerFamily: "star"
    },
    tree_flat: {
      modelName: "TreeFlat",
      modelType: "tree_flat",
      geometryProfile: "tree_flat_single_layer",
      analyzerFamily: "tree"
    }
  },
  submodelTargets: {
    vendor_basic: {
      modelType: "custom",
      geometryProfile: "custom_structural",
      analyzerFamily: "submodel",
      parentModel: {
        modelName: "CustomFace",
        modelType: "custom",
        geometryProfile: "custom_parent",
        analyzerFamily: "submodel"
      },
      submodels: [
        {
          name: "Face",
          fullName: "CustomFace/Face",
          parentModelName: "CustomFace",
          nodeCount: 40,
          type: "ranges",
          lines: "1-40"
        },
        {
          name: "Mouth",
          fullName: "CustomFace/Mouth",
          parentModelName: "CustomFace",
          nodeCount: 12,
          type: "ranges",
          lines: "41-52"
        }
      ]
    }
  }
};

test("layer composition training plan defaults to overnight learning budget", () => {
  const plan = buildLayerCompositionTrainingPlan({ modelCatalog, runId: "test-run" });

  assert.equal(plan.artifactType, "layer_composition_experiment_manifest_v1");
  assert.equal(plan.runType, "overnight");
  assert.equal(plan.runtimeBudget.minRuntimeMinutes, RUNTIME_BUDGETS.overnight.minRuntimeMinutes);
  assert.equal(plan.runtimeBudget.targetRuntimeMinutes, RUNTIME_BUDGETS.overnight.targetRuntimeMinutes);
  assert.equal(plan.maxRuntimeMinutes, RUNTIME_BUDGETS.overnight.maxRuntimeMinutes);
  assert.equal(plan.promotionPolicy.promoteByDefault, false);
});

test("layer composition training plan includes group/model and same-target layer experiments for both palettes", () => {
  const plan = buildLayerCompositionTrainingPlan({ modelCatalog, runId: "test-run" });
  const experimentIds = plan.experiments.map((experiment) => experiment.experimentId);

  assert.equal(plan.paletteProfiles.length, 2);
  assert.equal(experimentIds.includes("group-model-interplay-mono_white"), true);
  assert.equal(experimentIds.includes("group-model-interplay-rgb_primary"), true);
  assert.equal(experimentIds.includes("same-target-layer-stack-mono_white"), true);
  assert.equal(experimentIds.includes("same-target-layer-stack-rgb_primary"), true);
  assert.equal(experimentIds.includes("submodel-structure-vendor_basic-mono_white"), true);
  assert.equal(experimentIds.includes("submodel-structure-vendor_basic-rgb_primary"), true);
  assert.equal(experimentIds.includes("setting-sensitivity-edge-probe-mono_white"), true);
  assert.equal(experimentIds.includes("setting-sensitivity-edge-probe-rgb_primary"), true);
  assert.equal(experimentIds.includes("setting-attribution-probe-mono_white"), true);
  assert.equal(experimentIds.includes("setting-attribution-probe-rgb_primary"), true);
  assert.equal(experimentIds.includes("low-movement-setting-geometry-probe-arch_single-rgb_primary"), false);
  assert.equal(experimentIds.includes("low-movement-setting-geometry-probe-tree_flat-rgb_primary"), true);
  assert.equal(
    plan.experiments.some((experiment) => experiment.passes.some((pass) => pass.changeType === "display_element_order")),
    true
  );
  assert.equal(
    plan.experiments.some((experiment) => experiment.passes.some((pass) => pass.changeType === "layer_order")),
    true
  );
  assert.equal(
    plan.experiments.some((experiment) => experiment.passes.some((pass) => pass.changeType === "layer_render_setting")),
    true
  );
  const sameTarget = plan.experiments.find((experiment) => experiment.experimentId === "same-target-layer-stack-rgb_primary");
  const threeLayer = sameTarget.passes.find((pass) => pass.passId === "three_layer_default");
  assert.equal(
    threeLayer.placements.some((placement) => placement.effectName === "SingleStrand"),
    true
  );
  assert.equal(
    sameTarget.passes.flatMap((pass) => pass.placements).some((placement) => placement.effectName === "Shimmer"),
    false
  );
  const renderSettingPassIds = sameTarget.passes
    .filter((pass) => pass.changeType === "layer_render_setting")
    .map((pass) => pass.passId);
  for (const passId of [
    "foundation_brightness_variant",
    "foundation_contrast_variant",
    "foundation_canvas_variant",
    "structure_additive_mix_variant",
    "structure_mix_threshold_variant",
    "detail_blur_variant",
    "detail_persistent_variant",
    "detail_fade_variant"
  ]) {
    assert.equal(renderSettingPassIds.includes(passId), true);
  }
  const edgeProbe = plan.experiments.find((experiment) => experiment.experimentId === "setting-sensitivity-edge-probe-rgb_primary");
  assert.equal(edgeProbe.curriculumStage, "setting_sensitivity_survey");
  assert.equal(edgeProbe.targetSets[0].scope, "group");
  assert.equal(edgeProbe.targetSets[0].targets[0].modelName, "ArchGroup");
  assert.equal(edgeProbe.passes.find((pass) => pass.passId === "edge_stack_default").placements[0].layerIntent.trainingSampleRef.sampleId, "bars-archgroup-left-striped-v1");
  assert.equal(edgeProbe.passes.find((pass) => pass.passId === "edge_stack_default").placements[1].layerIntent.trainingSampleRef.sampleId, "marquee-archgroup-skip-8-anchor-v1");
  assert.equal(edgeProbe.passes.find((pass) => pass.passId === "edge_stack_default").placements[2].layerIntent.trainingSampleRef.sampleId, "marquee-archgroup-speed-9-anchor-v1");
  const attributionProbe = plan.experiments.find((experiment) => experiment.experimentId === "setting-attribution-probe-rgb_primary");
  assert.equal(attributionProbe.designType, "ab_and_fractional_factorial");
  assert.equal(attributionProbe.targetSets[0].targets[0].modelName, "SingleLineHorizontal");
  assert.equal(attributionProbe.passes.find((pass) => pass.passId === "structure_sparse_baseline").placements[0].layerIntent.trainingSampleRef.sampleId, "marquee-singlelinehorizontal-segmented-v1");
  assert.equal(attributionProbe.passes.find((pass) => pass.passId === "structure_effect_band_size_ab").changeType, "effect_setting");
  assert.deepEqual(
    attributionProbe.passes
      .filter((pass) => pass.changeType === "effect_setting")
      .map((pass) => pass.passId),
    [
      "structure_effect_band_size_ab",
      "structure_effect_skip_size_ab",
      "structure_effect_thickness_ab",
      "structure_effect_reverse_ab",
      "structure_effect_speed_ab",
      "detail_effect_count_ab",
      "detail_effect_steps_ab"
    ]
  );
  assert.equal(attributionProbe.passes.find((pass) => pass.passId === "detail_effect_count_ab").placements[1].layerIntent.effectSettingProbe.settingName, "count");
  assert.equal(attributionProbe.passes.find((pass) => pass.passId === "detail_effect_steps_ab").placements[1].layerIntent.effectSettingProbe.variantValue, 40);
  assert.deepEqual(
    attributionProbe.passes
      .filter((pass) => pass.changeType === "layer_render_setting")
      .map((pass) => pass.passId),
    [
      "structure_blur_layer_ab",
      "structure_fade_layer_ab",
      "detail_additive_layer_ab",
      "detail_mix_threshold_layer_ab"
    ]
  );
  const lowMovementArchSmoke = buildLayerCompositionTrainingPlan({ modelCatalog, runId: "test-run", runType: "smoke" })
    .experiments
    .find((experiment) => experiment.experimentId === "low-movement-setting-geometry-probe-arch_single-rgb_primary");
  assert.equal(lowMovementArchSmoke.designType, "single_parameter_alternate_geometry");
  assert.equal(lowMovementArchSmoke.targetSets[0].targets[0].modelName, "ArchSingle");
  assert.equal(lowMovementArchSmoke.runtimeSelection.includeInOvernightQueue, false);
  assert.deepEqual(
    lowMovementArchSmoke.passes
      .filter((pass) => pass.changeType === "effect_setting")
      .map((pass) => pass.passId),
    [
      "structure_effect_thickness_ab",
      "structure_effect_reverse_ab",
      "structure_effect_speed_ab"
    ]
  );
  assert.equal(
    lowMovementArchSmoke.passes.find((pass) => pass.passId === "structure_effect_reverse_ab").placements[0].layerIntent.effectSettingProbe.settingName,
    "reverse"
  );
  assert.deepEqual(
    edgeProbe.passes
      .filter((pass) => pass.changeType === "layer_render_setting")
      .map((pass) => pass.passId),
    [
      "foundation_canvas_variant",
      "structure_additive_mix_variant",
      "structure_mix_threshold_variant",
      "structure_blur_variant",
      "detail_persistent_variant",
      "structure_fade_variant"
    ]
  );
  assert.equal(plan.curriculum.strategy, "broad_to_specific");
  assert.equal(plan.curriculum.activeStage, "broad_composition_survey");
});

test("layer composition smoke run remains explicitly marked as validation only", () => {
  const plan = buildLayerCompositionTrainingPlan({ modelCatalog, runId: "test-run", runType: "smoke" });

  assert.equal(plan.runType, "smoke");
  assert.equal(plan.runtimeBudget.maxRuntimeMinutes, RUNTIME_BUDGETS.smoke.maxRuntimeMinutes);
  assert.match(plan.runtimeBudget.purpose, /Validate plan shape/);
  assert.equal(plan.curriculum.adaptiveRefillPolicy.enabled, false);
});

test("layer composition plan gives each pass a durable learning seed and coverage key", () => {
  const plan = buildLayerCompositionTrainingPlan({ modelCatalog, runId: "test-run" });
  const allPasses = plan.experiments.flatMap((experiment) => experiment.passes);

  assert.equal(allPasses.every((pass) => pass.learningSeed?.learningId), true);
  assert.equal(allPasses.every((pass) => pass.learningSeed?.coverageKey), true);
  assert.equal(allPasses.every((pass) => pass.learningSeed?.revalidationPolicy?.skipWhenDurablePriorExists), true);
  assert.equal(
    allPasses.some((pass) => pass.learningSeed.revalidationPolicy.validReasons.includes("prior_confidence_low")),
    true
  );
});

test("layer composition plan skips durable covered learnings from existing priors", () => {
  const initialPlan = buildLayerCompositionTrainingPlan({ modelCatalog, runId: "initial-run" });
  const firstPass = initialPlan.experiments[0].passes[0];
  const prior = {
    artifactType: "layer_composition_prior_v1",
    learningId: firstPass.learningSeed.learningId,
    coverageKey: firstPass.learningSeed.coverageKey,
    durabilityStatus: "durable",
    confidence: 0.82,
    revalidationReasons: []
  };

  const nextPlan = buildLayerCompositionTrainingPlan({
    modelCatalog,
    runId: "next-run",
    existingPriors: [prior]
  });
  const nextPasses = nextPlan.experiments.flatMap((experiment) => experiment.passes);

  assert.equal(
    nextPasses.some((pass) => pass.learningSeed.learningId === firstPass.learningSeed.learningId),
    false
  );
  assert.equal(nextPlan.curriculum.priorCoverageSummary.durablePriorCount, 1);
  assert.equal(nextPlan.curriculum.priorCoverageSummary.skippedLearningCount, 1);
});

test("layer composition plan keeps low-confidence priors for revalidation", () => {
  const initialPlan = buildLayerCompositionTrainingPlan({ modelCatalog, runId: "initial-run" });
  const firstPass = initialPlan.experiments[0].passes[0];
  const prior = {
    learningId: firstPass.learningSeed.learningId,
    coverageKey: firstPass.learningSeed.coverageKey,
    durabilityStatus: "durable",
    confidence: 0.4,
    revalidationReasons: ["prior_confidence_low"]
  };

  const nextPlan = buildLayerCompositionTrainingPlan({
    modelCatalog,
    runId: "next-run",
    existingPriors: [prior]
  });
  const nextPasses = nextPlan.experiments.flatMap((experiment) => experiment.passes);

  assert.equal(
    nextPasses.some((pass) => pass.learningSeed.learningId === firstPass.learningSeed.learningId),
    true
  );
  assert.equal(nextPlan.curriculum.priorCoverageSummary.durablePriorCount, 0);
  assert.equal(nextPlan.curriculum.priorCoverageSummary.revalidationCandidateCount, 1);
});

test("overnight layer composition plan is time-budget driven with adaptive refill", () => {
  const plan = buildLayerCompositionTrainingPlan({ modelCatalog, runId: "overnight-run", runType: "overnight" });

  assert.equal(plan.curriculum.adaptiveRefillPolicy.enabled, true);
  assert.equal(plan.curriculum.adaptiveRefillPolicy.goal, "continue_until_runtime_budget_or_hard_stop");
  assert.equal(plan.curriculum.adaptiveRefillPolicy.normalCompletionStatus, "runtime_budget_reached");
  assert.equal(
    plan.curriculum.adaptiveRefillPolicy.refillOrder[0],
    "uncovered_broad_composition_coverage"
  );
  assert.equal(
    plan.curriculum.adaptiveRefillPolicy.hardStopReasons.includes("no_valid_non_repeated_experiment"),
    true
  );
});

test("overnight layer composition plan prioritizes validated high-yield training families", () => {
  const plan = buildLayerCompositionTrainingPlan({ modelCatalog, runId: "overnight-run", runType: "overnight" });
  const experimentIds = plan.experiments.map((experiment) => experiment.experimentId);

  assert.deepEqual(
    experimentIds.slice(0, 2),
    ["setting-attribution-probe-mono_white", "setting-attribution-probe-rgb_primary"]
  );
  assert.equal(experimentIds.includes("low-movement-setting-geometry-probe-tree_flat-mono_white"), true);
  assert.equal(experimentIds.includes("low-movement-setting-geometry-probe-tree_flat-rgb_primary"), true);
  assert.equal(experimentIds.includes("low-movement-setting-geometry-probe-arch_single-mono_white"), false);
  assert.equal(experimentIds.includes("low-movement-setting-geometry-probe-arch_single-rgb_primary"), false);
  assert.equal(plan.curriculum.runtimeSelectionPolicy.strategy, "prioritized_time_budget_queue");
  assert.equal(plan.curriculum.runtimeSelectionPolicy.runSelectionSkipCount, 2);
  assert.equal(
    plan.curriculum.runtimeSelectionPolicy.overnightEmphasis.includes("setting_attribution_probe"),
    true
  );
  const attribution = plan.experiments.find((experiment) => experiment.experimentId === "setting-attribution-probe-rgb_primary");
  assert.equal(attribution.runtimeSelection.tier, "primary_setting_attribution");
  assert.equal(attribution.runtimeSelection.budgetWeight, 5);
  const tree = plan.experiments.find((experiment) => experiment.experimentId === "low-movement-setting-geometry-probe-tree_flat-rgb_primary");
  assert.equal(tree.runtimeSelection.tier, "high_value_geometry_retest");
  assert.equal(tree.runtimeSelection.budgetWeight, 3);
});

test("smoke layer composition plan keeps validation-only low-yield retests available", () => {
  const plan = buildLayerCompositionTrainingPlan({ modelCatalog, runId: "smoke-run", runType: "smoke" });
  const experimentIds = plan.experiments.map((experiment) => experiment.experimentId);
  const arch = plan.experiments.find((experiment) => experiment.experimentId === "low-movement-setting-geometry-probe-arch_single-rgb_primary");

  assert.equal(experimentIds.includes("low-movement-setting-geometry-probe-arch_single-rgb_primary"), true);
  assert.equal(arch.runtimeSelection.tier, "deferred_low_yield_retest");
  assert.equal(arch.runtimeSelection.includeInSmokeValidation, true);
  assert.equal(arch.runtimeSelection.includeInOvernightQueue, false);
  assert.equal(plan.curriculum.runtimeSelectionPolicy.strategy, "validation_preserves_manifest_order");
  assert.equal(plan.curriculum.runtimeSelectionPolicy.runSelectionSkipCount, 0);
});

test("layer composition plan includes incremental summarization and cleanup policy", () => {
  const plan = buildLayerCompositionTrainingPlan({ modelCatalog, runId: "overnight-run", runType: "overnight" });

  assert.equal(plan.retentionPolicy.summarizeAsYouGo, true);
  assert.equal(plan.retentionPolicy.cleanupMode, "purge_summarized_raw_artifacts");
  assert.equal(plan.retentionPolicy.checkpoints.includes("after_delta_pair"), true);
  assert.equal(plan.retentionPolicy.alwaysKeep.includes("composition_stack_observation"), true);
  assert.equal(plan.retentionPolicy.purgeWhenSummarized.includes("raw_fseq"), true);
  assert.equal(plan.retentionPolicy.externalDeleteRoots.includes(modelCatalog.showDir), true);
  assert.equal(plan.retentionPolicy.diskGuardrails.preferCleanupBeforeStop, true);
});

test("layer composition plan is shaped around sequencer retrieval knowledge", () => {
  const plan = buildLayerCompositionTrainingPlan({ modelCatalog, runId: "knowledge-contract", runType: "overnight" });

  assert.equal(plan.targetStateKnowledgeContract.consumptionArtifact, "sequencer_layer_composition_guidance_v1");
  assert.equal(plan.targetStateKnowledgeContract.promotionArtifact, "sequencer_layer_composition_priors_bundle");
  assert.equal(plan.targetStateKnowledgeContract.sequencerUsePolicy, "advisory_evidence_not_recipe");
  for (const facet of ["compositionIntent", "targetScope", "geometryProfile", "effectName", "layerIndex", "observedOutcome"]) {
    assert.equal(plan.targetStateKnowledgeContract.retrievalFacets.includes(facet), true);
  }
  assert.equal(
    plan.targetStateKnowledgeContract.evidenceFlow.includes("layer_composition_priors_v1"),
    true
  );
});

test("layer composition plan can be filtered by sequencing quality controller nextQueue", () => {
  const plan = buildLayerCompositionTrainingPlan({
    modelCatalog,
    runId: "controller-filtered",
    runType: "overnight",
    controllerState: {
      artifactType: "sequencing_quality_training_controller_state_v1",
      curriculumId: "sequencing-quality-v1",
      loopIndex: 3,
      controllerDecision: {
        selectedGoalId: "layer.same_target.mono_white.basic",
        nextAction: "plan_quality_repeats"
      },
      nextQueue: [{
        experimentId: "same-target-layer-stack-mono_white",
        passId: "foundation_brightness_variant"
      }]
    }
  });

  assert.equal(plan.curriculum.controllerSelection.enabled, true);
  assert.equal(plan.curriculum.controllerSelection.selectedQueueCount, 1);
  assert.equal(plan.experiments.length, 1);
  assert.equal(plan.experiments[0].experimentId, "same-target-layer-stack-mono_white");
  assert.deepEqual(
    plan.experiments[0].passes.map((pass) => pass.passId),
    ["empty_baseline", "one_layer_foundation", "two_layer_default", "three_layer_default", "foundation_brightness_variant"]
  );
  assert.equal(
    plan.experiments[0].passes.find((pass) => pass.passId === "foundation_brightness_variant").controllerSelection.selectedByController,
    true
  );
  assert.equal(
    plan.experiments[0].passes.find((pass) => pass.passId === "three_layer_default").controllerSelection.reason,
    "comparison_dependency"
  );
});

test("layer composition plan expands rgb coverage-gap controller queue", () => {
  const plan = buildLayerCompositionTrainingPlan({
    modelCatalog,
    runId: "controller-rgb-gap",
    runType: "overnight",
    controllerState: {
      artifactType: "sequencing_quality_training_controller_state_v1",
      curriculumId: "sequencing-quality-v1",
      loopIndex: 6,
      controllerDecision: {
        selectedGoalId: "layer.rgb_primary.basic",
        nextAction: "plan_goal_coverage"
      },
      nextQueue: [{
        queueId: "quality-controller:layer.rgb_primary.basic:coverage-gap",
        goalId: "layer.rgb_primary.basic",
        reason: "coverage_gap"
      }]
    }
  });

  assert.equal(plan.curriculum.controllerSelection.enabled, true);
  assert.equal(plan.curriculum.controllerSelection.explicitQueueCount, 0);
  assert.equal(plan.curriculum.controllerSelection.generatedCoverageQueueCount, 3);
  assert.deepEqual(
    [...plan.experiments.map((experiment) => experiment.experimentId)].sort(),
    ["group-model-interplay-rgb_primary", "same-target-layer-stack-rgb_primary"]
  );
  const selected = plan.experiments.flatMap((experiment) => experiment.passes
    .filter((pass) => pass.controllerSelection?.selectedByController)
    .map((pass) => `${experiment.experimentId}:${pass.passId}:${pass.controllerSelection.reason}`));
  assert.deepEqual(selected.sort(), [
    "group-model-interplay-rgb_primary:group_then_model:controller_coverage_gap",
    "same-target-layer-stack-rgb_primary:one_layer_foundation:controller_coverage_gap",
    "same-target-layer-stack-rgb_primary:two_layer_default:controller_coverage_gap"
  ].sort());
  assert.equal(
    plan.experiments
      .find((experiment) => experiment.experimentId === "group-model-interplay-rgb_primary")
      .passes
      .some((pass) => pass.passId === "foundation_group_only" && pass.controllerSelection.reason === "comparison_dependency"),
    true
  );
  assert.equal(
    plan.experiments
      .find((experiment) => experiment.experimentId === "group-model-interplay-rgb_primary")
      .passes
      .some((pass) => pass.passId === "model_only" && pass.controllerSelection.reason === "comparison_dependency"),
    true
  );
});

test("layer composition plan expands submodel coverage-gap controller queue from catalog structure", () => {
  const plan = buildLayerCompositionTrainingPlan({
    modelCatalog,
    runId: "controller-submodel-gap",
    runType: "overnight",
    controllerState: {
      artifactType: "sequencing_quality_training_controller_state_v1",
      curriculumId: "sequencing-quality-v1",
      loopIndex: 7,
      controllerDecision: {
        selectedGoalId: "submodel.vendor_fixture.basic",
        nextAction: "plan_goal_coverage"
      },
      nextQueue: [{
        queueId: "quality-controller:submodel.vendor_fixture.basic:coverage-gap",
        goalId: "submodel.vendor_fixture.basic",
        reason: "coverage_gap"
      }]
    }
  });

  assert.equal(plan.curriculum.controllerSelection.enabled, true);
  assert.equal(plan.curriculum.controllerSelection.explicitQueueCount, 0);
  assert.equal(plan.curriculum.controllerSelection.generatedCoverageQueueCount, 3);
  assert.deepEqual(
    plan.experiments.map((experiment) => experiment.experimentId),
    ["submodel-structure-vendor_basic-mono_white"]
  );
  assert.deepEqual(
    plan.experiments[0].passes.map((pass) => pass.passId),
    ["empty_baseline", "parent_model_foundation", "single_submodel_foundation", "sibling_submodels_split"]
  );
  const placements = plan.experiments[0].passes.flatMap((pass) => pass.placements);
  assert.equal(placements.some((placement) => placement.target === "CustomFace" && placement.targetScope === "model"), true);
  assert.equal(placements.some((placement) => placement.target === "CustomFace/Face" && placement.targetScope === "submodel"), true);
  assert.equal(placements.some((placement) => placement.target === "CustomFace/Mouth" && placement.targetScope === "submodel"), true);
  assert.equal(
    plan.experiments[0].passes.find((pass) => pass.passId === "sibling_submodels_split").controllerSelection.selectedByController,
    true
  );
});
