#!/usr/bin/env node
import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_ENDPOINT = 'http://127.0.0.1:49915/xlightsdesigner/api';
const DEFAULT_SHOW_DIR = '/Users/robterry/Desktop/Show';
const DEFAULT_VALIDATION_ROOT_NAME = '_xlightsdesigner_api_validation';

function usage() {
  return [
    'Usage:',
    '  node scripts/xlights/validate-owned-clone-safety.mjs [options]',
    '',
    'Options:',
    '  --show-dir <path>          Show folder to validate against.',
    '  --endpoint <url>           Owned xLights API base URL.',
    '  --source-model <name>      Optional source model.',
    '  --target-model <name>      Optional target model.',
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
    sourceModel: '',
    targetModel: '',
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
  return args;
}

async function request(endpoint, route, { method = 'GET', body = null, timeoutMs = 60000, allowError = false } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let response;
    try {
      response = await fetch(`${endpoint}${route}`, {
        method,
        headers: body == null ? undefined : { 'Content-Type': 'application/json' },
        body: body == null ? undefined : JSON.stringify(body),
        signal: controller.signal
      });
    } catch (error) {
      throw new Error(`Unable to reach owned xLights API at ${endpoint}${route}: ${error?.message || error}`);
    }
    const text = await response.text();
    const json = text ? JSON.parse(text) : {};
    if (!allowError && (!response.ok || json?.ok === false)) {
      const code = json?.error?.code || response.status;
      const message = json?.error?.message || json?.message || response.statusText || 'Request failed';
      throw new Error(`${method} ${route} failed (${code}): ${message}`);
    }
    return { status: response.status, json };
  } finally {
    clearTimeout(timer);
  }
}

async function pathExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function jobState(payload) {
  const state = String(payload?.data?.state || payload?.state || '').trim().toLowerCase();
  return state === 'succeeded' ? 'completed' : state;
}

function jobResult(payload) {
  return payload?.data?.result || payload?.result || payload;
}

function modalBlockedMessage(health = {}) {
  const data = health?.data && typeof health.data === 'object' ? health.data : {};
  const modalState = data?.modalState && typeof data.modalState === 'object' ? data.modalState : null;
  if (!modalState?.blocked || modalState.observed === false) return '';
  const titles = Array.isArray(modalState.windows)
    ? modalState.windows
      .filter((window) => window?.isModal)
      .map((window) => String(window?.title || window?.className || '').trim())
      .filter(Boolean)
    : [];
  return `xLights is blocked by a modal${titles.length ? `: ${titles.join(', ')}` : ''}`;
}

async function assertNoBlockingModal(endpoint) {
  const { json: health } = await request(endpoint, '/health', { timeoutMs: 10000 });
  const message = modalBlockedMessage(health);
  if (message) {
    throw new Error(message);
  }
  return health;
}

