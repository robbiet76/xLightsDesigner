#!/usr/bin/env node
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';

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
  let waitForApi = true;
  let apiTimeoutMs = 45000;
  let modalPolicy = 'safe';
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--show-dir') {
      index += 1;
      if (index >= argv.length) {
        throw new Error('Missing value for --show-dir');
      }
      showDir = path.resolve(argv[index]);
    } else if (arg === '--no-wait-api') {
      waitForApi = false;
    } else if (arg === '--api-timeout-ms') {
      index += 1;
      apiTimeoutMs = Number(argv[index]);
      if (!Number.isFinite(apiTimeoutMs) || apiTimeoutMs < 1000) {
        throw new Error('--api-timeout-ms must be at least 1000');
      }
    } else if (arg === '--modal-policy') {
      index += 1;
      modalPolicy = String(argv[index] || '').trim();
      if (!['fail', 'safe', 'ok', 'cancel', 'discard', 'save'].includes(modalPolicy)) {
        throw new Error('--modal-policy must be one of: fail, safe, ok, cancel, discard, save');
      }
    } else {
      passthroughArgs.push(arg);
    }
  }
  if (showDir) {
    passthroughArgs.push('-s', showDir);
  }
  return { passthroughArgs, showDir, waitForApi, apiTimeoutMs, modalPolicy };
}

const { passthroughArgs: args, showDir, waitForApi, apiTimeoutMs, modalPolicy } = parseArgs(process.argv.slice(2));
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
  XLIGHTS_DESIGNER_MODAL_POLICY: modalPolicy,
  XLIGHTS_DESIGNER_PORT: process.env.XLIGHTS_DESIGNER_PORT || '49915',
  XLIGHTS_DESIGNER_STARTUP_SETTLE_MS: process.env.XLIGHTS_DESIGNER_STARTUP_SETTLE_MS || '30000'
};
if (trustedRoots.length) {
  env.XLIGHTS_DESIGNER_TRUSTED_ROOTS = Array.from(new Set(trustedRoots)).join(path.delimiter);
}
const logPath = '/tmp/xld-owned-xlights.log';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requestJson(url, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, statusCode: res.statusCode, json: JSON.parse(body) });
        } catch {
          resolve({ ok: false, statusCode: res.statusCode, body });
        }
      });
    });
    req.on('timeout', () => {
      req.destroy(new Error('timeout'));
    });
    req.on('error', (error) => {
      resolve({ ok: false, statusCode: 0, error: String(error?.message || error) });
    });
  });
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

