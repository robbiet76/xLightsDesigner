import test from "node:test";
import assert from "node:assert/strict";

import { buildLayerCompositionPriors } from "./build-layer-composition-priors.mjs";

test("prior builder stages conditional non-selector-ready layer composition priors", () => {
  const bundle = buildLayerCompositionPriors({
    deltaSummary: {
      runId: "run-1",
      runRoot: "/tmp/run-1",
      experiments: [{
        experimentId: "group-model-interplay-rgb_primary",
        family: "group_model_interplay",
        paletteProfile: "rgb_primary",
        passDeltas: [
          {
            passId: "empty_baseline",
            learningId: "learning:baseline",
            candidateLearning: { confidence: "no_macro_change_detected", statements: [] },
            baselineDelta: { current: {} },
            previousDelta: {}
          },
          {
            passId: "group_then_model",
            learningId: "learning:group_then_model",
            observationRef: "/tmp/obs.json",
            passPlanRef: "/tmp/pass-plan.json",
            placementSummary: {
              targetScopes: ["group", "model"],
              modelTypes: ["arch", "spinner"],
              geometryProfiles: ["arch_grouped", "spinner_standard"],
              effectNames: ["Bars", "Pinwheel"],
              compositionPasses: ["foundation", "focal"],
              layerIndexes: [0, 1],
              layerBlendRoles: ["foundation", "focal"]
            },
            baselineDelta: {
              activeModelCountDelta: 3,
              maxActiveNodeCountDelta: 219,
              meanSceneSpreadRatioDelta: 0.03,
              meanColorSpreadDelta: 0.2,
              multicolorFrameRatioDelta: 1,
              current: {
                activeModelNames: ["ArchGroup", "ArchSingle", "Spinner"],
                leadModel: "ArchGroup",
                dominantColorRole: "mixed"
              }
            },
            previousDelta: {
              centroidMotionMeanDelta: 0.5,
              brightnessDeltaMeanDelta: 0
            },
            candidateLearning: {
              confidence: "smoke_observed",
              statements: ["activates ArchGroup, ArchSingle, Spinner"]
            },
            changedLayerSettings: [{
              settingName: "brightness",
              baselineValue: null,
              variantValue: 65,
              affectedLayer: { target: "ArchGroup", layerIndex: 0 }
            }],
            changedEffectSettings: [{
              settingName: "barCount",
              baselineValue: 3,
              variantValue: 5,
              affectedLayer: { target: "ArchGroup", layerIndex: 0, effectName: "Bars" }
            }],
            renderSettingDeltas: [{
              settingName: "brightness",
              interpretedDeltas: ["brightness_variation_increased"],
              metricDeltas: {
                brightnessDeltaMeanDelta: 0.12,
                brightnessDeltaMaxDelta: 0.4,
                meanEdgeSoftnessDelta: 0.2,
                activeNodeRetentionMeanDelta: 0.3,
                rgbSimilarityMeanDelta: -0.1,
                openingToMiddleBrightnessDeltaDelta: 0.07
              }
            }],
            effectSettingDeltas: [{
              settingName: "barCount",
              affectedLayer: { target: "ArchGroup", layerIndex: 0, effectName: "Bars" },
              interpretedDeltas: ["color_position_motion_increased"],
              metricDeltas: {
                colorSequenceChangeMeanDelta: 0.15,
                colorSequenceChangeMaxDelta: 0.3
              }
            }]
          }
        ]
      }]
    }
  });

  assert.equal(bundle.artifactType, "layer_composition_priors_v1");
  assert.equal(bundle.priorCount, 1);
  assert.equal(bundle.selectorReadyCount, 0);
  const prior = bundle.priors[0];
  assert.equal(prior.selectorReady, false);
  assert.equal(prior.promotionState, "staged");
  assert.equal(prior.scope.compositionIntent, "foundation_plus_model_focus");
  assert.deepEqual(prior.scope.effectNames, ["Bars", "Pinwheel"]);
  assert.deepEqual(prior.scope.targetScopes, ["group", "model"]);
  assert.deepEqual(prior.scope.layerIndexes, [0, 1]);
  assert.deepEqual(prior.conditions.observedActiveModels, ["ArchGroup", "ArchSingle", "Spinner"]);
  assert.deepEqual(prior.conditions.geometryProfiles, ["arch_grouped", "spinner_standard"]);
  assert.deepEqual(prior.conditions.changedLayerSettings.map((row) => row.settingName), ["brightness"]);
  assert.deepEqual(prior.conditions.changedEffectSettings.map((row) => row.settingName), ["barCount"]);
  assert.equal(prior.observedEffects.sceneSpreadDirectionFromBaseline, "increase");
  assert.equal(prior.observedEffects.multicolorFrameRatioDirectionFromBaseline, "increase");
  assert.equal(prior.observedEffects.renderSettingDeltas[0].settingName, "brightness");
  assert.equal(prior.observedEffects.renderSettingDeltas[0].metricDeltas.brightnessDeltaMeanDelta, 0.12);
  assert.equal(prior.observedEffects.renderSettingDeltas[0].metricDeltas.meanEdgeSoftnessDelta, 0.2);
  assert.equal(prior.observedEffects.renderSettingDeltas[0].metricDeltas.activeNodeRetentionMeanDelta, 0.3);
  assert.equal(prior.observedEffects.renderSettingDeltas[0].metricDeltas.rgbSimilarityMeanDelta, -0.1);
  assert.equal(prior.observedEffects.renderSettingDeltas[0].metricDeltas.openingToMiddleBrightnessDeltaDelta, 0.07);
  assert.equal(prior.observedEffects.effectSettingDeltas[0].settingName, "barCount");
  assert.equal(prior.observedEffects.effectSettingDeltas[0].effectName, "Bars");
  assert.equal(prior.observedEffects.effectSettingDeltas[0].metricDeltas.colorSequenceChangeMeanDelta, 0.15);
  assert.equal(prior.guidance.includes("activates ArchGroup, ArchSingle, Spinner"), true);
  assert.equal(prior.guidance.includes("brightness: brightness_variation_increased"), true);
  assert.equal(prior.guidance.includes("Bars barCount: color_position_motion_increased"), true);
  assert.equal(prior.safeguards.some((text) => text.includes("fixed sequencing recipe")), true);
});

