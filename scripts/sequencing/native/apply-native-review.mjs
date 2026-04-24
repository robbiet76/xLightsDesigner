#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getOpenSequence,
  getSequenceSettings,
  getDisplayElements,
  getModels,
  getEffectDefinitions,
  getRenderedSequenceSamples,
  getRevision,
  getOwnedHealth,
  getOwnedJob,
  getOwnedSequenceRevision,
  applySequencingBatchPlan,
  openSequence,
  renderCurrentSequence
} from '../../../apps/xlightsdesigner-ui/api.js';
import { buildAnalysisHandoffFromArtifact } from '../../../apps/xlightsdesigner-ui/agent/audio-analyst/audio-analyst-runtime.js';
import { buildEffectDefinitionCatalog } from '../../../apps/xlightsdesigner-ui/agent/sequence-agent/effect-definition-catalog.js';
import { STAGE1_TRAINED_EFFECT_BUNDLE } from '../../../apps/xlightsdesigner-ui/agent/sequence-agent/generated/stage1-trained-effect-bundle.js';
import { buildSequenceAgentPlan } from '../../../apps/xlightsdesigner-ui/agent/sequence-agent/sequence-agent.js';
import { buildSequenceAgentApplyResult } from '../../../apps/xlightsdesigner-ui/agent/sequence-agent/sequence-agent-runtime.js';
import { buildDesignSceneContext } from '../../../apps/xlightsdesigner-ui/agent/designer-dialog/design-scene-context.js';
import { buildRenderCritiqueContext } from '../../../apps/xlightsdesigner-ui/agent/sequence-agent/render-critique-context.js';
import { buildArtifactRefs, buildHistoryEntry, buildHistorySnapshotSummary } from '../../../apps/xlightsdesigner-ui/agent/shared/history-entry.js';
import { buildRenderObservationFromSamples, buildRenderSamplingPlan } from '../../../apps/xlightsdesigner-ui/runtime/render-observation-runtime.js';
import { buildOwnedSequencingBatchPlan, validateAndApplyPlan } from '../../../apps/xlightsdesigner-ui/agent/sequence-agent/orchestrator.js';
import { writeProjectArtifacts } from '../../../apps/xlightsdesigner-ui/storage/project-artifact-store.mjs';

const DEFAULT_APP_ROOT = path.join(os.homedir(), 'Documents', 'Lights', 'xLightsDesigner');
const DEFAULT_ENDPOINT = 'http://127.0.0.1:49915/xlightsdesigner/api';
const APPLY_TIMEOUT_MS = 30000;
let currentStage = 'startup';

function str(value = '') {
  return String(value || '').trim();
}

function parseArgs(argv = []) {
  const out = {
    projectFile: '',
    appRoot: DEFAULT_APP_ROOT,
    endpoint: DEFAULT_ENDPOINT
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = str(argv[i]);
    if (token === '--project-file') out.projectFile = path.resolve(str(argv[++i] || out.projectFile));
    else if (token === '--app-root') out.appRoot = path.resolve(str(argv[++i] || out.appRoot));
    else if (token === '--endpoint') out.endpoint = str(argv[++i] || out.endpoint);
    else throw new Error(`Unknown argument: ${token}`);
  }
  if (!out.projectFile) throw new Error('--project-file is required');
  return out;
}

function readJson(filePath = '') {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function latestJsonFile(dirPath = '') {
  if (!fs.existsSync(dirPath)) return '';
  const files = fs.readdirSync(dirPath)
    .filter((name) => name.endsWith('.json'))
    .map((name) => path.join(dirPath, name))
    .sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs);
  return files.at(-1) || '';
}

function normalizePath(value = '') {
  const text = str(value);
  if (!text) return '';
  return path.resolve(text);
}

function basenameLower(filePath = '') {
  return path.basename(str(filePath)).toLowerCase();
}

function safeTimestamp(value = new Date()) {
  return value.toISOString().replace(/[:.]/g, '-');
}

export function createSequenceBackup({ projectFile = '', sequencePath = '', revision = '' } = {}) {
  const sourcePath = normalizePath(sequencePath);
  if (!sourcePath) throw new Error('Cannot create apply backup without a sequence path.');
  if (!fs.existsSync(sourcePath)) throw new Error(`Cannot create apply backup because sequence file was not found: ${sourcePath}`);
  const projectDir = path.dirname(normalizePath(projectFile));
  const backupDir = path.join(projectDir, 'artifacts', 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const parsed = path.parse(sourcePath);
  const revisionPart = str(revision).replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 80) || 'unknown-revision';
  const backupPath = path.join(backupDir, `${parsed.name}-preapply-${safeTimestamp()}-${revisionPart}${parsed.ext || '.xsq'}`);
  fs.copyFileSync(sourcePath, backupPath);
  return backupPath;
}

