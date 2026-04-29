import test from "node:test";
import assert from "node:assert/strict";

import { buildRenderCritiqueContext } from "../../../agent/sequence-agent/render-critique-context.js";

test("buildRenderCritiqueContext merges render observation with design and handoff context", () => {
  const out = buildRenderCritiqueContext({
    renderObservation: {
      artifactId: "obs-1",
      source: {
        startMs: 1000,
        endMs: 4000,
        samplingMode: "targeted",
        sampledModelCount: 2,
        windowCount: 2
      },
      macro: {
        activeModelNames: ["MegaTree", "Roofline"],
        activeFamilyTotals: { Tree: 3, Line: 2 },
        leadModel: "MegaTree",
        leadModelShare: 0.76,
        meanSceneSpreadRatio: 0.024,
        activeCoverageRatio: 0.18,
        coverageGapCount: 2,
        coverageGapRegions: ["topRight", "bottomRight"],
        coverageRead: "partial",
        leftRightBalanceRatio: 0.42,
        topBottomBalanceRatio: 0.08,
        maxActiveModelRatio: 0.12,
        temporalRead: "modulated",
        energyVariation: 0.11,
        activeModelVariation: 1,
        distinctLeadModelCount: 1
      }
    },
    designSceneContext: {
      artifactId: "scene-1",
      focalCandidates: ["MegaTree", "ArchSingle"],
      coverageDomains: {
        broad: ["AllModels"],
        detail: ["MegaTree/Star"]
      }
    },
    sequencingDesignHandoff: {
      artifactId: "handoff-1",
      designSummary: "MegaTree leads while roofline supports the chorus lift.",
      scope: {
        sections: ["Chorus"]
      },
      focusPlan: {
        primaryTargets: ["MegaTree"],
        secondaryTargets: ["Roofline"]
      },
      sectionDirectives: [
        {
          preferredVisualFamilies: ["spiral_flow", "soft_texture"]
        }
      ]
    },
    musicDesignContext: {
      artifactId: "music-1",
      sectionArc: [
        { label: "Chorus", energy: "high", density: "dense" }
      ]
    }
  });

  assert.equal(out.artifactType, "sequence_render_critique_context_v1");
  assert.deepEqual(out.expected.primaryFocusTargetIds, ["MegaTree"]);
  assert.deepEqual(out.expected.supportTargetIds, ["Roofline"]);
  assert.deepEqual(out.expected.preferredVisualFamilies, ["spiral_flow", "soft_texture"]);
  assert.deepEqual(out.observed.activeModelNames, ["MegaTree", "Roofline"]);
  assert.equal(out.observed.leadModel, "MegaTree");
  assert.equal(out.observed.sampledStartMs, 1000);
  assert.equal(out.observed.sampledEndMs, 4000);
  assert.equal(out.observed.samplingMode, "targeted");
  assert.equal(out.observed.sampledModelCount, 2);
  assert.equal(out.observed.windowCount, 2);
  assert.equal(out.observed.activeCoverageRatio, 0.18);
  assert.equal(out.observed.coverageRead, "partial");
  assert.equal(out.observed.leftRightBalanceRead, "imbalanced");
  assert.equal(out.observed.topBottomBalanceRead, "balanced");
  assert.equal(out.source.musicDesignContextArtifactId, "music-1");
  assert.equal(out.expected.musicEnergyRead, "high");
  assert.equal(out.expected.musicDensityRead, "dense");
  assert.equal(out.comparison.leadMatchesPrimaryFocus, true);
  assert.equal(out.comparison.leadIsKnownFocalCandidate, true);
  assert.deepEqual(out.comparison.observedFocusTargets, ["MegaTree"]);
  assert.equal(out.observed.breadthRead, "moderate");
  assert.equal(out.observed.temporalRead, "modulated");
  assert.equal(out.comparison.renderCoverageTooSparse, true);
  assert.equal(out.comparison.renderHasDisplayGaps, true);
  assert.equal(out.comparison.renderHasProblematicGaps, true);
  assert.equal(out.comparison.renderIsLeftRightImbalanced, true);
  assert.deepEqual(out.comparison.adjacentWindowComparisons, []);
  assert.equal(typeof out.quality.overallScore, "number");
  assert.equal(typeof out.quality.legacyIssuePenaltyScore, "number");
  assert.equal(typeof out.quality.dimensions.coverageScore, "number");
  assert.equal(typeof out.quality.dimensions.designIntentScore, "number");
  assert.equal(out.quality.dimensions.effectConfigurationScore, null);
  assert.equal(out.quality.dimensionBands.effectConfigurationScore, "unmeasured");
});

