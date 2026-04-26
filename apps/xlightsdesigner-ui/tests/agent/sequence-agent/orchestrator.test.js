import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluatePlanSafety } from '../../../agent/safety-policy.js';
import { buildOwnedSequencingBatchPlan, validateAndApplyPlan } from '../../../agent/sequence-agent/orchestrator.js';

function compressibleCommands(overrides = {}) {
  const trackName = overrides.trackName || 'XD: Song Structure';
  return [
    { id: 'timing.track.create', cmd: 'timing.createTrack', params: { trackName, replaceIfExists: true } },
    {
      id: 'timing.marks.insert',
      dependsOn: ['timing.track.create'],
      cmd: overrides.markCommand || 'timing.insertMarks',
      params: {
        trackName,
        marks: overrides.marks || [
          { startMs: 0, endMs: 1000, label: 'Intro' },
          { startMs: 1000, endMs: 2000, label: 'Verse 1' }
        ]
      }
    },
    {
      id: 'effect.1',
      dependsOn: ['timing.marks.insert'],
      cmd: 'effects.create',
      params: {
        modelName: overrides.modelName || 'Snowman',
        layerIndex: overrides.layerIndex ?? 0,
        effectName: overrides.effectName || 'Color Wash',
        startMs: overrides.startMs ?? 1000,
        endMs: overrides.endMs ?? 2000,
        settings: overrides.settings ?? '',
        palette: overrides.palette ?? '',
        ...(overrides.effectParams || {})
      }
    },
    ...(overrides.extraCommands || [])
  ];
}

function ownedDeps(overrides = {}) {
  return {
    getOwnedHealth: async () => ({ ok: true, data: { state: 'ready', listenerReachable: true, appReady: true, startupSettled: true } }),
    getOwnedRevision: async () => ({ data: { revision: overrides.revision || 'rev-1' } }),
    applySequencingBatchPlan: async () => ({ data: { jobId: overrides.jobId || 'owned-job-1' } }),
    getOwnedJob: async () => ({ data: { state: 'succeeded' } }),
    ...overrides
  };
}

test('evaluatePlanSafety blocks forbidden commands', () => {
  const result = evaluatePlanSafety([
    { cmd: 'layout.setModel', params: {} },
    { cmd: 'timing.createTrack', params: {} }
  ]);

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('Blocked command')));
});

test('evaluatePlanSafety blocks conflicting timing write groups', () => {
  const result = evaluatePlanSafety([
    { cmd: 'timing.insertMarks', params: { trackName: 'XD: Beats', marks: [] } },
    { cmd: 'timing.replaceMarks', params: { trackName: 'XD: Beats', marks: [] } }
  ]);

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => /Conflicting timing write group/i.test(error)));
});

test('orchestrator blocks on invalid command graph before owned apply', async () => {
  const res = await validateAndApplyPlan({
    endpoint: 'http://127.0.0.1:49915/xlightsdesigner/api',
    commands: [
      { cmd: 'timing.createTrack', params: { trackName: 'XD: Test' } },
      { cmd: 'timing.createTrack', params: { trackName: 'XD: Test' } }
    ],
    ...ownedDeps()
  });

  assert.equal(res.ok, false);
  assert.equal(res.stage, 'graph');
  assert.match(String(res.error || ''), /Duplicate write command/i);
});

test('orchestrator rejects command graphs that cannot be expressed as owned batch plans', async () => {
  const res = await validateAndApplyPlan({
    endpoint: 'http://127.0.0.1:49915/xlightsdesigner/api',
    commands: [{ cmd: 'effects.create', params: { modelName: 'MegaTree', layerIndex: 0, effectName: 'Bars', startMs: 0, endMs: 1000 } }],
    ...ownedDeps()
  });

  assert.equal(res.ok, false);
  assert.equal(res.stage, 'unsupported');
  assert.match(String(res.error || ''), /owned xLights batch plan/i);
});

test('orchestrator blocks on owned revision mismatch', async () => {
  const res = await validateAndApplyPlan({
    endpoint: 'http://127.0.0.1:49915/xlightsdesigner/api',
    commands: compressibleCommands(),
    expectedRevision: 'rev-expected',
    ...ownedDeps({ revision: 'rev-current' })
  });

  assert.equal(res.ok, false);
  assert.equal(res.stage, 'revision');
});