export function renderCurrentSummary(renderResponse = null) {
  const data = renderResponse?.data && typeof renderResponse.data === 'object' ? renderResponse.data : {};
  const sequence = data.sequence && typeof data.sequence === 'object' ? data.sequence : {};
  const sequencePath = str(sequence.path || data.sequencePath);
  if (sequencePath) return `Rendered xLights sequence: ${sequencePath}`;
  return data.rendered ? 'Rendered current xLights sequence.' : '';
}

async function renderCurrentForFeedback(endpoint = '') {
  try {
    currentStage = 'render_current_sequence';
    const response = await renderCurrentSequence(endpoint);
    return { summary: renderCurrentSummary(response), error: '' };
  } catch (error) {
    return { summary: '', error: str(error?.message || error) };
  }
}

function loadTrackRecordForAudio({ appRoot = '', audioPath = '' } = {}) {
  const libraryDir = path.join(appRoot, 'library', 'tracks');
  if (!fs.existsSync(libraryDir)) throw new Error(`Track library not found: ${libraryDir}`);
  const targetPath = str(audioPath);
  const targetBase = basenameLower(targetPath);
  const files = fs.readdirSync(libraryDir).filter((name) => name.endsWith('.json')).sort();
  let basenameMatch = null;
  for (const fileName of files) {
    const filePath = path.join(libraryDir, fileName);
    const record = readJson(filePath);
    const sourcePath = str(record?.track?.sourceMedia?.path);
    if (sourcePath && sourcePath === targetPath) {
      return { record, recordPath: filePath };
    }
    if (!basenameMatch && sourcePath && basenameLower(sourcePath) === targetBase) {
      basenameMatch = { record, recordPath: filePath };
    }
  }
  if (basenameMatch) return basenameMatch;
  throw new Error(`No shared track metadata found for audio file: ${targetPath}`);
}

function loadReviewInputs({ projectFile = '', appRoot = '' } = {}) {
  const projectDoc = readJson(projectFile);
  const snapshot = projectDoc?.snapshot && typeof projectDoc.snapshot === 'object' ? projectDoc.snapshot : {};
  const projectDir = path.dirname(projectFile);
  const artifactsDir = path.join(projectDir, 'artifacts');
  const intentPath = latestJsonFile(path.join(artifactsDir, 'intent-handoffs'));
  const proposalPath = latestJsonFile(path.join(artifactsDir, 'proposals'));
  if (!intentPath) throw new Error(`No intent handoff found for project: ${projectDoc?.projectName || projectFile}`);
  if (!proposalPath) throw new Error(`No proposal bundle found for project: ${projectDoc?.projectName || projectFile}`);

  const intentHandoff = readJson(intentPath);
  const proposalBundle = readJson(proposalPath);
  const audioPath = str(snapshot.audioPathInput);
  const sequencePath = str(snapshot.sequencePathInput || snapshot.savePathInput);
  if (!audioPath) throw new Error('Project snapshot is missing audioPathInput.');
  if (!sequencePath) throw new Error('Project snapshot is missing sequencePathInput.');

  const { record: trackRecord, recordPath } = loadTrackRecordForAudio({ appRoot, audioPath });
  const persistedArtifact = trackRecord?.analyses?.profiles?.deep || trackRecord?.analyses?.profiles?.fast || null;
  if (!persistedArtifact || typeof persistedArtifact !== 'object') {
    throw new Error(`Shared track record has no persisted analysis artifact: ${recordPath}`);
  }

  return {
    projectDoc,
    snapshot,
    intentHandoff,
    reviewIntentHandoff: buildReviewIntentHandoff(intentHandoff, proposalBundle),
    proposalBundle,
    trackRecord,
    persistedArtifact,
    audioPath,
    sequencePath,
    recordPath
  };
}

