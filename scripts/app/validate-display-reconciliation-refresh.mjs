#!/usr/bin/env node

import { execFile, execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const APP_AUTOMATION_URL = process.env.XLD_APP_AUTOMATION_URL || 'http://127.0.0.1:49916';
const DEFAULT_XLIGHTS_APP = '/Users/robterry/xLights-2026.07/build/XLD-CodexDerivedData/Build/Products/Debug/xLights.app';
const DEFAULT_SOURCE_PROJECT = '/Users/robterry/Documents/Lights/xLightsDesigner/projects/Vendor Layout API Test/Vendor Layout API Test.xdproj';
const DEFAULT_SHOW_DIR = '/Users/robterry/Library/Containers/org.xlights/Data/tmp/xld_vendor_layout_api_test';
const DEFAULT_SCRATCH_NAME = 'Vendor Reconciliation Scratch';

function usage() {
  console.error([
    'usage: validate-display-reconciliation-refresh.mjs [options]',
    '',
    'options:',
    `  --xlights-app <path>       default: ${DEFAULT_XLIGHTS_APP}`,
    `  --source-project <path>    default: ${DEFAULT_SOURCE_PROJECT}`,
    `  --show-dir <path>          default: ${DEFAULT_SHOW_DIR}`,
    `  --scratch-name <name>      default: ${DEFAULT_SCRATCH_NAME}`,
    '  --keep-scratch            leave the scratch project on disk',
    '  --skip-launch-xlights     use an already running xLights Designer API',
    '  --skip-launch-app         use an already running app automation server'
  ].join('\n'));
  process.exit(2);
}

function parseArgs(argv) {
  const options = {
    xlightsApp: DEFAULT_XLIGHTS_APP,
    sourceProject: DEFAULT_SOURCE_PROJECT,
    showDir: DEFAULT_SHOW_DIR,
    scratchName: DEFAULT_SCRATCH_NAME,
    keepScratch: false,
    skipLaunchXLights: false,
    skipLaunchApp: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--xlights-app') {
      options.xlightsApp = argv[++index] || '';
    } else if (arg === '--source-project') {
      options.sourceProject = argv[++index] || '';
    } else if (arg === '--show-dir') {
      options.showDir = argv[++index] || '';
    } else if (arg === '--scratch-name') {
      options.scratchName = argv[++index] || '';
    } else if (arg === '--keep-scratch') {
      options.keepScratch = true;
    } else if (arg === '--skip-launch-xlights') {
      options.skipLaunchXLights = true;
    } else if (arg === '--skip-launch-app') {
      options.skipLaunchApp = true;
    } else if (arg === '--help' || arg === '-h') {
      usage();
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  if (!options.xlightsApp || !options.sourceProject || !options.showDir || !options.scratchName) {
    usage();
  }
  return {
    ...options,
    xlightsApp: path.resolve(options.xlightsApp),
    sourceProject: path.resolve(options.sourceProject),
    showDir: path.resolve(options.showDir)
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function sha1(value) {
  return createHash('sha1').update(value).digest('hex');
}

function processList() {
  const output = execFileSync('ps', ['-axo', 'pid=,command='], { encoding: 'utf8' });
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const firstSpace = line.indexOf(' ');
      return {
        pid: Number(line.slice(0, firstSpace)),
        command: line.slice(firstSpace + 1).trim()
      };
    })
    .filter((entry) => Number.isFinite(entry.pid));
}

function pidsMatching(predicate) {
  return processList().filter(predicate).map((entry) => entry.pid);
}

function killPid(pid) {
  try {
    execFileSync('kill', ['-TERM', String(pid)], { stdio: 'ignore' });
  } catch {}
}

function forceKillPid(pid) {
  try {
    execFileSync('kill', ['-KILL', String(pid)], { stdio: 'ignore' });
  } catch {}
}

function isPidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function stopPids(pids) {
  const stopped = [...pids];
  for (const pid of pids) killPid(pid);
  const started = Date.now();
  while (Date.now() - started < 5000) {
    if (pids.every((pid) => !isPidAlive(pid))) return stopped;
    await sleep(250);
  }
  for (const pid of pids) forceKillPid(pid);
  return stopped;
}

async function requestJson(method, urlPath, body = null, timeoutMs = 90000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const init = { method, headers: {}, signal: controller.signal };
    if (body) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    const response = await fetch(`${APP_AUTOMATION_URL}${urlPath}`, init);
    const text = await response.text();
    let parsed = {};
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = { ok: false, error: text };
    }
    if (!response.ok || parsed.ok === false) {
      throw new Error(`Automation request failed: ${method} ${urlPath}: ${JSON.stringify(parsed)}`);
    }
    return parsed;
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForAppAutomation(timeoutMs = 90000) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    try {
      return await requestJson('GET', '/health', null, 3000);
    } catch (error) {
      lastError = error;
      await sleep(1000);
    }
  }
  throw new Error(`App automation server did not become ready: ${lastError?.message || 'timeout'}`);
}

async function automationAction(action, extra = {}) {
  return requestJson('POST', '/action', { action, ...extra }, 120000);
}

