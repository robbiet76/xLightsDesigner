#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import {
  applySequencingBatchPlan,
  createSequence,
  getModels,
  getOwnedHealth,
  getOwnedJob,
  listEffects
} from '../../apps/xlightsdesigner-ui/api.js';
import { buildEffectDefinitionCatalog } from '../../apps/xlightsdesigner-ui/agent/sequence-agent/effect-definition-catalog.js';
import { buildSequenceAgentPlan } from '../../apps/xlightsdesigner-ui/agent/sequence-agent/sequence-agent.js';

const DEFAULT_ENDPOINT = 'http://127.0.0.1:49915/xlightsdesigner/api';
const DEFAULT_SHOW_DIR = '/Users/robterry/Desktop/Show';
const DEFAULT_MEDIA_FILE = "/Users/robterry/Desktop/Show/Audio/01 CAN'T STOP THE FEELING Film final.mp3";
const VALIDATION_ROOT = '_xlightsdesigner_validation';

function str(value = '') {
  return String(value || '').trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function timestampId() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function parseArgs(argv = []) {
  const out = {
    endpoint: process.env.XLD_XLIGHTS_API_URL || DEFAULT_ENDPOINT,
    showDir: DEFAULT_SHOW_DIR,
    mediaFile: DEFAULT_MEDIA_FILE,
    sourceModel: '',
    targetModel: '',
    submodel: '',
    durationMs: 30000,
    frameMs: 50,
    timeoutMs: 120000
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = str(argv[i]);
    if (token === '--endpoint') out.endpoint = str(argv[++i] || out.endpoint);
    else if (token === '--show-dir') out.showDir = path.resolve(str(argv[++i] || out.showDir));
    else if (token === '--media-file') out.mediaFile = path.resolve(str(argv[++i] || out.mediaFile));
    else if (token === '--source-model') out.sourceModel = str(argv[++i]);
    else if (token === '--target-model') out.targetModel = str(argv[++i]);
    else if (token === '--submodel') out.submodel = str(argv[++i]);
    else if (token === '--duration-ms') out.durationMs = Number(argv[++i]);
    else if (token === '--frame-ms') out.frameMs = Number(argv[++i]);
    else if (token === '--timeout-ms') out.timeoutMs = Number(argv[++i]);
    else throw new Error(`Unknown argument: ${token}`);
  }
  if (!Number.isFinite(out.durationMs) || out.durationMs <= 0) out.durationMs = 30000;
  if (!Number.isFinite(out.frameMs) || out.frameMs <= 0) out.frameMs = 50;
  if (!Number.isFinite(out.timeoutMs) || out.timeoutMs < 1000) out.timeoutMs = 120000;
  return out;
}

function readShowSubmodels(showDir = '') {
  const filePath = path.join(showDir, 'xlights_rgbeffects.xml');
  const xml = fs.readFileSync(filePath, 'utf8');
  const rows = [];
  const attr = (text = '', name = '') => {
    const match = text.match(new RegExp(`${name}="([^"]*)"`));
    return match ? str(match[1]) : '';
  };
  const modelRe = /<model\b([^>]*)>([\s\S]*?)<\/model>/g;
  let match;
  while ((match = modelRe.exec(xml))) {
    const parentId = attr(match[1], 'name');
    if (!parentId) continue;
    const body = match[2] || '';
    for (const subMatch of body.matchAll(/<subModel\b([^>]*)>/g)) {
      const name = attr(subMatch[1], 'name');
      if (name) rows.push({ parentId, name, id: `${parentId}/${name}` });
    }
  }
  return rows;
}

function chooseScenario({ submodels = [], sourceModel = '', targetModel = '', submodel = '' } = {}) {
  if (sourceModel && targetModel && submodel) {
    return {
      sourceModel,
      targetModel,
      submodel,
      sourceSubmodel: `${sourceModel}/${submodel}`,
      targetSubmodel: `${targetModel}/${submodel}`
    };
  }
  const byName = new Map();
  for (const row of submodels) {
    const list = byName.get(row.name) || [];
    list.push(row.parentId);
    byName.set(row.name, list);
  }
  for (const name of ['Rows', 'Segments', 'Left', 'Spokes', 'Center', 'Body']) {
    const parents = arr(byName.get(name));
    if (parents.length >= 2) {
      return {
        sourceModel: parents[0],
        targetModel: parents[1],
        submodel: name,
        sourceSubmodel: `${parents[0]}/${name}`,
        targetSubmodel: `${parents[1]}/${name}`
      };
    }
  }
  for (const [name, parents] of byName.entries()) {
    if (parents.length >= 2) {
      return {
        sourceModel: parents[0],
        targetModel: parents[1],
        submodel: name,
        sourceSubmodel: `${parents[0]}/${name}`,
        targetSubmodel: `${parents[1]}/${name}`
      };
    }
  }
  throw new Error('No repeated submodel name was found in xlights_rgbeffects.xml for clone validation.');
}

async function waitForJob(endpoint = '', jobId = '', timeoutMs = 120000) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < timeoutMs) {
    last = await getOwnedJob(endpoint, jobId);
    const state = str(last?.data?.state).toLowerCase();
    const result = last?.data?.result && typeof last.data.result === 'object' ? last.data.result : null;
    if (state === 'completed' || state === 'succeeded') {
      if (result?.ok === false) throw new Error(`Job ${jobId} failed: ${JSON.stringify(result)}`);
      return result || last;
    }
    if (state === 'failed' || result?.ok === false) {
      throw new Error(`Job ${jobId} failed: ${JSON.stringify(last)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for job ${jobId}. Last response: ${JSON.stringify(last)}`);
}

function normalizeEffects(payload = {}, fallbackTargetId = '') {
  const responseElement = str(payload?.data?.element || payload?.element || fallbackTargetId);
  return arr(payload?.data?.effects || payload?.effects)
    .map((row) => ({
      targetId: str(row?.modelName || row?.element || row?.model || responseElement),
      effectName: str(row?.effectName || row?.name),
      layerIndex: Number(row?.layerIndex ?? row?.layerNumber ?? row?.layer ?? 0),
      startMs: Number(row?.startMs ?? row?.start ?? 0),
      endMs: Number(row?.endMs ?? row?.end ?? 0),
      settings: row?.settings ?? '',
      palette: row?.palette ?? ''
    }))
    .filter((row) => row.targetId && row.effectName && Number.isFinite(row.startMs) && Number.isFinite(row.endMs));
}

async function readEffectRows(endpoint = '', targetIds = []) {
  const rows = [];
  for (const targetId of targetIds) {
    const payload = await listEffects(endpoint, { element: targetId, startMs: 0, endMs: 30000 });
    rows.push(...normalizeEffects(payload, targetId));
  }
  return rows;
}

async function applyBatchAndWait(endpoint = '', body = {}, timeoutMs = 120000) {
  const response = await applySequencingBatchPlan(endpoint, body);
  const jobId = str(response?.data?.jobId);
  if (jobId) return waitForJob(endpoint, jobId, timeoutMs);
  return response;
}

function validationMarks(durationMs = 30000) {
  const duration = Math.max(Number(durationMs) || 30000, 3000);
  const introEnd = Math.max(1, Math.floor(duration * 0.2));
  const validationEnd = Math.max(introEnd + 1, Math.floor(duration * 0.8));
  return [
    { label: 'Validation Intro', startMs: 0, endMs: introEnd },
    { label: 'Validation', startMs: introEnd, endMs: validationEnd },
    { label: 'Validation Outro', startMs: validationEnd, endMs: duration }
  ];
}

function sampleAnalysis() {
  return {
    trackIdentity: { title: 'Validation Track', artist: 'xLightsDesigner' },
    structure: { sections: ['Validation'] },
    briefSeed: { tone: 'validation' }
  };
}

function sampleIntent(goal = '') {
  return {
    goal,
    mode: 'revise',
    scope: {
      targetIds: [],
      tagNames: [],
      sections: ['Validation']
    }
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const health = await getOwnedHealth(args.endpoint);
  if (health?.ok !== true) throw new Error(`Owned xLights API is not healthy: ${JSON.stringify(health)}`);

  const submodels = readShowSubmodels(args.showDir);
  const scenario = chooseScenario({
    submodels,
    sourceModel: args.sourceModel,
    targetModel: args.targetModel,
    submodel: args.submodel
  });
  const knownSubmodelIds = new Set(submodels.map((row) => row.id));
  if (!knownSubmodelIds.has(scenario.sourceSubmodel) || !knownSubmodelIds.has(scenario.targetSubmodel)) {
    throw new Error(`Requested submodel mapping does not exist in show layout: ${JSON.stringify(scenario)}`);
  }

  const runId = timestampId();
  const sequencePath = path.join(args.showDir, VALIDATION_ROOT, 'planner-clone-submodel-api', `planner-clone-submodel-api-${runId}.xsq`);
  fs.mkdirSync(path.dirname(sequencePath), { recursive: true });
  await createSequence(args.endpoint, {
    file: sequencePath,
    mediaFile: args.mediaFile,
    durationMs: args.durationMs,
    frameMs: args.frameMs,
    overwrite: true
  });

  const seedEffects = [
    {
      element: scenario.sourceModel,
      layer: 0,
      effectName: 'On',
      startMs: 1000,
      endMs: 3000,
      settings: {},
      palette: {},
      clearExisting: false
    },
    {
      element: scenario.sourceSubmodel,
      layer: 1,
      effectName: 'Shimmer',
      startMs: 2000,
      endMs: 5000,
      settings: {},
      palette: {},
      clearExisting: false
    }
  ];
  await applyBatchAndWait(args.endpoint, {
    track: 'XD: Submodel Clone Seed',
    subType: 'Generic',
    replaceExistingMarks: true,
    marks: validationMarks(args.durationMs),
    effects: seedEffects
  }, args.timeoutMs);

  const sourceRows = await readEffectRows(args.endpoint, [scenario.sourceModel, scenario.sourceSubmodel]);
  const parentSeeded = sourceRows.some((row) => row.targetId === scenario.sourceModel && row.effectName === 'On' && row.layerIndex === 0);
  const submodelSeeded = sourceRows.some((row) => row.targetId === scenario.sourceSubmodel && row.effectName === 'Shimmer' && row.layerIndex === 1);
  if (!parentSeeded || !submodelSeeded) {
    throw new Error(`Seed readback failed: ${JSON.stringify({ scenario, sourceRows })}`);
  }

  const goal = `Copy ${scenario.sourceModel} including submodels to ${scenario.targetModel}`;
  const modelsPayload = await getModels(args.endpoint);
  const displayElements = [
    ...arr(modelsPayload?.data?.models).map((row) => ({ id: str(row?.name), name: str(row?.name), type: str(row?.displayAs || row?.type) })),
    { id: scenario.sourceSubmodel, name: scenario.sourceSubmodel, type: 'submodel' },
    { id: scenario.targetSubmodel, name: scenario.targetSubmodel, type: 'submodel' }
  ].filter((row) => row.id);
  const plan = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: sampleIntent(goal),
    sourceLines: [`Validation / ${goal}`],
    currentSequenceContext: {
      artifactType: 'current_sequence_context_v1',
      sequence: { revision: 'native-validation' },
      summary: { effectCount: sourceRows.length, timingTrackCount: 1 },
      effects: { sample: sourceRows }
    },
    baseRevision: 'native-validation',
    displayElements,
    effectCatalog: buildEffectDefinitionCatalog([
      { effectName: 'On', params: [] },
      { effectName: 'Shimmer', params: [] }
    ]),
    capabilityCommands: ['timing.createTrack', 'timing.insertMarks', 'effects.create', 'sequencer.setDisplayElementOrder']
  });
  const cloneCommands = arr(plan.commands).filter((command) => str(command?.cmd) === 'effects.create' && str(command?.id).startsWith('effect.clone.'));
  if (cloneCommands.length !== 2) {
    throw new Error(`Expected two clone commands for parent plus matching submodel, got ${cloneCommands.length}: ${JSON.stringify(plan.commands)}`);
  }
  await applyBatchAndWait(args.endpoint, {
    track: 'XD: Submodel Clone Apply',
    subType: 'Generic',
    replaceExistingMarks: false,
    marks: validationMarks(args.durationMs),
    effects: cloneCommands.map((command) => ({
      element: str(command?.params?.modelName),
      layer: Number(command?.params?.layerIndex),
      effectName: str(command?.params?.effectName),
      startMs: Number(command?.params?.startMs),
      endMs: Number(command?.params?.endMs),
      settings: command?.params?.settings || {},
      palette: command?.params?.palette || {},
      clearExisting: false
    }))
  }, args.timeoutMs);

  const targetRows = await readEffectRows(args.endpoint, [scenario.targetModel, scenario.targetSubmodel]);
  const parentCloned = targetRows.some((row) => row.targetId === scenario.targetModel && row.effectName === 'On' && row.layerIndex === 0 && row.startMs === 1000 && row.endMs === 3000);
  const submodelCloned = targetRows.some((row) => row.targetId === scenario.targetSubmodel && row.effectName === 'Shimmer' && row.layerIndex === 1 && row.startMs === 2000 && row.endMs === 5000);
  const result = {
    ok: parentCloned && submodelCloned,
    runId,
    sequencePath,
    scenario,
    commandCount: plan.commands.length,
    cloneCommands: cloneCommands.map((command) => ({
      id: command.id,
      modelName: command.params.modelName,
      layerIndex: command.params.layerIndex,
      effectName: command.params.effectName,
      startMs: command.params.startMs,
      endMs: command.params.endMs,
      sourceModelName: command.intent?.clonePolicy?.sourceModelName,
      targetModelName: command.intent?.clonePolicy?.targetModelName
    })),
    checks: {
      parentSeeded,
      submodelSeeded,
      parentCloned,
      submodelCloned
    },
    warnings: plan.warnings || [],
    targetRows
  };
  const evidencePath = path.join(path.dirname(sequencePath), `${path.basename(sequencePath, '.xsq')}-evidence.json`);
  fs.writeFileSync(evidencePath, `${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) {
    throw new Error(`Submodel clone validation failed: ${JSON.stringify(result)}`);
  }
  console.log(JSON.stringify({ ...result, evidencePath }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || String(error));
  process.exit(1);
});
