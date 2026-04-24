#!/usr/bin/env node
import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const DEFAULT_NATIVE_BASE_URL = 'http://127.0.0.1:49916';
const DEFAULT_XLIGHTS_BASE_URL = 'http://127.0.0.1:49915/xlightsdesigner/api';
const DEFAULT_SHOW_DIR = '/Users/robterry/Desktop/Show';
const DEFAULT_TARGET_IDS = 'Star';
const DEFAULT_SELECTED_TAGS = 'lead';
const NATIVE_LOG_PATH = '/tmp/xld-native-app.log';
const DEFAULT_MATRIX_FILE = path.join(ROOT, 'scripts/native/full-handoff-validation-scenarios.json');

function str(value = '') {
  return String(value || '').trim();
}

function usage() {
  console.error([
    'usage: run-full-handoff-validation.mjs [options]',
    '',
    'Options:',
    '  --show-dir <path>              Linked xLights show folder. Defaults to /Users/robterry/Desktop/Show.',
    '  --target-ids <ids>             Exact xLights target ids. Defaults to Star.',
    '  --selected-tags <tags>         Selected metadata tags. Defaults to lead.',
    '  --tag-only                    Seed expected target metadata, then generate from tags without target text.',
    '  --matrix                       Run the default metadata handoff scenario matrix.',
    '  --matrix-file <path>           Run scenarios from a JSON matrix file.',
    '  --duration-ms <n>              Validation sequence duration. Defaults to 30000.',
    '  --frame-ms <n>                 Validation sequence frame interval. Defaults to 50.',
    '  --timeout-ms <n>               End-to-end validation timeout. Defaults to 180000.',
    '  --native-timeout-ms <n>        Native automation startup timeout. Defaults to 60000.',
    '  --xlights-timeout-ms <n>       Owned xLights startup timeout. Defaults to 120000.',
    '  --skip-launch-native           Require an already-running native automation server.',
    '  --skip-launch-xlights          Require an already-running owned xLights API.',
    '  --no-apply-review              Stop after proposal handoff validation.',
    '  --no-render-after-apply        Apply review but skip final render action.',
    '  --help                         Show this help.'
  ].join('\n'));
}

function parseArgs(argv = []) {
  const args = {
    showDir: DEFAULT_SHOW_DIR,
    targetIds: DEFAULT_TARGET_IDS,
    selectedTags: DEFAULT_SELECTED_TAGS,
    durationMs: 30000,
    frameMs: 50,
    timeoutMs: 180000,
    nativeTimeoutMs: 60000,
    xlightsTimeoutMs: 120000,
    launchNative: true,
    launchXlights: true,
    applyReview: true,
    renderAfterApply: true,
    tagOnly: false,
    matrix: false,
    matrixFile: ''
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = str(argv[index]);
    const next = () => {
      index += 1;
      if (index >= argv.length) {
        throw new Error(`Missing value for ${token}`);
      }
      return argv[index];
    };
    if (token === '--help') {
      usage();
      process.exit(0);
    } else if (token === '--show-dir') args.showDir = next();
    else if (token === '--target-ids') args.targetIds = next();
    else if (token === '--selected-tags') args.selectedTags = next();
    else if (token === '--tag-only') args.tagOnly = true;
    else if (token === '--matrix') args.matrix = true;
    else if (token === '--matrix-file') {
      args.matrix = true;
      args.matrixFile = next();
    }
    else if (token === '--duration-ms') args.durationMs = Number(next());
    else if (token === '--frame-ms') args.frameMs = Number(next());
    else if (token === '--timeout-ms') args.timeoutMs = Number(next());
    else if (token === '--native-timeout-ms') args.nativeTimeoutMs = Number(next());
    else if (token === '--xlights-timeout-ms') args.xlightsTimeoutMs = Number(next());
    else if (token === '--skip-launch-native') args.launchNative = false;
    else if (token === '--skip-launch-xlights') args.launchXlights = false;
    else if (token === '--no-apply-review') args.applyReview = false;
    else if (token === '--no-render-after-apply') args.renderAfterApply = false;
    else throw new Error(`Unknown argument: ${token}`);
  }
  if (!Number.isFinite(args.durationMs) || args.durationMs <= 0) args.durationMs = 30000;
  if (!Number.isFinite(args.frameMs) || args.frameMs <= 0) args.frameMs = 50;
  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs <= 0) args.timeoutMs = 180000;
  if (!Number.isFinite(args.nativeTimeoutMs) || args.nativeTimeoutMs <= 0) args.nativeTimeoutMs = 60000;
  if (!Number.isFinite(args.xlightsTimeoutMs) || args.xlightsTimeoutMs <= 0) args.xlightsTimeoutMs = 120000;
  return args;
}

