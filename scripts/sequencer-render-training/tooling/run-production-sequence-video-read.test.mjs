import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { derivePreviewVideoSize, runProductionSequenceVideoRead } from "./run-production-sequence-video-read.mjs";

function writeFile(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text);
}

function writeJson(filePath, payload) {
  writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function editableSequenceXml() {
  return `<xsequence><ElementEffects><Element type="model" name="Arch"><EffectLayer><Effect name="Bars" startTime="0" endTime="1000"/></EffectLayer></Element></ElementEffects></xsequence>`;
}

function frameFeatures(mediaPath, startMs = 0, endMs = 10000) {
  return {
    artifactType: "render_review_frame_features_v1",
    artifactVersion: "1.0",
    mediaPath,
    mediaWidth: 500,
    mediaHeight: 924,
    mediaDurationSeconds: (endMs - startMs) / 1000,
    analysisWindowStartMs: startMs,
    analysisWindowEndMs: endMs,
    analysisWindowDurationMs: endMs - startMs,
    requestedSampleCount: 4,
    sampleFps: 0.4,
    sampledFrameCount: 4,
    nonBlankSampledFrameCount: 4,
    nonBlankSampledFrameRatio: 1,
    temporalBrightnessDeltaMean: 0.02,
    temporalActiveDeltaMean: 0.015,
    temporalDominantDeltaMean: 0.01,
    temporalUniqueColorDeltaMean: 3,
    temporalColorDeltaMean: 0.05,
    temporalMotionMean: 0.045,
    temporalPixelDeltaMean: 0.04,
    temporalMotionPeak: 0.08,
    temporalSignature: "moderate_motion",
    representativeSampledFrameIndex: 1,
    representativeSampledFrameAverageBrightness: 0.18,
    representativeSampledFrameActivePixelRatio: 0.22,
    representativeSampledFrameDominantPixelRatio: 0.03,
    representativeSampledFrameUniqueColorCount: 48,
    representativeSampledFrameActiveUniqueColorCount: 8,
    representativeSampledFrameActiveColorClassCount: 4,
    meanSampledFrameActiveUniqueColorCount: 7,
    meanSampledFrameActiveColorClassCount: 4,
    representativeSampledFrameAverageRgb: { r: 0.4, g: 0.2, b: 0.1 },
    sampledFrameMetrics: [
      { frameIndex: 0, frameAverageBrightness: 0.12, frameActivePixelRatio: 0.16, frameDominantPixelRatio: 0.01, frameUniqueColorCount: 32, frameActiveUniqueColorCount: 6, frameActiveColorClassCount: 3, frameAverageRgb: { r: 0.3, g: 0.15, b: 0.1 } },
      { frameIndex: 1, frameAverageBrightness: 0.18, frameActivePixelRatio: 0.22, frameDominantPixelRatio: 0.03, frameUniqueColorCount: 48, frameActiveUniqueColorCount: 8, frameActiveColorClassCount: 4, frameAverageRgb: { r: 0.4, g: 0.2, b: 0.1 } },
      { frameIndex: 2, frameAverageBrightness: 0.2, frameActivePixelRatio: 0.2, frameDominantPixelRatio: 0.02, frameUniqueColorCount: 44, frameActiveUniqueColorCount: 7, frameActiveColorClassCount: 4, frameAverageRgb: { r: 0.25, g: 0.25, b: 0.28 } },
      { frameIndex: 3, frameAverageBrightness: 0.16, frameActivePixelRatio: 0.18, frameDominantPixelRatio: 0.02, frameUniqueColorCount: 40, frameActiveUniqueColorCount: 7, frameActiveColorClassCount: 4, frameAverageRgb: { r: 0.1, g: 0.25, b: 0.35 } }
    ],
    sampledFrameTransitions: [
      { fromFrameIndex: 0, toFrameIndex: 1, brightnessDelta: 0.06, activeDelta: 0.06, dominantDelta: 0.02, uniqueColorDelta: 16, colorDelta: 0.08, combinedDelta: 0.07 },
      { fromFrameIndex: 1, toFrameIndex: 2, brightnessDelta: 0.02, activeDelta: 0.02, dominantDelta: 0.01, uniqueColorDelta: 4, colorDelta: 0.09, combinedDelta: 0.05 },
      { fromFrameIndex: 2, toFrameIndex: 3, brightnessDelta: 0.04, activeDelta: 0.02, dominantDelta: 0, uniqueColorDelta: 4, colorDelta: 0.1, combinedDelta: 0.06 }
    ]
  };
}

function staticFrameFeatures(mediaPath) {
  const features = frameFeatures(mediaPath, 0, 120000);
  return {
    ...features,
    mediaDurationSeconds: 120,
    sampledFrameCount: 4,
    nonBlankSampledFrameCount: 4,
    nonBlankSampledFrameRatio: 1,
    temporalMotionMean: 0,
    temporalPixelDeltaMean: 0,
    temporalSignature: "static_or_near_static",
    sampledFrameMetrics: features.sampledFrameMetrics.map((row) => ({
      ...row,
      frameAverageBrightness: 0.1,
      frameActivePixelRatio: 0.2,
      framePixelDeltaFromPrevious: 0
    })),
    sampledFrameTransitions: features.sampledFrameTransitions.map((row) => ({
      ...row,
      brightnessDelta: 0,
      activeDelta: 0,
      dominantDelta: 0,
      uniqueColorDelta: 0,
      colorDelta: 0,
      pixelDelta: 0,
      combinedDelta: 0
    }))
  };
}

test("runProductionSequenceVideoRead exports video, extracts compact features, and writes full sequence review", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-production-video-read-"));
  const sequenceDir = path.join(root, "Show", "Song");
  const xsqPath = path.join(sequenceDir, "Song.xsq");
  const manifestPath = path.join(root, "manifest.json");
  const outDir = path.join(root, "out");
  writeFile(xsqPath, editableSequenceXml());
  writeJson(manifestPath, {
    artifactType: "production_sequence_read_benchmark_manifest_v1",
    artifactVersion: 1,
    readOnly: true,
    sequences: [{
      sequenceId: "Song",
      folderName: "Song",
      folderPath: sequenceDir,
      readOnly: true,
      benchmarkUse: "production_sequence_read_calibration",
      expectedEvidenceScope: "full_sequence_render",
      xsq: { path: xsqPath },
      readGoals: ["whole_display_energy_arc", "color_story"],
      styleTags: ["production_reference"],
      initialAuditSubset: true
    }]
  });

  const exportCalls = [];
  const summary = await runProductionSequenceVideoRead({
    manifestPath,
    outDir,
    maxSequences: 1,
    deps: {
      exportVideo: async (options) => {
        exportCalls.push(options);
        writeFile(options.out, "mp4");
        writeJson(options.artifact, { source: { apiMode: "owned" }, output: { videoPath: options.out } });
        return { source: { apiMode: "owned" } };
      },
      getLayoutSettings: async () => ({ previewWidth: 1000, previewHeight: 462 }),
      extractMedia: ({ mediaPath, frameFeaturesOut, contactSheetOut, sampleCount, keepFrames }) => {
        writeJson(frameFeaturesOut, frameFeatures(mediaPath));
        writeFile(contactSheetOut, "jpg");
        return {
          sampledFrameCount: sampleCount,
          nonBlankSampledFrameRatio: 1,
          temporalMotionMean: 0.045,
          framesDir: keepFrames ? path.join(path.dirname(frameFeaturesOut), "frames") : ""
        };
      }
    }
  });

  assert.equal(summary.artifactType, "production_sequence_video_read_run_v1");
  assert.equal(summary.sequenceCount, 1);
  assert.equal(summary.rows[0].sequenceId, "Song");
  assert.equal(summary.rows[0].exportMode, "owned");
  assert.deepEqual(summary.requestedVideoSize, {
    width: 2000,
    height: 924,
    source: "layout_preview_canvas",
    previewWidth: 1000,
    previewHeight: 462
  });
  assert.equal(exportCalls[0].apiMode, "owned");
  assert.equal(exportCalls[0].sequence, xsqPath);
  assert.equal(exportCalls[0].width, 2000);
  assert.equal(exportCalls[0].height, 924);
  const review = JSON.parse(fs.readFileSync(summary.rows[0].renderReviewPath, "utf8"));
  assert.equal(review.artifactType, "render_review_v1");
  assert.equal(review.section.id, "full_sequence");
  assert.equal(review.calibrationPolicy.trainSequencingPolicy, false);
  assert.equal(review.calibrationPolicy.copyStylisticPatterns, false);
});

