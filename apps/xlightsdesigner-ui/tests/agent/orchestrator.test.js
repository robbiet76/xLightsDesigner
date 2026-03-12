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

test("orchestrator happy path supports handoff-style command graph", async () => {
  const res = await validateAndApplyPlan({
    endpoint: "http://127.0.0.1:49914/xlDoAutomation",
    commands: [
      { id: "timing.track.create", cmd: "timing.createTrack", params: { trackName: "XD: Sequencer Plan", replaceIfExists: true } },
      {
        id: "timing.marks.insert",
        dependsOn: ["timing.track.create"],
        cmd: "timing.insertMarks",
        params: { trackName: "XD: Sequencer Plan", marks: [{ startMs: 0, endMs: 1000, label: "Chorus 1" }] }
      },
      {
        id: "effect.1",
        dependsOn: ["timing.marks.insert"],
        cmd: "effects.create",
        params: { modelName: "MegaTree", layerIndex: 0, effectName: "Bars", startMs: 0, endMs: 1000 }
      }
    ],
    expectedRevision: "rev-10",
    getRevision: okRevision("rev-10"),
    validateCommands: async () => ({ data: { valid: true, results: [{ index: 0, valid: true }, { index: 1, valid: true }, { index: 2, valid: true }] } }),
    beginTransaction: async () => ({ data: { transactionId: "tx-graph" } }),
    stageTransactionCommand: async () => ({ res: 200 }),
    commitTransaction: async () => ({ data: { newRevision: "rev-11" } }),
    rollbackTransaction: async () => ({ data: { rolledBack: true } })
  });

  assert.equal(res.ok, true);
  assert.equal(res.stage, "done");
  assert.equal(res.executedCount, 3);
  assert.equal(res.nextRevision, "rev-11");
});

test("orchestrator stages corpus-backed effect settings without reinterpretation", async () => {
  const staged = [];
  const command = {
    id: "effect.1",
    cmd: "effects.create",
    params: {
      modelName: "MegaTree",
      layerIndex: 1,
      effectName: "Bars",
      startMs: 0,
      endMs: 1000,
      settings: {
        T_CHOICE_LayerMethod: "Layered",
        T_CHOICE_In_Transition_Type: "Wipe",
        T_CHOICE_Out_Transition_Type: "Circle Explode",
        B_CHOICE_BufferStyle: "Per Preview",
        B_CHOICE_BufferTransform: "Flip Horizontal",
        B_CHOICE_PerPreviewCamera: "2D",
        C_SLIDER_Brightness: 100
      }
    }
  };

  const res = await validateAndApplyPlan({
    endpoint: "http://127.0.0.1:49914/xlDoAutomation",
    commands: [command],
    expectedRevision: "rev-20",
    getRevision: okRevision("rev-20"),
    validateCommands: async () => ({ data: { valid: true, results: [{ index: 0, valid: true }] } }),
    beginTransaction: async () => ({ data: { transactionId: "tx-settings" } }),
    stageTransactionCommand: async (_endpoint, txId, stagedCommand) => {
      staged.push({ txId, stagedCommand });
      return { res: 200 };
    },
    commitTransaction: async () => ({ data: { newRevision: "rev-21" } }),
    rollbackTransaction: async () => ({ data: { rolledBack: true } })
  });

  assert.equal(res.ok, true);
  assert.equal(staged.length, 1);
  assert.deepEqual(staged[0].stagedCommand.params.settings, command.params.settings);
});

test("orchestrator stages forced group-expansion metadata without reinterpretation", async () => {
  const staged = [];
  const command = {
    id: "effect.1",
    cmd: "effects.create",
    params: {
      modelName: "WindowLeft",
      layerIndex: 0,
      effectName: "Bars",
      startMs: 0,
      endMs: 1000,
      sourceGroupId: "NestedFrontline",
      sourceGroupRenderPolicy: "overlay",
      sourceGroupBufferStyle: "Overlay - Centered",
      settings: {
        T_CHOICE_LayerMethod: "Layered"
      }
    }
  };

  const res = await validateAndApplyPlan({
    endpoint: "http://127.0.0.1:49914/xlDoAutomation",
    commands: [command],
    expectedRevision: "rev-22",
    getRevision: okRevision("rev-22"),
    validateCommands: async () => ({ data: { valid: true, results: [{ index: 0, valid: true }] } }),
    beginTransaction: async () => ({ data: { transactionId: "tx-group-meta" } }),
    stageTransactionCommand: async (_endpoint, txId, stagedCommand) => {
      staged.push({ txId, stagedCommand });
      return { res: 200 };
    },
    commitTransaction: async () => ({ data: { newRevision: "rev-23" } }),
    rollbackTransaction: async () => ({ data: { rolledBack: true } })
  });

  assert.equal(res.ok, true);
  assert.equal(staged.length, 1);
  assert.deepEqual(
    {
      sourceGroupId: staged[0].stagedCommand.params.sourceGroupId,
      sourceGroupRenderPolicy: staged[0].stagedCommand.params.sourceGroupRenderPolicy,
      sourceGroupBufferStyle: staged[0].stagedCommand.params.sourceGroupBufferStyle
    },
    {
      sourceGroupId: "NestedFrontline",
      sourceGroupRenderPolicy: "overlay",
      sourceGroupBufferStyle: "Overlay - Centered"
    }
  );
});

test("orchestrator stages picture and video file paths without reinterpretation", async () => {
  const staged = [];
  const commands = [
    {
      id: "effect.picture.1",
      cmd: "effects.create",
      params: {
        modelName: "MegaTree",
        layerIndex: 0,
        effectName: "Pictures",
        startMs: 0,
        endMs: 1000,
        settings: {
          E_TEXTCTRL_Pictures_Filename: "/Users/robterry/Documents/Lights/assets/snowflake.png"
        }
      }
    },
    {
      id: "effect.video.1",
      cmd: "effects.create",
      params: {
        modelName: "Matrix",
        layerIndex: 1,
        effectName: "Video",
        startMs: 1000,
        endMs: 2500,
        settings: {
          E_FILEPICKERCTRL_Video_Filename: "/Users/robterry/Documents/Lights/assets/intro.mp4"
        }
      }
    }
  ];

  const res = await validateAndApplyPlan({
    endpoint: "http://127.0.0.1:49914/xlDoAutomation",
    commands,
    expectedRevision: "rev-media-1",
    getRevision: okRevision("rev-media-1"),
    validateCommands: async () => ({ data: { valid: true, results: [{ index: 0, valid: true }, { index: 1, valid: true }] } }),
    beginTransaction: async () => ({ data: { transactionId: "tx-media-paths" } }),
    stageTransactionCommand: async (_endpoint, txId, stagedCommand) => {
      staged.push({ txId, stagedCommand });
      return { res: 200 };
    },
    commitTransaction: async () => ({ data: { newRevision: "rev-media-2" } }),
    rollbackTransaction: async () => ({ data: { rolledBack: true } })
  });

  assert.equal(res.ok, true);
  assert.equal(staged.length, 2);
  assert.equal(staged[0].stagedCommand.params.settings.E_TEXTCTRL_Pictures_Filename, "/Users/robterry/Documents/Lights/assets/snowflake.png");
  assert.equal(staged[1].stagedCommand.params.settings.E_FILEPICKERCTRL_Video_Filename, "/Users/robterry/Documents/Lights/assets/intro.mp4");
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
