#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const endpoint = process.env.XLIGHTS_AUTOMATION_URL || 'http://127.0.0.1:49914/xlDoAutomation';

function isoNow() {
  return new Date().toISOString();
}

async function postCommand(cmd, params = {}) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiVersion: 2, cmd, params })
  });
  const text = await res.text();
  const bodyText = text.replace(/^Could not process xLights Automation/, '');
  let json;
  try {
    json = JSON.parse(bodyText);
  } catch {
    throw new Error(`Invalid JSON for ${cmd}: ${bodyText.slice(0, 240)}`);
  }
  if (json?.res !== 200) {
    const code = json?.error?.code || 'UNKNOWN';
    const message = json?.error?.message || 'Unknown error';
    throw new Error(`${cmd} failed: ${code} ${message}`);
  }
  return json.data || {};
}

function computeBounds(nodes = []) {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  let count = 0;

  for (const node of nodes) {
    for (const coord of Array.isArray(node?.coords) ? node.coords : []) {
      const screen = coord?.screen;
      if (!screen || !Number.isFinite(screen.x) || !Number.isFinite(screen.y) || !Number.isFinite(screen.z)) {
        continue;
      }
      minX = Math.min(minX, screen.x);
      minY = Math.min(minY, screen.y);
      minZ = Math.min(minZ, screen.z);
      maxX = Math.max(maxX, screen.x);
      maxY = Math.max(maxY, screen.y);
      maxZ = Math.max(maxZ, screen.z);
      count += 1;
    }
  }

  if (!count) return null;

  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
    center: {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      z: (minZ + maxZ) / 2
    }
  };
}

function normalizeNode(node = {}) {
  const coords = Array.isArray(node.coords)
    ? node.coords.map((coord, idx) => ({
        coordIndex: idx,
        ...(coord.buffer ? { buffer: { x: coord.buffer.x, y: coord.buffer.y } } : {}),
        ...(coord.world ? { world: { x: coord.world.x, y: coord.world.y, z: coord.world.z } } : {}),
        ...(coord.screen ? { screen: { x: coord.screen.x, y: coord.screen.y, z: coord.screen.z } } : {})
      }))
    : [];

  return {
    nodeId: node.nodeId,
    stringIndex: Number.isFinite(node.stringIndex) ? node.stringIndex : null,
    channelStart: Number.isFinite(node.channelStart) ? node.channelStart : null,
    channelCount: Number.isFinite(node.channelCount) ? node.channelCount : null,
    hasChannelMapping: Number.isFinite(node.channelStart) && Number.isFinite(node.channelCount),
    coordCount: coords.length,
    coords
  };
}

function isAggregateModelRow(row = {}) {
  const type = String(row.type || '').toLowerCase();
  const name = String(row.name || '').toLowerCase();
  return type === 'modelgroup' || name === 'allmodels';
}

async function main() {
  const outPath = process.argv[2] || '/tmp/preview-scene-geometry-v1.json';
  const capabilities = await postCommand('system.getCapabilities', {});
  const modelsData = await postCommand('layout.getModels', {});
  const camerasData = await postCommand('layout.getCameras', {});

  let sceneData = null;
  let sceneWarning = null;
  try {
    sceneData = await postCommand('layout.getScene', { includeNodes: false, includeCameras: true });
  } catch (err) {
    sceneWarning = String(err.message || err);
  }

  const models = Array.isArray(modelsData.models) ? modelsData.models : [];
  const sceneModels = [];
  let skippedAggregateModelCount = 0;
  let modelsMissingChannelMapping = 0;
  let nodesMissingChannelMapping = 0;
  for (const row of models) {
    if (!row || typeof row.name !== 'string' || !row.name.trim()) continue;
    if (isAggregateModelRow(row)) {
      skippedAggregateModelCount += 1;
      continue;
    }
    const nodeData = await postCommand('layout.getModelNodes', {
      name: row.name,
      includeBufferCoords: true,
      includeWorldCoords: true,
      includeScreenCoords: true
    });
    const nodes = Array.isArray(nodeData.nodes) ? nodeData.nodes.map(normalizeNode) : [];
    const missingChannelMappingCount = nodes.filter((node) => !node.hasChannelMapping).length;
    if (missingChannelMappingCount > 0) {
      modelsMissingChannelMapping += 1;
      nodesMissingChannelMapping += missingChannelMappingCount;
    }
    sceneModels.push({
      id: row.name,
      name: row.name,
      type: row.type || '',
      displayAs: row.type || '',
      layoutGroup: row.layoutGroup || '',
      groupNames: Array.isArray(row.groupNames) ? row.groupNames : [],
      renderLayout: row.renderLayout || '',
      defaultBufferStyle: row.defaultBufferStyle || '',
      availableBufferStyles: Array.isArray(row.availableBufferStyles) ? row.availableBufferStyles : [],
      startChannel: Number.isFinite(row.startChannel) ? row.startChannel : null,
      endChannel: Number.isFinite(row.endChannel) ? row.endChannel : null,
      dimensions: null,
      transform: null,
      bounds: computeBounds(nodes),
      submodels: [],
      nodes
    });
  }

  const artifact = {
    artifactType: 'preview_scene_geometry_v1',
    artifactVersion: 1,
    createdAt: isoNow(),
    source: {
      xlightsApiVersion: 2,
      xlightsRevision: null,
      layoutRevisionToken: null,
      layoutName: null,
      showFolder: null,
      generatedFromCommands: [
        'system.getCapabilities',
        'layout.getModels',
        'layout.getModelNodes',
        'layout.getCameras',
        ...(sceneData ? ['layout.getScene'] : [])
      ],
      sceneFallbackReason: sceneWarning,
      knownGaps: [
        'layout.getModelNodes does not currently expose deterministic node channel mapping fields',
        'layout.getScene currently requires an open sequence'
      ],
      availableCommands: Array.isArray(capabilities.commands) ? capabilities.commands : []
    },
    scene: {
      views: Array.isArray(sceneData?.views) ? sceneData.views : [],
      displayElements: Array.isArray(sceneData?.displayElements) ? sceneData.displayElements : [],
      cameras: Array.isArray(camerasData.cameras) ? camerasData.cameras : [],
      models: sceneModels
    },
    summaries: {
      modelCount: sceneModels.length,
      skippedAggregateModelCount,
      cameraCount: Array.isArray(camerasData.cameras) ? camerasData.cameras.length : 0,
      sceneAvailable: Boolean(sceneData),
      modelsMissingChannelMapping,
      nodesMissingChannelMapping
    }
  };

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    ok: true,
    outPath,
    summaries: artifact.summaries,
    sceneFallbackReason: sceneWarning
  }, null, 2));
}

main().catch((err) => {
  console.error(err.stack || String(err));
  process.exit(1);
});
