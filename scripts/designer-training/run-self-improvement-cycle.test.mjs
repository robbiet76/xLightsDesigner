import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { runSelfImprovementCycle } from './run-self-improvement-cycle.mjs';

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
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
