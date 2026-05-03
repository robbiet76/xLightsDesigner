#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const BASE = 'http://127.0.0.1:49915/xlightsdesigner/api';
const DEFAULT_SHOW_DIR = process.env.XLIGHTS_SHOW_DIR || path.join(process.env.HOME || '', 'Desktop', 'Show');
const MEDIA_FILE = process.env.XLIGHTS_MEDIA_FILE || path.join(DEFAULT_SHOW_DIR, 'Audio', "01 CAN'T STOP THE FEELING Film final.mp3");

async function request(path, { method = 'GET', body = null } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: body == null ? undefined : { 'Content-Type': 'application/json' },
    body: body == null ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  const json = JSON.parse(text);
  return { status: response.status, json };
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

async function assertNoBlockingModal() {
  const { json } = await request('/health');
  const message = modalBlockedMessage(json);
  if (message) throw new Error(message);
  return json;
}

async function waitForJob(jobId, timeoutMs = 120000) {
  const started = Date.now();
  for (;;) {
    await assertNoBlockingModal();
    const { json } = await request(`/jobs/get?jobId=${encodeURIComponent(jobId)}`);
    if (json?.data?.state === 'succeeded') return json;
    if (json?.data?.state === 'failed') throw new Error(JSON.stringify(json));
    if (Date.now() - started > timeoutMs) throw new Error(`Timed out waiting for job ${jobId}`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

async function main() {
  await assertNoBlockingModal();
  const explicitPath = process.argv[2];
  const ts = execFileSync('date', ['+%Y%m%d-%H%M%S'], { encoding: 'utf8' }).trim();
  const file = explicitPath || path.join(DEFAULT_SHOW_DIR, 'Test', `API-App-Flow-${ts}.xsq`);
  const create = await request('/sequence/create', {
    method: 'POST',
    body: {
      file,
      mediaFile: MEDIA_FILE,
      overwrite: true
    }
  });
  const jobId = create.json?.data?.jobId;
  if (!jobId) {
    throw new Error(`sequence.create did not return jobId: ${JSON.stringify(create.json)}`);
  }
  const job = await waitForJob(jobId);
  const open = await request('/sequence/open');
  console.log(JSON.stringify({ file, create: create.json, job, open: open.json }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || String(error));
  process.exit(1);
});
