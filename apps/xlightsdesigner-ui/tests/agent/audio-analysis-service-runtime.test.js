import test from "node:test";
import assert from "node:assert/strict";

import {
  createAudioAnalysisPipelineState,
  normalizeAnalysisMarksForApi,
  runAudioAnalysisServicePass
} from "../../agent/audio-analysis-service-runtime.js";

test("createAudioAnalysisPipelineState returns canonical analysis pipeline defaults", () => {
  const pipeline = createAudioAnalysisPipelineState();
  assert.equal(pipeline.analysisServiceCalled, false);
  assert.equal(pipeline.structureDerived, false);
  assert.equal(pipeline.webContextDerived, false);
});

test("normalizeAnalysisMarksForApi clamps marks to known media duration", () => {
  const marks = normalizeAnalysisMarksForApi([
    { startMs: 100, endMs: 300, label: "A" },
    { startMs: 950, endMs: 1200, label: "B" },
    { startMs: 1100, endMs: 1300, label: "C" }
  ], { mediaDurationMs: 1000 });

  assert.deepEqual(marks, [
    { startMs: 100, endMs: 300, label: "A" },
    { startMs: 950, endMs: 999, label: "B" }
  ]);
});

test("runAudioAnalysisServicePass normalizes service output into tracks and metadata", async () => {
  const out = await runAudioAnalysisServicePass({
    audioPath: "/tmp/Song.mp3",
    analysisBridge: {
      runAudioAnalysisService: async () => ({
        ok: true,
        data: {
          bpm: 128,
          timeSignature: "4/4",
          durationMs: 123000,
          beats: [{ startMs: 0, endMs: 500, label: "1" }],
          bars: [{ startMs: 0, endMs: 2000, label: "1" }],
          chords: [{ startMs: 0, endMs: 2000, label: "C" }],
          lyrics: [{ startMs: 300, endMs: 900, label: "hello" }],
          sections: [{ startMs: 0, endMs: 20000, label: "Verse 1" }],
          meta: {
            engine: "beatnet",
            trackIdentity: { title: "Song", artist: "Artist" },
            chordAnalysis: { avgMarginConfidence: "0.83" }
          }
        }
      })
    },
    baseUrl: "http://127.0.0.1:5055",
    provider: "auto",
    mediaMetadata: null,
    sequenceDurationMs: null,
    inferLyricStanzaPlan: () => ({ sections: [], lyricalIndices: [] }),
    relabelSectionsWithLlm: async () => ({ sections: [] }),
    audioTrackQueryFromPath: () => "Song",
    buildSectionSuggestions: (marks) => ({
      labels: marks.map((row) => row.label),
      startByLabel: Object.fromEntries(marks.map((row) => [row.label, row.startMs]))
    })
  });

  assert.equal(out.pipeline.analysisServiceSucceeded, true);
  assert.equal(out.detectedTempoBpm, 128);
  assert.equal(out.detectedTimeSignature, "4/4");
  assert.equal(out.detectedTrackIdentity.title, "Song");
  assert.deepEqual(out.analysisTrackNames, [
    "Analysis: Beats",
    "Analysis: Bars",
    "Analysis: Chords",
    "Analysis: Lyrics",
    "Analysis: Song Structure"
  ]);
  assert.equal(out.sectionSuggestions[0], "Verse 1");
  assert.equal(out.trackMarksByName["Analysis: Beats"].length, 1);
  assert.ok(out.diagnostics.some((row) => row.includes("Analysis engine selected: beatnet")));
});