test('orchestrator applies compressible plans through owned batch apply', async () => {
  let applyCalls = 0;
  let ownedJobCalls = 0;
  const res = await validateAndApplyPlan({
    endpoint: 'http://127.0.0.1:49915/xlightsdesigner/api',
    commands: compressibleCommands(),
    expectedRevision: 'rev-1',
    ...ownedDeps({
      applySequencingBatchPlan: async (_endpoint, payload) => {
        applyCalls += 1;
        assert.equal(payload.track, 'XD: Song Structure');
        assert.equal(payload.replaceExistingMarks, true);
        assert.equal(payload.marks.length, 2);
        assert.equal(payload.effects.length, 1);
        return { data: { jobId: 'owned-job-1' } };
      },
      getOwnedJob: async () => {
        ownedJobCalls += 1;
        return { data: { state: 'succeeded' } };
      }
    })
  });

  assert.equal(res.ok, true);
  assert.equal(res.stage, 'done');
  assert.equal(res.applyPath, 'owned_batch_plan');
  assert.equal(res.executedCount, 3);
  assert.equal(res.jobId, 'owned-job-1');
  assert.equal(applyCalls, 1);
  assert.equal(ownedJobCalls, 1);
});

test('orchestrator applies display-order commands through owned direct API', async () => {
  let orderCall = null;
  const res = await validateAndApplyPlan({
    endpoint: 'http://127.0.0.1:49915/xlightsdesigner/api',
    commands: [
      {
        id: 'display.order.1',
        cmd: 'sequencer.setDisplayElementOrder',
        params: { orderedIds: ['Lyrics', 'AllModels', 'MegaTree'] }
      }
    ],
    expectedRevision: 'rev-1',
    ...ownedDeps({
      setDisplayElementOrder: async (endpoint, orderedIds) => {
        orderCall = { endpoint, orderedIds };
        return { ok: true, data: { changed: true } };
      }
    })
  });

  assert.equal(res.ok, true);
  assert.equal(res.applyPath, 'owned_direct_commands');
  assert.equal(res.directExecuted, 1);
  assert.deepEqual(orderCall.orderedIds, ['Lyrics', 'AllModels', 'MegaTree']);
});

test('orchestrator applies timing and update commands directly when no create batch exists', async () => {
  const calls = [];
  const res = await validateAndApplyPlan({
    endpoint: 'http://127.0.0.1:49915/xlightsdesigner/api',
    commands: [
      { id: 'timing.track.create', cmd: 'timing.createTrack', params: { trackName: 'XD: Revision Timing', replaceIfExists: true } },
      {
        id: 'timing.marks.insert',
        dependsOn: ['timing.track.create'],
        cmd: 'timing.insertMarks',
        params: {
          trackName: 'XD: Revision Timing',
          marks: [
            { label: 'Chorus', startMs: 0, endMs: 1000 },
            { label: 'Verse', startMs: 1000, endMs: 2000 }
          ]
        }
      },
      {
        id: 'effect.1',
        dependsOn: ['timing.marks.insert'],
        cmd: 'effects.update',
        params: {
          modelName: 'Star',
          layerIndex: 0,
          startMs: 0,
          endMs: 2000,
          effectName: 'On',
          newEffectName: 'Shimmer',
          newStartMs: 0,
          newEndMs: 1000
        }
      }
    ],
    expectedRevision: 'rev-1',
    ...ownedDeps({
      createTimingTrack: async (_endpoint, params) => {
        calls.push(['createTimingTrack', params.trackName]);
        return { ok: true };
      },
      insertTimingMarks: async (_endpoint, params) => {
        calls.push(['insertTimingMarks', params.trackName, params.marks.length]);
        return { ok: true, data: { addedMarkCount: params.marks.length } };
      },
      updateEffect: async (_endpoint, params) => {
        calls.push(['updateEffect', params.element, params.newEffectName]);
        return { data: { jobId: 'owned-job-update-direct' } };
      }
    })
  });

  assert.equal(res.ok, true);
  assert.equal(res.applyPath, 'owned_direct_commands');
  assert.deepEqual(calls, [
    ['createTimingTrack', 'XD: Revision Timing'],
    ['insertTimingMarks', 'XD: Revision Timing', 2],
    ['updateEffect', 'Star', 'Shimmer']
  ]);
});

test('orchestrator applies owned clone command directly', async () => {
  const calls = [];
  const res = await validateAndApplyPlan({
    endpoint: 'http://127.0.0.1:49915/xlightsdesigner/api',
    commands: [
      {
        id: 'effect.clone.native.1',
        cmd: 'effects.clone',
        params: {
          sourceModelName: 'Star',
          sourceLayerIndex: 0,
          sourceStartMs: 1000,
          sourceEndMs: 5000,
          targetModelName: 'MegaTree',
          targetLayerIndex: 1,
          targetStartMs: 8000,
          mode: 'move'
        }
      }
    ],
    expectedRevision: 'rev-1',
    ...ownedDeps({
      cloneEffects: async (_endpoint, params) => {
        calls.push(params);
        return { data: { jobId: 'owned-job-clone-1' } };
      }
    })
  });

  assert.equal(res.ok, true);
  assert.equal(res.applyPath, 'owned_direct_commands');
  assert.deepEqual(calls, [{
    sourceElement: 'Star',
    targetElement: 'MegaTree',
    sourceLayer: 0,
    targetLayer: 1,
    sourceStartMs: 1000,
    sourceEndMs: 5000,
    targetStartMs: 8000,
    mode: 'move'
  }]);
});

