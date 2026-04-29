import test from "node:test";
import assert from "node:assert/strict";

import { buildPracticalSequenceValidation } from "../../../agent/sequence-agent/practical-sequence-validation.js";

test("practical sequence validation summarizes readback and design alignment", () => {
  const artifact = buildPracticalSequenceValidation({
    planHandoff: {
      planId: "plan-1",
      commands: [
        {
          cmd: "timing.insertMarks",
          params: {
            trackName: "XD: Song Structure",
            marks: [
              { label: "Verse 1", startMs: 0, endMs: 50000 },
              { label: "Chorus 1", startMs: 50000, endMs: 100000 }
            ]
          }
        },
        {
          cmd: "effects.create",
          anchor: { trackName: "XD: Song Structure", section: "Verse 1", startMs: 0, endMs: 20000 },
          params: { modelName: "TreeRound", layerIndex: 0, effectName: "Spirals", startMs: 0, endMs: 20000 }
        },
        {
          cmd: "effects.alignToTiming",
          params: { modelName: "TreeRound", layerIndex: 0, startMs: 0, endMs: 20000, timingTrackName: "XD: Song Structure", mode: "nearest" }
        },
        {
          cmd: "effects.create",
          anchor: { trackName: "XD: Song Structure", section: "Verse 1", startMs: 20000, endMs: 40000 },
          params: { modelName: "TreeRound", layerIndex: 0, effectName: "Wave", startMs: 20000, endMs: 40000 }
        },
        {
          cmd: "effects.create",
          anchor: { trackName: "XD: Song Structure", section: "Verse 1", startMs: 40000, endMs: 50000 },
          params: { modelName: "TreeRound", layerIndex: 0, effectName: "Bars", startMs: 40000, endMs: 50000 }
        },
        {
          cmd: "effects.create",
          anchor: { trackName: "XD: Song Structure", section: "Chorus 1", startMs: 50000, endMs: 75000 },
          params: { modelName: "TreeRound", layerIndex: 0, effectName: "Color Wash", startMs: 50000, endMs: 75000 }
        },
        {
          cmd: "effects.create",
          anchor: { trackName: "XD: Song Structure", section: "Chorus 1", startMs: 75000, endMs: 100000 },
          params: { modelName: "TreeRound", layerIndex: 0, effectName: "Twinkle", startMs: 75000, endMs: 100000 }
        }
      ],
      metadata: {
        sequenceSettings: { durationMs: 100000 },
        sectionPlans: [
          { section: "Verse 1" },
          { section: "Chorus 1" }
        ],
        effectPlacements: [
          { sourceSectionLabel: "Verse 1" },
          { sourceSectionLabel: "Chorus 1" }
        ],
        effectStrategy: {
          compositionPlan: {
            artifactType: "composition_plan_v1",
            sections: [
              {
                section: "Verse 1",
                focalRegion: "TreeRound",
                supportRegion: "TreeRound",
                accentRegion: "",
                expectedBalance: { spatialBreadth: "focused" },
                progressionIntent: "establish motif"
              },
              {
                section: "Chorus 1",
                focalRegion: "TreeRound",
                supportRegion: "TreeRound",
                accentRegion: "",
                expectedBalance: { spatialBreadth: "center focal" },
                progressionIntent: "lift energy"
              }
            ]
          }
        },
        sequencingDesignHandoffSummary: "Tree chorus",
        sequencingSectionDirectiveCount: 1,
        metadataAssignments: [
          {
            targetId: "TreeRound",
            rolePreference: "focal",
            semanticHints: ["radial"],
            visualHintDefinitions: [
              { name: "Radial", status: "defined" }
            ]
          }
        ],
        trainingKnowledge: {
          artifactType: "sequencer_stage1_training_bundle",
          artifactVersion: "1.0"
        }
      }
    },
    applyResult: {
      artifactId: "apply-1",
      status: "applied"
    },
    verification: {
      revisionAdvanced: true,
      expectedMutationsPresent: true,
      checks: [
        { kind: "effect", target: "TreeRound@0", ok: true, detail: "Spirals present" }
      ],
      designContext: {
        designSummary: "Tree chorus",
        sectionDirectiveCount: 1
      },
      designAlignment: {
        primaryFocusTargetIds: ["TreeRound"],
        coveredPrimaryFocusTargetIds: ["TreeRound"],
        uncoveredPrimaryFocusTargetIds: [],
        preferredVisualFamilies: ["spiral_flow"],
        observedTargets: ["TreeRound"],
        observedEffectNames: ["Spirals"],
        roleCoverage: [{ role: "lead", ok: true, coveredTargetIds: ["TreeRound"] }]
      },
      designChecks: [
        { kind: "design-focus", target: "primary-focus", ok: true, detail: "covered TreeRound" }
      ]
    }
  });

  assert.equal(artifact.artifactType, "practical_sequence_validation_v1");
  assert.equal(artifact.overallOk, true);
  assert.equal(artifact.trainingKnowledge.artifactType, "sequencer_stage1_training_bundle");
  assert.equal(artifact.summary.readbackChecks.passed, 1);
  assert.equal(artifact.summary.designChecks.passed, 1);
  assert.equal(artifact.summary.metadataCoverage.missingMetadata, 0);
  assert.equal(artifact.summary.metadataCoverage.definedVisualHints, 1);
  assert.equal(artifact.summary.timingFidelity.structureTrackPresent, true);
  assert.equal(artifact.summary.timingFidelity.crossingStructureCount, 0);
  assert.ok(artifact.summary.timingFidelity.timingAwareEffectCount >= 1);
  assert.equal(artifact.summary.compositionCoverage.available, true);
  assert.equal(artifact.summary.compositionCoverage.coveredSectionCount, 2);
  assert.deepEqual(artifact.summary.compositionCoverage.missingFocusTargets, []);
  assert.deepEqual(artifact.failures.metadata, []);
  assert.deepEqual(artifact.failures.timing, []);
});