function readJson(filePath = '') {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizeScenario(row = {}, index = 0) {
  const targetIds = str(row?.targetIds);
  const selectedTags = str(row?.selectedTags);
  if (!targetIds) {
    throw new Error(`Scenario ${index + 1} is missing targetIds.`);
  }
  if (!selectedTags) {
    throw new Error(`Scenario ${index + 1} is missing selectedTags.`);
  }
  return {
    name: str(row?.name) || `scenario-${index + 1}`,
    targetIds,
    selectedTags,
    tagOnly: row?.tagOnly === true
  };
}

function loadMatrixScenarios(matrixFile = '') {
  const filePath = path.resolve(matrixFile || DEFAULT_MATRIX_FILE);
  const document = readJson(filePath);
  const scenarios = Array.isArray(document?.scenarios) ? document.scenarios : [];
  if (!scenarios.length) {
    throw new Error(`Matrix file has no scenarios: ${filePath}`);
  }
  return {
    filePath,
    scenarios: scenarios.map(normalizeScenario)
  };
}

function run(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    execFile(command, args, {
      cwd: options.cwd || ROOT,
      env: options.env || process.env,
      maxBuffer: options.maxBuffer || 1024 * 1024 * 20
    }, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

async function requestJson(url, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const text = await response.text();
    let json = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      return { ok: false, statusCode: response.status, text };
    }
    return { ok: response.ok && json?.ok !== false, statusCode: response.status, json };
  } catch (error) {
    return { ok: false, statusCode: 0, error: error?.message || String(error) };
  } finally {
    clearTimeout(timer);
  }
}

async function waitForNative(timeoutMs) {
  const started = Date.now();
  let last = null;
  for (;;) {
    last = await requestJson(`${DEFAULT_NATIVE_BASE_URL}/health`, 5000);
    if (last.ok && last.json?.ok !== false) {
      return last.json;
    }
    if (Date.now() - started > timeoutMs) {
      throw new Error(`Timed out waiting for native automation server: ${JSON.stringify(last)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

async function waitForXlights(timeoutMs) {
  const started = Date.now();
  let last = null;
  for (;;) {
    last = await requestJson(`${DEFAULT_XLIGHTS_BASE_URL}/health`, 5000);
    const data = last.json?.data || {};
    if (last.ok && (data.startupSettled === true || str(data.state).toLowerCase() === 'ready')) {
      return last.json;
    }
    if (Date.now() - started > timeoutMs) {
      throw new Error(`Timed out waiting for owned xLights API: ${JSON.stringify(last)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

async function ensureNativeApp(args) {
  const health = await requestJson(`${DEFAULT_NATIVE_BASE_URL}/health`, 2000);
  if (health.ok) {
    return { launched: false, health: health.json };
  }
  if (!args.launchNative) {
    throw new Error('Native automation server is not reachable and --skip-launch-native was set.');
  }

  fs.writeFileSync(NATIVE_LOG_PATH, '', 'utf8');
  const logFd = fs.openSync(NATIVE_LOG_PATH, 'a');
  const child = spawn('swift', ['run', '--package-path', 'apps/xlightsdesigner-macos', 'XLightsDesignerMacOS'], {
    cwd: ROOT,
    detached: true,
    stdio: ['ignore', logFd, logFd],
    env: process.env
  });
  child.unref();
  const ready = await waitForNative(args.nativeTimeoutMs);
  return { launched: true, pid: child.pid, logPath: NATIVE_LOG_PATH, health: ready };
}

async function ensureXlights(args) {
  const health = await requestJson(`${DEFAULT_XLIGHTS_BASE_URL}/health`, 2000);
  const data = health.json?.data || {};
  if (health.ok && (data.startupSettled === true || str(data.state).toLowerCase() === 'ready')) {
    return { launched: false, health: health.json };
  }
  if (!args.launchXlights) {
    throw new Error('Owned xLights API is not ready and --skip-launch-xlights was set.');
  }

  const launched = await run('node', [
    'scripts/xlights/launch-owned-xlights.mjs',
    '--show-dir',
    path.resolve(args.showDir),
    '--api-timeout-ms',
    String(args.xlightsTimeoutMs)
  ]);
  const ready = await waitForXlights(args.xlightsTimeoutMs);
  return { launched: true, launchOutput: launched.stdout.trim(), launchErrorOutput: launched.stderr.trim(), health: ready };
}

function buildValidationArgs(args, showDir, scenario) {
  const validationArgs = [
    'scripts/native/validate-metadata-tag-proposal-flow.mjs',
    '--target-ids',
    scenario.targetIds,
    '--selected-tags',
    scenario.selectedTags,
    '--show-dir',
    showDir,
    '--force-validation-sequence',
    '--duration-ms',
    String(args.durationMs),
    '--frame-ms',
    String(args.frameMs),
    '--timeout-ms',
    String(args.timeoutMs)
  ];
  if (scenario.tagOnly || args.tagOnly) validationArgs.push('--tag-only');
  if (args.applyReview) validationArgs.push('--apply-review');
  if (args.applyReview && args.renderAfterApply) validationArgs.push('--render-after-apply');
  return validationArgs;
}

async function runValidationScenario(args, showDir, scenario) {
  const validation = await run('node', buildValidationArgs(args, showDir, scenario), { maxBuffer: 1024 * 1024 * 50 });
  return {
    name: scenario.name,
    ...JSON.parse(validation.stdout)
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const showDir = path.resolve(args.showDir);

  const native = await ensureNativeApp(args);
  const xlights = await ensureXlights({ ...args, showDir });
  await run('node', ['scripts/native/automation.mjs', 'refresh-xlights-session']);

  const matrix = args.matrix ? loadMatrixScenarios(args.matrixFile) : null;
  const scenarios = matrix
    ? matrix.scenarios
    : [{ name: args.tagOnly ? 'single-tag-only' : 'single', targetIds: args.targetIds, selectedTags: args.selectedTags, tagOnly: args.tagOnly }];
  const validations = [];
  for (const scenario of scenarios) {
    validations.push(await runValidationScenario(args, showDir, scenario));
  }
  console.log(JSON.stringify({
    ok: true,
    native: {
      launched: native.launched,
      pid: native.pid || null,
      logPath: native.logPath || '',
      automationBaseURL: DEFAULT_NATIVE_BASE_URL
    },
    xlights: {
      launched: xlights.launched,
      state: xlights.health?.data?.state || '',
      listenerReachable: xlights.health?.data?.listenerReachable === true
    },
    ...(matrix ? { matrixFile: matrix.filePath } : {}),
    ...(args.matrix ? { validations } : { validation: validations[0] })
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || String(error));
  if (error.stdout) console.error(error.stdout);
  if (error.stderr) console.error(error.stderr);
  process.exit(1);
});
