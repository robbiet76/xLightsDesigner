import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeIntent } from '../../agent/intent-normalizer.js';
import { resolveTargets } from '../../agent/sequence-agent/target-resolver.js';
import { buildProposalFromIntent } from '../../agent/planner.js';

const models = [
  { id: 'MegaTree', name: 'MegaTree', type: 'Model' },
  { id: 'Roofline', name: 'Roofline', type: 'Model' },
  { id: 'Arches', name: 'Arches', type: 'Model' }
];

const submodels = [
  { id: 'MegaTree/TopHalf', name: 'TopHalf', parentId: 'MegaTree' },
  { id: 'Roofline/Left', name: 'Left', parentId: 'Roofline' }
];

const metadataAssignments = [
  { targetId: 'MegaTree', tags: ['focal', 'hero'] },
  { targetId: 'MegaTree/TopHalf', tags: ['rhythm-driver'] },
  { targetId: 'Roofline', tags: ['ambient-fill'] }
];

test('normalizeIntent extracts high-level sequencing intent and explicit overrides', () => {
  const normalized = normalizeIntent({
    promptText: 'Make chorus punchy with higher energy and use twinkle + bars accents',
    selectedSections: ['Chorus'],
    selectedTagNames: ['focal'],
    selectedTargetIds: ['MegaTree/TopHalf']
  });

  assert.equal(normalized.tempoIntent, 'increase');
  assert.equal(normalized.motionIntent, 'punchy');
  assert.deepEqual(normalized.sections, ['Chorus']);
  assert.deepEqual(normalized.tags, ['focal']);
  assert.deepEqual(normalized.targetIds, ['MegaTree/TopHalf']);
  assert.ok(normalized.effectOverrides.includes('twinkle'));
  assert.ok(normalized.effectOverrides.includes('bars'));
});

test('resolveTargets honors explicit target ids and metadata tags', () => {
  const normalizedIntent = normalizeIntent({
    promptText: 'Bring up energy on focal rhythm-driver elements',
    selectedTagNames: ['focal', 'rhythm-driver'],
    selectedTargetIds: ['Roofline/Left']
  });

  const targets = resolveTargets({
    normalizedIntent,
    models,
    submodels,
    metadataAssignments
  });

  const ids = targets.map((t) => t.id);
  assert.ok(ids.includes('Roofline/Left'));
  assert.ok(ids.includes('MegaTree'));
  assert.ok(ids.includes('MegaTree/TopHalf'));
});

test('planner produces concrete first-pass sequencing lines from director-level prompt', () => {
  const result = buildProposalFromIntent({
    promptText: 'I want chorus 2 to feel bigger and more energetic',
    selectedSections: ['Chorus 2'],
    selectedTagNames: ['focal'],
    models,
    submodels,
    metadataAssignments
  });

  assert.ok(result.targets.length > 0);
  assert.ok(result.proposalLines.length > 0);
  assert.ok(result.proposalLines.every((line) => line.includes('/')));
  assert.ok(
    result.proposalLines.some((line) =>
      /increase pulse contrast|accelerate motion pacing|punchy accents/i.test(line)
    )
  );
});

test('planner includes explicit low-level effect preferences as override constraints', () => {
  const result = buildProposalFromIntent({
    promptText: 'Keep it smooth but use twinkle and bars for key hits',
    selectedSections: ['Bridge'],
    selectedTargetIds: ['MegaTree'],
    models,
    submodels,
    metadataAssignments
  });

  const combined = result.proposalLines.join('\n').toLowerCase();
  assert.ok(combined.includes('honor explicit user effect preferences'));
  assert.ok(combined.includes('twinkle'));
  assert.ok(combined.includes('bars'));
});

test('planner output is deterministic for same input', () => {
  const input = {
    promptText: 'Increase chorus energy on focal elements with cleaner transitions',
    selectedSections: ['Chorus'],
    selectedTagNames: ['focal'],
    models,
    submodels,
    metadataAssignments
  };

  const a = buildProposalFromIntent(input);
  const b = buildProposalFromIntent(input);
  assert.deepEqual(a, b);
});