test("derivePreviewVideoSize follows the layout preview aspect ratio", () => {
  assert.deepEqual(derivePreviewVideoSize({
    previewWidth: 1000,
    previewHeight: 462,
    longSide: 2000
  }), {
    width: 2000,
    height: 924,
    source: "layout_preview_canvas",
    previewWidth: 1000,
    previewHeight: 462
  });
  assert.deepEqual(derivePreviewVideoSize({
    previewWidth: 720,
    previewHeight: 1280,
    longSide: 2000
  }), {
    width: 1126,
    height: 2000,
    source: "layout_preview_canvas",
    previewWidth: 720,
    previewHeight: 1280
  });
});

test("runProductionSequenceVideoRead can reuse an existing video without exporting", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-production-video-read-existing-"));
  const sequenceDir = path.join(root, "Show", "Song");
  const xsqPath = path.join(sequenceDir, "Song.xsq");
  const outDir = path.join(root, "out");
  const manifestPath = path.join(root, "manifest.json");
  writeFile(xsqPath, editableSequenceXml());
  writeFile(path.join(outDir, "videos", "song.mp4"), "mp4");
  writeJson(manifestPath, {
    artifactType: "production_sequence_read_benchmark_manifest_v1",
    artifactVersion: 1,
    readOnly: true,
    sequences: [{
      sequenceId: "Song",
      readOnly: true,
      benchmarkUse: "production_sequence_read_calibration",
      xsq: { path: xsqPath },
      readGoals: [],
      initialAuditSubset: true
    }]
  });

  const summary = await runProductionSequenceVideoRead({
    manifestPath,
    outDir,
    skipExport: true,
    deps: {
      exportVideo: async () => {
        throw new Error("export should not be called");
      },
      extractMedia: ({ mediaPath, frameFeaturesOut, contactSheetOut }) => {
        writeJson(frameFeaturesOut, frameFeatures(mediaPath));
        writeFile(contactSheetOut, "jpg");
        return { sampledFrameCount: 4, nonBlankSampledFrameRatio: 1, temporalMotionMean: 0.045 };
      }
    }
  });

  assert.equal(summary.rows[0].exportMode, "existing_video");
  assert.equal(summary.rows[0].videoPath, path.join(outDir, "videos", "song.mp4"));
});

