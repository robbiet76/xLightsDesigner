#!/usr/bin/env node
import { execFileSync } from 'node:child_process';

const BASE = 'http://127.0.0.1:49915/xlightsdesigner/api';
const MEDIA_FILE = `/Users/robterry/Desktop/Show/Audio/01 CAN'T STOP THE FEELING Film final.mp3`;

async function request(path, { method = 'GET', body = null } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: body == null ? undefined : { 'Content-Type': 'application/json' },
    body: body == null ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid JSON from ${method} ${path}: ${text}`);
  }
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
    const state = String(json?.data?.state || json?.state || '').toLowerCase();
    if (state === 'succeeded' || state === 'completed') return json;
    if (state === 'failed') throw new Error(JSON.stringify(json));
    if (Date.now() - started > timeoutMs) {
      throw new Error(`Timed out waiting for job ${jobId}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

function buildBatchPayload() {
  return {
    track: 'XD: Song Structure',
    replaceExistingMarks: false,
    marks: [
      { label: 'Intro', startMs: 0, endMs: 7780 },
      { label: 'Verse 1', startMs: 7780, endMs: 24150 },
      { label: 'Verse 2', startMs: 24150, endMs: 41150 },
      { label: 'Verse 3', startMs: 41150, endMs: 59690 },
      { label: 'Pre-Chorus', startMs: 59690, endMs: 78230 },
      { label: 'Chorus 1', startMs: 78230, endMs: 97120 },
      { label: 'Verse 4', startMs: 97120, endMs: 114260 },
      { label: 'Chorus 2', startMs: 114260, endMs: 130820 },
      { label: 'Verse 5', startMs: 130820, endMs: 148130 },
      { label: 'Chorus 3', startMs: 148130, endMs: 156500 },
      { label: 'Chorus 4', startMs: 156500, endMs: 163180 },
      { label: 'Chorus 5', startMs: 163180, endMs: 181860 },
      { label: 'Verse 6', startMs: 181860, endMs: 201410 },
      { label: 'Bridge', startMs: 201410, endMs: 219250 },
      { label: 'Outro', startMs: 219250, endMs: 237829 }
    ],
    effects: [
      {
        element: 'Snowman',
        layer: 0,
        effectName: 'Color Wash',
        startMs: 78230,
        endMs: 97120,
        settings: {},
        palette: {},
        clearExisting: false
      }
    ]
  };
}

async function main() {
  await assertNoBlockingModal();
  const ts = execFileSync('date', ['+%Y%m%d-%H%M%S'], { encoding: 'utf8' }).trim();
  const file = `/Users/robterry/Desktop/Show/Test/API-Direct-Batch-${ts}.xsq`;

  const create = await request('/sequence/create', {
    method: 'POST',
    body: {
      file,
      mediaFile: MEDIA_FILE,
      overwrite: true
    }
  });

  const createJobId = create.json?.data?.jobId;
  if (!createJobId) {
    throw new Error(`sequence.create did not return jobId: ${JSON.stringify(create.json)}`);
  }
  await waitForJob(createJobId);

  const apply = await request('/sequencing/apply-batch-plan', {
    method: 'POST',
    body: buildBatchPayload()
  });

  console.log(JSON.stringify({ file, create: create.json, apply: apply.json }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || String(error));
  process.exit(1);
});
