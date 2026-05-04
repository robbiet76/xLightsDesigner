import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { runSelfImprovementCycle } from './run-self-improvement-cycle.mjs';

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function hasCommand(command) {
  try {
    execFileSync('which', [command], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

test('self-improvement cycle exports target behavior summaries and blocks early promotion', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xld-self-improve-'));
  const projectDir = path.join(root, 'Project');
  writeJson(path.join(projectDir, 'display', 'target-behavior.json'), {
    artifactType: 'project_target_behavior_learning_v1',
    records: [
      {
        recordId: 'tbl1:custom-on',
        targetId: 'CustomFace/@Mouth',
        targetKind: 'submodel',
        targetFingerprint: 'tmf1:custom-mouth',
        effectName: 'On',
        effectFamily: 'On',
        probeScope: 'submodel',
        parentContext: { canonicalType: 'custom', targetFingerprint: 'tmf1:custom-face' },
        stats: { sampleCount: 1, positiveCount: 1, negativeCount: 0 }
      }
    ]
  });
  writeJson(path.join(projectDir, 'display', 'model-index.json'), {
    artifactType: 'target_metadata_index_v1',
    records: [
      { targetId: 'CustomFace', targetKind: 'model', identity: { canonicalType: 'custom' } },
      { targetId: 'CustomFace/@Mouth', targetKind: 'submodel', identity: { canonicalType: 'submodel' } }
    ]
  });

  const result = await runSelfImprovementCycle({
    skipCommands: true,
    projectDirs: [projectDir],
    outDir: path.join(root, 'run')
  });

  assert.equal(result.ok, true);
  assert.equal(result.initialScope.effects.includes('SingleStrand'), true);
  assert.equal(result.initialScope.effects.includes('Shimmer'), false);
  assert.equal(result.targetBehaviorExports.length, 1);
  assert.equal(result.promotionGate.promoteReady, false);
  assert.equal(result.promotionGate.totals.recordCount, 1);
  assert.equal(result.promotionGate.totals.customParentRecordCount, 1);
  assert.equal(fs.existsSync(path.join(root, 'run', 'cycle-summary.json')), true);
});

test('self-improvement cycle keeps live probes opt-in', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xld-self-improve-live-opt-in-'));
  const result = await runSelfImprovementCycle({
    skipCommands: true,
    runLiveProbes: false,
    outDir: path.join(root, 'run')
  });

  assert.equal(result.ok, true);
  assert.equal(result.phases.some((phase) => phase.type === 'live_custom_model_probe'), false);
});

test('self-improvement promotion gate counts built-in model target records', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xld-self-improve-built-in-'));
  const projectDir = path.join(root, 'Project');
  writeJson(path.join(projectDir, 'display', 'target-behavior.json'), {
    artifactType: 'project_target_behavior_learning_v1',
    records: [
      {
        recordId: 'tbl1:matrix-bars',
        targetId: 'Matrix',
        targetKind: 'model',
        targetCanonicalType: 'matrix',
        targetFingerprint: 'tmf1:matrix',
        effectName: 'Bars',
        effectFamily: 'Bars',
        probeScope: 'target',
        stats: { sampleCount: 1, positiveCount: 1, negativeCount: 0 }
      }
    ]
  });
  writeJson(path.join(projectDir, 'display', 'model-index.json'), {
    artifactType: 'target_metadata_index_v1',
    records: [
      { targetId: 'Matrix', targetKind: 'model', identity: { canonicalType: 'matrix' } }
    ]
  });

  const result = await runSelfImprovementCycle({
    skipCommands: true,
    projectDirs: [projectDir],
    outDir: path.join(root, 'run')
  });

  assert.equal(result.ok, true);
  assert.equal(result.promotionGate.totals.builtInParentRecordCount, 1);
});

