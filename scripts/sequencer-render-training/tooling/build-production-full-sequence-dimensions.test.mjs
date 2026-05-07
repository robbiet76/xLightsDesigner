import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildProductionFullSequenceDimensions } from "./build-production-full-sequence-dimensions.mjs";

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function frame(index, { brightness, active, colors, classes, delta = 0.004, rgb = {} }) {
  return {
    frameIndex: index,
    frameAverageBrightness: brightness,
    frameActivePixelRatio: active,
    frameDominantPixelRatio: 0.001,
    frameUniqueColorCount: colors * 40,
    frameActiveUniqueColorCount: colors,
    frameActiveColorClassCount: classes,
    framePixelDeltaFromPrevious: index === 0 ? 0 : delta,
    frameAverageRgb: {
      r: rgb.r ?? brightness,
      g: rgb.g ?? brightness,
      b: rgb.b ?? brightness
    }
  };
}

function transition(index, { brightnessDelta = 0.002, activeDelta = 0.004, colorDelta = 0.003, pixelDelta = 0.004, combinedDelta = 0.055 }) {
  return {
    fromFrameIndex: index,
    toFrameIndex: index + 1,
    brightnessDelta,
    activeDelta,
    dominantDelta: 0,
    uniqueColorDelta: 20,
    colorDelta,
    pixelDelta,
    combinedDelta
  };
}

test("production full sequence dimensions summarize sequence-window variation", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-production-dimensions-"));
  const featuresPath = path.join(root, "features.json");
  const baselinePath = path.join(root, "baseline.json");
  const outPath = path.join(root, "dimensions.json");
  const frames = Array.from({ length: 12 }, (_, index) => frame(index, {
    brightness: 0.01 + (index * 0.001),
    active: 0.08 + ((index % 6) * 0.008),
    colors: 20 + (index * 5),
    classes: 2 + (index % 5),
    delta: 0.002 + (index * 0.0004),
    rgb: { r: 0.01 + index * 0.001, g: 0.012 + index * 0.0005, b: 0.014 + index * 0.0002 }
  }));
  const transitions = Array.from({ length: 11 }, (_, index) => transition(index, {
    brightnessDelta: 0.001 + index * 0.0002,
    activeDelta: 0.002 + index * 0.0003,
    colorDelta: 0.001 + index * 0.0004,
    pixelDelta: 0.002 + index * 0.0005,
    combinedDelta: 0.04 + index * 0.002
  }));
  writeJson(featuresPath, {
    artifactType: "render_review_frame_features_v1",
    sampledFrameMetrics: frames,
    sampledFrameTransitions: transitions
  });
  writeJson(baselinePath, {
    artifactType: "production_video_calibration_baseline_v1",
    references: [{
      sequenceId: "Song",
      frameFeaturesPath: featuresPath
    }]
  });

  const artifact = buildProductionFullSequenceDimensions({ baselinePath, outPath });

  assert.equal(artifact.artifactType, "production_full_sequence_dimensions_v1");
  assert.equal(artifact.referenceCount, 1);
  assert.equal(artifact.policy.calibrationOnly, true);
  assert.equal(artifact.policy.focalHandoffRequiresModelAwareEvidence, true);
  assert.equal(artifact.references[0].windowCount, 6);
  assert.equal(artifact.references[0].scores.energyArc > 0, true);
  assert.equal(artifact.references[0].scores.paletteEvolution > 0, true);
  assert.equal(artifact.references[0].confidence.focalHandoff, "proxy_only");
  assert.equal(artifact.scoreRanges.energyArc.count, 1);
  assert.equal(fs.existsSync(outPath), true);
});
