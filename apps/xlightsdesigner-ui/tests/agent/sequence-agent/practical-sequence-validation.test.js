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
