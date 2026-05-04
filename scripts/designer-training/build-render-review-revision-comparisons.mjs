#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildRenderReviewFromFseq } from './build-render-review-from-fseq.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function str(value = '') {
  return String(value || '').trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function number(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function resolvePath(filePath = '') {
  const value = str(filePath);
  if (!value) return '';
  return path.isAbsolute(value) ? value : path.resolve(REPO_ROOT, value);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function delta(after, before) {
  return Math.round((number(after) - number(before)) * 1_000_000) / 1_000_000;
}

function compareReviews({ execution = {}, originalReview = {}, revisedReview = {}, revisedReviewPath = '' } = {}) {
  const scoreDeltas = {
    overallQuality: delta(revisedReview.qualityScores?.overallQuality, originalReview.qualityScores?.overallQuality),
    visualReadability: delta(revisedReview.qualityScores?.visualReadability, originalReview.qualityScores?.visualReadability),
    intentMatch: delta(revisedReview.qualityScores?.intentMatch, originalReview.qualityScores?.intentMatch),
    motionCoherence: delta(revisedReview.qualityScores?.motionCoherence, originalReview.qualityScores?.motionCoherence)
  };
  const metricDeltas = {
    blankRisk: delta(revisedReview.deterministicMetrics?.blankRisk, originalReview.deterministicMetrics?.blankRisk),
    activeCoverageMean: delta(revisedReview.deterministicMetrics?.activeCoverageMean, originalReview.deterministicMetrics?.activeCoverageMean),
    temporalMotionMean: delta(revisedReview.deterministicMetrics?.temporalMotionMean, originalReview.deterministicMetrics?.temporalMotionMean),
    clutterRisk: delta(revisedReview.deterministicMetrics?.clutterRisk, originalReview.deterministicMetrics?.clutterRisk),
    overexposureRisk: delta(revisedReview.deterministicMetrics?.overexposureRisk, originalReview.deterministicMetrics?.overexposureRisk)
  };
  const originalDecision = str(originalReview.critique?.decision);
  const revisedDecision = str(revisedReview.critique?.decision);
  const acceptedAfterRevision = revisedDecision === 'accept';
  const improved = acceptedAfterRevision
    || scoreDeltas.overallQuality > 0.03
    || (metricDeltas.blankRisk < -0.1 && scoreDeltas.visualReadability >= 0);
  return {
    artifactType: 'render_review_revision_comparison_v1',
    artifactVersion: '1.0',
    attemptId: str(execution.attemptId),
    revisionObjectiveId: str(execution.revisionObjectiveId),
    effectName: str(execution.effectName),
    targets: arr(execution.targets).map(str).filter(Boolean),
    refs: {
      originalRenderReviewRef: str(execution.originalRenderReviewRef),
      revisedRenderReviewRef: revisedReviewPath,
      revisedFseqPath: str(execution.fseqPath)
    },
    decisions: {
      before: originalDecision,
      after: revisedDecision,
      acceptedAfterRevision
    },
    scoreDeltas,
    metricDeltas,
    quality: {
      improved,
      retainRevision: acceptedAfterRevision || (improved && revisedDecision !== 'reject'),
      regression: scoreDeltas.overallQuality < -0.03 || metricDeltas.blankRisk > 0.1
    }
  };
}

export function buildRenderReviewRevisionComparisons({
  executionPath = '',
  execution = null,
  geometryPath = '',
  outDir = '',
  outPath = '',
  windowStartMs = 0,
  windowEndMs = 8000,
  stepMs = 50,
  sampleCount = 8,
  width = 1280,
  height = 720,
  fps = 20,
  nodeRadius = 3,
  buildFseqReview = buildRenderReviewFromFseq
} = {}) {
  const resolvedExecutionPath = resolvePath(executionPath);
  const executionIndex = execution || (resolvedExecutionPath ? readJson(resolvedExecutionPath) : {});
  const resolvedGeometryPath = resolvePath(geometryPath);
  const resolvedOutDir = resolvePath(outDir || path.join(REPO_ROOT, 'var/tmp/render-review-revision-comparisons'));
  fs.mkdirSync(resolvedOutDir, { recursive: true });

  const comparisons = [];
  const skipped = [];
  for (const [index, result] of arr(executionIndex.results).entries()) {
    const label = str(result.attemptId || `attempt-${index + 1}`)
      .replace(/[^a-z0-9_.-]+/gi, '-')
      .replace(/^-|-$/g, '') || `attempt-${index + 1}`;
    const originalPath = resolvePath(result.originalRenderReviewRef);
    const fseqPath = resolvePath(result.fseqPath);
    if (result.ok !== true || result.skipped === true) {
      skipped.push({ attemptId: str(result.attemptId), reason: result.skipped ? str(result.skipReason || 'skipped') : str(result.error || 'execution failed') });
      continue;
    }
    if (!originalPath || !fs.existsSync(originalPath)) {
      skipped.push({ attemptId: str(result.attemptId), reason: `original render review not found: ${originalPath || '(missing)'}` });
      continue;
    }
    if (!fseqPath || !fs.existsSync(fseqPath)) {
      skipped.push({ attemptId: str(result.attemptId), reason: `revised FSEQ not found: ${fseqPath || '(missing)'}` });
      continue;
    }
    try {
      const reviewRun = buildFseqReview({
        geometryPath: resolvedGeometryPath,
        fseqPath,
        outDir: path.join(resolvedOutDir, 'revised-reviews', label),
        windowStartMs,
        windowEndMs,
        stepMs,
        sampleCount,
        width,
        height,
        fps,
        nodeRadius
      });
      const comparison = compareReviews({
        execution: result,
        originalReview: readJson(originalPath),
        revisedReview: readJson(reviewRun.renderReviewPath),
        revisedReviewPath: str(reviewRun.renderReviewPath)
      });
      comparisons.push(comparison);
    } catch (error) {
      skipped.push({ attemptId: str(result.attemptId), reason: str(error?.message || error) });
    }
  }

  const artifact = {
    artifactType: 'render_review_revision_comparison_index_v1',
    artifactVersion: '1.0',
    createdAt: new Date().toISOString(),
    source: {
      executionRef: resolvedExecutionPath,
      geometryRef: resolvedGeometryPath,
      executionCount: arr(executionIndex.results).length
    },
    summary: {
      comparisonCount: comparisons.length,
      skippedCount: skipped.length,
      improvedCount: comparisons.filter((row) => row.quality.improved).length,
      acceptedAfterRevisionCount: comparisons.filter((row) => row.decisions.acceptedAfterRevision).length,
      regressionCount: comparisons.filter((row) => row.quality.regression).length,
      retainRevisionCount: comparisons.filter((row) => row.quality.retainRevision).length
    },
    comparisons,
    skipped
  };
  const resolvedOutPath = resolvePath(outPath);
  if (resolvedOutPath) writeJson(resolvedOutPath, artifact);
  return artifact;
}

function parseArgs(argv = []) {
  const args = { executionPath: '', geometryPath: '', outDir: '', outPath: '', windowStartMs: 0, windowEndMs: 8000, sampleCount: 8, width: 1280, height: 720, fps: 20, nodeRadius: 3 };
  for (let index = 0; index < argv.length; index += 1) {
    const token = str(argv[index]);
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${token}`);
      return argv[index];
    };
    if (token === '--execution') args.executionPath = next();
    else if (token === '--geometry') args.geometryPath = next();
    else if (token === '--out-dir') args.outDir = next();
    else if (token === '--out') args.outPath = next();
    else if (token === '--window-start-ms') args.windowStartMs = Number(next());
    else if (token === '--window-end-ms') args.windowEndMs = Number(next());
    else if (token === '--sample-count') args.sampleCount = Number(next());
    else if (token === '--width') args.width = Number(next());
    else if (token === '--height') args.height = Number(next());
    else if (token === '--fps') args.fps = Number(next());
    else if (token === '--node-radius') args.nodeRadius = Number(next());
    else if (token === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${token}`);
  }
  return args;
}

function usage() {
  return `Usage:
  node scripts/designer-training/build-render-review-revision-comparisons.mjs --execution execution.json --geometry preview-scene-geometry.json --out comparison.json
`;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help || !args.executionPath || !args.geometryPath) {
      process.stdout.write(usage());
      process.exit(args.help ? 0 : 1);
    }
    const artifact = buildRenderReviewRevisionComparisons(args);
    process.stdout.write(`${JSON.stringify(artifact, null, 2)}\n`);
  } catch (error) {
    console.error(error?.stack || String(error));
    process.exit(1);
  }
}
