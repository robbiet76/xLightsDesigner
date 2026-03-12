import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeIdentityCapability,
  normalizeTimingCapability,
  normalizeChordCapability,
  normalizeLyricsCapability,
  normalizeStructureCapability
} from "../../agent/audio-analysis-capability-adapters.js";

test("normalizeIdentityCapability extracts track identity and web tempo evidence", () => {
  const out = normalizeIdentityCapability({
    meta: {
      trackIdentity: { title: "Song", artist: "Artist", isrc: "ABC123" },
      webTempoEvidence: { bpmValues: [128] }
    }
  });
  assert.equal(out.title, "Song");
  assert.equal(out.artist, "Artist");
  assert.equal(out.isrc, "ABC123");
  assert.deepEqual(out.webTempoEvidence, { bpmValues: [128] });
});

test("normalizeTimingCapability returns beats bars and diagnostics", () => {
  const out = normalizeTimingCapability({ beats: [], bars: [{ startMs: 0, endMs: 1000, label: "1" }], bpm: 128, timeSignature: "4/4" });
  assert.equal(out.bpm, 128);
  assert.equal(out.timeSignature, "4/4");
  assert.ok(out.diagnostics.some((row) => row.includes("no beats")));
});

test("normalizeChordCapability returns chord diagnostics from provider meta", () => {
  const out = normalizeChordCapability({
    chords: [],
    meta: { chordAnalysis: { engine: "madmom", avgMarginConfidence: "0.83", error: "empty sequence" } }
  });
  assert.ok(out.diagnostics.some((row) => row.includes("Chord analysis engine: madmom")));
  assert.ok(out.diagnostics.some((row) => row.includes("empty sequence")));
});

test("normalizeLyricsCapability returns lyrics diagnostics from provider meta", () => {
  const out = normalizeLyricsCapability({ lyrics: [], meta: { lyricsSourceError: "not found", lyricsGlobalShiftMs: 120 } });
  assert.ok(out.diagnostics.some((row) => row.includes("Lyrics global shift suggested: 120ms.")));
  assert.ok(out.diagnostics.some((row) => row.includes("Lyrics source detail: not found")));
});

test("normalizeStructureCapability returns missing-sections diagnostic", () => {
  const out = normalizeStructureCapability({ sections: [] });
  assert.ok(out.diagnostics.some((row) => row.includes("no song sections")));
});
