import test from "node:test";
import assert from "node:assert/strict";

import {
  diffTimingTrackMarks,
  buildTimingTrackProvenanceRecord,
  normalizeTimingTrackCoverage,
  splitMarksAtBoundaries,
  refreshTimingTrackProvenanceRecord
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

test("normalizeTimingTrackCoverage sorts marks fills gaps and resolves overlaps", () => {
  const out = normalizeTimingTrackCoverage(
    [
      { startMs: 2000, endMs: 3000, label: "Chorus" },
      { startMs: 0, endMs: 1000, label: "Intro" },
      { startMs: 900, endMs: 1800, label: "Verse" }
    ],
    { durationMs: 4000, fillerLabel: "" }
  );

  assert.deepEqual(out, [
    { startMs: 0, endMs: 1000, label: "Intro" },
    { startMs: 1000, endMs: 1800, label: "Verse" },
    { startMs: 1800, endMs: 2000, label: "" },
    { startMs: 2000, endMs: 3000, label: "Chorus" },
    { startMs: 3000, endMs: 4000, label: "" }
  ]);
});

test("splitMarksAtBoundaries splits phrase ranges at structure boundaries", () => {
  const out = splitMarksAtBoundaries(
    [
      { startMs: 0, endMs: 2500, label: "Phrase A" },
      { startMs: 2500, endMs: 5000, label: "Phrase B" }
    ],
    [1000, 3000],
    { fillerLabel: "" }
  );

  assert.deepEqual(out, [
    { startMs: 0, endMs: 1000, label: "Phrase A" },
    { startMs: 1000, endMs: 2500, label: "Phrase A" },
    { startMs: 2500, endMs: 3000, label: "Phrase B" },
    { startMs: 3000, endMs: 5000, label: "Phrase B" }
  ]);
});

test("buildTimingTrackProvenanceRecord normalizes complete coverage tracks", () => {
  const record = buildTimingTrackProvenanceRecord({
    trackType: "structure",
    trackName: "XD: Song Structure",
    sourceMarks: [{ startMs: 1000, endMs: 2000, label: "Verse" }],
    userFinalMarks: [{ startMs: 0, endMs: 1500, label: "Intro" }, { startMs: 1500, endMs: 2000, label: "Verse" }],
    durationMs: 2000,
    fillerLabel: "",
    coverageMode: "complete",
    capturedAt: "2026-04-02T22:00:00Z"
  });

  assert.equal(record.coverageMode, "complete");
  assert.deepEqual(record.source.marks, [
    { startMs: 0, endMs: 1000, label: "" },
    { startMs: 1000, endMs: 2000, label: "Verse" }
  ]);
  assert.deepEqual(record.userFinal.marks, [
    { startMs: 0, endMs: 1500, label: "Intro" },
    { startMs: 1500, endMs: 2000, label: "Verse" }
  ]);
});

test("refreshTimingTrackProvenanceRecord preserves source and refreshes userFinal diff", () => {
  const existing = buildTimingTrackProvenanceRecord({
    trackType: "structure",
    trackName: "XD: Song Structure",
    sourceMarks: [
      { startMs: 0, endMs: 1000, label: "Intro" },
      { startMs: 1000, endMs: 2000, label: "Verse" }
    ],
    userFinalMarks: [
      { startMs: 0, endMs: 1000, label: "Intro" },
      { startMs: 1000, endMs: 2000, label: "Verse" }
    ],
    coverageMode: "complete",
    durationMs: 2000
  });

  const refreshed = refreshTimingTrackProvenanceRecord(existing, {
    userFinalMarks: [
      { startMs: 0, endMs: 1200, label: "Intro" },
      { startMs: 1200, endMs: 2000, label: "Verse" }
    ],
    capturedAt: "2026-04-02T23:00:00Z",
    durationMs: 2000
  });

  assert.deepEqual(refreshed.source.marks, existing.source.marks);
  assert.equal(refreshed.userFinal.capturedAt, "2026-04-02T23:00:00Z");
  assert.deepEqual(refreshed.diff.summary, {
    unchanged: 0,
    moved: 2,
    relabeled: 0,
    addedByUser: 0,
    removedFromSource: 0
  });
});
