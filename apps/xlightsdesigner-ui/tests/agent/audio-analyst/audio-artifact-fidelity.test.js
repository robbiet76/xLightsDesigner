import test from "node:test";
import assert from "node:assert/strict";

import { buildAnalysisArtifactFromPipelineResult, buildAnalysisHandoffFromArtifact } from "../../../agent/audio-analyst/audio-analyst-runtime.js";

function samplePipelineResult() {
  return {
    summary: "Audio analysis complete.",
    pipeline: {
      analysisServiceSucceeded: true,
      structureDerived: true,
      timingDerived: true,
      lyricsDetected: true,
      webContextDerived: true
    },
    diagnostics: [
      "Web source 1: https://songbpm.example/song",
      "Analysis engine selected: beatnet",
      "Chord analysis confidence: 0.83"
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
        rhythmProviderAgreement: {
          enabled: true,
          available: true,
          primaryProvider: "beatnet",
          secondaryProvider: "madmom_downbeat",
          primary: { beatsPerBar: 4, timeSignature: "4/4", bpm: 128 },
          secondary: { provider: "madmom_downbeat", beatsPerBar: 3, timeSignature: "3/4", bpm: 126.5 },
          agreedOnBeatsPerBar: false,
          agreedOnTimeSignature: false,
          bpmDelta: 1.5
        },
        rhythmProviderResults: {
          selectedProvider: "beatnet",
          providers: {
            beatnet: {
              provider: "beatnet",
              available: true,
              selected: true,
              beatsPerBar: 4,
              timeSignature: "4/4",
              bpm: 128,
              beatCount: 1,
              barCount: 1,
              beats: [{ startMs: 0, endMs: 500, label: "1" }],
              bars: [{ startMs: 0, endMs: 2000, label: "1" }]
            },
            madmom_downbeat: {
              provider: "madmom_downbeat",
              available: true,
              selected: false,
              beatsPerBar: 3,
              timeSignature: "3/4",
              bpm: 126.5,
              beatCount: 1,
              barCount: 1,
              beats: [{ startMs: 0, endMs: 500, label: "1" }],
              bars: [{ startMs: 0, endMs: 1500, label: "1" }]
            }
          }
        },
        chordAnalysis: {
          engine: "madmom",
          avgMarginConfidence: "0.83"
        },
        harmonyProviderResults: {
          selectedProvider: "madmom",
          providers: {
            madmom: {
              provider: "madmom",
              available: true,
              selected: true,
              chordCount: 1,
              avgMarginConfidence: "0.83",
              chords: [{ startMs: 0, endMs: 2000, label: "C" }]
            }
          }
        },
        lyricsProviderResults: {
          selectedProvider: "lrclib",
          providers: {
            lrclib: {
              provider: "lrclib",
              available: true,
              selected: true,
              lineCount: 1,
              globalShiftMs: 0,
              lines: [{ startMs: 300, endMs: 900, label: "hello" }]
            }
          }
        },
        structureBackbone: {
          segments: [
            { startMs: 0, endMs: 20000, familyId: "family-A", familyLabel: "A", anchorIndex: 0, segmentIndex: 0 }
          ],
          families: [
            { familyId: "family-A", label: "A", anchorIndex: 0, memberIndices: [0], occurrenceCount: 1 }
          ],
          sequence: ["A"],
          anchorFor: [0]
        },
        webTempoEvidence: {
          confidence: "high"
        }
      }
    }
  };
}

test("analysis artifact preserves per-capability confidence and evidence blocks", () => {
  const artifact = buildAnalysisArtifactFromPipelineResult({
    audioPath: "/tmp/Song.mp3",
    mediaId: "media-123",
    result: samplePipelineResult(),
    requestedProvider: "auto",
    analysisBaseUrl: "http://127.0.0.1:5055",
    generatedAt: "2026-03-12T12:00:00.000Z"
  });

  assert.equal(artifact.capabilities.identity.available, true);
  assert.equal(artifact.capabilities.timing.confidence, "medium");
  assert.equal(artifact.capabilities.harmonic.confidence, "0.83");
  assert.equal(artifact.capabilities.lyrics.available, true);
  assert.equal(artifact.capabilities.structure.source, "service+llm");
  assert.equal(artifact.provenance.evidence.webValidation.confidence, "high");
  assert.equal(typeof artifact.modules, "object");
  assert.equal(artifact.modules.identity.data.title, "Song");
  assert.equal(artifact.modules.identity.metadata.moduleVersion, "v1");
  assert.equal(artifact.modules.identity.metadata.profileMode, "deep");
  assert.equal(artifact.modules.rhythm.data.timeSignature, "4/4");
  assert.equal(artifact.modules.rhythm.data.providerAgreement.secondary.timeSignature, "3/4");
  assert.equal(artifact.modules.rhythm.data.providerResults.providers.madmom_downbeat.timeSignature, "3/4");
  assert.ok(artifact.modules.rhythm.metadata.invalidationKey.includes(":deep:rhythm:"));
  assert.ok(artifact.modules.rhythm.diagnostics.some((line) => line.includes("timeSignature disagreement")));
  assert.equal(artifact.modules.harmony.data.chords.length, 1);
  assert.equal(artifact.modules.harmony.data.providerResults.providers.madmom.chordCount, 1);
  assert.equal(artifact.modules.lyrics.data.lines.length, 1);
  assert.equal(artifact.modules.lyrics.data.providerResults.providers.lrclib.lineCount, 1);
  assert.equal(artifact.modules.structureBackbone.data.segments.length, 1);
  assert.equal(artifact.modules.structureBackbone.data.segments[0].familyLabel, "A");
  assert.equal(artifact.modules.structureBackbone.data.families[0].label, "A");
  assert.deepEqual(artifact.modules.structureBackbone.data.sequence, ["A"]);
  assert.equal(artifact.modules.semanticStructure.data.sections.length, 1);
});

test("analysis handoff remains distilled while artifact keeps richer evidence", () => {
  const artifact = buildAnalysisArtifactFromPipelineResult({
    audioPath: "/tmp/Song.mp3",
    mediaId: "media-123",
    result: samplePipelineResult()
  });
  const handoff = buildAnalysisHandoffFromArtifact(artifact, null);

  assert.equal(typeof artifact.capabilities, "object");
  assert.equal(typeof artifact.modules, "object");
  assert.equal(handoff.timing.bpm, 128);
  assert.equal(handoff.evidence.serviceSummary.includes("128 BPM"), true);
  assert.equal(Object.prototype.hasOwnProperty.call(handoff, "capabilities"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(handoff, "modules"), false);
});
