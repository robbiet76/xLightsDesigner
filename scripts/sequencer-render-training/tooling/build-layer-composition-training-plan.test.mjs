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
  assert.equal(experimentIds.includes("creative-intent-probe-mono_white"), true);
  assert.equal(experimentIds.includes("creative-intent-probe-rgb_primary"), true);
  assert.equal(experimentIds.includes("creative-intent-revision-comparison-mono_white"), true);
  assert.equal(experimentIds.includes("creative-intent-revision-comparison-rgb_primary"), true);
  assert.equal(experimentIds.includes("core-effect-fit-mono_white"), true);
  assert.equal(experimentIds.includes("core-effect-fit-rgb_primary"), true);
  assert.equal(experimentIds.includes("expanded-effect-fit-mono_white"), true);
  assert.equal(experimentIds.includes("expanded-effect-fit-rgb_primary"), true);
  assert.equal(experimentIds.includes("display-quality-review-mono_white"), true);
  assert.equal(experimentIds.includes("display-quality-review-rgb_primary"), true);
  assert.equal(experimentIds.includes("music-structure-review-mono_white"), true);
  assert.equal(experimentIds.includes("music-structure-review-rgb_primary"), true);
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
  const revisionComparison = plan.experiments.find((experiment) => experiment.experimentId === "creative-intent-revision-comparison-rgb_primary");
  assert.equal(revisionComparison.designType, "before_after_revision_pair");
  assert.equal(revisionComparison.revisionComparisonContract.baselinePassId, "intent_first_draft");
  assert.equal(revisionComparison.revisionComparisonContract.revisedPassId, "intent_targeted_revision");
  assert.equal(
    revisionComparison.passes.find((pass) => pass.passId === "intent_targeted_revision").comparisonBasePassId,
    "intent_first_draft"
  );
  const expandedEffectFit = plan.experiments.find((experiment) => experiment.experimentId === "expanded-effect-fit-rgb_primary");
  assert.equal(expandedEffectFit.family, "expanded_effect_fit");
  assert.deepEqual(
    expandedEffectFit.passes
      .filter((pass) => pass.passId !== "empty_baseline")
      .map((pass) => pass.passId),
    [
      "marquee_single_line_rgb_segments",
      "single_strand_arch_chase",
      "bars_tree_vertical_motion",
      "color_wash_tree_gradient",
      "marquee_arch_segments",
      "pinwheel_star_rotation",
      "fire_spinner_texture",
      "butterfly_spinner_pattern"
    ]
  );
  assert.deepEqual(
    expandedEffectFit.passes
      .filter((pass) => pass.passId !== "empty_baseline")
      .map((pass) => pass.placements[0].modelType),
    ["single_line", "arch", "tree_flat", "tree_flat", "arch", "star", "spinner", "spinner"]
  );
});

test("layer composition plan expands creative intent coverage-gap controller queue", () => {
  const plan = buildLayerCompositionTrainingPlan({
    modelCatalog,
    runId: "controller-creative-gap",
    runType: "overnight",
    controllerState: {
      artifactType: "sequencing_quality_training_controller_state_v1",
      curriculumId: "sequencing-quality-v1",
      loopIndex: 8,
      controllerDecision: {
        selectedGoalId: "creative.intent_match.v1",
        nextAction: "plan_goal_coverage"
      },
      nextQueue: [{
        queueId: "quality-controller:creative.intent_match.v1:coverage-gap",
        goalId: "creative.intent_match.v1",
        reason: "coverage_gap"
      }]
    }
  });

  assert.equal(plan.curriculum.controllerSelection.enabled, true);
  assert.equal(plan.curriculum.controllerSelection.generatedCoverageQueueCount, 2);
  assert.deepEqual(
    plan.experiments.map((experiment) => experiment.experimentId),
    ["creative-intent-probe-mono_white"]
  );
  assert.deepEqual(
    plan.experiments[0].passes.map((pass) => pass.passId),
    ["empty_baseline", "mood_palette_pace", "emphasis_negative_space"]
  );
  const intents = plan.experiments[0].passes
    .flatMap((pass) => pass.placements)
    .map((placement) => placement.layerIntent?.creativeIntent)
    .filter(Boolean);
  assert.equal(intents.some((intent) => intent.dimensions.includes("mood") && intent.dimensions.includes("palette")), true);
  assert.equal(intents.some((intent) => intent.dimensions.includes("emphasis") && intent.dimensions.includes("negative_space")), true);
});