test("buildRenderCritiqueContext uses music section energy to infer broad coverage expectation", () => {
  const out = buildRenderCritiqueContext({
    renderObservation: {
      source: {
        windowCount: 1
      },
      windows: [
        { label: "Chorus" }
      ],
      macro: {
        activeModelNames: ["MegaTree"],
        activeFamilyTotals: { Tree: 1 },
        leadModel: "MegaTree",
        leadModelShare: 1,
        meanSceneSpreadRatio: 0.018,
        activeCoverageRatio: 0.12
      }
    },
    designSceneContext: {
      focalCandidates: ["MegaTree"],
      coverageDomains: { broad: [], detail: [] }
    },
    sequencingDesignHandoff: {
      designSummary: "Build to the chorus."
    },
    musicDesignContext: {
      artifactId: "music-chorus",
      sectionArc: [
        { label: "Verse", energy: "medium", density: "moderate" },
        { label: "Chorus", energy: "high", density: "dense" }
      ]
    }
  });

  assert.equal(out.expected.musicSections.length, 1);
  assert.equal(out.expected.musicSections[0].label, "Chorus");
  assert.equal(out.comparison.musicalLiftExpected, true);
  assert.equal(out.comparison.broadCoverageExpected, true);
  assert.equal(out.comparison.renderCoverageTooSparse, true);
});

test("buildRenderCritiqueContext scores effect configuration and palette from readback payload evidence", () => {
  const out = buildRenderCritiqueContext({
    renderObservation: {
      macro: {
        activeModelNames: ["MegaTree", "Roofline"],
        activeFamilyTotals: { Tree: 1, Line: 1 },
        leadModel: "MegaTree",
        leadModelShare: 0.55,
        meanSceneSpreadRatio: 0.02,
        activeCoverageRatio: 0.2,
        coverageGapCount: 1,
        energyVariation: 0.4,
        activeModelVariation: 2,
        distinctLeadModelCount: 2
      }
    },
    designSceneContext: {
      focalCandidates: ["MegaTree"]
    },
    sequencingDesignHandoff: {
      focusPlan: {
        primaryTargets: ["MegaTree"]
      }
    },
    practicalValidation: {
      summary: {
        effectPayloadChecks: {
          settingsChecked: 4,
          settingsMatched: 3,
          settingsMatchRatio: 0.75,
          paletteChecked: 4,
          paletteMatched: 2,
          paletteMatchRatio: 0.5
        }
      }
    }
  });

  assert.equal(out.expected.effectPayloadChecks.settingsMatchRatio, 0.75);
  assert.equal(out.quality.dimensions.effectConfigurationScore, 0.75);
  assert.equal(out.quality.dimensions.paletteScore, 0.5);
  assert.equal(out.quality.dimensionBands.effectConfigurationScore, "acceptable");
  assert.equal(out.quality.dimensionBands.paletteScore, "weak");
  assert.equal(out.quality.basis.settingsChecked, 4);
  assert.equal(out.quality.basis.paletteMatched, 2);
});

