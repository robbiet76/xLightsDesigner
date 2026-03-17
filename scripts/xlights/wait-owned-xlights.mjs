#!/usr/bin/env node
const timeoutMs = Number(process.argv[2] || 90000);
const started = Date.now();
const healthUrl = 'http://127.0.0.1:49915/xlightsdesigner/api/health';

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

for (;;) {
  try {
    const res = await fetch(healthUrl);
    const text = await res.text();
    const json = JSON.parse(text);
    if (json?.ok === true && json?.data?.state === 'ready') {
      console.log(JSON.stringify({ ok: true, healthUrl, state: json.data.state, listenerRunning: json.data.listenerRunning, workerRunning: json.data.workerRunning }, null, 2));
      process.exit(0);
    }
  } catch {}
  if (Date.now() - started > timeoutMs) {
    console.error(JSON.stringify({ ok: false, healthUrl, error: 'Timed out waiting for owned xLights health=ready' }, null, 2));
    process.exit(1);
  }
  await sleep(500);
}
