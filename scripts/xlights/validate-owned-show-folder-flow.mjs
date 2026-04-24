#!/usr/bin/env node
import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_ENDPOINT = 'http://127.0.0.1:49915/xlightsdesigner/api';
const DEFAULT_SHOW_DIR = '/Users/robterry/Desktop/Show';
const DEFAULT_VALIDATION_ROOT_NAME = '_xlightsdesigner_api_validation';

function usage() {
  return [
    'Usage:',
    '  node scripts/xlights/validate-owned-show-folder-flow.mjs [options]',
    '',
    'Options:',
    '  --show-dir <path>          Show folder to validate against.',
    '  --endpoint <url>           Owned xLights API base URL.',
    '  --media-file <path>        Optional media file for sequence.create.',
    '  --target-model <name>      Optional layout model to apply the test effect to.',
    '  --effect-name <name>       Effect to apply. Defaults to Color Wash.',
    '  --duration-ms <number>     Used when no media file is provided. Defaults to 30000.',
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
    mediaFile: '',
    targetModel: '',
    effectName: 'Color Wash',
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
    else if (arg === '--media-file') args.mediaFile = next();
    else if (arg === '--target-model') args.targetModel = next();
    else if (arg === '--effect-name') args.effectName = next();
    else if (arg === '--duration-ms') args.durationMs = Number(next());
    else if (arg === '--frame-ms') args.frameMs = Number(next());
    else if (arg === '--run-id') args.runId = next();
    else if (arg === '--ready-timeout-ms') args.readyTimeoutMs = Number(next());
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!Number.isFinite(args.durationMs) || args.durationMs <= 0) {
    throw new Error('--duration-ms must be a positive number.');
  }
  if (!Number.isFinite(args.frameMs) || args.frameMs <= 0) {
    throw new Error('--frame-ms must be a positive number.');
  }
  if (!Number.isFinite(args.readyTimeoutMs) || args.readyTimeoutMs <= 0) {
    throw new Error('--ready-timeout-ms must be a positive number.');
  }
  return args;
}

