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
    beginTransaction: async () => ({ data: { transactionId: 'tx-1' } }),
    stageTransactionCommand: async () => ({ res: 200 }),
    commitTransaction: async () => ({ data: { newRevision: 'rev-next' } }),
    rollbackTransaction: async () => ({ data: { rolledBack: true } })
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
    beginTransaction: async () => ({ data: { transactionId: 'tx-1' } }),
    stageTransactionCommand: async () => ({ res: 200 }),
    commitTransaction: async () => ({ data: { newRevision: 'rev-next' } }),
    rollbackTransaction: async () => ({ data: { rolledBack: true } })
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
    beginTransaction: async () => ({ data: { transactionId: 'tx-1' } }),
    stageTransactionCommand: async () => ({ res: 200 }),
    commitTransaction: async () => ({ data: { newRevision: 'rev-next' } }),
    rollbackTransaction: async () => ({ data: { rolledBack: true } })
  });

  assert.equal(res.ok, false);
  assert.equal(res.stage, "graph");
  assert.match(String(res.error || ""), /Duplicate write command/i);
});

test('orchestrator executes when safety/revision/validation pass', async () => {
  const staged = [];
  const res = await validateAndApplyPlan({
    endpoint: 'http://127.0.0.1:49914/xlDoAutomation',
    commands: [{ cmd: 'timing.createTrack', params: { trackName: 'XD:Test' } }],
    expectedRevision: 'rev-2',
    getRevision: okRevision('rev-2'),
    validateCommands: async () => ({ data: { valid: true, results: [{ index: 0, valid: true }] } }),
    beginTransaction: async () => ({ data: { transactionId: 'tx-1' } }),
    stageTransactionCommand: async (_endpoint, txId, command) => {
      staged.push({ txId, command });
      return { res: 200 };
    },
    commitTransaction: async (_endpoint, txId, expectedRevision) => ({ data: { transactionId: txId, newRevision: `${expectedRevision}-next` } }),
    rollbackTransaction: async () => ({ data: { rolledBack: true } })
  });

  assert.equal(res.ok, true);
  assert.equal(res.stage, 'done');
  assert.equal(res.executedCount, 1);
  assert.equal(res.jobId, null);
  assert.equal(staged.length, 1);
  assert.equal(res.nextRevision, 'rev-2-next');
});

test("orchestrator rolls back staged transaction on runtime failure", async () => {
  const staged = [];
  let rolledBack = false;
  const res = await validateAndApplyPlan({
    endpoint: "http://127.0.0.1:49914/xlDoAutomation",
    commands: [{ cmd: "effects.create", params: { modelName: "MegaTree", layerIndex: 0, effectName: "Bars", startMs: 0, endMs: 1000 } }],
    expectedRevision: "rev-2",
    getRevision: okRevision("rev-2"),
    validateCommands: async () => ({ data: { valid: true, results: [{ index: 0, valid: true }] } }),
    beginTransaction: async () => ({ data: { transactionId: "tx-1" } }),
    stageTransactionCommand: async (_endpoint, txId, command) => {
      staged.push({ txId, command });
      throw new Error("stage failed");
    },
    commitTransaction: async (_endpoint, txId, expectedRevision) => ({ data: { transactionId: txId, newRevision: `${expectedRevision}-next` } }),
    rollbackTransaction: async () => {
      rolledBack = true;
      return { data: { rolledBack: true } };
    }
  });

  assert.equal(res.ok, false);
  assert.equal(res.stage, "runtime");
  assert.equal(staged.length, 1);
  assert.equal(rolledBack, true);
});