function buildReviewIntentHandoff(latestIntent = {}, proposalBundle = {}) {
  const proposalScope = proposalBundle?.scope && typeof proposalBundle.scope === 'object' ? proposalBundle.scope : {};
  const proposalExecution = proposalBundle?.executionPlan && typeof proposalBundle.executionPlan === 'object' ? proposalBundle.executionPlan : {};
  const latestConstraints = latestIntent?.constraints && typeof latestIntent.constraints === 'object' ? latestIntent.constraints : {};
  const latestDirectorPreferences = latestIntent?.directorPreferences && typeof latestIntent.directorPreferences === 'object' ? latestIntent.directorPreferences : {};
  return {
    artifactType: 'intent_handoff_v1',
    artifactVersion: '1.0',
    createdAt: str(proposalBundle?.createdAt || latestIntent?.createdAt || new Date().toISOString()),
    goal: str(proposalBundle?.summary || latestIntent?.goal),
    mode: 'revise',
    scope: {
      targetIds: Array.isArray(proposalScope?.targetIds) ? proposalScope.targetIds : [],
      tagNames: Array.isArray(proposalScope?.tagNames) ? proposalScope.tagNames : [],
      sections: Array.isArray(proposalScope?.sections) ? proposalScope.sections : [],
      timeRangeMs: null
    },
    constraints: Object.keys(proposalBundle?.constraints || {}).length ? proposalBundle.constraints : latestConstraints,
    directorPreferences: {
      styleDirection: str(latestDirectorPreferences?.styleDirection),
      energyArc: str(latestDirectorPreferences?.energyArc),
      focusElements: Array.isArray(latestDirectorPreferences?.focusElements)
        ? latestDirectorPreferences.focusElements
        : (Array.isArray(proposalScope?.targetIds) ? proposalScope.targetIds : []),
      colorDirection: str(latestDirectorPreferences?.colorDirection)
    },
    executionStrategy: proposalExecution,
    approvalPolicy: {
      requiresExplicitApprove: true,
      elevatedRiskConfirmed: false
    }
  };
}

async function ensureExpectedSequenceOpen(endpoint = '', sequencePath = '') {
  const open = await getOpenSequence(endpoint).catch(() => null);
  const currentPath = str(open?.data?.sequence?.path || open?.data?.sequencePath || '');
  if (currentPath && path.resolve(currentPath) === path.resolve(sequencePath)) {
    return { opened: false, currentPath };
  }
  const opened = await openSequence(endpoint, sequencePath, true, false);
  const openedPath = str(opened?.data?.sequence?.path || currentPath || sequencePath);
  return { opened: true, currentPath: openedPath };
}

function normalizeDisplayElements(res = {}) {
  const elements = Array.isArray(res?.data?.elements) ? res.data.elements : [];
  return elements.map((row) => {
    if (typeof row === 'string') return { id: row, name: row };
    const name = str(row?.name || row?.id);
    return { ...row, id: str(row?.id || name), name };
  }).filter((row) => row.id || row.name);
}

function trainedEffectDefinitions() {
  const effectsByName = STAGE1_TRAINED_EFFECT_BUNDLE?.effectsByName && typeof STAGE1_TRAINED_EFFECT_BUNDLE.effectsByName === 'object'
    ? STAGE1_TRAINED_EFFECT_BUNDLE.effectsByName
    : {};
  return Object.values(effectsByName)
    .map((row) => ({ effectName: str(row?.effectName), params: [] }))
    .filter((row) => row.effectName);
}

async function loadEffectCatalog(endpoint = '') {
  const effectsRes = await getEffectDefinitions(endpoint).catch(() => ({ ok: false, data: { effects: [] } }));
  const effectDefinitions = Array.isArray(effectsRes?.data?.effects) ? effectsRes.data.effects : [];
  const definitions = effectDefinitions.length ? effectDefinitions : trainedEffectDefinitions();
  return buildEffectDefinitionCatalog(definitions, {
    source: effectDefinitions.length ? 'xlights_effect_definitions' : 'stage1_trained_effect_bundle',
    loadedAt: new Date().toISOString()
  });
}