test("runProductionSequenceVideoRead reuses existing videos and exports missing videos", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-production-video-read-reuse-mixed-"));
  const showDir = path.join(root, "Show");
  const outDir = path.join(root, "out");
  const manifestPath = path.join(root, "manifest.json");
  const firstXsq = path.join(showDir, "First", "First.xsq");
  const secondXsq = path.join(showDir, "Second", "Second.xsq");
  writeFile(firstXsq, editableSequenceXml());
  writeFile(secondXsq, editableSequenceXml());
  writeFile(path.join(outDir, "videos", "first.mp4"), "mp4");
  writeJson(manifestPath, {
    artifactType: "production_sequence_read_benchmark_manifest_v1",
    artifactVersion: 1,
    readOnly: true,
    sequences: [
      { sequenceId: "First", readOnly: true, benchmarkUse: "production_sequence_read_calibration", xsq: { path: firstXsq }, readGoals: [] },
      { sequenceId: "Second", readOnly: true, benchmarkUse: "production_sequence_read_calibration", xsq: { path: secondXsq }, readGoals: [] }
    ]
  });

  const exportCalls = [];
  const summary = await runProductionSequenceVideoRead({
    manifestPath,
    outDir,
    reuseExistingVideos: true,
    deps: {
      exportVideo: async (options) => {
        exportCalls.push(options.sequence);
        writeFile(options.out, "mp4");
        writeJson(options.artifact, { source: { apiMode: "owned" } });
        return { source: { apiMode: "owned" } };
      },
      extractMedia: ({ mediaPath, frameFeaturesOut, contactSheetOut }) => {
        writeJson(frameFeaturesOut, frameFeatures(mediaPath));
        writeFile(contactSheetOut, "jpg");
        return { sampledFrameCount: 4, nonBlankSampledFrameRatio: 1, temporalMotionMean: 0.045 };
      }
    }
  });

  assert.deepEqual(exportCalls, [secondXsq]);
  assert.equal(summary.rows[0].exportMode, "existing_video");
  assert.equal(summary.rows[1].exportMode, "owned");
});