test("practical sequence validation reports missing and pending visual hint metadata on observed targets", () => {
  const artifact = buildPracticalSequenceValidation({
    planHandoff: {
      planId: "plan-2",
      metadata: {
        metadataAssignments: [
          {
            targetId: "TreeRound",
            rolePreference: "support",
            semanticHints: [],
            visualHintDefinitions: [
              { name: "Custom Pulse", status: "pending_definition" }
            ]
          }
        ]
      }
    },
    applyResult: {
      artifactId: "apply-2",
      status: "applied"
    },
    verification: {
      revisionAdvanced: true,
      expectedMutationsPresent: true,
      checks: [],
      designAlignment: {
        observedTargets: ["TreeRound", "MissingModel"]
      },
      designChecks: []
    }
  });

  assert.equal(artifact.summary.metadataCoverage.missingMetadata, 1);
  assert.equal(artifact.summary.metadataCoverage.pendingOnlyVisualHints, 1);
  assert.deepEqual(artifact.metadataCoverage.missingMetadataTargetIds, ["MissingModel"]);
  assert.deepEqual(artifact.metadataCoverage.pendingOnlyVisualHintTargetIds, ["TreeRound"]);
  assert.match(artifact.failures.metadata.map((row) => row.kind).join(","), /missing_metadata/);
  assert.match(artifact.failures.metadata.map((row) => row.kind).join(","), /pending_visual_hint_definition/);
});