test("buildRenderCritiqueContext compares render evidence to composition plan", () => {
  const out = buildRenderCritiqueContext({
    renderObservation: {
      source: {
        windowCount: 2
      },
      windows: [
        {
          label: "Intro",
          leadModel: "Roofline",
          activeModelNames: ["Roofline"],
          meanSceneSpreadRatio: 0.01,
          temporalRead: "flat",
          startMs: 0,
          endMs: 1000
        },
        {
          label: "Chorus",
          leadModel: "Roofline",
          activeModelNames: ["Roofline"],
          meanSceneSpreadRatio: 0.01,
          temporalRead: "flat",
          startMs: 1000,
          endMs: 2000
        }
      ],
      macro: {
        activeModelNames: ["Roofline"],
        activeFamilyTotals: { Line: 1 },
        leadModel: "Roofline",
        leadModelShare: 1,
        meanSceneSpreadRatio: 0.01,
        activeCoverageRatio: 0.05,
        coverageGapCount: 4,
        leftRightBalanceRatio: 0.1,
        topBottomBalanceRatio: 0.1,
        energyVariation: 0.01,
        activeModelVariation: 0,
        distinctLeadModelCount: 1
      }
    },
    sequencingDesignHandoff: {
      artifactId: "handoff-2",
      focusPlan: {
        primaryTargets: ["MegaTree"]
      }
    },
    compositionPlan: {
      artifactType: "composition_plan_v1",
      sections: [
        {
          section: "Intro",
          progressionIntent: "establish_theme",
          focalRegion: ["MegaTree"],
          supportRegion: ["Roofline"],
          accentRegion: ["Snowflakes"],
          expectedBalance: { spatialBreadth: "broad" }
        },
        {
          section: "Chorus",
          progressionIntent: "lift_or_contrast",
          focalRegion: ["MegaTree"],
          supportRegion: ["Roofline"],
          accentRegion: ["Snowflakes"],
          expectedBalance: { spatialBreadth: "broad" }
        },
        {
          section: "Ending",
          progressionIntent: "resolve",
          focalRegion: ["MegaTree"],
          supportRegion: ["Roofline"],
          accentRegion: ["Snowflakes"],
          expectedBalance: { spatialBreadth: "moderate" }
        }
      ],
      targetRoles: {
        activeTargets: ["MegaTree", "Roofline", "Snowflakes"],
        layeredTargets: ["MegaTree"]
      }
    }
  });

  assert.equal(out.expected.composition.artifactType, "composition_plan_v1");
  assert.equal(out.comparison.composition.available, true);
  assert.deepEqual(out.comparison.composition.missingCompositionFocusTargets, ["MegaTree"]);
  assert.deepEqual(out.comparison.composition.observedCompositionSupportTargets, ["Roofline"]);
  assert.deepEqual(out.comparison.composition.missingCompositionLayerStackTargets, ["MegaTree"]);
  assert.deepEqual(out.comparison.composition.underusedCompositionRegions, ["focal", "accent", "layer_stack"]);
  assert.deepEqual(out.comparison.composition.sectionTransitionsTooSimilar, [{ fromLabel: "Intro", toLabel: "Chorus", overlapRatio: 1 }]);
  assert.equal(out.comparison.composition.nextPassChangeBias.includes("add_or_strengthen_missing_focal_targets"), true);
  assert.equal(out.comparison.composition.nextPassChangeBias.includes("differentiate_adjacent_section_transitions"), true);
  assert.equal(out.comparison.composition.renderSpatialBalanceMismatch, true);
  assert.equal(out.comparison.composition.renderProgressionTooFlat, true);
  assert.equal(out.quality.issues.includes("composition_focus_not_observed"), true);
  assert.equal(out.quality.issues.includes("composition_regions_underused"), true);
  assert.equal(out.quality.issues.includes("composition_spatial_breadth_not_observed"), true);
  assert.equal(out.quality.issues.includes("composition_progression_too_flat"), true);
  assert.ok(out.quality.dimensions.coverageScore < 0.2);
  assert.ok(out.quality.dimensions.compositionScore < 0.6);
  assert.ok(out.quality.dimensions.motionProgressionScore < 0.5);
});

