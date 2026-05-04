import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { extractRenderReviewMedia } from './extract-render-review-media.mjs';
import { renderPreviewWindowMedia } from './render-preview-window-media.mjs';

function hasCommand(command) {
  try {
    execFileSync('which', [command], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function activeNode(nodeId, x, y, rgb) {
  return {
    nodeId,
    stringIndex: 1,
    screen: { x, y, z: 0 },
    rgb,
    brightness: (rgb.r + rgb.g + rgb.b) / 3
  };
}

test('render-preview-window-media rasterizes preview scene windows into reviewable media', { skip: !hasCommand('ffmpeg') || !hasCommand('ffprobe') }, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xld-preview-window-media-'));
  const windowPath = path.join(root, 'preview-window.json');
  const mediaPath = path.join(root, 'preview-window.mp4');
  writeJson(windowPath, {
    artifactType: 'preview_scene_window_v1',
    artifactVersion: 1,
    frames: [
      {
        frameOffset: 0,
        frameIndex: 0,
        frameTimeMs: 0,
        activeModelCount: 1,
        activeNodeCount: 2,
        models: [
          {
            modelName: 'Matrix',
            activeNodes: [
              activeNode('n1', 0, 0, { r: 255, g: 0, b: 0 }),
              activeNode('n2', 10, 0, { r: 0, g: 255, b: 0 })
            ]
          }
        ]
      },
      {
        frameOffset: 1,
        frameIndex: 1,
        frameTimeMs: 50,
        activeModelCount: 1,
        activeNodeCount: 2,
        models: [
          {
            modelName: 'Matrix',
            activeNodes: [
              activeNode('n1', 5, 5, { r: 0, g: 0, b: 255 }),
              activeNode('n2', 10, 10, { r: 255, g: 255, b: 255 })
            ]
          }
        ]
      }
    ]
  });

  const render = renderPreviewWindowMedia({
    windowPath,
    out: mediaPath,
    framesDir: path.join(root, 'preview-frames'),
    width: 160,
    height: 90,
    fps: 10,
    nodeRadius: 4
  });
  assert.equal(render.ok, true);
  assert.equal(render.frameCount, 2);
  assert.equal(fs.existsSync(mediaPath), true);

  const extraction = extractRenderReviewMedia({
    mediaPath,
    outDir: path.join(root, 'review-media'),
    sampleCount: 4
  });
  const features = JSON.parse(fs.readFileSync(extraction.frameFeaturesPath, 'utf8'));
  assert.equal(features.artifactType, 'render_review_frame_features_v1');
  assert.ok(features.sampledFrameCount >= 1);
  assert.ok(features.nonBlankSampledFrameRatio > 0);
});
