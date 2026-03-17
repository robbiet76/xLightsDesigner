import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeDesignRevisionTarget,
  mergeRevisedDesignConceptExecutionPlan
} from '../../../agent/designer-dialog/design-concept-revision.js';

test('normalizeDesignRevisionTarget normalizes required fields', () => {
  const result = normalizeDesignRevisionTarget({
    designId: 'DES-002',
    designRevision: '3',
    priorDesignRevision: '2',
    designAuthor: 'user',
    sections: ['Chorus 1', 'Chorus 1', ''],
    targetIds: ['Snowman', 'Snowman', 'Star'],
    summary: ' Revise focal chorus lift ',
    designLabel: 'D2.3'
  });

  assert.deepEqual(result, {
    designId: 'DES-002',
    designRevision: 3,
    priorDesignRevision: 2,
    designAuthor: 'user',
    sections: ['Chorus 1'],
    targetIds: ['Snowman', 'Star'],
    summary: 'Revise focal chorus lift',
    designLabel: 'D2.3',
    requestedAt: ''
  });
});

test('mergeRevisedDesignConceptExecutionPlan replaces one concept in place and preserves order', () => {
  const currentExecutionPlan = {
    passScope: 'multi_section',
    sectionPlans: [
      { designId: 'DES-001', designRevision: 0, designAuthor: 'designer', section: 'Verse 1', targetIds: ['Snowman'] },
      { designId: 'DES-002', designRevision: 0, designAuthor: 'designer', section: 'Chorus 1', targetIds: ['Star'] },
      { designId: 'DES-003', designRevision: 0, designAuthor: 'designer', section: 'Bridge', targetIds: ['Tree'] }
    ],
    effectPlacements: [
      { designId: 'DES-001', designRevision: 0, designAuthor: 'designer', targetId: 'Snowman', effectName: 'Color Wash' },
      { designId: 'DES-002', designRevision: 0, designAuthor: 'designer', targetId: 'Star', effectName: 'Shimmer' },
      { designId: 'DES-003', designRevision: 0, designAuthor: 'designer', targetId: 'Tree', effectName: 'Bars' }
    ]
  };

  const revisedExecutionPlan = {
    passScope: 'multi_section',
    sectionPlans: [
      { designId: 'DES-900', designRevision: 0, designAuthor: 'designer', section: 'Chorus 1', targetIds: ['Star'] },
      { designId: 'DES-901', designRevision: 0, designAuthor: 'designer', section: 'Chorus 2', targetIds: ['Star', 'NorthPoleSign'] }
    ],
    effectPlacements: [
      { designId: 'DES-900', designRevision: 0, designAuthor: 'designer', targetId: 'Star', effectName: 'Pinwheel' },
      { designId: 'DES-901', designRevision: 0, designAuthor: 'designer', targetId: 'NorthPoleSign', effectName: 'Wave' }
    ]
  };

  const merged = mergeRevisedDesignConceptExecutionPlan({
    currentExecutionPlan,
    revisedExecutionPlan,
    revisionTarget: {
      designId: 'DES-002',
      designRevision: 1,
      designAuthor: 'designer'
    }
  });

  assert.deepEqual(
    merged.sectionPlans.map((row) => [row.designId, row.designRevision, row.section]),
    [
      ['DES-001', 0, 'Verse 1'],
      ['DES-002', 1, 'Chorus 1'],
      ['DES-002', 1, 'Chorus 2'],
      ['DES-003', 0, 'Bridge']
    ]
  );
  assert.deepEqual(
    merged.effectPlacements.map((row) => [row.designId, row.designRevision, row.targetId, row.effectName]),
    [
      ['DES-001', 0, 'Snowman', 'Color Wash'],
      ['DES-002', 1, 'Star', 'Pinwheel'],
      ['DES-002', 1, 'NorthPoleSign', 'Wave'],
      ['DES-003', 0, 'Tree', 'Bars']
    ]
  );
  assert.equal(merged.sectionCount, 4);
  assert.equal(merged.targetCount, 4);
});
