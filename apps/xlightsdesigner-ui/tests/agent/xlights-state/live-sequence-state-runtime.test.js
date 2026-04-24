import test from "node:test";
import assert from "node:assert/strict";

import { readCurrentXLightsSequenceState } from "../../../agent/xlights-state/live-sequence-state-runtime.js";

test("runtime wrapper delegates to live-sequence collector", async () => {
  const state = await readCurrentXLightsSequenceState("http://127.0.0.1:49915/xlightsdesigner/api", { includeTimingMarks: true }, {
    getOpenSequence: async () => ({ data: { isOpen: true, sequence: { file: "/show/Test.xsq" } } }),
    getRevision: async () => ({ data: { revision: "rev-12" } }),
    getSequenceSettings: async () => ({ data: { mediaFile: "/media/test.mp3" } }),
    getMediaStatus: async () => ({ data: { mediaFile: "/media/test.mp3" } }),
    getModels: async () => ({ data: { models: [{ id: "Snowman" }] } }),
    getSubmodels: async () => ({ data: { submodels: [] } }),
    getDisplayElements: async () => ({ data: { elements: [{ id: "Snowman", type: "model" }] } }),
    getTimingTracks: async () => ({ data: { tracks: [{ name: "XD: Song Structure", markCount: 1 }] } }),
    getTimingMarks: async () => ({ data: { marks: [{ startMs: 0, endMs: 1000, label: "Intro" }] } })
  });

  assert.equal(state.sequence.name, "Test.xsq");
  assert.equal(state.timing.tracks[0].marks[0].label, "Intro");
});
