#!/usr/bin/env node

import path from 'node:path';

const DEFAULT_NATIVE_URL = 'http://127.0.0.1:49916';

function str(value = '') {
  return String(value || '').trim();
}

function usage() {
  console.error('usage: validate-active-target-sync.mjs [--native-url url] [--project-file path] [--timeout-ms n]');
  process.exit(2);
}

function parseArgs(argv = []) {
  const args = {
    nativeUrl: DEFAULT_NATIVE_URL,
    projectFile: '',
    timeoutMs: 30000
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = str(argv[i]);
    if (token === '--native-url') args.nativeUrl = str(argv[++i]);
    else if (token === '--project-file') args.projectFile = path.resolve(str(argv[++i]));
    else if (token === '--timeout-ms') args.timeoutMs = Number(argv[++i]);
    else if (token === '--help') usage();
    else throw new Error(`Unknown argument: ${token}`);
  }
  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs < 1000) args.timeoutMs = 30000;
  return args;
}

async function request(baseUrl, method, route, body = null) {
  const init = { method, headers: {} };
  if (body) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const response = await fetch(`${baseUrl}${route}`, init);
  const text = await response.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = { ok: false, error: text }; }
  if (!response.ok || json?.ok === false) {
    throw new Error(`${method} ${route} failed (${response.status}): ${JSON.stringify(json)}`);
  }
  return json;
}

function page(snapshot = {}, name = '') {
  return snapshot?.pages?.[name] && typeof snapshot.pages[name] === 'object'
    ? snapshot.pages[name]
    : {};
}

function assertHeader({ failures, name, actual, expected, allowPrefix = false }) {
  const ok = allowPrefix ? str(actual).startsWith(expected) : str(actual) === expected;
  if (!ok) {
    failures.push(`${name} headerFocus expected ${allowPrefix ? `prefix ${expected}` : expected}, got ${str(actual) || '(empty)'}`);
  }
}

function assertNoGenericTargetLabels(snapshot = {}, failures = []) {
  for (const [name, value] of Object.entries(snapshot?.pages || {})) {
    const headerFocus = str(value?.headerFocus);
    if (/\bTarget\s*:/i.test(headerFocus)) {
      failures.push(`${name} headerFocus uses generic Target label: ${headerFocus}`);
    }
  }
}

function basenameWithoutExtension(filePath = '') {
  const leaf = str(filePath).split('/').filter(Boolean).pop() || '';
  return leaf.replace(/\.[^.]+$/, '');
}

function targetSequenceName(activeTarget = {}, xlights = {}) {
  return str(activeTarget.sequenceName)
    || basenameWithoutExtension(activeTarget.sequencePath)
    || basenameWithoutExtension(xlights.sequencePath);
}

function validateSnapshot(snapshot = {}) {
  const failures = [];
  const activeTarget = snapshot.activeTarget && typeof snapshot.activeTarget === 'object' ? snapshot.activeTarget : {};
  const xlights = snapshot.xlights && typeof snapshot.xlights === 'object' ? snapshot.xlights : {};
  const projectName = str(activeTarget.projectName || snapshot.workspace?.activeProjectName);
  const sequenceName = targetSequenceName(activeTarget, xlights);
  const audioName = str(activeTarget.audioName);

  if (!projectName) failures.push('Active project name is empty.');
  if (xlights.isSequenceOpen === true && !sequenceName) failures.push('xLights has a sequence open but active target sequence name is empty.');
  if (str(activeTarget.sequencePath) && str(xlights.sequencePath) && str(activeTarget.sequencePath) !== str(xlights.sequencePath)) {
    failures.push(`Active target sequencePath does not match xLights sequencePath: ${activeTarget.sequencePath} != ${xlights.sequencePath}`);
  }

  assertNoGenericTargetLabels(snapshot, failures);

  if (projectName) {
    assertHeader({
      failures,
      name: 'Project',
      actual: page(snapshot, 'project').headerFocus,
      expected: `Project: ${projectName}`
    });
    assertHeader({
      failures,
      name: 'Display',
      actual: page(snapshot, 'display').headerFocus,
      expected: `Project: ${projectName}`
    });
    const displayFocus = str(page(snapshot, 'display').headerFocus);
    if (/\bSequence\s*:/i.test(displayFocus)) {
      failures.push(`Display headerFocus must stay project-scoped, got ${displayFocus}`);
    }
  }

  if (sequenceName) {
    assertHeader({
      failures,
      name: 'Design',
      actual: page(snapshot, 'design').headerFocus,
      expected: `Sequence: ${sequenceName}`,
      allowPrefix: true
    });
    assertHeader({
      failures,
      name: 'Sequence',
      actual: page(snapshot, 'sequence').headerFocus,
      expected: `Sequence: ${sequenceName}`
    });
    assertHeader({
      failures,
      name: 'Review',
      actual: page(snapshot, 'review').headerFocus,
      expected: `Sequence: ${sequenceName}`
    });
    assertHeader({
      failures,
      name: 'History',
      actual: page(snapshot, 'history').headerFocus,
      expected: projectName ? `Project: ${projectName} • Sequence: ${sequenceName}` : `Sequence: ${sequenceName}`
    });
  }

  const audioFocus = str(page(snapshot, 'audio').headerFocus);
  if (audioName) {
    assertHeader({
      failures,
      name: 'Audio',
      actual: audioFocus,
      expected: `Audio: ${audioName}`
    });
  } else if (/\b(Project|Sequence|Target)\s*:/i.test(audioFocus)) {
    failures.push(`Audio headerFocus should not show stale project/sequence/target context when no active audio is selected: ${audioFocus}`);
  }

  return {
    ok: failures.length === 0,
    failures,
    projectName,
    sequenceName,
    audioName,
    headerFocus: Object.fromEntries(
      Object.entries(snapshot.pages || {}).map(([name, value]) => [name, str(value?.headerFocus)])
    )
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await request(args.nativeUrl, 'GET', '/health');
  if (args.projectFile) {
    await request(args.nativeUrl, 'POST', '/action', { action: 'openProject', filePath: args.projectFile });
  }
  await request(args.nativeUrl, 'POST', '/action', { action: 'refreshXLightsSession' });
  await request(args.nativeUrl, 'POST', '/action', { action: 'refreshAll' });

  const workflows = ['project', 'display', 'audio', 'design', 'sequence', 'review', 'history'];
  for (const workflow of workflows) {
    await request(args.nativeUrl, 'POST', '/action', { action: 'selectWorkflow', workflow });
  }

  const snapshot = await request(args.nativeUrl, 'GET', '/snapshot');
  const validation = validateSnapshot(snapshot);
  if (!validation.ok) {
    throw new Error(`Active target synchronization validation failed: ${JSON.stringify(validation, null, 2)}`);
  }
  process.stdout.write(`${JSON.stringify({
    ok: true,
    ...validation
  }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${String(error?.stack || error?.message || error)}\n`);
  process.exit(1);
});