test('orchestrator applies batch plan plus direct layer edits in command order', async () => {
  const calls = [];
  const res = await validateAndApplyPlan({
    endpoint: 'http://127.0.0.1:49915/xlightsdesigner/api',
    commands: [
      ...compressibleCommands(),
      {
        id: 'effect.update.1',
        dependsOn: ['effect.1'],
        cmd: 'effects.update',
        params: {
          modelName: 'Snowman',
          layerIndex: 0,
          startMs: 1000,
          endMs: 2000,
          effectName: 'Color Wash',
          newLayerIndex: 1,
          newStartMs: 1000,
          newEndMs: 2200
        }
      },
      {
        id: 'layer.reorder.1',
        dependsOn: ['effect.update.1'],
        cmd: 'effects.reorderLayer',
        params: { modelName: 'Snowman', fromLayerIndex: 1, toLayerIndex: 0 }
      },
      {
        id: 'layer.compact.1',
        dependsOn: ['layer.reorder.1'],
        cmd: 'effects.compactLayers',
        params: { modelName: 'Snowman' }
      }
    ],
    expectedRevision: 'rev-1',
    ...ownedDeps({
      applySequencingBatchPlan: async () => {
        calls.push('batch');
        return { data: { jobId: 'owned-job-batch-1' } };
      },
      updateEffect: async (_endpoint, params) => {
        calls.push(['update', params]);
        return { data: { jobId: 'owned-job-update-1' } };
      },
      reorderEffectLayer: async (_endpoint, params) => {
        calls.push(['reorder', params]);
        return { data: { jobId: 'owned-job-reorder-1' } };
      },
      compactEffectLayers: async (_endpoint, params) => {
        calls.push(['compact', params]);
        return { data: { jobId: 'owned-job-compact-1' } };
      }
    })
  });

  assert.equal(res.ok, true);
  assert.equal(res.applyPath, 'owned_batch_plan_plus_direct');
  assert.equal(res.directExecuted, 3);
  assert.equal(calls[0], 'batch');
  assert.deepEqual(calls[1], ['update', {
    element: 'Snowman',
    layer: 0,
    startMs: 1000,
    endMs: 2000,
    effectName: 'Color Wash',
    newLayer: 1,
    newStartMs: 1000,
    newEndMs: 2200
  }]);
  assert.deepEqual(calls[2], ['reorder', { element: 'Snowman', fromLayer: 1, toLayer: 0 }]);
  assert.deepEqual(calls[3], ['compact', { element: 'Snowman' }]);
});

test('orchestrator fails closed when owned health is unavailable', async () => {
  const res = await validateAndApplyPlan({
    endpoint: 'http://127.0.0.1:49915/xlightsdesigner/api',
    commands: compressibleCommands(),
    ...ownedDeps({
      getOwnedHealth: async () => {
        throw new Error('Failed to fetch');
      },
      applySequencingBatchPlan: async () => {
        throw new Error('owned path should not execute when health is unavailable');
      }
    })
  });

  assert.equal(res.ok, false);
  assert.equal(res.stage, 'runtime');
  assert.match(String(res.error || ''), /owned xLights API unavailable/i);
});

test('orchestrator fails closed when owned batch apply fails', async () => {
  const res = await validateAndApplyPlan({
    endpoint: 'http://127.0.0.1:49915/xlightsdesigner/api',
    commands: compressibleCommands(),
    ...ownedDeps({
      applySequencingBatchPlan: async () => {
        throw new Error('Failed to fetch');
      }
    })
  });

  assert.equal(res.ok, false);
  assert.equal(res.stage, 'runtime');
  assert.match(String(res.error || ''), /owned sequencing\.applyBatchPlan failed/i);
});

test('orchestrator fails closed when owned job fails', async () => {
  const res = await validateAndApplyPlan({
    endpoint: 'http://127.0.0.1:49915/xlightsdesigner/api',
    commands: compressibleCommands(),
    ...ownedDeps({
      getOwnedJob: async () => ({ data: { state: 'failed', result: { error: { message: 'effect rejected' } } } })
    })
  });

  assert.equal(res.ok, false);
  assert.equal(res.stage, 'runtime');
  assert.match(String(res.error || ''), /effect rejected/i);
});