test("practical sequence validation treats semantic tag targets as covered by member metadata", () => {
  const artifact = buildPracticalSequenceValidation({
    planHandoff: {
      planId: "plan-tag-coverage",
      metadata: {
        metadataAssignments: [
          {
            targetId: "CandyCane-01",
            tags: ["CandyCanes"],
            semanticHints: ["Repeated prop family"],
            visualHintDefinitions: [
              { name: "Repeated prop family", status: "defined" }
            ]
          },
          {
            targetId: "CandyCane-02",
            tags: ["CandyCanes"],
            semanticHints: ["Repeated prop family"]
          }
        ]
      }
    },
    applyResult: {
      artifactId: "apply-tag-coverage",
      status: "applied"
    },
    verification: {
      revisionAdvanced: true,
      expectedMutationsPresent: true,
      checks: [],
      designAlignment: {
        observedTargets: ["CandyCanes", "UnknownGroup"]
      },
      designChecks: []
    }
  });

  assert.equal(artifact.summary.metadataCoverage.missingMetadata, 1);
  assert.equal(artifact.summary.metadataCoverage.definedVisualHints, 1);
  assert.deepEqual(artifact.metadataCoverage.missingMetadataTargetIds, ["UnknownGroup"]);
  assert.equal(artifact.failures.metadata.some((row) => row.target === "CandyCanes"), false);
});

test("practical sequence validation separates layout-derived support targets from missing intent metadata", () => {
  const artifact = buildPracticalSequenceValidation({
    planHandoff: {
      planId: "plan-layout-support",
      metadata: {
        effectPlacements: [
          {
            targetId: "Train_Caboose",
            targetRole: "support",
            compositionRole: "support",
            spatialCoverageFiller: true
          },
          {
            targetId: "UnknownLead",
            targetRole: "accent",
            compositionRole: "focal"
          }
        ],
        metadataAssignments: []
      }
    },
    applyResult: {
      artifactId: "apply-layout-support",
      status: "applied"
    },
    verification: {
      revisionAdvanced: true,
      expectedMutationsPresent: true,
      checks: [],
      designAlignment: {
        observedTargets: ["Train_Caboose", "UnknownLead"]
      },
      designChecks: []
    }
  });

  assert.equal(artifact.summary.metadataCoverage.missingMetadata, 1);
  assert.equal(artifact.summary.metadataCoverage.layoutDerivedSupportTargets, 1);
  assert.deepEqual(artifact.metadataCoverage.missingMetadataTargetIds, ["UnknownLead"]);
  assert.deepEqual(artifact.metadataCoverage.layoutDerivedSupportTargetIds, ["Train_Caboose"]);
  assert.equal(artifact.failures.metadata.some((row) => row.kind === "missing_metadata" && row.target === "Train_Caboose"), false);
  assert.equal(artifact.failures.metadata.some((row) => row.kind === "layout_derived_support_target" && row.target === "Train_Caboose"), true);
});

test("practical sequence validation treats xLights structural layout targets as derived metadata", () => {
  const artifact = buildPracticalSequenceValidation({
    planHandoff: {
      planId: "plan-structural-layout",
      metadata: {
        effectPlacements: [
          {
            targetId: "Borders",
            targetRole: "foundation",
            compositionRole: "background",
            targetGranularity: "group"
          },
          {
            targetId: "UpperGutter-01",
            targetRole: "support",
            compositionRole: "support",
            targetGranularity: "target"
          },
          {
            targetId: "UnknownLead",
            targetRole: "accent",
            compositionRole: "focal"
          }
        ],
        metadataAssignments: []
      }
    },
    applyResult: {
      artifactId: "apply-structural-layout",
      status: "applied"
    },
    verification: {
      revisionAdvanced: true,
      expectedMutationsPresent: true,
      checks: [],
      designAlignment: {
        observedTargets: ["Borders", "UpperGutter-01", "UnknownLead"]
      },
      designChecks: []
    }
  });

  assert.equal(artifact.summary.metadataCoverage.missingMetadata, 1);
  assert.equal(artifact.summary.metadataCoverage.xlightsDerivedStructuralTargets, 2);
  assert.deepEqual(artifact.metadataCoverage.missingMetadataTargetIds, ["UnknownLead"]);
  assert.deepEqual(artifact.metadataCoverage.xlightsDerivedStructuralTargetIds, ["Borders", "UpperGutter-01"]);
  assert.equal(artifact.failures.metadata.some((row) => row.kind === "missing_metadata" && row.target === "Borders"), false);
  assert.equal(artifact.failures.metadata.some((row) => row.kind === "xlights_structural_metadata" && row.target === "Borders"), true);
});

