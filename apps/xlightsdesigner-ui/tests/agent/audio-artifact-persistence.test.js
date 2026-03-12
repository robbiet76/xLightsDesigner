import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  buildAnalysisArtifactFromPipelineResult,
  buildAnalysisHandoffFromArtifact
} from "../../agent/audio-analyst-runtime.js";
import {
  buildAnalysisArtifactPaths,
  writeAnalysisArtifactToProject,
  readAnalysisArtifactFromProject
} from "../../../xlightsdesigner-desktop/analysis-artifact-store.mjs";

function samplePipelineResult() {
  return {
    summary: "Audio analysis complete.",
    pipeline: {
      analysisServiceSucceeded: true,
      structureDerived: true,
      timingDerived: true,
      lyricsDetected: true
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

function partialPipelineResult() {
  return {
    summary: "Audio analysis complete with warnings.",
    pipeline: {
      analysisServiceSucceeded: false,
      structureDerived: false,
      timingDerived: true,
      lyricsDetected: false
    },
    diagnostics: [
      "Analysis service returned no synced lyrics.",
      "Analysis service returned no sections."
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
        hasLyricsTrack: false,
        hasChordTrack: false
      },
      trackIdentity: {
        title: "Song",
        artist: "Artist"
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
      chords: [],
      lyrics: [],
      sections: [],
      meta: {
        engine: "beatnet",
        lyricsSource: "none",
        sectionSource: "pending"
      }
    }
  };
}

test("analysis artifact store persists canonical artifact under project-root analysis path", async (t) => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "xld-audio-artifact-"));
  t.after(() => fs.rmSync(tmpRoot, { recursive: true, force: true }));

  const projectDir = path.join(tmpRoot, "projects", "Christmas 2026");
  fs.mkdirSync(projectDir, { recursive: true });
  const projectFilePath = path.join(projectDir, "Christmas 2026.xdproj");
  fs.writeFileSync(projectFilePath, JSON.stringify({ name: "Christmas 2026" }, null, 2), "utf8");

  const mediaFilePath = path.join(tmpRoot, "media", "Song.mp3");
  fs.mkdirSync(path.dirname(mediaFilePath), { recursive: true });
  fs.writeFileSync(mediaFilePath, "fake-audio", "utf8");

  const artifact = buildAnalysisArtifactFromPipelineResult({
    audioPath: mediaFilePath,
    result: samplePipelineResult(),
    requestedProvider: "auto",
    analysisBaseUrl: "http://127.0.0.1:5055",
    generatedAt: "2026-03-12T12:00:00.000Z"
  });

  const writeRes = writeAnalysisArtifactToProject({
    projectFilePath,
    mediaFilePath,
    artifact
  });

  assert.equal(writeRes.ok, true);
  assert.ok(fs.existsSync(writeRes.artifactPath));

  const expectedPaths = buildAnalysisArtifactPaths(projectFilePath, mediaFilePath);
  assert.equal(writeRes.mediaId, expectedPaths.mediaId);
  assert.equal(writeRes.artifactPath, expectedPaths.artifactPath);
  assert.equal(writeRes.artifact.media.mediaId, expectedPaths.mediaId);
  assert.equal(writeRes.artifact.media.path, path.resolve(mediaFilePath));

  const readRes = readAnalysisArtifactFromProject({
    projectFilePath,
    mediaFilePath
  });

  assert.equal(readRes.ok, true);
  assert.deepEqual(readRes.artifact, writeRes.artifact);
});

test("analysis handoff rehydrates deterministically from persisted artifact", async (t) => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "xld-audio-rehydrate-"));
  t.after(() => fs.rmSync(tmpRoot, { recursive: true, force: true }));

  const projectDir = path.join(tmpRoot, "projects", "Christmas 2026");
  fs.mkdirSync(projectDir, { recursive: true });
  const projectFilePath = path.join(projectDir, "Christmas 2026.xdproj");
  fs.writeFileSync(projectFilePath, JSON.stringify({ name: "Christmas 2026" }, null, 2), "utf8");

  const mediaFilePath = path.join(tmpRoot, "media", "Song.mp3");
  fs.mkdirSync(path.dirname(mediaFilePath), { recursive: true });
  fs.writeFileSync(mediaFilePath, "fake-audio", "utf8");

  const artifact = buildAnalysisArtifactFromPipelineResult({
    audioPath: mediaFilePath,
    result: samplePipelineResult(),
    requestedProvider: "beatnet",
    generatedAt: "2026-03-12T12:00:00.000Z"
  });
  const creativeBrief = {
    mood: "bright",
    storyArc: "build to chorus",
    designHints: "Use strong chorus lift\nFavor lyrical moments"
  };
  const expectedHandoff = buildAnalysisHandoffFromArtifact(artifact, creativeBrief);

  const writeRes = writeAnalysisArtifactToProject({
    projectFilePath,
    mediaFilePath,
    artifact
  });
  const readRes = readAnalysisArtifactFromProject({
    projectFilePath,
    mediaFilePath
  });

  assert.equal(writeRes.ok, true);
  assert.equal(readRes.ok, true);

  const rehydratedHandoff = buildAnalysisHandoffFromArtifact(readRes.artifact, creativeBrief);
  assert.deepEqual(rehydratedHandoff, expectedHandoff);
});

