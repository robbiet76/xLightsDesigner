import test from "node:test";
import assert from "node:assert/strict";

import {
  validateAudioAnalystInput,
  validateAnalysisArtifact,
  validateAudioAnalystResult,
  buildAudioAnalystResult,
  classifyAudioAnalysisFailureReason,
  validateAudioAnalystContractGate
} from "../../../agent/audio-analyst/audio-analyst-contracts.js";
import { buildAnalysisArtifactFromPipelineResult, buildAnalysisHandoffFromArtifact } from "../../../agent/audio-analyst/audio-analyst-runtime.js";

function sampleArtifact() {
  return buildAnalysisArtifactFromPipelineResult({
    audioPath: "/tmp/Song.mp3",
    mediaId: "media-123",
    result: {
      summary: "Audio analysis complete.",
      pipeline: {
        analysisServiceSucceeded: true,
        structureDerived: true
      },
      details: {
        trackName: "Song.mp3",
        media: {
          durationMs: 1000,
          sampleRate: 44100,
          channels: 2
        },
        timing: {
          tempoEstimate: 128,
          timeSignature: "4/4"
        },
        trackIdentity: {
          title: "Song",
          artist: "Artist"
        },
        summaryLines: ["Song context: test"]
      },
      raw: {
        beats: [{ startMs: 0, endMs: 500, label: "1" }],
        bars: [{ startMs: 0, endMs: 1000, label: "1" }],
        chords: [{ startMs: 0, endMs: 1000, label: "C" }],
        lyrics: [{ startMs: 0, endMs: 500, label: "hello" }],
        sections: [{ startMs: 0, endMs: 1000, label: "Verse 1" }],
        meta: {
          engine: "beatnet",
          lyricsSource: "lrclib"
        }
      },
      diagnostics: []
    }
  });
}

test("audio analyst input validator accepts media-focused payload", () => {
  const errors = validateAudioAnalystInput({
    agentRole: "audio_analyst",
    contractVersion: "1.0",
    requestId: "audio-1",
    context: {
      media: { path: "/tmp/Song.mp3" },
      project: { projectFilePath: "/tmp/Test.xdproj" },
      service: { baseUrl: "http://127.0.0.1:5055", provider: "librosa" }
    },
    analysisProfile: {}
  });
  assert.deepEqual(errors, []);
});

test("audio analyst artifact validator accepts canonical artifact", () => {
  const errors = validateAnalysisArtifact(sampleArtifact());
  assert.deepEqual(errors, []);
});

test("audio analyst result validator accepts partial result envelope", () => {
  const artifact = sampleArtifact();
  artifact.diagnostics.degraded = true;
  const handoff = buildAnalysisHandoffFromArtifact(artifact, null);
  const result = buildAudioAnalystResult({
    requestId: "audio-2",
    status: "partial",
    failureReason: "partial_analysis",
    artifact,
    handoff,
    warnings: ["Analysis service returned no synced lyrics."],
    summary: "Audio analysis complete with warnings."
  });
  const errors = validateAudioAnalystResult(result);
  assert.deepEqual(errors, []);
});

test("audio analyst contract gate reports unknown contract kind", () => {
  const gate = validateAudioAnalystContractGate("bad-kind", {}, "audio-3");
  assert.equal(gate.ok, false);
  assert.equal(gate.report.stage, "unknown_contract");
});

test("audio analyst failure taxonomy prefers partial artifact state", () => {
  const artifact = sampleArtifact();
  artifact.diagnostics.degraded = true;
  artifact.lyrics.lines = [];
  artifact.diagnostics.warnings = ["Analysis service returned no synced lyrics."];
  assert.equal(classifyAudioAnalysisFailureReason("artifact", "", artifact), "lyrics_unavailable");
});

test("audio analyst artifact relabels generic section names into semantic fallback labels", () => {
  const artifact = buildAnalysisArtifactFromPipelineResult({
    audioPath: "/tmp/Song.mp3",
    mediaId: "media-456",
    result: {
      summary: "Audio analysis complete.",
      pipeline: {
        analysisServiceSucceeded: true,
        structureDerived: true
      },
      details: {
        trackName: "Song.mp3",
        media: {
          durationMs: 180000
        },
        timing: {
          tempoEstimate: 120,
          timeSignature: "4/4"
        }
      },
      raw: {
        sections: [
          { startMs: 0, endMs: 15000, label: "Section 1" },
          { startMs: 15000, endMs: 45000, label: "Section 2" },
          { startMs: 45000, endMs: 75000, label: "Section 3" },
          { startMs: 75000, endMs: 105000, label: "Section 4" },
          { startMs: 105000, endMs: 135000, label: "Section 5" },
          { startMs: 135000, endMs: 150000, label: "Section 6" },
          { startMs: 150000, endMs: 170000, label: "Section 7" },
          { startMs: 170000, endMs: 180000, label: "Section 8" }
        ]
      },
      diagnostics: []
    }
  });

  assert.deepEqual(
    artifact.structure.sections.map((row) => row.label),
    ["Intro", "Verse 1", "Chorus 1", "Verse 2", "Chorus 2", "Bridge", "Final Chorus", "Outro"]
  );
});
