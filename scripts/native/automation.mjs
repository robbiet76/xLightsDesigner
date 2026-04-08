#!/usr/bin/env node

const BASE_URL = process.env.XLD_NATIVE_AUTOMATION_URL || 'http://127.0.0.1:49916';

function usage() {
  console.error('usage: automation.mjs ping | get-health-snapshot | get-app-snapshot | get-assistant-snapshot | select-workflow <project|layout|audio|design|sequence|review|history> | refresh-current-workflow | refresh-all | send-assistant-prompt <prompt> | apply-review | defer-review | accept-timing-review | show-assistant | hide-assistant');
  process.exit(2);
}

async function request(method, path, body = null) {
  const init = { method, headers: {} };
  if (body) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const response = await fetch(`${BASE_URL}${path}`, init);
  const text = await response.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch { parsed = { ok: false, error: text }; }
  if (!response.ok) {
    process.stdout.write(`${JSON.stringify(parsed, null, 2)}\n`);
    process.exit(1);
  }
  process.stdout.write(`${JSON.stringify(parsed, null, 2)}\n`);
}

const [, , command, ...rest] = process.argv;
if (!command) usage();

switch (command) {
  case 'ping':
  case 'get-health-snapshot':
    await request('GET', '/health');
    break;
  case 'get-app-snapshot':
    await request('GET', '/snapshot');
    break;
  case 'get-assistant-snapshot':
    await request('GET', '/assistant-snapshot');
    break;
  case 'select-workflow':
    await request('POST', '/action', { action: 'selectWorkflow', workflow: String(rest[0] || '').trim() });
    break;
  case 'refresh-current-workflow':
    await request('POST', '/action', { action: 'refreshCurrentWorkflow' });
    break;
  case 'refresh-all':
    await request('POST', '/action', { action: 'refreshAll' });
    break;
  case 'send-assistant-prompt':
    await request('POST', '/action', { action: 'sendAssistantPrompt', prompt: rest.join(' ').trim() });
    break;
  case 'apply-review':
    await request('POST', '/action', { action: 'applyReview' });
    break;
  case 'defer-review':
    await request('POST', '/action', { action: 'deferReview' });
    break;
  case 'accept-timing-review':
    await request('POST', '/action', { action: 'acceptTimingReview' });
    break;
  case 'show-assistant':
    await request('POST', '/action', { action: 'showAssistant' });
    break;
  case 'hide-assistant':
    await request('POST', '/action', { action: 'hideAssistant' });
    break;
  default:
    usage();
}
