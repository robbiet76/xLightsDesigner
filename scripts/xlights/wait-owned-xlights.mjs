#!/usr/bin/env node
import { execFileSync } from 'node:child_process';

const timeoutMs = Number(process.argv[2] || 90000);
const started = Date.now();
const healthUrl = 'http://127.0.0.1:49915/xlightsdesigner/api/health';

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function listXLightsProcesses() {
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
    .filter((entry) => entry.command.includes('xLights.app/Contents/MacOS/xLights'));
}

for (;;) {
  try {
    const processes = listXLightsProcesses();
    if (processes.length !== 1) {
      throw new Error(`Expected one xLights process, found ${processes.length}`);
    }
    const res = await fetch(healthUrl);
    const text = await res.text();
    const json = JSON.parse(text);
    if (json?.ok === true && json?.data?.state === 'ready') {
      console.log(JSON.stringify({ ok: true, healthUrl, state: json.data.state, listenerRunning: json.data.listenerRunning, workerRunning: json.data.workerRunning, xlightsPid: processes[0].pid }, null, 2));
      process.exit(0);
    }
  } catch {}
  if (Date.now() - started > timeoutMs) {
    console.error(JSON.stringify({ ok: false, healthUrl, error: 'Timed out waiting for owned xLights health=ready' }, null, 2));
    process.exit(1);
  }
  await sleep(500);
}
