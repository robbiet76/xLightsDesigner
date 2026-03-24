import test from "node:test";
import assert from "node:assert/strict";

import { buildPracticalSequenceValidation } from "../../../agent/sequence-agent/practical-sequence-validation.js";

test("practical sequence validation summarizes readback and design alignment", () => {
  const artifact = buildPracticalSequenceValidation({
    planHandoff: {
      planId: "plan-1",
      commands: [
        {
          cmd: "effects.create",
          params: { modelName: "TreeRound", effectName: "Spirals", startMs: 0, endMs: 20000 }
        },
        {
          cmd: "effects.create",
          params: { modelName: "TreeRound", effectName: "Wave", startMs: 20000, endMs: 40000 }
        },
        {
          cmd: "effects.create",
          params: { modelName: "TreeRound", effectName: "Bars", startMs: 40000, endMs: 60000 }
        },
        {
          cmd: "effects.create",
          params: { modelName: "TreeRound", effectName: "Color Wash", startMs: 60000, endMs: 80000 }
        },
        {
          cmd: "effects.create",
          params: { modelName: "TreeRound", effectName: "Twinkle", startMs: 80000, endMs: 100000 }
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
        preferredEffectHints: ["Spirals"],
        observedTargets: ["TreeRound"],
        observedEffectNames: ["Spirals"],
        roleCoverage: [{ role: "lead", ok: true, coveredTargetIds: ["TreeRound"] }]
      },
      designChecks: [
        { kind: "design-focus", target: "primary-focus", ok: true, detail: "covered TreeRound" },
        { kind: "design-visual-family", target: "spiral_flow", ok: true, detail: "matched Spirals" }
      ]
    }
  });

  assert.equal(artifact.artifactType, "practical_sequence_validation_v1");
  assert.equal(artifact.overallOk, true);
  assert.equal(artifact.trainingKnowledge.artifactType, "sequencer_stage1_training_bundle");
  assert.equal(artifact.summary.readbackChecks.passed, 1);
  assert.equal(artifact.summary.designChecks.passed, 2);
  assert.equal(artifact.summary.metadataCoverage.missingMetadata, 0);
  assert.equal(artifact.summary.metadataCoverage.definedVisualHints, 1);
  assert.deepEqual(artifact.failures.metadata, []);
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
