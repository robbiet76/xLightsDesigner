import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { buildRenderReviewProgressionSummary } from './build-render-review-progression-summary.mjs';

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function review({ id, startMs, endMs, coverage = 0.1, motion = 0.05, quality = 0.8, decision = 'accept' } = {}) {
  return {
    artifactType: 'render_review_v1',
    section: { id, label: id, startMs, endMs },
    intent: {
      effectName: 'On',
      targetHierarchy: { leadTargets: ['Matrix'] }
    },
    deterministicMetrics: {
      activeCoverageMean: coverage,
      brightnessMean: coverage * 0.5,
      temporalMotionMean: motion,
      colorDiversityMean: 0.2,
      blankRisk: 0
    },
    qualityScores: {
      overallQuality: quality,
      visualReadability: quality,
      intentMatch: quality,
      motionCoherence: quality
    },
    critique: { decision }
  };
}

test('buildRenderReviewProgressionSummary flags adjacent windows that read similarly', () => {
  const artifact = buildRenderReviewProgressionSummary({
    reviews: [
      review({ id: 'intro', startMs: 0, endMs: 1000, coverage: 0.12, motion: 0.04 }),
      review({ id: 'build', startMs: 1000, endMs: 2000, coverage: 0.121, motion: 0.041 }),
      review({ id: 'release', startMs: 2000, endMs: 3000, coverage: 0.122, motion: 0.042 })
    ]
  });

  assert.equal(artifact.artifactType, 'render_review_progression_summary_v1');
  assert.equal(artifact.summary.windowCount, 3);
  assert.equal(artifact.summary.adjacentComparisonCount, 2);
  assert.equal(artifact.summary.similarAdjacentWindowCount, 2);
  assert.equal(artifact.summary.progressionRisk, true);
  assert.equal(artifact.adjacentComparisons.every((row) => row.windowsReadSimilarly), true);
});

test('buildRenderReviewProgressionSummary records progression deltas from review paths', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xld-render-progression-'));
  const intro = path.join(root, 'intro.json');
  const build = path.join(root, 'build.json');
  const out = path.join(root, 'progression.json');
  writeJson(intro, review({ id: 'intro', startMs: 0, endMs: 1000, coverage: 0.05, motion: 0.01, quality: 0.75 }));
  writeJson(build, review({ id: 'build', startMs: 1000, endMs: 2000, coverage: 0.45, motion: 0.18, quality: 0.88 }));

  const artifact = buildRenderReviewProgressionSummary({ reviewPaths: [build, intro], outPath: out });

  assert.equal(fs.existsSync(out), true);
  assert.deepEqual(artifact.windows.map((row) => row.id), ['intro', 'build']);
  assert.equal(artifact.summary.similarAdjacentWindowCount, 0);
  assert.equal(artifact.summary.progressionRisk, false);
  assert.ok(artifact.adjacentComparisons[0].deltas.activeCoverageMean > 0);
  assert.ok(artifact.adjacentComparisons[0].deltas.temporalMotionMean > 0);
});
