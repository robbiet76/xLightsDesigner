import test from "node:test";
import assert from "node:assert/strict";

import {
  getBehaviorCapabilityBundle,
  getBehaviorCapabilityRecord,
  getConfiguredBehaviorCapabilitiesBundle,
  getLayerCompositionPriorsBundle,
  getVideoAestheticLearningBundle,
  buildStage1TrainingKnowledgeMetadata,
  recommendLayerCompositionPriors,
  recommendVideoAestheticStrategies,
  recommendConfiguredBehaviorCapabilities,
  recommendTrainedEffects,
  recommendTrainedEffectsForVisualFamilies
} from "../../../agent/sequence-agent/trained-effect-knowledge.js";

test("trained effect knowledge exposes behavior capability records", () => {
  const bundle = getBehaviorCapabilityBundle();
  const bars = getBehaviorCapabilityRecord("Bars");
  const metadata = buildStage1TrainingKnowledgeMetadata();

  assert.equal(bundle.artifactType, "sequencer_behavior_capabilities_bundle");
  assert.equal(bundle.recordType, "behavior_capability_record_v1");
  assert.ok(bundle.effectCount >= 10);
  assert.equal(bars.artifactType, "behavior_capability_record_v1");
  assert.equal(bars.geometryProfile, "cross_geometry");
  assert.equal(bars.parameterRegion.regionKind, "aggregate");
  assert.equal(bars.traceability.generatedBy, "trained-effect-knowledge.runtime_behavior_capability_view");
  assert.equal(bars.effectName, "Bars");
  assert.equal(bars.selectorReady, true);
  assert.ok(bars.geometry.supportedModelTypes.includes("arch"));
  assert.ok(bars.behavior.patternFamilies.includes("compressing_bars"));
  assert.ok(bars.behavior.capabilityTags.includes("bar_motion"));
  assert.ok(bars.parameterBehavior.tunableParameters.includes("barCount") || bars.parameterBehavior.tunableParameters.includes("cycles"));
  assert.equal(metadata.layerCompositionPriorRecordType, "layer_composition_prior_v1");
  assert.ok(metadata.layerCompositionPriorCount >= 1);
});

test("trained effect knowledge ranks configured behavior capability records", () => {
  const bundle = getConfiguredBehaviorCapabilitiesBundle();
  const out = recommendConfiguredBehaviorCapabilities({
    summary: "fast directional chase with broad visible motion",
    preferredVisualFamilies: ["segmented_directional", "large_form_motion"],
    targetIds: ["MegaTree"],
    displayElements: [
      { id: "MegaTree", name: "MegaTree", displayAs: "Tree 360", geometryProfile: "tree_360_round" }
    ],
    paletteMode: "rgb_primary",
    limit: 5
  });

  assert.equal(bundle.artifactType, "sequencer_configured_behavior_capabilities_bundle");
  assert.equal(bundle.recordType, "behavior_capability_record_v1");
  assert.ok(bundle.recordCount >= 400);
  assert.ok(out.recommendations.length > 0);
  assert.ok(out.recommendations.every((row) => row.artifactType !== "behavior_capability_record_v1" || row.effectName));
  assert.ok(out.recommendations.some((row) => row.parameterPriorHint?.parameterName && row.parameterPriorHint?.parameterValue !== ""));
  assert.ok(out.recommendations.some((row) => row.exactGeometryMatch || row.modelTypeMatch));
});

test("trained effect knowledge prefers stage1 pattern evidence over static family fallback", () => {
  const out = recommendTrainedEffectsForVisualFamilies({
    preferredVisualFamilies: ["soft_texture"],
    targetIds: ["Spinners"],
    displayElements: [
      { id: "Spinners", name: "Spinners", displayAs: "Spinner" }
    ],
    limit: 3
  });

  assert.ok(out.length >= 1);
  assert.ok(out.some((row) => Array.isArray(row?.reasons) && row.reasons.some((reason) => /^pattern:|^intent:/.test(String(reason)))));
  assert.equal(out.some((row) => row?.behaviorCapability?.artifactType === "behavior_capability_record_v1"), true);
  assert.equal(out[0].reasons.includes("preferred_visual_family_fallback"), false);
});

test("trained effect knowledge does not invent static family recommendations when stage1 evidence does not match", () => {
  const out = recommendTrainedEffectsForVisualFamilies({
    preferredVisualFamilies: ["unsupported_family_token"],
    targetIds: ["Star"],
    displayElements: [
      { id: "Star", name: "Star", displayAs: "Star" }
    ],
    limit: 2
  });

  assert.deepEqual(out, []);
});

