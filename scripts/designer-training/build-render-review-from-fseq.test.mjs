import test from 'node:test';
import assert from 'node:assert/strict';

import { buildFrameOffsets } from './build-render-review-from-fseq.mjs';

test('buildFrameOffsets spreads samples across the decoded FSEQ window', () => {
  assert.deepEqual(buildFrameOffsets({ startMs: 0, endMs: 1000, stepMs: 50, sampleCount: 5 }), [0, 5, 10, 14, 19]);
  assert.deepEqual(buildFrameOffsets({ startMs: 0, endMs: 200, stepMs: 50, sampleCount: 8 }), [0, 1, 2, 3]);
  assert.deepEqual(buildFrameOffsets({ frameOffsets: '7,2,7,0' }), [0, 2, 7]);
});
