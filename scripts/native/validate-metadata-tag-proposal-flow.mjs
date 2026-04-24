#!/usr/bin/env node
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = process.env.XLD_NATIVE_AUTOMATION_URL || 'http://127.0.0.1:49916';
const DEFAULT_VALIDATION_ROOT_NAME = '_xlightsdesigner_validation';

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
  console.error('usage: validate-metadata-tag-proposal-flow.mjs --target-ids <ids> --selected-tags <tags> [--role lead] [--semantic-hints hints] [--effect-avoidances effects] [--sequence-path path] [--show-dir path] [--duration-ms 30000] [--frame-ms 50] [--force-validation-sequence] [--apply-review] [--render-after-apply] [--timeout-ms 30000]');
  process.exit(2);
}

function parseArgs(argv = []) {
  const out = {
    targetIds: '',
    selectedTags: '',
    rolePreference: 'lead',
    semanticHints: 'centerpiece',
    effectAvoidances: 'Bars',
    sequencePath: '',
    showDir: '',
    durationMs: 30000,
    frameMs: 50,
    forceValidationSequence: false,
    applyReview: false,
    renderAfterApply: false,
    timeoutMs: 30000
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = str(argv[i]);
    if (token === '--target-ids') out.targetIds = str(argv[++i]);
    else if (token === '--selected-tags') out.selectedTags = str(argv[++i]);
    else if (token === '--role') out.rolePreference = str(argv[++i]);
    else if (token === '--semantic-hints') out.semanticHints = str(argv[++i]);
    else if (token === '--effect-avoidances') out.effectAvoidances = str(argv[++i]);
    else if (token === '--sequence-path') out.sequencePath = str(argv[++i]);
    else if (token === '--show-dir') out.showDir = str(argv[++i]);
    else if (token === '--duration-ms') out.durationMs = Number(argv[++i]);
    else if (token === '--frame-ms') out.frameMs = Number(argv[++i]);
    else if (token === '--force-validation-sequence') out.forceValidationSequence = true;
    else if (token === '--apply-review') out.applyReview = true;
    else if (token === '--render-after-apply') out.renderAfterApply = true;
    else if (token === '--timeout-ms') out.timeoutMs = Number(argv[++i]);
    else usage();
  }
  if (!out.targetIds) usage();
  if (!out.selectedTags) usage();
  if (!Number.isFinite(out.durationMs) || out.durationMs <= 0) out.durationMs = 30000;
  if (!Number.isFinite(out.frameMs) || out.frameMs <= 0) out.frameMs = 50;
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

function timestampId() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function refreshXlightsSession() {
  return request('POST', '/action', { action: 'refreshXLightsSession' });
}

async function ensureSequenceContext(args, targetIds = [], selectedTags = []) {
  const refresh = await refreshXlightsSession();
  const session = refresh?.xlights && typeof refresh.xlights === 'object' ? refresh.xlights : {};
  if (session.isReachable !== true) {
    throw new Error(`xLights is not reachable through the native app: ${str(session.dirtyStateReason || session.layoutDirtyStateReason)}`);
  }
  if (!args.forceValidationSequence && session.isSequenceOpen === true && str(session.sequencePath)) {
    return {
      mode: 'existing',
      sequencePath: str(session.sequencePath),
      showDir: str(session.showDirectory)
    };
  }

  const showDirRaw = args.showDir || str(session.showDirectory);
  if (!showDirRaw) {
    throw new Error('No xLights show folder is available for validation sequence creation.');
  }
  const showDir = path.resolve(showDirRaw);

  const sequencePath = args.sequencePath
    ? path.resolve(args.sequencePath)
    : path.join(
        showDir,
        DEFAULT_VALIDATION_ROOT_NAME,
        'metadata-tag-proposal',
        `${timestampId()}-${targetIds.join('_') || 'target'}-${selectedTags.join('_') || 'tag'}.xsq`
      );
  await mkdir(path.dirname(sequencePath), { recursive: true });

  if (args.sequencePath) {
    const opened = await request('POST', '/action', {
      action: 'openXLightsSequence',
      filePath: sequencePath,
      saveBeforeSwitch: false
    });
    await refreshXlightsSession();
    return { mode: 'opened', sequencePath, showDir, opened };
  }

  const created = await request('POST', '/action', {
    action: 'createXLightsSequence',
    filePath: sequencePath,
    durationMs: args.durationMs,
    frameMs: args.frameMs
  });
  await refreshXlightsSession();
  return { mode: 'created', sequencePath, showDir, created };
}

function findMetadataRow(snapshot = {}, targetId = '', selectedTags = []) {
  const rows = [
    ...arr(snapshot?.pages?.display?.metadataRows),
    ...arr(snapshot?.pages?.display?.targetIntentMetadataRows)
  ];
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

function latestSequencingArtifactMatches(snapshot = {}, targetIds = [], selectedTags = []) {
  const artifact = snapshot?.latestProposalBundle && typeof snapshot.latestProposalBundle === 'object'
    ? snapshot.latestProposalBundle
    : snapshot?.latestPlanHandoff && typeof snapshot.latestPlanHandoff === 'object'
      ? snapshot.latestPlanHandoff
      : null;
  if (!artifact) return false;
  const metadata = artifact.metadata && typeof artifact.metadata === 'object' ? artifact.metadata : {};
  const scope = artifact.scope && typeof artifact.scope === 'object'
    ? artifact.scope
    : metadata.scope && typeof metadata.scope === 'object'
      ? metadata.scope
    : null;
  if (!scope) return false;
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
    if (latestSequencingArtifactMatches(lastSnapshot, targetIds, selectedTags)) {
      return lastSnapshot;
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error(`Timed out waiting for generated plan with targets=${targetIds.join(',')} tags=${selectedTags.join(',')}. Last snapshot: ${JSON.stringify(lastSnapshot)}`);
}

async function waitForApplyResult({ previousArtifactId = '', timeoutMs = 120000 } = {}) {
  const start = Date.now();
  let lastSnapshot = null;
  while (Date.now() - start < timeoutMs) {
    lastSnapshot = await request('GET', '/sequencer-validation-snapshot');
    const latestApplyResult = lastSnapshot?.latestApplyResult && typeof lastSnapshot.latestApplyResult === 'object'
      ? lastSnapshot.latestApplyResult
      : null;
    const latestId = str(latestApplyResult?.artifactId);
    const review = lastSnapshot?.pageStates?.review && typeof lastSnapshot.pageStates.review === 'object'
      ? lastSnapshot.pageStates.review
      : {};
    const blockedBanner = arr(review.banners).find((banner) => str(banner?.state).toLowerCase() === 'blocked');
    if (blockedBanner) {
      throw new Error(`Review apply blocked: ${str(blockedBanner.text)}`);
    }
    if (latestApplyResult && latestId && latestId !== previousArtifactId) {
      return { snapshot: lastSnapshot, applyResult: latestApplyResult };
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out waiting for review apply result. Last snapshot: ${JSON.stringify(lastSnapshot)}`);
}

const args = parseArgs(process.argv.slice(2));
const targetIds = splitList(args.targetIds);
const selectedTags = splitList(args.selectedTags);

const health = await request('GET', '/health');
if (health?.ok === false) {
  throw new Error(`Native automation server is not ready: ${JSON.stringify(health)}`);
}

const sequenceContext = await ensureSequenceContext(args, targetIds, selectedTags);

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

await request('POST', '/action', {
  action: 'applyAssistantActionRequest',
  actionType: 'save_design_intent',
  reason: 'metadata tag proposal validation',
  payload: {
    goal: `Validate metadata-selected sequencing for ${targetIds.join(', ')}.`,
    mood: 'focused validation',
    targetScope: targetIds.join(', '),
    constraints: `Use selected display metadata tags: ${selectedTags.join(', ')}.`,
    references: '',
    approvalNotes: 'Automation validation'
  }
});

const generationResult = await request('POST', '/action', {
  action: 'generateSequenceProposal',
  selectedTagNames: args.selectedTags
});
const generationBanner = generationResult?.banner && typeof generationResult.banner === 'object' ? generationResult.banner : null;
if (generationBanner && str(generationBanner.state).toLowerCase() === 'blocked') {
  throw new Error(`Generation blocked: ${str(generationBanner.text)}`);
}

const validationSnapshot = await waitForProposal({
  targetIds,
  selectedTags,
  timeoutMs: args.timeoutMs
});
let applyValidation = null;
let renderValidation = null;
if (args.applyReview) {
  const previousApplyId = str(validationSnapshot?.latestApplyResult?.artifactId);
  const applyAccepted = await request('POST', '/action', { action: 'applyReview' });
  applyValidation = {
    accepted: applyAccepted,
    ...(await waitForApplyResult({ previousArtifactId: previousApplyId, timeoutMs: Math.max(args.timeoutMs, 120000) }))
  };
  if (args.renderAfterApply) {
    renderValidation = await request('POST', '/action', { action: 'renderXLightsSequence' });
  }
}

process.stdout.write(`${JSON.stringify({
  ok: true,
  baseUrl: BASE_URL,
  updateAccepted: updateResult?.ok === true,
  generationAccepted: generationResult?.ok === true,
  targetIds,
  selectedTags,
  sequenceContext,
  latestProposalArtifactId: str(validationSnapshot?.latestProposalBundle?.artifactId),
  latestPlanArtifactId: str(validationSnapshot?.latestPlanHandoff?.artifactId),
  latestIntentArtifactId: str(validationSnapshot?.latestIntentHandoff?.artifactId),
  latestApplyArtifactId: str(applyValidation?.applyResult?.artifactId),
  latestApplyStatus: str(applyValidation?.applyResult?.status),
  metadataAssignmentCount: Number((applyValidation?.applyResult ?? validationSnapshot?.latestApplyResult)?.metadataAssignmentCount || 0),
  renderSummary: str(renderValidation?.summary)
}, null, 2)}\n`);
