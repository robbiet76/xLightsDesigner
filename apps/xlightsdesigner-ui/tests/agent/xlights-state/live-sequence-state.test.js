import test from "node:test";
import assert from "node:assert/strict";

import {
  buildXLightsTimingState,
  buildXLightsSequenceState,
  readXLightsSequenceState
} from "../../../agent/xlights-state/live-sequence-state.js";

test("xlights timing state summarizes tracks and xd tracks", () => {
  const timing = buildXLightsTimingState({
    tracks: [
      { name: "XD: Song Structure", markCount: 8 },
      { name: "Beats", markCount: 445 }
    ]
  });

  assert.equal(timing.contract, "xlights_timing_state_v1");
  assert.equal(timing.trackCount, 2);
  assert.equal(timing.xdTrackCount, 1);
  assert.deepEqual(timing.xdTrackNames, ["XD: Song Structure"]);
});

test("xlights sequence state reports open sequence summary", () => {
  const state = buildXLightsSequenceState({
    endpoint: "http://127.0.0.1:49915/xlightsdesigner/api",
    openSequence: { file: "/show/Validation-Clean-Phase1.xsq" },
    revision: "rev-42",
    sequenceSettings: { mediaFile: "/media/song.mp3", frameRate: 20, lengthMs: 180000 },
    mediaStatus: { mediaFile: "/media/song.mp3" },
    models: [{ id: "Snowman" }, { id: "SpiralTrees" }],
    submodels: [{ id: "Snowman/Hat" }],
    displayElements: [{ id: "Snowman", type: "model" }, { id: "AllModels", type: "group" }],
    timingState: buildXLightsTimingState({ tracks: [{ name: "XD: Song Structure", markCount: 8 }] })
  });

  assert.equal(state.contract, "xlights_sequence_state_v1");
  assert.equal(state.sequence.isOpen, true);
  assert.equal(state.sequence.name, "Validation-Clean-Phase1.xsq");
  assert.equal(state.sequence.revision, "rev-42");
  assert.equal(state.layout.modelCount, 2);
  assert.equal(state.timing.trackCount, 1);
  assert.equal(state.readiness.ok, true);
});

test("xlights sequence state reports blocked when no sequence is open", () => {
  const state = buildXLightsSequenceState({
    revision: "unknown",
    timingState: buildXLightsTimingState({ tracks: [] })
  });

  assert.equal(state.sequence.isOpen, false);
  assert.equal(state.readiness.ok, false);
  assert.match(state.readiness.reasons[0], /no_open_sequence/);
});

test("read xlights sequence state can expand timing marks", async () => {
  const state = await readXLightsSequenceState("http://127.0.0.1:49915/xlightsdesigner/api", {
    getOpenSequence: async () => ({ data: { isOpen: true, sequence: { file: "/show/Test.xsq" } } }),
    getRevision: async () => ({ data: { revision: "rev-9" } }),
    getSequenceSettings: async () => ({ data: { mediaFile: "/media/test.mp3", frameRate: 20, lengthMs: 120000 } }),
    getMediaStatus: async () => ({ data: { mediaFile: "/media/test.mp3" } }),
    getModels: async () => ({ data: { models: [{ id: "Snowman" }] } }),
    getSubmodels: async () => ({ data: { submodels: [{ id: "Snowman/Hat" }] } }),
    getDisplayElements: async () => ({ data: { elements: [{ id: "Snowman", type: "model" }] } }),
    getTimingTracks: async () => ({ data: { tracks: [{ name: "XD: Song Structure", markCount: 1 }] } }),
    getTimingMarks: async () => ({ data: { marks: [{ startMs: 0, endMs: 1000, label: "Intro" }] } })
  }, { includeTimingMarks: true });

  assert.equal(state.sequence.name, "Test.xsq");
  assert.equal(state.timing.tracks[0].markCount, 1);
  assert.equal(state.timing.tracks[0].marks[0].label, "Intro");
});
