#!/usr/bin/env node
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = process.env.XLD_NATIVE_AUTOMATION_URL || 'http://127.0.0.1:49916';
const XLIGHTS_API_BASE_URL = process.env.XLD_XLIGHTS_API_URL || 'http://127.0.0.1:49915/xlightsdesigner/api';
const DEFAULT_VALIDATION_ROOT_NAME = '_xlightsdesigner_validation';
const DEFAULT_VALIDATION_SECTION_TRACK = 'Validation Section Scope';

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
  console.error('usage: validate-metadata-tag-proposal-flow.mjs --target-ids <ids> --selected-tags <tags> [--section-label label] [--timing-track-name name] [--intent-goal goal] [--expected-timing-tracks csv] [--expected-anchor-tracks csv] [--require-anchors-in-section] [--seed-existing-effect] [--seed-existing-model model] [--seed-existing-effect-name name] [--seed-existing-layer n] [--seed-existing-start-ms n] [--seed-existing-end-ms n] [--expect-replacement-overlap] [--tag-only] [--role lead] [--semantic-hints hints] [--effect-avoidances effects] [--sequence-path path] [--show-dir path] [--duration-ms 30000] [--frame-ms 50] [--force-validation-sequence] [--apply-review] [--render-after-apply] [--timeout-ms 30000]');
  process.exit(2);
}

