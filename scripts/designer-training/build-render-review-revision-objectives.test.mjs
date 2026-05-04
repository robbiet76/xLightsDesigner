import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  buildRenderReviewRevisionObjective,
  buildRenderReviewRevisionObjectives
} from './build-render-review-revision-objectives.mjs';

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function review(decision = 'revise') {
  return {
    artifactType: 'render_review_v1',
    section: { id: 'chorus-1', label: 'Chorus 1', startMs: 1000, endMs: 9000 },
    intent: {
      effectName: 'On',
      targetHierarchy: {
        leadTargets: ['Tree'],
        supportTargets: ['Arches']
      }
    },
    evidence: { videoPath: '/tmp/review.mp4' },
    deterministicMetrics: {
      blankRisk: 0.75,
      activeCoverageMean: 0.015,
      temporalMotionMean: 0.04
    },
    qualityScores: {
      visualReadability: 0.57,
      intentMatch: 0.61
    },
    critique: {
      decision,
      strengths: ['motion is readable when active'],
      issues: ['blank-span risk is high'],
      revisionRecommendations: ['increase active target coverage or extend effect duration through the section']
    }
  };
}

test('buildRenderReviewRevisionObjective converts blank-span critique into coverage actions', () => {
  const objective = buildRenderReviewRevisionObjective({ review: review(), reviewPath: '/tmp/render-review.json' });
  assert.equal(objective.artifactType, 'render_review_revision_objective_v1');
  assert.equal(objective.source.effectName, 'On');
  assert.equal(objective.scope.sectionId, 'chorus-1');
  assert.ok(objective.scope.revisionRoles.includes('increase_section_coverage'));
  assert.ok(objective.scope.revisionRoles.includes('strengthen_visual_readability'));
  assert.deepEqual(objective.scope.revisionTargets, ['Tree', 'Arches']);
  assert.ok(objective.sequencerDirection.revisionActions.some((action) => action.action === 'extend_or_repeat_effect_coverage'));
  assert.ok(objective.successChecks.some((check) => /decision is accept/i.test(check)));
});

test('buildRenderReviewRevisionObjectives reads review paths from a cycle summary', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xld-render-review-objectives-'));
  const revisePath = path.join(root, 'revise.json');
  const acceptPath = path.join(root, 'accept.json');
  const cyclePath = path.join(root, 'cycle-summary.json');
  const outPath = path.join(root, 'objectives.json');
  writeJson(revisePath, review('revise'));
  writeJson(acceptPath, review('accept'));
  writeJson(cyclePath, {
    phases: [
      {
        type: 'fseq_render_review',
        results: [
          { renderReviewPath: revisePath },
          { renderReviewPath: acceptPath }
        ]
      }
    ]
  });

  const artifact = buildRenderReviewRevisionObjectives({ cycleSummaryPath: cyclePath, outPath });
  assert.equal(artifact.artifactType, 'render_review_revision_objective_index_v1');
  assert.equal(artifact.summary.objectiveCount, 1);
  assert.equal(artifact.summary.skippedCount, 1);
  assert.equal(artifact.summary.revisionRoleCounts.increase_section_coverage, 1);
  assert.equal(fs.existsSync(outPath), true);
});
