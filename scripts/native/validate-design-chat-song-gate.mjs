#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DEFAULT_NATIVE_URL = 'http://127.0.0.1:49916';
const DEFAULT_SHOW_DIR = '/Users/robterry/Desktop/Show';

function str(value = '') {
  return String(value || '').trim();
}

function parseArgs(argv = []) {
  const args = {
    nativeUrl: DEFAULT_NATIVE_URL,
    timeoutMs: 30000,
    projectFile: '',
    showDir: DEFAULT_SHOW_DIR,
    mode: 'both'
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = str(argv[i]);
    if (token === '--native-url') args.nativeUrl = str(argv[++i]);
    else if (token === '--timeout-ms') args.timeoutMs = Number(argv[++i]);
    else if (token === '--project-file') args.projectFile = path.resolve(str(argv[++i]));
    else if (token === '--show-dir') args.showDir = path.resolve(str(argv[++i]));
    else if (token === '--mode') args.mode = str(argv[++i]);
    else if (token === '--help') {
      console.error('usage: validate-design-chat-song-gate.mjs [--native-url url] [--project-file path] [--show-dir path] [--mode both|missing-song|selected-song] [--timeout-ms n]');
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }
  if (!['both', 'missing-song', 'selected-song'].includes(args.mode)) {
    throw new Error('--mode must be both, missing-song, or selected-song.');
  }
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
  if (!response.ok) throw new Error(json?.error || json?.message || text || `HTTP ${response.status}`);
  return json;
}

function createProject({ projectFile = '', showFolder = '', mediaPath = '', sequencePath = '' } = {}) {
  const root = projectFile
    ? path.dirname(path.dirname(path.resolve(projectFile)))
    : fs.mkdtempSync(path.join(os.tmpdir(), 'xld-design-chat-song-gate-'));
  const projectName = projectFile ? path.basename(projectFile, '.xdproj') : 'Design Chat Song Gate';
  const projectDir = projectFile ? path.dirname(path.resolve(projectFile)) : path.join(root, 'projects', projectName);
  const projectPath = projectFile ? path.resolve(projectFile) : path.join(projectDir, `${projectName}.xdproj`);
  fs.mkdirSync(projectDir, { recursive: true });
  const resolvedShowFolder = showFolder ? path.resolve(showFolder) : path.join(root, 'show');
  fs.mkdirSync(resolvedShowFolder, { recursive: true });
  const doc = {
    version: 1,
    projectName,
    showFolder: resolvedShowFolder,
    mediaPath,
    key: `${projectName}::${resolvedShowFolder}`,
    id: 'design-chat-song-gate',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    snapshot: {
      projectName,
      projectFilePath: projectPath,
      mediaPath,
      sequencePathInput: sequencePath,
      activeSequence: sequencePath
    }
  };
  fs.writeFileSync(projectPath, JSON.stringify(doc, null, 2), 'utf8');
  return { root, projectDir, projectPath, showFolder: resolvedShowFolder, sequencePath, mediaPath };
}

async function waitForAssistantIdle(baseUrl, timeoutMs = 30000) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < timeoutMs) {
    last = await request(baseUrl, 'GET', '/assistant-snapshot');
    if (!last?.isSending) return last;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for assistant response. Last snapshot: ${JSON.stringify(last)}`);
}

async function sendDesignPrompt(baseUrl, timeoutMs, prompt = 'Mira, create a visual inspiration board for this active song.') {
  await request(baseUrl, 'POST', '/action', { action: 'selectWorkflow', workflow: 'design' });
  await request(baseUrl, 'POST', '/action', { action: 'resetAssistantMemory' });
  await request(baseUrl, 'POST', '/action', {
    action: 'sendAssistantPrompt',
    prompt
  });
  return waitForAssistantIdle(baseUrl, timeoutMs);
}

async function runMissingSongScenario(args) {
  const fixture = createProject({ projectFile: args.projectFile });
  await request(args.nativeUrl, 'GET', '/health');
  await request(args.nativeUrl, 'POST', '/action', { action: 'openProject', filePath: fixture.projectPath });
  const assistant = await sendDesignPrompt(args.nativeUrl, args.timeoutMs);
  const text = str(assistant?.lastMessage?.text);
  if (!/select or open a song\/sequence first/i.test(text)) {
    throw new Error(`Assistant did not block design chat without selected song. Last message: ${text}`);
  }
  if (assistant?.lastDiagnostics?.responseCode !== 'SONG_CONTEXT_REQUIRED') {
    throw new Error(`Expected SONG_CONTEXT_REQUIRED diagnostics, got ${assistant?.lastDiagnostics?.responseCode || '(missing)'}`);
  }
  const app = await request(args.nativeUrl, 'GET', '/snapshot');
  const visual = app?.pages?.design?.visualInspiration || {};
  if (visual.available === true) {
    throw new Error('Visual inspiration should not be available after blocked no-song chat request.');
  }
  return {
    ok: true,
    mode: 'missing-song',
    projectFile: fixture.projectPath,
    lastMessage: text,
    responseCode: assistant.lastDiagnostics.responseCode,
    visualInspirationAvailable: Boolean(visual.available)
  };
}

async function runSelectedSongScenario(args) {
  const showDir = path.resolve(args.showDir);
  const sequencePath = path.join(showDir, '_xlightsdesigner_validation', 'design-chat-song-gate', `${new Date().toISOString().replace(/[:.]/g, '-')}.xsq`);
  fs.mkdirSync(path.dirname(sequencePath), { recursive: true });
  const fixture = createProject({
    showFolder: showDir,
    sequencePath
  });
  await request(args.nativeUrl, 'GET', '/health');
  await request(args.nativeUrl, 'POST', '/action', { action: 'openProject', filePath: fixture.projectPath });
  await request(args.nativeUrl, 'POST', '/action', {
    action: 'createXLightsSequence',
    filePath: sequencePath,
    durationMs: 30000,
    frameMs: 50
  });
  await request(args.nativeUrl, 'POST', '/action', { action: 'refreshXLightsSession' });
  await request(args.nativeUrl, 'POST', '/action', { action: 'refreshAll' });
  const assistant = await sendDesignPrompt(args.nativeUrl, args.timeoutMs);
  const text = str(assistant?.lastMessage?.text);
  if (/select or open a song\/sequence first/i.test(text)) {
    throw new Error(`Assistant incorrectly blocked design chat despite selected song. Last message: ${text}`);
  }
  if (assistant?.lastDiagnostics?.responseCode === 'SONG_CONTEXT_REQUIRED') {
    throw new Error('Assistant diagnostics still reported SONG_CONTEXT_REQUIRED despite selected song.');
  }
  return {
    ok: true,
    mode: 'selected-song',
    projectFile: fixture.projectPath,
    sequencePath,
    lastMessage: text,
    responseCode: assistant?.lastDiagnostics?.responseCode || '',
    routeDecision: assistant?.lastDiagnostics?.routeDecision || '',
    sequenceOpen: Boolean(assistant?.lastDiagnostics?.sequenceOpen)
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const results = [];
  if (args.mode === 'both' || args.mode === 'missing-song') {
    results.push(await runMissingSongScenario(args));
  }
  if (args.mode === 'both' || args.mode === 'selected-song') {
    results.push(await runSelectedSongScenario(args));
  }
  process.stdout.write(`${JSON.stringify({
    ok: true,
    results,
    missingSong: results.find((row) => row.mode === 'missing-song') || null,
    selectedSong: results.find((row) => row.mode === 'selected-song') || null
  }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${String(error?.stack || error?.message || error)}\n`);
  process.exit(1);
});