async function applyReview({ projectFile = '', appRoot = '', endpoint = '' } = {}) {
  currentStage = 'load_inputs';
  const inputs = loadReviewInputs({ projectFile, appRoot });
  currentStage = 'validate_timing';
  validateProposalPlacementTiming({
    proposalBundle: inputs.proposalBundle,
    trackRecord: inputs.trackRecord,
    placements: scopedProposalPlacements(inputs.proposalBundle)
  });
  currentStage = 'build_analysis_handoff';
  const analysisHandoff = buildAnalysisHandoffFromArtifact(persistedArtifactWithFallback(inputs.persistedArtifact), null);
  currentStage = 'ensure_open_sequence';
  await ensureExpectedSequenceOpen(endpoint, inputs.sequencePath);
  currentStage = 'load_sequence_context';
  const [sequenceSettingsRes, displayElementsRes, revisionRes, effectCatalog] = await Promise.all([
    getSequenceSettings(endpoint),
    getDisplayElements(endpoint),
    getRevision(endpoint),
    loadEffectCatalog(endpoint)
  ]);

  currentStage = 'build_sequence_plan';
  const commandsPlan = buildSequenceAgentPlan({
    analysisHandoff,
    intentHandoff: inputs.reviewIntentHandoff,
    sourceLines: Array.isArray(inputs.proposalBundle?.proposalLines) ? inputs.proposalBundle.proposalLines : [],
    baseRevision: str(revisionRes?.data?.revision || 'unknown'),
    capabilityCommands: [],
    effectCatalog,
    sequenceSettings: sequenceSettingsRes?.data || {},
    layoutMode: '2d',
    displayElements: normalizeDisplayElements(displayElementsRes),
    groupIds: [],
    groupsById: {},
    submodelsById: {},
    metadataAssignments: [],
    timingOwnership: [],
    allowTimingWrites: true
  });
  commandsPlan.artifactType = 'plan_handoff_v1';

  const commands = normalizeCommandsForNativeApply(commandsPlan?.commands || []);
  if (!commands.length) {
    throw new Error('Sequence agent generated no commands for apply.');
  }

  currentStage = 'create_apply_backup';
  const sequenceBackupPath = createSequenceBackup({
    projectFile,
    sequencePath: inputs.sequencePath,
    revision: str(revisionRes?.data?.revision || 'unknown')
  });

  currentStage = 'validate_and_apply_plan';
  const applyRes = await validateAndApplyPlan({
    endpoint,
    commands,
    expectedRevision: str(revisionRes?.data?.revision || 'unknown'),
    applySequencingBatchPlan,
    getOwnedJob,
    getOwnedHealth,
    getOwnedRevision: getOwnedSequenceRevision,
    safetyOptions: { maxCommands: 200 }
  });

  if (!applyRes?.ok) {
    currentStage = 'fallback_apply_path';
    const fallback = await applyExecutionStrategyFallback({
      proposalBundle: inputs.proposalBundle,
      trackRecord: inputs.trackRecord,
      endpoint,
      initialError: applyRes
    });
    const applyResult = buildSequenceAgentApplyResult({
      planId: str(commandsPlan?.artifactId),
      status: 'applied',
      failureReason: null,
      currentRevision: str(revisionRes?.data?.revision || 'unknown'),
      nextRevision: str(fallback.nextRevision)
    });
    applyResult.sequenceBackupPath = sequenceBackupPath;
    const renderCurrent = await renderCurrentForFeedback(endpoint);
    applyResult.renderCurrentSummary = renderCurrent.summary;
    applyResult.renderCurrentError = renderCurrent.error;
    const renderArtifacts = await buildNativeRenderFeedbackArtifacts({
      endpoint,
      showDir: str(inputs.projectDoc?.showFolder || ''),
      sequencePath: inputs.sequencePath,
      revisionToken: str(fallback.nextRevision),
      analysisHandoff,
      intentHandoff: inputs.intentHandoff
    });
    const renderFeedbackCapabilities = await probeOwnedRenderFeedbackCapabilities(endpoint);
    await persistNativeReviewArtifacts({
      projectFile,
      projectDoc: inputs.projectDoc,
      intentHandoff: inputs.intentHandoff,
      proposalBundle: inputs.proposalBundle,
      planHandoff: commandsPlan,
      applyResult,
      renderObservation: renderArtifacts.renderObservation,
      renderCritiqueContext: renderArtifacts.renderCritiqueContext
    });
    return {
      ok: true,
      projectName: str(inputs.projectDoc?.projectName),
      sequencePath: inputs.sequencePath,
      audioPath: inputs.audioPath,
      trackDisplayName: str(inputs.trackRecord?.track?.displayName),
      contentFingerprint: str(inputs.trackRecord?.track?.identity?.contentFingerprint),
      commandCount: fallback.commandCount,
      nextRevision: fallback.nextRevision,
      sequenceBackupPath,
      applyPath: fallback.applyPath,
      renderCurrentSummary: renderCurrent.summary,
      renderCurrentError: renderCurrent.error,
      summary: fallback.summary,
      applyResultId: str(applyResult?.artifactId),
      renderFeedbackCaptured: Boolean(renderArtifacts.renderObservation && renderArtifacts.renderCritiqueContext),
      renderFeedbackStatus: renderCurrent.error
        ? 'render_current_failed'
        : renderFeedbackCapabilities.fullFeedbackReady
        ? (renderArtifacts.renderObservation && renderArtifacts.renderCritiqueContext ? 'captured' : 'apply_completed_without_artifacts')
        : 'owned_routes_unavailable',
      renderFeedbackMissingRequirements: Array.isArray(renderFeedbackCapabilities.missingRequirements)
        ? renderFeedbackCapabilities.missingRequirements
        : []
    };
  }

  const applyResult = buildSequenceAgentApplyResult({
    planId: str(commandsPlan?.artifactId),
    status: 'applied',
    failureReason: null,
    currentRevision: str(revisionRes?.data?.revision || 'unknown'),
    nextRevision: str(applyRes?.nextRevision || '')
  });
  applyResult.sequenceBackupPath = sequenceBackupPath;
  const renderCurrent = await renderCurrentForFeedback(endpoint);
  applyResult.renderCurrentSummary = renderCurrent.summary;
  applyResult.renderCurrentError = renderCurrent.error;
  const renderArtifacts = await buildNativeRenderFeedbackArtifacts({
    endpoint,
    showDir: str(inputs.projectDoc?.showFolder || ''),
    sequencePath: inputs.sequencePath,
    revisionToken: str(applyRes?.nextRevision || ''),
    analysisHandoff,
    intentHandoff: inputs.intentHandoff
  });
  const renderFeedbackCapabilities = await probeOwnedRenderFeedbackCapabilities(endpoint);
  await persistNativeReviewArtifacts({
    projectFile,
    projectDoc: inputs.projectDoc,
    intentHandoff: inputs.intentHandoff,
    proposalBundle: inputs.proposalBundle,
    planHandoff: commandsPlan,
    applyResult,
    renderObservation: renderArtifacts.renderObservation,
    renderCritiqueContext: renderArtifacts.renderCritiqueContext
  });
  return {
    ok: true,
    projectName: str(inputs.projectDoc?.projectName),
    sequencePath: inputs.sequencePath,
    audioPath: inputs.audioPath,
    trackDisplayName: str(inputs.trackRecord?.track?.displayName),
    contentFingerprint: str(inputs.trackRecord?.track?.identity?.contentFingerprint),
    commandCount: commands.length,
    nextRevision: str(applyRes?.nextRevision || ''),
    sequenceBackupPath,
    applyPath: str(applyRes?.applyPath || ''),
    renderCurrentSummary: renderCurrent.summary,
    renderCurrentError: renderCurrent.error,
    summary: str(commandsPlan?.summary || inputs.proposalBundle?.summary || 'Applied pending work.'),
    applyResultId: str(applyResult?.artifactId),
    renderFeedbackCaptured: Boolean(renderArtifacts.renderObservation && renderArtifacts.renderCritiqueContext),
    renderFeedbackStatus: renderCurrent.error
      ? 'render_current_failed'
      : renderFeedbackCapabilities.fullFeedbackReady
      ? (renderArtifacts.renderObservation && renderArtifacts.renderCritiqueContext ? 'captured' : 'apply_completed_without_artifacts')
      : 'owned_routes_unavailable',
    renderFeedbackMissingRequirements: Array.isArray(renderFeedbackCapabilities.missingRequirements)
      ? renderFeedbackCapabilities.missingRequirements
      : []
  };
}