function parseArgs(argv = []) {
  const out = {
    targetIds: '',
    selectedTags: '',
    sectionLabel: '',
    timingTrackName: '',
    intentGoal: '',
    expectedTimingTracks: '',
    expectedAnchorTracks: '',
    requireAnchorsInSection: false,
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
    tagOnly: false,
    seedExistingEffect: false,
    seedExistingModel: '',
    seedExistingEffectName: 'On',
    seedExistingLayer: 0,
    seedExistingStartMs: 0,
    seedExistingEndMs: 0,
    expectReplacementOverlap: false,
    timeoutMs: 30000
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = str(argv[i]);
    if (token === '--target-ids') out.targetIds = str(argv[++i]);
    else if (token === '--selected-tags') out.selectedTags = str(argv[++i]);
    else if (token === '--section-label') out.sectionLabel = str(argv[++i]);
    else if (token === '--timing-track-name' || token === '--section-timing-track-name') out.timingTrackName = str(argv[++i]);
    else if (token === '--intent-goal' || token === '--validation-goal') out.intentGoal = str(argv[++i]);
    else if (token === '--expected-timing-tracks') out.expectedTimingTracks = str(argv[++i]);
    else if (token === '--expected-anchor-tracks' || token === '--expected-anchored-timing-tracks') out.expectedAnchorTracks = str(argv[++i]);
    else if (token === '--require-anchors-in-section' || token === '--require-section-scoped-anchors') out.requireAnchorsInSection = true;
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
    else if (token === '--tag-only') out.tagOnly = true;
    else if (token === '--seed-existing-effect') out.seedExistingEffect = true;
    else if (token === '--seed-existing-model' || token === '--seed-existing-target') out.seedExistingModel = str(argv[++i]);
    else if (token === '--seed-existing-effect-name') out.seedExistingEffectName = str(argv[++i]);
    else if (token === '--seed-existing-layer') out.seedExistingLayer = Number(argv[++i]);
    else if (token === '--seed-existing-start-ms') out.seedExistingStartMs = Number(argv[++i]);
    else if (token === '--seed-existing-end-ms') out.seedExistingEndMs = Number(argv[++i]);
    else if (token === '--expect-replacement-overlap' || token === '--expect-replacement-authorized') out.expectReplacementOverlap = true;
    else if (token === '--timeout-ms') out.timeoutMs = Number(argv[++i]);
    else usage();
  }
  if (!out.targetIds) usage();
  if (!out.selectedTags) usage();
  if (!Number.isFinite(out.durationMs) || out.durationMs <= 0) out.durationMs = 30000;
  if (!Number.isFinite(out.frameMs) || out.frameMs <= 0) out.frameMs = 50;
  if (!Number.isFinite(out.seedExistingLayer) || out.seedExistingLayer < 0) out.seedExistingLayer = 0;
  if (!Number.isFinite(out.seedExistingStartMs) || out.seedExistingStartMs < 0) out.seedExistingStartMs = 0;
  if (!Number.isFinite(out.seedExistingEndMs) || out.seedExistingEndMs <= out.seedExistingStartMs) out.seedExistingEndMs = out.durationMs;
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

async function requestXlightsApi(path, query = {}) {
  const url = new URL(`${XLIGHTS_API_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      url.searchParams.set(key, String(value).trim());
    }
  }
  const response = await fetch(url);
  const text = await response.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { ok: false, error: text };
  }
  if (!response.ok || parsed?.ok === false) {
    throw new Error(`GET ${url.toString()} failed (${response.status}): ${JSON.stringify(parsed)}`);
  }
  return parsed;
}

async function requestXlightsPost(path, body = {}) {
  const response = await fetch(`${XLIGHTS_API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { ok: false, error: text };
  }
  if (!response.ok || parsed?.ok === false) {
    throw new Error(`POST ${path} failed (${response.status}): ${JSON.stringify(parsed)}`);
  }
  return parsed;
}

async function waitForXlightsJob({ jobId = '', timeoutMs = 30000 } = {}) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < timeoutMs) {
    last = await requestXlightsApi('/jobs/get', { jobId });
    const state = str(last?.data?.state).toLowerCase();
    const result = last?.data?.result && typeof last.data.result === 'object' ? last.data.result : null;
    if (state === 'completed' || state === 'succeeded') {
      if (result?.ok === false) throw new Error(`xLights job ${jobId} failed: ${JSON.stringify(result)}`);
      return result || last;
    }
    if (state === 'failed' || result?.ok === false) {
      throw new Error(`xLights job ${jobId} failed: ${JSON.stringify(last)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for xLights job ${jobId}. Last response: ${JSON.stringify(last)}`);
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

function normalizeTrackNames(payload = {}) {
  const tracks = arr(payload?.data?.tracks || payload?.tracks);
  return tracks
    .map((row) => typeof row === 'string' ? row : str(row?.name || row?.trackName || row?.label))
    .map((row) => str(row))
    .filter(Boolean);
}

function normalizeTimingMarks(payload = {}) {
  return arr(payload?.data?.marks || payload?.data?.timingMarks || payload?.marks || payload?.timingMarks)
    .map((row) => ({
      label: str(row?.label || row?.name || row?.text),
      startMs: Number(row?.startMs ?? row?.start ?? row?.timeMs ?? 0),
      endMs: Number(row?.endMs ?? row?.end ?? row?.timeMs ?? 0)
    }))
    .filter((row) => row.label);
}

function normalizeEffects(payload = {}) {
  return arr(payload?.data?.effects || payload?.effects)
    .map((row) => ({
      ...row,
      modelName: str(row?.modelName || row?.element || row?.model),
      effectName: str(row?.effectName || row?.name),
      layerIndex: Number(row?.layerIndex ?? row?.layerNumber ?? row?.layer ?? 0),
      startMs: Number(row?.startMs ?? row?.start ?? 0),
      endMs: Number(row?.endMs ?? row?.end ?? 0)
    }))
    .filter((row) => row.modelName || row.effectName);
}

async function seedExistingEffectForValidation({ targetIds = [], args = {} } = {}) {
  if (!args.seedExistingEffect) return null;
  const element = str(args.seedExistingModel) || targetIds[0];
  if (!element) throw new Error('Cannot seed existing effect without a target model.');
  const seed = {
    element,
    layer: Number(args.seedExistingLayer),
    effectName: str(args.seedExistingEffectName) || 'On',
    startMs: Number(args.seedExistingStartMs),
    endMs: Number(args.seedExistingEndMs),
    settings: {},
    palette: {},
    clearExisting: false
  };
  const apply = await requestXlightsPost('/sequencing/apply-batch-plan', {
    track: 'XD: Existing Effect Seed',
    subType: 'Generic',
    replaceExistingMarks: true,
    marks: [
      { label: 'Seeded Existing Intro', startMs: 0, endMs: Math.max(1, Math.floor(seed.endMs * 0.25)) },
      { label: 'Seeded Existing Effect', startMs: Math.max(1, Math.floor(seed.endMs * 0.25)), endMs: Math.max(2, Math.floor(seed.endMs * 0.75)) },
      { label: 'Seeded Existing Outro', startMs: Math.max(2, Math.floor(seed.endMs * 0.75)), endMs: seed.endMs }
    ],
    effects: [seed]
  });
  const jobId = str(apply?.data?.jobId);
  if (jobId) await waitForXlightsJob({ jobId });
  const readback = await requestXlightsApi('/effects/window', {
    element,
    startMs: seed.startMs,
    endMs: seed.endMs
  });
  const effects = normalizeEffects(readback);
  const present = effects.some((row) =>
    row.layerIndex === seed.layer &&
    row.effectName === seed.effectName &&
    row.startMs === seed.startMs &&
    row.endMs === seed.endMs
  );
  if (!present) {
    throw new Error(`Seeded existing effect was not readable before generation: ${JSON.stringify({ seed, effects })}`);
  }
  return {
    ...seed,
    readbackCount: effects.length
  };
}

async function resolveSectionTimingScope({ sectionLabel = '', timingTrackName = '' } = {}) {
  const label = str(sectionLabel);
  if (!label) return null;
  const normalizedLabel = label.toLowerCase();
  const tracksPayload = await requestXlightsApi('/timing/tracks');
  const trackNames = normalizeTrackNames(tracksPayload);
  if (!trackNames.length) {
    throw new Error(`Section label "${label}" cannot be resolved because the open sequence has no timing tracks.`);
  }
  const requestedTrackName = str(timingTrackName);
  const candidateTrackNames = requestedTrackName ? [requestedTrackName] : trackNames;
  if (requestedTrackName && !trackNames.some((name) => name.toLowerCase() === requestedTrackName.toLowerCase())) {
    throw new Error(`Timing track "${requestedTrackName}" is not present in the open sequence. Available tracks: ${trackNames.join(', ')}`);
  }

  const matches = [];
  for (const candidateTrackName of candidateTrackNames) {
    const actualTrackName = trackNames.find((name) => name.toLowerCase() === candidateTrackName.toLowerCase()) || candidateTrackName;
    const marksPayload = await requestXlightsApi('/timing/marks', { track: actualTrackName });
    for (const mark of normalizeTimingMarks(marksPayload)) {
      if (mark.label.toLowerCase() === normalizedLabel) {
        matches.push({ trackName: actualTrackName, sectionLabel: mark.label, startMs: mark.startMs, endMs: mark.endMs });
      }
    }
  }
  if (!matches.length) {
    const trackText = requestedTrackName ? `timing track "${requestedTrackName}"` : `available timing tracks: ${trackNames.join(', ')}`;
    throw new Error(`Section label "${label}" was not found in ${trackText}.`);
  }
  if (matches.length > 1) {
    const matchText = matches.map((row) => `${row.trackName}:${row.sectionLabel}@${row.startMs}-${row.endMs}`).join(', ');
    throw new Error(`Section label "${label}" is ambiguous across timing marks. Pass --timing-track-name to disambiguate. Matches: ${matchText}`);
  }
  return matches[0];
}

async function seedValidationSectionTimingTrack({ sectionLabel = '', timingTrackName = '', durationMs = 30000 } = {}) {
  const label = str(sectionLabel);
  if (!label) return null;
  const trackName = str(timingTrackName) || DEFAULT_VALIDATION_SECTION_TRACK;
  const duration = Math.max(Number(durationMs) || 30000, 4000);
  const chorusStart = Math.max(0, Math.floor(duration * 0.67));
  const marks = [
    { startMs: 0, endMs: Math.floor(duration * 0.2), label: 'General' },
    { startMs: Math.floor(duration * 0.2), endMs: Math.floor(duration * 0.42), label: 'Intro' },
    { startMs: Math.floor(duration * 0.42), endMs: chorusStart, label: 'Verse 1' },
    { startMs: chorusStart, endMs: duration - 1, label }
  ];
  await requestXlightsPost('/timing/ensure-track', { track: trackName, subType: 'variable' });
  const addMarks = await requestXlightsPost('/timing/add-marks', {
    track: trackName,
    subType: 'variable',
    replaceExisting: true,
    marks: JSON.stringify(marks)
  });
  const jobId = str(addMarks?.data?.jobId);
  if (jobId) await waitForXlightsJob({ jobId });
  return { trackName, marks };
}

function artifactScopeMatches(artifact = null, targetIds = [], selectedTags = [], selectedSections = []) {
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
  const planSections = new Set(arr(scope.sections).map((row) => str(row)));
  const hasTargets = targetIds.every((targetId) => planTargets.has(targetId));
  const hasTags = selectedTags.every((tag) => planTags.has(tag));
  const hasSections = selectedSections.every((section) => planSections.has(section));
  return hasTargets && hasTags && hasSections;
}

function matchingSequencingArtifacts(snapshot = {}, targetIds = [], selectedTags = [], selectedSections = [], previousArtifactIds = new Set()) {
  return [
    snapshot?.latestProposalBundle && typeof snapshot.latestProposalBundle === 'object'
      ? snapshot.latestProposalBundle
      : null,
    snapshot?.latestPlanHandoff && typeof snapshot.latestPlanHandoff === 'object'
      ? snapshot.latestPlanHandoff
      : null
  ].filter((artifact) => {
    const artifactId = str(artifact?.artifactId);
    return artifactId && !previousArtifactIds.has(artifactId) && artifactScopeMatches(artifact, targetIds, selectedTags, selectedSections);
  });
}

function reviewReadyMatches(snapshot = {}, targetIds = [], selectedTags = [], selectedSections = [], { tagOnly = false } = {}) {
  const review = snapshot?.pageStates?.review && typeof snapshot.pageStates.review === 'object'
    ? snapshot.pageStates.review
    : {};
  const pendingSummary = str(review.pendingSummary).toLowerCase();
  const includesTargets = tagOnly || targetIds.every((targetId) => pendingSummary.includes(str(targetId).toLowerCase()));
  const includesTags = selectedTags.every((tag) => pendingSummary.includes(str(tag).toLowerCase()));
  const includesSections = selectedSections.every((section) => pendingSummary.includes(str(section).toLowerCase()));
  return review.canApply === true && review.isApplying !== true && includesTargets && includesTags && includesSections;
}

async function waitForProposal({ targetIds = [], selectedTags = [], selectedSections = [], previousArtifactIds = new Set(), timeoutMs = 30000 } = {}) {
  const start = Date.now();
  let lastSnapshot = null;
  while (Date.now() - start < timeoutMs) {
    lastSnapshot = await request('GET', '/sequencer-validation-snapshot');
    const matches = matchingSequencingArtifacts(lastSnapshot, targetIds, selectedTags, selectedSections, previousArtifactIds);
    if (matches.length) {
      return { snapshot: lastSnapshot, matches };
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error(`Timed out waiting for generated plan with targets=${targetIds.join(',')} tags=${selectedTags.join(',')} sections=${selectedSections.join(',')}. Last snapshot: ${JSON.stringify(lastSnapshot)}`);
}

async function waitForReviewReady({ targetIds = [], selectedTags = [], selectedSections = [], tagOnly = false, timeoutMs = 30000 } = {}) {
  const start = Date.now();
  let lastSnapshot = null;
  while (Date.now() - start < timeoutMs) {
    lastSnapshot = await request('GET', '/sequencer-validation-snapshot');
    if (reviewReadyMatches(lastSnapshot, targetIds, selectedTags, selectedSections, { tagOnly })) {
      return lastSnapshot;
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error(`Timed out waiting for Review to expose matching pending work for targets=${targetIds.join(',')} tags=${selectedTags.join(',')} sections=${selectedSections.join(',')}. Last snapshot: ${JSON.stringify(lastSnapshot)}`);
}

function blockedBannerTexts(snapshot = {}) {
  const review = snapshot?.pageStates?.review && typeof snapshot.pageStates.review === 'object'
    ? snapshot.pageStates.review
    : {};
  return arr(review.banners)
    .filter((banner) => str(banner?.state).toLowerCase() === 'blocked')
    .map((banner) => str(banner?.text))
    .filter(Boolean);
}

function commandStartEnd(command = {}) {
  const params = command?.params && typeof command.params === 'object' ? command.params : {};
  const anchor = command?.anchor && typeof command.anchor === 'object' ? command.anchor : {};
  const startMs = Number(params.startMs ?? anchor.startMs);
  const endMs = Number(params.endMs ?? anchor.endMs);
  return { startMs, endMs };
}

function commandAnchorTracks(command = {}) {
  const params = command?.params && typeof command.params === 'object' ? command.params : {};
  const anchor = command?.anchor && typeof command.anchor === 'object' ? command.anchor : {};
  return [
    str(params.timingTrackName),
    str(anchor.trackName)
  ].filter(Boolean);
}

function isWithinWindow({ startMs, endMs } = {}, scope = null) {
  if (!scope) return true;
  const scopeStart = Number(scope.startMs);
  const scopeEnd = Number(scope.endMs);
  return Number.isFinite(startMs)
    && Number.isFinite(endMs)
    && Number.isFinite(scopeStart)
    && Number.isFinite(scopeEnd)
    && startMs >= scopeStart
    && endMs <= scopeEnd;
}

function collectPlanTimingValidation(plan = {}, expectedTimingTracks = [], expectedAnchorTracks = [], { sectionScope = null, requireAnchorsInSection = false } = {}) {
  const commands = arr(plan?.commands);
  const createdTracks = new Set();
  const markedTracks = new Set();
  const anchoredTracks = new Set();
  const sectionScopeViolations = [];
  for (const command of commands) {
    const cmd = str(command?.cmd);
    const params = command?.params && typeof command.params === 'object' ? command.params : {};
    const trackName = str(params.trackName);
    if (cmd === 'timing.createTrack' && trackName) createdTracks.add(trackName);
    if ((cmd === 'timing.insertMarks' || cmd === 'timing.replaceMarks') && trackName && arr(params.marks).length) {
      markedTracks.add(trackName);
    }
    const alignTrackName = str(params.timingTrackName);
    if (cmd === 'effects.alignToTiming' && alignTrackName) anchoredTracks.add(alignTrackName);
    const anchor = command?.anchor && typeof command.anchor === 'object' ? command.anchor : {};
    const anchorTrackName = str(anchor.trackName);
    if (cmd === 'effects.create' && anchorTrackName) anchoredTracks.add(anchorTrackName);
  }
  const timingTracks = expectedTimingTracks.map((trackName) => str(trackName)).filter(Boolean);
  const anchorTracks = expectedAnchorTracks.map((trackName) => str(trackName)).filter(Boolean);
  if (requireAnchorsInSection && sectionScope && anchorTracks.length) {
    const expectedAnchorSet = new Set(anchorTracks);
    for (const command of commands) {
      const cmd = str(command?.cmd);
      if (cmd !== 'effects.create' && cmd !== 'effects.alignToTiming') continue;
      const tracks = commandAnchorTracks(command);
      if (!tracks.some((trackName) => expectedAnchorSet.has(trackName))) continue;
      const window = commandStartEnd(command);
      if (!isWithinWindow(window, sectionScope)) {
        sectionScopeViolations.push({
          id: str(command?.id),
          cmd,
          tracks,
          startMs: window.startMs,
          endMs: window.endMs,
          sectionLabel: str(sectionScope.sectionLabel),
          sectionStartMs: Number(sectionScope.startMs),
          sectionEndMs: Number(sectionScope.endMs)
        });
      }
    }
  }
  const missingCreatedTracks = timingTracks.filter((trackName) => !createdTracks.has(trackName));
  const missingMarkedTracks = timingTracks.filter((trackName) => !markedTracks.has(trackName));
  const missingAnchorTracks = anchorTracks.filter((trackName) => !anchoredTracks.has(trackName));
  return {
    expectedTimingTracks: timingTracks,
    expectedAnchorTracks: anchorTracks,
    createdTracks: Array.from(createdTracks).sort(),
    markedTracks: Array.from(markedTracks).sort(),
    anchoredTracks: Array.from(anchoredTracks).sort(),
    missingCreatedTracks,
    missingMarkedTracks,
    missingAnchorTracks,
    sectionScope: sectionScope || null,
    requireAnchorsInSection,
    sectionScopeViolations,
    ok: missingCreatedTracks.length === 0 && missingMarkedTracks.length === 0 && missingAnchorTracks.length === 0 && sectionScopeViolations.length === 0
  };
}

function assertPlanTimingValidation(snapshot = {}, expectedTimingTracks = [], expectedAnchorTracks = [], options = {}) {
  if (!expectedTimingTracks.length && !expectedAnchorTracks.length) return null;
  const plan = snapshot?.latestPlanHandoff && typeof snapshot.latestPlanHandoff === 'object'
    ? snapshot.latestPlanHandoff
    : null;
  if (!plan) {
    throw new Error(`Expected timing-track validation requires a latest plan handoff. expectedTimingTracks=${expectedTimingTracks.join(',')} expectedAnchorTracks=${expectedAnchorTracks.join(',')}`);
  }
  const validation = collectPlanTimingValidation(plan, expectedTimingTracks, expectedAnchorTracks, options);
  if (!validation.ok) {
    throw new Error(`Generated plan failed timing-track validation: ${JSON.stringify(validation)}`);
  }
  return validation;
}

async function assertExistingEffectPreservation({ snapshot = {}, seedExistingEffect = null } = {}) {
  if (!seedExistingEffect) return null;
  const plan = snapshot?.latestPlanHandoff && typeof snapshot.latestPlanHandoff === 'object'
    ? snapshot.latestPlanHandoff
    : null;
  const applyResult = snapshot?.latestApplyResult && typeof snapshot.latestApplyResult === 'object'
    ? snapshot.latestApplyResult
    : null;
  if (!plan) throw new Error('Expected preservation validation requires a latest plan handoff.');
  const movedCommands = arr(plan?.commands).filter((command) => {
    const params = command?.params && typeof command.params === 'object' ? command.params : {};
    const policy = command?.intent?.existingSequencePolicy && typeof command.intent.existingSequencePolicy === 'object'
      ? command.intent.existingSequencePolicy
      : null;
    return str(command?.cmd) === 'effects.create'
      && str(params.modelName) === str(seedExistingEffect.element)
      && policy
      && Number(policy.overlapCount || 0) > 0
      && policy.replacementAuthorized !== true
      && Number(policy.originalLayerIndex) === Number(seedExistingEffect.layer)
      && Number(policy.plannedLayerIndex) !== Number(policy.originalLayerIndex)
      && Number(params.layerIndex) === Number(policy.plannedLayerIndex);
  });
  if (!movedCommands.length) {
    throw new Error(`Expected generated plan to move overlapping effects above seeded layer ${seedExistingEffect.layer}.`);
  }

  const originalReadback = await requestXlightsApi('/effects/window', {
    element: seedExistingEffect.element,
    startMs: seedExistingEffect.startMs,
    endMs: seedExistingEffect.endMs
  });
  const originalEffects = normalizeEffects(originalReadback);
  const originalPreserved = originalEffects.some((row) =>
    row.layerIndex === Number(seedExistingEffect.layer) &&
    row.effectName === seedExistingEffect.effectName &&
    row.startMs === Number(seedExistingEffect.startMs) &&
    row.endMs === Number(seedExistingEffect.endMs)
  );
  if (!originalPreserved) {
    throw new Error(`Seeded original effect was not preserved after apply: ${JSON.stringify({ seedExistingEffect, originalEffects })}`);
  }

  const movedReadbacks = [];
  for (const command of movedCommands) {
    const params = command?.params && typeof command.params === 'object' ? command.params : {};
    const modelName = str(params.modelName);
    const layerIndex = Number(params.layerIndex);
    const startMs = Number(params.startMs);
    const endMs = Number(params.endMs);
    const effectName = str(params.effectName);
    const payload = await requestXlightsApi('/effects/window', {
      element: modelName,
      startMs,
      endMs
    });
    const effects = normalizeEffects(payload);
    const present = effects.some((row) =>
      row.layerIndex === layerIndex &&
      row.effectName === effectName &&
      row.startMs === startMs &&
      row.endMs === endMs
    );
    movedReadbacks.push({
      modelName,
      layerIndex,
      startMs,
      endMs,
      effectName,
      present
    });
  }
  const missingMoved = movedReadbacks.filter((row) => !row.present);
  if (missingMoved.length) {
    throw new Error(`Moved preservation effects were not readable after apply: ${JSON.stringify(missingMoved)}`);
  }

  const preservationChecks = applyResult?.practicalValidation?.summary?.preservationChecks
    || applyResult?.applyResult?.practicalValidation?.summary?.preservationChecks
    || null;
  return {
    ok: true,
    seed: seedExistingEffect,
    movedCommandCount: movedCommands.length,
    movedReadbacks,
    originalLayerPreserved: true,
    practicalValidationPreservationChecks: preservationChecks
  };
}

async function assertExistingEffectReplacement({ snapshot = {}, seedExistingEffect = null } = {}) {
  if (!seedExistingEffect) return null;
  const plan = snapshot?.latestPlanHandoff && typeof snapshot.latestPlanHandoff === 'object'
    ? snapshot.latestPlanHandoff
    : null;
  if (!plan) throw new Error('Expected replacement validation requires a latest plan handoff.');
  const replacementCommands = arr(plan?.commands).filter((command) => {
    const params = command?.params && typeof command.params === 'object' ? command.params : {};
    const policy = command?.intent?.existingSequencePolicy && typeof command.intent.existingSequencePolicy === 'object'
      ? command.intent.existingSequencePolicy
      : null;
    return str(command?.cmd) === 'effects.create'
      && str(params.modelName) === str(seedExistingEffect.element)
      && policy
      && Number(policy.overlapCount || 0) > 0
      && policy.replacementAuthorized === true
      && Number(policy.originalLayerIndex) === Number(seedExistingEffect.layer)
      && Number(policy.plannedLayerIndex) === Number(seedExistingEffect.layer)
      && Number(params.layerIndex) === Number(seedExistingEffect.layer);
  });
  if (!replacementCommands.length) {
    throw new Error(`Expected generated plan to authorize replacement on seeded layer ${seedExistingEffect.layer}.`);
  }

  const replacementReadbacks = [];
  for (const command of replacementCommands) {
    const params = command?.params && typeof command.params === 'object' ? command.params : {};
    const modelName = str(params.modelName);
    const layerIndex = Number(params.layerIndex);
    const startMs = Number(params.startMs);
    const endMs = Number(params.endMs);
    const effectName = str(params.effectName);
    const payload = await requestXlightsApi('/effects/window', {
      element: modelName,
      startMs,
      endMs
    });
    const effects = normalizeEffects(payload);
    const present = effects.some((row) =>
      row.layerIndex === layerIndex &&
      row.effectName === effectName &&
      row.startMs === startMs &&
      row.endMs === endMs
    );
    replacementReadbacks.push({
      modelName,
      layerIndex,
      startMs,
      endMs,
      effectName,
      present
    });
  }
  const missingReplacement = replacementReadbacks.filter((row) => !row.present);
  if (missingReplacement.length) {
    throw new Error(`Replacement overlap effects were not readable after apply: ${JSON.stringify(missingReplacement)}`);
  }

  return {
    ok: true,
    seed: seedExistingEffect,
    replacementCommandCount: replacementCommands.length,
    replacementReadbacks,
    replacementAuthorized: true,
    plannedLayerIndex: Number(seedExistingEffect.layer)
  };
}

async function waitForApplyResult({ previousArtifactId = '', expectedSequencePath = '', ignoredBlockedTexts = new Set(), timeoutMs = 120000 } = {}) {
  const start = Date.now();
  let lastSnapshot = null;
  while (Date.now() - start < timeoutMs) {
    lastSnapshot = await request('GET', '/sequencer-validation-snapshot');
    const latestApplyResult = lastSnapshot?.latestApplyResult && typeof lastSnapshot.latestApplyResult === 'object'
      ? lastSnapshot.latestApplyResult
      : null;
    const latestId = str(latestApplyResult?.artifactId);
    const latestRevisionText = [
      str(latestApplyResult?.nextRevision),
      str(latestApplyResult?.currentRevision),
      str(latestApplyResult?.renderCurrentSummary),
      str(latestApplyResult?.sequenceBackupPath)
    ].join('\n');
    const matchesExpectedSequence = !expectedSequencePath || latestRevisionText.includes(expectedSequencePath);
    const blockedBanner = blockedBannerTexts(lastSnapshot)
      .map((text) => ({ text }))
      .find((banner) => !ignoredBlockedTexts.has(str(banner.text)));
    if (blockedBanner) {
      throw new Error(`Review apply blocked: ${str(blockedBanner.text)}`);
    }
    if (latestApplyResult && latestId && matchesExpectedSequence && (latestId !== previousArtifactId || str(latestApplyResult?.status).toLowerCase() === 'applied')) {
      return { snapshot: lastSnapshot, applyResult: latestApplyResult };
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out waiting for review apply result. Last snapshot: ${JSON.stringify(lastSnapshot)}`);
}

async function applyReviewWithRetry({ previousArtifactId = '', expectedSequencePath = '', targetIds = [], selectedTags = [], selectedSections = [], tagOnly = false, timeoutMs = 120000 } = {}) {
  let lastAccepted = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const readySnapshot = await waitForReviewReady({ targetIds, selectedTags, selectedSections, tagOnly, timeoutMs: Math.min(timeoutMs, 30000) });
    const ignoredBlockedTexts = new Set(blockedBannerTexts(readySnapshot));
    lastAccepted = await request('POST', '/action', { action: 'applyReview' });
    try {
      return {
        accepted: lastAccepted,
        ...(await waitForApplyResult({ previousArtifactId, expectedSequencePath, ignoredBlockedTexts, timeoutMs }))
      };
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
  throw new Error(`Review apply did not produce a fresh apply result. Last accepted response: ${JSON.stringify(lastAccepted)}`);
}

const args = parseArgs(process.argv.slice(2));
const targetIds = splitList(args.targetIds);
const selectedTags = splitList(args.selectedTags);
const selectedSections = args.sectionLabel ? [args.sectionLabel] : [];
const expectedTimingTracks = splitList(args.expectedTimingTracks);
const expectedAnchorTracks = splitList(args.expectedAnchorTracks);

const health = await request('GET', '/health');
if (health?.ok === false) {
  throw new Error(`Native automation server is not ready: ${JSON.stringify(health)}`);
}

const sequenceContext = await ensureSequenceContext(args, targetIds, selectedTags);
const seededSectionTimingTrack = args.forceValidationSequence
  ? await seedValidationSectionTimingTrack({
      sectionLabel: args.sectionLabel,
      timingTrackName: args.timingTrackName,
      durationMs: args.durationMs
    })
  : null;
const seededExistingEffect = await seedExistingEffectForValidation({ targetIds, args });
const resolvedSectionScope = await resolveSectionTimingScope({
  sectionLabel: args.sectionLabel,
  timingTrackName: args.timingTrackName
});

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
    goal: args.intentGoal || (args.tagOnly
      ? `Validate metadata-selected sequencing for selected display metadata tags${args.sectionLabel ? ` in section ${args.sectionLabel}` : ''}.`
      : `Validate metadata-selected sequencing for ${targetIds.join(', ')}${args.sectionLabel ? ` in section ${args.sectionLabel}` : ''}.`),
    mood: 'focused validation',
    targetScope: args.tagOnly ? '' : targetIds.join(', '),
    constraints: [
      `Use selected display metadata tags: ${selectedTags.join(', ')}.`,
      args.sectionLabel ? `Limit timing scope to section label: ${args.sectionLabel}.` : ''
    ].filter(Boolean).join(' '),
    references: resolvedSectionScope ? `Timing track: ${resolvedSectionScope.trackName}.` : '',
    approvalNotes: 'Automation validation'
  }
});

const preGenerationSnapshot = await request('GET', '/sequencer-validation-snapshot');
const previousGenerationArtifactIds = new Set([
  str(preGenerationSnapshot?.latestProposalBundle?.artifactId),
  str(preGenerationSnapshot?.latestPlanHandoff?.artifactId)
].filter(Boolean));

const generationResult = await request('POST', '/action', {
  action: 'generateSequenceProposal',
  selectedTagNames: args.selectedTags,
  selectedSections: selectedSections.join(','),
  timingTrackName: str(resolvedSectionScope?.trackName || args.timingTrackName)
});
const generationBanner = generationResult?.banner && typeof generationResult.banner === 'object' ? generationResult.banner : null;
if (generationBanner && str(generationBanner.state).toLowerCase() === 'blocked') {
  throw new Error(`Generation blocked: ${str(generationBanner.text)}`);
}

const proposalValidation = await waitForProposal({
  targetIds,
  selectedTags,
  selectedSections,
  previousArtifactIds: previousGenerationArtifactIds,
  timeoutMs: args.timeoutMs
});
const validationSnapshot = proposalValidation.snapshot;
const matchedArtifacts = proposalValidation.matches;
const matchedProposalArtifactId = str(matchedArtifacts.find((artifact) => str(artifact?.artifactType || artifact?.bundleType) === 'proposal_bundle_v1')?.artifactId);
const matchedPlanArtifactId = str(matchedArtifacts.find((artifact) => str(artifact?.artifactType) === 'plan_handoff_v1')?.artifactId);
const reviewReadySnapshot = await waitForReviewReady({
  targetIds,
  selectedTags,
  selectedSections,
  tagOnly: args.tagOnly,
  timeoutMs: args.timeoutMs
});
let applyValidation = null;
let renderValidation = null;
let planTimingValidation = null;
let preservationValidation = null;
let replacementValidation = null;
if (args.applyReview) {
  const previousApplyId = str(reviewReadySnapshot?.latestApplyResult?.artifactId || validationSnapshot?.latestApplyResult?.artifactId);
  applyValidation = await applyReviewWithRetry({
    previousArtifactId: previousApplyId,
    expectedSequencePath: sequenceContext.sequencePath,
    targetIds,
    selectedTags,
    selectedSections,
    tagOnly: args.tagOnly,
    timeoutMs: Math.max(args.timeoutMs, 120000)
  });
  planTimingValidation = assertPlanTimingValidation(applyValidation?.snapshot, expectedTimingTracks, expectedAnchorTracks, {
    sectionScope: resolvedSectionScope,
    requireAnchorsInSection: args.requireAnchorsInSection
  });
  if (args.expectReplacementOverlap) {
    replacementValidation = await assertExistingEffectReplacement({
      snapshot: applyValidation?.snapshot,
      seedExistingEffect: seededExistingEffect
    });
  } else {
    preservationValidation = await assertExistingEffectPreservation({
      snapshot: applyValidation?.snapshot,
      seedExistingEffect: seededExistingEffect
    });
  }
  if (args.renderAfterApply) {
    renderValidation = await request('POST', '/action', { action: 'renderXLightsSequence' });
  }
} else {
  planTimingValidation = assertPlanTimingValidation(validationSnapshot, expectedTimingTracks, expectedAnchorTracks, {
    sectionScope: resolvedSectionScope,
    requireAnchorsInSection: args.requireAnchorsInSection
  });
}

process.stdout.write(`${JSON.stringify({
  ok: true,
  baseUrl: BASE_URL,
  updateAccepted: updateResult?.ok === true,
  generationAccepted: generationResult?.ok === true,
  tagOnly: args.tagOnly,
  targetIds,
  selectedTags,
  selectedSections,
  expectedTimingTracks,
  expectedAnchorTracks,
  requireAnchorsInSection: args.requireAnchorsInSection,
  planTimingValidation,
  preservationValidation,
  replacementValidation,
  resolvedSectionScope,
  seededSectionTimingTrack,
  seededExistingEffect,
  sequenceContext,
  latestProposalArtifactId: matchedProposalArtifactId,
  latestPlanArtifactId: str(applyValidation?.applyResult?.planId || matchedPlanArtifactId),
  latestIntentArtifactId: str(validationSnapshot?.latestIntentHandoff?.artifactId),
  latestApplyArtifactId: str(applyValidation?.applyResult?.artifactId),
  latestApplyStatus: str(applyValidation?.applyResult?.status),
  metadataAssignmentCount: Number((applyValidation?.applyResult ?? validationSnapshot?.latestApplyResult)?.metadataAssignmentCount || 0),
  renderSummary: str(renderValidation?.summary)
}, null, 2)}\n`);
