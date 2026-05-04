import test from 'node:test';
import assert from 'node:assert/strict';

import { buildRenderReviewArtifact } from './build-render-review-artifact.mjs';

test('render review artifact scores ordered frame metrics against section intent', () => {
  const artifact = buildRenderReviewArtifact({
    frameFeatures: {
      sampledFrameCount: 4,
      nonBlankSampledFrameRatio: 1,
      temporalMotionMean: 0.08,
      temporalMotionPeak: 0.15,
      temporalColorDeltaMean: 0.06,
      sampledFrameMetrics: [
        { frameActivePixelRatio: 0.25, frameAverageBrightness: 0.18, frameDominantPixelRatio: 0.02, frameUniqueColorCount: 12 },
        { frameActivePixelRatio: 0.34, frameAverageBrightness: 0.23, frameDominantPixelRatio: 0.03, frameUniqueColorCount: 18 },
        { frameActivePixelRatio: 0.41, frameAverageBrightness: 0.28, frameDominantPixelRatio: 0.04, frameUniqueColorCount: 20 },
        { frameActivePixelRatio: 0.31, frameAverageBrightness: 0.21, frameDominantPixelRatio: 0.02, frameUniqueColorCount: 16 }
      ]
    },
    intent: {
      section: { id: 'chorus-1', label: 'Chorus 1', startMs: 10000, endMs: 18000 },
      effectName: 'Bars',
      targetHierarchy: { leadTargets: ['Lead Target'], supportTargets: ['Support Target'] },
      creativeObjective: { coverage: 'wide', motion: 'active' },
      musicRole: { energy: 'high' }
    },
    evidence: { videoPath: '/tmp/section.mp4' }
  });

  assert.equal(artifact.artifactType, 'render_review_v1');
  assert.equal(artifact.section.id, 'chorus-1');
  assert.equal(artifact.intent.effectName, 'Bars');
  assert.deepEqual(artifact.intent.targetHierarchy.leadTargets, ['Lead Target']);
  assert.equal(artifact.evidence.videoPath, '/tmp/section.mp4');
  assert.equal(artifact.deterministicMetrics.sampledFrameCount, 4);
  assert.ok(artifact.qualityScores.overallQuality > 0.5);
  assert.ok(['accept', 'revise', 'reject'].includes(artifact.critique.decision));
  assert.equal(artifact.evidenceQualification.eligible, artifact.critique.decision === 'accept');
  assert.equal(artifact.evidenceQualification.plannedEffectCount, 1);
});

test('render review artifact flags blank or flat sections for revision', () => {
  const artifact = buildRenderReviewArtifact({
    frameFeatures: {
      sampledFrameCount: 4,
      nonBlankSampledFrameRatio: 0.25,
      temporalMotionMean: 0.001,
      temporalMotionPeak: 0.002,
      sampledFrameMetrics: [
        { frameActivePixelRatio: 0, frameAverageBrightness: 0, frameDominantPixelRatio: 0, frameUniqueColorCount: 1 },
        { frameActivePixelRatio: 0.01, frameAverageBrightness: 0.003, frameDominantPixelRatio: 0, frameUniqueColorCount: 2 },
        { frameActivePixelRatio: 0, frameAverageBrightness: 0, frameDominantPixelRatio: 0, frameUniqueColorCount: 1 },
        { frameActivePixelRatio: 0, frameAverageBrightness: 0, frameDominantPixelRatio: 0, frameUniqueColorCount: 1 }
      ]
    },
    intent: {
      creativeObjective: { coverage: 'wide', motion: 'active' },
      musicRole: { energy: 'high' }
    }
  });

  assert.equal(artifact.critique.decision, 'reject');
  assert.ok(artifact.critique.issues.some((issue) => /blank/i.test(issue)));
  assert.equal(artifact.promotion.eligible, false);
});

test('render review artifact separates baseline render health from quality evidence', () => {
  const artifact = buildRenderReviewArtifact({
    frameFeatures: {
      sampledFrameCount: 4,
      nonBlankSampledFrameRatio: 1,
      temporalMotionMean: 0.08,
      temporalMotionPeak: 0.15,
      previewWindowSignals: {
        maxActiveModelCount: 1,
        maxActiveNodeCount: 240,
        meanActiveModelCount: 1,
        meanActiveNodeCount: 200
      },
      sampledFrameMetrics: [
        { frameActivePixelRatio: 0.01, frameAverageBrightness: 0.01, frameDominantPixelRatio: 0, frameUniqueColorCount: 3 },
        { frameActivePixelRatio: 0.01, frameAverageBrightness: 0.01, frameDominantPixelRatio: 0, frameUniqueColorCount: 4 },
        { frameActivePixelRatio: 0.01, frameAverageBrightness: 0.01, frameDominantPixelRatio: 0, frameUniqueColorCount: 5 },
        { frameActivePixelRatio: 0.01, frameAverageBrightness: 0.01, frameDominantPixelRatio: 0, frameUniqueColorCount: 4 }
      ]
    },
    intent: {
      renderPlan: { plannedEffectCount: 0, plannedTargetCount: 0 }
    }
  });

  assert.equal(artifact.evidenceQualification.status, 'render_health_observation');
  assert.equal(artifact.evidenceQualification.eligible, false);
  assert.equal(artifact.evidenceQualification.reasons.includes('no_planned_effects'), true);
  assert.equal(artifact.promotion.eligible, false);
});
