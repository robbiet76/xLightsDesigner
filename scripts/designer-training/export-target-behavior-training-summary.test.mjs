import test from 'node:test';
import assert from 'node:assert/strict';

import { buildTargetBehaviorTrainingSummary } from './export-target-behavior-training-summary.mjs';

test('target behavior training summary anonymizes target names and ids', () => {
  const summary = buildTargetBehaviorTrainingSummary({
    sourceLabel: 'fixture-project',
    targetBehavior: {
      artifactType: 'project_target_behavior_learning_v1',
      records: [
        {
          recordId: 'tbl1:mouth-on',
          targetId: 'CustomFace/@Mouth',
          targetKind: 'submodel',
          targetFingerprint: 'tmf1:mouth001',
          fingerprintVersion: 'target-metadata-fingerprint-v1',
          displayName: 'Custom Face / Mouth',
          parentId: 'CustomFace',
          parentName: 'Custom Face',
          effectName: 'On',
          effectFamily: 'On',
          probeScope: 'submodel',
          structureHints: ['custom_submodel', 'partial_region'],
          submodelContext: {
            siblingCount: 8,
            overlappingSiblingIds: ['CustomFace/@Mouth2'],
            nodeCoverage: { nodeCount: 12, parentNodeCount: 143, ratio: 0.0839 }
          },
          parentContext: {
            targetId: 'CustomFace',
            targetKind: 'model',
            displayName: 'Custom Face',
            canonicalType: 'custom',
            rawType: 'Custom',
            targetFingerprint: 'tmf1:custom-face',
            fingerprintVersion: 'target-metadata-fingerprint-v1',
            customStructure: {
              profile: 'custom_sparse_shape',
              traits: ['custom_grid'],
              nodeCount: 143,
              submodelCount: 8,
              constructionSource: 'layout.getModelNodes'
            }
          },
          evidenceRefs: {
            renderObservationRef: 'render-1',
            applyResultRef: 'apply-1'
          },
          outcome: {
            coverageRead: 'partial',
            temporalRead: 'flat',
            readability: 'good',
            activeCoverageRatio: 0.1,
            confidence: 'observed',
            notes: ['Reads cleanly']
          },
          stats: {
            sampleCount: 3,
            positiveCount: 3,
            negativeCount: 0,
            lastObservedAt: '2026-05-01T12:00:00Z'
          }
        }
      ]
    },
    modelIndex: {
      records: [
        { targetId: 'CustomFace', targetKind: 'model', identity: { canonicalType: 'custom' } },
        { targetId: 'CustomFace/@Mouth', targetKind: 'submodel', identity: { canonicalType: 'submodel' } }
      ]
    }
  });

  assert.equal(summary.summary.recordCount, 1);
  assert.equal(summary.summary.submodelRecordCount, 1);
  assert.equal(summary.summary.customParentRecordCount, 1);
  assert.equal(summary.summary.modelIndex.customModelCount, 1);
  assert.equal(summary.records[0].targetFingerprintHash.startsWith('tfh1:'), true);
  assert.equal(summary.records[0].parentContext.targetFingerprintHash.startsWith('tfh1:'), true);
  assert.equal(summary.records[0].submodelContext.overlappingSiblingCount, 1);
  assert.equal(summary.records[0].evidence.hasRenderObservation, true);
  assert.equal(summary.records[0].evidence.hasApplyResult, true);

  const serialized = JSON.stringify(summary);
  assert.equal(serialized.includes('CustomFace'), false);
  assert.equal(serialized.includes('Custom Face'), false);
  assert.equal(serialized.includes('@Mouth'), false);
  assert.equal(serialized.includes('render-1'), false);
  assert.equal(serialized.includes('apply-1'), false);
});

test('target behavior training summary cli default source label is neutral', async () => {
  const { spawnSync } = await import('node:child_process');
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xld-private-project-name-'));
  const displayDir = path.join(root, 'display');
  fs.mkdirSync(displayDir, { recursive: true });
  fs.writeFileSync(path.join(displayDir, 'target-behavior.json'), JSON.stringify({
    artifactType: 'project_target_behavior_learning_v1',
    records: []
  }));

  const result = spawnSync(process.execPath, [
    'scripts/designer-training/export-target-behavior-training-summary.mjs',
    '--project-dir',
    root
  ], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });

  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.source.label, 'project display artifacts');
  assert.equal(result.stdout.includes(path.basename(root)), false);
});