test("layer composition plan expands creative intent revision comparison coverage-gap controller queue", () => {
  const plan = buildLayerCompositionTrainingPlan({
    modelCatalog,
    runId: "controller-creative-revision-gap",
    runType: "overnight",
    controllerState: {
      artifactType: "sequencing_quality_training_controller_state_v1",
      curriculumId: "sequencing-quality-v1",
      loopIndex: 14,
      controllerDecision: {
        selectedGoalId: "creative.intent_revision_comparison.v1",
        nextAction: "plan_goal_coverage"
      },
      nextQueue: [{
        queueId: "quality-controller:creative.intent_revision_comparison.v1:coverage-gap",
        goalId: "creative.intent_revision_comparison.v1",
        reason: "coverage_gap"
      }]
    }
  });

  assert.equal(plan.curriculum.controllerSelection.enabled, true);
  assert.equal(plan.curriculum.controllerSelection.generatedCoverageQueueCount, 2);
  assert.deepEqual(
    plan.experiments.map((experiment) => experiment.experimentId),
    ["creative-intent-revision-comparison-mono_white"]
  );
  assert.deepEqual(
    plan.experiments[0].passes.map((pass) => pass.passId),
    ["empty_baseline", "intent_first_draft", "intent_targeted_revision"]
  );
  const revised = plan.experiments[0].passes.find((pass) => pass.passId === "intent_targeted_revision");
  const firstDraft = plan.experiments[0].passes.find((pass) => pass.passId === "intent_first_draft");
  assert.equal(revised.changeType, "creative_intent_revision");
  assert.equal(revised.comparisonBasePassId, "intent_first_draft");
  assert.equal(
    revised.placements.some((placement) => placement.layerIntent?.creativeIntent?.reviewMethods.includes("before_after_revision_comparison")),
    true
  );
  assert.deepEqual(
    firstDraft.placements[0].layerIntent.creativeIntent.dimensions,
    revised.placements[0].layerIntent.creativeIntent.dimensions
  );
  assert.equal(firstDraft.placements[0].layerIntent.creativeIntent.emphasis, "late_section_lift");
  assert.equal(revised.placements.some((placement) => placement.layerIntent?.creativeIntent?.supportRole === "late_linear_accent"), true);
});

test("layer composition plan expands core effect coverage-gap controller queue", () => {
  const plan = buildLayerCompositionTrainingPlan({
    modelCatalog,
    runId: "controller-effect-gap",
    runType: "overnight",
    controllerState: {
      artifactType: "sequencing_quality_training_controller_state_v1",
      curriculumId: "sequencing-quality-v1",
      loopIndex: 9,
      controllerDecision: {
        selectedGoalId: "effect_fit.core_effects.v1",
        nextAction: "plan_goal_coverage"
      },
      nextQueue: [{
        queueId: "quality-controller:effect_fit.core_effects.v1:coverage-gap",
        goalId: "effect_fit.core_effects.v1",
        reason: "coverage_gap"
      }]
    }
  });

  assert.equal(plan.curriculum.controllerSelection.enabled, true);
  assert.equal(plan.curriculum.controllerSelection.generatedCoverageQueueCount, 3);
  assert.deepEqual(
    plan.experiments.map((experiment) => experiment.experimentId),
    ["core-effect-fit-mono_white"]
  );
  assert.deepEqual(
    plan.experiments[0].passes.map((pass) => pass.passId),
    ["empty_baseline", "single_strand_linear_motion", "bars_group_motion", "color_wash_radial_fill"]
  );
  const effectNames = plan.experiments[0].passes.flatMap((pass) => pass.placements).map((placement) => placement.effectName);
  assert.equal(effectNames.includes("SingleStrand"), true);
  assert.equal(effectNames.includes("Shimmer"), false);
});

