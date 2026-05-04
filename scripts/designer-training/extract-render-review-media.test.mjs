import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { buildRenderReviewArtifact } from './build-render-review-artifact.mjs';
import { extractRenderReviewMedia } from './extract-render-review-media.mjs';

function hasCommand(command) {
  try {
    execFileSync('which', [command], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

test('extract-render-review-media builds frame features and contact evidence for review', { skip: !hasCommand('ffmpeg') || !hasCommand('ffprobe') }, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xld-render-review-media-'));
  const mediaPath = path.join(root, 'sample.mp4');
  execFileSync('ffmpeg', [
    '-y',
    '-v', 'error',
    '-f', 'lavfi',
    '-i', 'testsrc=size=96x64:rate=8:duration=2',
    '-pix_fmt', 'yuv420p',
    mediaPath
  ]);

  const result = extractRenderReviewMedia({
    mediaPath,
    outDir: path.join(root, 'review-media'),
    sampleCount: 8
  });

  assert.equal(result.ok, true);
  assert.equal(fs.existsSync(result.frameFeaturesPath), true);
  assert.equal(fs.existsSync(result.contactSheetPath), true);
  assert.equal(fs.existsSync(result.framesDir), true);

  const features = JSON.parse(fs.readFileSync(result.frameFeaturesPath, 'utf8'));
  assert.equal(features.artifactType, 'render_review_frame_features_v1');
  assert.equal(features.mediaWidth, 96);
  assert.equal(features.mediaHeight, 64);
  assert.ok(features.sampledFrameCount >= 4);
  assert.ok(features.nonBlankSampledFrameRatio > 0);
  assert.ok(Array.isArray(features.sampledFrameMetrics));

  const review = buildRenderReviewArtifact({
    frameFeatures: features,
    evidence: {
      videoPath: mediaPath,
      contactSheetPath: result.contactSheetPath,
      frameDirectory: result.framesDir,
      frameFeaturesPath: result.frameFeaturesPath
    },
    intent: {
      creativeObjective: { coverage: 'wide', motion: 'active' },
      musicRole: { energy: 'high' }
    }
  });
  assert.equal(review.artifactType, 'render_review_v1');
  assert.equal(review.evidence.contactSheetPath, result.contactSheetPath);
  assert.ok(['accept', 'revise', 'reject'].includes(review.critique.decision));
});