test('self-improvement promotion gate requires repeated samples before promotion', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xld-self-improve-repeated-samples-'));
  const manifestPath = path.join(root, 'manifest.json');
  writeJson(manifestPath, {
    artifactType: 'xlightsdesigner_self_improvement_loop_manifest_v1',
    initialScope: {
      effects: ['On', 'SingleStrand'],
      blockedEffects: ['Shimmer']
    },
    cyclePhases: [],
    promotionGate: {
      minTotalRecords: 1,
      minSubmodelRecords: 0,
      minCustomParentRecords: 0,
      minBuiltInParentRecords: 1,
      minEffectsCovered: 1,
      minSamplesPerPromotablePattern: 3
    }
  });
  const projectDir = path.join(root, 'Project');
  writeJson(path.join(projectDir, 'display', 'target-behavior.json'), {
    artifactType: 'project_target_behavior_learning_v1',
    records: [
      {
        recordId: 'tbl1:matrix-on',
        targetId: 'Matrix',
        targetKind: 'model',
        targetCanonicalType: 'matrix',
        targetFingerprint: 'tmf1:matrix',
        effectName: 'On',
        effectFamily: 'On',
        probeScope: 'target',
        stats: { sampleCount: 1, positiveCount: 1, negativeCount: 0 }
      }
    ]
  });
  writeJson(path.join(projectDir, 'display', 'model-index.json'), {
    artifactType: 'target_metadata_index_v1',
    records: [
      { targetId: 'Matrix', targetKind: 'model', identity: { canonicalType: 'matrix' } }
    ]
  });

  const blocked = await runSelfImprovementCycle({
    manifestPath,
    skipCommands: true,
    projectDirs: [projectDir],
    outDir: path.join(root, 'blocked')
  });
  assert.equal(blocked.promotionGate.promoteReady, false);
  assert.equal(blocked.promotionGate.checks.find((row) => row.id === 'minPromotablePatterns').ok, false);

  const targetBehavior = JSON.parse(fs.readFileSync(path.join(projectDir, 'display', 'target-behavior.json'), 'utf8'));
  targetBehavior.records[0].stats.sampleCount = 3;
  writeJson(path.join(projectDir, 'display', 'target-behavior.json'), targetBehavior);
  const ready = await runSelfImprovementCycle({
    manifestPath,
    skipCommands: true,
    projectDirs: [projectDir],
    outDir: path.join(root, 'ready')
  });
  assert.equal(ready.promotionGate.promoteReady, true);
});

test('self-improvement cycle rejects manifests that include Shimmer', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xld-self-improve-shimmer-'));
  const manifestPath = path.join(root, 'manifest.json');
  writeJson(manifestPath, {
    artifactType: 'xlightsdesigner_self_improvement_loop_manifest_v1',
    initialScope: {
      effects: ['On', 'Shimmer', 'SingleStrand'],
      blockedEffects: ['Shimmer']
    },
    cyclePhases: [],
    promotionGate: {}
  });

  const result = await runSelfImprovementCycle({
    manifestPath,
    skipCommands: true,
    outDir: path.join(root, 'run')
  });

  assert.equal(result.ok, false);
  assert.equal(result.errors.some((error) => /Shimmer/i.test(error)), true);
});

