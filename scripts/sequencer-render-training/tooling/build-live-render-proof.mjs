import fs from 'node:fs/promises';
import path from 'node:path';

import { buildRenderSamplingPlan, buildRenderObservationFromSamples } from '../../../apps/xlightsdesigner-ui/runtime/render-observation-runtime.js';
import { buildRenderCritiqueContext } from '../../../apps/xlightsdesigner-ui/agent/sequence-agent/render-critique-context.js';
import { buildDesignSceneContext } from '../../../apps/xlightsdesigner-ui/agent/designer-dialog/design-scene-context.js';

function str(value = '') {
  return String(value || '').trim();
}

function toFinite(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function usage() {
  console.error('usage: node build-live-render-proof.mjs --geometry <path> --fseq <path> --api <url> --proof-id <id> [--start-ms N] [--end-ms N] [--max-frames N]');
  process.exit(1);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key.startsWith('--')) continue;
    out[key.slice(2)] = value;
    i += 1;
  }
  return out;
}

function geometryToSceneGraph(geometry) {
  const models = Array.isArray(geometry?.scene?.models) ? geometry.scene.models : [];
  const modelsById = {};
  for (const model of models) {
    const id = str(model?.id || model?.name);
    if (!id) continue;
    const startChannel = toFinite(model?.startChannel);
    const endChannel = toFinite(model?.endChannel);
    const center = model?.bounds?.center || {};
    const nodes = (Array.isArray(model?.nodes) ? model.nodes : []).map((node) => {
      const firstCoord = Array.isArray(node?.coords) ? node.coords[0] || {} : {};
      const world = firstCoord?.world || null;
      const buffer = firstCoord?.buffer || null;
      return {
        id: `${id}:${node?.nodeId ?? ''}`,
        coords: {
          world: world && typeof world === 'object' ? world : (buffer && typeof buffer === 'object' ? buffer : null),
          buffer: buffer && typeof buffer === 'object' ? buffer : null
        }
      };
    });
    modelsById[id] = {
      id,
      name: str(model?.name || id),
      type: str(model?.type || model?.displayAs || 'Model') || 'Model',
      typeCategory: str(model?.displayAs || model?.type || 'unknown') || 'unknown',
      startChannel,
      endChannel,
      transform: {
        position: {
          x: toFinite(center?.x),
          y: toFinite(center?.y),
          z: toFinite(center?.z)
        }
      },
      nodes
    };
  }
  return {
    modelsById,
    groupsById: {},
    submodelsById: {},
    stats: {
      modelCount: Object.keys(modelsById).length,
      groupCount: 0,
      submodelCount: 0,
      layoutMode: 'live_geometry_export'
    }
  };
}

