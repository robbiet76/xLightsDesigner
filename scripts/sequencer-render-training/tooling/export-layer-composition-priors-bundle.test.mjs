import test from "node:test";
import assert from "node:assert/strict";

import { buildLayerCompositionPriorsBundle } from "./export-layer-composition-priors-bundle.mjs";

test("layer composition bundle indexes priors by sequencer retrieval facets", () => {
  const bundle = buildLayerCompositionPriorsBundle({
    stagedPriors: {
      artifactType: "layer_composition_priors_v1",
      sourceRunId: "run-1",
      priors: [{
        priorId: "layer_composition:group_model_interplay:rgb_primary:group_then_model",
        artifactType: "layer_composition_prior_v1",
        selectorReady: false,
        promotionState: "staged",
        confidence: "smoke_observed",
        scope: {
          family: "group_model_interplay",
          paletteProfile: "rgb_primary",
          compositionIntent: "foundation_plus_model_focus",
          targetScopes: ["group", "model"],
          geometryProfiles: ["arch_grouped"],
          effectNames: ["Bars", "Pinwheel"],
          layerIndexes: [0, 1]
        },
        observedEffects: {
          activeModelCountDeltaFromBaseline: 3,
          maxActiveNodeCountDeltaFromBaseline: 219,
          sceneSpreadDirectionFromBaseline: "increase",
          multicolorFrameRatioDirectionFromBaseline: "increase",
          equivalentToPass: "group_then_model"
        },
        qualityEvidence: {
          recordId: "layer_quality:group-model-interplay-rgb_primary:group_then_model:bars:archgroup",
          durableCandidate: true,
          sampleCount: 2,
          trendStatus: "stable",
          effectName: "Bars",
          leadTargets: ["ArchGroup"],
          latestOverallQuality: 0.86,
          meanOverallQuality: 0.84,
          meanVisualReadability: 0.82,
          meanIntentMatch: 0.83,
          meanMotionCoherence: 0.81,
          latestRenderReviewRef: "/tmp/run-1/passes/group_then_model/render-review.json"
        },
        sourceObservationRef: "/tmp/run-1/passes/group_then_model/composition-stack-observation.json",
        sourcePassPlanRef: "/tmp/run-1/passes/group_then_model/pass-plan.json"
      }]
    },
    sourcePath: "/tmp/run-1/layer-composition-priors-staged.json",
    sourceRunRoot: "/tmp/run-1"
  });

  assert.equal(bundle.artifactType, "sequencer_layer_composition_priors_bundle");
  assert.equal(bundle.provenance.generatedBy, "scripts/sequencer-render-training/tooling/export-layer-composition-priors-bundle.mjs");
  assert.equal(bundle.provenance.compactionPolicy, "runtime_bundle_relativizes_raw_evidence_refs_and_omits_no_raw_frame_payloads");
  assert.equal(bundle.recordCount, 1);
  assert.equal(bundle.qualityBackedCount, 1);
  assert.deepEqual(bundle.indexes.qualityBackedPriorIds, ["layer_composition:group_model_interplay:rgb_primary:group_then_model"]);
  assert.equal(bundle.retrievalContract.consumptionPolicy, "advisory_evidence_not_recipe_until_promotion_gate_ready");
  assert.equal(bundle.promotionGate.selectorRuntimeReady, false);
  assert.equal(bundle.promotionGate.qualityBackedPriorCount, 1);
  assert.equal(bundle.promotionGate.selectorReadyPriorCount, 0);
  assert.equal(bundle.promotionGate.qualityBackedSelectorReadyPriorCount, 0);
  assert.deepEqual(bundle.promotionGate.blockers, ["no_selector_ready_priors"]);
  assert.equal(bundle.promotionGate.checks.find((check) => check.id === "has_quality_backed_priors").ok, true);
  assert.equal(bundle.promotionGate.checks.find((check) => check.id === "has_selector_ready_priors").ok, false);
  assert.deepEqual(bundle.indexes.byFamily.group_model_interplay, ["layer_composition:group_model_interplay:rgb_primary:group_then_model"]);
  assert.deepEqual(bundle.indexes.byPaletteProfile.rgb_primary, ["layer_composition:group_model_interplay:rgb_primary:group_then_model"]);
  assert.deepEqual(bundle.indexes.byCompositionIntent.foundation_plus_model_focus, ["layer_composition:group_model_interplay:rgb_primary:group_then_model"]);
  assert.deepEqual(bundle.indexes.byOutcomeTag.scene_spread_increased, ["layer_composition:group_model_interplay:rgb_primary:group_then_model"]);
  assert.deepEqual(bundle.indexes.byOutcomeTag.order_equivalent, ["layer_composition:group_model_interplay:rgb_primary:group_then_model"]);
  const record = bundle.records["layer_composition:group_model_interplay:rgb_primary:group_then_model"];
  assert.equal(bundle.provenance.learningScope, "shared_baseline");
  assert.equal(bundle.provenance.targetApplicability, "compatible_structure_and_metadata_only");
  assert.equal(bundle.retrievalContract.projectLocalOverrideArtifact, "display/target-behavior.json");
  assert.equal(record.learningLayer.scope, "shared_baseline");
  assert.equal(record.learningLayer.projectLocalOverrideArtifact, "display/target-behavior.json");
  assert.equal(record.qualityEvidence.recordId, "layer_quality:group-model-interplay-rgb_primary:group_then_model:bars:archgroup");
  assert.equal(record.qualityEvidence.meanOverallQuality, 0.84);
  assert.equal(record.qualityEvidence.latestRenderReviewRef, undefined);
  assert.equal(record.sourceObservationRef, "passes/group_then_model/composition-stack-observation.json");
  assert.equal(record.sourcePassPlanRef, "passes/group_then_model/pass-plan.json");
  assert.deepEqual(Object.keys(record.scope).sort(), [
    "compositionIntent",
    "effectNames",
    "family",
    "geometryProfiles",
    "layerIndexes",
    "learningScope",
    "modelTypes",
    "paletteProfile",
    "projectLocalBehaviorRequiredForUnknownTargets",
    "reusePolicy",
    "targetScopes"
  ].sort());
  assert.deepEqual(Object.keys(record.observedEffects).sort(), [
    "activeModelCountDeltaFromBaseline",
    "brightnessVariationDirectionFromPrevious",
    "colorSpreadDirectionFromBaseline",
    "equivalentToPass",
    "maxActiveNodeCountDeltaFromBaseline",
    "motionDirectionFromPrevious",
    "multicolorFrameRatioDirectionFromBaseline",
    "sceneSpreadDirectionFromBaseline"
  ].sort());
  assert.equal(record.conditions, undefined);
  assert.equal(record.artifactType, undefined);
  assert.equal(JSON.stringify(bundle).includes("/tmp/run-1/passes"), false);
});

