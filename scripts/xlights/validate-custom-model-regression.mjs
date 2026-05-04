#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

import { getModels, getSubmodels } from '../../apps/xlightsdesigner-ui/api.js';
import { buildDiagnosticsDashboardState } from '../../apps/xlightsdesigner-ui/app-ui/page-state/diagnostics-dashboard-state.js';
import { persistAppTargetBehaviorLearning } from '../sequencing/app/apply-app-review.mjs';

const DEFAULT_ENDPOINT = process.env.XLIGHTS_ENDPOINT || 'http://127.0.0.1:49915/xlightsdesigner/api';

function str(value = '') {
  return String(value || '').trim();
}

function usage() {
  return [
    'Usage:',
    '  node scripts/xlights/validate-custom-model-regression.mjs [options]',
    '',
    'Options:',
    '  --endpoint <url>          Owned xLights API base URL.',
  '  --show-dir <path>         Optional show folder to switch to before validation.',
  '  --target-model <name>     Optional model or submodel target for live apply/render.',
  '  --target-scope <scope>    Target scope: custom_submodel or builtin_model. Defaults to custom_submodel.',
    '  --effect-name <name>      Effect for live apply/render. Defaults to On.',
    '  --duration-ms <number>    Sequence duration for live apply/render. Defaults to 8000.',
    '  --run-id <id>             Optional run id. Defaults to timestamp.',
    '  --output <path>           Optional consolidated report path.',
    '  --help                    Show this help.'
  ].join('\n');
}

function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    endpoint: DEFAULT_ENDPOINT,
    showDir: '',
    targetModel: '',
    targetScope: 'custom_submodel',
    effectName: 'On',
    durationMs: 8000,
    runId: `custom-model-regression-${new Date().toISOString().replace(/[:.]/g, '-')}`,
    output: ''
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = str(argv[index]);
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${token}`);
      return argv[index];
    };
    if (token === '--help') {
      console.log(usage());
      process.exit(0);
    } else if (token === '--endpoint') args.endpoint = str(next()) || args.endpoint;
    else if (token === '--show-dir') args.showDir = path.resolve(str(next()));
    else if (token === '--target-model') args.targetModel = str(next());
    else if (token === '--target-scope') args.targetScope = str(next()) || args.targetScope;
    else if (token === '--effect-name') args.effectName = str(next()) || args.effectName;
    else if (token === '--duration-ms') args.durationMs = Number(next());
    else if (token === '--run-id') args.runId = str(next()) || args.runId;
    else if (token === '--output') args.output = path.resolve(str(next()));
    else throw new Error(`Unknown argument: ${token}`);
  }
  if (!Number.isFinite(args.durationMs) || args.durationMs <= 0) {
    throw new Error('--duration-ms must be a positive number.');
  }
  if (!['custom_submodel', 'builtin_model'].includes(args.targetScope)) {
    throw new Error('--target-scope must be one of: custom_submodel, builtin_model.');
  }
  return args;
}

function runNodeScript(scriptPath, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'),
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${path.basename(scriptPath)} failed with exit code ${code}\n${stderr || stdout}`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function readJson(filePath = '') {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath = '', value = {}) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function submodelRowsFrom(body = {}) {
  const rows = Array.isArray(body?.data?.submodels) ? body.data.submodels : [];
  return rows.map((row) => {
    const id = str(row?.fullName || row?.id || row?.name);
    const parentId = str(row?.parentName || row?.parentId || (id.includes('/') ? id.split('/')[0] : ''));
    return id ? { ...row, id, parentId } : null;
  }).filter(Boolean);
}

function selectCustomSubmodel({ requestedTarget = '', customModels = [], submodels = [] } = {}) {
  if (requestedTarget) return requestedTarget;
  const customModelIds = new Set(customModels.flatMap((row) => [
    str(row?.targetId),
    str(row?.modelName)
  ]).filter(Boolean));
  const match = submodels.find((row) => customModelIds.has(str(row?.parentId)));
  return str(match?.id);
}