test("persisted canonical artifact retains full capability payloads for downstream timing and design use", async (t) => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "xld-audio-capabilities-"));
  t.after(() => fs.rmSync(tmpRoot, { recursive: true, force: true }));

  const projectDir = path.join(tmpRoot, "projects", "Christmas 2026");
  fs.mkdirSync(projectDir, { recursive: true });
  const projectFilePath = path.join(projectDir, "Christmas 2026.xdproj");
  fs.writeFileSync(projectFilePath, JSON.stringify({ name: "Christmas 2026" }, null, 2), "utf8");

  const mediaFilePath = path.join(tmpRoot, "media", "Song.mp3");
  fs.mkdirSync(path.dirname(mediaFilePath), { recursive: true });
  fs.writeFileSync(mediaFilePath, "fake-audio", "utf8");

  const artifact = buildAnalysisArtifactFromPipelineResult({
    audioPath: mediaFilePath,
    result: samplePipelineResult(),
    requestedProvider: "beatnet",
    generatedAt: "2026-03-12T12:00:00.000Z"
  });

  writeAnalysisArtifactToProject({ projectFilePath, mediaFilePath, artifact });
  const readRes = readAnalysisArtifactFromProject({ projectFilePath, mediaFilePath });

  assert.equal(readRes.ok, true);
  assert.equal(readRes.artifact.timing.beats.length, 1);
  assert.equal(readRes.artifact.timing.bars.length, 1);
  assert.equal(readRes.artifact.harmonic.chords.length, 1);
  assert.equal(readRes.artifact.lyrics.lines.length, 1);
  assert.equal(readRes.artifact.structure.sections.length, 1);
  assert.equal(readRes.artifact.capabilities.timing.available, true);
  assert.equal(readRes.artifact.capabilities.lyrics.available, true);
  assert.equal(readRes.artifact.capabilities.structure.available, true);
});

test("persisted partial artifact preserves degraded status and missing-capability truth", async (t) => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "xld-audio-partial-"));
  t.after(() => fs.rmSync(tmpRoot, { recursive: true, force: true }));

  const projectDir = path.join(tmpRoot, "projects", "Christmas 2026");
  fs.mkdirSync(projectDir, { recursive: true });
  const projectFilePath = path.join(projectDir, "Christmas 2026.xdproj");
  fs.writeFileSync(projectFilePath, JSON.stringify({ name: "Christmas 2026" }, null, 2), "utf8");

  const mediaFilePath = path.join(tmpRoot, "media", "Song.mp3");
  fs.mkdirSync(path.dirname(mediaFilePath), { recursive: true });
  fs.writeFileSync(mediaFilePath, "fake-audio", "utf8");

  const artifact = buildAnalysisArtifactFromPipelineResult({
    audioPath: mediaFilePath,
    result: partialPipelineResult(),
    requestedProvider: "auto",
    generatedAt: "2026-03-12T12:00:00.000Z"
  });

  writeAnalysisArtifactToProject({ projectFilePath, mediaFilePath, artifact });
  const readRes = readAnalysisArtifactFromProject({ projectFilePath, mediaFilePath });

  assert.equal(readRes.ok, true);
  assert.equal(readRes.artifact.diagnostics.degraded, true);
  assert.equal(readRes.artifact.capabilities.timing.available, true);
  assert.equal(readRes.artifact.capabilities.lyrics.available, false);
  assert.equal(readRes.artifact.capabilities.structure.available, false);
  assert.equal(readRes.artifact.lyrics.lines.length, 0);
  assert.equal(readRes.artifact.structure.sections.length, 0);
  assert.ok(readRes.artifact.diagnostics.warnings.some((row) => row.includes("no synced lyrics")));
});