test("layer composition promotion gate blocks selector-ready priors without quality evidence", () => {
  const bundle = buildLayerCompositionPriorsBundle({
    stagedPriors: {
      artifactType: "layer_composition_priors_v1",
      sourceRunId: "run-2",
      priors: [{
        priorId: "layer_composition:group_model_interplay:mono_white:foundation_group_only",
        selectorReady: true,
        promotionState: "selector_ready",
        confidence: "smoke_observed",
        scope: {
          family: "group_model_interplay",
          paletteProfile: "mono_white",
          compositionIntent: "foundation_group_only",
          targetScopes: ["group"],
          effectNames: ["Bars"]
        },
        observedEffects: {
          activeModelCountDeltaFromBaseline: 2,
          maxActiveNodeCountDeltaFromBaseline: 120,
          sceneSpreadDirectionFromBaseline: "increase"
        }
      }]
    }
  });

  assert.equal(bundle.selectorReadyCount, 1);
  assert.equal(bundle.qualityBackedCount, 0);
  assert.equal(bundle.promotionGate.selectorRuntimeReady, false);
  assert.deepEqual(bundle.promotionGate.selectorReadyMissingQualityPriorIds, [
    "layer_composition:group_model_interplay:mono_white:foundation_group_only"
  ]);
  assert.deepEqual(bundle.promotionGate.blockers, [
    "no_quality_backed_priors",
    "selector_ready_priors_missing_quality_evidence"
  ]);
  assert.equal(bundle.promotionGate.checks.find((check) => check.id === "selector_ready_priors_are_quality_backed").ok, false);
});

test("layer composition promotion gate allows selector runtime only for quality-backed selector-ready priors", () => {
  const bundle = buildLayerCompositionPriorsBundle({
    stagedPriors: {
      artifactType: "layer_composition_priors_v1",
      sourceRunId: "run-3",
      priors: [{
        priorId: "layer_composition:group_model_interplay:mono_white:foundation_group_only",
        selectorReady: true,
        promotionState: "selector_ready",
        confidence: "quality_backed",
        scope: {
          family: "group_model_interplay",
          paletteProfile: "mono_white",
          compositionIntent: "foundation_group_only",
          targetScopes: ["group"],
          effectNames: ["Bars"]
        },
        observedEffects: {
          activeModelCountDeltaFromBaseline: 2,
          maxActiveNodeCountDeltaFromBaseline: 120,
          sceneSpreadDirectionFromBaseline: "increase"
        },
        qualityEvidence: {
          recordId: "layer_quality:group-model-interplay-mono_white:foundation_group_only:bars:arches",
          durableCandidate: true,
          sampleCount: 2,
          trendStatus: "stable",
          effectName: "Bars",
          leadTargets: ["Arches"],
          latestOverallQuality: 0.86,
          meanOverallQuality: 0.85,
          meanVisualReadability: 0.84,
          meanIntentMatch: 0.83,
          meanMotionCoherence: 0.82
        }
      }]
    }
  });

  assert.equal(bundle.promotionGate.selectorRuntimeReady, true);
  assert.equal(bundle.promotionGate.qualityBackedPriorCount, 1);
  assert.equal(bundle.promotionGate.selectorReadyPriorCount, 1);
  assert.equal(bundle.promotionGate.qualityBackedSelectorReadyPriorCount, 1);
  assert.deepEqual(bundle.promotionGate.qualityBackedSelectorReadyPriorIds, [
    "layer_composition:group_model_interplay:mono_white:foundation_group_only"
  ]);
  assert.deepEqual(bundle.promotionGate.blockers, []);
  assert.equal(bundle.promotionGate.checks.every((check) => check.ok), true);
});