test("buildRenderCritiqueContext matches planned tags to observed concrete models", () => {
  const out = buildRenderCritiqueContext({
    renderObservation: {
      macro: {
        activeModelNames: ["Snowflake_Large-04", "CandyCane-01"],
        activeFamilyTotals: { Custom: 2 },
        leadModel: "Snowflake_Large-04",
        leadModelShare: 0.5,
        meanSceneSpreadRatio: 0.03,
        activeCoverageRatio: 0.2,
        temporalRead: "evolving",
        energyVariation: 0.4,
        activeModelVariation: 2
      }
    },
    metadataAssignments: [
      { targetId: "Snowflake_Large-04", tags: ["Snowflakes", "Snowflakes_Large"] },
      { targetId: "CandyCane-01", tags: ["CandyCanes"] }
    ],
    compositionPlan: {
      artifactType: "composition_plan_v1",
      sections: [
        {
          section: "Intro",
          focalRegion: ["Snowflakes"],
          accentRegion: ["CandyCanes"],
          expectedBalance: { spatialBreadth: "moderate" }
        }
      ],
      targetRoles: {
        activeTargets: ["Snowflakes", "CandyCanes"],
        layeredTargets: []
      }
    }
  });

  assert.deepEqual(out.comparison.composition.observedCompositionFocusTargets, ["Snowflakes"]);
  assert.deepEqual(out.comparison.composition.observedCompositionAccentTargets, ["CandyCanes"]);
  assert.deepEqual(out.comparison.composition.missingCompositionFocusTargets, []);
  assert.deepEqual(out.comparison.composition.missingCompositionAccentTargets, []);
  assert.equal(out.quality.issues.includes("composition_focus_not_observed"), false);
});

test("buildRenderCritiqueContext matches design focus groups to observed member models", () => {
  const out = buildRenderCritiqueContext({
    renderObservation: {
      macro: {
        activeModelNames: ["Flood_House-01", "Snowflake_Large-01", "CandyCane-01"],
        activeFamilyTotals: { Flood: 1, Snowflake: 1, Cane: 1 },
        leadModel: "Flood_House-01",
        leadModelShare: 0.46,
        meanSceneSpreadRatio: 0.035,
        activeCoverageRatio: 0.24,
        temporalRead: "evolving",
        energyVariation: 0.35,
        activeModelVariation: 3
      }
    },
    designSceneContext: {
      focalCandidates: ["Floods", "Snowflakes"]
    },
    sequencingDesignHandoff: {
      focusPlan: {
        primaryTargets: ["Floods", "Snowflakes"],
        secondaryTargets: ["CandyCanes"]
      }
    },
    metadataAssignments: [
      { targetId: "Flood_House-01", tags: ["Floods", "Floods House"] },
      { targetId: "Snowflake_Large-01", tags: ["Snowflakes", "Snowflakes_Large"] },
      { targetId: "CandyCane-01", tags: ["CandyCanes"] }
    ]
  });

  assert.deepEqual(out.comparison.observedFocusTargets, ["Floods", "Snowflakes"]);
  assert.deepEqual(out.comparison.missingPrimaryFocusTargets, []);
  assert.equal(out.comparison.leadMatchesPrimaryFocus, true);
  assert.equal(out.comparison.leadIsKnownFocalCandidate, true);
  assert.equal(out.quality.issues.includes("design_focus_not_observed"), false);
  assert.equal(out.quality.issues.includes("lead_model_not_expected_focal_candidate"), false);
});