test('self-improvement cycle builds render review artifacts from manifest phases', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xld-self-improve-render-review-'));
  const frameFeaturesPath = path.join(root, 'features.json');
  const intentPath = path.join(root, 'intent.json');
  const manifestPath = path.join(root, 'manifest.json');
  writeJson(frameFeaturesPath, {
    sampledFrameCount: 4,
    nonBlankSampledFrameRatio: 1,
    temporalMotionMean: 0.08,
    temporalMotionPeak: 0.15,
    sampledFrameMetrics: [
      { frameActivePixelRatio: 0.25, frameAverageBrightness: 0.18, frameDominantPixelRatio: 0.02, frameUniqueColorCount: 12 },
      { frameActivePixelRatio: 0.34, frameAverageBrightness: 0.23, frameDominantPixelRatio: 0.03, frameUniqueColorCount: 18 },
      { frameActivePixelRatio: 0.41, frameAverageBrightness: 0.28, frameDominantPixelRatio: 0.04, frameUniqueColorCount: 20 },
      { frameActivePixelRatio: 0.31, frameAverageBrightness: 0.21, frameDominantPixelRatio: 0.02, frameUniqueColorCount: 16 }
    ]
  });
  writeJson(intentPath, {
    section: { id: 'chorus-1', label: 'Chorus 1', startMs: 10000, endMs: 18000 },
    creativeObjective: { coverage: 'wide', motion: 'active' },
    musicRole: { energy: 'high' }
  });
  writeJson(manifestPath, {
    artifactType: 'xlightsdesigner_self_improvement_loop_manifest_v1',
    initialScope: {
      effects: ['On', 'Bars', 'Color Wash', 'SingleStrand'],
      blockedEffects: ['Shimmer']
    },
    cyclePhases: [
      {
        id: 'review_seed_section',
        type: 'render_review',
        reviews: [
          {
            id: 'chorus-1',
            frameFeaturesPath,
            intentPath,
            videoPath: path.join(root, 'chorus-1.mp4')
          }
        ]
      }
    ],
    promotionGate: {}
  });

  const result = await runSelfImprovementCycle({
    manifestPath,
    skipCommands: true,
    outDir: path.join(root, 'run')
  });

  const phase = result.phases.find((row) => row.type === 'render_review');
  assert.equal(result.ok, true);
  assert.equal(phase.ok, true);
  assert.equal(phase.totals.reviewCount, 1);
  assert.equal(fs.existsSync(phase.results[0].outputPath), true);
  const review = JSON.parse(fs.readFileSync(phase.results[0].outputPath, 'utf8'));
  assert.equal(review.artifactType, 'render_review_v1');
  assert.equal(review.section.id, 'chorus-1');
});

test('self-improvement cycle extracts media before render review when frame features are absent', { skip: !hasCommand('ffmpeg') || !hasCommand('ffprobe') }, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xld-self-improve-media-review-'));
  const mediaPath = path.join(root, 'section.mp4');
  const intentPath = path.join(root, 'intent.json');
  const manifestPath = path.join(root, 'manifest.json');
  execFileSync('ffmpeg', [
    '-y',
    '-v', 'error',
    '-f', 'lavfi',
    '-i', 'testsrc=size=96x64:rate=8:duration=2',
    '-pix_fmt', 'yuv420p',
    mediaPath
  ]);
  writeJson(intentPath, {
    section: { id: 'verse-1', label: 'Verse 1', startMs: 0, endMs: 2000 },
    creativeObjective: { coverage: 'wide', motion: 'active' },
    musicRole: { energy: 'high' }
  });
  writeJson(manifestPath, {
    artifactType: 'xlightsdesigner_self_improvement_loop_manifest_v1',
    initialScope: {
      effects: ['On', 'Bars', 'Color Wash', 'SingleStrand'],
      blockedEffects: ['Shimmer']
    },
    cyclePhases: [
      {
        id: 'review_rendered_section',
        type: 'render_review',
        sampleCount: 8,
        reviews: [
          {
            id: 'verse-1',
            mediaPath,
            intentPath,
            startMs: 0,
            endMs: 2000
          }
        ]
      }
    ],
    promotionGate: {}
  });

  const result = await runSelfImprovementCycle({
    manifestPath,
    skipCommands: true,
    outDir: path.join(root, 'run')
  });

  const phase = result.phases.find((row) => row.id === 'review_rendered_section');
  assert.equal(result.ok, true);
  assert.equal(phase.ok, true);
  assert.equal(fs.existsSync(phase.results[0].mediaExtraction.frameFeaturesPath), true);
  assert.equal(fs.existsSync(phase.results[0].mediaExtraction.contactSheetPath), true);
  const review = JSON.parse(fs.readFileSync(phase.results[0].outputPath, 'utf8'));
  assert.equal(review.evidence.videoPath, mediaPath);
  assert.equal(review.evidence.frameFeaturesPath, phase.results[0].mediaExtraction.frameFeaturesPath);
});