test("prior builder attaches durable quality evidence when available", () => {
  const bundle = buildLayerCompositionPriors({
    deltaSummary: {
      runId: "run-1",
      runRoot: "/tmp/run-1",
      experiments: [{
        experimentId: "group-model-interplay-rgb_primary",
        family: "group_model_interplay",
        paletteProfile: "rgb_primary",
        passDeltas: [{
          passId: "foundation_group_only",
          learningId: "learning:foundation",
          observationRef: "/tmp/obs.json",
          passPlanRef: "/tmp/pass-plan.json",
          placementSummary: {
            targetScopes: ["group"],
            modelTypes: ["arch"],
            geometryProfiles: ["arch_grouped"],
            effectNames: ["Bars"],
            compositionPasses: ["foundation"],
            layerIndexes: [0],
            layerBlendRoles: ["foundation"]
          },
          baselineDelta: {
            activeModelCountDelta: 1,
            maxActiveNodeCountDelta: 100,
            current: { activeModelNames: ["ArchGroup"] }
          },
          previousDelta: {},
          candidateLearning: {
            confidence: "smoke_observed",
            statements: ["activates ArchGroup"]
          }
        }]
      }]
    },
    qualityRecords: {
      sourceQualityRecordsRef: "/tmp/run-1/layer-composition-quality-records.json",
      records: [{
        recordId: "layer_quality:group-model-interplay-rgb_primary:foundation_group_only:bars:archgroup",
        experimentId: "group-model-interplay-rgb_primary",
        passId: "foundation_group_only",
        effectName: "Bars",
        leadTargets: ["ArchGroup"],
        sampleCount: 2,
        trendStatus: "stable",
        quality: {
          latestOverallQuality: 0.86,
          meanOverallQuality: 0.84
        },
        observedMetrics: {
          meanVisualReadability: 0.82,
          meanIntentMatch: 0.83,
          meanMotionCoherence: 0.81
        },
        evidence: {
          latestRenderReviewRef: "/tmp/render-review.json",
          latestQualityRef: "/tmp/quality.json"
        },
        promotion: {
          durableCandidate: true,
          blockers: []
        }
      }]
    }
  });

  assert.equal(bundle.qualityBackedPriorCount, 1);
  assert.equal(bundle.sourceQualityRecordsRef, "/tmp/run-1/layer-composition-quality-records.json");
  const prior = bundle.priors[0];
  assert.equal(prior.qualityEvidence.durableCandidate, true);
  assert.equal(prior.qualityEvidence.sampleCount, 2);
  assert.equal(prior.qualityEvidence.meanOverallQuality, 0.84);
  assert.equal(prior.guidance.some((row) => row.includes("quality evidence accepted across 2 samples")), true);
});
