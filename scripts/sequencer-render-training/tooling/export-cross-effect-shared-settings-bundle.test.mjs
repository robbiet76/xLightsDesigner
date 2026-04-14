import test from "node:test";
import assert from "node:assert/strict";

import { buildBundle } from "./export-cross-effect-shared-settings-bundle.mjs";

test("cross-effect shared settings bundle preserves only generic normalized setting memory", () => {
  const bundle = buildBundle({
    artifactType: "sequencer_unified_training_set_v1",
    artifactVersion: "1.0",
    crossEffectSharedSettingLearning: {
      sharedSettingOutcomeMemory: {
        layerMethod: [
          {
            appliedValue: "Additive",
            sampleCount: 3,
            successfulUses: 2,
            failedUses: 1,
            effectNames: ["Bars", "Marquee"],
            favoredScopes: ["section_target_refinement"],
            favoredSignals: ["lead_mismatch"],
            cautionSignals: ["over_coverage"]
          }
        ],
        inTransitionType: [
          {
            appliedValue: "Fade",
            sampleCount: 2,
            successfulUses: 2,
            failedUses: 0,
            effectNames: ["Color Wash"],
            favoredScopes: ["whole_sequence"],
            favoredSignals: ["weak_section_contrast"],
            cautionSignals: []
          }
        ]
      }
    }
  });

  assert.equal(bundle.artifactType, "sequencer_cross_effect_shared_settings_bundle");
  assert.equal(bundle.settingCount, 2);
  assert.equal(bundle.settingsByName.layerMethod[0].appliedValue, "Additive");
  assert.deepEqual(bundle.settingsByName.layerMethod[0].effectNames, ["Bars", "Marquee"]);
});

test("cross-effect shared settings bundle stays generic and excludes runtime-specific identifiers", () => {
  const bundle = buildBundle({
    artifactType: "sequencer_unified_training_set_v1",
    artifactVersion: "1.0",
    crossEffectSharedSettingLearning: {
      sharedSettingOutcomeMemory: {
        bufferStyle: [
          {
            appliedValue: "Overlay - Scaled",
            sampleCount: 1,
            successfulUses: 1,
            failedUses: 0,
            effectNames: ["Bars"],
            favoredScopes: ["section_target_refinement"],
            favoredSignals: ["lead_mismatch"],
            cautionSignals: []
          }
        ]
      }
    }
  });
  const text = JSON.stringify(bundle);
  for (const forbidden of [
    "modelName",
    "sequencePath",
    "workingSequencePath",
    "Chorus 1",
    "MegaTree",
    "SpinnerHero"
  ]) {
    assert.equal(text.includes(forbidden), false, `unexpected token in shared setting bundle: ${forbidden}`);
  }
});
