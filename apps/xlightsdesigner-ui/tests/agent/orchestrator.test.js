import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluatePlanSafety } from '../../agent/safety-policy.js';
import { validateAndApplyPlan } from '../../agent/orchestrator.js';

function okRevision(revision = 'rev-1') {
  return async () => ({ data: { revision } });
}

test('evaluatePlanSafety blocks forbidden commands', () => {
  const result = evaluatePlanSafety([
    { cmd: 'layout.setModel', params: {} },
    { cmd: 'timing.createTrack', params: {} }
  ]);

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes('Blocked command')));
});

test("evaluatePlanSafety blocks conflicting timing write groups", () => {
  const result = evaluatePlanSafety([
    { cmd: "timing.insertMarks", params: { trackName: "XD: Beats", marks: [] } },
    { cmd: "timing.replaceMarks", params: { trackName: "XD: Beats", marks: [] } }
  ]);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => /Conflicting timing write group/i.test(e)));
});

test('orchestrator blocks on revision mismatch', async () => {
  const res = await validateAndApplyPlan({
    endpoint: 'http://127.0.0.1:49914/xlDoAutomation',
    commands: [{ cmd: 'timing.createTrack', params: { trackName: 'X' } }],
    expectedRevision: 'rev-expected',
    getRevision: okRevision('rev-current'),
    validateCommands: async () => ({ data: { valid: true } }),
    executePlan: async () => ({ data: { executedCount: 1 } })
  });

  assert.equal(res.ok, false);
  assert.equal(res.stage, 'revision');
});

test('orchestrator blocks on command validation failure', async () => {
  const res = await validateAndApplyPlan({
    endpoint: 'http://127.0.0.1:49914/xlDoAutomation',
    commands: [{ cmd: 'timing.createTrack', params: { trackName: '' } }],
    expectedRevision: 'rev-1',
    getRevision: okRevision('rev-1'),
    validateCommands: async () => ({
      data: {
        valid: false,
        results: [{ index: 0, valid: false, error: { code: 'VALIDATION_ERROR', message: 'trackName required' } }]
      }
    }),
    executePlan: async () => ({ data: { executedCount: 1 } })
  });

  assert.equal(res.ok, false);
  assert.equal(res.stage, 'validate');
  assert.match(String(res.error || ''), /trackName required/i);
});

test("orchestrator blocks on invalid command graph", async () => {
  const res = await validateAndApplyPlan({
    endpoint: "http://127.0.0.1:49914/xlDoAutomation",
    commands: [
      { cmd: "timing.createTrack", params: { trackName: "XD: Test" } },
      { cmd: "timing.createTrack", params: { trackName: "XD: Test" } }
    ],
    expectedRevision: "rev-1",
    getRevision: okRevision("rev-1"),
    validateCommands: async () => ({ data: { valid: true, results: [] } }),
    executePlan: async () => ({ data: { executedCount: 2 } })
  });

  assert.equal(res.ok, false);
  assert.equal(res.stage, "graph");
  assert.match(String(res.error || ""), /Duplicate write command/i);
});

test('orchestrator executes when safety/revision/validation pass', async () => {
  const res = await validateAndApplyPlan({
    endpoint: 'http://127.0.0.1:49914/xlDoAutomation',
    commands: [{ cmd: 'timing.createTrack', params: { trackName: 'XD:Test' } }],
    expectedRevision: 'rev-2',
    getRevision: okRevision('rev-2'),
    validateCommands: async () => ({ data: { valid: true, results: [{ index: 0, valid: true }] } }),
    executePlan: async () => ({ data: { executedCount: 1, jobId: 'job-123' } })
  });

  assert.equal(res.ok, true);
  assert.equal(res.stage, 'done');
  assert.equal(res.executedCount, 1);
  assert.equal(res.jobId, 'job-123');
});
