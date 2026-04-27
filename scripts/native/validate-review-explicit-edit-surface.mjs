#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { writeProjectArtifacts } from '../../apps/xlightsdesigner-ui/storage/project-artifact-store.mjs';
import {
  assertNoBlockingModal,
  assertOpenShowFolder,
  pathExists,
  postQueued,
  request as requestOwned,
  str,
  waitForReady as waitForOwnedReady
} from '../xlights/owned-api-validation-helpers.mjs';

const DEFAULT_ENDPOINT = 'http://127.0.0.1:49915/xlightsdesigner/api';
const DEFAULT_NATIVE_URL = 'http://127.0.0.1:49916';
const DEFAULT_SHOW_DIR = '/Users/robterry/Desktop/Show';
const DEFAULT_PROJECT_FILE = '/Users/robterry/Documents/Lights/xLightsDesigner/projects/Christmas 2026/Christmas 2026.xdproj';
const DEFAULT_VALIDATION_ROOT_NAME = '_xlightsdesigner_validation/native-review-explicit-edits';

function usage() {
  return [
    'Usage:',
    '  node scripts/native/validate-review-explicit-edit-surface.mjs [options]',
    '',
    'Options:',
    '  --project-file <path>     xLightsDesigner project file.',
    '  --show-dir <path>         xLights show folder to validate against.',
    '  --endpoint <url>          Owned xLights API base URL.',
    '  --native-url <url>        Native automation server URL.',
    '  --source-model <name>     Source model. Defaults to Star when available.',
    '  --target-model <name>     Target model. Defaults to Spinner-01 when available.',
    '  --duration-ms <number>    Validation sequence duration. Defaults to 30000.',
    '  --frame-ms <number>       Sequence frame interval. Defaults to 50.',
    '  --run-id <id>             Optional run id. Defaults to timestamp.',
    '  --ready-timeout-ms <n>    Timeout waiting for readiness. Defaults to 120000.',
    '  --help                    Show this help.'
  ].join('\n');
}

function parseArgs(argv) {
  const args = {
    projectFile: DEFAULT_PROJECT_FILE,
    showDir: DEFAULT_SHOW_DIR,
    endpoint: DEFAULT_ENDPOINT,
    nativeUrl: DEFAULT_NATIVE_URL,
    sourceModel: 'Star',
    targetModel: 'Spinner-01',
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
    if (arg === '--project-file') args.projectFile = next();
    else if (arg === '--show-dir') args.showDir = next();
    else if (arg === '--endpoint') args.endpoint = next().replace(/\/$/, '');
    else if (arg === '--native-url') args.nativeUrl = next().replace(/\/$/, '');
    else if (arg === '--source-model') args.sourceModel = next();
    else if (arg === '--target-model') args.targetModel = next();
    else if (arg === '--duration-ms') args.durationMs = Number(next());
    else if (arg === '--frame-ms') args.frameMs = Number(next());
    else if (arg === '--run-id') args.runId = next();
    else if (arg === '--ready-timeout-ms') args.readyTimeoutMs = Number(next());
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!Number.isFinite(args.durationMs) || args.durationMs <= 0) throw new Error('--duration-ms must be positive.');
  if (!Number.isFinite(args.frameMs) || args.frameMs <= 0) throw new Error('--frame-ms must be positive.');
  if (!Number.isFinite(args.readyTimeoutMs) || args.readyTimeoutMs <= 0) throw new Error('--ready-timeout-ms must be positive.');
  args.projectFile = path.resolve(args.projectFile);
  args.showDir = path.resolve(args.showDir);
  return args;
}

