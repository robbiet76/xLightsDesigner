import test from "node:test";
import assert from "node:assert/strict";

import {
  AUDIO_ANALYST_ARTIFACT_TYPE,
  AUDIO_ANALYST_ARTIFACT_VERSION,
  buildAnalysisArtifactFromPipelineResult,
  buildAnalysisHandoffFromArtifact
} from "../../agent/audio-analyst-runtime.js";

function samplePipelineResult() {
  return {
    summary: "Audio analysis complete.",
    pipeline: {
      analysisServiceSucceeded: true,
      structureDerived: true
    },
    diagnostics: [
      "Web source 1: https://songbpm.example/song",
      "Analysis engine selected: beatnet"
    ],
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
        "Tempo/time signature: 128 BPM / 4/4",
        "Web validation: 128 BPM / 4/4 (high)"
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
        sectionSource: "service+llm",
        chordAnalysis: {
          avgMarginConfidence: "0.83"
        }
      }
    }
  };
}

test("audio analyst runtime builds canonical artifact from pipeline result", () => {
  const artifact = buildAnalysisArtifactFromPipelineResult({
    audioPath: "/tmp/Song.mp3",
    mediaId: "media-123",
    result: samplePipelineResult(),
    requestedProvider: "auto",
    analysisBaseUrl: "http://127.0.0.1:5055",
    generatedAt: "2026-03-12T12:00:00.000Z"
  });

  assert.equal(artifact.artifactType, AUDIO_ANALYST_ARTIFACT_TYPE);
  assert.equal(artifact.artifactVersion, AUDIO_ANALYST_ARTIFACT_VERSION);
  assert.equal(artifact.media.mediaId, "media-123");
  assert.equal(artifact.media.path, "/tmp/Song.mp3");
  assert.equal(artifact.timing.bpm, 128);
  assert.equal(artifact.timing.beats.length, 1);
  assert.equal(artifact.harmonic.chords.length, 1);
  assert.equal(artifact.lyrics.source, "lrclib");
  assert.equal(artifact.structure.sections.length, 1);
  assert.equal(artifact.provenance.service.providerUsed, "beatnet");
  assert.deepEqual(artifact.provenance.evidence.sources, ["https://songbpm.example/song"]);
});

test("audio analyst runtime derives analysis handoff from canonical artifact", () => {
  const artifact = buildAnalysisArtifactFromPipelineResult({
    audioPath: "/tmp/Song.mp3",
    mediaId: "media-123",
    result: samplePipelineResult()
  });
  const handoff = buildAnalysisHandoffFromArtifact(artifact, {
    mood: "bright",
    storyArc: "build to chorus",
    designHints: "Use strong chorus lift\nFavor lyrical moments"
  });

  assert.equal(handoff.trackIdentity.title, "Song");
  assert.equal(handoff.timing.bpm, 128);
  assert.equal(handoff.timing.beatsArtifact, "beats");
  assert.equal(handoff.structure.sections.length, 1);
  assert.equal(handoff.lyrics.hasSyncedLyrics, true);
  assert.equal(handoff.chords.hasChords, true);
  assert.equal(handoff.briefSeed.mood, "bright");
  assert.equal(handoff.evidence.sources.length, 1);
});