async function persistNativeReviewArtifacts({
  projectFile = '',
  projectDoc = {},
  intentHandoff = null,
  proposalBundle = null,
  planHandoff = null,
  applyResult = null,
  renderObservation = null,
  renderCritiqueContext = null
} = {}) {
  currentStage = 'persist_apply_artifacts';
  const historyEntry = buildHistoryEntry({
    projectId: str(projectDoc?.projectId || projectDoc?.projectName || null),
    projectKey: str(projectDoc?.projectName || null),
    sequencePath: str(projectDoc?.snapshot?.sequencePathInput || ''),
    xlightsRevisionBefore: str(applyResult?.currentRevision || null),
    xlightsRevisionAfter: str(applyResult?.nextRevision || null),
    status: str(applyResult?.status || 'applied'),
    summary: str(planHandoff?.summary || proposalBundle?.summary || 'Applied pending work.'),
    artifactRefs: buildArtifactRefs({
      proposalBundle,
      intentHandoff,
      planHandoff,
      applyResult,
      renderObservation,
      renderCritiqueContext
    }),
    snapshotSummary: buildHistorySnapshotSummary({
      proposalBundle,
      creativeBrief: null,
      planHandoff,
      applyResult
    }),
    applyStage: 'native_review_apply',
    commandCount: Array.isArray(planHandoff?.commands) ? planHandoff.commands.length : 0,
    impactCount: Number.isFinite(planHandoff?.estimatedImpact) ? Number(planHandoff.estimatedImpact) : 0,
    verification: applyResult?.verification || null
  });
  const artifacts = [
    intentHandoff && typeof intentHandoff === 'object'
      ? { ...intentHandoff, artifactType: 'intent_handoff_v1' }
      : null,
    planHandoff && typeof planHandoff === 'object' ? planHandoff : null,
    applyResult && typeof applyResult === 'object'
      ? { ...applyResult, artifactType: 'apply_result_v1' }
      : null,
    renderObservation && typeof renderObservation === 'object' ? renderObservation : null,
    renderCritiqueContext && typeof renderCritiqueContext === 'object' ? renderCritiqueContext : null,
    { ...historyEntry, artifactId: str(historyEntry?.historyEntryId) }
  ].filter(Boolean);
  const writeRes = writeProjectArtifacts({
    projectFilePath: projectFile,
    artifacts
  });
  if (!writeRes?.ok) {
    throw new Error(`Failed to persist native review artifacts: ${str(writeRes?.error || writeRes?.reason || 'unknown')}`);
  }
}