test("practical sequence validation summarizes failed preservation readback checks", () => {
  const artifact = buildPracticalSequenceValidation({
    planHandoff: {
      planId: "plan-preserve",
      commands: [
        {
          cmd: "effects.create",
          params: { modelName: "Snowman", layerIndex: 1, effectName: "Color Wash", startMs: 1000, endMs: 2000 }
        }
      ]
    },
    applyResult: {
      artifactId: "apply-preserve",
      status: "applied"
    },
    verification: {
      revisionAdvanced: true,
      expectedMutationsPresent: false,
      checks: [
        { kind: "effect", target: "Snowman@1", ok: true, detail: "Color Wash present" },
        { kind: "effect-preservation", target: "Snowman@0->1", ok: false, detail: "original layer 0 missing preserved effects" }
      ],
      designChecks: []
    }
  });

  assert.equal(artifact.overallOk, false);
  assert.equal(artifact.summary.readbackChecks.failed, 1);
  assert.deepEqual(artifact.summary.preservationChecks, {
    total: 1,
    passed: 0,
    failed: 1,
    failedTargets: ["Snowman@0->1"]
  });
  assert.deepEqual(artifact.failures.readback, [
    {
      kind: "effect-preservation",
      target: "Snowman@0->1",
      detail: "original layer 0 missing preserved effects"
    }
  ]);
});

test("practical sequence validation summarizes effect settings and palette payload matches", () => {
  const artifact = buildPracticalSequenceValidation({
    planHandoff: {
      planId: "plan-payload",
      commands: [
        {
          cmd: "effects.create",
          params: { modelName: "MegaTree", layerIndex: 0, effectName: "Color Wash", startMs: 1000, endMs: 2000 }
        },
        {
          cmd: "effects.create",
          params: { modelName: "Roofline", layerIndex: 0, effectName: "Bars", startMs: 2000, endMs: 3000 }
        }
      ]
    },
    verification: {
      revisionAdvanced: true,
      expectedMutationsPresent: true,
      checks: [
        { kind: "effect", target: "MegaTree@0", ok: true, settingsMatched: true, paletteMatched: true },
        { kind: "effect", target: "Roofline@0", ok: false, settingsMatched: false, paletteMatched: true }
      ],
      designChecks: []
    }
  });

  assert.deepEqual(artifact.summary.effectPayloadChecks, {
    effectPayloadChecks: 2,
    settingsChecked: 2,
    settingsMatched: 1,
    settingsFailed: 1,
    settingsMatchRatio: 0.5,
    settingsFailedTargets: ["Roofline@0"],
    paletteChecked: 2,
    paletteMatched: 2,
    paletteFailed: 0,
    paletteMatchRatio: 1,
    paletteFailedTargets: []
  });
  assert.equal(artifact.effectPayloadChecks.settingsMatchRatio, 0.5);
  assert.equal(artifact.effectPayloadChecks.paletteMatchRatio, 1);
});