test("layer composition plan expands missing core effect coverage units", () => {
  const plan = buildLayerCompositionTrainingPlan({
    modelCatalog,
    runId: "controller-effect-missing-units",
    runType: "overnight",
    controllerState: {
      artifactType: "sequencing_quality_training_controller_state_v1",
      curriculumId: "sequencing-quality-v1",
      loopIndex: 10,
      controllerDecision: {
        selectedGoalId: "effect_fit.core_effects.v1",
        nextAction: "plan_goal_coverage"
      },
      nextQueue: [{
        queueId: "quality-controller:effect_fit.core_effects.v1:coverage-gap",
        goalId: "effect_fit.core_effects.v1",
        reason: "coverage_gap",
        missingCoverageUnits: [{
          paletteProfile: "mono_white",
          effect: "Marquee",
          modelType: "single_line"
        }, {
          paletteProfile: "mono_white",
          effect: "Pinwheel",
          modelType: "spinner"
        }]
      }]
    }
  });

  assert.equal(plan.curriculum.controllerSelection.generatedCoverageQueueCount, 2);
  assert.deepEqual(
    plan.experiments[0].passes.map((pass) => pass.passId),
    ["empty_baseline", "marquee_linear_segments", "pinwheel_spinner_rotation"]
  );
  assert.deepEqual(
    plan.experiments[0].passes.flatMap((pass) => pass.placements).map((placement) => placement.effectName),
    ["Marquee", "Pinwheel"]
  );
});

test("layer composition plan expands missing expanded effect matrix units", () => {
  const plan = buildLayerCompositionTrainingPlan({
    modelCatalog,
    runId: "controller-expanded-effect-missing-units",
    runType: "overnight",
    controllerState: {
      artifactType: "sequencing_quality_training_controller_state_v1",
      curriculumId: "sequencing-quality-v1",
      loopIndex: 15,
      controllerDecision: {
        selectedGoalId: "effect_fit.expanded_model_matrix.v1",
        nextAction: "plan_goal_coverage"
      },
      nextQueue: [{
        queueId: "quality-controller:effect_fit.expanded_model_matrix.v1:coverage-gap",
        goalId: "effect_fit.expanded_model_matrix.v1",
        reason: "coverage_gap",
        missingCoverageUnits: [{
          paletteProfile: "rgb_primary",
          effect: "Marquee",
          modelType: "single_line"
        }, {
          paletteProfile: "rgb_primary",
          effect: "Butterfly",
          modelType: "spinner"
        }]
      }]
    }
  });

  assert.equal(plan.curriculum.controllerSelection.generatedCoverageQueueCount, 2);
  assert.deepEqual(
    plan.experiments.map((experiment) => experiment.experimentId),
    ["expanded-effect-fit-rgb_primary"]
  );
  assert.deepEqual(
    plan.experiments[0].passes.map((pass) => pass.passId),
    ["empty_baseline", "marquee_single_line_rgb_segments", "butterfly_spinner_pattern"]
  );
  assert.deepEqual(
    plan.experiments[0].passes.flatMap((pass) => pass.placements).map((placement) => placement.effectName),
    ["Marquee", "Butterfly"]
  );
});

test("layer composition plan expands display quality coverage-gap controller queue", () => {
  const plan = buildLayerCompositionTrainingPlan({
    modelCatalog,
    runId: "controller-display-gap",
    runType: "overnight",
    controllerState: {
      artifactType: "sequencing_quality_training_controller_state_v1",
      curriculumId: "sequencing-quality-v1",
      loopIndex: 12,
      controllerDecision: {
        selectedGoalId: "display.full_sequence.quality_v1",
        nextAction: "plan_goal_coverage"
      },
      nextQueue: [{
        queueId: "quality-controller:display.full_sequence.quality_v1:coverage-gap",
        goalId: "display.full_sequence.quality_v1",
        reason: "coverage_gap"
      }]
    }
  });

  assert.equal(plan.curriculum.controllerSelection.enabled, true);
  assert.equal(plan.curriculum.controllerSelection.generatedCoverageQueueCount, 2);
  assert.deepEqual(
    plan.experiments.map((experiment) => experiment.experimentId),
    ["display-quality-review-mono_white"]
  );
  assert.deepEqual(
    plan.experiments[0].passes.map((pass) => pass.passId),
    ["empty_baseline", "display_balance_foundation", "display_motion_variety"]
  );
  assert.equal(
    plan.experiments[0].passes
      .find((pass) => pass.passId === "display_motion_variety")
      .placements.length,
    5
  );
});

