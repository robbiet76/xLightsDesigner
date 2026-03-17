#!/usr/bin/env node
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const derivedRoot = path.join(os.homedir(), 'Library/Developer/Xcode/DerivedData');
const candidates = fs.readdirSync(derivedRoot, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name.startsWith('xLights-'))
  .map((d) => path.join(derivedRoot, d.name, 'Build/Products/Debug/xLights.app'))
  .filter((p) => fs.existsSync(path.join(p, 'Contents/MacOS/xLights')))
  .map((p) => ({
    app: p,
    mtimeMs: fs.statSync(p).mtimeMs
  }))
  .sort((a, b) => b.mtimeMs - a.mtimeMs);

if (!candidates.length) {
  console.error('No xLights DerivedData debug build found.');
  process.exit(1);
}

const target = candidates[0].app;
const binary = path.join(target, 'Contents/MacOS/xLights');
const args = process.argv.slice(2);
const env = { ...process.env, XLIGHTS_DESIGNER_ENABLED: '1' };

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

async function waitForNoXLightsProcesses(timeoutMs = 15000) {
  const started = Date.now();
  for (;;) {
    const processes = listXLightsProcesses();
    if (!processes.length) {
      return;
    }
    if (Date.now() - started > timeoutMs) {
      throw new Error(`Timed out waiting for xLights processes to exit: ${JSON.stringify(processes)}`);
    }
    await sleep(250);
  }
}

async function waitForSingleOwnedProcess(timeoutMs = 15000) {
  const started = Date.now();
  for (;;) {
    const processes = listXLightsProcesses();
    const owned = processes.filter((entry) => entry.command === binary);
    if (owned.length === 1 && processes.length === 1) {
      return owned[0];
    }
    if (Date.now() - started > timeoutMs) {
      throw new Error(`Timed out waiting for a single owned xLights process: ${JSON.stringify(processes)}`);
    }
    await sleep(250);
  }
}

console.log(JSON.stringify({ target, binary, args, env: { XLIGHTS_DESIGNER_ENABLED: env.XLIGHTS_DESIGNER_ENABLED } }, null, 2));

try {
  execFileSync('pkill', ['-f', 'xLights.app/Contents/MacOS/xLights'], { stdio: 'ignore' });
} catch {}

await waitForNoXLightsProcesses();

const child = spawn(binary, args, {
  detached: true,
  stdio: 'ignore',
  env
});
child.unref();

const processInfo = await waitForSingleOwnedProcess();
console.log(JSON.stringify({ launched: true, pid: processInfo.pid, command: processInfo.command }, null, 2));