async function buildNativeRenderFeedbackArtifacts({
  endpoint = '',
  showDir = '',
  sequencePath = '',
  revisionToken = '',
  analysisHandoff = null,
  intentHandoff = null
} = {}) {
  try {
    currentStage = 'build_render_feedback';
    const sceneGraph = await buildNativeSceneGraph({ endpoint, showDir });
    const targetIds = Array.isArray(intentHandoff?.scope?.targetIds)
      ? intentHandoff.scope.targetIds.map((row) => str(row)).filter(Boolean)
      : [];
    const samplingPlan = buildRenderSamplingPlan(sceneGraph, { targetIds });
    if (!samplingPlan?.modelCount || !Array.isArray(samplingPlan?.channelRanges) || !samplingPlan.channelRanges.length) {
      return { renderObservation: null, renderCritiqueContext: null };
    }

    const windows = buildSamplingWindows({ analysisHandoff, intentHandoff });
    const sampleResponses = [];
    for (const window of windows) {
      const response = await getRenderedSequenceSamples(endpoint, {
        startMs: window.startMs,
        endMs: window.endMs,
        maxFrames: window.maxFrames,
        channelRanges: samplingPlan.channelRanges
      });
      sampleResponses.push({
        ...response,
        label: window.label,
        reviewLevel: window.reviewLevel,
        sampleDetail: window.sampleDetail,
        sourceWindow: {
          startMs: window.sourceStartMs,
          endMs: window.sourceEndMs
        }
      });
    }

    const renderObservation = buildRenderObservationFromSamples({
      samplingPlan,
      sampleResponses,
      sequencePath,
      revisionToken
    });
    if (!renderObservation) {
      return { renderObservation: null, renderCritiqueContext: null };
    }

    const designSceneContext = buildDesignSceneContext({
      sceneGraph,
      revision: revisionToken || 'native_apply'
    });
    const renderCritiqueContext = buildRenderCritiqueContext({
      renderObservation,
      designSceneContext,
      sequencingDesignHandoff: null,
      musicDesignContext: null
    });
    return { renderObservation, renderCritiqueContext };
  } catch {
    return { renderObservation: null, renderCritiqueContext: null };
  }
}

async function probeOwnedRenderFeedbackCapabilities(endpoint = '') {
  const [layoutModels, layoutScene, renderSamples] = await Promise.all([
    probeOwnedRoute(endpoint, '/layout/models'),
    probeOwnedRoute(endpoint, '/layout/scene'),
    probeOwnedRoute(endpoint, '/sequence/render-samples', {
      method: 'POST',
      body: {
        startMs: 0,
        endMs: 25,
        maxFrames: 1,
        channelRanges: [
          {
            startChannel: 1,
            channelCount: 1
          }
        ]
      }
    })
  ]);
  return {
    fullFeedbackReady: Boolean(layoutModels.available && layoutScene.available && renderSamples.available),
    missingRequirements: [
      layoutModels.available ? '' : 'layout.models',
      layoutScene.available ? '' : 'layout.scene',
      renderSamples.available ? '' : 'sequence.render-samples'
    ].filter(Boolean),
    layoutModels,
    layoutScene,
    renderSamples
  };
}

async function probeOwnedRoute(endpoint = '', routePath = '', { method = 'GET', body = null } = {}) {
  try {
    const target = `${String(endpoint || '').replace(/\/+$/, '')}${routePath}`;
    const response = await fetch(target, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    const text = await response.text();
    let parsed = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = {};
    }
    return {
      available: response.status !== 404,
      statusCode: response.status,
      ok: parsed?.ok === true,
      errorCode: str(parsed?.error?.code),
      message: str(parsed?.error?.message)
    };
  } catch (err) {
    return {
      available: false,
      statusCode: 0,
      ok: false,
      errorCode: 'REQUEST_FAILED',
      message: str(err?.message || err)
    };
  }
}

