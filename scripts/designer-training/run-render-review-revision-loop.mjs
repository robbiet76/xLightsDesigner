#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildRenderReviewRevisionAttempts } from './build-render-review-revision-attempts.mjs';
import { buildRenderReviewRevisionComparisons } from './build-render-review-revision-comparisons.mjs';
import { buildRenderReviewRevisionObjectives } from './build-render-review-revision-objectives.mjs';
import { runRenderReviewRevisionAttempts } from './run-render-review-revision-attempts.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_ENDPOINT = 'http://127.0.0.1:49915/xlightsdesigner/api';

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

function nextReviewPathsFromComparisons(comparisons = []) {
  return arr(comparisons)
    .filter((comparison) => comparison?.decisions?.acceptedAfterRevision !== true)
    .map((comparison) => str(comparison?.refs?.revisedRenderReviewRef))
    .filter(Boolean);
}

function loopStatus({ comparisons = {}, attempts = {}, execution = {}, iteration = 1, maxIterations = 1 } = {}) {
  const comparisonSummary = comparisons.summary || {};
  const attemptSummary = attempts.summary || {};
  const executionSummary = execution.summary || {};
  if (comparisonSummary.comparisonCount > 0 && comparisonSummary.acceptedAfterRevisionCount === comparisonSummary.comparisonCount) return 'accepted';
  if (comparisonSummary.regressionCount > 0) return 'regression';
  if (attemptSummary.plannedCount === 0) return 'blocked';
  if (executionSummary.failedCount > 0) return 'execution_failed';
  if (iteration >= maxIterations) return 'max_iterations_reached';
  return 'continue';
}

export async function runRenderReviewRevisionLoop({
  reviewPaths = [],
  cycleSummaryPath = '',
  geometryPath = '',
  outDir = '',
  endpoint = DEFAULT_ENDPOINT,
  maxIterations = 2,
  targetPolicy = {},
  defaultEffectName = '',
  layer = 0,
  clearExisting = false,
  executionMaxAttempts = 0,
  windowStartMs = 0,
  windowEndMs = 8000,
  stepMs = 50,
  sampleCount = 8,
  width = 1280,
  height = 720,
  fps = 20,
  nodeRadius = 3,
  deps = {},
  runAttempts = runRenderReviewRevisionAttempts,
  buildFseqReview
} = {}) {
  const resolvedOutDir = resolvePath(outDir || path.join(REPO_ROOT, 'var/tmp/render-review-revision-loop'));
  fs.mkdirSync(resolvedOutDir, { recursive: true });
  const resolvedGeometryPath = resolvePath(geometryPath);
  let currentReviewPaths = arr(reviewPaths).map(resolvePath).filter(Boolean);
  const resolvedCycleSummaryPath = resolvePath(cycleSummaryPath);
  const iterations = [];
  const max = Math.max(1, number(maxIterations, 2));
  let status = 'not_started';

  for (let index = 0; index < max; index += 1) {
    const iterationNumber = index + 1;
    const iterationDir = path.join(resolvedOutDir, `iteration-${String(iterationNumber).padStart(2, '0')}`);
    fs.mkdirSync(iterationDir, { recursive: true });
    const objectivesPath = path.join(iterationDir, 'render-review-revision-objectives.json');
    const attemptsPath = path.join(iterationDir, 'render-review-revision-attempts.json');
    const executionPath = path.join(iterationDir, 'render-review-revision-execution.json');
    const comparisonsPath = path.join(iterationDir, 'render-review-revision-comparisons.json');

    const objectives = buildRenderReviewRevisionObjectives({
      reviewPaths: currentReviewPaths,
      cycleSummaryPath: iterationNumber === 1 ? resolvedCycleSummaryPath : '',
      outPath: objectivesPath
    });
    const attempts = buildRenderReviewRevisionAttempts({
      objectives,
      outPath: attemptsPath,
      targetPolicy,
      defaultEffectName,
      layer,
      clearExisting
    });
    const execution = await runAttempts({
      attempts,
      outPath: executionPath,
      endpoint,
      maxAttempts: executionMaxAttempts,
      deps
    });
    const comparisonArgs = {
      execution,
      geometryPath: resolvedGeometryPath,
      outPath: comparisonsPath,
      outDir: path.join(iterationDir, 'render-review-revision-comparison'),
      windowStartMs,
      windowEndMs,
      stepMs,
      sampleCount,
      width,
      height,
      fps,
      nodeRadius
    };
    if (buildFseqReview) comparisonArgs.buildFseqReview = buildFseqReview;
    const comparisons = buildRenderReviewRevisionComparisons(comparisonArgs);
    status = loopStatus({ comparisons, attempts, execution, iteration: iterationNumber, maxIterations: max });
    iterations.push({
      iteration: iterationNumber,
      status,
      paths: {
        objectivesPath,
        attemptsPath,
        executionPath,
        comparisonsPath
      },
      summaries: {
        objectives: objectives.summary,
        attempts: attempts.summary,
        execution: execution.summary,
        comparisons: comparisons.summary
      }
    });
    if (status !== 'continue') break;
    currentReviewPaths = nextReviewPathsFromComparisons(comparisons.comparisons);
    if (!currentReviewPaths.length) {
      status = 'blocked';
      iterations[iterations.length - 1].status = status;
      break;
    }
  }

  const artifact = {
    artifactType: 'render_review_revision_loop_v1',
    artifactVersion: '1.0',
    createdAt: new Date().toISOString(),
    status,
    ok: status === 'accepted',
    source: {
      reviewPaths: arr(reviewPaths).map(resolvePath).filter(Boolean),
      cycleSummaryRef: resolvedCycleSummaryPath,
      geometryRef: resolvedGeometryPath,
      maxIterations: max
    },
    summary: {
      iterationCount: iterations.length,
      accepted: status === 'accepted',
      stoppedBy: status
    },
    iterations
  };
  writeJson(path.join(resolvedOutDir, 'render-review-revision-loop.json'), artifact);
  return artifact;
}

