#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  assertNoBlockingModal,
  assertOpenShowFolder,
  pathExists,
  postQueued,
  request,
  waitForReady
} from './owned-api-validation-helpers.mjs';

const DEFAULT_ENDPOINT = 'http://127.0.0.1:49915/xlightsdesigner/api';
const DEFAULT_SHOW_DIR = '/Users/robterry/Desktop/Show';
const DEFAULT_VALIDATION_ROOT_NAME = '_xlightsdesigner_api_validation';

function usage() {
  return [
    'Usage:',
    '  node scripts/xlights/validate-owned-sequencing-edit-surface.mjs [options]',
    '',
    'Options:',
    '  --show-dir <path>          Show folder to validate against.',
    '  --endpoint <url>           Owned xLights API base URL.',
    '  --model <name>             Optional model to validate layer edits against.',
    '  --duration-ms <number>     Validation sequence duration. Defaults to 30000.',
    '  --frame-ms <number>        Sequence frame interval. Defaults to 50.',
    '  --run-id <id>              Optional run id. Defaults to timestamp.',
    '  --ready-timeout-ms <n>     Timeout waiting for owned API ready state. Defaults to 120000.',
    '  --help                     Show this help.'
  ].join('\n');
}

function parseArgs(argv) {
  const args = {
    showDir: DEFAULT_SHOW_DIR,
    endpoint: DEFAULT_ENDPOINT,
    model: '',
    durationMs: 30000,
    frameMs: 50,
    runId: new Date().toISOString().replace(/[:.]/g, '-'),
    readyTimeoutMs: 120000
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help') {
      console.log(usage());
      process.exit(0);
    }
    const next = () => {
      i += 1;
      if (i >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[i];
    };
    if (arg === '--show-dir') args.showDir = next();
    else if (arg === '--endpoint') args.endpoint = next().replace(/\/$/, '');
    else if (arg === '--model') args.model = next();
    else if (arg === '--duration-ms') args.durationMs = Number(next());
    else if (arg === '--frame-ms') args.frameMs = Number(next());
    else if (arg === '--run-id') args.runId = next();
    else if (arg === '--ready-timeout-ms') args.readyTimeoutMs = Number(next());
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!Number.isFinite(args.durationMs) || args.durationMs <= 0) throw new Error('--duration-ms must be positive.');
  if (!Number.isFinite(args.frameMs) || args.frameMs <= 0) throw new Error('--frame-ms must be positive.');
  if (!Number.isFinite(args.readyTimeoutMs) || args.readyTimeoutMs <= 0) throw new Error('--ready-timeout-ms must be positive.');
  return args;
}

async function chooseModel(endpoint, requestedModel) {
  const { json } = await request(endpoint, '/layout/models');
  const models = Array.isArray(json?.data?.models) ? json.data.models : [];
  const usable = models
    .map((model) => ({ name: String(model?.name || '').trim(), displayAs: String(model?.displayAs || '').trim() }))
    .filter((model) => model.name && model.displayAs !== 'ModelGroup');
  const selected = requestedModel
    ? usable.find((model) => model.name === requestedModel)
    : usable[0];
  if (!selected) throw new Error(`Model was not found or usable: ${requestedModel || '(auto)'}`);
  return { modelName: selected.name, layoutModelCount: models.length };
}

async function readEffects(endpoint, element, startMs, endMs, layer = null) {
  const query = new URLSearchParams({ element, startMs: String(startMs), endMs: String(endMs) });
  const { json } = await request(endpoint, `/effects/window?${query}`);
  const effects = Array.isArray(json?.data?.effects) ? json.data.effects : [];
  return effects
    .map((effect) => ({
      effectName: String(effect?.effectName || '').trim(),
      layer: Number(effect?.layerIndex ?? effect?.layerNumber ?? effect?.layer ?? 0),
      startMs: Number(effect?.startMs),
      endMs: Number(effect?.endMs)
    }))
    .filter((effect) => effect.effectName && (layer === null || effect.layer === layer));
}

function hasEffect(effects, { effectName, layer, startMs, endMs }) {
  return effects.some((effect) =>
    effect.effectName === effectName &&
    effect.layer === layer &&
    effect.startMs === startMs &&
    effect.endMs === endMs);
}

async function readDisplayOrder(endpoint) {
  const { json } = await request(endpoint, '/elements/display-order');
  const elements = Array.isArray(json?.data?.elements) ? json.data.elements : [];
  return elements.map((row) => String(row?.id || row?.name || '').trim()).filter(Boolean);
}

