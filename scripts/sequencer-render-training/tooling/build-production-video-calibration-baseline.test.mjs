import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildProductionVideoCalibrationBaseline } from "./build-production-video-calibration-baseline.mjs";

function writeFile(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text);
}

function writeJson(filePath, payload) {
  writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function writeReference(root, id, quality, motion) {
  const dir = path.join(root, id.toLowerCase());
  const reviewPath = path.join(dir, "render-review.json");
  const featuresPath = path.join(dir, "render-review-media", "frame-features.json");
  writeJson(reviewPath, {
    artifactType: "render_review_v1",
    qualityScores: {
      overallQuality: quality,
      intentMatch: 1,
      musicalFit: 0.9,
      visualReadability: 0.8,
      colorDiscipline: 0.7,
      motionCoherence: 0.85,
      transitionQuality: 0.75,
      clutterControl: 0.95
    },
    deterministicMetrics: {
      activeCoverageMean: 0.1 + motion,
      brightnessMean: 0.02,
      temporalMotionMean: motion,
      temporalMotionPeak: motion * 1.5,
      colorDiversityMean: 1,
      clutterRisk: 0
    },
    calibrationPolicy: {
      trainSequencingPolicy: false,
      copyStylisticPatterns: false
    }
  });
  writeJson(featuresPath, {
    artifactType: "render_review_frame_features_v1",
    mediaDurationSeconds: 120,
    sampleFps: 0.2,
    sampledFrameCount: 24,
    nonBlankSampledFrameRatio: 1,
    activeSampledFrameSpanRatio: 1,
    temporalPixelDeltaMean: motion,
    temporalMotionMean: motion,
    temporalMotionPeak: motion * 1.5,
    representativeSampledFrameAverageBrightness: 0.03,
    representativeSampledFrameActivePixelRatio: 0.1,
    representativeSampledFrameUniqueColorCount: 32,
    representativeSampledFrameActiveUniqueColorCount: 8,
    meanSampledFrameActiveUniqueColorCount: 7,
    meanSampledFrameActiveColorClassCount: 4,
    temporalSignature: "moderate_motion"
  });
  return { reviewPath, featuresPath };
}

test("production video calibration baseline summarizes accepted production reads", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-production-video-baseline-"));
  const first = writeReference(root, "First", 0.86, 0.04);
  const second = writeReference(root, "Second", 0.9, 0.08);
  const summaryPath = path.join(root, "production-sequence-video-read-summary.json");
  const outPath = path.join(root, "baseline.json");
  writeJson(summaryPath, {
    artifactType: "production_sequence_video_read_run_v1",
    rows: [
      {
        sequenceId: "First",
        status: "reviewed",
        decision: "accept",
        overallQuality: 0.86,
        videoPath: path.join(root, "videos", "first.mp4"),
        contactSheetPath: path.join(root, "first", "contact-sheet.jpg"),
        renderReviewPath: first.reviewPath,
        frameFeaturesPath: first.featuresPath
      },
      {
        sequenceId: "Second",
        status: "reviewed",
        decision: "accept",
        overallQuality: 0.9,
        videoPath: path.join(root, "videos", "second.mp4"),
        contactSheetPath: path.join(root, "second", "contact-sheet.jpg"),
        renderReviewPath: second.reviewPath,
        frameFeaturesPath: second.featuresPath
      },
      {
        sequenceId: "Empty",
        status: "invalid_source_sequence",
        decision: "invalid_source_sequence",
        invalidReasonCode: "NO_EDITABLE_EFFECTS",
        invalidReason: "No named effects."
      }
    ]
  });

  const artifact = buildProductionVideoCalibrationBaseline({ summaryPath, outPath });

  assert.equal(artifact.artifactType, "production_video_calibration_baseline_v1");
  assert.equal(artifact.readOnly, true);
  assert.equal(artifact.metricScope, "full_sequence_render");
  assert.equal(artifact.promotionUse, "calibration_reference_only");
  assert.equal(artifact.promotionPolicy.trainSequencingPolicy, false);
  assert.equal(artifact.promotionPolicy.copyStylisticPatterns, false);
  assert.equal(artifact.summary.acceptedReferenceCount, 2);
  assert.equal(artifact.summary.invalidOrRejectedCount, 1);
  assert.equal(artifact.scoreRanges.overallQuality.min, 0.86);
  assert.equal(artifact.scoreRanges.overallQuality.max, 0.9);
  assert.equal(artifact.metricRanges.temporalMotionMean.mean, 0.06);
  assert.equal(artifact.featureRanges.sampledFrameCount.mean, 24);
  assert.deepEqual(artifact.references.map((row) => row.sequenceId), ["First", "Second"]);
  assert.equal(artifact.excludedReferences[0].invalidReasonCode, "NO_EDITABLE_EFFECTS");
  assert.equal(fs.existsSync(outPath), true);
});
