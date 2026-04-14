import test from "node:test";
import assert from "node:assert/strict";

import { buildEffectFamilyOutcomeRecords } from "../../../agent/sequence-agent/effect-outcome-records.js";

test("buildEffectFamilyOutcomeRecords emits general-training records per chosen effect family", () => {
  const records = buildEffectFamilyOutcomeRecords({
    projectKey: "proj-1",
    sequencePath: "/show/Test.xsq",
    historyEntry: { historyEntryId: "history-1" },
    planHandoff: {
      metadata: {
        requestScopeMode: "section_target_refinement",
        reviewStartLevel: "section",
        sectionScopeKind: "timing_track_windows",
        priorPassMemory: {
          unresolvedSignals: ["lead_mismatch", "weak_section_contrast"]
        },
        sequencerRevisionBrief: {
          requestScopeMode: "section_target_refinement",
          reviewStartLevel: "section",
          sectionScopeKind: "timing_track_windows",
          revisionRoles: ["strengthen_lead", "increase_section_contrast"],
          targetScope: ["MegaTree"],
          revisionTargets: ["MegaTree", "Roofline"],
          focusTargets: ["MegaTree"]
        }
      },
      commands: [
        {
          cmd: "effects.create",
          params: {
            effectName: "Bars",
            settings: {
              T_CHOICE_LayerMethod: "Additive",
              T_SLIDER_EffectLayerMix: 60,
              B_CHOICE_BufferStyle: "Overlay - Scaled",
              T_CHOICE_In_Transition_Type: "Fade",
              T_CHOICE_Out_Transition_Type: "Slide Bars",
              T_CHECKBOX_LayerMorph: "1"
            }
          },
          intent: {
            parameterPriorGuidance: {
              recommendationMode: "exact_geometry",
              priors: [
                {
                  parameterName: "speed",
                  geometryProfile: "arch_grouped",
                  modelType: "arch",
                  paletteMode: "mono_white",
                  confidence: "medium",
                  recommendedAnchors: [
                    {
                      parameterValue: 7,
                      behaviorHints: ["forward_motion"],
                      temporalSignatureHints: ["moderate_motion"]
                    }
                  ]
                }
              ]
            }
          }
        },
        { cmd: "effects.create", params: { effectName: "Bars" } },
        { cmd: "effects.create", params: { effectName: "Color Wash" } }
      ]
    },
    sequenceRevisionObjective: {
      ladderLevel: "section",
      scope: {
        revisionRoles: ["strengthen_lead"],
        revisionTargets: ["MegaTree"]
      }
    },
    renderObservation: {
      leadModel: "MegaTree",
      breadthRead: "broad",
      temporalRead: "evolving",
      coverageRead: "full"
    },
    renderCritiqueContext: {
      observed: {
        leadModel: "MegaTree",
        breadthRead: "broad",
        temporalRead: "evolving",
        coverageRead: "full"
      },
      comparison: {
        leadMatchesPrimaryFocus: true,
        adjacentWindowComparisons: []
      }
    },
    applyResult: { status: "success" }
  });

  assert.equal(records.length, 2);
  assert.deepEqual(records.map((row) => row.effectName), ["Bars", "Color Wash"]);
  assert.equal(records[0].storageClass, "general_training");
  assert.equal(records[0].requestScope.mode, "section_target_refinement");
  assert.deepEqual(records[0].revisionRoles, ["strengthen_lead", "increase_section_contrast"]);
  assert.deepEqual(records[0].appliedParameterGuidance, [
    {
      parameterName: "speed",
      appliedValue: 7,
      paletteMode: "mono_white",
      confidence: "medium",
      recommendationMode: "exact_geometry",
      geometryProfile: "arch_grouped",
      modelType: "arch",
      behaviorHints: ["forward_motion"],
      temporalSignatureHints: ["moderate_motion"]
    }
  ]);
  assert.deepEqual(records[0].appliedSharedSettingGuidance, [
    { settingName: "bufferStyle", appliedValue: "Overlay - Scaled" },
    { settingName: "effectLayerMix", appliedValue: "60" },
    { settingName: "inTransitionType", appliedValue: "Fade" },
    { settingName: "layerMethod", appliedValue: "Additive" },
    { settingName: "layerMorph", appliedValue: true },
    { settingName: "outTransitionType", appliedValue: "Slide Bars" }
  ]);
  assert.deepEqual(records[0].resolvedSignals, ["lead_mismatch", "weak_section_contrast"]);
  assert.equal(records[0].outcome.status, "improved");
});