async function buildNativeSceneGraph({ endpoint = '' } = {}) {
  const modelRes = await getModels(endpoint);
  const sceneModels = Array.isArray(modelRes?.data?.models) ? modelRes.data.models : [];
  const modelsById = {};

  for (const row of sceneModels) {
    const id = str(row?.id || row?.name);
    if (!id) continue;
    const typeText = str(row?.displayAs || row?.type || 'Model');
    const lowerType = typeText.toLowerCase();
    const isGroup = lowerType === 'modelgroup' || lowerType === 'group';
    const position = {
      x: toFiniteNumber(row?.positionX),
      y: toFiniteNumber(row?.positionY),
      z: toFiniteNumber(row?.positionZ)
    };
    const startChannel = toFiniteNumber(row?.startChannel);
    const endChannel = toFiniteNumber(row?.endChannel);
    const syntheticNodeCount = Math.max(1, Math.min(50, Number(row?.nodeCount || 1)));
    const nodes = Array.from({ length: syntheticNodeCount }, (_, index) => ({
      id: `${id}:${index}`,
      coords: {
        world: position,
        buffer: null
      }
    }));
    const item = {
      id,
      name: str(row?.name || id),
      type: isGroup ? 'group' : 'model',
      typeCategory: str(typeText || 'unknown'),
      startChannel,
      endChannel,
      transform: {
        position
      },
      nodes
    };
    if (!isGroup) {
      modelsById[id] = item;
    }
  }

  return {
    loaded: true,
    source: 'layout.getModels',
    loadedAt: new Date().toISOString(),
    modelsById,
    groupsById: {},
    submodelsById: {},
    stats: {
      modelCount: Object.keys(modelsById).length,
      groupCount: 0,
      submodelCount: 0,
      layoutMode: '2d'
    }
  };
}

function buildSamplingWindows({ analysisHandoff = null, intentHandoff = null } = {}) {
  const structureSections = Array.isArray(analysisHandoff?.structure?.sections) ? analysisHandoff.structure.sections : [];
  const requestedSections = new Set(
    (Array.isArray(intentHandoff?.scope?.sections) ? intentHandoff.scope.sections : [])
      .map((row) => str(row).toLowerCase())
      .filter(Boolean)
  );
  const matched = structureSections
    .map((row, index) => ({
      label: str(typeof row === 'string' ? row : row?.label || row?.name || `window_${index + 1}`),
      startMs: Number(row?.startMs || 0),
      endMs: Number(row?.endMs || 0)
    }))
    .filter((row) => row.label && Number.isFinite(row.startMs) && Number.isFinite(row.endMs) && row.endMs > row.startMs)
    .filter((row) => !requestedSections.size || requestedSections.has(row.label.toLowerCase()));

  const rows = matched.length
    ? matched
    : [{
        label: 'full_sequence_scope',
        startMs: 0,
        endMs: Number(analysisHandoff?.track?.durationMs || analysisHandoff?.media?.durationMs || 1000)
      }];

  return rows.slice(0, 6).map((row) => ({
    ...row,
    maxFrames: 5,
    reviewLevel: requestedSections.size ? 'section' : 'macro',
    sampleDetail: requestedSections.size ? 'section' : 'macro',
    sourceStartMs: row.startMs,
    sourceEndMs: row.endMs
  }));
}

function toFiniteNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeCommandsForNativeApply(commands = []) {
  const rows = Array.isArray(commands) ? commands : [];
  const filtered = rows.filter((row) => str(row?.cmd) !== 'sequencer.setDisplayElementOrder');
  const validIds = new Set(filtered.map((row) => str(row?.id)).filter(Boolean));
  return filtered.map((row) => {
    const dependsOn = Array.isArray(row?.dependsOn)
      ? row.dependsOn.map((value) => str(value)).filter((value) => validIds.has(value))
      : [];
    return dependsOn.length ? { ...row, dependsOn } : { ...row, dependsOn: undefined };
  });
}

async function applyExecutionStrategyFallback({ proposalBundle = {}, trackRecord = {}, endpoint = '', initialError = null } = {}) {
  const commands = buildFallbackCommandsFromProposal({ proposalBundle, trackRecord });
  const payload = buildOwnedSequencingBatchPlan(commands);
  if (!payload) {
    throw new Error(str(initialError?.error || 'Apply failed and fallback payload could not be built.'));
  }
  const accepted = await applySequencingBatchPlan(endpoint, payload);
  const jobId = str(accepted?.data?.jobId);
  if (!jobId) {
    throw new Error('Owned batch-plan fallback returned no jobId.');
  }
  const settled = await waitForOwnedJob(endpoint, jobId);
  const state = str(settled?.data?.state).toLowerCase();
  if (state === 'failed' || settled?.data?.result?.ok !== true) {
    const resultError = settled?.data?.result?.error?.message;
    throw new Error(str(resultError || initialError?.error || 'Fallback batch apply failed.'));
  }
  const postRevision = await getOwnedSequenceRevision(endpoint).catch(() => ({ data: { revision: '' } }));
  return {
    commandCount: commands.length,
    nextRevision: str(postRevision?.data?.revision || postRevision?.data?.revisionToken || ''),
    applyPath: 'owned_batch_plan_fallback',
    summary: str(proposalBundle?.summary || 'Applied pending work via proposal execution fallback.')
  };
}

