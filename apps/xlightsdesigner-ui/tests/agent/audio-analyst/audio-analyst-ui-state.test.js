import test from "node:test";
import assert from "node:assert/strict";

import {
  resetAudioAnalysisView,
  buildPendingAudioAnalysisPipeline,
  applyPersistedAnalysisArtifactToState,
  applyAudioAnalystFlowSuccessToState,
  applyAudioAnalystFlowFailureToState
} from "../../../agent/audio-analyst/audio-analyst-ui-state.js";
import { buildAnalysisArtifactFromPipelineResult, buildAnalysisHandoffFromArtifact } from "../../../agent/audio-analyst/audio-analyst-runtime.js";

function samplePipelineResult() {
  return {
    summary: "Audio analysis complete.",
    pipeline: {
      analysisServiceSucceeded: true,
      structureDerived: true
    },
    diagnostics: [],
    details: {
      trackName: "Song.mp3",
      media: {
        durationMs: 123000,
        sampleRate: 44100,
        channels: 2
      },
      timing: {
        tempoEstimate: 128,
        timeSignature: "4/4",
        hasBeatTrack: true,
        hasBarTrack: true,
        hasLyricsTrack: true,
        hasChordTrack: true
      },
      trackIdentity: {
        title: "Song",
        artist: "Artist",
        isrc: "ABC123"
      },
      summaryLines: [
        "Song context: uplifting holiday energy",
        "Tempo/time signature: 128 BPM / 4/4"
      ]
    },
    raw: {
      bpm: 128,
      timeSignature: "4/4",
      beats: [{ startMs: 0, endMs: 500, label: "1" }],
      bars: [{ startMs: 0, endMs: 2000, label: "1" }],
      chords: [{ startMs: 0, endMs: 2000, label: "C" }],
      lyrics: [{ startMs: 300, endMs: 900, label: "hello" }],
      sections: [{ startMs: 0, endMs: 20000, label: "Verse 1" }],
      meta: {
        engine: "beatnet",
        lyricsSource: "lrclib",
        sectionSource: "service+llm"
      }
    }
  };
}

test("audio analyst ui state can reset and initialize pending pipeline", () => {
  const audioAnalysisState = {
    summary: "old",
    lastAnalyzedAt: "2026-03-12T12:00:00.000Z",
    pipeline: { old: true }
  };
  resetAudioAnalysisView(audioAnalysisState);
  assert.equal(audioAnalysisState.summary, "");
  assert.equal(audioAnalysisState.lastAnalyzedAt, "");
  assert.equal(audioAnalysisState.pipeline, null);

  const pending = buildPendingAudioAnalysisPipeline();
  assert.equal(pending.mediaAttached, true);
  assert.equal(pending.analysisServiceSucceeded, false);
});

test("audio analyst ui state applies persisted artifact by deriving handoff", () => {
  const artifact = buildAnalysisArtifactFromPipelineResult({
    audioPath: "/tmp/Song.mp3",
    result: samplePipelineResult(),
    generatedAt: "2026-03-12T12:00:00.000Z"
  });
  const audioAnalysisState = { summary: "", lastAnalyzedAt: "", pipeline: null };
  let captured = null;

  const out = applyPersistedAnalysisArtifactToState({
    artifact,
    creativeBrief: { mood: "bright" },
    audioAnalysisState,
    setHandoff: (payload) => {
      captured = payload;
      return { ok: true };
    }
  });

  assert.equal(out.ok, true);
  assert.deepEqual(captured, buildAnalysisHandoffFromArtifact(artifact, { mood: "bright" }));
  assert.equal(audioAnalysisState.summary, artifact.diagnostics.summary);
  assert.equal(audioAnalysisState.lastAnalyzedAt, artifact.provenance.generatedAt);
});

test("audio analyst ui state applies success and failure flow projections", () => {
  const artifact = buildAnalysisArtifactFromPipelineResult({
    audioPath: "/tmp/Song.mp3",
    result: samplePipelineResult(),
    generatedAt: "2026-03-12T12:00:00.000Z"
  });
  const handoff = buildAnalysisHandoffFromArtifact(artifact, null);
  const audioAnalysisState = { summary: "", lastAnalyzedAt: "", pipeline: null };

  const success = applyAudioAnalystFlowSuccessToState({
    flow: { artifact, handoff },
    pipelineResult: samplePipelineResult(),
    fallbackSummary: "fallback",
    audioAnalysisState,
    setHandoff: () => ({ ok: true })
  });

  assert.equal(success.ok, true);
  assert.equal(audioAnalysisState.summary, artifact.diagnostics.summary);
  assert.equal(audioAnalysisState.lastAnalyzedAt, artifact.provenance.generatedAt);

  const failure = applyAudioAnalystFlowFailureToState({
    audioAnalysisState,
    fallbackSummary: "stub summary",
    at: "2026-03-12T13:00:00.000Z"
  });
  assert.equal(failure.ok, true);
  assert.equal(audioAnalysisState.summary, "stub summary");
  assert.equal(audioAnalysisState.lastAnalyzedAt, "2026-03-12T13:00:00.000Z");
  assert.equal(audioAnalysisState.pipeline, null);
});