async function waitForReady(endpoint, timeoutMs) {
  const started = Date.now();
  let lastHealth = null;
  for (;;) {
    const { json: health } = await request(endpoint, '/health');
    lastHealth = health;
    const data = health?.data || {};
    const modalMessage = modalBlockedMessage(health);
    if (modalMessage) {
      throw new Error(modalMessage);
    }
    if (health?.ok === true && String(data.state || data.startupState || '').toLowerCase() === 'ready') return health;
    if (Date.now() - started > timeoutMs) {
      throw new Error(`Owned xLights API did not become ready within ${timeoutMs}ms: ${JSON.stringify(lastHealth)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

async function waitForJob(endpoint, jobId, { timeoutMs = 180000, allowFailure = false } = {}) {
  const started = Date.now();
  let last = null;
  for (;;) {
    await assertNoBlockingModal(endpoint);
    const { json } = await request(endpoint, `/jobs/get?jobId=${encodeURIComponent(jobId)}`, { allowError: allowFailure });
    last = json;
    const state = jobState(json);
    const result = jobResult(json);
    if (state === 'completed') {
      if (!allowFailure && result?.ok === false) throw new Error(`Job ${jobId} completed with failed result: ${JSON.stringify(result)}`);
      return { state, payload: json, result };
    }
    if (state === 'failed') {
      if (allowFailure) return { state, payload: json, result };
      throw new Error(`Job ${jobId} failed: ${JSON.stringify(json)}`);
    }
    if (Date.now() - started > timeoutMs) throw new Error(`Timed out waiting for job ${jobId}. Last response: ${JSON.stringify(last)}`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

async function postQueued(endpoint, route, body, options = {}) {
  const { json: accepted } = await request(endpoint, route, { method: 'POST', body });
  const jobId = String(accepted?.data?.jobId || '').trim();
  if (!jobId) throw new Error(`${route} returned no jobId: ${JSON.stringify(accepted)}`);
  const settled = await waitForJob(endpoint, jobId, options);
  return { accepted, settled };
}

async function assertOpenShowFolder(endpoint, expectedShowDir) {
  const { json } = await request(endpoint, '/media/current');
  const reportedShowDir = String(json?.data?.showDirectory || '').trim();
  if (!reportedShowDir) throw new Error('/media/current did not report an open show folder.');
  const actual = path.resolve(reportedShowDir).replace(/\/+$/, '');
  const expected = path.resolve(expectedShowDir).replace(/\/+$/, '');
  if (actual !== expected) throw new Error(`xLights is open to ${actual}; expected ${expected}.`);
  return json;
}

async function chooseModels(endpoint, requestedSource, requestedTarget) {
  const { json } = await request(endpoint, '/layout/models');
  const models = Array.isArray(json?.data?.models) ? json.data.models : [];
  const usable = models
    .map((model) => ({ name: String(model?.name || '').trim(), displayAs: String(model?.displayAs || '').trim() }))
    .filter((model) => model.name && model.displayAs !== 'ModelGroup');
  const find = (name) => usable.find((model) => model.name === name);
  const source = requestedSource ? find(requestedSource) : usable[0];
  const target = requestedTarget ? find(requestedTarget) : usable.find((model) => model.name !== source?.name);
  if (!source) throw new Error(`Source model was not found or usable: ${requestedSource || '(auto)'}`);
  if (!target) throw new Error(`Target model was not found or usable: ${requestedTarget || '(auto)'}`);
  return { sourceModel: source.name, targetModel: target.name, layoutModelCount: models.length };
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

function buildSeedPlan(sourceModel, targetModel) {
  return {
    track: 'XD: Clone Safety Validation',
    subType: 'Generic',
    replaceExistingMarks: true,
    marks: [
      { label: 'Source', startMs: 1000, endMs: 2000 },
      { label: 'Target Occupied', startMs: 4000, endMs: 5000 },
      { label: 'Target Open', startMs: 7000, endMs: 8000 }
    ],
    effects: [
      { element: sourceModel, layer: 0, effectName: 'On', startMs: 1000, endMs: 2000, settings: {}, palette: {}, clearExisting: true },
      { element: targetModel, layer: 1, effectName: 'Color Wash', startMs: 4000, endMs: 5000, settings: {}, palette: {}, clearExisting: true }
    ]
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const showDir = path.resolve(args.showDir);
  if (!(await pathExists(showDir))) throw new Error(`Show folder does not exist: ${showDir}`);

  const validationDir = path.join(showDir, DEFAULT_VALIDATION_ROOT_NAME, args.runId);
  const sequencePath = path.join(validationDir, 'owned-clone-safety-validation.xsq');
  const evidencePath = path.join(validationDir, 'owned-clone-safety-validation-result.json');
  await mkdir(validationDir, { recursive: true });

  const result = {
    ok: false,
    artifactType: 'owned_clone_safety_validation_v1',
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
    Object.assign(result, await chooseModels(args.endpoint, args.sourceModel, args.targetModel));
    result.create = await postQueued(args.endpoint, '/sequence/create', {
      file: sequencePath,
      overwrite: true,
      durationMs: args.durationMs,
      frameMs: args.frameMs
    });
    result.modalStateAfterCreate = (await assertNoBlockingModal(args.endpoint))?.data?.modalState || null;
    result.seedPlan = buildSeedPlan(result.sourceModel, result.targetModel);
    result.seedApply = await postQueued(args.endpoint, '/sequencing/apply-batch-plan', result.seedPlan);
    result.modalStateAfterSeedApply = (await assertNoBlockingModal(args.endpoint))?.data?.modalState || null;
    result.beforeConflictTargetEffects = await readEffects(args.endpoint, result.targetModel, 3500, 5500, 1);

    result.conflictClone = await postQueued(args.endpoint, '/effects/clone', {
      sourceElement: result.sourceModel,
      sourceLayer: 0,
      sourceStartMs: 1000,
      sourceEndMs: 2000,
      targetElement: result.targetModel,
      targetLayer: 1,
      targetStartMs: 4000,
      mode: 'copy'
    }, { allowFailure: true });
    const conflictError = result.conflictClone?.settled?.result?.error || {};
    if (result.conflictClone?.settled?.state !== 'failed' || conflictError.code !== 'TARGET_WINDOW_OCCUPIED') {
      throw new Error(`Expected TARGET_WINDOW_OCCUPIED clone failure, got: ${JSON.stringify(result.conflictClone?.settled)}`);
    }

    result.afterConflictTargetEffects = await readEffects(args.endpoint, result.targetModel, 3500, 5500, 1);
    if (result.afterConflictTargetEffects.length !== result.beforeConflictTargetEffects.length) {
      throw new Error('Occupied-target clone changed the destination effect count.');
    }

    result.openClone = await postQueued(args.endpoint, '/effects/clone', {
      sourceElement: result.sourceModel,
      sourceLayer: 0,
      sourceStartMs: 1000,
      sourceEndMs: 2000,
      targetElement: result.targetModel,
      targetLayer: 2,
      targetStartMs: 7000,
      mode: 'copy'
    });
    result.modalStateAfterOpenClone = (await assertNoBlockingModal(args.endpoint))?.data?.modalState || null;
    result.openLayerEffects = await readEffects(args.endpoint, result.targetModel, 6500, 8500, 2);
    if (!result.openLayerEffects.some((effect) => effect.effectName === 'On' && effect.startMs === 7000 && effect.endMs === 8000)) {
      throw new Error('Open-layer clone did not create the expected copied effect.');
    }

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
    conflictCode: result.conflictClone?.settled?.result?.error?.code,
    openCloneCount: result.openLayerEffects.length
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || String(error));
  process.exit(1);
});