function parseArgs(argv = []) {
  const args = {
    reviewPaths: [],
    cycleSummaryPath: '',
    geometryPath: '',
    outDir: '',
    endpoint: DEFAULT_ENDPOINT,
    maxIterations: 2,
    defaultEffectName: '',
    executionMaxAttempts: 0,
    windowStartMs: 0,
    windowEndMs: 8000,
    sampleCount: 8,
    width: 1280,
    height: 720,
    fps: 20,
    nodeRadius: 3
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = str(argv[index]);
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${token}`);
      return argv[index];
    };
    if (token === '--review') args.reviewPaths.push(next());
    else if (token === '--cycle-summary') args.cycleSummaryPath = next();
    else if (token === '--geometry') args.geometryPath = next();
    else if (token === '--out-dir') args.outDir = next();
    else if (token === '--endpoint') args.endpoint = next();
    else if (token === '--max-iterations') args.maxIterations = Number(next());
    else if (token === '--default-effect') args.defaultEffectName = next();
    else if (token === '--max-attempts') args.executionMaxAttempts = Number(next());
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
  node scripts/designer-training/run-render-review-revision-loop.mjs --cycle-summary cycle-summary.json --geometry preview-scene-geometry.json --out-dir var/tmp/revision-loop
  node scripts/designer-training/run-render-review-revision-loop.mjs --review render-review.json --geometry preview-scene-geometry.json --max-iterations 2
`;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help || (!args.reviewPaths.length && !args.cycleSummaryPath) || !args.geometryPath) {
      process.stdout.write(usage());
      process.exit(args.help ? 0 : 1);
    }
    const artifact = await runRenderReviewRevisionLoop(args);
    process.stdout.write(`${JSON.stringify(artifact, null, 2)}\n`);
  } catch (error) {
    console.error(error?.stack || String(error));
    process.exit(1);
  }
}