async function launchXLights(options) {
  if (options.skipLaunchXLights) return null;
  const args = [
    'scripts/xlights/launch-owned-xlights.mjs',
    '--app', options.xlightsApp,
    '--bootstrap-show-dir', 'auto',
    '--api-show-dir', options.showDir,
    '--api-timeout-ms', '90000'
  ];
  const { stdout } = await execFileAsync('node', args, {
    cwd: process.cwd(),
    maxBuffer: 1024 * 1024 * 5
  });
  return { stdout };
}

async function launchApp(options) {
  if (options.skipLaunchApp) {
    await waitForAppAutomation();
    return null;
  }
  try {
    await requestJson('GET', '/health', null, 1500);
    return null;
  } catch {}

  const logPath = '/tmp/xld-app-reconciliation-validation.log';
  fs.writeFileSync(logPath, '', 'utf8');
  const logFd = fs.openSync(logPath, 'a');
  const child = spawn('swift', ['run', '--package-path', 'apps/xlightsdesigner-macos', 'XLightsDesignerMacOS'], {
    cwd: process.cwd(),
    detached: true,
    stdio: ['ignore', logFd, logFd]
  });
  child.unref();
  await waitForAppAutomation(120000);
  return { pid: child.pid, logPath };
}

function projectRootFor(sourceProject) {
  return path.dirname(path.dirname(sourceProject));
}

function makeScratchProject(options) {
  const sourceProject = readJson(options.sourceProject);
  const root = projectRootFor(options.sourceProject);
  const scratchDir = path.join(root, options.scratchName);
  const scratchFile = path.join(scratchDir, `${options.scratchName}.xdproj`);
  fs.rmSync(scratchDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(scratchDir, 'display'), { recursive: true });

  const now = new Date().toISOString();
  const project = {
    ...sourceProject,
    id: sha1(`${options.scratchName}:${options.showDir}`),
    key: options.scratchName,
    projectName: options.scratchName,
    showFolder: options.showDir,
    createdAt: now,
    updatedAt: now,
    snapshot: {
      ...(sourceProject.snapshot || {}),
      projectFilePath: scratchFile,
      projectMetadataRoot: path.dirname(root),
      projectCreatedAt: now,
      projectUpdatedAt: now,
      mediaPath: '',
      recentSequences: []
    }
  };
  writeJson(scratchFile, project);
  return { scratchDir, scratchFile };
}

function recordWithTargetId(record, targetId) {
  return {
    ...record,
    targetId,
    identity: {
      ...(record.identity || {}),
      displayName: targetId
    }
  };
}

