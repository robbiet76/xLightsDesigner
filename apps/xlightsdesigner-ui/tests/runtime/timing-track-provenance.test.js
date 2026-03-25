import test from "node:test";
import assert from "node:assert/strict";

import {
  diffTimingTrackMarks,
  buildTimingTrackProvenanceRecord
} from "../../runtime/timing-track-provenance.js";

test("diffTimingTrackMarks classifies unchanged moved relabeled added and removed marks", () => {
  const result = diffTimingTrackMarks(
    [
      { startMs: 0, endMs: 1000, label: "Intro" },
      { startMs: 1000, endMs: 2000, label: "Verse" },
      { startMs: 2000, endMs: 3000, label: "Chorus" },
      { startMs: 3000, endMs: 4000, label: "Bridge" }
    ],
    [
      { startMs: 0, endMs: 1000, label: "Intro" },
      { startMs: 1100, endMs: 2100, label: "Verse" },
      { startMs: 2000, endMs: 3000, label: "Hook" },
      { startMs: 4500, endMs: 5000, label: "Outro" }
    ]
  );

  assert.deepEqual(result.summary, {
    unchanged: 1,
    moved: 1,
    relabeled: 1,
    addedByUser: 1,
    removedFromSource: 1
  });
  assert.deepEqual(
    result.entries.map((row) => row.status),
    ["unchanged", "moved", "relabeled", "removed_from_source", "added_by_user"]
  );
});

test("buildTimingTrackProvenanceRecord preserves normalized source and user marks", () => {
  const record = buildTimingTrackProvenanceRecord({
    trackType: "lyrics",
    trackName: "XD: Lyrics",
    sourceMarks: [{ startMs: 0, endMs: 1000, label: "Line 1" }],
    userFinalMarks: [{ startMs: 10, endMs: 1010, label: "Line 1" }],
    sourceProvenance: {
      providers: ["lrclib", "lyricsgenius"],
      generator: "phrase_alignment_v1"
    },
    capturedAt: "2026-03-25T18:10:00Z"
  });

  assert.equal(record.trackType, "lyrics");
  assert.equal(record.trackName, "XD: Lyrics");
  assert.deepEqual(record.source.provenance.providers, ["lrclib", "lyricsgenius"]);
  assert.equal(record.source.provenance.generator, "phrase_alignment_v1");
  assert.equal(record.userFinal.capturedAt, "2026-03-25T18:10:00Z");
  assert.deepEqual(record.diff.summary, {
    unchanged: 0,
    moved: 1,
    relabeled: 0,
    addedByUser: 0,
    removedFromSource: 0
  });
});