test("practical sequence validation fails sparse low-diversity sequence plans", () => {
  const artifact = buildPracticalSequenceValidation({
    planHandoff: {
      planId: "plan-3",
      commands: [
        {
          cmd: "effects.create",
          params: { modelName: "TreeRound", effectName: "Shimmer", startMs: 0, endMs: 5000 }
        },
        {
          cmd: "effects.create",
          params: { modelName: "TreeRound", effectName: "Shimmer", startMs: 10000, endMs: 15000 }
        }
      ],
      metadata: {
        sequenceSettings: { durationMs: 60000 },
        sectionPlans: [
          { section: "Intro" },
          { section: "Verse 1" },
          { section: "Chorus 1" }
        ],
        effectPlacements: [
          { sourceSectionLabel: "Intro" },
          { sourceSectionLabel: "Verse 1" }
        ],
        metadataAssignments: []
      }
    },
    applyResult: {
      artifactId: "apply-3",
      status: "applied"
    },
    verification: {
      revisionAdvanced: true,
      expectedMutationsPresent: true,
      checks: [],
      designAlignment: {
        observedTargets: ["TreeRound"],
        observedEffectNames: ["Shimmer"]
      },
      designChecks: []
    }
  });

  assert.equal(artifact.overallOk, false);
  assert.equal(artifact.planQuality.distinctEffectCount, 1);
  assert.ok(artifact.planQuality.timelineCoverageRatio < 0.55);
  assert.match(artifact.failures.quality.map((row) => row.kind).join(","), /timeline_coverage/);
  assert.match(artifact.failures.quality.map((row) => row.kind).join(","), /effect_diversity/);
  assert.match(artifact.failures.quality.map((row) => row.kind).join(","), /effect_monoculture/);
  assert.match(artifact.failures.quality.map((row) => row.kind).join(","), /empty_sections/);
});

test("practical sequence validation fails under-scaled whole-song plans", () => {
  const commands = [];
  for (let index = 0; index < 40; index += 1) {
    commands.push({
      cmd: "effects.create",
      params: {
        modelName: `Model-${(index % 5) + 1}`,
        layerIndex: index % 2,
        effectName: index % 2 === 0 ? "Bars" : "Wave",
        startMs: index * 1000,
        endMs: (index * 1000) + 1000
      }
    });
  }
  const artifact = buildPracticalSequenceValidation({
    planHandoff: {
      planId: "plan-4",
      commands,
      metadata: {
        sequenceSettings: { durationMs: 240000 },
        sectionPlans: Array.from({ length: 10 }, (_, idx) => ({ section: `Section ${idx + 1}` })),
        effectPlacements: Array.from({ length: 40 }, (_, idx) => ({ sourceSectionLabel: `Section ${(idx % 10) + 1}` })),
        metadataAssignments: []
      }
    },
    applyResult: {
      artifactId: "apply-4",
      status: "applied"
    },
    verification: {
      revisionAdvanced: true,
      expectedMutationsPresent: true,
      checks: [],
      designAlignment: {
        observedTargets: ["Model-1", "Model-2", "Model-3", "Model-4", "Model-5"],
        observedEffectNames: ["Bars", "Wave"]
      },
      designChecks: []
    }
  });

  assert.equal(artifact.overallOk, false);
  assert.match(artifact.failures.quality.map((row) => row.kind).join(","), /effect_count_scale/);
  assert.match(artifact.failures.quality.map((row) => row.kind).join(","), /effect_density_scale/);
  assert.match(artifact.failures.quality.map((row) => row.kind).join(","), /active_target_scale/);
  assert.match(artifact.failures.quality.map((row) => row.kind).join(","), /section_density_scale/);
  assert.match(artifact.failures.quality.map((row) => row.kind).join(","), /layer_utilization_scale/);
});