test("layer composition plan expands video aesthetic improvement queue to revision passes", () => {
  const plan = buildLayerCompositionTrainingPlan({
    modelCatalog,
    runId: "controller-video-aesthetic-gap",
    runType: "overnight",
    controllerState: {
      artifactType: "sequencing_quality_training_controller_state_v1",
      curriculumId: "sequencing-quality-v1",
      loopIndex: 13,
      controllerDecision: {
        selectedGoalId: "display.full_sequence.quality_v1",
        selectionReason: "video_aesthetic_score_below_threshold",
        nextAction: "plan_goal_coverage"
      },
      nextQueue: [{
        queueId: "quality-controller:display.full_sequence.quality_v1:video-aesthetic-improvement",
        goalId: "display.full_sequence.quality_v1",
        reason: "coverage_gap",
        improvementSource: "video_aesthetic_score",
        weakDimensions: [
          { dimension: "pacing_variety", score: 0.21 },
          { dimension: "visual_balance", score: 0.47 }
        ]
      }]
    }
  });

  assert.equal(plan.curriculum.controllerSelection.enabled, true);
  assert.equal(plan.curriculum.controllerSelection.generatedCoverageQueueCount, 2);
  assert.deepEqual(
    plan.experiments.map((experiment) => experiment.experimentId),
    ["display-quality-review-mono_white"]
  );
  assert.deepEqual(
    plan.experiments[0].passes.map((pass) => pass.passId),
    [
      "empty_baseline",
      "display_balance_foundation",
      "display_motion_variety",
      "display_pacing_balance_revision",
      "display_wide_balance_revision"
    ]
  );
  assert.equal(
    plan.experiments[0].passes
      .find((pass) => pass.passId === "display_pacing_balance_revision")
      .controllerSelection.selectedByController,
    true
  );
  assert.equal(
    plan.experiments[0].passes
      .find((pass) => pass.passId === "display_motion_variety")
      .controllerSelection.reason,
    "comparison_dependency"
  );
});

test("layer composition plan changes video aesthetic strategy after neutral attempt", () => {
  const plan = buildLayerCompositionTrainingPlan({
    modelCatalog,
    runId: "controller-video-aesthetic-section-window",
    runType: "overnight",
    controllerState: {
      artifactType: "sequencing_quality_training_controller_state_v1",
      curriculumId: "sequencing-quality-v1",
      loopIndex: 14,
      controllerDecision: {
        selectedGoalId: "display.full_sequence.quality_v1",
        selectionReason: "video_aesthetic_score_below_threshold",
        nextAction: "plan_goal_coverage"
      },
      nextQueue: [{
        queueId: "quality-controller:display.full_sequence.quality_v1:video-aesthetic-improvement",
        goalId: "display.full_sequence.quality_v1",
        reason: "coverage_gap",
        improvementSource: "video_aesthetic_score",
        previousAttemptStatus: "neutral",
        avoidStrategy: "simultaneous_display_balance_revision",
        nextStrategy: "section_window_pacing_balance"
      }]
    }
  });

  assert.deepEqual(
    plan.experiments[0].passes.map((pass) => pass.passId),
    ["empty_baseline", "display_balance_foundation", "display_motion_variety", "display_section_window_pacing"]
  );
  const sectionPass = plan.experiments[0].passes.find((pass) => pass.passId === "display_section_window_pacing");
  assert.equal(sectionPass.controllerSelection.selectedByController, true);
  assert.equal(sectionPass.placements.length, 4);
  assert.equal(sectionPass.placements.some((placement) => placement.startMs === 0 && placement.endMs === 2200), true);
  assert.equal(sectionPass.placements.some((placement) => placement.startMs === 3800 && placement.endMs === 6000), true);
});

