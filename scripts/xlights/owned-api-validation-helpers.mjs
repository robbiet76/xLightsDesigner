import { stat } from 'node:fs/promises';
import path from 'node:path';

export function str(value = '') {
  return String(value || '').trim();
}

export async function pathExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function request(endpoint, route, { method = 'GET', body = null, timeoutMs = 60000, allowError = false } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let response;
    try {
      response = await fetch(`${endpoint}${route}`, {
        method,
        headers: body == null ? undefined : { 'Content-Type': 'application/json' },
        body: body == null ? undefined : JSON.stringify(body),
        signal: controller.signal
      });
    } catch (error) {
      throw new Error(`Unable to reach owned xLights API at ${endpoint}${route}: ${error?.message || error}`);
    }
    const text = await response.text();
    const json = text ? JSON.parse(text) : {};
    if (!allowError && (!response.ok || json?.ok === false)) {
      const code = json?.error?.code || response.status;
      const message = json?.error?.message || json?.message || response.statusText || 'Request failed';
      throw new Error(`${method} ${route} failed (${code}): ${message}`);
    }
    return { status: response.status, json };
  } finally {
    clearTimeout(timer);
  }
}

export function modalBlockedMessage(health = {}) {
  const data = health?.data && typeof health.data === 'object' ? health.data : {};
  const modalState = data?.modalState && typeof data.modalState === 'object' ? data.modalState : null;
  if (!modalState?.blocked || modalState.observed === false) return '';
  const titles = Array.isArray(modalState.windows)
    ? modalState.windows
      .filter((window) => window?.isModal)
      .map((window) => str(window?.title || window?.className))
      .filter(Boolean)
    : [];
  return `xLights is blocked by a modal${titles.length ? `: ${titles.join(', ')}` : ''}`;
}

export async function assertNoBlockingModal(endpoint) {
  const { json: health } = await request(endpoint, '/health', { timeoutMs: 10000 });
  const message = modalBlockedMessage(health);
  if (message) throw new Error(message);
  return health;
}

export async function waitForReady(endpoint, timeoutMs) {
  const started = Date.now();
  let lastHealth = null;
  for (;;) {
    const { json: health } = await request(endpoint, '/health', { timeoutMs: 10000 });
    lastHealth = health;
    const data = health?.data || {};
    const modalMessage = modalBlockedMessage(health);
    if (modalMessage) throw new Error(modalMessage);
    if (health?.ok === true && String(data.state || data.startupState || '').toLowerCase() === 'ready') return health;
    if (Date.now() - started > timeoutMs) {
      throw new Error(`Owned xLights API did not become ready within ${timeoutMs}ms: ${JSON.stringify(lastHealth)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

export function jobState(payload) {
  const state = str(payload?.data?.state || payload?.state).toLowerCase();
  return state === 'succeeded' ? 'completed' : state;
}

export function jobResult(payload) {
  return payload?.data?.result || payload?.result || payload;
}

export async function waitForJob(endpoint, jobId, { timeoutMs = 180000, allowFailure = false } = {}) {
  const started = Date.now();
  let last = null;
  for (;;) {
    await assertNoBlockingModal(endpoint);
    const { json } = await request(endpoint, `/jobs/get?jobId=${encodeURIComponent(jobId)}`, { allowError: allowFailure });
    last = json;
    const state = jobState(json);
    const result = jobResult(json);
    if (state === 'completed') {
      if (!allowFailure && result?.ok === false) throw new Error(`Job ${jobId} completed with failed result: ${JSON.stringify(result)}`);
      return { state, payload: json, result };
    }
    if (state === 'failed') {
      if (allowFailure) return { state, payload: json, result };
      throw new Error(`Job ${jobId} failed: ${JSON.stringify(json)}`);
    }
    if (Date.now() - started > timeoutMs) throw new Error(`Timed out waiting for job ${jobId}. Last response: ${JSON.stringify(last)}`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

export async function postQueued(endpoint, route, body, options = {}) {
  const { json: accepted } = await request(endpoint, route, { method: 'POST', body });
  const jobId = str(accepted?.data?.jobId);
  if (!jobId) throw new Error(`${route} returned no jobId: ${JSON.stringify(accepted)}`);
  const settled = await waitForJob(endpoint, jobId, options);
  return { accepted, settled };
}

export async function assertOpenShowFolder(endpoint, expectedShowDir) {
  const { json } = await request(endpoint, '/media/current');
  const reportedShowDir = str(json?.data?.showDirectory);
  if (!reportedShowDir) throw new Error('/media/current did not report an open show folder.');
  const actual = path.resolve(reportedShowDir).replace(/\/+$/, '');
  const expected = path.resolve(expectedShowDir).replace(/\/+$/, '');
  if (actual !== expected) throw new Error(`xLights is open to ${actual}; expected ${expected}.`);
  return json;
}