test('orchestrator fails closed when a modal appears during owned job polling', async () => {
  let healthCalls = 0;
  const res = await validateAndApplyPlan({
    endpoint: 'http://127.0.0.1:49915/xlightsdesigner/api',
    commands: compressibleCommands(),
    ...ownedDeps({
      getOwnedHealth: async () => {
        healthCalls += 1;
        return healthCalls === 1
          ? { ok: true, data: { state: 'ready', listenerReachable: true, appReady: true, startupSettled: true } }
          : {
              ok: true,
              data: {
                state: 'ready',
                listenerReachable: true,
                appReady: true,
                startupSettled: true,
                modalState: {
                  observed: true,
                  blocked: true,
                  modalCount: 1,
                  windows: [{ title: 'Error' }]
                }
              }
            };
      },
      getOwnedJob: async () => {
        throw new Error('job polling should not continue while modal blocked');
      }
    })
  });

  assert.equal(res.ok, false);
  assert.equal(res.stage, 'runtime');
  assert.match(String(res.error || ''), /blocked by xLights modal.*Error/i);
});

test('orchestrator preserves owned clone target conflict details', async () => {
  const res = await validateAndApplyPlan({
    endpoint: 'http://127.0.0.1:49915/xlightsdesigner/api',
    commands: [
      {
        id: 'effects.clone.1',
        cmd: 'effects.clone',
        params: {
          sourceModelName: 'Star',
          sourceLayerIndex: 0,
          sourceStartMs: 1000,
          sourceEndMs: 2000,
          targetModels: ['MegaTree'],
          targetLayerIndex: 1,
          targetStartMs: 4000
        }
      }
    ],
    ...ownedDeps({
      cloneEffects: async () => ({ data: { jobId: 'owned-job-clone-conflict' } }),
      getOwnedJob: async () => ({
        data: {
          state: 'failed',
          result: {
            error: {
              code: 'TARGET_WINDOW_OCCUPIED',
              message: 'Clone target layer/time window overlaps existing effects.',
              details: { conflictCount: 2 }
            }
          }
        }
      })
    })
  });

  assert.equal(res.ok, false);
  assert.equal(res.stage, 'runtime');
  assert.match(String(res.error || ''), /TARGET_WINDOW_OCCUPIED/);
  assert.match(String(res.error || ''), /2 target conflicts/);
});

test('orchestrator accepts alignToTiming commands that match the owned batch track', async () => {
  let applyCalls = 0;
  const res = await validateAndApplyPlan({
    endpoint: 'http://127.0.0.1:49915/xlightsdesigner/api',
    commands: compressibleCommands({
      extraCommands: [
        {
          id: 'effect.align.1',
          dependsOn: ['effect.1'],
          cmd: 'effects.alignToTiming',
          params: { modelName: 'Snowman', layerIndex: 0, startMs: 1000, endMs: 2000, timingTrackName: 'XD: Song Structure', mode: 'nearest' }
        }
      ]
    }),
    ...ownedDeps({
      applySequencingBatchPlan: async (_endpoint, payload) => {
        applyCalls += 1;
        assert.equal(payload.track, 'XD: Song Structure');
        assert.equal(payload.effects.length, 1);
        return { data: { jobId: 'owned-job-align-1' } };
      }
    })
  });

  assert.equal(res.ok, true);
  assert.equal(res.applyPath, 'owned_batch_plan');
  assert.equal(applyCalls, 1);
});

test('owned batch builder preserves corpus-backed settings and metadata payloads', () => {
  const settings = {
    T_CHOICE_LayerMethod: 'Layered',
    T_CHOICE_In_Transition_Type: 'Wipe',
    T_CHOICE_Out_Transition_Type: 'Circle Explode',
    B_CHOICE_BufferStyle: 'Per Preview',
    E_TEXTCTRL_Pictures_Filename: '/Users/robterry/Documents/Lights/assets/snowflake.png'
  };
  const palette = { C_BUTTON_Palette1: '#ffffff' };
  const commands = compressibleCommands({
    modelName: 'MegaTree',
    effectName: 'Pictures',
    settings,
    palette,
    effectParams: {
      sourceGroupId: 'NestedFrontline',
      sourceGroupRenderPolicy: 'overlay',
      sourceGroupBufferStyle: 'Overlay - Centered'
    }
  });

  const batchPlan = buildOwnedSequencingBatchPlan(commands);

  assert.equal(batchPlan.track, 'XD: Song Structure');
  assert.equal(batchPlan.effects.length, 1);
  assert.deepEqual(batchPlan.effects[0].settings, settings);
  assert.deepEqual(batchPlan.effects[0].palette, palette);
  assert.equal(batchPlan.effects[0].element, 'MegaTree');
});
