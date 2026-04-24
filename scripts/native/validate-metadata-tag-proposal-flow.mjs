#!/usr/bin/env node

const BASE_URL = process.env.XLD_NATIVE_AUTOMATION_URL || 'http://127.0.0.1:49916';

function str(value = '') {
  return String(value || '').trim();
}

function splitList(value = '') {
  return str(value)
    .split(',')
    .map((row) => str(row))
    .filter(Boolean);
}

function usage() {
  console.error('usage: validate-metadata-tag-proposal-flow.mjs --target-ids <ids> --selected-tags <tags> [--role lead] [--semantic-hints hints] [--effect-avoidances effects] [--timeout-ms 30000]');
  process.exit(2);
}

function parseArgs(argv = []) {
  const out = {
    targetIds: '',
    selectedTags: '',
    rolePreference: 'lead',
    semanticHints: 'centerpiece',
    effectAvoidances: 'Bars',
    timeoutMs: 30000
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = str(argv[i]);
    if (token === '--target-ids') out.targetIds = str(argv[++i]);
    else if (token === '--selected-tags') out.selectedTags = str(argv[++i]);
    else if (token === '--role') out.rolePreference = str(argv[++i]);
    else if (token === '--semantic-hints') out.semanticHints = str(argv[++i]);
    else if (token === '--effect-avoidances') out.effectAvoidances = str(argv[++i]);
    else if (token === '--timeout-ms') out.timeoutMs = Number(argv[++i]);
    else usage();
  }
  if (!out.targetIds) usage();
  if (!out.selectedTags) usage();
  if (!Number.isFinite(out.timeoutMs) || out.timeoutMs < 1000) out.timeoutMs = 30000;
  return out;
}

async function request(method, path, body = null) {
  const init = { method, headers: {} };
  if (body) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const response = await fetch(`${BASE_URL}${path}`, init);
  const text = await response.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { ok: false, error: text };
  }
  if (!response.ok) {
    throw new Error(`${method} ${path} failed (${response.status}): ${JSON.stringify(parsed)}`);
  }
  return parsed;
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function findMetadataRow(snapshot = {}, targetId = '', selectedTags = []) {
  const rows = arr(snapshot?.pages?.display?.metadataRows);
  const normalizedTarget = str(targetId).toLowerCase();
  const normalizedTags = selectedTags.map((row) => str(row).toLowerCase()).filter(Boolean);
  return rows.find((row) => {
    const subject = str(row?.subject).toLowerCase();
    const category = str(row?.category);
    const value = str(row?.value).toLowerCase();
    return subject === normalizedTarget
      && category === 'Target Intent'
      && normalizedTags.some((tag) => value.includes(tag));
  }) || null;
}

function latestPlanMatches(snapshot = {}, targetIds = [], selectedTags = []) {
  const plan = snapshot?.latestPlanHandoff && typeof snapshot.latestPlanHandoff === 'object'
    ? snapshot.latestPlanHandoff
    : null;
  if (!plan) return false;
  const metadata = plan.metadata && typeof plan.metadata === 'object' ? plan.metadata : {};
  const scope = metadata.scope && typeof metadata.scope === 'object' ? metadata.scope : {};
  const planTargets = new Set(arr(scope.targetIds).map((row) => str(row)));
  const planTags = new Set(arr(scope.tagNames).map((row) => str(row)));
  const hasTargets = targetIds.every((targetId) => planTargets.has(targetId));
  const hasTags = selectedTags.every((tag) => planTags.has(tag));
  return hasTargets && hasTags;
}

async function waitForProposal({ targetIds = [], selectedTags = [], timeoutMs = 30000 } = {}) {
  const start = Date.now();
  let lastSnapshot = null;
  while (Date.now() - start < timeoutMs) {
    lastSnapshot = await request('GET', '/sequencer-validation-snapshot');
    if (latestPlanMatches(lastSnapshot, targetIds, selectedTags)) {
      return lastSnapshot;
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error(`Timed out waiting for generated plan with targets=${targetIds.join(',')} tags=${selectedTags.join(',')}. Last snapshot: ${JSON.stringify(lastSnapshot)}`);
}

const args = parseArgs(process.argv.slice(2));
const targetIds = splitList(args.targetIds);
const selectedTags = splitList(args.selectedTags);

const health = await request('GET', '/health');
if (health?.ok === false) {
  throw new Error(`Native automation server is not ready: ${JSON.stringify(health)}`);
}

const updateResult = await request('POST', '/action', {
  action: 'updateDisplayTargetIntent',
  targetIds: args.targetIds,
  rolePreference: args.rolePreference,
  semanticHints: args.semanticHints,
  effectAvoidances: args.effectAvoidances
});

const appSnapshot = await request('GET', '/snapshot');
const missingRows = targetIds.filter((targetId) => !findMetadataRow(appSnapshot, targetId, selectedTags));
if (missingRows.length) {
  throw new Error(`Target intent metadata row missing for: ${missingRows.join(', ')}`);
}

const generationResult = await request('POST', '/action', {
  action: 'generateSequenceProposal',
  selectedTagNames: args.selectedTags
});

const validationSnapshot = await waitForProposal({
  targetIds,
  selectedTags,
  timeoutMs: args.timeoutMs
});

process.stdout.write(`${JSON.stringify({
  ok: true,
  baseUrl: BASE_URL,
  updateAccepted: updateResult?.ok === true,
  generationAccepted: generationResult?.ok === true,
  targetIds,
  selectedTags,
  latestPlanArtifactId: str(validationSnapshot?.latestPlanHandoff?.artifactId),
  latestIntentArtifactId: str(validationSnapshot?.latestIntentHandoff?.artifactId),
  metadataAssignmentCount: Number(validationSnapshot?.latestApplyResult?.metadataAssignmentCount || 0)
}, null, 2)}\n`);
