import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  runRenderReviewRevisionAttempt,
  runRenderReviewRevisionAttempts
} from './run-render-review-revision-attempts.mjs';

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function response(json, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(json)
  };
}

function attempt(sequencePath) {
  return {
    artifactType: 'render_review_revision_attempt_v1',
    attemptId: 'rrra1:test',
    status: 'planned',
    source: {
      revisionObjectiveId: 'rrro1:test',
      sequencePath
    },
    targets: [{ targetId: 'target-1', element: 'Lead Target' }],
    effectPlan: { effectName: 'On' },
    ownedBatchPayload: {
      track: 'XD: Render Review Revision',
      effects: [
        { element: 'Lead Target', layer: 0, effectName: 'On', startMs: 0, endMs: 8000, settings: '', palette: '', clearExisting: false }
      ]
    }
  };
}

test('runRenderReviewRevisionAttempt applies, saves, renders, and resolves FSEQ', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xld-render-revision-exec-'));
  const sequencePath = path.join(root, 'revision.xsq');
  const fseqPath = path.join(root, 'revision.fseq');
  fs.writeFileSync(sequencePath, '<xsequence/>');
  fs.writeFileSync(fseqPath, 'fake-fseq');
  const calls = [];
  const deps = {
    pollMs: 1,
    request: async (url, options = {}) => {
      const route = new URL(url).pathname.replace('/xlightsdesigner/api', '');
      calls.push({ route, method: options.method || 'GET', body: options.body ? JSON.parse(options.body) : null });
      if (route === '/health') return response({ ok: true, data: { state: 'ready', startupSettled: true } });
      if (route === '/media/current') return response({ ok: true, data: { sequencePath, showDirectory: root } });
      return response({ ok: true, data: { fseqPath: route === '/sequence/render-current' ? fseqPath : '' } });
    }
  };

  const result = await runRenderReviewRevisionAttempt({
    endpoint: 'http://127.0.0.1:49915/xlightsdesigner/api',
    attempt: attempt(sequencePath),
    deps
  });

  assert.equal(result.ok, true);
  assert.equal(result.fseqPath, fseqPath);
  assert.deepEqual(
    calls.map((call) => call.route).filter((route) => route !== '/health' && route !== '/media/current'),
    [
      '/sequence/close',
      '/sequence/open',
      '/sequencing/apply-batch-plan',
      '/sequence/save',
      '/sequence/render-current',
      '/sequence/close'
    ]
  );
  assert.equal(calls.find((call) => call.route === '/sequencing/apply-batch-plan').body.effects[0].element, 'Lead Target');
});

test('runRenderReviewRevisionAttempts writes an execution index and skips blocked attempts', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xld-render-revision-index-'));
  const attemptsPath = path.join(root, 'attempts.json');
  const outPath = path.join(root, 'execution.json');
  writeJson(attemptsPath, {
    artifactType: 'render_review_revision_attempt_plan_index_v1',
    attempts: [
      { artifactType: 'render_review_revision_attempt_v1', attemptId: 'blocked', status: 'blocked' }
    ]
  });

  const artifact = await runRenderReviewRevisionAttempts({ attemptsPath, outPath });

  assert.equal(artifact.artifactType, 'render_review_revision_attempt_execution_index_v1');
  assert.equal(artifact.summary.executionCount, 1);
  assert.equal(artifact.summary.skippedCount, 1);
  assert.equal(artifact.results[0].skipReason, 'attempt status is blocked');
  assert.equal(fs.existsSync(outPath), true);
});