test("layer composition plan expands regional focus contrast strategy", () => {
  const plan = buildLayerCompositionTrainingPlan({
    modelCatalog,
    runId: "controller-video-aesthetic-regional-focus",
    runType: "overnight",
    controllerState: {
      artifactType: "sequencing_quality_training_controller_state_v1",
      curriculumId: "sequencing-quality-v1",
      loopIndex: 15,
      controllerDecision: {
        selectedGoalId: "display.full_sequence.quality_v1",
        selectionReason: "video_aesthetic_score_below_threshold",
        nextAction: "plan_goal_coverage"
      },
      nextQueue: [{
        queueId: "quality-controller:display.full_sequence.quality_v1:video-aesthetic-improvement",
        goalId: "display.full_sequence.quality_v1",
        reason: "coverage_gap",
        improvementSource: "video_aesthetic_score",
        previousAttemptStatus: "neutral",
        avoidStrategy: "section_window_pacing_balance",
        nextStrategy: "regional_focus_contrast"
      }]
    }
  });

  assert.deepEqual(
    plan.experiments[0].passes.map((pass) => pass.passId),
    ["empty_baseline", "display_balance_foundation", "display_motion_variety", "display_regional_focus_contrast"]
  );
  const focusPass = plan.experiments[0].passes.find((pass) => pass.passId === "display_regional_focus_contrast");
  assert.equal(focusPass.controllerSelection.selectedByController, true);
  assert.equal(focusPass.placements.length, 3);
  assert.equal(focusPass.placements.some((placement) => placement.layerIntent?.displayReviewRole === "regional_focus_contrast"), true);
});

test("layer composition plan expands rgb primary regional focus strategy", () => {
  const plan = buildLayerCompositionTrainingPlan({
    modelCatalog,
    runId: "controller-video-aesthetic-rgb-regional-focus",
    runType: "overnight",
    controllerState: {
      artifactType: "sequencing_quality_training_controller_state_v1",
      curriculumId: "sequencing-quality-v1",
      loopIndex: 16,
      controllerDecision: {
        selectedGoalId: "display.full_sequence.quality_v1",
        selectionReason: "video_aesthetic_score_below_threshold",
        nextAction: "plan_goal_coverage"
      },
      nextQueue: [{
        queueId: "quality-controller:display.full_sequence.quality_v1:video-aesthetic-improvement",
        goalId: "display.full_sequence.quality_v1",
        reason: "coverage_gap",
        improvementSource: "video_aesthetic_score",
        previousAttemptStatus: "improved",
        nextStrategy: "rgb_primary_regional_focus_contrast"
      }]
    }
  });

  assert.deepEqual(
    plan.experiments.map((experiment) => experiment.experimentId),
    ["display-quality-review-rgb_primary"]
  );
  assert.deepEqual(
    plan.experiments[0].passes.map((pass) => pass.passId),
    ["empty_baseline", "display_balance_foundation", "display_motion_variety", "display_regional_focus_contrast"]
  );
  assert.equal(plan.paletteProfiles.some((profile) => profile.profile === "rgb_primary"), true);
  assert.equal(
    plan.experiments[0].passes.find((pass) => pass.passId === "display_regional_focus_contrast")
      .controllerSelection.selectedByController,
    true
  );
});

