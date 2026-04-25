import test from "node:test";
import assert from "node:assert/strict";

import { buildCurrentSequenceContextFromReadback } from "../../runtime/current-sequence-context-runtime.js";

test("current sequence context runtime reads timing and scoped effects", async () => {
  const effectQueries = [];
  const context = await buildCurrentSequenceContextFromReadback({
    endpoint: "http://127.0.0.1:49915/xlightsdesigner/api",
    sequencePath: "/show/Test.xsq",
    sequenceRevision: "rev-9",
    analysisHandoff: {
      structure: {
        sections: [
          { label: "Intro", startMs: 0, endMs: 1000 },
          { label: "Chorus 1", startMs: 1000, endMs: 4000 }
        ]
      }
    },
    selectedSections: ["Chorus 1"],
    selectedTargets: ["MegaTree"],
    selectedTags: ["lead"],
    displayElements: [{ id: "Roofline" }]
  }, {
    getTimingTracks: async () => ({
      data: {
        tracks: [
          { name: "Beats", type: "beat" },
          { name: "Lyrics", type: "lyric" }
        ]
      }
    }),
    getTimingMarks: async (_endpoint, trackName) => ({
      data: {
        marks: [{ label: `${trackName} 1`, startMs: 1000, endMs: 1500 }]
      }
    }),
    listEffects: async (_endpoint, params) => {
      effectQueries.push(params);
      return {
        data: {
          effects: [
            { modelName: params.modelName, effectName: "Shimmer", layerIndex: 0, startMs: 1000, endMs: 2000 }
          ]
        }
      };
    }
  });

  assert.equal(context.artifactType, "current_sequence_context_v1");
  assert.equal(context.sequence.revision, "rev-9");
  assert.equal(context.summary.timingTrackCount, 2);
  assert.equal(context.summary.effectCount, 1);
  assert.deepEqual(context.scope.sections, ["Chorus 1"]);
  assert.deepEqual(context.effects.effectNames, ["Shimmer"]);
  assert.deepEqual(effectQueries, [
    { modelName: "MegaTree", startMs: 1000, endMs: 4000 }
  ]);
});

test("current sequence context runtime falls back to display elements when no target is selected", async () => {
  const effectQueries = [];
  const context = await buildCurrentSequenceContextFromReadback({
    endpoint: "http://127.0.0.1:49915/xlightsdesigner/api",
    displayElements: [{ id: "Star" }, { name: "Snowflakes" }]
  }, {
    getTimingTracks: async () => ({ data: { tracks: [] } }),
    getTimingMarks: async () => ({ data: { marks: [] } }),
    listEffects: async (_endpoint, params) => {
      effectQueries.push(params);
      return { data: { effects: [] } };
    }
  });

  assert.deepEqual(context.scope.targetIds, ["Star", "Snowflakes"]);
  assert.deepEqual(effectQueries, [
    { modelName: "Star" },
    { modelName: "Snowflakes" }
  ]);
});