test("buildRenderCritiqueContext credits common xLights group aliases from observed members", () => {
  const out = buildRenderCritiqueContext({
    renderObservation: {
      macro: {
        activeModelNames: ["GarlandGreens", "UpperGutter-01", "Icicles-01", "Flood_House-01", "Spinner-01", "Snowflake_Large-04"],
        activeFamilyTotals: { Line: 4, Custom: 1 },
        leadModel: "UpperGutter-01",
        leadModelShare: 0.42,
        meanSceneSpreadRatio: 0.04,
        activeCoverageRatio: 0.25,
        temporalRead: "evolving",
        energyVariation: 0.4,
        activeModelVariation: 5
      }
    },
    compositionPlan: {
      artifactType: "composition_plan_v1",
      sections: [
        {
          section: "Chorus",
          focalRegion: ["Gutters", "Garland", "Snowflakes_Even"],
          backgroundRegion: ["AllModels_NoFloods"],
          layerStackTargets: ["FrontHouse", "FrontProps", "Eaves", "Outlines"],
          expectedBalance: { spatialBreadth: "broad" }
        }
      ],
      targetRoles: {
        activeTargets: ["AllModels_NoFloods", "Gutters", "Garland"],
        layeredTargets: ["FrontHouse", "FrontProps", "Eaves", "Outlines"]
      }
    }
  });

  assert.deepEqual(out.comparison.composition.missingCompositionFocusTargets, []);
  assert.deepEqual(out.comparison.composition.missingCompositionLayerStackTargets, []);
  assert.equal(out.quality.issues.includes("composition_focus_not_observed"), false);
  assert.equal(out.quality.issues.includes("composition_regions_underused"), false);
});

test("buildRenderCritiqueContext identifies weak layer stacks and dominant unplanned targets", () => {
  const out = buildRenderCritiqueContext({
    renderObservation: {
      macro: {
        activeModelNames: ["MegaTree", "GarageMatrix"],
        activeFamilyTotals: { Tree: 1, Matrix: 1 },
        leadModel: "GarageMatrix",
        leadModelShare: 0.62,
        meanSceneSpreadRatio: 0.02,
        activeCoverageRatio: 0.14,
        temporalRead: "flat",
        energyVariation: 0.02,
        activeModelVariation: 1
      }
    },
    compositionPlan: {
      artifactType: "composition_plan_v1",
      sections: [
        {
          section: "Verse",
          progressionIntent: "develop_motion",
          focalRegion: ["MegaTree"],
          supportRegion: ["Roofline"],
          accentRegion: ["MiniTrees"],
          backgroundRegion: ["Floods"],
          layerStackTargets: ["MegaTree"],
          expectedBalance: { spatialBreadth: "moderate" }
        }
      ],
      targetRoles: {
        activeTargets: ["MegaTree", "Roofline", "MiniTrees", "Floods"],
        layeredTargets: ["MegaTree"]
      }
    }
  });

  assert.deepEqual(out.comparison.composition.observedCompositionLayerStackTargets, ["MegaTree"]);
  assert.deepEqual(out.comparison.composition.weakCompositionLayerStackTargets, ["MegaTree"]);
  assert.deepEqual(out.comparison.composition.dominantUnplannedTargets, ["GarageMatrix"]);
  assert.equal(out.comparison.composition.nextPassChangeBias.includes("increase_layer_stack_observable_difference"), true);
  assert.equal(out.comparison.composition.nextPassChangeBias.includes("reduce_unplanned_dominant_targets"), true);
  assert.equal(out.quality.issues.includes("composition_layer_stack_not_observable"), true);
  assert.equal(out.quality.issues.includes("composition_unplanned_target_dominates"), true);
});

test("buildRenderCritiqueContext falls back to scene focal candidates when handoff focus is missing", () => {
  const out = buildRenderCritiqueContext({
    renderObservation: {
      macro: {
        activeModelNames: ["ArchSingle"],
        activeFamilyTotals: { Arch: 3 },
        leadModel: "ArchSingle",
        leadModelShare: 0.9,
        meanSceneSpreadRatio: 0.006
      }
    },
    designSceneContext: {
      focalCandidates: ["ArchSingle", "MegaTree"]
    },
    sequencingDesignHandoff: {
      designSummary: "Arch led focused section."
    }
  });

  assert.deepEqual(out.expected.primaryFocusTargetIds, ["ArchSingle", "MegaTree"]);
  assert.equal(out.comparison.leadMatchesPrimaryFocus, true);
  assert.equal(out.comparison.renderUsesTightFocus, true);
  assert.equal(out.observed.breadthRead, "tight");
});