async function request(baseUrl, route, { method = 'GET', body = null, timeoutMs = 60000, allowError = false } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let response;
    try {
      response = await fetch(`${baseUrl}${route}`, {
        method,
        headers: body == null ? undefined : { 'Content-Type': 'application/json' },
        body: body == null ? undefined : JSON.stringify(body),
        signal: controller.signal
      });
    } catch (error) {
      throw new Error(`Unable to reach ${baseUrl}${route}: ${error?.message || error}`);
    }
    const text = await response.text();
    const json = text ? JSON.parse(text) : {};
    if (!allowError && (!response.ok || json?.ok === false)) {
      const code = json?.error?.code || response.status;
      const message = json?.error?.message || json?.message || response.statusText || 'Request failed';
      throw new Error(`${method} ${route} failed (${code}): ${message}`);
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

async function waitForNativeReady(nativeUrl, timeoutMs) {
  const started = Date.now();
  let last = null;
  for (;;) {
    last = await request(nativeUrl, '/health', { timeoutMs: 10000, allowError: true });
    const xlights = last?.xlights && typeof last.xlights === 'object' ? last.xlights : {};
    if (last?.ok === true && String(xlights.runtimeState || '').toLowerCase() === 'ready') return last;
    if (Date.now() - started > timeoutMs) {
      throw new Error(`Native automation server did not become ready within ${timeoutMs}ms: ${JSON.stringify(last)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

async function chooseModels(endpoint, requestedSource, requestedTarget) {
  const { json } = await requestOwned(endpoint, '/layout/models');
  const models = Array.isArray(json?.data?.models) ? json.data.models : [];
  const usable = models
    .map((model) => ({ name: str(model?.name), displayAs: str(model?.displayAs) }))
    .filter((model) => model.name && model.displayAs !== 'ModelGroup');
  const find = (name) => usable.find((model) => model.name === name);
  const source = find(requestedSource) || usable[0];
  const target = find(requestedTarget) || usable.find((model) => model.name !== source?.name);
  if (!source) throw new Error(`Source model was not found or usable: ${requestedSource || '(auto)'}`);
  if (!target) throw new Error(`Target model was not found or usable: ${requestedTarget || '(auto)'}`);
  return { sourceModel: source.name, targetModel: target.name, layoutModelCount: models.length };
}

async function readEffects(endpoint, element, startMs, endMs, layer = null) {
  const query = new URLSearchParams({ element, startMs: String(startMs), endMs: String(endMs) });
  const { json } = await requestOwned(endpoint, `/effects/window?${query}`);
  const effects = Array.isArray(json?.data?.effects) ? json.data.effects : [];
  return effects
    .map((effect) => ({
      effectName: str(effect?.effectName),
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
  const { json } = await requestOwned(endpoint, '/elements/display-order');
  const elements = Array.isArray(json?.data?.elements) ? json.data.elements : [];
  return elements.map((row) => str(row?.id || row?.name)).filter(Boolean);
}

function buildSeedPlan(sourceModel, targetModel) {
  return {
    track: 'XD: Native Review Explicit Edit Validation',
    subType: 'Generic',
    replaceExistingMarks: true,
    marks: [
      { label: 'Clone Source', startMs: 1000, endMs: 2000 },
      { label: 'Layer Reorder', startMs: 3000, endMs: 4000 },
      { label: 'Layer Preserve', startMs: 5000, endMs: 6000 },
      { label: 'Update Target', startMs: 7000, endMs: 8000 },
      { label: 'Delete Target', startMs: 9000, endMs: 10000 },
      { label: 'Compact Target', startMs: 11000, endMs: 12000 }
    ],
    effects: [
      { element: sourceModel, layer: 0, effectName: 'On', startMs: 1000, endMs: 2000, settings: {}, palette: {}, clearExisting: true },
      { element: sourceModel, layer: 0, effectName: 'Bars', startMs: 3000, endMs: 4000, settings: {}, palette: {}, clearExisting: true },
      { element: sourceModel, layer: 1, effectName: 'Shimmer', startMs: 3000, endMs: 4000, settings: {}, palette: {}, clearExisting: true },
      { element: sourceModel, layer: 0, effectName: 'Color Wash', startMs: 7000, endMs: 8000, settings: {}, palette: {}, clearExisting: true },
      { element: sourceModel, layer: 1, effectName: 'Twinkle', startMs: 9000, endMs: 10000, settings: {}, palette: {}, clearExisting: true },
      { element: sourceModel, layer: 3, effectName: 'Pinwheel', startMs: 11000, endMs: 12000, settings: {}, palette: {}, clearExisting: true },
      { element: targetModel, layer: 0, effectName: 'Color Wash', startMs: 1000, endMs: 2000, settings: {}, palette: {}, clearExisting: true }
    ]
  };
}

function artifactId(prefix, runId, step) {
  return `${prefix}_${runId}_${step}`.replace(/[^A-Za-z0-9_.:-]/g, '-');
}

function writeValidationArtifacts({ projectFile, runId, step, sourceModel, targetModel, proposalLines, summary, targetIds }) {
  const now = new Date().toISOString();
  const proposalBundle = {
    artifactType: 'proposal_bundle_v1',
    artifactVersion: '1.0',
    artifactId: artifactId('proposal_bundle_v1-native-review-explicit', runId, step),
    createdAt: now,
    source: 'native_review_explicit_edit_validation',
    summary,
    proposalLines,
    scope: {
      targetIds,
      tagNames: [],
      sections: [],
      timeRangeMs: null
    },
    constraints: {
      validation: true,
      preserveExistingUnlessScoped: true
    },
    executionPlan: {
      artifactType: 'execution_strategy_v1',
      passScope: 'targeted_revision',
      implementationMode: summary,
      primarySections: [],
      sectionPlans: [],
      effectPlacements: []
    }
  };
  const intentHandoff = {
    artifactType: 'intent_handoff_v1',
    artifactVersion: '1.0',
    artifactId: artifactId('intent_handoff_v1-native-review-explicit', runId, step),
    createdAt: now,
    goal: summary,
    mode: 'revise',
    scope: {
      targetIds,
      tagNames: [],
      sections: [],
      timeRangeMs: null
    },
    constraints: {
      sourceModel,
      targetModel,
      preserveExistingUnlessScoped: true
    },
    directorPreferences: {
      styleDirection: 'validation',
      energyArc: '',
      focusElements: targetIds,
      colorDirection: ''
    },
    executionStrategy: proposalBundle.executionPlan,
    approvalPolicy: {
      requiresExplicitApprove: true,
      elevatedRiskConfirmed: true
    }
  };
  const writeResult = writeProjectArtifacts({
    projectFilePath: projectFile,
    artifacts: [intentHandoff, proposalBundle]
  });
  if (!writeResult?.ok) throw new Error(writeResult?.error || 'Failed to write validation artifacts.');
  return { intentHandoff, proposalBundle, writeResult };
}

async function nativeAction(nativeUrl, action, payload = {}) {
  return request(nativeUrl, '/action', {
    method: 'POST',
    body: { action, ...payload },
    timeoutMs: 180000
  });
}

async function waitForNativeApplyIdle(nativeUrl, previousApplyId = '', timeoutMs = 360000) {
  const started = Date.now();
  let last = null;
  let completedApply = null;
  for (;;) {
    last = await request(nativeUrl, '/sequencer-validation-snapshot', { timeoutMs: 60000, allowError: true });
    const latest = last?.latestApplyResult && typeof last.latestApplyResult === 'object'
      ? last.latestApplyResult
      : null;
    const latestId = str(latest?.artifactId);
    if (latest && latestId && latestId !== previousApplyId && str(latest?.status).toLowerCase() === 'applied') {
      completedApply = { snapshot: last, applyResult: latest };
    }
    const appSnapshot = await request(nativeUrl, '/snapshot', { timeoutMs: 60000, allowError: true });
    const applying = Boolean(appSnapshot?.pages?.review?.isApplying);
    const blockedBanner = Array.isArray(appSnapshot?.pages?.review?.banners)
      ? appSnapshot.pages.review.banners.find((banner) => String(banner?.state || '').toLowerCase() === 'blocked')
      : null;
    if (blockedBanner) throw new Error(`Native Review apply blocked: ${str(blockedBanner.text)}`);
    if (completedApply && !applying) return completedApply;
    if (Date.now() - started > timeoutMs) {
      if (completedApply) return completedApply;
      throw new Error(`Timed out waiting for native Review apply. Last snapshot: ${JSON.stringify(last)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

async function applyReviewScenario({ nativeUrl, projectFile, runId, step, sourceModel, targetModel, proposalLines, summary, targetIds, previousApplyId }) {
  const artifacts = writeValidationArtifacts({
    projectFile,
    runId,
    step,
    sourceModel,
    targetModel,
    proposalLines,
    summary,
    targetIds
  });
  const accepted = await nativeAction(nativeUrl, 'applyReview');
  const applied = await waitForNativeApplyIdle(nativeUrl, previousApplyId);
  return {
    artifacts,
    accepted,
    applied,
    latestApplyId: str(applied?.applyResult?.artifactId)
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!(await pathExists(args.projectFile))) throw new Error(`Project file does not exist: ${args.projectFile}`);
  if (!(await pathExists(args.showDir))) throw new Error(`Show folder does not exist: ${args.showDir}`);

  const validationDir = path.join(args.showDir, DEFAULT_VALIDATION_ROOT_NAME, args.runId);
  const sequencePath = path.join(validationDir, 'native-review-explicit-edit-surface.xsq');
  const evidencePath = path.join(validationDir, 'native-review-explicit-edit-surface-result.json');
  await mkdir(validationDir, { recursive: true });

  const result = {
    ok: false,
    artifactType: 'native_review_explicit_edit_surface_validation_v1',
    artifactVersion: 1,
    runId: args.runId,
    endpoint: args.endpoint,
    nativeUrl: args.nativeUrl,
    projectFile: args.projectFile,
    showDir: args.showDir,
    validationDir,
    sequencePath
  };

  try {
    result.ownedHealth = await waitForOwnedReady(args.endpoint, args.readyTimeoutMs);
    result.nativeHealth = await waitForNativeReady(args.nativeUrl, args.readyTimeoutMs);
    result.openProject = await nativeAction(args.nativeUrl, 'openProject', { filePath: args.projectFile });
    result.nativeRefreshAfterOpenProject = await nativeAction(args.nativeUrl, 'refreshAll');
    result.modalStateAtStart = (await assertNoBlockingModal(args.endpoint))?.data?.modalState || null;
    result.mediaCurrent = await assertOpenShowFolder(args.endpoint, args.showDir);
    Object.assign(result, await chooseModels(args.endpoint, args.sourceModel, args.targetModel));

    result.create = await nativeAction(args.nativeUrl, 'createXLightsSequence', {
      filePath: sequencePath,
      durationMs: args.durationMs,
      frameMs: args.frameMs
    });
    result.nativeRefreshAfterCreate = await nativeAction(args.nativeUrl, 'refreshXLightsSession');
    result.nativeRefreshAllAfterCreate = await nativeAction(args.nativeUrl, 'refreshAll');
    await waitForOwnedReady(args.endpoint, args.readyTimeoutMs);
    result.modalStateAfterCreate = (await assertNoBlockingModal(args.endpoint))?.data?.modalState || null;
    result.seedPlan = buildSeedPlan(result.sourceModel, result.targetModel);
    result.seedApply = await postQueued(args.endpoint, '/sequencing/apply-batch-plan', result.seedPlan);
    result.nativeRefreshAfterSeed = await nativeAction(args.nativeUrl, 'refreshXLightsSession');
    result.nativeRefreshAllAfterSeed = await nativeAction(args.nativeUrl, 'refreshAll');
    result.afterSeedSource = await readEffects(args.endpoint, result.sourceModel, 900, 12100);
    result.afterSeedTarget = await readEffects(args.endpoint, result.targetModel, 900, 2100);
    if (!hasEffect(result.afterSeedSource, { effectName: 'On', layer: 0, startMs: 1000, endMs: 2000 })) {
      throw new Error('Seed did not create source clone effect.');
    }
    if (!hasEffect(result.afterSeedSource, { effectName: 'Shimmer', layer: 1, startMs: 3000, endMs: 4000 })) {
      throw new Error('Seed did not create source layer 1 effect.');
    }
    if (!hasEffect(result.afterSeedSource, { effectName: 'Color Wash', layer: 0, startMs: 7000, endMs: 8000 })) {
      throw new Error('Seed did not create source update effect.');
    }
    if (!hasEffect(result.afterSeedSource, { effectName: 'Twinkle', layer: 1, startMs: 9000, endMs: 10000 })) {
      throw new Error('Seed did not create source delete-layer effect.');
    }
    if (!hasEffect(result.afterSeedSource, { effectName: 'Pinwheel', layer: 3, startMs: 11000, endMs: 12000 })) {
      throw new Error('Seed did not create source compact-layer effect.');
    }
    if (!hasEffect(result.afterSeedTarget, { effectName: 'Color Wash', layer: 0, startMs: 1000, endMs: 2000 })) {
      throw new Error('Seed did not create occupied target layer.');
    }

    const initialValidationSnapshot = await request(args.nativeUrl, '/sequencer-validation-snapshot', { timeoutMs: 10000, allowError: true });
    let previousApplyId = str(initialValidationSnapshot?.latestApplyResult?.artifactId);

    result.cloneScenario = await applyReviewScenario({
      nativeUrl: args.nativeUrl,
      projectFile: args.projectFile,
      runId: args.runId,
      step: 'clone',
      sourceModel: result.sourceModel,
      targetModel: result.targetModel,
      summary: `Copy ${result.sourceModel} layer 0 to ${result.targetModel} layer 0 while preserving occupied destination layers.`,
      proposalLines: [
        `Validation / ${result.sourceModel} / copy ${result.sourceModel} layer 0 to ${result.targetModel} layer 0`
      ],
      targetIds: [result.sourceModel, result.targetModel],
      previousApplyId
    });
    previousApplyId = result.cloneScenario.latestApplyId;
    result.afterCloneTarget = await readEffects(args.endpoint, result.targetModel, 900, 2100);
    if (!hasEffect(result.afterCloneTarget, { effectName: 'Color Wash', layer: 0, startMs: 1000, endMs: 2000 })) {
      throw new Error('Clone scenario overwrote the occupied target layer.');
    }
    if (!hasEffect(result.afterCloneTarget, { effectName: 'On', layer: 1, startMs: 1000, endMs: 2000 })) {
      throw new Error('Clone scenario did not move the copy to an open layer.');
    }

    result.layerScenario = await applyReviewScenario({
      nativeUrl: args.nativeUrl,
      projectFile: args.projectFile,
      runId: args.runId,
      step: 'layer-reorder',
      sourceModel: result.sourceModel,
      targetModel: result.targetModel,
      summary: `Move existing ${result.sourceModel} layer 1 to layer 0.`,
      proposalLines: [
        `Validation / ${result.sourceModel} / move existing layer 1 to layer 0`
      ],
      targetIds: [result.sourceModel],
      previousApplyId
    });
    previousApplyId = result.layerScenario.latestApplyId;
    result.afterLayerReorderSource = await readEffects(args.endpoint, result.sourceModel, 2900, 4100);
    if (!hasEffect(result.afterLayerReorderSource, { effectName: 'Shimmer', layer: 0, startMs: 3000, endMs: 4000 })) {
      throw new Error('Layer reorder scenario did not move Shimmer to layer 0.');
    }
    if (!hasEffect(result.afterLayerReorderSource, { effectName: 'Bars', layer: 1, startMs: 3000, endMs: 4000 })) {
      throw new Error('Layer reorder scenario did not shift Bars to layer 1.');
    }

    result.updateScenario = await applyReviewScenario({
      nativeUrl: args.nativeUrl,
      projectFile: args.projectFile,
      runId: args.runId,
      step: 'effect-update',
      sourceModel: result.sourceModel,
      targetModel: result.targetModel,
      summary: `Update existing ${result.sourceModel} layer 0 effect by shifting it later.`,
      proposalLines: [
        `Validation / ${result.sourceModel} / shift existing effect on layer 0 later by 500 ms`
      ],
      targetIds: [result.sourceModel],
      previousApplyId
    });
    previousApplyId = result.updateScenario.latestApplyId;
    result.afterUpdateSource = await readEffects(args.endpoint, result.sourceModel, 2900, 4600);
    if (!hasEffect(result.afterUpdateSource, { effectName: 'Shimmer', layer: 0, startMs: 3500, endMs: 4500 })) {
      throw new Error('Update scenario did not shift the existing layer 0 Shimmer effect later by 500 ms.');
    }

    result.deleteLayerScenario = await applyReviewScenario({
      nativeUrl: args.nativeUrl,
      projectFile: args.projectFile,
      runId: args.runId,
      step: 'layer-delete',
      sourceModel: result.sourceModel,
      targetModel: result.targetModel,
      summary: `Remove existing ${result.sourceModel} layer 1.`,
      proposalLines: [
        `Validation / ${result.sourceModel} / remove existing layer 1`
      ],
      targetIds: [result.sourceModel],
      previousApplyId
    });
    previousApplyId = result.deleteLayerScenario.latestApplyId;
    result.afterDeleteLayerSource = await readEffects(args.endpoint, result.sourceModel, 2900, 10100);
    if (hasEffect(result.afterDeleteLayerSource, { effectName: 'Bars', layer: 1, startMs: 3000, endMs: 4000 })) {
      throw new Error('Delete-layer scenario did not remove the layer 1 Bars effect.');
    }

    result.compactLayerScenario = await applyReviewScenario({
      nativeUrl: args.nativeUrl,
      projectFile: args.projectFile,
      runId: args.runId,
      step: 'layer-compact',
      sourceModel: result.sourceModel,
      targetModel: result.targetModel,
      summary: `Compact existing ${result.sourceModel} layers after deleting gaps.`,
      proposalLines: [
        `Validation / ${result.sourceModel} / compact existing layers`
      ],
      targetIds: [result.sourceModel],
      previousApplyId
    });
    previousApplyId = result.compactLayerScenario.latestApplyId;
    result.afterCompactLayerSource = await readEffects(args.endpoint, result.sourceModel, 10900, 12100);
    if (!hasEffect(result.afterCompactLayerSource, { effectName: 'Pinwheel', layer: 1, startMs: 11000, endMs: 12000 })) {
      throw new Error('Compact-layers scenario did not move Pinwheel into the first open compacted layer.');
    }

    result.displayOrderBefore = await readDisplayOrder(args.endpoint);
    if (!result.displayOrderBefore.includes(result.sourceModel) || !result.displayOrderBefore.includes(result.targetModel)) {
      throw new Error(`Display order did not include validation models: ${result.sourceModel}, ${result.targetModel}`);
    }
    result.displayOrderScenario = await applyReviewScenario({
      nativeUrl: args.nativeUrl,
      projectFile: args.projectFile,
      runId: args.runId,
      step: 'display-order',
      sourceModel: result.sourceModel,
      targetModel: result.targetModel,
      summary: `Move ${result.targetModel} above ${result.sourceModel} in the display order.`,
      proposalLines: [
        `Move ${result.targetModel} above ${result.sourceModel} in the display order`
      ],
      targetIds: [result.sourceModel, result.targetModel],
      previousApplyId
    });
    result.displayOrderAfter = await readDisplayOrder(args.endpoint);
    const sourceIndex = result.displayOrderAfter.indexOf(result.sourceModel);
    const targetIndex = result.displayOrderAfter.indexOf(result.targetModel);
    if (targetIndex < 0 || sourceIndex < 0 || targetIndex >= sourceIndex) {
      throw new Error(`Display order scenario did not move ${result.targetModel} above ${result.sourceModel}.`);
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
    sourceModel: result.sourceModel,
    targetModel: result.targetModel,
    cloneOpenLayerVerified: hasEffect(result.afterCloneTarget, { effectName: 'On', layer: 1, startMs: 1000, endMs: 2000 }),
    layerReorderVerified: hasEffect(result.afterLayerReorderSource, { effectName: 'Shimmer', layer: 0, startMs: 3000, endMs: 4000 }),
    updateVerified: hasEffect(result.afterUpdateSource, { effectName: 'Shimmer', layer: 0, startMs: 3500, endMs: 4500 }),
    deleteLayerVerified: !hasEffect(result.afterDeleteLayerSource, { effectName: 'Bars', layer: 1, startMs: 3000, endMs: 4000 }),
    compactLayersVerified: hasEffect(result.afterCompactLayerSource, { effectName: 'Pinwheel', layer: 1, startMs: 11000, endMs: 12000 }),
    displayOrderVerified: result.displayOrderAfter.indexOf(result.targetModel) < result.displayOrderAfter.indexOf(result.sourceModel)
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || String(error));
  process.exit(1);
});