test("practical sequence validation flags weak whole-song effect usage taste", () => {
  const commands = Array.from({ length: 220 }, (_, index) => ({
    cmd: "effects.create",
    intent: {
      sourceSectionLabel: `Section ${(index % 12) + 1}`,
      section: `Section ${(index % 12) + 1}`,
      settingsIntent: {},
      parameterPriorGuidance: { priors: [] }
    },
    params: {
      modelName: `Model-${(index % 24) + 1}`,
      layerIndex: index % 2,
      effectName: index % 2 === 0 ? "On" : "SingleStrand",
      startMs: index * 1000,
      endMs: (index * 1000) + 12000,
      settings: index % 2 === 0 ? {} : { E_SLIDER_Skips_Advance: 16 }
    }
  }));
  const artifact = buildPracticalSequenceValidation({
    planHandoff: {
      planId: "plan-effect-taste",
      commands,
      metadata: {
        sequenceSettings: { durationMs: 240000 },
        sectionPlans: Array.from({ length: 12 }, (_, idx) => ({ section: `Section ${idx + 1}` })),
        effectPlacements: commands.map((command) => ({
          sourceSectionLabel: command.intent.sourceSectionLabel,
          effectName: command.params.effectName
        })),
        metadataAssignments: []
      }
    },
    applyResult: {
      artifactId: "apply-effect-taste",
      status: "applied"
    },
    verification: {
      revisionAdvanced: true,
      expectedMutationsPresent: true,
      checks: [],
      designAlignment: {
        observedTargets: ["Model-1"],
        observedEffectNames: ["On", "SingleStrand"]
      },
      designChecks: []
    }
  });

  assert.equal(artifact.overallOk, false);
  assert.ok(artifact.planQuality.effectUsageQuality.score < 0.65);
  assert.match(artifact.planQuality.effectUsageQuality.issueKinds.join(","), /generic_or_thin_effect_settings/);
  assert.match(artifact.failures.quality.map((row) => row.kind).join(","), /effect_usage_taste/);
});

test("practical sequence validation traces trained effect usage evidence", () => {
  const artifact = buildPracticalSequenceValidation({
    planHandoff: {
      planId: "plan-training-trace",
      commands: [
        {
          cmd: "effects.create",
          intent: {
            sourceSectionLabel: "Chorus",
            settingsIntent: {
              configuredBehaviorRecordId: "behavior-record-1",
              deterministicEffectSelection: "training_metadata_ranked_no_random",
              targetGranularity: "group",
              layerCompositionPriorIds: ["layer-prior-1"]
            },
            parameterPriorGuidance: {
              recommendationMode: "exact_geometry",
              configuredBehaviorRecordId: "behavior-record-1",
              priors: [
                {
                  parameterName: "speed",
                  sourceRecordId: "screening-record-1",
                  recommendedAnchors: [{ parameterValue: 7 }]
                }
              ]
            },
            layerCompositionGuidance: {
              artifactType: "sequencer_layer_composition_guidance_v1",
              recommendations: [
                {
                  priorId: "layer-prior-1",
                  sourceRefs: { observationRef: "composition-observation-1" }
                }
              ]
            }
          },
          params: {
            modelName: "TreeRound",
            layerIndex: 0,
            effectName: "Twinkle",
            startMs: 0,
            endMs: 5000,
            settings: {
              E_SLIDER_Speed: 7,
              C_BUTTON_Palette1: "#ffffff",
              C_CHECKBOX_Palette1: true
            }
          }
        },
        {
          cmd: "effects.create",
          intent: {
            sourceSectionLabel: "Chorus",
            sourceAggregateTargetId: "TreeRound",
            targetGranularity: "member",
            settingsIntent: {
              sourceAggregateTargetId: "TreeRound",
              layerCompositionPriorIds: ["layer-prior-2"]
            },
            parameterPriorGuidance: { priors: [] }
          },
          params: {
            modelName: "TreeRound",
            layerIndex: 1,
            effectName: "On",
            startMs: 0,
            endMs: 5000,
            settings: {}
          }
        }
      ],
      metadata: {
        sequenceSettings: { durationMs: 5000 }
      }
    },
    applyResult: {
      artifactId: "apply-training-trace",
      status: "applied"
    },
    verification: {
      revisionAdvanced: true,
      expectedMutationsPresent: true,
      checks: [],
      designAlignment: {
        observedTargets: ["TreeRound"],
        observedEffectNames: ["Twinkle", "On"]
      },
      designChecks: []
    }
  });

  assert.equal(artifact.trainingUsageTrace.artifactType, "sequencer_training_usage_trace_v1");
  assert.equal(artifact.trainingUsageTrace.commandCount, 2);
  assert.equal(artifact.trainingUsageTrace.configuredBehaviorCoverage, 0.5);
  assert.equal(artifact.trainingUsageTrace.parameterPriorCoverage, 0.5);
  assert.equal(artifact.trainingUsageTrace.sourcedPriorCoverage, 0.5);
  assert.equal(artifact.trainingUsageTrace.palettePayloadCoverage, 0.5);
  assert.equal(artifact.compositionTrainingTrace.artifactType, "sequencer_composition_training_trace_v1");
  assert.equal(artifact.compositionTrainingTrace.layerCompositionGuidanceCoverage, 1);
  assert.equal(artifact.compositionTrainingTrace.layerCompositionPriorCoverage, 1);
  assert.equal(artifact.compositionTrainingTrace.layerCompositionSourcedPriorCoverage, 0.5);
  assert.equal(artifact.compositionTrainingTrace.groupModelInterplayWindowCount, 1);
  assert.equal(artifact.compositionTrainingTrace.sameTargetLayerStackTargetCount, 1);
  assert.equal(artifact.trainingUsageTrace.byEffect.find((row) => row.effectName === "Twinkle")?.configuredBehaviorCoverage, 1);
  assert.deepEqual(artifact.trainingUsageTrace.commands[0].parameterPriorGuidance.sourceRecordIds, ["screening-record-1"]);
  assert.match(artifact.trainingUsageTrace.commands[1].gaps.join(","), /missing_configured_behavior_record/);
  assert.equal(artifact.summary.trainingUsageTrace.commandCount, 2);
  assert.equal(artifact.summary.compositionTrainingTrace.commandCount, 2);
});

