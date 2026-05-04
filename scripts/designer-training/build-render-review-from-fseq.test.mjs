import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildFrameOffsets,
  deriveIntentFromOwnedApplyPayload,
  mergeIntentForRenderReview
} from './build-render-review-from-fseq.mjs';

test('buildFrameOffsets spreads samples across the decoded FSEQ window', () => {
  assert.deepEqual(buildFrameOffsets({ startMs: 0, endMs: 1000, stepMs: 50, sampleCount: 5 }), [0, 5, 10, 14, 19]);
  assert.deepEqual(buildFrameOffsets({ startMs: 0, endMs: 200, stepMs: 50, sampleCount: 8 }), [0, 1, 2, 3]);
  assert.deepEqual(buildFrameOffsets({ frameOffsets: '7,2,7,0' }), [0, 2, 7]);
});

test('deriveIntentFromOwnedApplyPayload carries effect and target context into reviews', () => {
  const intent = deriveIntentFromOwnedApplyPayload({
    effectName: 'Color Wash',
    applyPayload: {
      effects: [
        { element: 'Lead Target', effectName: 'Color Wash' },
        { element: 'Support Target', effectName: 'Color Wash' }
      ]
    }
  });

  assert.equal(intent.effectName, 'Color Wash');
  assert.deepEqual(intent.targetHierarchy.leadTargets, ['Lead Target']);
  assert.deepEqual(intent.targetHierarchy.supportTargets, ['Support Target']);
});

test('mergeIntentForRenderReview keeps inferred context when overlays are blank', () => {
  const intent = mergeIntentForRenderReview(
    { effectName: 'On', targetHierarchy: { leadTargets: ['Lead Target'] }, rawSummary: 'effect:On' },
    { effectName: '', targetHierarchy: {} }
  );

  assert.equal(intent.effectName, 'On');
  assert.deepEqual(intent.targetHierarchy.leadTargets, ['Lead Target']);
  assert.equal(intent.rawSummary, 'effect:On');
});
