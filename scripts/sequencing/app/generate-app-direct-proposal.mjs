#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getModels, getDisplayElements, getEffectDefinitions, getLayoutGroupMemberships, getRevision, getSubmodels } from '../../../apps/xlightsdesigner-ui/api.js';
import { buildAnalysisHandoffFromArtifact } from '../../../apps/xlightsdesigner-ui/agent/audio-analyst/audio-analyst-runtime.js';
import { buildEffectDefinitionCatalog } from '../../../apps/xlightsdesigner-ui/agent/sequence-agent/effect-definition-catalog.js';
import { executeDirectSequenceRequestOrchestration } from '../../../apps/xlightsdesigner-ui/agent/sequence-agent/direct-sequence-orchestrator.js';
import { STAGE1_TRAINED_EFFECT_BUNDLE } from '../../../apps/xlightsdesigner-ui/agent/sequence-agent/generated/stage1-trained-effect-bundle.js';
import { finalizeArtifact } from '../../../apps/xlightsdesigner-ui/agent/shared/artifact-ids.js';
import { writeProjectArtifacts } from '../../../apps/xlightsdesigner-ui/storage/project-artifact-store.mjs';
import { loadProjectDisplayMetadataAssignments } from './project-display-metadata.mjs';

const DEFAULT_APP_ROOT = path.join(os.homedir(), 'Documents', 'Lights', 'xLightsDesigner');
const DEFAULT_ENDPOINT = 'http://127.0.0.1:49915/xlightsdesigner/api';
const DEFAULT_DEPS = {
  getRevision,
  getModels,
  getDisplayElements,
  getEffectDefinitions,
  getLayoutGroupMemberships,
  getSubmodels,
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

function buildAppEffectCatalog(effectDefinitions = [], deps = DEFAULT_DEPS) {
  const definitions = Array.isArray(effectDefinitions) && effectDefinitions.length
    ? effectDefinitions
    : trainedEffectDefinitions();
  return deps.buildEffectDefinitionCatalog(definitions, {
    source: effectDefinitions.length ? 'xlights_effect_definitions' : 'stage1_trained_effect_bundle',
    loadedAt: new Date().toISOString()
  });
}

function displayElementId(row = {}) {
  return str(row?.id || row?.name || row?.modelName || row?.targetId);
}

function normalizeDisplayElements(res = {}) {
  const elements = Array.isArray(res?.data?.elements) ? res.data.elements : [];
  return elements.map((row) => {
    if (typeof row === 'string') return { id: row, name: row };
    const name = str(row?.name || row?.id);
    return { ...row, id: str(row?.id || name), name };
  }).filter((row) => row.id || row.name);
}

function normalizeLayoutModelRows(models = []) {
  return Array.isArray(models)
    ? models
        .map((row) => {
          const name = str(row?.name || row?.id);
          const position = row?.transform?.position && typeof row.transform.position === 'object'
            ? row.transform.position
            : {};
          return {
            ...row,
            id: str(row?.id || name),
            name,
            type: str(row?.type || row?.displayAs || row?.kind),
            displayAs: str(row?.displayAs || row?.type || row?.kind),
            positionX: row?.positionX ?? row?.x ?? row?.centerX ?? position.x,
            positionY: row?.positionY ?? row?.y ?? row?.centerY ?? position.y,
            positionZ: row?.positionZ ?? row?.z ?? position.z
          };
        })
        .filter((row) => row.id || row.name)
    : [];
}

function mergeDisplayElementsWithLayoutModels(displayElements = [], models = []) {
  const normalizedElements = Array.isArray(displayElements) ? displayElements : [];
  const normalizedModels = normalizeLayoutModelRows(models);
  const modelsById = new Map(normalizedModels.map((row) => [displayElementId(row).toLowerCase(), row]));
  const out = [];
  const seen = new Set();
  for (const element of normalizedElements) {
    const id = displayElementId(element);
    if (!id) continue;
    const model = modelsById.get(id.toLowerCase()) || {};
    out.push({
      ...model,
      ...element,
      id: str(element.id || model.id || id),
      name: str(element.name || model.name || id),
      displayAs: str(model.displayAs || element.displayAs || element.type),
      positionX: element.positionX ?? element.x ?? element.centerX ?? model.positionX,
      positionY: element.positionY ?? element.y ?? element.centerY ?? model.positionY,
      positionZ: element.positionZ ?? element.z ?? model.positionZ
    });
    seen.add(id.toLowerCase());
  }
  for (const model of normalizedModels) {
    const id = displayElementId(model);
    if (!id || seen.has(id.toLowerCase())) continue;
    out.push(model);
    seen.add(id.toLowerCase());
  }
  return out;
}

function normalizeMemberName(member = {}) {
  return str(member?.id || member?.name || member?.targetId || member);
}

function buildGroupsById(groupMemberships = {}) {
  const groups = Array.isArray(groupMemberships?.data?.groups) ? groupMemberships.data.groups : [];
  const out = {};
  for (const group of groups) {
    const id = str(group?.groupName || group?.name || group?.id);
    if (!id) continue;
    out[id] = {
      id,
      name: id,
      type: 'group',
      members: {
        direct: (Array.isArray(group.directMembers) ? group.directMembers : []).map(normalizeMemberName).filter(Boolean),
        active: (Array.isArray(group.activeMembers) ? group.activeMembers : []).map(normalizeMemberName).filter(Boolean),
        flattened: (Array.isArray(group.flattenedMembers) ? group.flattenedMembers : []).map(normalizeMemberName).filter(Boolean),
        flattenedAll: (Array.isArray(group.flattenedAllMembers) ? group.flattenedAllMembers : []).map(normalizeMemberName).filter(Boolean)
      }
    };
  }
  return out;
}

function normalizeArray(value) {
  return Array.isArray(value) ? value.map((row) => str(row)).filter(Boolean) : [];
}

function normalizePaletteRows(rows = []) {
  return Array.isArray(rows)
    ? rows
        .map((row, index) => {
          if (typeof row === 'string') {
            return {
              name: `palette ${index + 1}`,
              hex: str(row),
              role: index === 0 ? 'base' : (index === 1 ? 'highlight' : 'accent')
            };
          }
          return {
            name: str(row?.name || row?.label || `palette ${index + 1}`),
            hex: str(row?.hex || row?.color || row?.value),
            role: str(row?.role || row?.usage || row?.intent)
          };
        })
        .filter((row) => /^#[0-9a-f]{6}$/i.test(row.hex))
        .slice(0, 8)
    : [];
}

function fallbackLightingPaletteForAppIntent(appDesignIntent = {}, snapshot = {}) {
  const text = [
    str(appDesignIntent?.goal),
    str(appDesignIntent?.mood),
    str(appDesignIntent?.targetScope),
    str(appDesignIntent?.constraints),
    str(appDesignIntent?.references)
  ].join(' ').toLowerCase();
  if (/\b(christmas|holiday|warm|gold|candle|pine|red|green)\b/.test(text)) {
    return [
      { name: 'candle gold', hex: '#ffd36a', role: 'warm highlight' },
      { name: 'evergreen', hex: '#1f7a4a', role: 'support base' },
      { name: 'deep red', hex: '#c8324a', role: 'accent' },
      { name: 'ice white', hex: '#dff6ff', role: 'cool sparkle' }
    ];
  }
  return normalizePaletteRows(snapshot?.inspiration?.paletteSwatches).length
    ? []
    : [
        { name: 'ice blue', hex: '#8fd8ff', role: 'base' },
        { name: 'warm gold', hex: '#ffd36a', role: 'highlight' },
        { name: 'deep rose', hex: '#c8324a', role: 'accent' },
        { name: 'clean green', hex: '#1f7a4a', role: 'support' }
      ];
}

function resolveAppDesignPaletteRows({ appDesignIntent = {}, snapshot = {} } = {}) {
  const candidates = [
    appDesignIntent?.lightingPalette,
    appDesignIntent?.palette,
    appDesignIntent?.paletteRoles,
    snapshot?.visualDesignAssetPack?.palette?.lightingColors,
    snapshot?.visualDesignAssetPack?.palette?.colors,
    snapshot?.inspiration?.paletteSwatches
  ];
  for (const rows of candidates) {
    const normalized = normalizePaletteRows(rows);
    if (normalized.length) return normalized;
  }
  return fallbackLightingPaletteForAppIntent(appDesignIntent, snapshot);
}

function buildSectionDirectivesFromExecutionPlan(executionPlan = {}) {
  const sectionPlans = Array.isArray(executionPlan?.sectionPlans) ? executionPlan.sectionPlans : [];
  return sectionPlans
    .map((row) => {
      const sectionName = str(row?.section);
      if (!sectionName) return null;
      const intentSummary = str(row?.intentSummary);
      return {
        sectionName,
        sectionPurpose: /intro/i.test(sectionName) ? 'intro_establish' : (/outro/i.test(sectionName) ? 'outro_resolve' : 'section_develop'),
        energyTarget: str(row?.energy) || (/chorus|peak|reveal/i.test(`${sectionName} ${intentSummary}`) ? 'high' : 'medium'),
        motionTarget: /restrained|hold|calm|soft/i.test(intentSummary) ? 'restrained_motion' : 'steady_motion',
        densityTarget: str(row?.density) || (/dense|bigger|full|peak/i.test(intentSummary) ? 'dense' : 'moderate'),
        transitionIntent: /build|bigger|lift|peak/i.test(intentSummary) ? 'build' : (/resolve|ending|outro/i.test(intentSummary) ? 'resolve' : 'hold'),
        preferredVisualFamilies: normalizeArray(row?.effectHints),
        avoidVisualFamilies: [],
        notes: intentSummary
      };
    })
    .filter(Boolean);
}

function buildPropRoleAssignments(metadataAssignments = [], fallbackTargetIds = []) {
  const rows = metadataAssignments.length
    ? metadataAssignments
    : normalizeArray(fallbackTargetIds).map((targetId) => ({ targetId }));
  return rows
    .map((row, index) => {
      const targetId = str(row?.targetId);
      if (!targetId) return null;
      const role = str(row?.rolePreference) || (index === 0 ? 'lead' : 'support');
      return {
        targetId,
        role,
        priority: index + 1,
        behaviorIntent: normalizeArray(row?.semanticHints).slice(0, 3).join(', ') || `${role} display role`
      };
    })
    .filter(Boolean);
}

function compactReferenceSequencePatterns(patterns = null) {
  if (!patterns || typeof patterns !== 'object' || Array.isArray(patterns)) return null;
  const aggregate = patterns?.aggregate && typeof patterns.aggregate === 'object' ? patterns.aggregate : {};
  return {
    artifactId: str(patterns?.artifactId),
    artifactType: str(patterns?.artifactType),
    sourceMode: str(patterns?.source?.mode),
    analyzedSequenceCount: Number(patterns?.source?.analyzedSequenceCount || aggregate.sequenceCount || 0),
    averageEffectsPerSequence: Number(aggregate.averageEffectsPerSequence || 0),
    averageActiveTargets: Number(aggregate.averageActiveTargets || 0),
    averageLayeredTargets: Number(aggregate.averageLayeredTargets || 0),
    densityPerMinute: aggregate.densityPerMinute && typeof aggregate.densityPerMinute === 'object'
      ? aggregate.densityPerMinute
      : {},
    commonEffects: Array.isArray(aggregate.commonEffects) ? aggregate.commonEffects.slice(0, 12) : [],
    targetRoleMix: Array.isArray(aggregate.targetRoleMix) ? aggregate.targetRoleMix.slice(0, 8) : [],
    bucketEffectPatterns: Object.fromEntries(
      Object.entries(aggregate.bucketEffectPatterns || {})
        .slice(0, 6)
        .map(([bucket, rows]) => [bucket, Array.isArray(rows) ? rows.slice(0, 6) : []])
    )
  };
}

function loadLatestReferenceSequencePatterns(projectFile = '') {
  const projectDir = path.dirname(str(projectFile));
  const artifactPath = latestJsonFile(path.join(projectDir, 'artifacts', 'sequence-reference-patterns'));
  if (!artifactPath) return null;
  try {
    return compactReferenceSequencePatterns(readJson(artifactPath));
  } catch {
    return null;
  }
}

function buildAppSequencingDesignHandoff({
  projectDoc = {},
  prompt = '',
  proposalBundle = {},
  intentHandoff = {},
  metadataAssignments = [],
  referenceSequencePatterns = null,
  requestId = '',
  baseRevision = ''
} = {}) {
  const snapshot = projectDoc?.snapshot && typeof projectDoc.snapshot === 'object' ? projectDoc.snapshot : {};
  const appDesignIntent = snapshot?.appDesignIntent && typeof snapshot.appDesignIntent === 'object'
    ? snapshot.appDesignIntent
    : {};
  const executionPlan = proposalBundle?.executionPlan && typeof proposalBundle.executionPlan === 'object' ? proposalBundle.executionPlan : {};
  const scope = proposalBundle?.scope && typeof proposalBundle.scope === 'object'
    ? proposalBundle.scope
    : (intentHandoff?.scope && typeof intentHandoff.scope === 'object' ? intentHandoff.scope : {});
  const targetIds = normalizeArray(scope?.targetIds);
  const tagNames = normalizeArray(scope?.tagNames);
  const sections = normalizeArray(scope?.sections);
  const goal = str(appDesignIntent?.goal || proposalBundle?.summary || intentHandoff?.goal || prompt);
  const designSummary = [
    goal,
    str(appDesignIntent?.mood),
    str(appDesignIntent?.targetScope)
  ].filter(Boolean).join(' | ');
  const assignments = buildPropRoleAssignments(metadataAssignments, targetIds);
  const leadTargets = assignments.filter((row) => row.role === 'lead').map((row) => row.targetId);
  const supportTargets = assignments.filter((row) => row.role !== 'lead' && row.role !== 'accent').map((row) => row.targetId);
  const accentTargets = assignments.filter((row) => row.role === 'accent').map((row) => row.targetId);
  const paletteRoles = resolveAppDesignPaletteRows({ appDesignIntent, snapshot });

  return finalizeArtifact({
    artifactType: 'sequencing_design_handoff_v2',
    artifactVersion: '2.0',
    contractVersion: '2.0',
    agentRole: 'designer_dialog',
    requestId: str(requestId) || `app-design-${Date.now()}`,
    baseRevision: str(baseRevision || intentHandoff?.baseRevision || 'unknown'),
    goal,
    designSummary,
    scope: {
      sections,
      targetIds,
      tagNames,
      timeRangeMs: null
    },
    sectionDirectives: buildSectionDirectivesFromExecutionPlan(executionPlan),
    propRoleAssignments: assignments,
    focusPlan: {
      primaryTargets: leadTargets.length ? leadTargets : targetIds.slice(0, 3),
      secondaryTargets: supportTargets,
      accentTargets,
      balanceRule: 'full-display roles are assigned deterministically from project display metadata and selected tags'
    },
    visualFamilyPreferences: {
      preferred: ['large_form_motion', 'soft_texture', 'segmented_directional'],
      allowed: ['spiral_flow', 'radial_rotation', 'diffuse_shockwave', 'soft_texture'],
      avoid: []
    },
    paletteRoles: paletteRoles.length ? paletteRoles : undefined,
    referenceSequencePatterns,
    constraints: {
      preserveTimingTracks: true,
      allowGlobalRewrite: Boolean(intentHandoff?.constraints?.allowGlobalRewrite ?? true),
      changeTolerance: str(intentHandoff?.constraints?.changeTolerance || 'medium'),
      readabilityPriority: 'high',
      flashTolerance: 'medium'
    },
    avoidances: metadataAssignments.flatMap((row) => normalizeArray(row?.effectAvoidances)),
    executionLatitude: 'moderate',
    traceability: {
      briefId: str(appDesignIntent?.artifactId || appDesignIntent?.updatedAt),
      proposalId: str(proposalBundle?.artifactId),
      directorProfileSignals: [],
      designSceneSignals: normalizeArray(appDesignIntent?.targetScope),
      musicDesignSignals: normalizeArray(appDesignIntent?.references)
    },
    appDesignIntent: {
      mood: str(appDesignIntent?.mood),
      targetScope: str(appDesignIntent?.targetScope),
      constraints: str(appDesignIntent?.constraints),
      references: str(appDesignIntent?.references),
      approvalNotes: str(appDesignIntent?.approvalNotes),
      updatedAt: str(appDesignIntent?.updatedAt)
    }
  });
}

function parseArgs(argv = []) {
  const out = {
    projectFile: '',
    prompt: '',
    appRoot: DEFAULT_APP_ROOT,
    endpoint: DEFAULT_ENDPOINT,
    selectedSections: [],
    selectedTimingTrackName: '',
    selectedTagNames: [],
    selectedTargetIds: []
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = str(argv[i]);
    if (token === '--project-file') out.projectFile = path.resolve(str(argv[++i] || out.projectFile));
    else if (token === '--prompt') out.prompt = str(argv[++i] || out.prompt);
    else if (token === '--app-root') out.appRoot = path.resolve(str(argv[++i] || out.appRoot));
    else if (token === '--endpoint') out.endpoint = str(argv[++i] || out.endpoint);
    else if (token === '--selected-section') out.selectedSections.push(str(argv[++i] || ''));
    else if (token === '--timing-track-name' || token === '--section-timing-track-name') out.selectedTimingTrackName = str(argv[++i] || '');
    else if (token === '--selected-tag') out.selectedTagNames.push(str(argv[++i] || ''));
    else if (token === '--selected-target') out.selectedTargetIds.push(str(argv[++i] || ''));
    else throw new Error(`Unknown argument: ${token}`);
  }
  if (!out.projectFile) throw new Error('--project-file is required');
  if (!out.prompt) throw new Error('--prompt is required');
  out.selectedSections = out.selectedSections.filter(Boolean);
  out.selectedTagNames = out.selectedTagNames.filter(Boolean);
  out.selectedTargetIds = out.selectedTargetIds.filter(Boolean);
  return out;
}

export async function runAppDirectProposal(options = {}, deps = DEFAULT_DEPS) {
  const projectFile = str(options.projectFile);
  const prompt = str(options.prompt);
  const args = {
    projectFile: projectFile ? path.resolve(projectFile) : '',
    prompt,
    appRoot: path.resolve(str(options.appRoot || DEFAULT_APP_ROOT)),
    endpoint: str(options.endpoint || DEFAULT_ENDPOINT),
    selectedSections: Array.isArray(options.selectedSections) ? options.selectedSections.map((row) => str(row)).filter(Boolean) : [],
    selectedTimingTrackName: str(options.selectedTimingTrackName || options.timingTrackName || options.sectionTimingTrackName),
    selectedTagNames: Array.isArray(options.selectedTagNames) ? options.selectedTagNames.map((row) => str(row)).filter(Boolean) : [],
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
  const submodelsRes = typeof deps.getSubmodels === 'function'
    ? await deps.getSubmodels(args.endpoint).catch(() => ({ ok: false, data: { submodels: [] } }))
    : { data: { submodels: [] } };
  const groupMembershipsRes = typeof deps.getLayoutGroupMemberships === 'function'
    ? await deps.getLayoutGroupMemberships(args.endpoint).catch(() => ({ ok: false, data: { groups: [] } }))
    : { data: { groups: [] } };
  const models = Array.isArray(modelsRes?.data?.models) ? modelsRes.data.models : [];
  const submodels = Array.isArray(submodelsRes?.data?.submodels) ? submodelsRes.data.submodels : [];
  const displayElements = mergeDisplayElementsWithLayoutModels(normalizeDisplayElements(displayRes), models);
  const effectDefinitions = Array.isArray(effectsRes?.data?.effects) ? effectsRes.data.effects : [];
  const effectCatalog = buildAppEffectCatalog(effectDefinitions, deps);
  const groupMemberships = groupMembershipsRes?.ok === false ? { data: { groups: [] } } : groupMembershipsRes;
  const groupsById = buildGroupsById(groupMemberships);
  const metadataAssignments = loadProjectDisplayMetadataAssignments(args.projectFile, {
    layoutRows: models,
    groupMemberships
  });
  const referenceSequencePatterns = loadLatestReferenceSequencePatterns(args.projectFile);

  const orchestration = deps.executeDirectSequenceRequestOrchestration({
    requestId: `app-benchmark-${Date.now()}`,
    sequenceRevision: str(revision?.data?.revision || snapshot.sequencePathInput || 'unknown'),
    promptText: args.prompt,
    selectedSections: args.selectedSections,
    selectedTimingTrackName: args.selectedTimingTrackName,
    selectedTagNames: args.selectedTagNames,
    selectedTargetIds: args.selectedTargetIds,
    analysisHandoff,
    models,
    submodels,
    displayElements,
    groupIds: Object.keys(groupsById),
    groupsById,
    effectCatalog,
    metadataAssignments,
    existingDesignIds: []
  });

  if (!orchestration?.ok || !orchestration?.proposalBundle || !orchestration?.intentHandoff) {
    throw new Error(orchestration?.warnings?.join('\n') || orchestration?.summary || 'Direct sequencing orchestration failed.');
  }
  const sequencingDesignHandoff = buildAppSequencingDesignHandoff({
    projectDoc,
    prompt,
    proposalBundle: orchestration.proposalBundle,
    intentHandoff: orchestration.intentHandoff,
    metadataAssignments,
    referenceSequencePatterns,
    requestId: `app-benchmark-${Date.now()}`,
    baseRevision: str(revision?.data?.revision || snapshot.sequencePathInput || 'unknown')
  });
  const intentHandoff = finalizeArtifact({
    ...orchestration.intentHandoff,
    sequencingDesignHandoff
  });
  const proposalBundle = finalizeArtifact({
    ...orchestration.proposalBundle,
    sequencingDesignHandoffRef: sequencingDesignHandoff.artifactId
  });

  const writeResult = deps.writeProjectArtifacts({
    projectFilePath: args.projectFile,
    artifacts: [intentHandoff, proposalBundle, sequencingDesignHandoff]
  });
  if (!writeResult?.ok) {
    throw new Error(writeResult?.error || 'Failed to write project artifacts.');
  }

  return {
    ok: true,
    projectFile: args.projectFile,
    summary: orchestration.summary,
    warnings: orchestration.warnings || [],
    proposalArtifactId: proposalBundle.artifactId,
    intentArtifactId: intentHandoff.artifactId,
    sequencingDesignHandoffArtifactId: sequencingDesignHandoff.artifactId,
    metadataAssignmentCount: metadataAssignments.length,
    rows: writeResult.rows || []
  };
}

export async function main(argv = process.argv.slice(2), deps = DEFAULT_DEPS) {
  return runAppDirectProposal(parseArgs(argv), deps);
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
