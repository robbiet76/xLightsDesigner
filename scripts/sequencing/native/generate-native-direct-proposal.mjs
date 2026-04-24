#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getModels, getDisplayElements, getEffectDefinitions, getRevision } from '../../../apps/xlightsdesigner-ui/api.js';
import { buildAnalysisHandoffFromArtifact } from '../../../apps/xlightsdesigner-ui/agent/audio-analyst/audio-analyst-runtime.js';
import { buildEffectDefinitionCatalog } from '../../../apps/xlightsdesigner-ui/agent/sequence-agent/effect-definition-catalog.js';
import { executeDirectSequenceRequestOrchestration } from '../../../apps/xlightsdesigner-ui/agent/sequence-agent/direct-sequence-orchestrator.js';
import { STAGE1_TRAINED_EFFECT_BUNDLE } from '../../../apps/xlightsdesigner-ui/agent/sequence-agent/generated/stage1-trained-effect-bundle.js';
import { writeProjectArtifacts } from '../../../apps/xlightsdesigner-ui/storage/project-artifact-store.mjs';
import { loadProjectDisplayMetadataAssignments } from './project-display-metadata.mjs';

const DEFAULT_APP_ROOT = path.join(os.homedir(), 'Documents', 'Lights', 'xLightsDesigner');
const DEFAULT_ENDPOINT = 'http://127.0.0.1:49915/xlightsdesigner/api';
const DEFAULT_DEPS = {
  getRevision,
  getModels,
  getDisplayElements,
  getEffectDefinitions,
  buildAnalysisHandoffFromArtifact,
  buildEffectDefinitionCatalog,
  executeDirectSequenceRequestOrchestration,
  writeProjectArtifacts
};

