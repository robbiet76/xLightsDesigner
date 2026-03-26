import test from "node:test";
import assert from "node:assert/strict";

import {
  ANALYSIS_MODULE_VERSIONS,
  AUDIO_ANALYST_ARTIFACT_TYPE,
  AUDIO_ANALYST_ARTIFACT_VERSION,
  buildAnalysisArtifactFromPipelineResult,
  buildAnalysisHandoffFromArtifact,
  buildAudioAnalystInput,
  executeAudioAnalystFlow,
  inspectAnalysisArtifactFreshness
} from "../../../agent/audio-analyst/audio-analyst-runtime.js";
import {
  AUDIO_ANALYST_ROLE,
  validateAudioAnalystContractGate,
  classifyAudioAnalysisFailureReason
} from "../../../agent/audio-analyst/audio-analyst-contracts.js";

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
        identityRecommendation: {
          available: true,
          title: "Song",
          artist: "Artist",
          provider: "embedded-metadata",
          recommendedFileName: "Artist - Song.mp3",
          currentFileName: "Song.mp3",
          shouldRename: true
        },
        sourceMetadata: {
          fileName: "Song.mp3",
          embeddedTitle: "Old Song",
          embeddedArtist: "Artist",
          embeddedAlbum: "Old Album",
          embeddedReleaseDate: "2020"
        },
        metadataRecommendation: {
          available: true,
          shouldRetag: true,
          current: {
            title: "Old Song",
            artist: "Artist",
            album: "Old Album"
          },
          recommended: {
            title: "Song",
            artist: "Artist",
            album: "Album"
          }
        },
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
  assert.equal(artifact.modules.identity.data.title, "Song");
  assert.equal(artifact.modules.identity.data.recommendation.recommendedFileName, "Artist - Song.mp3");
  assert.equal(artifact.modules.identity.data.metadataRecommendation.shouldRetag, true);
  assert.equal(artifact.modules.identity.data.sourceMetadata.embeddedTitle, "Old Song");
  assert.equal(artifact.modules.rhythm.data.bars.length, 1);
  assert.equal(artifact.modules.harmony.data.chords.length, 1);
  assert.equal(artifact.modules.lyrics.data.lines.length, 1);
  assert.equal(artifact.modules.structureBackbone.data.segments.length, 1);
  assert.equal(artifact.modules.semanticStructure.data.sections.length, 1);
});

test("audio analyst runtime preserves lyric retry provenance", () => {
  const result = samplePipelineResult();
  result.raw.meta.lyricsSource = "lrclib+genius-lrclib-retry";
  result.raw.meta.lyricsProviderResults = {
    selectedProvider: "lrclib+genius-lrclib-retry",
    providers: {
      "lrclib+genius-lrclib-retry": {
        provider: "lrclib+genius-lrclib-retry",
        available: true,
        selected: true,
        lineCount: 1,
        lyricsRetrySource: "genius-lrclib-retry",
        lyricsRetryMatchedArtist: "Michael Buble",
        lyricsRetryMatchedTitle: "It's Beginning to Look a Lot Like Christmas",
        lines: [{ startMs: 300, endMs: 900, label: "hello" }]
      }
    }
  };
  const artifact = buildAnalysisArtifactFromPipelineResult({
    audioPath: "/tmp/Song.mp3",
    mediaId: "media-123",
    result,
    requestedProvider: "auto",
    analysisBaseUrl: "http://127.0.0.1:5055",
    generatedAt: "2026-03-12T12:00:00.000Z"
  });

  assert.equal(artifact.lyrics.source, "lrclib+genius-lrclib-retry");
  assert.equal(artifact.modules.lyrics.metadata.moduleVersion, "v4");
  assert.equal(
    artifact.modules.lyrics.data.providerResults.providers["lrclib+genius-lrclib-retry"].lyricsRetryMatchedArtist,
    "Michael Buble"
  );
});

