#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

function round(value) {
  return Math.round(number(value) * 1_000_000) / 1_000_000;
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

function reviewWindow(review = {}, reviewPath = '') {
  const metrics = review.deterministicMetrics || {};
  const scores = review.qualityScores || {};
  const section = review.section || {};
  return {
    id: str(section.id || path.basename(path.dirname(reviewPath)) || path.basename(reviewPath, '.json')),
    label: str(section.label || section.id),
    startMs: number(section.startMs),
    endMs: number(section.endMs),
    decision: str(review.critique?.decision),
    effectName: str(review.intent?.effectName),
    leadTargets: arr(review.intent?.targetHierarchy?.leadTargets).map(str).filter(Boolean),
    reviewPath,
    metrics: {
      activeCoverageMean: number(metrics.activeCoverageMean),
      brightnessMean: number(metrics.brightnessMean),
      temporalMotionMean: number(metrics.temporalMotionMean),
      colorDiversityMean: number(metrics.colorDiversityMean),
      blankRisk: number(metrics.blankRisk)
    },
    scores: {
      overallQuality: number(scores.overallQuality),
      visualReadability: number(scores.visualReadability),
      intentMatch: number(scores.intentMatch),
      motionCoherence: number(scores.motionCoherence)
    }
  };
}

function absDelta(left, right, key, group = 'metrics') {
  return Math.abs(number(right?.[group]?.[key]) - number(left?.[group]?.[key]));
}

function signedDelta(left, right, key, group = 'metrics') {
  return round(number(right?.[group]?.[key]) - number(left?.[group]?.[key]));
}

function compareAdjacent(left = {}, right = {}) {
  const deltas = {
    activeCoverageMean: signedDelta(left, right, 'activeCoverageMean'),
    brightnessMean: signedDelta(left, right, 'brightnessMean'),
    temporalMotionMean: signedDelta(left, right, 'temporalMotionMean'),
    colorDiversityMean: signedDelta(left, right, 'colorDiversityMean'),
    blankRisk: signedDelta(left, right, 'blankRisk'),
    overallQuality: signedDelta(left, right, 'overallQuality', 'scores'),
    visualReadability: signedDelta(left, right, 'visualReadability', 'scores')
  };
  const sameDecision = left.decision === right.decision;
  const sameLeadTargets = left.leadTargets.join('|') === right.leadTargets.join('|');
  const sameEffect = left.effectName && left.effectName === right.effectName;
  const similarityScore = round(1 - Math.min(1, (
    absDelta(left, right, 'activeCoverageMean') * 2.2 +
    absDelta(left, right, 'brightnessMean') * 1.4 +
    absDelta(left, right, 'temporalMotionMean') * 2.6 +
    absDelta(left, right, 'colorDiversityMean') * 0.8 +
    absDelta(left, right, 'overallQuality', 'scores') * 1.2
  ) / 2));
  const windowsReadSimilarly = similarityScore >= 0.92 && sameDecision;
  return {
    fromId: left.id,
    toId: right.id,
    fromLabel: left.label,
    toLabel: right.label,
    sameDecision,
    sameEffect,
    sameLeadTargets,
    windowsReadSimilarly,
    similarityScore,
    deltas
  };
}

export function buildRenderReviewProgressionSummary({ reviewPaths = [], reviews = [], outPath = '' } = {}) {
  const windows = [
    ...arr(reviews).map((review) => reviewWindow(review, '')),
    ...arr(reviewPaths).map(resolvePath).filter(Boolean).map((reviewPath) => reviewWindow(readJson(reviewPath), reviewPath))
  ].sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs || left.id.localeCompare(right.id));
  const adjacentComparisons = [];
  for (let index = 1; index < windows.length; index += 1) {
    adjacentComparisons.push(compareAdjacent(windows[index - 1], windows[index]));
  }
  const similarCount = adjacentComparisons.filter((row) => row.windowsReadSimilarly).length;
  const acceptedCount = windows.filter((row) => row.decision === 'accept').length;
  const qualityValues = windows.map((row) => number(row.scores.overallQuality)).filter(Number.isFinite);
  const minQuality = qualityValues.length ? Math.min(...qualityValues) : 0;
  const maxQuality = qualityValues.length ? Math.max(...qualityValues) : 0;
  const avgSimilarity = adjacentComparisons.length
    ? adjacentComparisons.reduce((sum, row) => sum + number(row.similarityScore), 0) / adjacentComparisons.length
    : 0;
  const progressionScore = adjacentComparisons.length
    ? round(Math.max(0, Math.min(1, 1 - avgSimilarity + Math.max(0, minQuality - 0.65) * 0.35)))
    : 1;
  const artifact = {
    artifactType: 'render_review_progression_summary_v1',
    artifactVersion: '1.0',
    createdAt: new Date().toISOString(),
    summary: {
      windowCount: windows.length,
      adjacentComparisonCount: adjacentComparisons.length,
      acceptedCount,
      similarAdjacentWindowCount: similarCount,
      minOverallQuality: round(minQuality),
      maxOverallQuality: round(maxQuality),
      qualityRange: round(maxQuality - minQuality),
      progressionScore,
      progressionRisk: adjacentComparisons.length > 0 && similarCount === adjacentComparisons.length && progressionScore < 0.25
    },
    windows,
    adjacentComparisons
  };
  const resolvedOutPath = resolvePath(outPath);
  if (resolvedOutPath) writeJson(resolvedOutPath, artifact);
  return artifact;
}

function parseArgs(argv = []) {
  const args = { reviewPaths: [], outPath: '' };
  for (let index = 0; index < argv.length; index += 1) {
    const token = str(argv[index]);
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${token}`);
      return argv[index];
    };
    if (token === '--review') args.reviewPaths.push(next());
    else if (token === '--out') args.outPath = next();
    else if (token === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${token}`);
  }
  return args;
}

function usage() {
  return `Usage:
  node scripts/designer-training/build-render-review-progression-summary.mjs --review intro/render-review.json --review chorus/render-review.json --out progression.json
`;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help || !args.reviewPaths.length) {
      process.stdout.write(usage());
      process.exit(args.help ? 0 : 1);
    }
    const artifact = buildRenderReviewProgressionSummary(args);
    process.stdout.write(`${JSON.stringify(artifact, null, 2)}\n`);
  } catch (error) {
    console.error(error?.stack || String(error));
    process.exit(1);
  }
}
