import { execFileSync } from 'node:child_process';

export function listProcesses() {
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
    .filter((entry) => Number.isFinite(entry.pid));
}

export function processesMatching(predicate) {
  return listProcesses().filter(predicate);
}

export function pidsMatching(predicate) {
  return processesMatching(predicate).map((entry) => entry.pid);
}

export function commandMatchesExactBinary(binaryPath) {
  return (entry) => entry.command === binaryPath || entry.command.startsWith(`${binaryPath} `);
}

export function commandContains(fragment) {
  return (entry) => entry.command.includes(fragment);
}

export function isPidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function killPid(pid, signal = 'TERM') {
  try {
    execFileSync('kill', [`-${signal}`, String(pid)], { stdio: 'ignore' });
  } catch {}
}

export async function stopPids(pids, { timeoutMs = 5000, intervalMs = 250 } = {}) {
  const stopped = [...pids];
  for (const pid of pids) killPid(pid, 'TERM');
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (pids.every((pid) => !isPidAlive(pid))) return stopped;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  for (const pid of pids) killPid(pid, 'KILL');
  return stopped;
}
