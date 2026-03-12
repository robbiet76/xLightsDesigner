import test from "node:test";
import assert from "node:assert/strict";

import { runAudioAnalysisContextPass } from "../../agent/audio-analysis-context-runtime.js";

test("audio analysis context pass derives song context from research first", async () => {
  const out = await runAudioAnalysisContextPass({
    audioPath: "/tmp/Song.mp3",
    sections: ["Verse 1"],
    detectedTrackIdentity: { title: "Song", artist: "Artist" },
    runSongContextResearch: async () => ({ summary: "holiday travel song", confidence: "high" }),
    runSongContextWebFallback: async () => "fallback",
    buildWebValidationFromServiceEvidence: () => null
  });

  assert.equal(out.songContextSummary, "holiday travel song");
  assert.equal(out.effectiveSongContext, "holiday travel song");
  assert.equal(out.webContextDerived, true);
  assert.ok(out.diagnostics.some((row) => row.includes("Track research confidence: high")));
});

test("audio analysis context pass applies meter-aware tempo correction", async () => {
  const out = await runAudioAnalysisContextPass({
    detectedTimeSignature: "4/4",
    detectedTempoBpm: 64,
    serviceWebTempoEvidence: {},
    detectedTrackIdentity: { title: "Song", artist: "Artist" },
    runSongContextResearch: async () => ({ summary: "", confidence: "" }),
    runSongContextWebFallback: async () => "",
    buildWebValidationFromServiceEvidence: () => ({
      ignored: false,
      timeSignature: "4/4",
      tempoBpm: 128,
      confidence: "high",
      sources: ["https://songbpm.example/song"],
      sourceBpmValues: [128],
      sourceBarsValues: [],
      chosenBeatBpm: 128,
      alternates: []
    }),
    areMetersCompatible: () => true,
    beatsPerBarFromSignature: () => 4,
    extractNumericCandidates: (values) => values,
    medianNumber: (values) => values[0]
  });

  assert.equal(out.detectedTempoBpm, 128);
  assert.ok(out.diagnostics.some((row) => row.includes("Tempo correction suggested by factor 2.00")));
});