test("audio analyst runtime preserves experimental plain lyric phrase fallback", () => {
  const result = samplePipelineResult();
  result.details.timing.hasLyricsTrack = false;
  result.raw.lyrics = [];
  result.raw.meta.lyricsSource = "none";
  result.raw.meta.plainLyricsPhraseFallback = {
    available: true,
    provider: "lyricsgenius",
    lineCount: 2,
    phraseCount: 1,
    lines: ["Christmas vacation", "we've got a little change in plans"],
    phrases: [
      {
        startMs: 1000,
        endMs: 4000,
        label: "Christmas vacation / we've got a little change in plans",
        sectionLabel: "Theme 1",
        snappedStartMs: 1000,
        snappedEndMs: 4000
      }
    ],
    geniusMatchedTitle: "Christmas Vacation",
    geniusMatchedArtist: "Mavis Staples",
    geniusTitleSimilarity: 1.0
  };
  result.raw.meta.lyricsProviderResults = {
    selectedProvider: "none",
    providers: {
      none: {
        provider: "none",
        available: false,
        selected: true,
        lineCount: 0,
        lines: []
      },
      lyricsgenius: {
        provider: "lyricsgenius",
        available: true,
        selected: false,
        lineCount: 2,
        phraseCount: 1,
        lines: ["Christmas vacation", "we've got a little change in plans"],
        phrases: [
          {
            startMs: 1000,
            endMs: 4000,
            label: "Christmas vacation / we've got a little change in plans",
            sectionLabel: "Theme 1",
            snappedStartMs: 1000,
            snappedEndMs: 4000
          }
        ]
      }
    }
  };

  const artifact = buildAnalysisArtifactFromPipelineResult({
    audioPath: "/tmp/Christmas Vacation.mp3",
    mediaId: "media-plain-fallback",
    result
  });
  const handoff = buildAnalysisHandoffFromArtifact(artifact);

  assert.equal(artifact.lyrics.hasSyncedLyrics, false);
  assert.equal(artifact.lyrics.plainPhraseFallback.available, true);
  assert.equal(artifact.lyrics.plainPhraseFallback.phraseCount, 1);
  assert.equal(artifact.modules.lyrics.data.plainPhraseFallback.matchedArtist, "Mavis Staples");
  assert.equal(artifact.modules.lyrics.data.providerResults.providers.lyricsgenius.provider, "lyricsgenius");
  assert.equal(handoff.lyrics.hasPlainPhraseFallback, true);
  assert.equal(handoff.lyrics.phraseArtifact, "plain-lyrics-phrases");
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
  assert.equal(handoff.trackIdentity.recommendation.recommendedFileName, "Artist - Song.mp3");
  assert.equal(handoff.trackIdentity.recommendation.shouldRename, true);
  assert.equal(handoff.trackIdentity.metadataRecommendation.shouldRetag, true);
  assert.equal(handoff.trackIdentity.metadataRecommendation.current.title, "Old Song");
  assert.equal(handoff.trackIdentity.metadataRecommendation.recommended.album, "Album");
  assert.equal(handoff.timing.bpm, 128);
  assert.equal(handoff.timing.beatsArtifact, "beats");
  assert.equal(handoff.structure.sections.length, 1);
  assert.equal(handoff.lyrics.hasSyncedLyrics, true);
  assert.equal(handoff.chords.hasChords, true);
  assert.equal(handoff.briefSeed.mood, "bright");
  assert.equal(handoff.evidence.sources.length, 1);
});