test("layer composition plan expands focal consistency repair strategy", () => {
  const plan = buildLayerCompositionTrainingPlan({
    modelCatalog,
    runId: "controller-video-aesthetic-focal-consistency",
    runType: "overnight",
    controllerState: {
      artifactType: "sequencing_quality_training_controller_state_v1",
      curriculumId: "sequencing-quality-v1",
      loopIndex: 17,
      controllerDecision: {
        selectedGoalId: "display.full_sequence.quality_v1",
        selectionReason: "video_aesthetic_score_below_threshold",
        nextAction: "plan_goal_coverage"
      },
      nextQueue: [{
        queueId: "quality-controller:display.full_sequence.quality_v1:video-aesthetic-improvement",
        goalId: "display.full_sequence.quality_v1",
        reason: "coverage_gap",
        improvementSource: "video_aesthetic_score",
        previousAttemptStatus: "neutral",
        avoidStrategy: "section_window_pacing_balance,regional_focus_contrast,rgb_primary_regional_focus_contrast,simultaneous_display_balance_revision",
        nextStrategy: "focal_consistency_repair"
      }]
    }
  });

  assert.deepEqual(
    plan.experiments[0].passes.map((pass) => pass.passId),
    ["empty_baseline", "display_balance_foundation", "display_motion_variety", "display_focal_consistency_repair"]
  );
  const repairPass = plan.experiments[0].passes.find((pass) => pass.passId === "display_focal_consistency_repair");
  assert.equal(repairPass.controllerSelection.selectedByController, true);
  assert.equal(repairPass.placements.length, 3);
  assert.equal(repairPass.placements.some((placement) => placement.layerIntent?.displayReviewRole === "focal_consistency_repair"), true);
});

test("layer composition plan expands targeted display aesthetic coverage units", () => {
  const plan = buildLayerCompositionTrainingPlan({
    modelCatalog,
    runId: "controller-targeted-display-aesthetic-gap",
    runType: "overnight",
    controllerState: {
      artifactType: "sequencing_quality_training_controller_state_v1",
      curriculumId: "sequencing-quality-v1",
      loopIndex: 18,
      controllerDecision: {
        selectedGoalId: "display.video_aesthetic.focal_consistency_v1",
        nextAction: "plan_goal_coverage"
      },
      nextQueue: [{
        queueId: "quality-controller:display.video_aesthetic.focal_consistency_v1:coverage-gap",
        goalId: "display.video_aesthetic.focal_consistency_v1",
        reason: "coverage_gap",
        missingCoverageUnits: [{
          paletteProfile: "mono_white",
          passId: "display_focal_consistency_repair"
        }]
      }]
    }
  });

  assert.deepEqual(
    plan.experiments.map((experiment) => experiment.experimentId),
    ["display-quality-review-mono_white"]
  );
  assert.deepEqual(
    plan.experiments[0].passes.map((pass) => pass.passId),
    ["empty_baseline", "display_balance_foundation", "display_motion_variety", "display_focal_consistency_repair"]
  );
  const repairPass = plan.experiments[0].passes.find((pass) => pass.passId === "display_focal_consistency_repair");
  assert.equal(repairPass.controllerSelection.selectedByController, true);
});

test("layer composition plan expands music structure coverage-gap controller queue", () => {
  const plan = buildLayerCompositionTrainingPlan({
    modelCatalog,
    runId: "controller-music-gap",
    runType: "overnight",
    controllerState: {
      artifactType: "sequencing_quality_training_controller_state_v1",
      curriculumId: "sequencing-quality-v1",
      loopIndex: 13,
      controllerDecision: {
        selectedGoalId: "music.structure_alignment.v1",
        nextAction: "plan_goal_coverage"
      },
      nextQueue: [{
        queueId: "quality-controller:music.structure_alignment.v1:coverage-gap",
        goalId: "music.structure_alignment.v1",
        reason: "coverage_gap"
      }]
    }
  });

  assert.equal(plan.curriculum.controllerSelection.enabled, true);
  assert.equal(plan.curriculum.controllerSelection.generatedCoverageQueueCount, 2);
  assert.deepEqual(
    plan.experiments.map((experiment) => experiment.experimentId),
    ["music-structure-review-mono_white"]
  );
  assert.deepEqual(
    plan.experiments[0].passes.map((pass) => pass.passId),
    ["empty_baseline", "section_phrase_energy", "lyric_accent_response"]
  );
  const musicRoles = plan.experiments[0].passes
    .flatMap((pass) => pass.placements)
    .map((placement) => placement.layerIntent?.musicRole)
    .filter(Boolean);
  assert.equal(musicRoles.some((role) => role.timingContext?.beat), true);
  assert.equal(musicRoles.some((role) => role.timingContext?.lyric), true);
  assert.equal(musicRoles.some((role) => role.timingContext?.accent), true);
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