test("buildRenderCritiqueContext compares adjacent sampled windows", () => {
  const out = buildRenderCritiqueContext({
    renderObservation: {
      source: {
        startMs: 0,
        endMs: 4000,
        samplingMode: "targeted",
        sampledModelCount: 2,
        windowCount: 2,
        samplingDetail: "drilldown"
      },
      macro: {
        activeModelNames: ["MegaTree", "Roofline"],
        activeFamilyTotals: { Tree: 2, Line: 2 },
        leadModel: "MegaTree",
        leadModelShare: 0.7,
        meanSceneSpreadRatio: 0.02,
        temporalRead: "evolving"
      },
      windows: [
        {
          label: "Verse",
          startMs: 0,
          endMs: 2000,
          sampleDetail: "drilldown",
          activeModelNames: ["MegaTree", "Roofline"],
          leadModel: "MegaTree",
          meanSceneSpreadRatio: 0.02,
          temporalRead: "flat"
        },
        {
          label: "Chorus",
          startMs: 2000,
          endMs: 4000,
          sampleDetail: "drilldown",
          activeModelNames: ["MegaTree", "Roofline"],
          leadModel: "MegaTree",
          meanSceneSpreadRatio: 0.02,
          temporalRead: "flat"
        }
      ]
    },
    designSceneContext: {
      focalCandidates: ["MegaTree"]
    },
    sequencingDesignHandoff: {
      designSummary: "Verse should build into the chorus.",
      focusPlan: {
        primaryTargets: ["MegaTree"]
      }
    }
  });

  assert.equal(out.comparison.adjacentWindowComparisons.length, 1);
  assert.equal(out.comparison.adjacentWindowComparisons[0].fromLabel, "Verse");
  assert.equal(out.comparison.adjacentWindowComparisons[0].toLabel, "Chorus");
  assert.equal(out.comparison.adjacentWindowComparisons[0].windowsReadSimilarly, true);
  assert.deepEqual(out.comparison.drilldownTargetIds, ["MegaTree", "Roofline"]);
  assert.deepEqual(out.comparison.drilldownTargetEvidence[0], {
    targetId: "MegaTree",
    targetKind: "model_or_group",
    reasons: ["adjacent_windows_read_similarly", "flat_drilldown_window"],
    windowLabels: ["Verse", "Chorus"]
  });
  assert.deepEqual(out.comparison.drilldownTargetEvidence[1], {
    targetId: "Roofline",
    targetKind: "model_or_group",
    reasons: ["adjacent_windows_read_similarly", "flat_drilldown_window"],
    windowLabels: ["Verse", "Chorus"]
  });
});

test("buildRenderCritiqueContext keeps gaps observational for narrow localized scope", () => {
  const out = buildRenderCritiqueContext({
    renderObservation: {
      macro: {
        activeModelNames: ["WindowRight"],
        activeFamilyTotals: { Window: 1 },
        leadModel: "WindowRight",
        leadModelShare: 1,
        meanSceneSpreadRatio: 0.004,
        activeCoverageRatio: 0.08,
        coverageGapCount: 3,
        coverageGapRegions: ["topLeft", "bottomLeft", "bottomRight"]
      }
    },
    sequencingDesignHandoff: {
      scope: {
        targetIds: ["WindowRight"],
        requestedScope: {
          mode: "target_refinement",
          reviewStartLevel: "model",
          sectionScopeKind: "full_sequence"
        }
      },
      focusPlan: {
        primaryTargets: ["WindowRight"]
      },
      designSummary: "Refine the right-side window phrase."
    }
  });

  assert.equal(out.comparison.renderHasDisplayGaps, true);
  assert.equal(out.comparison.renderHasProblematicGaps, false);
  assert.equal(out.comparison.localizedFocusExpected, true);
});
