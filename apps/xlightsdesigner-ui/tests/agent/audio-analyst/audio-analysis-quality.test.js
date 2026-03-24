import test from "node:test";
import assert from "node:assert/strict";

import { buildAudioAnalysisQualityReport } from "../../../agent/audio-analyst/audio-analysis-quality.js";

function sampleArtifact() {
  return {
    media: {
      fileName: "Song.mp3"
    },
    identity: {
      title: "Song",
      artist: "Artist"
    },
    timing: {
      bpm: 112.36,
      timeSignature: "2/4",
      beats: [
        { startMs: 0, endMs: 500, label: "1" },
        { startMs: 500, endMs: 1000, label: "2" },
        { startMs: 1000, endMs: 1500, label: "1" },
        { startMs: 1500, endMs: 2000, label: "2" }
      ],
      bars: [
        { startMs: 0, endMs: 1000, label: "1" },
        { startMs: 1000, endMs: 2000, label: "2" }
      ]
    },
    harmonic: {
      chords: [],
      confidence: "0.043"
    },
    lyrics: {
      source: "none",
      lines: []
    },
    structure: {
      source: "service+llm",
      confidence: "medium",
      sections: [
        { startMs: 0, endMs: 1000, label: "Intro" },
        { startMs: 1000, endMs: 2000, label: "Verse 1" }
      ]
    },
    capabilities: {
      timing: {
        confidence: "high"
      },
      harmonic: {
        source: "librosa-chroma-template-v2-independent"
      }
    },
    briefSeed: {
      summaryLines: [
        "Song structure: Section 1, Section 2"
      ]
    },
    diagnostics: {
      warnings: [
        "Final song structure labels: Section 1, Section 2"
      ]
    },
    provenance: {
      service: {
        providerUsed: "librosa"
      }
    }
  };
}

test("audio analysis quality report flags missing lyric/chord support without inventing semantic structure", () => {
  const report = buildAudioAnalysisQualityReport(sampleArtifact());

  assert.equal(report.trackIdentity.title, "Song");
  assert.equal(report.provenance.structureHasOnlyGenericLabels, false);
  assert.ok(report.topLevelIssues.includes("no_synced_lyrics"));
  assert.ok(report.topLevelIssues.includes("no_chords"));
  assert.ok(report.topLevelIssues.includes("very_low_harmonic_confidence"));
  assert.ok(report.topLevelIssues.includes("timing_locked_to_duple_meter"));
  assert.equal(report.sections.length, 2);
  assert.equal(report.sections[0].beatCount, 2);
  assert.equal(report.sections[0].barCount, 1);
});

test("audio analysis quality report flags generic structure labels directly", () => {
  const artifact = sampleArtifact();
  artifact.structure.sections = [
    { startMs: 0, endMs: 1000, label: "Section 1" },
    { startMs: 1000, endMs: 2000, label: "Section 2" }
  ];

  const report = buildAudioAnalysisQualityReport(artifact);

  assert.equal(report.provenance.structureHasOnlyGenericLabels, true);
  assert.ok(report.topLevelIssues.includes("generic_structure_labels_present"));
});