function canonicalTypeFromDisplayAs(displayAs = '') {
  const value = str(displayAs).toLowerCase();
  if (!value) return 'model';
  if (value === 'single line') return 'single_line';
  if (value === 'modelgroup') return 'model_group';
  return value.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'model';
}

function selectBuiltInModel({ requestedTarget = '', models = [] } = {}) {
  const rows = models
    .map((row) => ({ ...row, name: str(row?.name || row?.id), canonicalType: canonicalTypeFromDisplayAs(row?.displayAs || row?.type) }))
    .filter((row) => row.name && row.canonicalType !== 'custom' && row.canonicalType !== 'model_group');
  if (requestedTarget) {
    const match = rows.find((row) => row.name === requestedTarget || str(row?.id) === requestedTarget);
    if (!match) throw new Error(`Requested built-in model target was not found: ${requestedTarget}`);
    return match;
  }
  const priority = ['matrix', 'tree', 'single_line', 'arches', 'arch'];
  return rows.sort((left, right) => {
    const leftRank = priority.includes(left.canonicalType) ? priority.indexOf(left.canonicalType) : priority.length;
    const rightRank = priority.includes(right.canonicalType) ? priority.indexOf(right.canonicalType) : priority.length;
    return leftRank - rightRank || left.name.localeCompare(right.name);
  })[0] || null;
}

async function runProjectPersistenceFixture({ outputRoot = '', parentModel = null, targetModel = '', effectName = 'On' } = {}) {
  const projectDir = fs.mkdtempSync(path.join(outputRoot || os.tmpdir(), 'xld-custom-model-project-'));
  const displayDir = path.join(projectDir, 'display');
  fs.mkdirSync(displayDir, { recursive: true });
  const projectFile = path.join(projectDir, 'Project.xdproj');
  fs.writeFileSync(projectFile, JSON.stringify({ projectName: 'Custom Model Regression' }), 'utf8');

  const parentId = str(parentModel?.targetId || parentModel?.modelName || 'CustomFace');
  const parentName = str(parentModel?.modelName || parentId);
  const targetId = str(targetModel) || `${parentId}/@Mouth1`;
  writeJson(path.join(displayDir, 'model-index.json'), {
    artifactType: 'target_metadata_index_v1',
    artifactVersion: '1.0',
    records: [
      {
        targetId: parentId,
        targetKind: 'model',
        identity: {
          displayName: parentName,
          rawType: str(parentModel?.rawType || 'Custom'),
          canonicalType: 'custom',
          fingerprint: str(parentModel?.fingerprint || 'tmf1:custom-parent'),
          fingerprintVersion: str(parentModel?.fingerprintVersion || 'target-metadata-fingerprint-v1')
        },
        structure: {
          customStructure: {
            profile: str(parentModel?.profile || 'custom_structure'),
            traits: Array.isArray(parentModel?.traits) ? parentModel.traits : ['custom_structure'],
            confidence: Number(parentModel?.confidence || 0.5),
            nodeCount: Number(parentModel?.nodeCount || 100),
            submodels: { count: Number(parentModel?.submodels?.count || 1) },
            construction: {
              source: str(parentModel?.construction?.source || 'layout.getModelNodes'),
              dimensions: parentModel?.construction?.dimensions || {}
            }
          }
        }
      },
      {
        targetId,
        targetKind: 'submodel',
        identity: {
          displayName: targetId,
          canonicalType: 'submodel',
          fingerprint: 'tmf1:custom-submodel-regression',
          fingerprintVersion: 'target-metadata-fingerprint-v1',
          parentId,
          parentName
        },
        structure: {
          submodelMetadata: {
            parentId,
            parentName,
            siblingCount: Number(parentModel?.submodels?.count || 1),
            nodeCoverage: { nodeCount: 12, parentNodeCount: Number(parentModel?.nodeCount || 100), ratio: 0.12 },
            structureHints: ['custom_submodel']
          }
        }
      }
    ]
  });

  const write = await persistAppTargetBehaviorLearning({
    projectFile,
    commands: [
      { id: 'effect-custom-submodel', cmd: 'effects.create', params: { modelName: targetId, effectName: str(effectName) || 'On', startMs: 0, endMs: 1000 } }
    ],
    renderObservation: {
      artifactId: 'render-custom-model-regression',
      macro: { coverageRead: 'partial', temporalRead: 'flat', activeCoverageRatio: 0.12 }
    },
    renderValidationEvidence: {
      renderObservationRef: 'render-custom-model-regression',
      submodelEvidence: [
        {
          targetId,
          siblingCount: Number(parentModel?.submodels?.count || 1),
          nodeCoverage: { nodeCount: 12, parentNodeCount: Number(parentModel?.nodeCount || 100), ratio: 0.12 },
          structureHints: ['custom_submodel']
        }
      ]
    },
    renderCritiqueContext: {
      observed: { coverageRead: 'partial', temporalRead: 'flat', activeCoverageRatio: 0.12 },
      quality: { band: 'acceptable', issues: [] }
    },
    planHandoff: { artifactId: 'plan-custom-model-regression' },
    applyResult: { artifactId: 'apply-custom-model-regression' }
  });
  const document = write?.artifactPath && fs.existsSync(write.artifactPath) ? readJson(write.artifactPath) : null;
  return {
    ok: write?.ok === true && write?.skipped !== true && Array.isArray(document?.records) && document.records.length === 1,
    projectFile,
    artifactPath: write?.artifactPath || '',
    write,
    summary: {
      recordCount: Number(document?.records?.length || 0),
      targetId: str(document?.records?.[0]?.targetId),
      targetKind: str(document?.records?.[0]?.targetKind),
      parentContextProfile: str(document?.records?.[0]?.parentContext?.customStructure?.profile),
      submodelNodeCount: Number(document?.records?.[0]?.submodelContext?.nodeCoverage?.nodeCount || 0),
      positiveCount: Number(document?.records?.[0]?.stats?.positiveCount || 0)
    }
  };
}

