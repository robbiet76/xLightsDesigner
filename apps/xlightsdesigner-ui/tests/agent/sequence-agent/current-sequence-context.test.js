import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCurrentSequenceContext,
  sanitizeCurrentSequenceContextForPlan
} from "../../../agent/sequence-agent/current-sequence-context.js";

test("current sequence context compacts timing tracks and effects", () => {
  const context = buildCurrentSequenceContext({
    sequencePath: "/Users/robterry/Desktop/Show/test.xsq",
    sequenceRevision: "rev-42",
    selectedSections: ["Chorus 1"],
    selectedTargets: ["MegaTree"],
    selectedTags: ["focal"],
    timingTracks: [
      {
        name: "Beats",
        type: "beat",
        marks: [
          { label: "Beat 1", startMs: 1000, endMs: 1100 },
          { label: "Beat 2", startMs: 2000, endMs: 2100 }
        ]
      },
      {
        trackName: "Lyrics",
        timingMarks: [
          { label: "shine", startMs: 3000, endMs: 3600 }
        ]
      }
    ],
    effects: [
      {
        targetId: "MegaTree",
        effectName: "Shimmer",
        layerIndex: 0,
        startMs: 1000,
        endMs: 2000,
        timingTrackName: "Beats"
      },
      {
        modelName: "Roofline",
        name: "Bars",
        layerIndex: 1,
        startMs: 3000,
        endMs: 3600,
        anchor: { trackName: "Lyrics" }
      }
    ]
  });

  assert.equal(context.artifactType, "current_sequence_context_v1");
  assert.equal(context.sequence.revision, "rev-42");
  assert.equal(context.summary.timingTrackCount, 2);
  assert.equal(context.summary.timingMarkCount, 3);
  assert.equal(context.summary.effectCount, 2);
  assert.equal(context.summary.targetCount, 2);
  assert.deepEqual(context.timing.trackNames, ["Beats", "Lyrics"]);
  assert.deepEqual(context.effects.effectNames, ["Shimmer", "Bars"]);
  assert.equal(context.effects.sample[1].targetId, "Roofline");
  assert.equal(context.effects.sample[1].timingTrackName, "Lyrics");
  assert.ok(context.artifactId.startsWith("current_sequence_context_v1-"));
});

test("current sequence context sanitizer keeps only plan-safe summary fields", () => {
  const context = buildCurrentSequenceContext({
    sequencePath: "/tmp/test.xsq",
    sequenceRevision: "rev-7",
    timingTracks: [{ name: "Song Structure", marks: [{ label: "Intro", startMs: 0, endMs: 10000 }] }],
    effects: [{ targetId: "MegaTree", effectName: "On", startMs: 0, endMs: 10000 }]
  });

  const safe = sanitizeCurrentSequenceContextForPlan({
    ...context,
    effects: {
      ...context.effects,
      sample: [{ targetId: "MegaTree", effectName: "On", settings: { largePayload: true } }]
    }
  });

  assert.equal(safe.artifactType, "current_sequence_context_v1");
  assert.equal(safe.artifactId, context.artifactId);
  assert.equal(safe.summary.effectCount, 1);
  assert.deepEqual(safe.timing.trackNames, ["Song Structure"]);
  assert.deepEqual(safe.effects.effectNames, ["On"]);
  assert.deepEqual(safe.effects.targetIds, ["MegaTree"]);
  assert.equal("sample" in safe.effects, false);
});