function buildSyntheticHandoff(designSceneContext) {
  const focal = Array.isArray(designSceneContext?.focalCandidates) ? designSceneContext.focalCandidates : [];
  const broad = Array.isArray(designSceneContext?.coverageDomains?.broad) ? designSceneContext.coverageDomains.broad : [];
  return {
    artifactType: 'sequencing_design_handoff_v1',
    artifactVersion: 1,
    designSummary: 'Validate live real-show render feedback against the display hierarchy.',
    focusPlan: {
      primaryTargets: focal.slice(0, 1),
      secondaryTargets: focal.slice(1, 4),
      balanceRule: 'Keep one clear focal lead with restrained support.'
    },
    sectionDirectives: [
      {
        preferredVisualFamilies: broad.slice(0, 4),
        notes: 'Maintain a coherent whole-scene read without split focus.',
        motionTarget: 'measured_motion',
        densityTarget: 'moderate'
      }
    ],
    scope: {
      sections: ['live_real_show_window']
    },
    avoidances: ['split focus', 'flat whole-house wash']
  };
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.geometry || !args.fseq || !args.api || !args['proof-id']) usage();

  const geometryPath = path.resolve(args.geometry);
  const fseqPath = path.resolve(args.fseq);
  const apiBase = String(args.api).replace(/\/$/, '');
  const proofId = str(args['proof-id']);
  const startMs = Number(args['start-ms'] || 0);
  const endMs = Number(args['end-ms'] || 250);
  const maxFrames = Number(args['max-frames'] || 5);

  const geometry = JSON.parse(await fs.readFile(geometryPath, 'utf8'));
  const sceneGraph = geometryToSceneGraph(geometry);
  const designSceneContext = buildDesignSceneContext({ sceneGraph, revision: proofId });
  const sequencingDesignHandoff = buildSyntheticHandoff(designSceneContext);
  const targetIds = [
    ...(sequencingDesignHandoff?.focusPlan?.primaryTargets || []),
    ...(sequencingDesignHandoff?.focusPlan?.secondaryTargets || [])
  ];
  const samplingPlan = buildRenderSamplingPlan(sceneGraph, { targetIds });

  const response = await fetch(`${apiBase}/sequence/render-samples`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fseqPath,
      startMs,
      endMs,
      maxFrames,
      frameStride: 0,
      channelRanges: samplingPlan.channelRanges
    })
  });
  const sampleResponse = await response.json();
  if (!response.ok || sampleResponse?.ok === false) {
    throw new Error(`render sample request failed: ${response.status} ${JSON.stringify(sampleResponse)}`);
  }

  const renderObservation = buildRenderObservationFromSamples({
    samplingPlan,
    sampleResponse,
    sequencePath: fseqPath.replace(/\.fseq$/i, '.xsq'),
    revisionToken: proofId
  });
  const renderCritiqueContext = buildRenderCritiqueContext({
    renderObservation,
    designSceneContext,
    sequencingDesignHandoff
  });

  const proofsDir = path.resolve('scripts/sequencer-render-training/proofs');
  const geometryOut = path.join(proofsDir, `preview-scene-geometry-${proofId}.json`);
  const observationOut = path.join(proofsDir, `render-observation-${proofId}.json`);
  const critiqueOut = path.join(proofsDir, `render-critique-context-${proofId}.json`);
  const summaryOut = path.join(proofsDir, `live-render-proof-${proofId}.json`);

  await fs.writeFile(geometryOut, JSON.stringify(geometry, null, 2) + '\n');
  await fs.writeFile(observationOut, JSON.stringify(renderObservation, null, 2) + '\n');
  await fs.writeFile(critiqueOut, JSON.stringify(renderCritiqueContext, null, 2) + '\n');
  await fs.writeFile(summaryOut, JSON.stringify({
    proofId,
    geometryPath: geometryOut,
    observationPath: observationOut,
    critiquePath: critiqueOut,
    modelCount: geometry?.summaries?.modelCount ?? null,
    customModelCount: Array.isArray(geometry?.scene?.models) ? geometry.scene.models.filter((row) => str(row?.displayAs || row?.type) === 'Custom').length : 0,
    sampledModelCount: renderObservation?.source?.sampledModelCount ?? null,
    sampledRange: {
      startMs: renderObservation?.source?.startMs ?? null,
      endMs: renderObservation?.source?.endMs ?? null
    },
    leadModel: renderObservation?.macro?.leadModel ?? '',
    activeModelCount: Array.isArray(renderObservation?.macro?.activeModelNames) ? renderObservation.macro.activeModelNames.length : 0,
    breadthRead: renderCritiqueContext?.observed?.breadthRead ?? '',
    leadMatchesPrimaryFocus: renderCritiqueContext?.comparison?.leadMatchesPrimaryFocus ?? null
  }, null, 2) + '\n');

  console.log(JSON.stringify({
    ok: true,
    proofId,
    geometryOut,
    observationOut,
    critiqueOut,
    summaryOut,
    sampledModelCount: renderObservation?.source?.sampledModelCount ?? null,
    leadModel: renderObservation?.macro?.leadModel ?? '',
    activeModelCount: Array.isArray(renderObservation?.macro?.activeModelNames) ? renderObservation.macro.activeModelNames.length : 0
  }, null, 2));
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});
