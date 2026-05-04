import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  buildRenderReviewRevisionAttempt,
  buildRenderReviewRevisionAttempts
} from './build-render-review-revision-attempts.mjs';

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function objective(overrides = {}) {
  return {
    artifactType: 'render_review_revision_objective_v1',
    objectiveId: 'rrro1:test',
    source: {
      renderReviewRef: '/tmp/render-review.json',
      effectName: 'Color Wash',
      evidence: { sequencePath: '/tmp/source.fseq' }
    },
    scope: {
      sectionId: 'chorus-1',
      sectionLabel: 'Chorus 1',
      startMs: 1000,
      endMs: 9000,
      revisionRoles: ['increase_section_coverage', 'strengthen_visual_readability'],
      revisionTargets: ['Lead Model']
    },
    sequencerDirection: {
      revisionActions: [
        { action: 'extend_or_repeat_effect_coverage' },
        { action: 'increase_readable_contrast_or_brightness' }
      ]
    },
    successChecks: ['render_review_v1 decision is accept'],
    ...overrides
  };
}

test('buildRenderReviewRevisionAttempt plans an owned batch payload from explicit objective targets', () => {
  const attempt = buildRenderReviewRevisionAttempt({
    objective: objective(),
    defaultEffectName: 'Color Wash',
    layer: 1,
    clearExisting: true
  });

  assert.equal(attempt.artifactType, 'render_review_revision_attempt_v1');
  assert.equal(attempt.status, 'planned');
  assert.equal(attempt.source.effectName, 'Color Wash');
  assert.equal(attempt.source.sequencePath, '/tmp/source.fseq');
  assert.deepEqual(attempt.blockedReasons, []);
  assert.equal(attempt.ownedBatchPayload.effects.length, 1);
  assert.equal(attempt.ownedBatchPayload.effects[0].element, 'Lead Model');
  assert.equal(attempt.ownedBatchPayload.effects[0].effectName, 'Color Wash');
  assert.equal(attempt.ownedBatchPayload.effects[0].startMs, 1000);
  assert.equal(attempt.ownedBatchPayload.effects[0].endMs, 9000);
  assert.equal(attempt.ownedBatchPayload.effects[0].layer, 1);
  assert.equal(attempt.ownedBatchPayload.effects[0].clearExisting, true);
  assert.ok(attempt.scope.plannedMoves.includes('cover_full_section_window'));
  assert.ok(attempt.scope.plannedMoves.includes('add_readability_support'));
});

test('buildRenderReviewRevisionAttempt blocks when target context is missing', () => {
  const attempt = buildRenderReviewRevisionAttempt({
    objective: objective({ scope: { ...objective().scope, revisionTargets: [] } }),
    defaultEffectName: 'Color Wash'
  });

  assert.equal(attempt.status, 'blocked');
  assert.ok(attempt.blockedReasons.includes('missing_revision_targets'));
  assert.equal('ownedBatchPayload' in attempt, false);
});

test('buildRenderReviewRevisionAttempts accepts manifest target policy targets', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xld-render-review-attempts-'));
  const objectivesPath = path.join(root, 'objectives.json');
  const outPath = path.join(root, 'attempts.json');
  writeJson(objectivesPath, {
    artifactType: 'render_review_revision_objective_index_v1',
    objectives: [
      objective({ scope: { ...objective().scope, revisionTargets: [] } })
    ]
  });

  const artifact = buildRenderReviewRevisionAttempts({
    objectivesPath,
    outPath,
    defaultEffectName: 'On',
    targetPolicy: {
      mode: 'explicit',
      targets: [{ targetId: 'target-1', element: 'Provided Target', source: 'display_metadata' }]
    }
  });

  assert.equal(artifact.artifactType, 'render_review_revision_attempt_plan_index_v1');
  assert.equal(artifact.summary.attemptCount, 1);
  assert.equal(artifact.summary.plannedCount, 1);
  assert.equal(artifact.summary.blockedCount, 0);
  assert.equal(artifact.attempts[0].targets[0].targetId, 'target-1');
  assert.equal(artifact.attempts[0].ownedBatchPayload.effects[0].element, 'Provided Target');
  assert.equal(fs.existsSync(outPath), true);
});

test('buildRenderReviewRevisionAttempt preserves full source timing marks when available', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xld-render-review-attempt-marks-'));
  const observationPath = path.join(root, 'owned-api-validation-result.json');
  writeJson(observationPath, {
    applyPayload: {
      marks: [
        { label: 'Intro', startMs: 0, endMs: 1000 },
        { label: 'Apply', startMs: 1000, endMs: 2000 },
        { label: 'Outro', startMs: 2000, endMs: 3000 }
      ]
    }
  });
  const attempt = buildRenderReviewRevisionAttempt({
    objective: objective({
      source: {
        ...objective().source,
        evidence: {
          ...objective().source.evidence,
          renderObservationPath: observationPath
        }
      }
    }),
    defaultEffectName: 'On'
  });

  assert.equal(attempt.status, 'planned');
  assert.equal(attempt.ownedBatchPayload.replaceExistingMarks, true);
  assert.equal(attempt.ownedBatchPayload.subType, 'Generic');
  assert.deepEqual(attempt.ownedBatchPayload.marks.map((mark) => mark.label), ['Intro', 'Apply', 'Outro']);
});
