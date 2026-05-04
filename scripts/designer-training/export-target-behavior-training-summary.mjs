#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function str(value = '') {
  return String(value || '').trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function obj(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function stableHash(value = '') {
  let hash = 2166136261;
  const text = String(value || '');
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function numberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function unique(values = []) {
  return [...new Set(arr(values).map((row) => str(row)).filter(Boolean))];
}

function countBy(values = []) {
  return arr(values).reduce((counts, value) => {
    const key = str(value) || 'unknown';
    counts[key] = Number(counts[key] || 0) + 1;
    return counts;
  }, {});
}

function compactEvidenceRefs(evidenceRefs = {}) {
  const refs = obj(evidenceRefs);
  return {
    hasRenderObservation: Boolean(str(refs.renderObservationRef)),
    hasRenderCritiqueContext: Boolean(str(refs.renderCritiqueContextRef)),
    hasSequenceCritique: Boolean(str(refs.sequenceCritiqueRef)),
    hasPlanHandoff: Boolean(str(refs.planHandoffRef)),
    hasApplyResult: Boolean(str(refs.applyResultRef))
  };
}

function compactCustomStructure(customStructure = {}) {
  const source = obj(customStructure);
  if (!Object.keys(source).length) return null;
  return {
    profile: str(source.profile),
    traits: unique(source.traits).slice(0, 16),
    confidence: numberOrNull(source.confidence),
    nodeCount: numberOrNull(source.nodeCount),
    submodelCount: numberOrNull(source.submodelCount),
    constructionSource: str(source.constructionSource),
    dimensions: obj(source.dimensions)
  };
}

function compactParentContext(parentContext = {}) {
  const parent = obj(parentContext);
  if (!Object.keys(parent).length) return null;
  const context = {
    targetKind: str(parent.targetKind),
    canonicalType: str(parent.canonicalType),
    rawType: str(parent.rawType),
    targetFingerprintHash: str(parent.targetFingerprint) ? `tfh1:${stableHash(parent.targetFingerprint)}` : '',
    fingerprintVersion: str(parent.fingerprintVersion)
  };
  const customStructure = compactCustomStructure(parent.customStructure);
  if (customStructure) context.customStructure = customStructure;
  return context;
}

function compactSubmodelContext(submodelContext = {}) {
  const source = obj(submodelContext);
  const nodeCoverage = obj(source.nodeCoverage);
  return {
    siblingCount: numberOrNull(source.siblingCount),
    overlappingSiblingCount: arr(source.overlappingSiblingIds).length,
    nodeCoverage: {
      nodeCount: numberOrNull(nodeCoverage.nodeCount),
      parentNodeCount: numberOrNull(nodeCoverage.parentNodeCount),
      ratio: numberOrNull(nodeCoverage.ratio)
    }
  };
}

function compactOutcome(outcome = {}) {
  const source = obj(outcome);
  return {
    coverageRead: str(source.coverageRead),
    temporalRead: str(source.temporalRead),
    readability: str(source.readability),
    blankRisk: str(source.blankRisk),
    activeCoverageRatio: numberOrNull(source.activeCoverageRatio),
    confidence: str(source.confidence),
    noteCount: arr(source.notes).length
  };
}

function compactStats(stats = {}) {
  const source = obj(stats);
  return {
    sampleCount: Number(source.sampleCount || 0),
    positiveCount: Number(source.positiveCount || 0),
    negativeCount: Number(source.negativeCount || 0),
    lastObservedAt: str(source.lastObservedAt)
  };
}

function compactBehaviorRecord(record = {}) {
  const fingerprint = str(record.targetFingerprint);
  const targetIdentity = fingerprint || str(record.targetId) || str(record.displayName) || str(record.recordId);
  return {
    exportRecordId: `tbe1:${stableHash(str(record.recordId) || targetIdentity)}`,
    targetKind: str(record.targetKind),
    targetFingerprintHash: targetIdentity ? `tfh1:${stableHash(targetIdentity)}` : '',
    fingerprintVersion: str(record.fingerprintVersion),
    effectName: str(record.effectName),
    effectFamily: str(record.effectFamily || record.effectName),
    probeScope: str(record.probeScope),
    structureHints: unique(record.structureHints).slice(0, 16),
    submodelContext: compactSubmodelContext(record.submodelContext),
    parentContext: compactParentContext(record.parentContext),
    evidence: compactEvidenceRefs(record.evidenceRefs),
    outcome: compactOutcome(record.outcome),
    stats: compactStats(record.stats)
  };
}

function summarizeModelIndex(modelIndex = null) {
  const records = arr(modelIndex?.records).filter((row) => row && typeof row === 'object');
  const customRecords = records.filter((row) => str(row?.identity?.canonicalType) === 'custom');
  const submodelRecords = records.filter((row) => str(row?.targetKind) === 'submodel');
  return {
    available: records.length > 0,
    recordCount: records.length,
    targetKindCounts: countBy(records.map((row) => row?.targetKind)),
    canonicalTypeCounts: countBy(records.map((row) => row?.identity?.canonicalType)),
    customModelCount: customRecords.length,
    submodelCount: submodelRecords.length
  };
}

export function buildTargetBehaviorTrainingSummary({
  targetBehavior = null,
  modelIndex = null,
  sourceLabel = 'project display artifacts'
} = {}) {
  const records = arr(targetBehavior?.records).filter((row) => row && typeof row === 'object');
  const compactRecords = records.map((record) => compactBehaviorRecord(record));
  const submodelRecords = compactRecords.filter((record) => record.targetKind === 'submodel');
  const customParentRecords = compactRecords.filter((record) => record.parentContext?.canonicalType === 'custom');
  return {
    datasetId: 'target_behavior_training_summary',
    version: '1.0',
    source: {
      label: str(sourceLabel),
      derivedFrom: [
        'display/target-behavior.json',
        'display/model-index.json'
      ],
      privacy: 'anonymized_compact_summary',
      excludes: [
        'target ids',
        'display names',
        'parent names',
        'raw render artifacts',
        'full geometry payloads'
      ]
    },
    summary: {
      recordCount: compactRecords.length,
      submodelRecordCount: submodelRecords.length,
      customParentRecordCount: customParentRecords.length,
      targetKindCounts: countBy(compactRecords.map((record) => record.targetKind)),
      effectFamilyCounts: countBy(compactRecords.map((record) => record.effectFamily)),
      probeScopeCounts: countBy(compactRecords.map((record) => record.probeScope)),
      modelIndex: summarizeModelIndex(modelIndex)
    },
    records: compactRecords
  };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--project-dir') args.projectDir = argv[++index];
    else if (arg === '--target-behavior') args.targetBehaviorPath = argv[++index];
    else if (arg === '--model-index') args.modelIndexPath = argv[++index];
    else if (arg === '--out') args.outPath = argv[++index];
    else if (arg === '--source-label') args.sourceLabel = argv[++index];
    else if (arg === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (args.projectDir) {
    args.targetBehaviorPath ||= path.join(args.projectDir, 'display', 'target-behavior.json');
    args.modelIndexPath ||= path.join(args.projectDir, 'display', 'model-index.json');
  }
  return args;
}

function usage() {
  return `Usage:
  node scripts/designer-training/export-target-behavior-training-summary.mjs --project-dir <project-dir> [--out summary.json]
  node scripts/designer-training/export-target-behavior-training-summary.mjs --target-behavior <display/target-behavior.json> [--model-index <display/model-index.json>] [--out summary.json]
`;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help || !args.targetBehaviorPath) {
      process.stdout.write(usage());
      process.exit(args.help ? 0 : 1);
    }
    const targetBehavior = readJson(args.targetBehaviorPath);
    const modelIndex = args.modelIndexPath && fs.existsSync(args.modelIndexPath)
      ? readJson(args.modelIndexPath)
      : null;
    const summary = buildTargetBehaviorTrainingSummary({
      targetBehavior,
      modelIndex,
      sourceLabel: args.sourceLabel || path.basename(path.dirname(path.dirname(path.resolve(args.targetBehaviorPath))))
    });
    const output = `${JSON.stringify(summary, null, 2)}\n`;
    if (args.outPath) {
      fs.mkdirSync(path.dirname(args.outPath), { recursive: true });
      fs.writeFileSync(args.outPath, output);
    } else {
      process.stdout.write(output);
    }
  } catch (error) {
    console.error(error?.stack || String(error));
    process.exit(1);
  }
}
