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

function stableHash(value = '') {
  let hash = 2166136261;
  const text = String(value || '');
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function unique(values = []) {
  return [...new Set(arr(values).map(str).filter(Boolean))];
}

function classifyRevisionRoles(review = {}) {
  const metrics = review.deterministicMetrics || {};
  const scores = review.qualityScores || {};
  const issues = arr(review.critique?.issues).join(' ').toLowerCase();
  const roles = [];
  if (number(metrics.blankRisk) > 0.25 || /blank/.test(issues)) roles.push('increase_section_coverage');
  if (number(metrics.activeCoverageMean) < 0.08 || number(scores.visualReadability) < 0.62) roles.push('strengthen_visual_readability');
  if (number(metrics.flatnessRisk) > 0.35 || number(scores.motionCoherence) < 0.55) roles.push('add_temporal_motion');
  if (number(metrics.clutterRisk) > 0.35) roles.push('reduce_visual_clutter');
  if (number(metrics.overexposureRisk) > 0.35) roles.push('reduce_overexposure');
  if (number(scores.intentMatch) < 0.62) roles.push('improve_intent_match');
  return unique(roles.length ? roles : ['improve_overall_section_quality']);
}

function buildSequencerActions(review = {}, roles = []) {
  const metrics = review.deterministicMetrics || {};
  const recommendations = arr(review.critique?.revisionRecommendations);
  const actions = [];
  if (roles.includes('increase_section_coverage')) {
    actions.push({
      action: 'extend_or_repeat_effect_coverage',
      rationale: 'sampled render has inactive spans or too little active display coverage',
      targetMetric: 'blankRisk',
      currentValue: number(metrics.blankRisk)
    });
    actions.push({
      action: 'add_supporting_targets_or_submodels',
      rationale: 'whole-display read is too narrow for section-level review',
      targetMetric: 'activeCoverageMean',
      currentValue: number(metrics.activeCoverageMean)
    });
  }
  if (roles.includes('strengthen_visual_readability')) {
    actions.push({
      action: 'increase_readable_contrast_or_brightness',
      rationale: 'section needs a clearer display-level read without overexposure',
      targetMetric: 'visualReadability',
      currentValue: number(review.qualityScores?.visualReadability)
    });
  }
  if (roles.includes('add_temporal_motion')) {
    actions.push({
      action: 'add_motion_or_palette_evolution',
      rationale: 'section appears temporally flat relative to the intended energy',
      targetMetric: 'temporalMotionMean',
      currentValue: number(metrics.temporalMotionMean)
    });
  }
  if (roles.includes('reduce_visual_clutter')) {
    actions.push({
      action: 'simplify_simultaneous_layers',
      rationale: 'section risks excessive active targets or color complexity',
      targetMetric: 'clutterRisk',
      currentValue: number(metrics.clutterRisk)
    });
  }
  if (roles.includes('reduce_overexposure')) {
    actions.push({
      action: 'lower_intensity_or_reduce_full_white',
      rationale: 'dominant brightness suggests overexposure risk',
      targetMetric: 'overexposureRisk',
      currentValue: number(metrics.overexposureRisk)
    });
  }
  for (const recommendation of recommendations) {
    actions.push({
      action: 'honor_review_recommendation',
      rationale: recommendation
    });
  }
  return actions;
}

export function buildRenderReviewRevisionObjective({ review, reviewPath = '', objectiveId = '' } = {}) {
  const decision = str(review?.critique?.decision);
  const roles = classifyRevisionRoles(review);
  const section = review?.section || {};
  const metrics = review?.deterministicMetrics || {};
  const scores = review?.qualityScores || {};
  return {
    artifactType: 'render_review_revision_objective_v1',
    artifactVersion: '1.0',
    objectiveId: str(objectiveId) || `rrro1:${stableHash(`${reviewPath}:${section.id}:${decision}:${JSON.stringify(metrics)}`)}`,
    createdAt: new Date().toISOString(),
    source: {
      renderReviewRef: str(reviewPath),
      decision,
      evidence: review?.evidence || {}
    },
    scope: {
      sectionId: str(section.id || 'section'),
      sectionLabel: str(section.label),
      startMs: number(section.startMs),
      endMs: number(section.endMs),
      revisionRoles: roles,
      revisionTargets: unique([
        ...(arr(review?.intent?.targetHierarchy?.leadTargets)),
        ...(arr(review?.intent?.targetHierarchy?.supportTargets))
      ])
    },
    designerDirection: {
      objective: decision === 'reject'
        ? 'Rework the section until it reads as an intentional display-level moment.'
        : 'Revise the section while preserving usable motion and color strengths.',
      mustPreserve: arr(review?.critique?.strengths),
      mustAvoid: arr(review?.critique?.issues),
      qualityTargets: {
        minNonBlankSampledFrameRatio: Math.max(0.75, number(metrics.nonBlankSampledFrameRatio, 0)),
        maxBlankRisk: 0.25,
        minVisualReadability: Math.max(0.7, number(scores.visualReadability, 0)),
        minIntentMatch: Math.max(0.7, number(scores.intentMatch, 0))
      }
    },
    sequencerDirection: {
      executionObjective: 'Produce a revised render candidate and rerun FSEQ/media review against the same section window.',
      revisionActions: buildSequencerActions(review, roles),
      blockedMoves: [
        'Do not promote this pattern while renderReviewGate is not ready.',
        'Do not only prove that pixels render; improve the section-level read.'
      ]
    },
    successChecks: [
      'render_review_v1 decision is accept',
      'renderReviewGate allRenderReviewsAccepted passes',
      'blankRisk is at or below 0.25',
      'visualReadability and intentMatch meet target thresholds'
    ]
  };
}

export function buildRenderReviewRevisionObjectives({ reviewPaths = [], cycleSummaryPath = '', outPath = '' } = {}) {
  let paths = unique(reviewPaths.map(resolvePath));
  const cycleSummaryRef = resolvePath(cycleSummaryPath);
  if (cycleSummaryRef && fs.existsSync(cycleSummaryRef)) {
    const summary = readJson(cycleSummaryRef);
    const fromSummary = arr(summary.phases)
      .filter((phase) => ['render_review', 'fseq_render_review'].includes(str(phase.type)))
      .flatMap((phase) => arr(phase.results))
      .map((result) => str(result.renderReviewPath || result.outputPath))
      .filter(Boolean);
    paths = unique([...paths, ...fromSummary.map(resolvePath)]);
  }
  const objectives = [];
  const skipped = [];
  for (const reviewPath of paths) {
    try {
      const review = readJson(reviewPath);
      const decision = str(review?.critique?.decision);
      if (!['revise', 'reject'].includes(decision)) {
        skipped.push({ reviewPath, reason: `decision is ${decision || 'missing'}` });
        continue;
      }
      objectives.push(buildRenderReviewRevisionObjective({ review, reviewPath }));
    } catch (error) {
      skipped.push({ reviewPath, reason: error?.message || String(error) });
    }
  }
  const artifact = {
    artifactType: 'render_review_revision_objective_index_v1',
    artifactVersion: '1.0',
    createdAt: new Date().toISOString(),
    source: {
      cycleSummaryRef,
      reviewCount: paths.length
    },
    summary: {
      objectiveCount: objectives.length,
      skippedCount: skipped.length,
      revisionRoleCounts: objectives.reduce((counts, objective) => {
        for (const role of arr(objective.scope?.revisionRoles)) counts[role] = Number(counts[role] || 0) + 1;
        return counts;
      }, {})
    },
    objectives,
    skipped
  };
  const resolvedOutPath = resolvePath(outPath);
  if (resolvedOutPath) writeJson(resolvedOutPath, artifact);
  return artifact;
}

function parseArgs(argv = []) {
  const args = { reviewPaths: [], cycleSummaryPath: '', outPath: '' };
  for (let index = 0; index < argv.length; index += 1) {
    const token = str(argv[index]);
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${token}`);
      return argv[index];
    };
    if (token === '--review') args.reviewPaths.push(next());
    else if (token === '--cycle-summary') args.cycleSummaryPath = next();
    else if (token === '--out') args.outPath = next();
    else if (token === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${token}`);
  }
  return args;
}

function usage() {
  return `Usage:
  node scripts/designer-training/build-render-review-revision-objectives.mjs --cycle-summary cycle-summary.json --out revision-objectives.json
  node scripts/designer-training/build-render-review-revision-objectives.mjs --review render-review.json --out revision-objectives.json
`;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help || (!args.reviewPaths.length && !args.cycleSummaryPath)) {
      process.stdout.write(usage());
      process.exit(args.help ? 0 : 1);
    }
    const artifact = buildRenderReviewRevisionObjectives(args);
    process.stdout.write(`${JSON.stringify(artifact, null, 2)}\n`);
  } catch (error) {
    console.error(error?.stack || String(error));
    process.exit(1);
  }
}