test("practical sequence validation fails effects that cross reviewed structure boundaries", () => {
  const artifact = buildPracticalSequenceValidation({
    planHandoff: {
      planId: "plan-5",
      commands: [
        {
          cmd: "timing.insertMarks",
          params: {
            trackName: "XD: Song Structure",
            marks: [
              { label: "Verse 1", startMs: 0, endMs: 30000 },
              { label: "Chorus 1", startMs: 30000, endMs: 60000 }
            ]
          }
        },
        {
          cmd: "effects.create",
          anchor: { trackName: "XD: Song Structure", section: "Verse 1", startMs: 20000, endMs: 40000 },
          params: { modelName: "TreeRound", layerIndex: 0, effectName: "Wave", startMs: 20000, endMs: 40000 }
        }
      ],
      metadata: {
        sequenceSettings: { durationMs: 60000 },
        sectionPlans: [
          { section: "Verse 1" },
          { section: "Chorus 1" }
        ],
        effectPlacements: [
          { sourceSectionLabel: "Verse 1" }
        ],
        metadataAssignments: []
      }
    },
    applyResult: {
      artifactId: "apply-5",
      status: "applied"
    },
    verification: {
      revisionAdvanced: true,
      expectedMutationsPresent: true,
      checks: [],
      designAlignment: {
        observedTargets: ["TreeRound"],
        observedEffectNames: ["Wave"]
      },
      designChecks: []
    }
  });

  assert.equal(artifact.overallOk, false);
  assert.equal(artifact.summary.timingFidelity.crossingStructureCount, 1);
  assert.equal(artifact.summary.timingFidelity.crossingSectionTimingCount, 1);
  assert.match(artifact.failures.timing.map((row) => row.kind).join(","), /crosses_section_timing_boundary/);
});