test("trained effect knowledge ignores generic intent tags as ranking evidence", () => {
  const out = recommendTrainedEffects({
    summary: "animated bold fill steady",
    targetModelTypes: ["spinner"],
    limit: 5
  });

  assert.deepEqual(out, []);
});

test("trained effect knowledge retrieves layer composition guidance by sequencer decision facets", () => {
  const bundle = getLayerCompositionPriorsBundle();
  const guidance = recommendLayerCompositionPriors({
    compositionIntent: "foundation_plus_model_focus",
    family: "group_model_interplay",
    paletteProfile: "rgb_primary",
    targetScopes: ["group", "model"],
    modelTypes: ["arch", "spinner"],
    effectNames: ["Bars", "Pinwheel"],
    desiredOutcomeTags: ["scene_spread_increased", "multicolor_increased"],
    includeStaged: true,
    limit: 3
  });

  assert.equal(bundle.artifactType, "sequencer_layer_composition_priors_bundle");
  assert.equal(bundle.retrievalContract.consumptionPolicy, "advisory_evidence_not_recipe");
  assert.equal(guidance.artifactType, "sequencer_layer_composition_guidance_v1");
  assert.equal(guidance.retrievalPolicy, "advisory_evidence_not_recipe");
  assert.equal(guidance.applicabilityPolicy, "shared_baseline_priors_require_structural_and_metadata_compatibility");
  assert.equal(guidance.projectLocalOverrideArtifact, "display/target-behavior.json");
  assert.equal(guidance.runtimeUseBlocked, false);
  assert.ok(guidance.recommendations.length > 0);
  assert.equal(guidance.recommendations[0].scope.family, "group_model_interplay");
  assert.equal(["compatible", "similar"].includes(guidance.recommendations[0].compatibility.status), true);
  assert.equal(guidance.recommendations[0].compatibility.projectLocalValidationRequired, false);
  assert.ok(guidance.recommendations[0].reasons.includes("compositionIntent"));
  assert.ok(guidance.recommendations[0].reasons.some((reason) => ["compatibleStructure", "similarStructure"].includes(reason)));
  assert.ok(guidance.recommendations[0].outcomeTags.includes("scene_spread_increased"));
  assert.ok(guidance.recommendations[0].safeguards.some((row) => /fixed sequencing recipe/i.test(row)));
});

test("trained effect knowledge blocks runtime layer composition guidance until promotion gate is ready", () => {
  const guidance = recommendLayerCompositionPriors({
    compositionIntent: "foundation",
    family: "group_model_interplay",
    paletteProfile: "mono_white",
    targetScopes: ["group"],
    modelTypes: ["arch"],
    effectNames: ["Bars"],
    includeStaged: false,
    bundleOverride: {
      artifactType: "sequencer_layer_composition_priors_bundle",
      recordType: "layer_composition_prior_v1",
      retrievalContract: { consumptionPolicy: "advisory_evidence_not_recipe_until_promotion_gate_ready" },
      promotionGate: {
        selectorRuntimeReady: false,
        qualityBackedPriorCount: 1,
        selectorReadyPriorCount: 0,
        blockers: ["no_selector_ready_priors"]
      },
      indexes: {
        byCompositionIntent: { foundation: ["prior-1"] },
        byFamily: { group_model_interplay: ["prior-1"] },
        byPaletteProfile: { mono_white: ["prior-1"] },
        byOutcomeTag: {}
      },
      records: {
        "prior-1": {
          priorId: "prior-1",
          confidence: "quality_backed",
          selectorReady: false,
          promotionState: "staged",
          scope: {
            compositionIntent: "foundation",
            family: "group_model_interplay",
            paletteProfile: "mono_white"
          }
        }
      }
    }
  });

  assert.equal(guidance.runtimeUseBlocked, true);
  assert.equal(guidance.recommendationCount, 0);
  assert.deepEqual(guidance.promotionGate.blockers, ["no_selector_ready_priors"]);
});

