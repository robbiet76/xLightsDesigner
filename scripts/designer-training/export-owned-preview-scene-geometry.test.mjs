import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { exportOwnedPreviewSceneGeometry } from './export-owned-preview-scene-geometry.mjs';

test('exportOwnedPreviewSceneGeometry infers RGB channel mapping from owned model rows', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xld-owned-geometry-'));
  const outPath = path.join(root, 'geometry.json');
  const result = await exportOwnedPreviewSceneGeometry({
    endpoint: 'http://owned.test/xlightsdesigner/api',
    outPath,
    deps: {
      getModels: async () => ({
        data: {
          models: [
            { name: 'Matrix', displayAs: 'Matrix', startChannel: 101, endChannel: 112, nodeCount: 4 },
            { name: 'AllModels', displayAs: 'ModelGroup' }
          ]
        }
      }),
      getModelNodes: async () => ({
        data: {
          nodes: [
            { nodeId: 1, stringIndex: 0, coords: [{ screen: { x: 0, y: 0, z: 0 } }] },
            { nodeId: 2, stringIndex: 0, coords: [{ screen: { x: 1, y: 0, z: 0 } }] }
          ]
        }
      }),
      getLayoutScene: async () => ({ data: { cameras: [{ name: 'Default' }], views: [], displayElements: [] } })
    }
  });

  assert.equal(result.ok, true);
  assert.equal(fs.existsSync(outPath), true);
  assert.equal(result.artifact.summaries.modelCount, 1);
  assert.equal(result.artifact.summaries.skippedAggregateModelCount, 1);
  assert.equal(result.artifact.scene.models[0].nodes[0].channelStart, 100);
  assert.equal(result.artifact.scene.models[0].nodes[1].channelStart, 103);
  assert.equal(result.artifact.scene.models[0].nodes[0].channelCount, 3);
});