function listListeningPortsForPid(pid) {
  try {
    const output = execFileSync('lsof', ['-nP', '-a', '-p', String(pid), '-iTCP', '-sTCP:LISTEN'], { encoding: 'utf8' });
    return output
      .split('\n')
      .slice(1)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function sampleProcess(pid) {
  const samplePath = `/tmp/xld-owned-xlights-${pid}.sample.txt`;
  try {
    execFileSync('sample', [String(pid), '1', '-file', samplePath], { stdio: 'ignore' });
    return fs.existsSync(samplePath) ? fs.readFileSync(samplePath, 'utf8') : '';
  } catch {
    return fs.existsSync(samplePath) ? fs.readFileSync(samplePath, 'utf8') : '';
  }
}

function runJxa(source) {
  try {
    const output = execFileSync('osascript', ['-l', 'JavaScript', '-e', source], { encoding: 'utf8' });
    return JSON.parse(output || '{}');
  } catch (error) {
    return {
      ok: false,
      error: String(error?.stderr || error?.message || error).trim()
    };
  }
}

function inspectAccessibleModals() {
  return runJxa(`
    const systemEvents = Application('System Events');
    systemEvents.includeStandardAdditions = true;
    function readUiText(collection) {
      try {
        return collection().map((item) => {
          try { return String(item.value() || item.name() || ''); } catch (_) { return ''; }
        }).filter(Boolean);
      } catch (_) {
        return [];
      }
    }
    try {
      const process = systemEvents.processes.byName('xLights');
      const windows = process.windows().map((window) => {
        const buttons = (() => {
          try {
            return window.buttons().map((button) => {
              try { return String(button.name() || ''); } catch (_) { return ''; }
            }).filter(Boolean);
          } catch (_) {
            return [];
          }
        })();
        return {
          title: (() => { try { return String(window.name() || ''); } catch (_) { return ''; } })(),
          role: (() => { try { return String(window.role() || ''); } catch (_) { return ''; } })(),
          subrole: (() => { try { return String(window.subrole() || ''); } catch (_) { return ''; } })(),
          buttons,
          text: readUiText(window.staticTexts)
        };
      });
      JSON.stringify({ ok: true, windows });
    } catch (error) {
      JSON.stringify({ ok: false, error: String(error) });
    }
  `);
}

function preferredButtonNamesForPolicy(policy) {
  if (policy === 'fail') {
    return [];
  }
  if (policy === 'cancel') {
    return ['Cancel', 'No', 'Close'];
  }
  if (policy === 'discard') {
    return ['Discard Changes', "Don't Save", 'Don’t Save', 'No', 'Cancel'];
  }
  if (policy === 'save') {
    return ['Save', 'Yes'];
  }
  return ['OK', 'Ok', 'Continue', 'Close'];
}

function clickAccessibleModalButton(buttonName) {
  return runJxa(`
    (function() {
    const systemEvents = Application('System Events');
    function buttonMatches(button) {
      try { return String(button.name() || '') === ${JSON.stringify(buttonName)}; } catch (_) { return false; }
    }
    try {
      const process = systemEvents.processes.byName('xLights');
      const windows = process.windows();
      for (let windowIndex = 0; windowIndex < windows.length; windowIndex += 1) {
        const buttons = windows[windowIndex].buttons();
        for (let buttonIndex = 0; buttonIndex < buttons.length; buttonIndex += 1) {
          if (buttonMatches(buttons[buttonIndex])) {
            buttons[buttonIndex].click();
            return JSON.stringify({ ok: true, clicked: ${JSON.stringify(buttonName)} });
          }
        }
      }
      return JSON.stringify({ ok: false, clicked: null });
    } catch (error) {
      return JSON.stringify({ ok: false, error: String(error) });
    }
    })();
  `);
}

function handleAccessibleModals(policy) {
  const inventory = inspectAccessibleModals();
  const windows = Array.isArray(inventory.windows) ? inventory.windows : [];
  const modalWindows = windows.filter((window) => (
    /dialog|sheet/i.test(`${window.role} ${window.subrole}`) ||
    window.buttons?.some((button) => ['OK', 'Ok', 'Cancel', 'Save', 'Discard Changes', "Don't Save", 'Don’t Save', 'Yes', 'No'].includes(button))
  ));
  if (!modalWindows.length) {
    return { inventory, handled: false };
  }

  const preferredButtons = preferredButtonNamesForPolicy(policy);
  for (const preferredButton of preferredButtons) {
    if (!modalWindows.some((window) => window.buttons?.includes(preferredButton))) {
      continue;
    }
    const clicked = clickAccessibleModalButton(preferredButton);
    if (clicked.ok) {
      return { inventory, handled: true, clicked: preferredButton };
    }
  }

  return { inventory, handled: false, blocked: modalWindows };
}

function modalBlockedMessageFromHealth(health = {}) {
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

function classifyStartupBlocker(processInfo) {
  const sample = sampleProcess(processInfo.pid);
  const listeningPorts = listListeningPortsForPid(processInfo.pid);
  const accessibility = handleAccessibleModals('fail');
  const showModal = /ShowModal|wxMessageBox|SaveChangesDialog/.test(sample);
  const preFrameInfoDialog = /xLightsApp::OnInit\(\).*xLightsApp\.cpp:732|wxMessageBox\(.*Information/.test(sample);
  const saveChangesDialog = /SaveChangesDialog|sequence you are closing has unsaved changes|Discard Changes/.test(sample);
  const legacyAutomationOnly = listeningPorts.some((line) => /:49914\b/.test(line)) && !listeningPorts.some((line) => /:49915\b/.test(line));
  return {
    showModal,
    preFrameInfoDialog,
    saveChangesDialog,
    legacyAutomationOnly,
    listeningPorts,
    accessibility,
    samplePath: `/tmp/xld-owned-xlights-${processInfo.pid}.sample.txt`
  };
}

async function waitForOwnedApi(processInfo, timeoutMs = 45000) {
  const started = Date.now();
  const endpoint = `http://127.0.0.1:${env.XLIGHTS_DESIGNER_PORT}/xlightsdesigner/api/health`;
  let lastProbe = null;
  while (Date.now() - started < timeoutMs) {
    if (!isProcessAlive(processInfo.pid)) {
      const error = new Error('xLights exited before the owned Designer API became ready.');
      error.details = { endpoint, lastProbe, blocker: classifyStartupBlocker(processInfo) };
      throw error;
    }
    lastProbe = await requestJson(endpoint, 2000);
    const data = lastProbe.json?.data || {};
    const state = String(data.state || data.startupState || '').toLowerCase();
    const modalMessage = modalBlockedMessageFromHealth(lastProbe.json);
    if (modalMessage) {
      const error = new Error(modalMessage);
      error.details = { endpoint, lastProbe, blocker: classifyStartupBlocker(processInfo) };
      throw error;
    }
    const ready = lastProbe.ok && lastProbe.json?.ok !== false && (data.startupSettled === true || state === 'ready');
    if (ready) {
      return { endpoint, health: lastProbe.json };
    }
    const modalResult = handleAccessibleModals(modalPolicy);
    if (modalResult.handled) {
      console.error(JSON.stringify({
        modalHandled: true,
        policy: modalPolicy,
        clicked: modalResult.clicked,
        inventory: modalResult.inventory
      }, null, 2));
    }
    await sleep(750);
  }
  const blocker = classifyStartupBlocker(processInfo);
  const reason = blocker.preFrameInfoDialog
    ? 'xLights is blocked by a pre-frame command-line information modal. Rebuild xLights with the Designer noninteractive modal suppression patch or launch without arguments that produce startup info.'
    : blocker.saveChangesDialog
      ? 'xLights is blocked by a save-changes modal before the owned Designer API is available.'
      : blocker.showModal
        ? 'xLights is blocked in a modal dialog before the owned Designer API is available.'
        : blocker.legacyAutomationOnly
          ? 'xLights only exposed the legacy automation listener, not the owned Designer API.'
          : 'xLights owned Designer API did not become responsive.';
  const error = new Error(reason);
  error.details = { endpoint, lastProbe, blocker };
  throw error;
}

fs.writeFileSync(logPath, '', 'utf8');
console.log(JSON.stringify({
  target,
  binary,
  args,
  logPath,
  modalPolicy,
  env: {
    XLIGHTS_DESIGNER_ENABLED: env.XLIGHTS_DESIGNER_ENABLED,
    XLIGHTS_DESIGNER_MODAL_POLICY: env.XLIGHTS_DESIGNER_MODAL_POLICY,
    XLIGHTS_DESIGNER_PORT: env.XLIGHTS_DESIGNER_PORT,
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
const result = { launched: true, pid: processInfo.pid, command: processInfo.command };
if (waitForApi) {
  try {
    result.ownedApi = await waitForOwnedApi(processInfo, apiTimeoutMs);
  } catch (error) {
    console.error(JSON.stringify({
      launched: true,
      pid: processInfo.pid,
      command: processInfo.command,
      ownedApiReady: false,
      error: String(error?.message || error),
      details: error?.details || {}
    }, null, 2));
    process.exit(1);
  }
}
console.log(JSON.stringify(result, null, 2));