test("trained effect knowledge allows selector-ready layer composition guidance after promotion gate is ready", () => {
  const guidance = recommendLayerCompositionPriors({
    compositionIntent: "foundation",
    family: "group_model_interplay",
    paletteProfile: "mono_white",
    targetScopes: ["group"],
    modelTypes: ["arch"],
    effectNames: ["Bars"],
    includeStaged: false,
    bundleOverride: {
      artifactType: "sequencer_layer_composition_priors_bundle",
      recordType: "layer_composition_prior_v1",
      retrievalContract: { consumptionPolicy: "advisory_evidence_not_recipe_until_promotion_gate_ready" },
      promotionGate: {
        selectorRuntimeReady: true,
        qualityBackedPriorCount: 1,
        selectorReadyPriorCount: 1,
        blockers: []
      },
      indexes: {
        byCompositionIntent: { foundation: ["prior-1"] },
        byFamily: { group_model_interplay: ["prior-1"] },
        byPaletteProfile: { mono_white: ["prior-1"] },
        byOutcomeTag: {}
      },
      records: {
        "prior-1": {
          priorId: "prior-1",
          confidence: "quality_backed",
          selectorReady: true,
          promotionState: "selector_ready",
          scope: {
            compositionIntent: "foundation",
            family: "group_model_interplay",
            paletteProfile: "mono_white",
            targetScopes: ["group"],
            modelTypes: ["arch"],
            effectNames: ["Bars"]
          },
          guidance: ["quality-backed foundation prior"],
          safeguards: ["Use only in compatible context."]
        }
      }
    }
  });

  assert.equal(guidance.runtimeUseBlocked, false);
  assert.equal(guidance.recommendationCount, 1);
  assert.equal(guidance.recommendations[0].selectorReady, true);
  assert.equal(guidance.recommendations[0].promotionState, "selector_ready");
  assert.equal(guidance.recommendations[0].compatibility.status, "compatible");
});

test("trained effect knowledge flags weak layer composition matches for project-local validation", () => {
  const guidance = recommendLayerCompositionPriors({
    compositionIntent: "foundation",
    family: "group_model_interplay",
    paletteProfile: "mono_white",
    targetScopes: ["model"],
    modelTypes: ["custom"],
    effectNames: ["Bars"],
    includeStaged: false,
    bundleOverride: {
      artifactType: "sequencer_layer_composition_priors_bundle",
      recordType: "layer_composition_prior_v1",
      retrievalContract: {
        consumptionPolicy: "advisory_evidence_not_recipe_until_promotion_gate_ready",
        applicabilityPolicy: "shared_baseline_priors_require_structural_and_metadata_compatibility",
        projectLocalOverrideArtifact: "display/target-behavior.json"
      },
      promotionGate: {
        selectorRuntimeReady: true,
        qualityBackedPriorCount: 1,
        selectorReadyPriorCount: 1,
        blockers: []
      },
      indexes: {
        byCompositionIntent: { foundation: ["prior-1"] },
        byFamily: { group_model_interplay: ["prior-1"] },
        byPaletteProfile: { mono_white: ["prior-1"] },
        byOutcomeTag: {}
      },
      records: {
        "prior-1": {
          priorId: "prior-1",
          confidence: "quality_backed",
          selectorReady: true,
          promotionState: "selector_ready",
          scope: {
            learningScope: "shared_baseline",
            reusePolicy: "compatible_structure_and_metadata_only",
            compositionIntent: "foundation",
            family: "group_model_interplay",
            paletteProfile: "mono_white",
            targetScopes: ["group"],
            modelTypes: ["arch"],
            effectNames: ["Bars"]
          },
          guidance: ["quality-backed foundation prior"],
          safeguards: ["Use only in compatible context."]
        }
      }
    }
  });

  assert.equal(guidance.recommendationCount, 1);
  assert.equal(guidance.recommendations[0].compatibility.status, "weak_match");
  assert.equal(guidance.recommendations[0].compatibility.projectLocalValidationRequired, true);
  assert.equal(guidance.recommendations[0].learningLayer.projectLocalOverrideArtifact, "display/target-behavior.json");
  assert.ok(guidance.recommendations[0].reasons.includes("projectLocalValidationRequired"));
});

test("trained effect knowledge recommends selector-ready video aesthetic strategies", () => {
  const bundle = getVideoAestheticLearningBundle();
  const guidance = recommendVideoAestheticStrategies({
    weakDimensions: ["focal_clarity", "pacing_variety", "motion_interest"],
    paletteProfile: "mono_white",
    bundleOverride: bundle
  });

  assert.equal(guidance.runtimeUseBlocked, false);
  assert.equal(guidance.recommendationCount >= 1, true);
  assert.equal(guidance.recommendations[0].strategy, "focal_consistency_repair");
  assert.equal(guidance.recommendations[0].selectorReady, true);
  assert.equal(guidance.recommendations[0].comparison.status, "improved");
  assert.equal(guidance.recommendations[0].guidance.some((row) => row.includes("focal_clarity")), true);
});