test("practical sequence validation fails free-floating effects", () => {
  const artifact = buildPracticalSequenceValidation({
    planHandoff: {
      planId: "plan-floating",
      commands: [
        {
          cmd: "timing.insertMarks",
          params: {
            trackName: "XD: Song Structure",
            marks: [
              { label: "Verse 1", startMs: 0, endMs: 10000 }
            ]
          }
        },
        {
          cmd: "effects.create",
          anchor: { trackName: "XD: Song Structure", basis: "explicit_window", startMs: 2000, endMs: 3000 },
          params: { modelName: "TreeRound", layerIndex: 0, effectName: "Wave", startMs: 2000, endMs: 3000 }
        }
      ],
      metadata: {
        sequenceSettings: { durationMs: 10000 },
        sectionPlans: [{ section: "Verse 1" }],
        effectPlacements: [{ sourceSectionLabel: "Verse 1" }]
      }
    },
    applyResult: {
      artifactId: "apply-floating",
      status: "applied"
    },
    verification: {
      revisionAdvanced: true,
      expectedMutationsPresent: true,
      checks: [],
      designAlignment: {
        observedTargets: ["TreeRound"],
        observedEffectNames: ["Wave"]
      },
      designChecks: []
    }
  });

  assert.equal(artifact.overallOk, false);
  assert.equal(artifact.summary.timingFidelity.freeFloatingEffectCount, 1);
  assert.match(artifact.failures.timing.map((row) => row.kind).join(","), /free_floating_effect/);
});

test("practical sequence validation summarizes composition plan coverage gaps", () => {
  const artifact = buildPracticalSequenceValidation({
    planHandoff: {
      planId: "plan-composition-coverage",
      commands: [
        {
          cmd: "effects.create",
          anchor: { markLabel: "Intro" },
          params: { modelName: "Roofline", layerIndex: 0, effectName: "Bars", startMs: 0, endMs: 10000 }
        }
      ],
      metadata: {
        sequenceSettings: { durationMs: 60000 },
        sectionPlans: [
          { section: "Intro" },
          { section: "Chorus" }
        ],
        effectPlacements: [
          { sourceSectionLabel: "Intro" },
          { sourceSectionLabel: "Chorus" }
        ],
        effectStrategy: {
          compositionPlan: {
            artifactType: "composition_plan_v1",
            sections: [
              {
                section: "Intro",
                focalRegion: "MegaTree",
                supportRegion: "Roofline",
                accentRegion: "MiniTrees",
                expectedBalance: { spatialBreadth: "broad front line plus center focal" },
                progressionIntent: "establish"
              },
              {
                section: "Chorus",
                focalRegion: "MegaTree",
                supportRegion: "Roofline",
                accentRegion: "MiniTrees",
                layerStackTargets: ["MegaTree"],
                expectedBalance: { spatialBreadth: "wide full-display" },
                progressionIntent: "expand"
              }
            ]
          }
        }
      }
    },
    applyResult: {
      artifactId: "apply-composition-coverage",
      status: "applied"
    },
    verification: {
      revisionAdvanced: true,
      expectedMutationsPresent: true,
      checks: [],
      designAlignment: {
        observedTargets: ["Roofline"],
        observedEffectNames: ["Bars"]
      },
      designChecks: []
    }
  });

  assert.equal(artifact.overallOk, false);
  assert.equal(artifact.summary.compositionCoverage.available, true);
  assert.equal(artifact.summary.compositionCoverage.coveredSectionCount, 1);
  assert.deepEqual(artifact.summary.compositionCoverage.missingSections, ["Chorus"]);
  assert.deepEqual(artifact.summary.compositionCoverage.missingFocusTargets, ["MegaTree"]);
  assert.deepEqual(artifact.summary.compositionCoverage.missingLayerStackTargets, ["MegaTree"]);
  assert.match(artifact.failures.quality.map((row) => row.kind).join(","), /composition_section_coverage/);
  assert.match(artifact.failures.quality.map((row) => row.kind).join(","), /composition_focus_coverage/);
  assert.match(artifact.failures.quality.map((row) => row.kind).join(","), /composition_layer_coverage/);
});
