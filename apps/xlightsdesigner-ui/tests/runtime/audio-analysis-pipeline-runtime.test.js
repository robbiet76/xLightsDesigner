import test from 'node:test';
import assert from 'node:assert/strict';

import { createAudioAnalysisPipelineRuntime } from '../../runtime/audio-analysis-pipeline-runtime.js';

test('audio analysis pipeline runtime escalates weak fast reports', () => {
  const runtime = createAudioAnalysisPipelineRuntime({
    state: { audioAnalysis: {}, ui: {}, creative: {}, sectionSuggestions: [], sectionStartByLabel: {}, timingTracks: [] },
    basenameOfPath: () => 'track.mp3',
    analyzeAudioContext: () => ({ summaryLines: [] }),
    buildAnalysisArtifactFromPipelineResult: () => ({}),
    buildAnalysisHandoffFromArtifact: () => ({}),
    buildAudioAnalysisQualityReport: () => ({}),
    runAudioAnalysisOrchestration: async () => ({}),
    maybePromptForMissingIdentityMetadata: async () => null,
    buildSectionSuggestions: () => ({ labels: [], startByLabel: {} }),
    areMetersCompatible: () => true,
    extractNumericCandidates: () => [],
    medianNumber: () => null,
    loadAudioTrainingPackageBundle: async () => ({ ok: false })
  });

  assert.equal(runtime.shouldEscalateAudioAnalysisProfile({
    readiness: { minimumContract: { semanticSongStructurePresent: false } },
    topLevelIssues: []
  }), true);
  assert.equal(runtime.shouldEscalateAudioAnalysisProfile({
    readiness: { minimumContract: { semanticSongStructurePresent: true } },
    topLevelIssues: []
  }), false);
});

test('audio analysis pipeline runtime builds stub summary from analyzer output', () => {
  const runtime = createAudioAnalysisPipelineRuntime({
    state: {
      audioPathInput: '/tmp/song.mp3',
      sectionSuggestions: ['Intro', 'Verse'],
      sectionStartByLabel: {},
      timingTracks: [],
      audioAnalysis: { pipeline: { fingerprintCaptured: true } },
      ui: {},
      creative: {}
    },
    basenameOfPath: () => 'song.mp3',
    analyzeAudioContext: () => ({
      trackName: 'song.mp3',
      trackIdentity: { title: 'Song', artist: 'Artist', isrc: 'ISRC1' },
      media: { durationMs: 123000, channels: 2, sampleRate: 44100 },
      structure: ['Intro', 'Verse'],
      timing: { tempoEstimate: 120, timeSignature: '4/4' },
      summaryLines: ['Song context: festive pop']
    }),
    buildAnalysisArtifactFromPipelineResult: () => ({}),
    buildAnalysisHandoffFromArtifact: () => ({}),
    buildAudioAnalysisQualityReport: () => ({}),
    runAudioAnalysisOrchestration: async () => ({}),
    maybePromptForMissingIdentityMetadata: async () => null,
    buildSectionSuggestions: () => ({ labels: [], startByLabel: {} }),
    areMetersCompatible: () => true,
    extractNumericCandidates: () => [],
    medianNumber: () => null,
    loadAudioTrainingPackageBundle: async () => ({ ok: false })
  });

  const summary = runtime.buildAudioAnalysisStubSummary();
  assert.match(summary, /Audio source: song.mp3/);
  assert.match(summary, /Fingerprint match: Song - Artist/);
  assert.match(summary, /Song context: festive pop/);
});