test('self-improvement cycle runs FSEQ render review phases', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xld-self-improve-fseq-review-'));
  const geometryPath = path.join(root, 'geometry.json');
  const fseqPath = path.join(root, 'section.fseq');
  const manifestPath = path.join(root, 'manifest.json');
  writeJson(geometryPath, { artifactType: 'preview_scene_geometry_v1' });
  fs.writeFileSync(fseqPath, 'fake-fseq');
  writeJson(manifestPath, {
    artifactType: 'xlightsdesigner_self_improvement_loop_manifest_v1',
    initialScope: {
      effects: ['On', 'Bars', 'Color Wash', 'SingleStrand'],
      blockedEffects: ['Shimmer']
    },
    cyclePhases: [
      {
        id: 'review_fseq_section',
        type: 'fseq_render_review',
        geometryPath,
        windowStartMs: 0,
        windowEndMs: 8000,
        sampleCount: 8,
        reviews: [
          {
            id: 'on-proof',
            fseqPath,
            startMs: 0,
            endMs: 8000
          }
        ]
      }
    ],
    promotionGate: {}
  });

  const result = await runSelfImprovementCycle({
    manifestPath,
    skipCommands: true,
    outDir: path.join(root, 'run'),
    buildFseqReview: ({ outDir, intent }) => {
      const renderReviewPath = path.join(outDir, 'render-review.json');
      writeJson(renderReviewPath, { artifactType: 'render_review_v1' });
      assert.equal(intent.effectName, '');
      return {
        ok: true,
        renderReviewPath,
        decision: 'accept',
        overallQuality: 0.91
      };
    }
  });

  const phase = result.phases.find((row) => row.id === 'review_fseq_section');
  assert.equal(result.ok, true);
  assert.equal(phase.ok, true);
  assert.equal(phase.totals.acceptedCount, 1);
  assert.equal(phase.results[0].decision, 'accept');
  assert.equal(phase.results[0].overallQuality, 0.91);
  assert.equal(fs.existsSync(phase.results[0].renderReviewPath), true);
  assert.equal(result.renderReviewGate.promoteReady, true);
});

test('self-improvement cycle passes manifest target context into FSEQ review builder', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xld-self-improve-fseq-context-'));
  const geometryPath = path.join(root, 'geometry.json');
  const fseqPath = path.join(root, 'section.fseq');
  const manifestPath = path.join(root, 'manifest.json');
  writeJson(geometryPath, { artifactType: 'preview_scene_geometry_v1' });
  fs.writeFileSync(fseqPath, 'fake-fseq');
  writeJson(manifestPath, {
    artifactType: 'xlightsdesigner_self_improvement_loop_manifest_v1',
    initialScope: {
      effects: ['On', 'Bars', 'Color Wash', 'SingleStrand'],
      blockedEffects: ['Shimmer']
    },
    cyclePhases: [
      {
        id: 'review_fseq_section',
        type: 'fseq_render_review',
        geometryPath,
        reviews: [
          {
            id: 'context-proof',
            fseqPath,
            effectName: 'Bars',
            targetHierarchy: {
              leadTargets: ['Lead Target'],
              supportTargets: ['Support Target']
            }
          }
        ]
      }
    ],
    promotionGate: {}
  });

  const result = await runSelfImprovementCycle({
    manifestPath,
    skipCommands: true,
    outDir: path.join(root, 'run'),
    buildFseqReview: ({ outDir, intent }) => {
      const renderReviewPath = path.join(outDir, 'render-review.json');
      writeJson(renderReviewPath, { artifactType: 'render_review_v1' });
      assert.equal(intent.effectName, 'Bars');
      assert.deepEqual(intent.targetHierarchy.leadTargets, ['Lead Target']);
      assert.deepEqual(intent.targetHierarchy.supportTargets, ['Support Target']);
      return {
        ok: true,
        renderReviewPath,
        decision: 'accept',
        overallQuality: 0.91
      };
    }
  });

  assert.equal(result.ok, true);
});

