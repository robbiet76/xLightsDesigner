import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { buildRenderReviewRevisionComparisons } from './build-render-review-revision-comparisons.mjs';

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function review({ decision = 'revise', overallQuality = 0.55, visualReadability = 0.5, intentMatch = 0.5, blankRisk = 0.75 } = {}) {
  return {
    artifactType: 'render_review_v1',
    qualityScores: {
      overallQuality,
      visualReadability,
      intentMatch,
      motionCoherence: 0.6
    },
    deterministicMetrics: {
      blankRisk,
      activeCoverageMean: blankRisk > 0.5 ? 0.02 : 0.28,
      temporalMotionMean: 0.05,
      clutterRisk: 0.1,
      overexposureRisk: 0.1
    },
    critique: { decision }
  };
}

test('buildRenderReviewRevisionComparisons reviews revised FSEQ and records improvement', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xld-render-revision-compare-'));
  const originalPath = path.join(root, 'original-review.json');
  const revisedPath = path.join(root, 'revised-review.json');
  const fseqPath = path.join(root, 'revision.fseq');
  const geometryPath = path.join(root, 'geometry.json');
  const executionPath = path.join(root, 'execution.json');
  const outPath = path.join(root, 'comparison.json');
  writeJson(originalPath, review());
  writeJson(revisedPath, review({ decision: 'accept', overallQuality: 0.92, visualReadability: 0.9, intentMatch: 0.88, blankRisk: 0.05 }));
  writeJson(geometryPath, { artifactType: 'preview_scene_geometry_v1' });
  fs.writeFileSync(fseqPath, 'fake-fseq');
  writeJson(executionPath, {
    artifactType: 'render_review_revision_attempt_execution_index_v1',
    results: [
      {
        ok: true,
        attemptId: 'rrra1:test',
        revisionObjectiveId: 'rrro1:test',
        originalRenderReviewRef: originalPath,
        fseqPath,
        effectName: 'On',
        targets: ['Lead Target']
      }
    ]
  });

  const artifact = buildRenderReviewRevisionComparisons({
    executionPath,
    geometryPath,
    outPath,
    buildFseqReview: ({ outDir }) => {
      fs.mkdirSync(outDir, { recursive: true });
      const copied = path.join(outDir, 'render-review.json');
      writeJson(copied, readJson(revisedPath));
      return { ok: true, renderReviewPath: copied };
    }
  });

  assert.equal(artifact.artifactType, 'render_review_revision_comparison_index_v1');
  assert.equal(artifact.summary.comparisonCount, 1);
  assert.equal(artifact.summary.improvedCount, 1);
  assert.equal(artifact.summary.acceptedAfterRevisionCount, 1);
  assert.equal(artifact.comparisons[0].decisions.before, 'revise');
  assert.equal(artifact.comparisons[0].decisions.after, 'accept');
  assert.equal(artifact.comparisons[0].quality.retainRevision, true);
  assert.ok(artifact.comparisons[0].scoreDeltas.overallQuality > 0);
  assert.ok(artifact.comparisons[0].metricDeltas.blankRisk < 0);
  assert.equal(fs.existsSync(outPath), true);
});

test('buildRenderReviewRevisionComparisons skips missing original reviews', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xld-render-revision-compare-skip-'));
  const fseqPath = path.join(root, 'revision.fseq');
  const geometryPath = path.join(root, 'geometry.json');
  fs.writeFileSync(fseqPath, 'fake-fseq');
  writeJson(geometryPath, { artifactType: 'preview_scene_geometry_v1' });
  const artifact = buildRenderReviewRevisionComparisons({
    geometryPath,
    execution: {
      results: [
        { ok: true, attemptId: 'rrra1:missing', originalRenderReviewRef: path.join(root, 'missing.json'), fseqPath }
      ]
    }
  });

  assert.equal(artifact.summary.comparisonCount, 0);
  assert.equal(artifact.summary.skippedCount, 1);
  assert.match(artifact.skipped[0].reason, /original render review not found/i);
});

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}
