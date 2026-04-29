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
        }
      }]
    },
    sourcePath: "/tmp/layer-composition-priors-staged.json"
  });

  assert.equal(bundle.artifactType, "sequencer_layer_composition_priors_bundle");
  assert.equal(bundle.recordCount, 1);
  assert.equal(bundle.retrievalContract.consumptionPolicy, "advisory_evidence_not_recipe");
  assert.deepEqual(bundle.indexes.byFamily.group_model_interplay, ["layer_composition:group_model_interplay:rgb_primary:group_then_model"]);
  assert.deepEqual(bundle.indexes.byPaletteProfile.rgb_primary, ["layer_composition:group_model_interplay:rgb_primary:group_then_model"]);
  assert.deepEqual(bundle.indexes.byCompositionIntent.foundation_plus_model_focus, ["layer_composition:group_model_interplay:rgb_primary:group_then_model"]);
  assert.deepEqual(bundle.indexes.byOutcomeTag.scene_spread_increased, ["layer_composition:group_model_interplay:rgb_primary:group_then_model"]);
  assert.deepEqual(bundle.indexes.byOutcomeTag.order_equivalent, ["layer_composition:group_model_interplay:rgb_primary:group_then_model"]);
});