test('self-improvement cycle blocks render-review promotion when reviews need revision', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xld-self-improve-fseq-revise-'));
  const geometryPath = path.join(root, 'geometry.json');
  const fseqPath = path.join(root, 'section.fseq');
  const manifestPath = path.join(root, 'manifest.json');
  writeJson(geometryPath, { artifactType: 'preview_scene_geometry_v1' });
  fs.writeFileSync(fseqPath, 'fake-fseq');
  writeJson(manifestPath, {
    artifactType: 'xlightsdesigner_self_improvement_loop_manifest_v1',
    initialScope: {
      effects: ['On', 'Bars', 'Color Wash', 'SingleStrand'],
      blockedEffects: ['Shimmer']
    },
    cyclePhases: [
      {
        id: 'review_fseq_section',
        type: 'fseq_render_review',
        geometryPath,
        reviews: [{ id: 'needs-revision', fseqPath }]
      }
    ],
    promotionGate: {}
  });

  const result = await runSelfImprovementCycle({
    manifestPath,
    skipCommands: true,
    outDir: path.join(root, 'run'),
    buildFseqReview: ({ outDir }) => {
      const renderReviewPath = path.join(outDir, 'render-review.json');
      writeJson(renderReviewPath, { artifactType: 'render_review_v1' });
      return {
        ok: true,
        renderReviewPath,
        decision: 'revise',
        overallQuality: 0.62
      };
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.renderReviewGate.applicable, true);
  assert.equal(result.renderReviewGate.promoteReady, false);
  assert.equal(result.renderReviewGate.totals.reviseCount, 1);
  assert.equal(result.nextActions[0], 'revise render-review sections and rerun FSEQ/media review before promotion');
});

test('self-improvement cycle builds render-review revision objectives after review phases', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xld-self-improve-review-objectives-'));
  const geometryPath = path.join(root, 'geometry.json');
  const fseqPath = path.join(root, 'section.fseq');
  const manifestPath = path.join(root, 'manifest.json');
  writeJson(geometryPath, { artifactType: 'preview_scene_geometry_v1' });
  fs.writeFileSync(fseqPath, 'fake-fseq');
  writeJson(manifestPath, {
    artifactType: 'xlightsdesigner_self_improvement_loop_manifest_v1',
    initialScope: {
      effects: ['On', 'Bars', 'Color Wash', 'SingleStrand'],
      blockedEffects: ['Shimmer']
    },
    cyclePhases: [
      {
        id: 'review_fseq_section',
        type: 'fseq_render_review',
        geometryPath,
        reviews: [{ id: 'needs-revision', fseqPath }]
      },
      {
        id: 'build_revision_objectives',
        type: 'render_review_revision_objectives'
      },
      {
        id: 'build_revision_attempts',
        type: 'render_review_revision_attempts',
        defaultEffectName: 'Color Wash'
      }
    ],
    promotionGate: {}
  });

  const result = await runSelfImprovementCycle({
    manifestPath,
    skipCommands: true,
    outDir: path.join(root, 'run'),
    buildFseqReview: ({ outDir }) => {
      const renderReviewPath = path.join(outDir, 'render-review.json');
      writeJson(renderReviewPath, {
        artifactType: 'render_review_v1',
        section: { id: 'verse-1', startMs: 0, endMs: 8000 },
        deterministicMetrics: { blankRisk: 0.75, activeCoverageMean: 0.01 },
        qualityScores: { visualReadability: 0.5, intentMatch: 0.6 },
        critique: {
          decision: 'revise',
          issues: ['blank-span risk is high'],
          strengths: [],
          revisionRecommendations: []
        }
      });
      return {
        ok: true,
        renderReviewPath,
        decision: 'revise',
        overallQuality: 0.62
      };
    }
  });

  const objectivePhase = result.phases.find((row) => row.id === 'build_revision_objectives');
  assert.equal(objectivePhase.ok, true);
  assert.equal(objectivePhase.objectiveCount, 1);
  assert.equal(fs.existsSync(objectivePhase.outputPath), true);
  const objectives = JSON.parse(fs.readFileSync(objectivePhase.outputPath, 'utf8'));
  assert.equal(objectives.objectives[0].scope.sectionId, 'verse-1');
  assert.ok(objectives.objectives[0].scope.revisionRoles.includes('increase_section_coverage'));

  const attemptPhase = result.phases.find((row) => row.id === 'build_revision_attempts');
  assert.equal(attemptPhase.ok, true);
  assert.equal(attemptPhase.attemptCount, 1);
  assert.equal(attemptPhase.blockedCount, 1);
  const attempts = JSON.parse(fs.readFileSync(attemptPhase.outputPath, 'utf8'));
  assert.ok(attempts.attempts[0].blockedReasons.includes('missing_revision_targets'));
});