async function runBuiltInModelPersistenceFixture({ outputRoot = '', targetModel = null, effectName = 'On' } = {}) {
  const projectDir = fs.mkdtempSync(path.join(outputRoot || os.tmpdir(), 'xld-builtin-model-project-'));
  const displayDir = path.join(projectDir, 'display');
  fs.mkdirSync(displayDir, { recursive: true });
  const projectFile = path.join(projectDir, 'Project.xdproj');
  fs.writeFileSync(projectFile, JSON.stringify({ projectName: 'Built In Model Regression' }), 'utf8');

  const targetId = str(targetModel?.name || targetModel?.id || 'BuiltInModel');
  const canonicalType = canonicalTypeFromDisplayAs(targetModel?.displayAs || targetModel?.type);
  writeJson(path.join(displayDir, 'model-index.json'), {
    artifactType: 'target_metadata_index_v1',
    artifactVersion: '1.0',
    records: [
      {
        targetId,
        targetKind: 'model',
        identity: {
          displayName: targetId,
          rawType: str(targetModel?.displayAs || targetModel?.type || canonicalType),
          canonicalType,
          fingerprint: str(targetModel?.fingerprint || `tmf1:${canonicalType}:${targetId}`),
          fingerprintVersion: str(targetModel?.fingerprintVersion || 'target-metadata-fingerprint-v1')
        },
        structure: {
          modelMetadata: {
            displayAs: str(targetModel?.displayAs),
            nodeCount: Number(targetModel?.nodeCount || targetModel?.nodes || 0) || null,
            dimensions: {
              width: Number(targetModel?.width || 0) || null,
              height: Number(targetModel?.height || 0) || null,
              depth: Number(targetModel?.depth || 0) || null
            }
          }
        }
      }
    ]
  });

  const write = await persistAppTargetBehaviorLearning({
    projectFile,
    commands: [
      { id: 'effect-built-in-model', cmd: 'effects.create', params: { modelName: targetId, effectName: str(effectName) || 'On', startMs: 0, endMs: 1000 } }
    ],
    renderObservation: {
      artifactId: 'render-built-in-model-regression',
      macro: { coverageRead: 'broad', temporalRead: 'flat', activeCoverageRatio: 0.75 }
    },
    renderValidationEvidence: {
      renderObservationRef: 'render-built-in-model-regression',
      submodelEvidence: []
    },
    renderCritiqueContext: {
      observed: { coverageRead: 'broad', temporalRead: 'flat', activeCoverageRatio: 0.75 },
      quality: { band: 'acceptable', issues: [] }
    },
    planHandoff: { artifactId: 'plan-built-in-model-regression' },
    applyResult: { artifactId: 'apply-built-in-model-regression' }
  });
  const document = write?.artifactPath && fs.existsSync(write.artifactPath) ? readJson(write.artifactPath) : null;
  return {
    ok: write?.ok === true && write?.skipped !== true && Array.isArray(document?.records) && document.records.length === 1,
    projectFile,
    artifactPath: write?.artifactPath || '',
    write,
    summary: {
      recordCount: Number(document?.records?.length || 0),
      targetId: str(document?.records?.[0]?.targetId),
      targetKind: str(document?.records?.[0]?.targetKind),
      canonicalType: str(document?.records?.[0]?.parentContext?.canonicalType || canonicalType),
      positiveCount: Number(document?.records?.[0]?.stats?.positiveCount || 0)
    }
  };
}

