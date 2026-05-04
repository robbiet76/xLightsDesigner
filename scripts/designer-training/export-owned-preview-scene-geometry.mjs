#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getLayoutScene, getModelNodes, getModels } from '../../apps/xlightsdesigner-ui/api.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_ENDPOINT = process.env.XLIGHTS_ENDPOINT || 'http://127.0.0.1:49915/xlightsdesigner/api';

function str(value = '') {
  return String(value || '').trim();
}

function resolvePath(filePath = '') {
  const value = str(filePath);
  if (!value) return '';
  return path.isAbsolute(value) ? value : path.resolve(REPO_ROOT, value);
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function number(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function computeBounds(nodes = []) {
  const coords = nodes.flatMap((node) => arr(node.coords).map((coord) => coord.screen).filter(Boolean));
  const xs = coords.map((coord) => number(coord.x)).filter(Number.isFinite);
  const ys = coords.map((coord) => number(coord.y)).filter(Number.isFinite);
  const zs = coords.map((coord) => number(coord.z, 0)).filter(Number.isFinite);
  if (!xs.length || !ys.length) return null;
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const minZ = zs.length ? Math.min(...zs) : 0;
  const maxZ = zs.length ? Math.max(...zs) : 0;
  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
    center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2, z: (minZ + maxZ) / 2 }
  };
}

function normalizeCoord(coord = {}, index = 0) {
  return {
    coordIndex: index,
    ...(coord.buffer ? { buffer: { x: number(coord.buffer.x, 0), y: number(coord.buffer.y, 0) } } : {}),
    ...(coord.world ? { world: { x: number(coord.world.x, 0), y: number(coord.world.y, 0), z: number(coord.world.z, 0) } } : {}),
    ...(coord.screen ? { screen: { x: number(coord.screen.x, 0), y: number(coord.screen.y, 0), z: number(coord.screen.z, 0) } } : {})
  };
}

function normalizeNode(node = {}, index = 0, model = {}) {
  const channelCount = number(node.channelCount, 3);
  const explicitStart = number(node.channelStart, null);
  const modelStart = number(model.startChannel, null);
  const inferredStart = modelStart == null ? null : Math.max(0, modelStart - 1) + (index * channelCount);
  const channelStart = explicitStart ?? inferredStart;
  const coords = arr(node.coords).map(normalizeCoord);
  return {
    nodeId: number(node.nodeId, index + 1),
    stringIndex: number(node.stringIndex, null),
    channelStart,
    channelCount,
    hasChannelMapping: Number.isFinite(channelStart) && Number.isFinite(channelCount),
    coordCount: coords.length,
    coords
  };
}

function isAggregateModel(row = {}) {
  const displayAs = str(row.displayAs || row.type).toLowerCase();
  const name = str(row.name).toLowerCase();
  return displayAs === 'modelgroup' || displayAs === 'model_group' || name === 'allmodels';
}

export async function exportOwnedPreviewSceneGeometry({
  endpoint = DEFAULT_ENDPOINT,
  outPath = '',
  deps = {}
} = {}) {
  const getModelsFn = deps.getModels || getModels;
  const getModelNodesFn = deps.getModelNodes || getModelNodes;
  const getLayoutSceneFn = deps.getLayoutScene || getLayoutScene;
  const modelsBody = await getModelsFn(endpoint);
  const models = arr(modelsBody?.data?.models);
  let scene = null;
  let sceneWarning = '';
  try {
    const sceneBody = await getLayoutSceneFn(endpoint, { includeCameras: true });
    scene = sceneBody?.data || null;
  } catch (error) {
    sceneWarning = str(error?.message || error);
  }

  const sceneModels = [];
  let skippedAggregateModelCount = 0;
  let modelsMissingChannelMapping = 0;
  let nodesMissingChannelMapping = 0;
  for (const row of models) {
    const name = str(row.name || row.id);
    if (!name) continue;
    if (isAggregateModel(row)) {
      skippedAggregateModelCount += 1;
      continue;
    }
    const nodeBody = await getModelNodesFn(endpoint, {
      name,
      includeBufferCoords: true,
      includeWorldCoords: true,
      includeScreenCoords: true
    });
    const nodes = arr(nodeBody?.data?.nodes).map((node, index) => normalizeNode(node, index, row));
    const missing = nodes.filter((node) => !node.hasChannelMapping).length;
    if (missing) {
      modelsMissingChannelMapping += 1;
      nodesMissingChannelMapping += missing;
    }
    sceneModels.push({
      id: name,
      name,
      type: str(row.displayAs || row.type),
      displayAs: str(row.displayAs || row.type),
      layoutGroup: str(row.layoutGroup),
      groupNames: arr(row.groupNames),
      renderLayout: str(row.renderLayout),
      defaultBufferStyle: str(row.defaultBufferStyle),
      availableBufferStyles: arr(row.availableBufferStyles),
      startChannel: number(row.startChannel, null),
      endChannel: number(row.endChannel, null),
      dimensions: {
        width: number(row.width, null),
        height: number(row.height, null),
        depth: number(row.depth, null)
      },
      transform: {
        x: number(row.positionX, null),
        y: number(row.positionY, null),
        z: number(row.positionZ, null)
      },
      bounds: computeBounds(nodes),
      submodels: [],
      nodes
    });
  }

  const artifact = {
    artifactType: 'preview_scene_geometry_v1',
    artifactVersion: 1,
    createdAt: new Date().toISOString(),
    source: {
      mode: 'owned_xlights_api',
      endpoint,
      generatedFromRoutes: ['/layout/models', '/layout/model-nodes', '/layout/scene'],
      sceneFallbackReason: sceneWarning,
      knownGaps: [
        'node channel mapping is inferred sequentially from model startChannel and RGB channel count when layout.getModelNodes omits explicit channelStart'
      ]
    },
    scene: {
      views: arr(scene?.views),
      displayElements: arr(scene?.displayElements),
      cameras: arr(scene?.cameras),
      models: sceneModels
    },
    summaries: {
      modelCount: sceneModels.length,
      skippedAggregateModelCount,
      cameraCount: arr(scene?.cameras).length,
      sceneAvailable: Boolean(scene),
      modelsMissingChannelMapping,
      nodesMissingChannelMapping
    }
  };
  const resolvedOutPath = resolvePath(outPath || path.join(REPO_ROOT, 'var/tmp/owned-preview-scene-geometry.json'));
  fs.mkdirSync(path.dirname(resolvedOutPath), { recursive: true });
  fs.writeFileSync(resolvedOutPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  return { ok: true, outPath: resolvedOutPath, artifact };
}

function parseArgs(argv = []) {
  const args = { endpoint: DEFAULT_ENDPOINT, outPath: '' };
  for (let index = 0; index < argv.length; index += 1) {
    const token = str(argv[index]);
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${token}`);
      return argv[index];
    };
    if (token === '--endpoint') args.endpoint = str(next());
    else if (token === '--out') args.outPath = resolvePath(next());
    else if (token === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${token}`);
  }
  return args;
}

function usage() {
  return `Usage:
  node scripts/designer-training/export-owned-preview-scene-geometry.mjs --out var/tmp/preview-scene-geometry.json
`;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      process.stdout.write(usage());
      process.exit(0);
    }
    const result = await exportOwnedPreviewSceneGeometry(args);
    process.stdout.write(`${JSON.stringify({
      ok: true,
      outPath: result.outPath,
      summaries: result.artifact.summaries
    }, null, 2)}\n`);
  } catch (error) {
    console.error(error?.stack || String(error));
    process.exit(1);
  }
}
