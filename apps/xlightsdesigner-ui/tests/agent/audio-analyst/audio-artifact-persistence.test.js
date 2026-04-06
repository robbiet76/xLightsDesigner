import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  buildAnalysisArtifactFromPipelineResult,
  buildAnalysisHandoffFromArtifact
} from "../../../agent/audio-analyst/audio-analyst-runtime.js";
import {
  buildAnalysisArtifactPaths,
  buildProfiledAnalysisArtifactPath,
  writeAnalysisArtifactToProject,
  readAnalysisArtifactFromProject
} from "../../../../xlightsdesigner-desktop/analysis-artifact-store.mjs";

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
          avgMarginConfidence: "0.83"
        },
        harmonyProviderResults: {
          selectedProvider: "analysis-service",
          providers: {
            "analysis-service": {
              provider: "analysis-service",
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

function withProfile(artifact, mode) {
  return {
    ...artifact,
    provenance: {
      ...(artifact?.provenance || {}),
      analysisProfile: { mode }
    }
  };
}

test("analysis artifact store persists canonical artifact under shared track library path", async (t) => {
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

  const expectedPaths = buildAnalysisArtifactPaths(projectFilePath, mediaFilePath, artifact);
  assert.equal(writeRes.mediaId, expectedPaths.mediaId);
  assert.equal(writeRes.artifactPath, expectedPaths.artifactPath);
  assert.match(path.basename(writeRes.artifactPath), /^song-artist(?:-[a-f0-9]{8})?\.json$/);
  assert.equal(path.dirname(writeRes.artifactPath), path.join(tmpRoot, "library", "tracks"));
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

  const writeRes = writeAnalysisArtifactToProject({
    projectFilePath,
    mediaFilePath,
    artifact
  });
  const expectedHandoff = buildAnalysisHandoffFromArtifact(writeRes.artifact, creativeBrief);
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
  assert.equal(readRes.artifact.modules.rhythm.data.beats.length, 1);
  assert.equal(readRes.artifact.modules.harmony.data.providerResults.providers["analysis-service"].chordCount, 1);
  assert.equal(readRes.artifact.modules.lyrics.data.providerResults.providers.lrclib.lineCount, 1);
  assert.equal(readRes.artifact.modules.lyrics.data.lines.length, 1);
  assert.equal(readRes.artifact.modules.structureBackbone.data.segments.length, 1);
  assert.equal(readRes.artifact.modules.semanticStructure.data.sections.length, 1);
  assert.equal(readRes.artifact.modules.rhythm.metadata.profileMode, "deep");
  assert.equal(readRes.artifact.modules.rhythm.data.providerResults.providers.beatnet.timeSignature, "4/4");
  assert.equal(readRes.artifact.modules.harmony.metadata.moduleVersion, "v2");
  assert.equal(readRes.artifact.modules.lyrics.metadata.moduleVersion, "v4");
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
  assert.equal(readRes.artifact.modules.rhythm.data.beats.length, 1);
  assert.equal(readRes.artifact.modules.lyrics.data.lines.length, 0);
  assert.equal(readRes.artifact.modules.semanticStructure.data.sections.length, 0);
  assert.equal(readRes.artifact.modules.semanticStructure.metadata.profileMode, "deep");
  assert.ok(readRes.artifact.diagnostics.warnings.some((row) => row.includes("no synced lyrics")));
});

test("analysis artifact store persists profile-specific fast and deep artifacts separately", async (t) => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "xld-audio-profiled-"));
  t.after(() => fs.rmSync(tmpRoot, { recursive: true, force: true }));

  const projectDir = path.join(tmpRoot, "projects", "Christmas 2026");
  fs.mkdirSync(projectDir, { recursive: true });
  const projectFilePath = path.join(projectDir, "Christmas 2026.xdproj");
  fs.writeFileSync(projectFilePath, JSON.stringify({ name: "Christmas 2026" }, null, 2), "utf8");

  const mediaFilePath = path.join(tmpRoot, "media", "Song.mp3");
  fs.mkdirSync(path.dirname(mediaFilePath), { recursive: true });
  fs.writeFileSync(mediaFilePath, "fake-audio", "utf8");

  const fastArtifact = withProfile(buildAnalysisArtifactFromPipelineResult({
    audioPath: mediaFilePath,
    result: partialPipelineResult(),
    requestedProvider: "auto",
    generatedAt: "2026-03-12T12:00:00.000Z"
  }), "fast");
  const deepArtifact = withProfile(buildAnalysisArtifactFromPipelineResult({
    audioPath: mediaFilePath,
    result: samplePipelineResult(),
    requestedProvider: "auto",
    generatedAt: "2026-03-12T12:05:00.000Z"
  }), "deep");

  const fastWrite = writeAnalysisArtifactToProject({ projectFilePath, mediaFilePath, artifact: fastArtifact });
  const deepWrite = writeAnalysisArtifactToProject({ projectFilePath, mediaFilePath, artifact: deepArtifact });
  const fastPath = buildProfiledAnalysisArtifactPath(projectFilePath, mediaFilePath, "fast", fastArtifact);
  const deepPath = buildProfiledAnalysisArtifactPath(projectFilePath, mediaFilePath, "deep", deepArtifact);

  assert.equal(fastWrite.ok, true);
  assert.equal(deepWrite.ok, true);
  assert.ok(fs.existsSync(fastPath.profileArtifactPath));
  assert.ok(fs.existsSync(deepPath.profileArtifactPath));

  const readDefault = readAnalysisArtifactFromProject({ projectFilePath, mediaFilePath });
  const readFast = readAnalysisArtifactFromProject({ projectFilePath, mediaFilePath, preferredProfileMode: "fast" });
  const readDeep = readAnalysisArtifactFromProject({ projectFilePath, mediaFilePath, preferredProfileMode: "deep" });

  assert.equal(readDefault.ok, true);
  assert.equal(readDefault.artifact.provenance.analysisProfile.mode, "deep");
  assert.equal(readDefault.artifact.modules.identity.metadata.profileMode, "deep");
  assert.equal(readFast.ok, true);
  assert.equal(readFast.artifact.provenance.analysisProfile.mode, "fast");
  assert.equal(readFast.artifact.modules.identity.metadata.profileMode, "fast");
  assert.equal(readDeep.ok, true);
  assert.equal(readDeep.artifact.provenance.analysisProfile.mode, "deep");
});

