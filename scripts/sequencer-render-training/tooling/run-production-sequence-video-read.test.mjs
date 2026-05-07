import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { runProductionSequenceVideoRead } from "./run-production-sequence-video-read.mjs";

function writeFile(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text);
}

function writeJson(filePath, payload) {
  writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`);
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

test("runProductionSequenceVideoRead exports video, extracts compact features, and writes full sequence review", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-production-video-read-"));
  const sequenceDir = path.join(root, "Show", "Song");
  const xsqPath = path.join(sequenceDir, "Song.xsq");
  const manifestPath = path.join(root, "manifest.json");
  const outDir = path.join(root, "out");
  writeFile(xsqPath, "<xsequence/>");
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
  assert.equal(exportCalls[0].apiMode, "owned");
  assert.equal(exportCalls[0].sequence, xsqPath);
  const review = JSON.parse(fs.readFileSync(summary.rows[0].renderReviewPath, "utf8"));
  assert.equal(review.artifactType, "render_review_v1");
  assert.equal(review.section.id, "full_sequence");
  assert.equal(review.calibrationPolicy.trainSequencingPolicy, false);
  assert.equal(review.calibrationPolicy.copyStylisticPatterns, false);
});

test("runProductionSequenceVideoRead can reuse an existing video without exporting", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-production-video-read-existing-"));
  const sequenceDir = path.join(root, "Show", "Song");
  const xsqPath = path.join(sequenceDir, "Song.xsq");
  const outDir = path.join(root, "out");
  const manifestPath = path.join(root, "manifest.json");
  writeFile(xsqPath, "<xsequence/>");
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
  writeFile(firstXsq, "<xsequence/>");
  writeFile(secondXsq, "<xsequence/>");
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
