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

function bool(value, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
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

function uniqueBy(values = [], keyFn = (value) => value) {
  const seen = new Set();
  const output = [];
  for (const value of values) {
    const key = str(keyFn(value));
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(value);
  }
  return output;
}

function normalizeTarget(value) {
  if (typeof value === 'string') {
    const target = str(value);
    return target ? { targetId: target, element: target } : null;
  }
  if (!value || typeof value !== 'object') return null;
  const element = str(value.element || value.modelName || value.name || value.targetName);
  const targetId = str(value.targetId || value.id || value.modelId || value.uuid || element);
  if (!targetId && !element) return null;
  return {
    targetId: targetId || element,
    element: element || targetId,
    scope: str(value.scope || value.targetScope),
    role: str(value.role),
    metadata: {
      source: str(value.source),
      modelType: str(value.modelType),
      submodelName: str(value.submodelName)
    }
  };
}

function collectTargets({ objective = {}, targetPolicy = {} } = {}) {
  const policyTargets = [
    ...arr(targetPolicy.targets),
    ...arr(targetPolicy.targetIds)
  ].map(normalizeTarget).filter(Boolean);
  const objectiveTargets = arr(objective.scope?.revisionTargets).map(normalizeTarget).filter(Boolean);
  const preferred = str(targetPolicy.mode) === 'explicit' && policyTargets.length ? policyTargets : [...objectiveTargets, ...policyTargets];
  const maxTargets = Math.max(1, number(targetPolicy.maxTargets, preferred.length || 1));
  return uniqueBy(preferred, (target) => target.targetId || target.element).slice(0, maxTargets);
}

function inferRevisionMoves(objective = {}) {
  const roles = arr(objective.scope?.revisionRoles).map(str);
  const actionIds = arr(objective.sequencerDirection?.revisionActions).map((row) => str(row?.action));
  const moves = [];
  if (roles.includes('increase_section_coverage') || actionIds.includes('extend_or_repeat_effect_coverage')) {
    moves.push('cover_full_section_window');
  }
  if (roles.includes('strengthen_visual_readability') || actionIds.includes('increase_readable_contrast_or_brightness')) {
    moves.push('add_readability_support');
  }
  if (roles.includes('add_temporal_motion') || actionIds.includes('add_motion_or_palette_evolution')) {
    moves.push('prefer_motion_variant');
  }
  if (roles.includes('reduce_visual_clutter') || actionIds.includes('simplify_simultaneous_layers')) {
    moves.push('limit_simultaneous_layers');
  }
  if (roles.includes('reduce_overexposure') || actionIds.includes('lower_intensity_or_reduce_full_white')) {
    moves.push('avoid_full_white_dominance');
  }
  return uniqueBy(moves.length ? moves : ['revise_for_acceptance']);
}

function resolveEffectName({ objective = {}, targetPolicy = {}, defaultEffectName = '' } = {}) {
  return str(
    objective.revisionAttemptHints?.effectName
      || objective.source?.effectName
      || targetPolicy.effectName
      || defaultEffectName
  );
}

function buildEffectRows({ objective = {}, targets = [], effectName = '', layer = 0, clearExisting = false } = {}) {
  const startMs = number(objective.scope?.startMs);
  const endMs = number(objective.scope?.endMs);
  return targets.map((target, index) => ({
    element: target.element,
    layer,
    effectName,
    startMs,
    endMs,
    settings: '',
    palette: '',
    clearExisting,
    metadata: {
      revisionAttemptRole: index === 0 ? 'lead_revision_target' : 'support_revision_target',
      revisionTargetId: target.targetId,
      revisionObjectiveId: str(objective.objectiveId),
      plannedMoves: inferRevisionMoves(objective)
    }
  }));
}

export function buildRenderReviewRevisionAttempt({ objective = {}, targetPolicy = {}, defaultEffectName = '', layer = 0, clearExisting = false } = {}) {
  const targets = collectTargets({ objective, targetPolicy });
  const effectName = resolveEffectName({ objective, targetPolicy, defaultEffectName });
  const blockedReasons = [];
  if (!targets.length) blockedReasons.push('missing_revision_targets');
  if (!effectName) blockedReasons.push('missing_revision_effect');
  if (number(objective.scope?.endMs) <= number(objective.scope?.startMs)) blockedReasons.push('invalid_section_window');
  const attemptId = `rrra1:${stableHash(`${objective.objectiveId}:${effectName}:${targets.map((target) => target.targetId).join('|')}`)}`;
  const base = {
    artifactType: 'render_review_revision_attempt_v1',
    artifactVersion: '1.0',
    attemptId,
    createdAt: new Date().toISOString(),
    source: {
      revisionObjectiveId: str(objective.objectiveId),
      renderReviewRef: str(objective.source?.renderReviewRef)
    },
    status: blockedReasons.length ? 'blocked' : 'planned',
    blockedReasons,
    scope: {
      sectionId: str(objective.scope?.sectionId),
      startMs: number(objective.scope?.startMs),
      endMs: number(objective.scope?.endMs),
      revisionRoles: arr(objective.scope?.revisionRoles).map(str).filter(Boolean),
      plannedMoves: inferRevisionMoves(objective)
    },
    targetPolicy: {
      mode: str(targetPolicy.mode || 'objective_or_policy'),
      maxTargets: Math.max(1, number(targetPolicy.maxTargets, targets.length || 1))
    },
    targets,
    effectPlan: {
      effectName,
      layer,
      clearExisting
    },
    successChecks: arr(objective.successChecks)
  };
  if (!blockedReasons.length) {
    base.ownedBatchPayload = {
      track: str(targetPolicy.track || 'XD: Render Review Revision'),
      effects: buildEffectRows({ objective, targets, effectName, layer, clearExisting }),
      marks: [
        {
          label: str(objective.scope?.sectionLabel || objective.scope?.sectionId || 'revision-section'),
          startMs: number(objective.scope?.startMs),
          endMs: number(objective.scope?.endMs)
        }
      ]
    };
  }
  return base;
}

export function buildRenderReviewRevisionAttempts({
  objectivesPath = '',
  objectives = null,
  outPath = '',
  targetPolicy = {},
  defaultEffectName = '',
  layer = 0,
  clearExisting = false
} = {}) {
  const resolvedObjectivesPath = resolvePath(objectivesPath);
  const objectiveIndex = objectives || (resolvedObjectivesPath ? readJson(resolvedObjectivesPath) : {});
  const attempts = arr(objectiveIndex.objectives).map((objective) => buildRenderReviewRevisionAttempt({
    objective,
    targetPolicy,
    defaultEffectName,
    layer: number(layer),
    clearExisting: bool(clearExisting)
  }));
  const artifact = {
    artifactType: 'render_review_revision_attempt_plan_index_v1',
    artifactVersion: '1.0',
    createdAt: new Date().toISOString(),
    source: {
      revisionObjectivesRef: resolvedObjectivesPath,
      objectiveCount: arr(objectiveIndex.objectives).length
    },
    summary: {
      attemptCount: attempts.length,
      plannedCount: attempts.filter((attempt) => attempt.status === 'planned').length,
      blockedCount: attempts.filter((attempt) => attempt.status === 'blocked').length,
      blockedReasonCounts: attempts.reduce((counts, attempt) => {
        for (const reason of arr(attempt.blockedReasons)) counts[reason] = Number(counts[reason] || 0) + 1;
        return counts;
      }, {})
    },
    attempts
  };
  const resolvedOutPath = resolvePath(outPath);
  if (resolvedOutPath) writeJson(resolvedOutPath, artifact);
  return artifact;
}

function parseTargets(value = '') {
  const text = str(value);
  if (!text) return [];
  if (fs.existsSync(resolvePath(text))) return arr(readJson(resolvePath(text)));
  return text.split(',').map(str).filter(Boolean);
}

function parseArgs(argv = []) {
  const args = {
    objectivesPath: '',
    outPath: '',
    targetPolicy: {},
    defaultEffectName: '',
    layer: 0,
    clearExisting: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = str(argv[index]);
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${token}`);
      return argv[index];
    };
    if (token === '--objectives') args.objectivesPath = next();
    else if (token === '--out') args.outPath = next();
    else if (token === '--default-effect') args.defaultEffectName = next();
    else if (token === '--targets') {
      args.targetPolicy.mode = 'explicit';
      args.targetPolicy.targets = parseTargets(next());
    } else if (token === '--max-targets') args.targetPolicy.maxTargets = Number(next());
    else if (token === '--track') args.targetPolicy.track = next();
    else if (token === '--layer') args.layer = Number(next());
    else if (token === '--clear-existing') args.clearExisting = true;
    else if (token === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${token}`);
  }
  return args;
}

function usage() {
  return `Usage:
  node scripts/designer-training/build-render-review-revision-attempts.mjs --objectives render-review-revision-objectives.json --out render-review-revision-attempts.json
  node scripts/designer-training/build-render-review-revision-attempts.mjs --objectives objectives.json --default-effect "Color Wash" --targets targets.json --out attempts.json
`;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help || !args.objectivesPath) {
      process.stdout.write(usage());
      process.exit(args.help ? 0 : 1);
    }
    const artifact = buildRenderReviewRevisionAttempts(args);
    process.stdout.write(`${JSON.stringify(artifact, null, 2)}\n`);
  } catch (error) {
    console.error(error?.stack || String(error));
    process.exit(1);
  }
}