function buildFallbackCommandsFromProposal({ proposalBundle = {}, trackRecord = {} } = {}) {
  const structureTrack = Array.isArray(trackRecord?.timingTracks)
    ? trackRecord.timingTracks.find((row) => str(row?.name) === 'XD: Song Structure')
    : null;
  const marks = Array.isArray(structureTrack?.segments)
    ? structureTrack.segments.map((row) => ({
        startMs: Number(row?.startMs || 0),
        endMs: Number(row?.endMs || 0),
        label: str(row?.label || 'Section')
      })).filter((row) => Number.isFinite(row.startMs) && Number.isFinite(row.endMs) && row.endMs >= row.startMs)
    : [];
  const placements = scopedProposalPlacements(proposalBundle);
  const commands = [
    {
      id: 'timing.track.create:xd-song-structure',
      cmd: 'timing.createTrack',
      params: { trackName: 'XD: Song Structure', replaceIfExists: true }
    },
    {
      id: 'timing.marks.insert:xd-song-structure',
      dependsOn: ['timing.track.create:xd-song-structure'],
      cmd: 'timing.insertMarks',
      params: { trackName: 'XD: Song Structure', marks }
    }
  ];
  let placementIndex = 0;
  for (const row of placements) {
    const targetId = str(row?.targetId);
    const effectName = str(row?.effectName);
    const startMs = Number(row?.startMs);
    const endMs = Number(row?.endMs);
    const layerIndex = Number(row?.layerIndex);
    if (!targetId || !effectName) continue;
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) continue;
    if (!Number.isFinite(layerIndex) || layerIndex < 0) continue;
    placementIndex += 1;
    commands.push({
      id: `fallback-placement-${placementIndex}`,
      dependsOn: ['timing.marks.insert:xd-song-structure'],
      cmd: 'effects.create',
      params: {
        modelName: targetId,
        layerIndex,
        effectName,
        startMs: Math.round(startMs),
        endMs: Math.round(endMs),
        settings: '',
        palette: ''
      }
    });
  }
  return commands;
}

function validateProposalPlacementTiming({ proposalBundle = {}, trackRecord = {}, placements = [] } = {}) {
  const durationMs = Number(
    trackRecord?.analysis?.durationMs
    || trackRecord?.analyses?.profiles?.deep?.media?.durationMs
    || trackRecord?.analyses?.profiles?.fast?.media?.durationMs
    || 0
  );
  if (!Number.isFinite(durationMs) || durationMs <= 0) return;
  const maxEndMs = placements.reduce((max, row) => {
    const endMs = Number(row?.endMs);
    return Number.isFinite(endMs) ? Math.max(max, endMs) : max;
  }, 0);
  if (maxEndMs > durationMs + 1000) {
    throw new Error(
      `Pending proposal timing is stale for the current track. Latest placement ends at ${Math.round(maxEndMs)}ms but track duration is ${Math.round(durationMs)}ms. Rebuild the proposal before apply.`
    );
  }
}

function scopedProposalPlacements(proposalBundle = {}) {
  const allPlacements = Array.isArray(proposalBundle?.executionPlan?.effectPlacements)
    ? proposalBundle.executionPlan.effectPlacements
    : [];
  const scopeSections = new Set(
    (Array.isArray(proposalBundle?.scope?.sections) ? proposalBundle.scope.sections : [])
      .map((value) => str(value))
      .filter(Boolean)
  );
  if (!scopeSections.size) return allPlacements;
  const scoped = allPlacements.filter((row) => scopeSections.has(str(row?.sourceSectionLabel)));
  return scoped.length ? scoped : allPlacements;
}

async function waitForOwnedJob(endpoint = '', jobId = '', attempts = 60, delayMs = 500) {
  for (let index = 0; index < attempts; index += 1) {
    const settled = await getOwnedJob(endpoint, jobId);
    const state = str(settled?.data?.state).toLowerCase();
    if (state === 'queued' || state === 'running') {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      continue;
    }
    return settled;
  }
  throw new Error(`Timed out waiting for owned xLights job ${jobId}.`);
}

function persistedArtifactWithFallback(artifact = null) {
  if (artifact && typeof artifact === 'object') return artifact;
  return {};
}

function withTimeout(promise, timeoutMs = APPLY_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Native review apply timed out after ${timeoutMs}ms during stage: ${currentStage}`)), timeoutMs);
    })
  ]);
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = await withTimeout(applyReview(options));
    process.stdout.write(JSON.stringify(result));
  } catch (error) {
    process.stderr.write(String(error?.stack || error?.message || error));
    process.exit(1);
  }
}