test("runProductionSequenceVideoRead marks static full-sequence preview video as invalid export", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-production-video-read-static-"));
  const sequenceDir = path.join(root, "Show", "StaticSong");
  const xsqPath = path.join(sequenceDir, "StaticSong.xsq");
  const outDir = path.join(root, "out");
  const manifestPath = path.join(root, "manifest.json");
  writeFile(xsqPath, editableSequenceXml());
  writeFile(path.join(outDir, "videos", "staticsong.mp4"), "mp4");
  writeJson(manifestPath, {
    artifactType: "production_sequence_read_benchmark_manifest_v1",
    artifactVersion: 1,
    readOnly: true,
    sequences: [{
      sequenceId: "StaticSong",
      readOnly: true,
      benchmarkUse: "production_sequence_read_calibration",
      xsq: { path: xsqPath },
      readGoals: []
    }]
  });

  const summary = await runProductionSequenceVideoRead({
    manifestPath,
    outDir,
    skipExport: true,
    deps: {
      extractMedia: ({ mediaPath, frameFeaturesOut, contactSheetOut }) => {
        writeJson(frameFeaturesOut, staticFrameFeatures(mediaPath));
        writeFile(contactSheetOut, "jpg");
        return { sampledFrameCount: 4, nonBlankSampledFrameRatio: 1, temporalMotionMean: 0 };
      }
    }
  });

  assert.equal(summary.rows[0].status, "invalid_export");
  assert.equal(summary.rows[0].invalidReasonCode, "STATIC_PREVIEW_VIDEO");
  assert.equal(summary.rows[0].renderReviewPath, "");
  assert.equal(summary.rows[0].overallQuality, null);
  assert.equal(summary.rows[0].decision, "invalid_export");
});

test("runProductionSequenceVideoRead rejects source xsq files with no editable effects before export", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-production-video-read-empty-source-"));
  const sequenceDir = path.join(root, "Show", "EmptySong");
  const xsqPath = path.join(sequenceDir, "EmptySong.xsq");
  const manifestPath = path.join(root, "manifest.json");
  writeFile(xsqPath, "<xsequence><ElementEffects></ElementEffects></xsequence>");
  writeJson(manifestPath, {
    artifactType: "production_sequence_read_benchmark_manifest_v1",
    artifactVersion: 1,
    readOnly: true,
    sequences: [{
      sequenceId: "EmptySong",
      readOnly: true,
      benchmarkUse: "production_sequence_read_calibration",
      xsq: { path: xsqPath },
      readGoals: []
    }]
  });

  const summary = await runProductionSequenceVideoRead({
    manifestPath,
    outDir: path.join(root, "out"),
    deps: {
      exportVideo: async () => {
        throw new Error("export should not be called for empty source sequence");
      },
      extractMedia: () => {
        throw new Error("media extraction should not run for empty source sequence");
      }
    }
  });

  assert.equal(summary.rows[0].status, "invalid_source_sequence");
  assert.equal(summary.rows[0].invalidReasonCode, "NO_EDITABLE_EFFECTS");
  assert.equal(summary.rows[0].sourceSequence.namedEffectCount, 0);
  assert.equal(summary.rows[0].exportMode, "not_exported");
});