test("fast profile write does not replace existing deep canonical artifact", async (t) => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "xld-audio-profile-preserve-"));
  t.after(() => fs.rmSync(tmpRoot, { recursive: true, force: true }));

  const projectDir = path.join(tmpRoot, "projects", "Christmas 2026");
  fs.mkdirSync(projectDir, { recursive: true });
  const projectFilePath = path.join(projectDir, "Christmas 2026.xdproj");
  fs.writeFileSync(projectFilePath, JSON.stringify({ name: "Christmas 2026" }, null, 2), "utf8");

  const mediaFilePath = path.join(tmpRoot, "media", "Song.mp3");
  fs.mkdirSync(path.dirname(mediaFilePath), { recursive: true });
  fs.writeFileSync(mediaFilePath, "fake-audio", "utf8");

  const deepArtifact = withProfile(buildAnalysisArtifactFromPipelineResult({
    audioPath: mediaFilePath,
    result: samplePipelineResult(),
    requestedProvider: "auto",
    generatedAt: "2026-03-12T12:05:00.000Z"
  }), "deep");
  const fastArtifact = withProfile(buildAnalysisArtifactFromPipelineResult({
    audioPath: mediaFilePath,
    result: partialPipelineResult(),
    requestedProvider: "auto",
    generatedAt: "2026-03-12T12:10:00.000Z"
  }), "fast");

  writeAnalysisArtifactToProject({ projectFilePath, mediaFilePath, artifact: deepArtifact });
  writeAnalysisArtifactToProject({ projectFilePath, mediaFilePath, artifact: fastArtifact });

  const readDefault = readAnalysisArtifactFromProject({ projectFilePath, mediaFilePath });
  const readFast = readAnalysisArtifactFromProject({ projectFilePath, mediaFilePath, preferredProfileMode: "fast" });

  assert.equal(readDefault.ok, true);
  assert.equal(readDefault.artifact.provenance.analysisProfile.mode, "deep");
  assert.equal(readFast.ok, true);
  assert.equal(readFast.artifact.provenance.analysisProfile.mode, "fast");
});
