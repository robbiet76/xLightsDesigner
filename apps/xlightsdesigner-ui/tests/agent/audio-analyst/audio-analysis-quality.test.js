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
    modules: {
      rhythm: {
        data: {
          providerAgreement: {
            enabled: true,
            available: true,
            primaryProvider: "librosa",
            secondaryProvider: "madmom_downbeat",
            primary: { beatsPerBar: 2, timeSignature: "2/4", bpm: 112.36 },
            secondary: { provider: "madmom_downbeat", beatsPerBar: 4, timeSignature: "4/4", bpm: 112.9 },
            agreedOnBeatsPerBar: false,
            agreedOnTimeSignature: false,
            bpmDelta: 0.54
          }
        }
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
  assert.equal(report.topLevelIssues.includes("missing_semantic_song_structure"), false);
  assert.ok(report.topLevelIssues.includes("very_low_harmonic_confidence"));
  assert.ok(report.topLevelIssues.includes("timing_locked_to_duple_meter"));
  assert.ok(report.topLevelIssues.includes("rhythm_provider_time_signature_disagreement"));
  assert.ok(report.topLevelIssues.includes("rhythm_provider_bar_grouping_disagreement"));
  assert.equal(report.readiness.minimumContract.beatsPresent, true);
  assert.equal(report.readiness.minimumContract.barsPresent, true);
  assert.equal(report.readiness.minimumContract.semanticSongStructurePresent, true);
  assert.equal(report.readiness.minimumContract.barsMatchTimeSignature, true);
  assert.equal(report.readiness.ok, true);
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
  assert.ok(report.topLevelIssues.includes("missing_semantic_song_structure"));
  assert.equal(report.readiness.minimumContract.semanticSongStructurePresent, false);
  assert.equal(report.readiness.ok, false);
});

test("audio analysis quality report fails readiness when bars do not match time signature", () => {
  const artifact = sampleArtifact();
  artifact.timing.timeSignature = "4/4";

  const report = buildAudioAnalysisQualityReport(artifact);

  assert.ok(report.topLevelIssues.includes("bars_do_not_match_time_signature"));
  assert.equal(report.readiness.minimumContract.barsMatchTimeSignature, false);
  assert.equal(report.readiness.ok, false);
});

test("audio analysis quality report fails readiness for mixed semantic and generic section labels", () => {
  const artifact = sampleArtifact();
  artifact.structure.sections = [
    { startMs: 0, endMs: 1000, label: "Verse 1", sectionType: "verse" },
    { startMs: 1000, endMs: 2000, label: "Section 2", sectionType: "section" }
  ];

  const report = buildAudioAnalysisQualityReport(artifact);

  assert.ok(report.topLevelIssues.includes("missing_semantic_song_structure"));
  assert.equal(report.readiness.minimumContract.semanticSongStructurePresent, false);
  assert.equal(report.readiness.ok, false);
});