function str(value = '') {
  return String(value || '').trim();
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

function basenameLower(filePath = '') {
  return path.basename(str(filePath)).toLowerCase();
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

function trainedEffectDefinitions() {
  const effectsByName = STAGE1_TRAINED_EFFECT_BUNDLE?.effectsByName && typeof STAGE1_TRAINED_EFFECT_BUNDLE.effectsByName === 'object'
    ? STAGE1_TRAINED_EFFECT_BUNDLE.effectsByName
    : {};
  return Object.values(effectsByName)
    .map((row) => ({ effectName: str(row?.effectName), params: [] }))
    .filter((row) => row.effectName);
}

function buildNativeEffectCatalog(effectDefinitions = [], deps = DEFAULT_DEPS) {
  const definitions = Array.isArray(effectDefinitions) && effectDefinitions.length
    ? effectDefinitions
    : trainedEffectDefinitions();
  return deps.buildEffectDefinitionCatalog(definitions, {
    source: effectDefinitions.length ? 'xlights_effect_definitions' : 'stage1_trained_effect_bundle',
    loadedAt: new Date().toISOString()
  });
}

function parseArgs(argv = []) {
  const out = {
    projectFile: '',
    prompt: '',
    appRoot: DEFAULT_APP_ROOT,
    endpoint: DEFAULT_ENDPOINT,
    selectedSections: [],
    selectedTargetIds: []
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = str(argv[i]);
    if (token === '--project-file') out.projectFile = path.resolve(str(argv[++i] || out.projectFile));
    else if (token === '--prompt') out.prompt = str(argv[++i] || out.prompt);
    else if (token === '--app-root') out.appRoot = path.resolve(str(argv[++i] || out.appRoot));
    else if (token === '--endpoint') out.endpoint = str(argv[++i] || out.endpoint);
    else if (token === '--selected-section') out.selectedSections.push(str(argv[++i] || ''));
    else if (token === '--selected-target') out.selectedTargetIds.push(str(argv[++i] || ''));
    else throw new Error(`Unknown argument: ${token}`);
  }
  if (!out.projectFile) throw new Error('--project-file is required');
  if (!out.prompt) throw new Error('--prompt is required');
  out.selectedSections = out.selectedSections.filter(Boolean);
  out.selectedTargetIds = out.selectedTargetIds.filter(Boolean);
  return out;
}

export async function runNativeDirectProposal(options = {}, deps = DEFAULT_DEPS) {
  const projectFile = str(options.projectFile);
  const prompt = str(options.prompt);
  const args = {
    projectFile: projectFile ? path.resolve(projectFile) : '',
    prompt,
    appRoot: path.resolve(str(options.appRoot || DEFAULT_APP_ROOT)),
    endpoint: str(options.endpoint || DEFAULT_ENDPOINT),
    selectedSections: Array.isArray(options.selectedSections) ? options.selectedSections.map((row) => str(row)).filter(Boolean) : [],
    selectedTargetIds: Array.isArray(options.selectedTargetIds) ? options.selectedTargetIds.map((row) => str(row)).filter(Boolean) : []
  };
  if (!args.projectFile) throw new Error('--project-file is required');
  if (!args.prompt) throw new Error('--prompt is required');

  const projectDoc = readJson(args.projectFile);
  const snapshot = projectDoc?.snapshot && typeof projectDoc.snapshot === 'object' ? projectDoc.snapshot : {};
  const audioPath = str(snapshot.audioPathInput);
  if (!audioPath) throw new Error('Project snapshot is missing audioPathInput.');

  const { record: trackRecord } = loadTrackRecordForAudio({ appRoot: args.appRoot, audioPath });
  const persistedArtifact = trackRecord?.analyses?.profiles?.deep || trackRecord?.analyses?.profiles?.fast || null;
  if (!persistedArtifact || typeof persistedArtifact !== 'object') {
    throw new Error('Shared track record has no persisted analysis artifact.');
  }

  const analysisHandoff = deps.buildAnalysisHandoffFromArtifact(persistedArtifact, null);
  const revision = await deps.getRevision(args.endpoint);
  const modelsRes = await deps.getModels(args.endpoint).catch(() => ({ ok: false, data: { models: [] } }));
  const displayRes = await deps.getDisplayElements(args.endpoint).catch(() => ({ ok: false, data: { elements: [] } }));
  const effectsRes = await deps.getEffectDefinitions(args.endpoint).catch(() => ({ ok: false, data: { effects: [] } }));
  const models = Array.isArray(modelsRes?.data?.models) ? modelsRes.data.models : [];
  const displayElements = Array.isArray(displayRes?.data?.elements) ? displayRes.data.elements : [];
  const effectDefinitions = Array.isArray(effectsRes?.data?.effects) ? effectsRes.data.effects : [];
  const effectCatalog = buildNativeEffectCatalog(effectDefinitions, deps);
  const metadataAssignments = loadProjectDisplayMetadataAssignments(args.projectFile);

  const orchestration = deps.executeDirectSequenceRequestOrchestration({
    requestId: `native-benchmark-${Date.now()}`,
    sequenceRevision: str(revision?.data?.revision || snapshot.sequencePathInput || 'unknown'),
    promptText: args.prompt,
    selectedSections: args.selectedSections,
    selectedTargetIds: args.selectedTargetIds,
    analysisHandoff,
    models,
    submodels: [],
    displayElements,
    effectCatalog,
    metadataAssignments,
    existingDesignIds: []
  });

  if (!orchestration?.ok || !orchestration?.proposalBundle || !orchestration?.intentHandoff) {
    throw new Error(orchestration?.warnings?.join('\n') || orchestration?.summary || 'Direct sequencing orchestration failed.');
  }

  const writeResult = deps.writeProjectArtifacts({
    projectFilePath: args.projectFile,
    artifacts: [orchestration.intentHandoff, orchestration.proposalBundle]
  });
  if (!writeResult?.ok) {
    throw new Error(writeResult?.error || 'Failed to write project artifacts.');
  }

  return {
    ok: true,
    projectFile: args.projectFile,
    summary: orchestration.summary,
    warnings: orchestration.warnings || [],
    proposalArtifactId: orchestration.proposalBundle.artifactId,
    intentArtifactId: orchestration.intentHandoff.artifactId,
    metadataAssignmentCount: metadataAssignments.length,
    rows: writeResult.rows || []
  };
}

export async function main(argv = process.argv.slice(2), deps = DEFAULT_DEPS) {
  return runNativeDirectProposal(parseArgs(argv), deps);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    const result = await main();
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(String(error?.stack || error?.message || error));
    process.exit(1);
  }
}
