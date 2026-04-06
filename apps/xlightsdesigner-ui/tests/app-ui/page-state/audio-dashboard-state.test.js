import test from "node:test";
import assert from "node:assert/strict";

import { buildAudioDashboardState } from "../../../app-ui/page-state/audio-dashboard-state.js";
import { buildAnalysisArtifactFromPipelineResult, buildAnalysisHandoffFromArtifact } from "../../../agent/audio-analyst/audio-analyst-runtime.js";

function basenameOfPath(value = "") {
  return String(value || "").split(/[\\/]/).pop() || "";
}

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
      timing: {
        tempoEstimate: 128,
        timeSignature: "4/4"
      },
      trackIdentity: {
        title: "Song",
        artist: "Artist"
      }
    },
    raw: {
      bpm: 128,
      timeSignature: "4/4",
      beats: [{ startMs: 0, endMs: 500, label: "1" }],
      bars: [{ startMs: 0, endMs: 2000, label: "1" }],
      sections: [{ startMs: 0, endMs: 10000, label: "Intro" }],
      meta: {
        sectionSource: "service+llm"
      }
    }
  };
}

function buildReadyFixture() {
  const artifact = buildAnalysisArtifactFromPipelineResult({
    audioPath: "/tmp/media/Song.mp3",
    result: samplePipelineResult(),
    generatedAt: "2026-03-16T12:00:00.000Z"
  });
  artifact.lyrics = {
    lines: [{ startMs: 1000, endMs: 2200, label: "Line 1" }]
  };
  const handoff = buildAnalysisHandoffFromArtifact(artifact, null);
  const state = {
    audioPathInput: "/tmp/media/Song.mp3",
    mediaCatalog: [
      {
        path: "/tmp/media/Song.mp3",
        relativePath: "Song.mp3",
        fileName: "Song.mp3"
      }
    ],
    audioAnalysis: {
      summary: artifact.diagnostics.summary,
      lastAnalyzedAt: artifact.provenance.generatedAt,
      artifact
    },
    audioLibrary: {
      batchFolder: "/tmp/library",
      tracks: [
        {
          displayName: "Song - Artist",
          title: "Song",
          artist: "Artist",
          contentFingerprint: "sha256:123",
          verificationStatus: "present",
          titlePresent: true,
          artistPresent: true,
          availableProfiles: ["deep"],
          canonicalProfile: "deep",
          availableTimingNames: [
            "XD: Song Structure",
            "XD: Phrase Cues",
            "XD: Beats",
            "XD: Bars"
          ],
          updatedAt: "2026-04-06T12:00:00.000Z",
          recordPath: "/tmp/library/song-artist.json",
          fileName: "song-artist.json"
        }
      ]
    },
    ui: {
      agentThinking: false
    }
  };
  return { state, handoff };
}

test("audio dashboard state exposes standalone workflow empty state", () => {
  const dashboard = buildAudioDashboardState({
    state: {
      audioPathInput: "",
      mediaCatalog: [],
      audioAnalysis: {},
      audioLibrary: {
        batchFolder: "",
        tracks: []
      },
      ui: { agentThinking: false }
    },
    analysisHandoff: null,
    basenameOfPath
  });

  assert.equal(dashboard.contract, "audio_dashboard_state_v2");
  assert.equal(dashboard.page, "audio");
  assert.equal(dashboard.actions.singleTrack.canAnalyze, false);
  assert.equal(dashboard.library.rows.length, 0);
  assert.equal(dashboard.emptyState.title, "No Audio Metadata Yet");
});

test("audio dashboard state exposes current result summary", () => {
  const { state, handoff } = buildReadyFixture();
  const dashboard = buildAudioDashboardState({
    state,
    analysisHandoff: handoff,
    basenameOfPath
  });

  assert.equal(dashboard.currentResult.title, "Song");
  assert.equal(dashboard.currentResult.subtitle, "Artist");
  assert.equal(dashboard.currentResult.timingSummary.summaryText, "Song Structure, Phrase Cues, Beats, Bars");
  assert.equal(dashboard.currentResult.bpmText, "128 BPM");
});

test("audio dashboard state uses selected library row as current result context", () => {
  const { state, handoff } = buildReadyFixture();
  state.ui.audioLibrarySelectedKey = "sha256:123";
  const dashboard = buildAudioDashboardState({
    state,
    analysisHandoff: handoff,
    basenameOfPath
  });

  assert.equal(dashboard.currentResult.title, "Song - Artist");
  assert.equal(dashboard.currentResult.subtitle, "Artist");
  assert.equal(dashboard.currentResult.summary, "Required timing layers are available.");
  assert.equal(dashboard.currentResult.isRunning, false);
});

test("audio dashboard state does not mark terminal analysis progress as running", () => {
  const { state, handoff } = buildReadyFixture();
  state.audioAnalysis.progress = {
    stage: "handoff_ready",
    message: "Analysis finished."
  };
  state.ui.agentThinking = false;
  const dashboard = buildAudioDashboardState({
    state,
    analysisHandoff: handoff,
    basenameOfPath
  });

  assert.equal(dashboard.currentResult.isRunning, false);
});

test("audio dashboard state summarizes library rows for grid display", () => {
  const { state, handoff } = buildReadyFixture();
  const dashboard = buildAudioDashboardState({
    state,
    analysisHandoff: handoff,
    basenameOfPath
  });

  assert.equal(dashboard.library.overview.total, 1);
  assert.equal(dashboard.library.overview.complete, 1);
  assert.equal(dashboard.library.rows[0].status, "Complete");
  assert.equal(dashboard.library.rows[0].availableTimingsText, "Song Structure, Phrase Cues, Beats, Bars");
  assert.equal(dashboard.library.rows[0].identityText, "Verified");
});

test("audio dashboard state flags temporary-name records for review", () => {
  const dashboard = buildAudioDashboardState({
    state: {
      audioPathInput: "",
      mediaCatalog: [],
      audioAnalysis: {},
      audioLibrary: {
        batchFolder: "",
        tracks: [
          {
            displayName: "track-a1b2c3d4",
            title: "track-a1b2c3d4",
            artist: "",
            contentFingerprint: "abc",
            verificationStatus: "unverified",
            titlePresent: true,
            artistPresent: false,
            availableProfiles: ["deep"],
            canonicalProfile: "deep",
            availableTimingNames: ["XD: Song Structure", "XD: Beats", "XD: Bars"],
            updatedAt: "2026-04-06T12:00:00.000Z",
            recordPath: "/tmp/library/track-a1b2c3d4.json",
            fileName: "track-a1b2c3d4.json"
          }
        ]
      },
      ui: { agentThinking: false }
    },
    analysisHandoff: null,
    basenameOfPath
  });

  assert.equal(dashboard.library.rows[0].status, "Needs Review");
  assert.equal(dashboard.library.rows[0].actionText, "Verify track info");
  assert.equal(dashboard.library.rows[0].identityText, "Needs review");
});
