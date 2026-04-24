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
function parseArgs(argv) {
  const passthroughArgs = [];
  let showDir = '';
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--show-dir') {
      index += 1;
      if (index >= argv.length) {
        throw new Error('Missing value for --show-dir');
      }
      showDir = path.resolve(argv[index]);
    } else {
      passthroughArgs.push(arg);
    }
  }
  if (showDir) {
    passthroughArgs.push('-s', showDir);
  }
  return { passthroughArgs, showDir };
}

const { passthroughArgs: args, showDir } = parseArgs(process.argv.slice(2));
const trustedRoots = [
  ...String(process.env.XLIGHTS_DESIGNER_TRUSTED_ROOTS || '')
    .split(path.delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean),
  showDir
].filter(Boolean);
const env = {
  ...process.env,
  XLIGHTS_DESIGNER_ENABLED: '1',
  XLIGHTS_DESIGNER_STARTUP_SETTLE_MS: process.env.XLIGHTS_DESIGNER_STARTUP_SETTLE_MS || '30000'
};
if (trustedRoots.length) {
  env.XLIGHTS_DESIGNER_TRUSTED_ROOTS = Array.from(new Set(trustedRoots)).join(path.delimiter);
}
const logPath = '/tmp/xld-owned-xlights.log';

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
    .filter((entry) => entry.command === binary || entry.command.startsWith(`${binary} `));
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
    if (processes.length === 1) {
      return processes[0];
    }
    if (Date.now() - started > timeoutMs) {
      throw new Error(`Timed out waiting for a single owned xLights process: ${JSON.stringify(processes)}`);
    }
    await sleep(250);
  }
}

fs.writeFileSync(logPath, '', 'utf8');
console.log(JSON.stringify({
  target,
  binary,
  args,
  logPath,
  env: {
    XLIGHTS_DESIGNER_ENABLED: env.XLIGHTS_DESIGNER_ENABLED,
    XLIGHTS_DESIGNER_STARTUP_SETTLE_MS: env.XLIGHTS_DESIGNER_STARTUP_SETTLE_MS,
    XLIGHTS_DESIGNER_TRUSTED_ROOTS: env.XLIGHTS_DESIGNER_TRUSTED_ROOTS
  }
}, null, 2));

try {
  execFileSync('pkill', ['-f', 'xLights.app/Contents/MacOS/xLights'], { stdio: 'ignore' });
} catch {}

await waitForNoXLightsProcesses();

const stdoutFd = fs.openSync(logPath, 'a');
const stderrFd = fs.openSync(logPath, 'a');

const child = spawn(binary, args, {
  detached: true,
  stdio: ['ignore', stdoutFd, stderrFd],
  env
});
child.unref();

const processInfo = await waitForSingleOwnedProcess();
console.log(JSON.stringify({ launched: true, pid: processInfo.pid, command: processInfo.command }, null, 2));