async function request(endpoint, route, { method = 'GET', body = null, timeoutMs = 60000 } = {}) {
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
      throw new Error(
        `Unable to reach owned xLights API at ${endpoint}${route}. ` +
        `Start the API-enabled xLights 2026.06 build with XLIGHTS_DESIGNER_ENABLED=1 and the matching XLIGHTS_DESIGNER_PORT. ` +
        `Cause: ${error?.message || error}`
      );
    }
    const text = await response.text();
    let json;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`Invalid JSON from ${method} ${route}: ${text}`);
    }
    if (!response.ok || json?.ok === false) {
      const message = json?.error?.message || json?.message || response.statusText || 'Request failed';
      const code = json?.error?.code || response.status;
      throw new Error(`${method} ${route} failed (${code}): ${message}`);
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

function jobState(payload) {
  const state = String(payload?.data?.state || payload?.state || '').trim().toLowerCase();
  if (state === 'succeeded') return 'completed';
  return state;
}

function jobResult(payload) {
  return payload?.data?.result || payload?.result || payload;
}

async function waitForJob(endpoint, jobId, timeoutMs = 180000) {
  const started = Date.now();
  for (;;) {
    const payload = await request(endpoint, `/jobs/get?jobId=${encodeURIComponent(jobId)}`, { timeoutMs: 30000 });
    const state = jobState(payload);
    if (state === 'completed') {
      const result = jobResult(payload);
      if (result?.ok === false) {
        throw new Error(`Job ${jobId} completed with failed result: ${JSON.stringify(result)}`);
      }
      return { payload, result };
    }
    if (state === 'failed') {
      throw new Error(`Job ${jobId} failed: ${JSON.stringify(payload)}`);
    }
    if (Date.now() - started > timeoutMs) {
      throw new Error(`Timed out waiting for job ${jobId}; last state was ${state || 'unknown'}.`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

async function postQueued(endpoint, route, body) {
  const accepted = await request(endpoint, route, { method: 'POST', body });
  const jobId = String(accepted?.data?.jobId || '').trim();
  if (!jobId) {
    throw new Error(`${route} returned no jobId: ${JSON.stringify(accepted)}`);
  }
  const settled = await waitForJob(endpoint, jobId);
  return { accepted, settled };
}

async function waitForReady(endpoint, timeoutMs) {
  const started = Date.now();
  let lastHealth = null;
  for (;;) {
    const health = await request(endpoint, '/health');
    lastHealth = health;
    const data = health?.data || {};
    if (health?.ok === true && String(data.state || data.startupState || '').toLowerCase() === 'ready') {
      return health;
    }
    if (Date.now() - started > timeoutMs) {
      throw new Error(`Owned xLights API did not become ready within ${timeoutMs}ms: ${JSON.stringify(lastHealth)}`);
    }
    const retryMs = Number(data.settleRemainingMs);
    const sleepMs = Number.isFinite(retryMs) && retryMs > 0 ? Math.min(3000, Math.max(500, retryMs)) : 1000;
    await new Promise((resolve) => setTimeout(resolve, sleepMs));
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

async function chooseTargetModel(endpoint, requestedName) {
  const modelsPayload = await request(endpoint, '/layout/models');
  const models = Array.isArray(modelsPayload?.data?.models) ? modelsPayload.data.models : [];
  if (!models.length) {
    throw new Error('No layout models were returned by /layout/models.');
  }
  if (requestedName) {
    const match = models.find((model) => String(model?.name || '') === requestedName);
    if (!match) {
      throw new Error(`Requested target model was not found: ${requestedName}`);
    }
    return { model: match, modelsPayload };
  }
  const firstUsable = models.find((model) => String(model?.name || '').trim());
  if (!firstUsable) {
    throw new Error('No usable layout model name was returned by /layout/models.');
  }
  return { model: firstUsable, modelsPayload };
}

function buildBatchPayload({ targetModel, effectName, durationMs }) {
  const firstEnd = Math.min(10000, Math.max(1000, Math.floor(durationMs / 3)));
  const secondEnd = Math.min(durationMs, Math.max(firstEnd + 1000, Math.floor((durationMs * 2) / 3)));
  const thirdEnd = Math.max(secondEnd + 1, durationMs);
  return {
    track: 'XD: API Validation',
    subType: 'Generic',
    replaceExistingMarks: true,
    marks: [
      { label: 'Validation Intro', startMs: 0, endMs: firstEnd },
      { label: 'Validation Apply', startMs: firstEnd, endMs: secondEnd },
      { label: 'Validation Outro', startMs: secondEnd, endMs: thirdEnd }
    ],
    effects: [
      {
        element: targetModel,
        layer: 0,
        effectName,
        startMs: firstEnd,
        endMs: secondEnd,
        settings: {},
        palette: {},
        clearExisting: true
      }
    ]
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const showDir = path.resolve(args.showDir);
  if (!(await pathExists(showDir))) {
    throw new Error(`Show folder does not exist: ${showDir}`);
  }
  if (args.mediaFile && !(await pathExists(args.mediaFile))) {
    throw new Error(`Media file does not exist: ${args.mediaFile}`);
  }

  const validationDir = path.join(showDir, DEFAULT_VALIDATION_ROOT_NAME, args.runId);
  const sequencePath = path.join(validationDir, 'owned-api-validation.xsq');
  const evidencePath = path.join(validationDir, 'owned-api-validation-result.json');

  const health = await waitForReady(args.endpoint, args.readyTimeoutMs);
  const layoutScene = await request(args.endpoint, '/layout/scene');
  const { model, modelsPayload } = await chooseTargetModel(args.endpoint, args.targetModel);
  const targetModel = String(model.name);

  await mkdir(validationDir, { recursive: true });

  const createBody = {
    file: sequencePath,
    overwrite: true,
    frameMs: args.frameMs
  };
  if (args.mediaFile) {
    createBody.mediaFile = path.resolve(args.mediaFile);
  } else {
    createBody.durationMs = args.durationMs;
  }

  const expectedFseq = sequencePath.replace(/\.xsq$/i, '.fseq');
  const result = {
    ok: true,
    artifactType: 'owned_show_folder_flow_validation_v1',
    artifactVersion: 1,
    runId: args.runId,
    endpoint: args.endpoint,
    showDir,
    validationDir,
    sequencePath,
    expectedFseq,
    expectedFseqExists: await pathExists(expectedFseq),
    targetModel,
    effectName: args.effectName,
    health,
    layoutModelCount: Array.isArray(modelsPayload?.data?.models) ? modelsPayload.data.models.length : 0,
    layoutSceneModelCount: Array.isArray(layoutScene?.data?.models) ? layoutScene.data.models.length : 0
  };

  try {
    result.create = await postQueued(args.endpoint, '/sequence/create', createBody);
    result.applyPayload = buildBatchPayload({
      targetModel,
      effectName: args.effectName,
      durationMs: args.durationMs
    });
    result.apply = await postQueued(args.endpoint, '/sequencing/apply-batch-plan', result.applyPayload);
    result.render = await postQueued(args.endpoint, '/sequence/render-current', {});
    result.save = await postQueued(args.endpoint, '/sequence/save', {});
    result.revision = await request(args.endpoint, '/sequence/revision');
    result.settings = await request(args.endpoint, '/sequence/settings');
    result.expectedFseqExists = await pathExists(expectedFseq);
  } catch (error) {
    result.ok = false;
    result.error = {
      message: error?.message || String(error),
      stack: error?.stack || ''
    };
    try {
      result.revisionAfterFailure = await request(args.endpoint, '/sequence/revision');
    } catch (revisionError) {
      result.revisionAfterFailureError = revisionError?.message || String(revisionError);
    }
    try {
      result.settingsAfterFailure = await request(args.endpoint, '/sequence/settings');
    } catch (settingsError) {
      result.settingsAfterFailureError = settingsError?.message || String(settingsError);
    }
    result.expectedFseqExists = await pathExists(expectedFseq);
    await writeFile(evidencePath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    throw error;
  }

  await writeFile(evidencePath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    ok: true,
    evidencePath,
    sequencePath,
    expectedFseq,
    expectedFseqExists: result.expectedFseqExists,
    targetModel
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || String(error));
  process.exit(1);
});