test("audio analyst runtime classifies extended section taxonomy labels", () => {
  const pipeline = samplePipelineResult();
  pipeline.raw.sections = [
    { startMs: 0, endMs: 10000, label: "Intro" },
    { startMs: 10000, endMs: 18000, label: "Lift" },
    { startMs: 18000, endMs: 26000, label: "Post-Chorus" },
    { startMs: 26000, endMs: 34000, label: "Interlude" },
    { startMs: 34000, endMs: 42000, label: "Drop" },
    { startMs: 42000, endMs: 50000, label: "Rap Section" },
    { startMs: 50000, endMs: 58000, label: "Middle 8" },
    { startMs: 58000, endMs: 66000, label: "Tag" },
    { startMs: 66000, endMs: 74000, label: "Ad Lib" }
  ];

  const artifact = buildAnalysisArtifactFromPipelineResult({
    audioPath: "/tmp/Song.mp3",
    mediaId: "media-extended-sections",
    result: pipeline
  });
  const handoff = buildAnalysisHandoffFromArtifact(artifact);

  assert.deepEqual(
    artifact.structure.sections.map((row) => row.sectionType),
    ["intro", "pre_chorus", "post_chorus", "interlude", "drop", "rap", "middle_8", "tag", "ad_lib"]
  );
  assert.deepEqual(
    handoff.structure.sections.map((row) => row.sectionType),
    ["intro", "pre_chorus", "post_chorus", "interlude", "drop", "rap", "middle_8", "tag", "ad_lib"]
  );
  assert.equal(artifact.structure.sections[1].label, "Lift");
  assert.equal(artifact.structure.sections[6].label, "Middle 8");
  assert.equal(artifact.structure.sections[8].label, "Ad Lib");
});

test("audio analyst runtime preserves generic section labels without fabricated semantics", () => {
  const pipeline = samplePipelineResult();
  pipeline.raw.sections = [
    { startMs: 0, endMs: 10000, label: "Section 1" },
    { startMs: 10000, endMs: 20000, label: "Section 2" },
    { startMs: 20000, endMs: 30000, label: "Section 3" },
    { startMs: 30000, endMs: 40000, label: "Section 4" },
    { startMs: 40000, endMs: 50000, label: "Section 5" },
    { startMs: 50000, endMs: 60000, label: "Section 6" }
  ];

  const artifact = buildAnalysisArtifactFromPipelineResult({
    audioPath: "/tmp/Song.mp3",
    mediaId: "media-fallback-sections",
    result: pipeline
  });

  assert.deepEqual(
    artifact.structure.sections.map((row) => row.label),
    ["Section 1", "Section 2", "Section 3", "Section 4", "Section 5", "Section 6"]
  );
  assert.deepEqual(
    artifact.structure.sections.map((row) => row.sectionType),
    ["section", "section", "section", "section", "section", "section"]
  );
  const handoff = buildAnalysisHandoffFromArtifact(artifact);
  assert.deepEqual(handoff.structure.sections, []);
  assert.equal(artifact.modules.structureBackbone.data.segments.length, 6);
  assert.equal(artifact.modules.semanticStructure.data.sections.length, 0);
});

test("audio analyst freshness inspector accepts current deep artifact", () => {
  const artifact = buildAnalysisArtifactFromPipelineResult({
    audioPath: "/tmp/Song.mp3",
    mediaId: "media-123",
    result: samplePipelineResult(),
    analysisProfile: { mode: "deep" }
  });

  const inspection = inspectAnalysisArtifactFreshness(artifact, { preferredProfileMode: "deep" });
  assert.equal(inspection.ok, true);
  assert.equal(inspection.expectedProfileMode, "deep");
  assert.equal(inspection.reasons.length, 0);
});

test("audio analyst freshness inspector rejects mismatched module version and profile", () => {
  const artifact = buildAnalysisArtifactFromPipelineResult({
    audioPath: "/tmp/Song.mp3",
    mediaId: "media-123",
    result: samplePipelineResult(),
    analysisProfile: { mode: "fast" }
  });
  artifact.modules.rhythm.metadata.moduleVersion = "v0";

  const inspection = inspectAnalysisArtifactFreshness(artifact, {
    preferredProfileMode: "deep",
    requiredModules: ["rhythm", "lyrics"]
  });
  assert.equal(inspection.ok, false);
  assert.ok(inspection.reasons.includes("artifact_profile_mismatch:fast!=deep"));
  assert.ok(inspection.reasons.includes(`module_version_mismatch:rhythm:v0!=${ANALYSIS_MODULE_VERSIONS.rhythm}`));
});

