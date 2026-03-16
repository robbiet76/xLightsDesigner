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
      },
      summaryLines: [
        "Song context: bright and uplifting",
        "Tempo/time signature: 128 BPM / 4/4"
      ]
    },
    raw: {
      bpm: 128,
      timeSignature: "4/4",
      beats: [{ startMs: 0, endMs: 500, label: "1" }],
      bars: [{ startMs: 0, endMs: 2000, label: "1" }],
      sections: [
        { startMs: 0, endMs: 10000, label: "Intro" },
        { startMs: 10000, endMs: 30000, label: "Chorus 1" }
      ],
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
    ui: {
      agentThinking: false
    }
  };
  return { state, artifact, handoff };
}

test("audio dashboard state reports blocked when no track is selected", () => {
  const dashboard = buildAudioDashboardState({
    state: {
      audioPathInput: "",
      mediaCatalog: [],
      audioAnalysis: {},
      ui: { agentThinking: false }
    },
    analysisHandoff: null,
    basenameOfPath
  });

  assert.equal(dashboard.page, "audio");
  assert.equal(dashboard.status, "idle");
  assert.equal(dashboard.readiness.ok, false);
  assert.equal(dashboard.readiness.level, "blocked");
  assert.match(dashboard.validationIssues[0].code, /no_audio_track_selected/);
  assert.equal(dashboard.data.emptyState.title, "No Media Loaded");
});

test("audio dashboard state reports in-progress analysis deterministically", () => {
  const dashboard = buildAudioDashboardState({
    state: {
      audioPathInput: "/tmp/media/Song.mp3",
      mediaCatalog: [],
      audioAnalysis: {
        summary: "",
        progress: {
          stage: "timing",
          message: "Analyzing timing with librosa.",
          updatedAt: "2026-03-16T12:00:10.000Z"
        }
      },
      ui: { agentThinking: true }
    },
    analysisHandoff: null,
    basenameOfPath
  });

  assert.equal(dashboard.status, "in_progress");
  assert.equal(dashboard.readiness.level, "pending");
  assert.equal(dashboard.data.progress.active, true);
  assert.equal(dashboard.data.progress.message, "Analyzing timing with librosa.");
});

test("audio dashboard state reports ready when persisted analysis and handoff are available", () => {
  const { state, artifact, handoff } = buildReadyFixture();

  const dashboard = buildAudioDashboardState({
    state,
    analysisHandoff: handoff,
    basenameOfPath
  });

  assert.equal(dashboard.status, "ready");
  assert.equal(dashboard.readiness.ok, true);
  assert.equal(dashboard.refs.analysisArtifactId, artifact.artifactId);
  assert.equal(dashboard.data.trackContext.title, "Song");
  assert.equal(dashboard.data.structure.visibleSections.length, 2);
  assert.equal(dashboard.data.cues.holdCue, "Intro");
  assert.equal(dashboard.data.cues.firstLift, "Chorus 1");
  assert.equal(dashboard.data.downstream.ready, true);
});

test("audio dashboard state keeps selected track visible when outside media directory", () => {
  const dashboard = buildAudioDashboardState({
    state: {
      audioPathInput: "/tmp/external/LooseSong.mp3",
      mediaCatalog: [
        {
          path: "/tmp/media/OtherSong.mp3",
          relativePath: "OtherSong.mp3",
          fileName: "OtherSong.mp3"
        }
      ],
      audioAnalysis: {},
      ui: { agentThinking: false }
    },
    analysisHandoff: null,
    basenameOfPath
  });

  assert.equal(dashboard.data.options[0].path, "/tmp/external/LooseSong.mp3");
  assert.match(dashboard.data.options[0].detail, /outside Media Directory/);
  assert.equal(dashboard.data.options[0].selected, true);
});
