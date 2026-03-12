import test from "node:test";
import assert from "node:assert/strict";

import { runAudioAnalysisOrchestration } from "../../agent/audio-analysis-orchestrator.js";

function analyzeAudioContextStub({ audioPath = "", sectionSuggestions = [], detectedTempoBpm = null }) {
  return {
    trackName: audioPath.split("/").pop() || "",
    structure: sectionSuggestions,
    timing: {
      tempoEstimate: detectedTempoBpm,
      timeSignature: "4/4"
    },
    media: {
      durationMs: 123000
    },
    summaryLines: []
  };
}

test("audio analysis orchestrator composes service and context passes into final analysis", async () => {
  const out = await runAudioAnalysisOrchestration({
    audioPath: "/tmp/Song.mp3",
    analysisService: {
      baseUrl: "http://127.0.0.1:5055",
      provider: "auto",
      apiKey: "",
      authBearer: ""
    },
    analysisBridge: {
      runAudioAnalysisService: async () => ({
        ok: true,
        data: {
          bpm: 64,
          timeSignature: "4/4",
          durationMs: 123000,
          beats: [{ startMs: 0, endMs: 500, label: "1" }],
          bars: [{ startMs: 0, endMs: 2000, label: "1" }],
          chords: [{ startMs: 0, endMs: 2000, label: "C" }],
          lyrics: [{ startMs: 300, endMs: 900, label: "hello" }],
          sections: [{ startMs: 0, endMs: 20000, label: "Verse 1" }],
          meta: {
            engine: "beatnet",
            trackIdentity: { title: "Song", artist: "Artist", isrc: "ABC123" },
            webTempoEvidence: {}
          }
        }
      })
    },
    inferLyricStanzaPlan: () => ({ sections: [], lyricalIndices: [] }),
    relabelSectionsWithLlm: async () => ({ sections: [] }),
    audioTrackQueryFromPath: () => "Song",
    buildSectionSuggestions: (marks) => ({
      labels: marks.map((row) => row.label),
      startByLabel: Object.fromEntries(marks.map((row) => [row.label, row.startMs]))
    }),
    runSongContextResearch: async () => ({ summary: "holiday travel song", confidence: "high" }),
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
    medianNumber: (values) => values[0],
    analyzeAudioContext: analyzeAudioContextStub,
    formatAudioAnalysisSummary: ({ analysis }) => `Summary for ${analysis.trackName}`,
    initialSectionSuggestions: [],
    initialSectionStartByLabel: {}
  });

  assert.equal(out.summary, "Summary for Song.mp3");
  assert.equal(out.pipeline.analysisServiceSucceeded, true);
  assert.equal(out.pipeline.webContextDerived, true);
  assert.equal(out.sectionSuggestions[0], "Verse 1");
  assert.equal(out.details.trackIdentity.title, "Song");
  assert.equal(out.details.timing.tempoEstimate, 128);
});
