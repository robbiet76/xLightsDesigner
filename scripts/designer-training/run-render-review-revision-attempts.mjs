#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_ENDPOINT = 'http://127.0.0.1:49915/xlightsdesigner/api';

function str(value = '') {
  return String(value || '').trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function resolvePath(filePath = '') {
  const value = str(filePath);
  if (!value) return '';
  return path.isAbsolute(value) ? value : path.resolve(REPO_ROOT, value);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function normalizeJobState(state = '') {
  const text = str(state).toLowerCase();
  if (text === 'completed' || text === 'succeeded') return 'completed';
  if (text === 'failed') return 'failed';
  if (text === 'queued' || text === 'running') return text;
  return '';
}

function modalBlockedMessage(healthJson = {}) {
  const data = healthJson?.data && typeof healthJson.data === 'object' ? healthJson.data : {};
  const modalState = data?.modalState && typeof data.modalState === 'object' ? data.modalState : null;
  if (!modalState || modalState.observed === false || modalState.blocked !== true) return '';
  const titles = arr(modalState.windows)
    .filter((window) => window?.isModal)
    .map((window) => str(window?.title || window?.className))
    .filter(Boolean);
  return `xLights is blocked by a modal${titles.length ? `: ${titles.join(', ')}` : ''}`;
}

function isReadyHealth(healthJson = {}) {
  const data = healthJson?.data && typeof healthJson.data === 'object' ? healthJson.data : {};
  const state = str(data.state || data.startupState || data.status).toLowerCase();
  return healthJson?.ok === true
    && data.listenerReachable !== false
    && data.appReady !== false
    && (data.startupSettled === true || state === 'ready')
    && !modalBlockedMessage(healthJson);
}

async function requestJson(endpoint, route, { method = 'GET', body = null, request = fetch } = {}) {
  const response = await request(`${endpoint}${route}`, {
    method,
    headers: body == null ? undefined : { 'Content-Type': 'application/json' },
    body: body == null ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON from ${method} ${route}: ${text}`);
  }
  if (!response.ok || json?.ok === false) {
    throw new Error(`${method} ${route} failed (${response.status}): ${JSON.stringify(json)}`);
  }
  return json;
}

async function assertOwnedReady(endpoint, deps = {}) {
  const health = await requestJson(endpoint, '/health', deps);
  const modalMessage = modalBlockedMessage(health);
  if (modalMessage) throw new Error(modalMessage);
  if (!isReadyHealth(health)) throw new Error(`Owned xLights API is not ready: ${JSON.stringify(health)}`);
  return health;
}

async function waitForJob(endpoint, jobId, deps = {}) {
  const timeoutMs = Number(deps.timeoutMs || 180000);
  const pollMs = Number(deps.pollMs || 1000);
  const started = Date.now();
  for (;;) {
    await assertOwnedReady(endpoint, deps);
    const job = await requestJson(endpoint, `/jobs/get?jobId=${encodeURIComponent(jobId)}`, deps);
    const state = normalizeJobState(job?.data?.state || job?.state);
    if (state === 'completed') {
      const result = job?.data?.result && typeof job.data.result === 'object' ? job.data.result : job;
      if (result?.ok === false) throw new Error(`Job ${jobId} completed with failure: ${JSON.stringify(result)}`);
      return result;
    }
    if (state === 'failed') throw new Error(`Job ${jobId} failed: ${JSON.stringify(job)}`);
    if (Date.now() - started > timeoutMs) throw new Error(`Timed out waiting for job ${jobId}`);
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

async function settleQueued(endpoint, route, json, deps = {}) {
  const jobId = str(json?.data?.jobId || json?.jobId);
  const accepted = json?.data?.accepted === true || json?.accepted === true;
  if (!jobId && !accepted) return json;
  if (!jobId) throw new Error(`${route} returned accepted response without jobId: ${JSON.stringify(json)}`);
  return waitForJob(endpoint, jobId, deps);
}

async function postAndSettle(endpoint, route, body = {}, deps = {}) {
  const accepted = await requestJson(endpoint, route, { ...deps, method: 'POST', body });
  return settleQueued(endpoint, route, accepted, deps);
}

async function resolveRenderedFseqPath(endpoint, sequencePath, renderResult = {}, deps = {}) {
  const direct = str(renderResult?.data?.fseqPath || renderResult?.fseqPath);
  if (direct && fs.existsSync(direct)) return direct;
  const media = await requestJson(endpoint, '/media/current', deps);
  const showDirectory = str(media?.data?.showDirectory);
  const openSequencePath = str(media?.data?.sequencePath || sequencePath);
  const basename = path.basename(openSequencePath, '.xsq');
  const candidates = [
    path.join(path.dirname(openSequencePath), `${basename}.fseq`),
    showDirectory ? path.join(showDirectory, `${basename}.fseq`) : '',
    direct
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) || direct || '';
}

function resolveSequencePath(attempt = {}, sequencePath = '') {
  const explicit = resolvePath(sequencePath);
  if (explicit) return explicit;
  const sourcePath = resolvePath(attempt.source?.sequencePath);
  if (!sourcePath) return '';
  if (path.extname(sourcePath).toLowerCase() === '.xsq') return sourcePath;
  const sibling = path.join(path.dirname(sourcePath), `${path.basename(sourcePath, path.extname(sourcePath))}.xsq`);
  return fs.existsSync(sibling) ? sibling : sourcePath;
}

export async function runRenderReviewRevisionAttempt({
  attempt = {},
  endpoint = DEFAULT_ENDPOINT,
  sequencePath = '',
  deps = {}
} = {}) {
  const startedAt = new Date().toISOString();
  if (attempt?.artifactType !== 'render_review_revision_attempt_v1') {
    throw new Error('attempt must be render_review_revision_attempt_v1');
  }
  if (attempt.status !== 'planned') {
    return {
      artifactType: 'render_review_revision_attempt_execution_v1',
      artifactVersion: '1.0',
      ok: true,
      skipped: true,
      skipReason: `attempt status is ${str(attempt.status) || 'missing'}`,
      attemptId: str(attempt.attemptId),
      startedAt,
      completedAt: new Date().toISOString()
    };
  }
  const sequence = resolveSequencePath(attempt, sequencePath);
  if (!sequence) throw new Error(`No sequence path available for attempt ${str(attempt.attemptId) || '(unknown)'}`);
  if (!fs.existsSync(sequence)) throw new Error(`Sequence not found: ${sequence}`);
  const payload = attempt.ownedBatchPayload || {};
  if (!arr(payload.effects).length) throw new Error(`Attempt has no ownedBatchPayload effects: ${str(attempt.attemptId)}`);

  const steps = [];
  await assertOwnedReady(endpoint, deps);
  try {
    steps.push({ step: 'close_before_open', ok: true, result: await postAndSettle(endpoint, '/sequence/close', { force: true, quiet: true }, deps) });
  } catch (error) {
    steps.push({ step: 'close_before_open', ok: false, ignored: true, error: str(error?.message || error) });
  }
  steps.push({ step: 'open_sequence', ok: true, result: await postAndSettle(endpoint, '/sequence/open', { file: sequence, force: true, promptIssues: false }, deps) });
  steps.push({ step: 'apply_batch_plan', ok: true, result: await postAndSettle(endpoint, '/sequencing/apply-batch-plan', payload, deps) });
  try {
    steps.push({ step: 'save_sequence', ok: true, result: await postAndSettle(endpoint, '/sequence/save', { file: sequence }, deps) });
  } catch (error) {
    steps.push({ step: 'save_sequence', ok: false, warning: str(error?.message || error) });
  }
  const renderResult = await postAndSettle(endpoint, '/sequence/render-current', {}, deps);
  steps.push({ step: 'render_current', ok: true, result: renderResult });
  const fseqPath = await resolveRenderedFseqPath(endpoint, sequence, renderResult, deps);
  if (!fseqPath) throw new Error(`render-current completed but no FSEQ path could be resolved for ${sequence}`);
  try {
    steps.push({ step: 'close_after_render', ok: true, result: await postAndSettle(endpoint, '/sequence/close', { force: true, quiet: true }, deps) });
  } catch (error) {
    steps.push({ step: 'close_after_render', ok: false, ignored: true, error: str(error?.message || error) });
  }
  return {
    artifactType: 'render_review_revision_attempt_execution_v1',
    artifactVersion: '1.0',
    ok: true,
    skipped: false,
    attemptId: str(attempt.attemptId),
    revisionObjectiveId: str(attempt.source?.revisionObjectiveId),
    originalRenderReviewRef: str(attempt.source?.renderReviewRef),
    sourceEvidence: attempt.source?.evidence || {},
    endpoint,
    sequencePath: sequence,
    fseqPath,
    effectName: str(attempt.effectPlan?.effectName),
    targets: arr(attempt.targets).map((target) => str(target.element || target.targetId)).filter(Boolean),
    startedAt,
    completedAt: new Date().toISOString(),
    steps
  };
}

export async function runRenderReviewRevisionAttempts({
  attemptsPath = '',
  attempts = null,
  outPath = '',
  endpoint = DEFAULT_ENDPOINT,
  sequencePath = '',
  maxAttempts = 0,
  deps = {}
} = {}) {
  const resolvedAttemptsPath = resolvePath(attemptsPath);
  const plan = attempts || (resolvedAttemptsPath ? readJson(resolvedAttemptsPath) : {});
  const rows = arr(plan.attempts);
  const limit = Number(maxAttempts || 0);
  const selected = limit > 0 ? rows.slice(0, limit) : rows;
  const results = [];
  for (const attempt of selected) {
    try {
      results.push(await runRenderReviewRevisionAttempt({ attempt, endpoint, sequencePath, deps }));
    } catch (error) {
      results.push({
        artifactType: 'render_review_revision_attempt_execution_v1',
        artifactVersion: '1.0',
        ok: false,
        attemptId: str(attempt?.attemptId),
        revisionObjectiveId: str(attempt?.source?.revisionObjectiveId),
        error: str(error?.message || error)
      });
    }
  }
  const artifact = {
    artifactType: 'render_review_revision_attempt_execution_index_v1',
    artifactVersion: '1.0',
    createdAt: new Date().toISOString(),
    source: {
      revisionAttemptPlanRef: resolvedAttemptsPath,
      attemptCount: rows.length,
      executedCount: selected.length
    },
    summary: {
      executionCount: results.length,
      succeededCount: results.filter((result) => result.ok === true && result.skipped !== true).length,
      skippedCount: results.filter((result) => result.skipped === true).length,
      failedCount: results.filter((result) => result.ok !== true).length,
      fseqCount: results.filter((result) => str(result.fseqPath)).length
    },
    results
  };
  const resolvedOutPath = resolvePath(outPath);
  if (resolvedOutPath) writeJson(resolvedOutPath, artifact);
  return artifact;
}

function parseArgs(argv = []) {
  const args = {
    attemptsPath: '',
    outPath: '',
    endpoint: DEFAULT_ENDPOINT,
    sequencePath: '',
    maxAttempts: 0
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = str(argv[index]);
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${token}`);
      return argv[index];
    };
    if (token === '--attempts') args.attemptsPath = next();
    else if (token === '--out') args.outPath = next();
    else if (token === '--endpoint') args.endpoint = next();
    else if (token === '--sequence') args.sequencePath = next();
    else if (token === '--max-attempts') args.maxAttempts = Number(next());
    else if (token === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${token}`);
  }
  return args;
}

function usage() {
  return `Usage:
  node scripts/designer-training/run-render-review-revision-attempts.mjs --attempts render-review-revision-attempts.json --out execution.json [--endpoint http://127.0.0.1:49915/xlightsdesigner/api]

Options:
  --sequence path/to/working.xsq   Override source sequence for every attempt.
  --max-attempts 1                 Execute only the first N attempts.
`;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help || !args.attemptsPath) {
      process.stdout.write(usage());
      process.exit(args.help ? 0 : 1);
    }
    const artifact = await runRenderReviewRevisionAttempts(args);
    process.stdout.write(`${JSON.stringify(artifact, null, 2)}\n`);
  } catch (error) {
    console.error(error?.stack || String(error));
    process.exit(1);
  }
}
