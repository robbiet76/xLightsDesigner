import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { runRenderReviewRevisionLoop } from './run-render-review-revision-loop.mjs';

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function renderReview({ decision = 'revise', quality = 0.55, blankRisk = 0.75, sequencePath = '/tmp/source.xsq' } = {}) {
  return {
    artifactType: 'render_review_v1',
    section: { id: 'test-section', startMs: 0, endMs: 8000 },
    intent: {
      effectName: 'On',
      targetHierarchy: { leadTargets: ['Lead Target'], supportTargets: [] }
    },
    evidence: { sequencePath },
    deterministicMetrics: {
      blankRisk,
      activeCoverageMean: blankRisk > 0.5 ? 0.02 : 0.25,
      temporalMotionMean: 0.05,
      clutterRisk: 0.1,
      overexposureRisk: 0.1
    },
    qualityScores: {
      overallQuality: quality,
      visualReadability: quality,
      intentMatch: quality,
      motionCoherence: 0.6
    },
    critique: {
      decision,
      issues: decision === 'accept' ? [] : ['blank-span risk is high'],
      strengths: [],
      revisionRecommendations: []
    }
  };
}

test('runRenderReviewRevisionLoop stops accepted after a successful comparison', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xld-render-revision-loop-'));
  const reviewPath = path.join(root, 'original-review.json');
  const geometryPath = path.join(root, 'geometry.json');
  const fseqPath = path.join(root, 'revised.fseq');
  writeJson(reviewPath, renderReview());
  writeJson(geometryPath, { artifactType: 'preview_scene_geometry_v1' });
  fs.writeFileSync(fseqPath, 'fake-fseq');

  const artifact = await runRenderReviewRevisionLoop({
    reviewPaths: [reviewPath],
    geometryPath,
    outDir: path.join(root, 'loop'),
    maxIterations: 2,
    runAttempts: async ({ attempts, outPath }) => {
      const execution = {
        artifactType: 'render_review_revision_attempt_execution_index_v1',
        summary: { executionCount: 1, succeededCount: 1, skippedCount: 0, failedCount: 0, fseqCount: 1 },
        results: [
          {
            ok: true,
            attemptId: attempts.attempts[0].attemptId,
            revisionObjectiveId: attempts.attempts[0].source.revisionObjectiveId,
            originalRenderReviewRef: reviewPath,
            fseqPath,
            effectName: 'On',
            targets: ['Lead Target']
          }
        ]
      };
      writeJson(outPath, execution);
      return execution;
    },
    buildFseqReview: ({ outDir }) => {
      const renderReviewPath = path.join(outDir, 'render-review.json');
      writeJson(renderReviewPath, renderReview({ decision: 'accept', quality: 0.93, blankRisk: 0.05 }));
      return { ok: true, renderReviewPath };
    }
  });

  assert.equal(artifact.artifactType, 'render_review_revision_loop_v1');
  assert.equal(artifact.ok, true);
  assert.equal(artifact.status, 'accepted');
  assert.equal(artifact.summary.iterationCount, 1);
  assert.equal(artifact.iterations[0].summaries.comparisons.acceptedAfterRevisionCount, 1);
  assert.equal(fs.existsSync(path.join(root, 'loop', 'render-review-revision-loop.json')), true);
});

test('runRenderReviewRevisionLoop stops blocked when no attempt can be planned', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xld-render-revision-loop-blocked-'));
  const reviewPath = path.join(root, 'original-review.json');
  const geometryPath = path.join(root, 'geometry.json');
  writeJson(reviewPath, {
    ...renderReview(),
    intent: { effectName: '', targetHierarchy: {} },
    evidence: {}
  });
  writeJson(geometryPath, { artifactType: 'preview_scene_geometry_v1' });

  const artifact = await runRenderReviewRevisionLoop({
    reviewPaths: [reviewPath],
    geometryPath,
    outDir: path.join(root, 'loop'),
    maxIterations: 2,
    runAttempts: async ({ attempts, outPath }) => {
      const execution = {
        artifactType: 'render_review_revision_attempt_execution_index_v1',
        summary: { executionCount: attempts.attempts.length, succeededCount: 0, skippedCount: attempts.attempts.length, failedCount: 0, fseqCount: 0 },
        results: attempts.attempts.map((attempt) => ({ ok: true, skipped: true, attemptId: attempt.attemptId, skipReason: 'attempt status is blocked' }))
      };
      writeJson(outPath, execution);
      return execution;
    },
    buildFseqReview: () => {
      throw new Error('should not review blocked attempts');
    }
  });

  assert.equal(artifact.ok, false);
  assert.equal(artifact.status, 'blocked');
  assert.equal(artifact.summary.iterationCount, 1);
  assert.equal(artifact.iterations[0].summaries.attempts.plannedCount, 0);
  assert.equal(readJson(artifact.iterations[0].paths.attemptsPath).summary.blockedCount, 1);
});
