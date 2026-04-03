import test from "node:test";
import assert from "node:assert/strict";

import {
  timingMarksSignature,
  classifyTimingTrackProvenance,
  buildTimingTrackStatusRows,
  summarizeTimingTrackStatuses
} from "../../runtime/timing-track-status.js";
import { buildTimingTrackProvenanceRecord } from "../../runtime/timing-track-provenance.js";

test("timingMarksSignature normalizes marks deterministically", () => {
  const signature = timingMarksSignature([
    { startMs: 1000, endMs: 2000, label: "Verse" },
    { startMs: 0, endMs: 1000, label: "Intro" }
  ]);
  assert.equal(signature, "0:1000:Intro|1000:2000:Verse");
});

test("classifyTimingTrackProvenance marks unchanged tracks", () => {
  const record = buildTimingTrackProvenanceRecord({
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

  const status = classifyTimingTrackProvenance(record, {
    expectedGeneratedSignature: timingMarksSignature(record.source.marks)
  });

  assert.equal(status.status, "unchanged");
  assert.equal(status.unchanged, true);
});

test("classifyTimingTrackProvenance marks edited tracks", () => {
  const record = buildTimingTrackProvenanceRecord({
    trackType: "structure",
    trackName: "XD: Song Structure",
    sourceMarks: [
      { startMs: 0, endMs: 1000, label: "Intro" },
      { startMs: 1000, endMs: 2000, label: "Verse" }
    ],
    userFinalMarks: [
      { startMs: 0, endMs: 1200, label: "Intro" },
      { startMs: 1200, endMs: 2000, label: "Verse" }
    ],
    coverageMode: "complete",
    durationMs: 2000
  });

  const status = classifyTimingTrackProvenance(record, {
    expectedGeneratedSignature: timingMarksSignature(record.source.marks)
  });

  assert.equal(status.status, "user_edited");
  assert.equal(status.userEdited, true);
});

test("classifyTimingTrackProvenance marks stale tracks when source no longer matches generated signature", () => {
  const record = buildTimingTrackProvenanceRecord({
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

  const status = classifyTimingTrackProvenance(record, {
    expectedGeneratedSignature: "0:1000:Intro|1000:2000:Chorus"
  });

  assert.equal(status.status, "stale");
  assert.equal(status.stale, true);
});

test("buildTimingTrackStatusRows maps provenance records with policy metadata", () => {
  const record = buildTimingTrackProvenanceRecord({
    trackType: "phrase",
    trackName: "XD: Phrase Cues",
    sourceMarks: [
      { startMs: 0, endMs: 500, label: "" },
      { startMs: 500, endMs: 1000, label: "Phrase 1" }
    ],
    userFinalMarks: [
      { startMs: 0, endMs: 500, label: "" },
      { startMs: 500, endMs: 1000, label: "Phrase 1" }
    ],
    coverageMode: "complete",
    durationMs: 1000
  });
  const rows = buildTimingTrackStatusRows({
    timingTrackProvenance: {
      "__xd_global__::xd: phrase cues": record
    },
    timingGeneratedSignatures: {
      "__xd_global__::xd: phrase cues": timingMarksSignature(record.source.marks)
    },
    timingTrackPolicies: {
      "__xd_global__::xd: phrase cues": {
        trackName: "XD: Phrase Cues",
        sourceTrack: "XD: Phrase Cues",
        manual: false
      }
    }
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].trackName, "XD: Phrase Cues");
  assert.equal(rows[0].status, "unchanged");
});

test("summarizeTimingTrackStatuses reports stale and edited counts", () => {
  const summary = summarizeTimingTrackStatuses([
    { trackName: "XD: Song Structure", status: "unchanged", manual: false },
    { trackName: "XD: Phrase Cues", status: "user_edited", manual: false },
    { trackName: "XD: Beat Grid", status: "stale", manual: true }
  ]);

  assert.equal(summary.trackCount, 3);
  assert.equal(summary.unchangedCount, 1);
  assert.equal(summary.userEditedCount, 1);
  assert.equal(summary.staleCount, 1);
  assert.equal(summary.manualCount, 1);
  assert.equal(summary.needsReview, true);
  assert.equal(summary.status, "stale");
});
