#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_ENDPOINT = 'http://127.0.0.1:49915/xlightsdesigner/api';

function str(value = '') {
  return String(value || '').trim();
}

function trace(line = '') {
  const out = `[run-owned-packed-batch] ${line}`;
  process.stderr.write(`${out}\n`);
}

function parseArgs(argv = []) {
  const out = {
    endpoint: DEFAULT_ENDPOINT,
    sequence: '',
    payloadFile: '',
    resultFile: ''
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = str(argv[i]);
    if (token === '--endpoint') out.endpoint = str(argv[++i]);
    else if (token === '--sequence') out.sequence = path.resolve(str(argv[++i]));
    else if (token === '--payload-file') out.payloadFile = path.resolve(str(argv[++i]));
    else if (token === '--result-file') out.resultFile = path.resolve(str(argv[++i]));
    else throw new Error(`Unknown argument: ${token}`);
  }
  if (!out.sequence) throw new Error('--sequence is required');
  if (!out.payloadFile) throw new Error('--payload-file is required');
  if (!out.resultFile) throw new Error('--result-file is required');
  return out;
}

async function request(base, route, { method = 'GET', body = null } = {}) {
  trace(`request ${method} ${route}`);
  const response = await fetch(`${base}${route}`, {
    method,
    headers: body == null ? undefined : { 'Content-Type': 'application/json' },
    body: body == null ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let json = {};
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON from ${method} ${route}: ${text}`);
  }
  if (!response.ok || json?.ok === false) {
    trace(`request-failed ${method} ${route} status=${response.status}`);
    throw new Error(`${method} ${route} failed (${response.status}): ${JSON.stringify(json)}`);
  }
  trace(`request-ok ${method} ${route} status=${response.status}`);
  return { status: response.status, json };
}

function normalizeJobTerminalState(state = '') {
  const text = str(state).toLowerCase();
  if (text === 'succeeded' || text === 'completed') return 'completed';
  if (text === 'failed') return 'failed';
  return '';
}

async function waitForJob(base, jobId, timeoutMs = 180000) {
  trace(`wait-job-begin jobId=${jobId}`);
  const started = Date.now();
  for (;;) {
    const { json } = await request(base, `/jobs/get?jobId=${encodeURIComponent(jobId)}`);
    const state = normalizeJobTerminalState(json?.data?.state || json?.state);
    if (state === 'completed') {
      trace(`wait-job-completed jobId=${jobId}`);
      const result = json?.data?.result && typeof json.data.result === 'object'
        ? json.data.result
        : json;
      if (result?.ok === false) {
        throw new Error(`Job ${jobId} completed with failure: ${JSON.stringify(result)}`);
      }
      return result;
    }
    if (state === 'failed') {
      trace(`wait-job-failed jobId=${jobId}`);
      throw new Error(`Job ${jobId} failed: ${JSON.stringify(json)}`);
    }
    if (Date.now() - started > timeoutMs) {
      trace(`wait-job-timeout jobId=${jobId}`);
      throw new Error(`Timed out waiting for job ${jobId}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

async function settleQueued(base, route, responseJson) {
  const jobId = str(responseJson?.data?.jobId || responseJson?.jobId);
  const accepted = responseJson?.data?.accepted === true || responseJson?.accepted === true;
  if (!jobId && !accepted) return responseJson;
  if (!jobId) {
    throw new Error(`${route} returned queued response without jobId: ${JSON.stringify(responseJson)}`);
  }
  return waitForJob(base, jobId);
}

async function resolveRenderedFseqPath(base, sequencePath, renderResult = {}) {
  const direct = str(renderResult?.data?.fseqPath || renderResult?.fseqPath);
  if (direct && fs.existsSync(direct)) return direct;

  const media = await request(base, '/media/current');
  const showDirectory = str(media?.json?.data?.showDirectory);
  const openSequencePath = str(media?.json?.data?.sequencePath || sequencePath);
  const basename = path.basename(openSequencePath, '.xsq');
  const candidates = [
    path.join(path.dirname(openSequencePath), `${basename}.fseq`),
    showDirectory ? path.join(showDirectory, `${basename}.fseq`) : ''
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return direct;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const payload = JSON.parse(fs.readFileSync(args.payloadFile, 'utf8'));
  trace(`begin sequence=${args.sequence}`);

  const health = await request(args.endpoint, '/health');
  const state = str(health?.json?.data?.state || health?.json?.data?.status);
  if (state && state.toLowerCase() !== 'ready') {
    throw new Error(`Owned xLights API is not ready: ${JSON.stringify(health.json)}`);
  }

  let closeResult = null;
  try {
    trace('close-before-open begin');
    const closed = await request(args.endpoint, '/sequence/close', {
      method: 'POST',
      body: { force: true, quiet: true }
    });
    closeResult = await settleQueued(args.endpoint, '/sequence/close', closed.json);
    trace('close-before-open done');
  } catch (error) {
    trace(`close-before-open ignored reason=${str(error?.message || error)}`);
    closeResult = { ignored: true, reason: str(error?.message || error) };
  }

  trace('open begin');
  const open = await request(args.endpoint, '/sequence/open', {
    method: 'POST',
    body: {
      file: args.sequence,
      force: true,
      promptIssues: false
    }
  });
  const openResult = await settleQueued(args.endpoint, '/sequence/open', open.json);
  trace('open done');

  trace('apply begin');
  const apply = await request(args.endpoint, '/sequencing/apply-batch-plan', {
    method: 'POST',
    body: payload
  });
  const applyResult = await settleQueued(args.endpoint, '/sequencing/apply-batch-plan', apply.json);
  trace('apply done');

  let saveResult = null;
  try {
    trace('save begin');
    const save = await request(args.endpoint, '/sequence/save', {
      method: 'POST',
      body: { file: args.sequence }
    });
    saveResult = await settleQueued(args.endpoint, '/sequence/save', save.json);
    trace('save done');
  } catch (error) {
    trace(`save skipped reason=${str(error?.message || error)}`);
    saveResult = {
      skipped: true,
      warning: str(error?.message || error)
    };
  }

  trace('render begin');
  const render = await request(args.endpoint, '/sequence/render-current', {
    method: 'POST',
    body: {}
  });
  const renderResult = await settleQueued(args.endpoint, '/sequence/render-current', render.json);
  trace('render done');
  const fseqPath = await resolveRenderedFseqPath(args.endpoint, args.sequence, renderResult);
  if (!fseqPath) {
    throw new Error(`render-current returned no fseqPath: ${JSON.stringify(renderResult)}`);
  }

  let finalClose = null;
  try {
    trace('close-after-render begin');
    const closed = await request(args.endpoint, '/sequence/close', {
      method: 'POST',
      body: { force: true, quiet: true }
    });
    finalClose = await settleQueued(args.endpoint, '/sequence/close', closed.json);
    trace('close-after-render done');
  } catch (error) {
    trace(`close-after-render ignored reason=${str(error?.message || error)}`);
    finalClose = { ignored: true, reason: str(error?.message || error) };
  }

  const out = {
    ok: true,
    endpoint: args.endpoint,
    sequence: args.sequence,
    payloadFile: args.payloadFile,
    closeBeforeOpen: closeResult,
    open: openResult,
    apply: applyResult,
    save: saveResult,
    render: renderResult,
    closeAfterRender: finalClose,
    fseqPath
  };
  fs.writeFileSync(args.resultFile, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
  trace('complete');
  process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exit(1);
});