async function main() {
  const args = parseArgs();
  const root = path.resolve('var/reports', args.runId);
  fs.mkdirSync(root, { recursive: true });

  const capturePath = path.join(root, 'custom-model-api-capture.json');
  const captureArgs = ['scripts/sequence-metadata/validate-custom-model-api-capture.mjs', '--endpoint', args.endpoint, '--output', capturePath];
  if (args.showDir) captureArgs.push('--show-dir', args.showDir, '--force-show-dir');
  await runNodeScript(captureArgs[0], captureArgs.slice(1));
  const capture = readJson(capturePath);
  const captureSummary = capture.summary || {};
  if (Number(captureSummary.customSummaryCount || 0) <= 0) {
    throw new Error('Custom model capture returned no custom models.');
  }
  if (Number(captureSummary.customWithApiNodeLayoutCount || 0) <= 0) {
    throw new Error('Custom model capture returned no API node layouts.');
  }
  if (Array.isArray(captureSummary.customWithoutApiConstructionNames) && captureSummary.customWithoutApiConstructionNames.length) {
    throw new Error(`Custom model capture found models without construction data: ${captureSummary.customWithoutApiConstructionNames.join(', ')}`);
  }

  const submodels = submodelRowsFrom(await getSubmodels(args.endpoint));
  const modelsBody = await getModels(args.endpoint);
  const models = Array.isArray(modelsBody?.data?.models) ? modelsBody.data.models : [];
  const builtInModel = args.targetScope === 'builtin_model'
    ? selectBuiltInModel({ requestedTarget: args.targetModel, models })
    : null;
  const liveTarget = args.targetScope === 'builtin_model'
    ? str(builtInModel?.name || builtInModel?.id)
    : selectCustomSubmodel({
        requestedTarget: args.targetModel,
        customModels: capture.customModels,
        submodels
      });
  if (!liveTarget) {
    throw new Error(`Could not select a ${args.targetScope} target for live apply/render validation.`);
  }

  const showDir = args.showDir || str(capture.activeShowDirectory);
  if (!showDir) {
    throw new Error('No active show directory was available for live apply/render validation.');
  }
  await runNodeScript('scripts/xlights/validate-owned-show-folder-flow.mjs', [
    '--endpoint', args.endpoint,
    '--show-dir', showDir,
    '--target-model', liveTarget,
    '--effect-name', args.effectName,
    '--duration-ms', String(args.durationMs),
    '--run-id', args.runId
  ]);

  const liveEvidencePath = path.join(showDir, '_xlightsdesigner_api_validation', args.runId, 'owned-api-validation-result.json');
  const liveEvidence = readJson(liveEvidencePath);
  const expectedTargetKind = args.targetScope === 'builtin_model' ? 'model' : 'submodel';
  if (liveEvidence?.ok !== true || liveEvidence?.expectedFseqExists !== true || liveEvidence?.targetKind !== expectedTargetKind) {
    throw new Error(`Live ${args.targetScope} apply/render validation failed: ${liveEvidencePath}`);
  }

  const selectedParentId = str(submodels.find((row) => row.id === liveTarget)?.parentId);
  const parentModel = (capture.customModels || []).find((row) => str(row?.targetId) === selectedParentId || str(row?.modelName) === selectedParentId) || capture.customModels?.[0] || null;
  const persistence = args.targetScope === 'builtin_model'
    ? await runBuiltInModelPersistenceFixture({
        outputRoot: root,
        targetModel: builtInModel,
        effectName: args.effectName
      })
    : await runProjectPersistenceFixture({
        outputRoot: root,
        parentModel,
        targetModel: liveTarget,
        effectName: args.effectName
      });
  if (!persistence.ok) {
    throw new Error('Project target behavior persistence fixture failed.');
  }
  const persistedTargetBehavior = readJson(persistence.artifactPath);
  const diagnostics = buildDiagnosticsDashboardState({
    state: {
      ui: { diagnosticsOpen: true, diagnosticsFilter: 'all' },
      sceneGraph: {},
      diagnostics: [],
      applyHistory: [],
      sequenceAgentRuntime: {
        targetBehaviorLearning: {
          artifactPath: persistence.artifactPath,
          records: persistedTargetBehavior.records || []
        }
      },
      health: {}
    }
  });
  const diagnosticHealth = diagnostics?.data?.health || {};
  const expectedSubmodelCount = args.targetScope === 'builtin_model' ? 0 : 1;
  const expectedCustomParentCount = args.targetScope === 'builtin_model' ? 0 : 1;
  if (
    Number(diagnosticHealth.targetBehaviorLearningCount || 0) !== 1 ||
    Number(diagnosticHealth.targetBehaviorLearningSubmodelCount || 0) !== expectedSubmodelCount ||
    Number(diagnosticHealth.targetBehaviorLearningCustomParentCount || 0) !== expectedCustomParentCount
  ) {
    throw new Error(`Diagnostics target behavior summary did not reflect persisted ${args.targetScope} learning.`);
  }

  const report = {
    artifactType: 'custom_model_regression_validation_v1',
    artifactVersion: '1.0',
    createdAt: new Date().toISOString(),
    endpoint: args.endpoint,
    showDir,
    targetScope: args.targetScope,
    liveTarget,
    capturePath,
    liveEvidencePath,
    persistenceArtifactPath: persistence.artifactPath,
    summary: {
      capture: captureSummary,
      liveApply: {
        targetModel: str(liveEvidence.targetModel),
        targetKind: str(liveEvidence.targetKind),
        expectedFseqExists: liveEvidence.expectedFseqExists === true,
        layoutModelCount: Number(liveEvidence.layoutModelCount || 0),
        layoutSubmodelCount: Number(liveEvidence.layoutSubmodelCount || 0)
      },
      persistence: persistence.summary,
      diagnostics: {
        targetBehaviorLearningCount: Number(diagnosticHealth.targetBehaviorLearningCount || 0),
        targetBehaviorLearningSubmodelCount: Number(diagnosticHealth.targetBehaviorLearningSubmodelCount || 0),
        targetBehaviorLearningCustomParentCount: Number(diagnosticHealth.targetBehaviorLearningCustomParentCount || 0),
        targetBehaviorLearningArtifactPath: str(diagnosticHealth.targetBehaviorLearningArtifactPath)
      }
    }
  };
  const outputPath = args.output || path.join(root, 'custom-model-regression-report.json');
  writeJson(outputPath, report);
  console.log(JSON.stringify({
    ok: true,
    outputPath,
    targetScope: args.targetScope,
    liveTarget,
    captureCustomModelCount: Number(captureSummary.customSummaryCount || 0),
    captureSubmodelCount: Number(captureSummary.submodelCount || 0),
    targetBehaviorRecordCount: persistence.summary.recordCount,
    diagnosticsTargetBehaviorCount: Number(diagnosticHealth.targetBehaviorLearningCount || 0)
  }, null, 2));
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().catch((error) => {
    console.error(error.stack || String(error));
    process.exit(1);
  });
}
