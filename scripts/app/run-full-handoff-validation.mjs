#!/usr/bin/env node
import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const DEFAULT_APP_BASE_URL = 'http://127.0.0.1:49916';
const DEFAULT_XLIGHTS_BASE_URL = 'http://127.0.0.1:49915/xlightsdesigner/api';
const DEFAULT_SHOW_DIR = process.env.XLIGHTS_SHOW_DIR || path.join(process.env.HOME || '', 'Desktop', 'Show');
const DEFAULT_BOOTSTRAP_SHOW_DIR = process.env.XLIGHTS_BOOTSTRAP_SHOW_DIR || '';
const DEFAULT_TARGET_IDS = 'Star';
const DEFAULT_SELECTED_TAGS = 'lead';
const APP_LOG_PATH = '/tmp/xld-app-app.log';
const DEFAULT_MATRIX_FILE = path.join(ROOT, 'scripts/app/full-handoff-validation-scenarios.json');

function str(value = '') {
  return String(value || '').trim();
}

function usage() {
  console.error([
    'usage: run-full-handoff-validation.mjs [options]',
    '',
    'Options:',
    '  --show-dir <path>              Linked xLights show folder. Defaults to $XLIGHTS_SHOW_DIR or ~/Desktop/Show.',
    '  --target-ids <ids>             Exact xLights target ids. Defaults to Star.',
    '  --selected-tags <tags>         Selected metadata tags. Defaults to lead.',
    '  --section-label <label>        Optional timing-track section label to scope generation.',
    '  --timing-track-name <name>     Optional timing track name to disambiguate section labels.',
    '  --intent-goal <text>           Optional validation design intent goal.',
    '  --expected-timing-tracks <csv>  Optional timing tracks that generated plans must create with marks.',
    '  --expected-anchor-tracks <csv>  Optional timing tracks that generated effects must anchor/align to.',
    '  --require-anchors-in-section    Require expected cue-anchored effects to remain inside the selected section.',
    '  --tag-only                    Seed expected target metadata, then generate from tags without target text.',
    '  --matrix                       Run the default metadata handoff scenario matrix.',
    '  --matrix-file <path>           Run scenarios from a JSON matrix file.',
    '  --skip-extra-validations       Skip matrix extra validations.',
    '  --only-extra-validations       Run only matrix extra validations.',
    '  --duration-ms <n>              Validation sequence duration. Defaults to 30000.',
    '  --frame-ms <n>                 Validation sequence frame interval. Defaults to 50.',
    '  --timeout-ms <n>               End-to-end validation timeout. Defaults to 180000.',
    '  --app-timeout-ms <n>        App automation startup timeout. Defaults to 60000.',
    '  --xlights-timeout-ms <n>       Owned xLights startup timeout. Defaults to 120000.',
    '  --skip-launch-app           Require an already-running app automation server.',
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
    sectionLabel: '',
    timingTrackName: '',
    intentGoal: '',
    expectedTimingTracks: '',
    expectedAnchorTracks: '',
    requireAnchorsInSection: false,
    durationMs: 30000,
    frameMs: 50,
    timeoutMs: 180000,
    appTimeoutMs: 60000,
    xlightsTimeoutMs: 120000,
    launchApp: true,
    launchXlights: true,
    applyReview: true,
    renderAfterApply: true,
    tagOnly: false,
    matrix: false,
    matrixFile: '',
    extraValidations: true,
    onlyExtraValidations: false
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
    else if (token === '--section-label') args.sectionLabel = next();
    else if (token === '--timing-track-name' || token === '--section-timing-track-name') args.timingTrackName = next();
    else if (token === '--intent-goal' || token === '--validation-goal') args.intentGoal = next();
    else if (token === '--expected-timing-tracks') args.expectedTimingTracks = next();
    else if (token === '--expected-anchor-tracks' || token === '--expected-anchored-timing-tracks') args.expectedAnchorTracks = next();
    else if (token === '--require-anchors-in-section') args.requireAnchorsInSection = true;
    else if (token === '--tag-only') args.tagOnly = true;
    else if (token === '--matrix') args.matrix = true;
    else if (token === '--matrix-file') {
      args.matrix = true;
      args.matrixFile = next();
    }
    else if (token === '--duration-ms') args.durationMs = Number(next());
    else if (token === '--frame-ms') args.frameMs = Number(next());
    else if (token === '--timeout-ms') args.timeoutMs = Number(next());
    else if (token === '--app-timeout-ms') args.appTimeoutMs = Number(next());
    else if (token === '--xlights-timeout-ms') args.xlightsTimeoutMs = Number(next());
    else if (token === '--skip-launch-app') args.launchApp = false;
    else if (token === '--skip-launch-xlights') args.launchXlights = false;
    else if (token === '--skip-extra-validations') args.extraValidations = false;
    else if (token === '--only-extra-validations') {
      args.matrix = true;
      args.onlyExtraValidations = true;
    }
    else if (token === '--no-apply-review') args.applyReview = false;
    else if (token === '--no-render-after-apply') args.renderAfterApply = false;
    else throw new Error(`Unknown argument: ${token}`);
  }
  if (!Number.isFinite(args.durationMs) || args.durationMs <= 0) args.durationMs = 30000;
  if (!Number.isFinite(args.frameMs) || args.frameMs <= 0) args.frameMs = 50;
  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs <= 0) args.timeoutMs = 180000;
  if (!Number.isFinite(args.appTimeoutMs) || args.appTimeoutMs <= 0) args.appTimeoutMs = 60000;
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
    sectionLabel: str(row?.sectionLabel || row?.selectedSection || row?.section),
    timingTrackName: str(row?.timingTrackName || row?.sectionTimingTrackName),
    intentGoal: str(row?.intentGoal || row?.validationGoal || row?.goal),
    expectedTimingTracks: Array.isArray(row?.expectedTimingTracks)
      ? row.expectedTimingTracks.map((value) => str(value)).filter(Boolean).join(',')
      : str(row?.expectedTimingTracks),
    expectedAnchorTracks: Array.isArray(row?.expectedAnchorTracks || row?.expectedAnchoredTimingTracks)
      ? (row.expectedAnchorTracks || row.expectedAnchoredTimingTracks).map((value) => str(value)).filter(Boolean).join(',')
      : str(row?.expectedAnchorTracks || row?.expectedAnchoredTimingTracks),
    requireAnchorsInSection: row?.requireAnchorsInSection === true || row?.requireSectionScopedAnchors === true,
    seedExistingEffect: row?.seedExistingEffect === true,
    seedExistingModel: str(row?.seedExistingModel || row?.seedExistingTarget || row?.seedTarget),
    seedExistingEffectName: str(row?.seedExistingEffectName || row?.seedEffectName),
    seedExistingLayer: Number.isFinite(Number(row?.seedExistingLayer)) ? Number(row.seedExistingLayer) : null,
    seedExistingStartMs: Number.isFinite(Number(row?.seedExistingStartMs)) ? Number(row.seedExistingStartMs) : null,
    seedExistingEndMs: Number.isFinite(Number(row?.seedExistingEndMs)) ? Number(row.seedExistingEndMs) : null,
    expectReplacementOverlap: row?.expectReplacementOverlap === true || row?.expectReplacementAuthorized === true,
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
    scenarios: scenarios.map(normalizeScenario),
    extraValidations: Array.isArray(document?.extraValidations) ? document.extraValidations : []
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

async function waitForApp(timeoutMs) {
  const started = Date.now();
  let last = null;
  for (;;) {
    last = await requestJson(`${DEFAULT_APP_BASE_URL}/health`, 5000);
    if (last.ok && last.json?.ok !== false) {
      return last.json;
    }
    if (Date.now() - started > timeoutMs) {
      throw new Error(`Timed out waiting for app automation server: ${JSON.stringify(last)}`);
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
    const modalState = data?.modalState && typeof data.modalState === 'object' ? data.modalState : {};
    const modalObserved = modalState.observed !== false && str(modalState.observed).toLowerCase() !== 'false';
    const modalBlocked = modalObserved && (modalState.blocked === true || str(modalState.blocked).toLowerCase() === 'true');
    if (last.ok && (data.startupSettled === true || str(data.state).toLowerCase() === 'ready') && !modalBlocked) {
      return last.json;
    }
    if (Date.now() - started > timeoutMs) {
      throw new Error(`Timed out waiting for owned xLights API: ${JSON.stringify(last)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

async function ensureApp(args) {
  const health = await requestJson(`${DEFAULT_APP_BASE_URL}/health`, 2000);
  if (health.ok) {
    return { launched: false, health: health.json };
  }
  if (!args.launchApp) {
    throw new Error('App automation server is not reachable and --skip-launch-app was set.');
  }

  fs.writeFileSync(APP_LOG_PATH, '', 'utf8');
  const logFd = fs.openSync(APP_LOG_PATH, 'a');
  const child = spawn('swift', ['run', '--package-path', 'apps/xlightsdesigner-macos', 'XLightsDesignerMacOS'], {
    cwd: ROOT,
    detached: true,
    stdio: ['ignore', logFd, logFd],
    env: process.env
  });
  child.unref();
  const ready = await waitForApp(args.appTimeoutMs);
  return { launched: true, pid: child.pid, logPath: APP_LOG_PATH, health: ready };
}

async function ensureXlights(args) {
  const health = await requestJson(`${DEFAULT_XLIGHTS_BASE_URL}/health`, 2000);
  const data = health.json?.data || {};
  const modalState = data?.modalState && typeof data.modalState === 'object' ? data.modalState : {};
  const modalObserved = modalState.observed !== false && str(modalState.observed).toLowerCase() !== 'false';
  const modalBlocked = modalObserved && (modalState.blocked === true || str(modalState.blocked).toLowerCase() === 'true');
  if (health.ok && (data.startupSettled === true || str(data.state).toLowerCase() === 'ready') && !modalBlocked) {
    return { launched: false, health: health.json };
  }
  if (!args.launchXlights) {
    throw new Error('Owned xLights API is not ready and --skip-launch-xlights was set.');
  }

  const showDir = path.resolve(args.showDir);
  const bootstrapShowDir = str(DEFAULT_BOOTSTRAP_SHOW_DIR)
    ? (str(DEFAULT_BOOTSTRAP_SHOW_DIR).toLowerCase() === 'auto' ? 'auto' : path.resolve(DEFAULT_BOOTSTRAP_SHOW_DIR))
    : '';
  const launchShowDirArgs = bootstrapShowDir
    ? ['--bootstrap-show-dir', bootstrapShowDir, '--api-show-dir', showDir]
    : ['--show-dir', showDir];
  const launched = await run('node', [
    'scripts/xlights/launch-owned-xlights.mjs',
    ...(process.env.XLIGHTS_APP_PATH ? ['--app', path.resolve(process.env.XLIGHTS_APP_PATH)] : []),
    ...launchShowDirArgs,
    '--modal-policy',
    'fail',
    '--api-timeout-ms',
    String(args.xlightsTimeoutMs)
  ]);
  const ready = await waitForXlights(args.xlightsTimeoutMs);
  return { launched: true, launchOutput: launched.stdout.trim(), launchErrorOutput: launched.stderr.trim(), health: ready };
}

function buildValidationArgs(args, showDir, scenario) {
  const validationArgs = [
    'scripts/app/validate-metadata-tag-proposal-flow.mjs',
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
  const sectionLabel = str(scenario.sectionLabel || args.sectionLabel);
  const timingTrackName = str(scenario.timingTrackName || args.timingTrackName);
  const intentGoal = str(scenario.intentGoal || args.intentGoal);
  const expectedTimingTracks = str(scenario.expectedTimingTracks || args.expectedTimingTracks);
  const expectedAnchorTracks = str(scenario.expectedAnchorTracks || args.expectedAnchorTracks);
  if (sectionLabel) validationArgs.push('--section-label', sectionLabel);
  if (timingTrackName) validationArgs.push('--timing-track-name', timingTrackName);
  if (intentGoal) validationArgs.push('--intent-goal', intentGoal);
  if (expectedTimingTracks) validationArgs.push('--expected-timing-tracks', expectedTimingTracks);
  if (expectedAnchorTracks) validationArgs.push('--expected-anchor-tracks', expectedAnchorTracks);
  if (scenario.requireAnchorsInSection || args.requireAnchorsInSection) validationArgs.push('--require-anchors-in-section');
  if (scenario.seedExistingEffect) {
    validationArgs.push('--seed-existing-effect');
    if (scenario.seedExistingModel) validationArgs.push('--seed-existing-model', scenario.seedExistingModel);
    if (scenario.seedExistingEffectName) validationArgs.push('--seed-existing-effect-name', scenario.seedExistingEffectName);
    if (scenario.seedExistingLayer !== null) validationArgs.push('--seed-existing-layer', String(scenario.seedExistingLayer));
    if (scenario.seedExistingStartMs !== null) validationArgs.push('--seed-existing-start-ms', String(scenario.seedExistingStartMs));
    if (scenario.seedExistingEndMs !== null) validationArgs.push('--seed-existing-end-ms', String(scenario.seedExistingEndMs));
  }
  if (scenario.expectReplacementOverlap) validationArgs.push('--expect-replacement-overlap');
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

function normalizeExtraValidation(row = {}, index = 0) {
  const type = str(row?.type || row?.validationType);
  if (!type) throw new Error(`Extra validation ${index + 1} is missing type.`);
  return {
    name: str(row?.name) || type,
    type,
    sourceModel: str(row?.sourceModel),
    targetModel: str(row?.targetModel),
    projectFile: str(row?.projectFile),
    sourceProject: str(row?.sourceProject),
    showDir: str(row?.showDir),
    scratchName: str(row?.scratchName),
    appUrl: str(row?.appUrl),
    timeoutMs: Number.isFinite(Number(row?.timeoutMs)) ? Number(row.timeoutMs) : null
  };
}

function buildExtraValidationArgs(args, showDir, validation = {}) {
  if (validation.type === 'appVisualInspirationFixture') {
    const validationArgs = [
      'scripts/app/validate-visual-inspiration-fixture.mjs',
      '--app-url',
      validation.appUrl || DEFAULT_APP_BASE_URL
    ];
    if (validation.projectFile) validationArgs.push('--project-file', validation.projectFile);
    if (validation.timeoutMs) validationArgs.push('--timeout-ms', String(validation.timeoutMs));
    return validationArgs;
  }
  if (validation.type === 'appDesignChatSongGate') {
    const validationArgs = [
      'scripts/app/validate-design-chat-song-gate.mjs',
      '--app-url',
      validation.appUrl || DEFAULT_APP_BASE_URL,
      '--show-dir',
      showDir
    ];
    if (validation.projectFile) validationArgs.push('--project-file', validation.projectFile);
    if (validation.timeoutMs) validationArgs.push('--timeout-ms', String(validation.timeoutMs));
    return validationArgs;
  }
  if (validation.type === 'appActiveTargetSync') {
    const validationArgs = [
      'scripts/app/validate-active-target-sync.mjs',
      '--app-url',
      validation.appUrl || DEFAULT_APP_BASE_URL
    ];
    if (validation.projectFile) validationArgs.push('--project-file', validation.projectFile);
    if (validation.timeoutMs) validationArgs.push('--timeout-ms', String(validation.timeoutMs));
    return validationArgs;
  }
  if (validation.type === 'displayReconciliationRefresh') {
    const validationArgs = [
      'scripts/app/validate-display-reconciliation-refresh.mjs',
      '--show-dir',
      validation.showDir || showDir,
      '--skip-launch-app',
      '--skip-launch-xlights'
    ];
    if (validation.sourceProject) validationArgs.push('--source-project', validation.sourceProject);
    if (validation.projectFile) validationArgs.push('--restore-project', validation.projectFile);
    if (validation.scratchName) validationArgs.push('--scratch-name', validation.scratchName);
    return validationArgs;
  }
  if (validation.type !== 'appReviewExplicitEditSurface') {
    throw new Error(`Unsupported extra validation type: ${validation.type}`);
  }
  const validationArgs = [
    'scripts/app/validate-review-explicit-edit-surface.mjs',
    '--show-dir',
    showDir,
    '--endpoint',
    DEFAULT_XLIGHTS_BASE_URL,
    '--app-url',
    DEFAULT_APP_BASE_URL,
    '--duration-ms',
    String(args.durationMs),
    '--frame-ms',
    String(args.frameMs),
    '--ready-timeout-ms',
    String(args.xlightsTimeoutMs)
  ];
  if (validation.projectFile) validationArgs.push('--project-file', validation.projectFile);
  if (validation.sourceModel) validationArgs.push('--source-model', validation.sourceModel);
  if (validation.targetModel) validationArgs.push('--target-model', validation.targetModel);
  return validationArgs;
}

async function runExtraValidation(args, showDir, validation) {
  const normalized = normalizeExtraValidation(validation);
  const runOptions = normalized.timeoutMs
    ? { maxBuffer: 1024 * 1024 * 50, env: { ...process.env, XLD_VALIDATION_TIMEOUT_MS: String(normalized.timeoutMs) } }
    : { maxBuffer: 1024 * 1024 * 50 };
  const result = await run('node', buildExtraValidationArgs(args, showDir, normalized), runOptions);
  return {
    name: normalized.name,
    type: normalized.type,
    ...JSON.parse(result.stdout)
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const showDir = path.resolve(args.showDir);

  const app = await ensureApp(args);
  const xlights = await ensureXlights({ ...args, showDir });
  await run('node', ['scripts/app/automation.mjs', 'refresh-xlights-session']);

  const matrix = args.matrix ? loadMatrixScenarios(args.matrixFile) : null;
  const scenarios = args.onlyExtraValidations
    ? []
    : matrix
    ? matrix.scenarios
    : [{ name: args.tagOnly ? 'single-tag-only' : 'single', targetIds: args.targetIds, selectedTags: args.selectedTags, tagOnly: args.tagOnly }];
  const validations = [];
  for (const scenario of scenarios) {
    validations.push(await runValidationScenario(args, showDir, scenario));
  }
  const extraValidations = [];
  if (matrix && args.extraValidations) {
    for (const validation of matrix.extraValidations) {
      extraValidations.push(await runExtraValidation(args, showDir, validation));
    }
  }
  console.log(JSON.stringify({
    ok: true,
    app: {
      launched: app.launched,
      pid: app.pid || null,
      logPath: app.logPath || '',
      automationBaseURL: DEFAULT_APP_BASE_URL
    },
    xlights: {
      launched: xlights.launched,
      state: xlights.health?.data?.state || '',
      listenerReachable: xlights.health?.data?.listenerReachable === true
    },
    ...(matrix ? { matrixFile: matrix.filePath } : {}),
    ...(args.matrix ? { validations, extraValidations } : { validation: validations[0] })
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || String(error));
  if (error.stdout) console.error(error.stdout);
  if (error.stderr) console.error(error.stderr);
  process.exit(1);
});