test("runProductionSequenceVideoRead records per-sequence export failures and continues", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-production-video-read-failure-"));
  const showDir = path.join(root, "Show");
  const firstXsq = path.join(showDir, "First", "First.xsq");
  const secondXsq = path.join(showDir, "Second", "Second.xsq");
  const manifestPath = path.join(root, "manifest.json");
  writeFile(firstXsq, editableSequenceXml());
  writeFile(secondXsq, editableSequenceXml());
  writeJson(manifestPath, {
    artifactType: "production_sequence_read_benchmark_manifest_v1",
    artifactVersion: 1,
    readOnly: true,
    sequences: [
      { sequenceId: "First", readOnly: true, benchmarkUse: "production_sequence_read_calibration", xsq: { path: firstXsq }, readGoals: [] },
      { sequenceId: "Second", readOnly: true, benchmarkUse: "production_sequence_read_calibration", xsq: { path: secondXsq }, readGoals: [] }
    ]
  });

  const summary = await runProductionSequenceVideoRead({
    manifestPath,
    outDir: path.join(root, "out"),
    deps: {
      exportVideo: async ({ sequence, out, artifact }) => {
        if (sequence === firstXsq) throw new Error("render timeout");
        writeFile(out, "mp4");
        writeJson(artifact, { source: { apiMode: "owned" } });
        return { source: { apiMode: "owned" } };
      },
      extractMedia: ({ mediaPath, frameFeaturesOut, contactSheetOut }) => {
        writeJson(frameFeaturesOut, frameFeatures(mediaPath));
        writeFile(contactSheetOut, "jpg");
        return { sampledFrameCount: 4, nonBlankSampledFrameRatio: 1, temporalMotionMean: 0.045 };
      }
    }
  });

  assert.equal(summary.rows[0].status, "export_failed");
  assert.match(summary.rows[0].invalidReason, /render timeout/);
  assert.equal(summary.rows[1].status, "reviewed");
});

test("runProductionSequenceVideoRead can include and exclude sequences by id", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-production-video-read-filter-"));
  const showDir = path.join(root, "Show");
  const firstXsq = path.join(showDir, "First", "First.xsq");
  const secondXsq = path.join(showDir, "Second", "Second.xsq");
  const thirdXsq = path.join(showDir, "Third", "Third.xsq");
  const manifestPath = path.join(root, "manifest.json");
  writeFile(firstXsq, editableSequenceXml());
  writeFile(secondXsq, editableSequenceXml());
  writeFile(thirdXsq, editableSequenceXml());
  writeJson(manifestPath, {
    artifactType: "production_sequence_read_benchmark_manifest_v1",
    artifactVersion: 1,
    readOnly: true,
    sequences: [
      { sequenceId: "First", folderName: "First", readOnly: true, benchmarkUse: "production_sequence_read_calibration", xsq: { path: firstXsq }, readGoals: [] },
      { sequenceId: "Second", folderName: "Second", readOnly: true, benchmarkUse: "production_sequence_read_calibration", xsq: { path: secondXsq }, readGoals: [] },
      { sequenceId: "Third", folderName: "Third", readOnly: true, benchmarkUse: "production_sequence_read_calibration", xsq: { path: thirdXsq }, readGoals: [] }
    ]
  });

  const summary = await runProductionSequenceVideoRead({
    manifestPath,
    outDir: path.join(root, "out"),
    sequenceIds: ["First", "Second"],
    excludeSequenceIds: ["Second"],
    deps: {
      exportVideo: async ({ out, artifact }) => {
        writeFile(out, "mp4");
        writeJson(artifact, { source: { apiMode: "owned" } });
        return { source: { apiMode: "owned" } };
      },
      extractMedia: ({ mediaPath, frameFeaturesOut, contactSheetOut }) => {
        writeJson(frameFeaturesOut, frameFeatures(mediaPath));
        writeFile(contactSheetOut, "jpg");
        return { sampledFrameCount: 4, nonBlankSampledFrameRatio: 1, temporalMotionMean: 0.045 };
      }
    }
  });

  assert.deepEqual(summary.rows.map((row) => row.sequenceId), ["First"]);
});