function buildSeedPlan(modelName) {
  return {
    track: 'XD: Sequencing Edit Surface Validation',
    subType: 'Generic',
    replaceExistingMarks: true,
    marks: [
      { label: 'Layered Start', startMs: 1000, endMs: 2000 },
      { label: 'Middle', startMs: 3000, endMs: 4000 },
      { label: 'Late', startMs: 5000, endMs: 6000 }
    ],
    effects: [
      { element: modelName, layer: 0, effectName: 'On', startMs: 1000, endMs: 2000, settings: {}, palette: {}, clearExisting: true },
      { element: modelName, layer: 1, effectName: 'Color Wash', startMs: 1000, endMs: 2000, settings: {}, palette: {}, clearExisting: true },
      { element: modelName, layer: 1, effectName: 'Bars', startMs: 3000, endMs: 4000, settings: {}, palette: {}, clearExisting: true },
      { element: modelName, layer: 3, effectName: 'Shimmer', startMs: 5000, endMs: 6000, settings: {}, palette: {}, clearExisting: true }
    ]
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const showDir = path.resolve(args.showDir);
  if (!(await pathExists(showDir))) throw new Error(`Show folder does not exist: ${showDir}`);

  const validationDir = path.join(showDir, DEFAULT_VALIDATION_ROOT_NAME, args.runId);
  const sequencePath = path.join(validationDir, 'owned-sequencing-edit-surface-validation.xsq');
  const evidencePath = path.join(validationDir, 'owned-sequencing-edit-surface-validation-result.json');
  await mkdir(validationDir, { recursive: true });

  const result = {
    ok: false,
    artifactType: 'owned_sequencing_edit_surface_validation_v1',
    artifactVersion: 1,
    runId: args.runId,
    endpoint: args.endpoint,
    showDir,
    validationDir,
    sequencePath
  };

  try {
    result.health = await waitForReady(args.endpoint, args.readyTimeoutMs);
    result.modalStateAtStart = (await assertNoBlockingModal(args.endpoint))?.data?.modalState || null;
    result.mediaCurrent = await assertOpenShowFolder(args.endpoint, showDir);
    Object.assign(result, await chooseModel(args.endpoint, args.model));

    result.create = await postQueued(args.endpoint, '/sequence/create', {
      file: sequencePath,
      overwrite: true,
      durationMs: args.durationMs,
      frameMs: args.frameMs
    });
    result.seedPlan = buildSeedPlan(result.modelName);
    result.seedApply = await postQueued(args.endpoint, '/sequencing/apply-batch-plan', result.seedPlan);
    result.afterSeed = await readEffects(args.endpoint, result.modelName, 900, 6100);
    if (!hasEffect(result.afterSeed, { effectName: 'On', layer: 0, startMs: 1000, endMs: 2000 })) {
      throw new Error('Seed did not create base layer effect.');
    }
    if (!hasEffect(result.afterSeed, { effectName: 'Color Wash', layer: 1, startMs: 1000, endMs: 2000 })) {
      throw new Error('Seed did not create additive layer effect.');
    }

    result.update = await postQueued(args.endpoint, '/effects/update', {
      element: result.modelName,
      layer: 1,
      startMs: 1000,
      endMs: 2000,
      effectName: 'Color Wash',
      newLayer: 2,
      newStartMs: 1100,
      newEndMs: 2100,
      newEffectName: 'Twinkle'
    });
    result.afterUpdate = await readEffects(args.endpoint, result.modelName, 900, 2200);
    if (!hasEffect(result.afterUpdate, { effectName: 'Twinkle', layer: 2, startMs: 1100, endMs: 2100 })) {
      throw new Error('effects.update did not move/update the expected effect.');
    }
    if (!hasEffect(result.afterUpdate, { effectName: 'On', layer: 0, startMs: 1000, endMs: 2000 })) {
      throw new Error('effects.update changed the adjacent base layer unexpectedly.');
    }

    result.reorderLayer = await postQueued(args.endpoint, '/effects/reorder-layer', {
      element: result.modelName,
      fromLayer: 2,
      toLayer: 0
    });
    result.afterReorder = await readEffects(args.endpoint, result.modelName, 900, 6100);
    if (!hasEffect(result.afterReorder, { effectName: 'Twinkle', layer: 0, startMs: 1100, endMs: 2100 })) {
      throw new Error('effects.reorderLayer did not move Twinkle to layer 0.');
    }
    if (!hasEffect(result.afterReorder, { effectName: 'On', layer: 1, startMs: 1000, endMs: 2000 })) {
      throw new Error('effects.reorderLayer did not shift the original layer 0 effect to layer 1.');
    }
    if (!hasEffect(result.afterReorder, { effectName: 'Bars', layer: 2, startMs: 3000, endMs: 4000 })) {
      throw new Error('effects.reorderLayer did not shift the original layer 1 effect to layer 2.');
    }

    result.deleteEffect = await postQueued(args.endpoint, '/effects/delete', {
      element: result.modelName,
      layer: 2,
      startMs: 3000,
      endMs: 4000,
      effectName: 'Bars'
    });
    result.afterDeleteEffect = await readEffects(args.endpoint, result.modelName, 2900, 4100, 2);
    if (hasEffect(result.afterDeleteEffect, { effectName: 'Bars', layer: 2, startMs: 3000, endMs: 4000 })) {
      throw new Error('effects.delete did not remove Bars from layer 2.');
    }

    result.compactLayers = await postQueued(args.endpoint, '/effects/compact-layers', {
      element: result.modelName
    });
    result.afterCompact = await readEffects(args.endpoint, result.modelName, 900, 6100);
    if (!hasEffect(result.afterCompact, { effectName: 'Shimmer', layer: 2, startMs: 5000, endMs: 6000 })) {
      throw new Error('effects.compactLayers did not move Shimmer from layer 3 to layer 2.');
    }

    result.deleteLayer = await postQueued(args.endpoint, '/effects/delete-layer', {
      element: result.modelName,
      layer: 1,
      force: true
    });
    result.afterDeleteLayer = await readEffects(args.endpoint, result.modelName, 900, 6100);
    if (hasEffect(result.afterDeleteLayer, { effectName: 'On', layer: 1, startMs: 1000, endMs: 2000 })) {
      throw new Error('effects.deleteLayer did not remove the layer 1 On effect.');
    }
    if (!hasEffect(result.afterDeleteLayer, { effectName: 'Shimmer', layer: 1, startMs: 5000, endMs: 6000 })) {
      throw new Error('effects.deleteLayer did not shift Shimmer down to layer 1.');
    }

    result.displayOrderBefore = await readDisplayOrder(args.endpoint);
    if (result.displayOrderBefore.length >= 2) {
      const nextOrder = result.displayOrderBefore.slice();
      const first = nextOrder.shift();
      nextOrder.push(first);
      result.displayOrderApply = await postQueued(args.endpoint, '/elements/display-order', {
        orderedIds: JSON.stringify(nextOrder)
      });
      result.displayOrderAfter = await readDisplayOrder(args.endpoint);
      if (result.displayOrderAfter.join('|') !== nextOrder.join('|')) {
        throw new Error('elements.display-order did not persist the requested display order.');
      }
    } else {
      result.displayOrderSkipped = 'Fewer than two display elements were available.';
    }

    result.modalStateAtEnd = (await assertNoBlockingModal(args.endpoint))?.data?.modalState || null;
    result.ok = true;
    try {
      result.save = await postQueued(args.endpoint, '/sequence/save', {});
    } catch (saveError) {
      result.save = {
        ok: false,
        nonBlocking: true,
        message: saveError?.message || String(saveError)
      };
    }
  } catch (error) {
    result.error = { message: error?.message || String(error), stack: error?.stack || '' };
    await writeFile(evidencePath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    throw error;
  }

  await writeFile(evidencePath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    ok: true,
    evidencePath,
    sequencePath,
    modelName: result.modelName,
    additiveLayerVerified: hasEffect(result.afterSeed, { effectName: 'Color Wash', layer: 1, startMs: 1000, endMs: 2000 }),
    updateVerified: hasEffect(result.afterUpdate, { effectName: 'Twinkle', layer: 2, startMs: 1100, endMs: 2100 }),
    reorderVerified: hasEffect(result.afterReorder, { effectName: 'Twinkle', layer: 0, startMs: 1100, endMs: 2100 }),
    compactVerified: hasEffect(result.afterCompact, { effectName: 'Shimmer', layer: 2, startMs: 5000, endMs: 6000 }),
    deleteLayerVerified: hasEffect(result.afterDeleteLayer, { effectName: 'Shimmer', layer: 1, startMs: 5000, endMs: 6000 }),
    displayOrderVerified: Boolean(result.displayOrderAfter)
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || String(error));
  process.exit(1);
});