test("audio analyst input gate blocks sequence-aware payloads", () => {
  const input = buildAudioAnalystInput({
    requestId: "audio-1",
    mediaFilePath: "/tmp/Song.mp3",
    projectFilePath: "/tmp/Test/Test.xdproj",
    service: {
      baseUrl: "http://127.0.0.1:5055",
      provider: "auto"
    }
  });
  input.context.sequenceRevision = "rev-1";

  const gate = validateAudioAnalystContractGate("input", input, "audio-1");
  assert.equal(gate.ok, false);
  assert.equal(gate.report.stage, "input_contract");
  assert.ok(gate.report.errors.some((row) => String(row).includes("context.sequenceRevision is not allowed")));
});

test("audio analyst input builder emits canonical agent role and service shape", () => {
  const input = buildAudioAnalystInput({
    requestId: "audio-2",
    mediaFilePath: "/tmp/Song.mp3",
    mediaRootPath: "/tmp/media",
    projectFilePath: "/tmp/project/Test.xdproj",
    service: {
      baseUrl: "http://127.0.0.1:5055/",
      provider: "beatnet",
      apiKey: "secret"
    }
  });

  assert.equal(input.agentRole, AUDIO_ANALYST_ROLE);
  assert.equal(input.context.media.path, "/tmp/Song.mp3");
  assert.equal(input.context.project.mediaRootPath, "/tmp/media");
  assert.equal(input.context.service.provider, "librosa");
  assert.equal(input.context.service.apiKeyPresent, true);
});

test("audio analyst flow returns canonical artifact and handoff", async () => {
  const input = buildAudioAnalystInput({
    requestId: "audio-3",
    mediaFilePath: "/tmp/Song.mp3",
    projectFilePath: "/tmp/project/Test.xdproj",
    service: {
      baseUrl: "http://127.0.0.1:5055",
      provider: "auto"
    }
  });

  const out = await executeAudioAnalystFlow({
    input,
    runPipeline: async () => samplePipelineResult(),
    persistArtifact: async ({ artifact }) => ({
      ok: true,
      artifact: {
        ...artifact,
        media: {
          ...artifact.media,
          mediaId: "persisted-media-1"
        }
      }
    }),
    creativeBrief: {
      mood: "bright"
    },
    generatedAt: "2026-03-12T12:00:00.000Z"
  });

  assert.equal(out.ok, true);
  assert.equal(out.result.status, "ok");
  assert.equal(out.artifact.media.mediaId, "persisted-media-1");
  assert.equal(out.handoff.trackIdentity.title, "Song");
  assert.equal(out.gate.ok, true);
});

test("audio analyst flow classifies degraded artifact as partial", async () => {
  const input = buildAudioAnalystInput({
    requestId: "audio-4",
    mediaFilePath: "/tmp/Song.mp3",
    service: {
      baseUrl: "http://127.0.0.1:5055",
      provider: "auto"
    }
  });
  const degraded = samplePipelineResult();
  degraded.pipeline.analysisServiceSucceeded = false;
  degraded.raw.lyrics = [];
  degraded.diagnostics.push("Analysis service returned no synced lyrics.");

  const out = await executeAudioAnalystFlow({
    input,
    runPipeline: async () => degraded,
    generatedAt: "2026-03-12T12:00:00.000Z"
  });

  assert.equal(out.ok, true);
  assert.equal(out.result.status, "partial");
  assert.equal(out.result.failureReason, "lyrics_unavailable");
});

test("audio analyst failure classification distinguishes provider and media failures", () => {
  assert.equal(classifyAudioAnalysisFailureReason("service_health", "analysis service unavailable"), "provider_unavailable");
  assert.equal(classifyAudioAnalysisFailureReason("media", "No audio track available"), "media_unreadable");
  assert.equal(classifyAudioAnalysisFailureReason("identity", "fingerprinted title+artist not available"), "identity_lookup_failed");
});
