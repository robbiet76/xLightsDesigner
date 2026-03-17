#!/usr/bin/env node
import { execFileSync } from 'node:child_process';

const timeoutMs = Number(process.argv[2] || 90000);
const started = Date.now();
const healthUrl = 'http://127.0.0.1:49915/xlightsdesigner/api/health';
const logPath = '/tmp/xld-owned-xlights.log';
let lastProgress = '';

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

function readTail(filePath, maxLines = 80) {
  try {
    const raw = execFileSync('tail', ['-n', String(maxLines), filePath], { encoding: 'utf8' });
    return raw.trimEnd();
  } catch {
    return '';
  }
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
    const state = String(json?.data?.state || '');
    const settleRemainingMs = Number(json?.data?.settleRemainingMs || 0);
    const progress = `${state}:${settleRemainingMs}`;
    if (progress !== lastProgress) {
      lastProgress = progress;
      console.error(JSON.stringify({
        ok: false,
        healthUrl,
        state,
        settleRemainingMs,
        listenerRunning: json?.data?.listenerRunning,
        workerRunning: json?.data?.workerRunning,
        xlightsPid: processes[0].pid
      }));
    }
    if (json?.ok === true && json?.data?.state === 'ready') {
      console.log(JSON.stringify({ ok: true, healthUrl, state: json.data.state, listenerRunning: json.data.listenerRunning, workerRunning: json.data.workerRunning, xlightsPid: processes[0].pid }, null, 2));
      process.exit(0);
    }
  } catch {}
  if (Date.now() - started > timeoutMs) {
    const processes = listXLightsProcesses();
    console.error(JSON.stringify({
      ok: false,
      healthUrl,
      logPath,
      processes,
      error: 'Timed out waiting for owned xLights health=ready',
      logTail: readTail(logPath)
    }, null, 2));
    process.exit(1);
  }
  await sleep(500);
}