function seedScratchDisplayFiles(sourceProject, scratchDir) {
  const sourceDisplayDir = path.join(path.dirname(sourceProject), 'display');
  const sourceModelIndex = readJson(path.join(sourceDisplayDir, 'model-index.json'));
  const records = Array.isArray(sourceModelIndex.records) ? sourceModelIndex.records : [];
  const spinner = records.find((record) => record.targetId === 'Spinner');
  const cane = records.find((record) => record.targetId === 'Boscoyo ChromaCane 1');
  if (!spinner) throw new Error('Source model index does not contain Spinner.');
  if (!cane) throw new Error('Source model index does not contain Boscoyo ChromaCane 1.');

  writeJson(path.join(scratchDir, 'display', 'metadata.json'), {
    version: 1,
    tags: [
      { id: 'validation-tag', name: 'Validation', description: 'Display reconciliation validation seed.' }
    ],
    targetTags: {
      Spinner: ['validation-tag'],
      'Old Spinner': ['validation-tag'],
      'Old Cane': ['validation-tag'],
      'Missing Prop': ['validation-tag']
    },
    preferencesByTargetId: {
      Spinner: { rolePreference: 'validation-direct', semanticHints: ['validation_direct'], submodelHints: [], effectAvoidances: [] },
      'Old Spinner': { rolePreference: 'validation-fingerprint', semanticHints: ['validation_fingerprint'], submodelHints: [], effectAvoidances: [] },
      'Old Cane': { rolePreference: 'validation-ambiguous', semanticHints: ['validation_ambiguous'], submodelHints: [], effectAvoidances: [] },
      'Missing Prop': { rolePreference: 'validation-orphan', semanticHints: ['validation_orphan'], submodelHints: [], effectAvoidances: [] }
    },
    visualHintDefinitions: []
  });

  writeJson(path.join(scratchDir, 'display', 'model-index.json'), {
    artifactType: 'target_metadata_index_v1',
    artifactVersion: '1.0',
    createdAt: new Date().toISOString(),
    source: {
      source: 'display-reconciliation-validation-seed',
      showFolder: null
    },
    summary: {
      targetCount: 2,
      modelCount: 2,
      groupCount: 0,
      submodelCount: 0
    },
    records: [
      recordWithTargetId(spinner, 'Old Spinner'),
      recordWithTargetId(cane, 'Old Cane')
    ]
  });
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

function assertRecord(record, expected) {
  if (!record) throw new Error(`Missing reconciliation record: ${expected.targetId}`);
  for (const [key, value] of Object.entries(expected)) {
    if (record[key] !== value) {
      throw new Error(`${expected.targetId}.${key}: expected ${value}, got ${record[key]}`);
    }
  }
}

function assertReconciliation(scratchDir) {
  const reconciliationPath = path.join(scratchDir, 'display', 'reconciliation.json');
  const artifact = readJson(reconciliationPath);
  const summary = artifact.summary || {};
  const records = Array.isArray(artifact.records) ? artifact.records : [];
  const byTarget = new Map(records.map((record) => [record.targetId, record]));

  assertEqual(summary.activeMetadataCount, 2, 'summary.activeMetadataCount');
  assertEqual(summary.fingerprintMatchCount, 1, 'summary.fingerprintMatchCount');
  assertEqual(summary.needsReviewCount, 1, 'summary.needsReviewCount');
  assertEqual(summary.ambiguousFingerprintCount, 1, 'summary.ambiguousFingerprintCount');
  assertEqual(summary.retainedOrphanedMetadataCount, 1, 'summary.retainedOrphanedMetadataCount');

  assertRecord(byTarget.get('Spinner'), {
    targetId: 'Spinner',
    status: 'active',
    matchedBy: 'target-id',
    confidence: 'exact',
    currentTargetId: 'Spinner'
  });
  assertRecord(byTarget.get('Old Spinner'), {
    targetId: 'Old Spinner',
    status: 'active',
    matchedBy: 'fingerprint',
    confidence: 'high',
    currentTargetId: 'Spinner'
  });
  assertRecord(byTarget.get('Old Cane'), {
    targetId: 'Old Cane',
    status: 'needs-review',
    matchedBy: 'ambiguous-fingerprint',
    confidence: 'ambiguous'
  });
  assertRecord(byTarget.get('Missing Prop'), {
    targetId: 'Missing Prop',
    status: 'retained-orphaned',
    matchedBy: 'retained-project-metadata',
    confidence: 'none'
  });

  const caneCandidates = byTarget.get('Old Cane')?.candidateTargetIds || [];
  const expectedCanes = Array.from({ length: 8 }, (_, index) => `Boscoyo ChromaCane ${index + 1}`);
  for (const targetId of expectedCanes) {
    if (!caneCandidates.includes(targetId)) {
      throw new Error(`Old Cane candidateTargetIds missing ${targetId}: ${JSON.stringify(caneCandidates)}`);
    }
  }

  return {
    reconciliationPath,
    summary,
    checkedRecords: {
      Spinner: byTarget.get('Spinner'),
      'Old Spinner': byTarget.get('Old Spinner'),
      'Old Cane': byTarget.get('Old Cane'),
      'Missing Prop': byTarget.get('Missing Prop')
    }
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(options.sourceProject)) throw new Error(`Source project not found: ${options.sourceProject}`);
  if (!fs.existsSync(options.xlightsApp)) throw new Error(`xLights app not found: ${options.xlightsApp}`);
  if (!fs.existsSync(options.showDir)) throw new Error(`Show folder not found: ${options.showDir}`);

  const baselineAppPids = new Set(pidsMatching((entry) => /XLightsDesignerMacOS|swift run .*XLightsDesignerMacOS/.test(entry.command)));
  const baselineXLightsPids = new Set(pidsMatching((entry) => /xLights\.app\/Contents\/MacOS\/xLights/.test(entry.command)));
  const scratch = makeScratchProject(options);
  let appLaunch = null;
  let xlightsLaunch = null;
  let result = null;
  const cleanup = { stoppedAppPids: [], stoppedXLightsPids: [] };

  try {
    xlightsLaunch = await launchXLights(options);
    appLaunch = await launchApp(options);
    await automationAction('openProjectWithoutRefresh', { filePath: scratch.scratchFile });
    seedScratchDisplayFiles(options.sourceProject, scratch.scratchDir);
    await automationAction('refreshDisplayAndWait');
    result = assertReconciliation(scratch.scratchDir);
  } finally {
    try {
      await automationAction('openProjectAndWait', { filePath: options.sourceProject });
    } catch {}
    if (!options.keepScratch) {
      fs.rmSync(scratch.scratchDir, { recursive: true, force: true });
    }
    const appPids = pidsMatching((entry) => /XLightsDesignerMacOS|swift run .*XLightsDesignerMacOS/.test(entry.command))
      .filter((pid) => !baselineAppPids.has(pid));
    cleanup.stoppedAppPids = await stopPids(appPids);
    const xlightsPids = pidsMatching((entry) => /xLights\.app\/Contents\/MacOS\/xLights/.test(entry.command))
      .filter((pid) => !baselineXLightsPids.has(pid));
    cleanup.stoppedXLightsPids = await stopPids(xlightsPids);
  }

  process.stdout.write(`${JSON.stringify({
    ok: true,
    scratchProjectFile: scratch.scratchFile,
    scratchRemoved: !options.keepScratch,
    appLaunch,
    xlightsLaunched: Boolean(xlightsLaunch),
    cleanup,
    ...result
  }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: String(error?.message || error),
    stack: error?.stack || ''
  }, null, 2));
  process.exit(1);
});
