#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DEFAULT_NATIVE_URL = 'http://127.0.0.1:49916';

function str(value = '') {
  return String(value || '').trim();
}

function parseArgs(argv = []) {
  const args = {
    nativeUrl: DEFAULT_NATIVE_URL,
    timeoutMs: 30000,
    projectFile: ''
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = str(argv[i]);
    if (token === '--native-url') args.nativeUrl = str(argv[++i]);
    else if (token === '--timeout-ms') args.timeoutMs = Number(argv[++i]);
    else if (token === '--project-file') args.projectFile = path.resolve(str(argv[++i]));
    else if (token === '--help') {
      console.error('usage: validate-design-chat-song-gate.mjs [--native-url url] [--project-file path] [--timeout-ms n]');
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
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

function createProject(projectFile = '') {
  const root = projectFile
    ? path.dirname(path.dirname(path.resolve(projectFile)))
    : fs.mkdtempSync(path.join(os.tmpdir(), 'xld-design-chat-song-gate-'));
  const projectName = projectFile ? path.basename(projectFile, '.xdproj') : 'Design Chat Song Gate';
  const projectDir = projectFile ? path.dirname(path.resolve(projectFile)) : path.join(root, 'projects', projectName);
  const projectPath = projectFile ? path.resolve(projectFile) : path.join(projectDir, `${projectName}.xdproj`);
  fs.mkdirSync(projectDir, { recursive: true });
  const showFolder = path.join(root, 'show');
  fs.mkdirSync(showFolder, { recursive: true });
  const doc = {
    version: 1,
    projectName,
    showFolder,
    mediaPath: '',
    key: `${projectName}::${showFolder}`,
    id: 'design-chat-song-gate',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    snapshot: {
      projectName,
      projectFilePath: projectPath,
      mediaPath: '',
      sequencePathInput: '',
      activeSequence: ''
    }
  };
  fs.writeFileSync(projectPath, JSON.stringify(doc, null, 2), 'utf8');
  return { root, projectDir, projectPath, showFolder };
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const fixture = createProject(args.projectFile);
  await request(args.nativeUrl, 'GET', '/health');
  await request(args.nativeUrl, 'POST', '/action', { action: 'openProject', filePath: fixture.projectPath });
  await request(args.nativeUrl, 'POST', '/action', { action: 'selectWorkflow', workflow: 'design' });
  await request(args.nativeUrl, 'POST', '/action', { action: 'resetAssistantMemory' });
  await request(args.nativeUrl, 'POST', '/action', {
    action: 'sendAssistantPrompt',
    prompt: 'Create a visual inspiration board and start the design process for this song.'
  });
  const assistant = await waitForAssistantIdle(args.nativeUrl, args.timeoutMs);
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
  process.stdout.write(`${JSON.stringify({
    ok: true,
    projectFile: fixture.projectPath,
    lastMessage: text,
    responseCode: assistant.lastDiagnostics.responseCode,
    visualInspirationAvailable: Boolean(visual.available)
  }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${String(error?.stack || error?.message || error)}\n`);
  process.exit(1);
});
