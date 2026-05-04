#!/usr/bin/env node

import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildRenderReviewArtifact } from './build-render-review-artifact.mjs';
import { buildRenderReviewFromFseq } from './build-render-review-from-fseq.mjs';
import { buildRenderReviewRevisionComparisons } from './build-render-review-revision-comparisons.mjs';
import { buildRenderReviewRevisionAttempts } from './build-render-review-revision-attempts.mjs';
import { buildRenderReviewRevisionObjectives } from './build-render-review-revision-objectives.mjs';
import { extractRenderReviewMedia } from './extract-render-review-media.mjs';
import { buildTargetBehaviorTrainingSummary } from './export-target-behavior-training-summary.mjs';
import { runRenderReviewRevisionAttempts } from './run-render-review-revision-attempts.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_MANIFEST = 'scripts/designer-training/self-improvement-loop-manifest.v1.json';
const DEFAULT_LOG_ROOT = 'var/logs/self-improvement-training-runs';

function str(value = '') {
  return String(value || '').trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function parseArgs(argv = []) {
  const args = {
    manifestPath: DEFAULT_MANIFEST,
    outDir: '',
    projectDirs: [],
    discoverUnder: [],
    skipCommands: false,
    runLiveProbes: false,
    endpoint: process.env.XLIGHTS_ENDPOINT || 'http://127.0.0.1:49915/xlightsdesigner/api',
    showDir: '',
    continueOnFailure: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = str(argv[index]);
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${token}`);
      return argv[index];
    };
    if (token === '--manifest') args.manifestPath = next();
    else if (token === '--out-dir') args.outDir = next();
    else if (token === '--project-dir') args.projectDirs.push(next());
    else if (token === '--discover-under') args.discoverUnder.push(next());
    else if (token === '--skip-commands') args.skipCommands = true;
    else if (token === '--run-live-probes') args.runLiveProbes = true;
    else if (token === '--endpoint') args.endpoint = next();
    else if (token === '--show-dir') args.showDir = next();
    else if (token === '--continue-on-failure') args.continueOnFailure = true;
    else if (token === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${token}`);
  }
  return args;
}

function usage() {
  return `Usage:
  node scripts/designer-training/run-self-improvement-cycle.mjs [--project-dir <project-dir>] [--discover-under <dir>] [--out-dir <dir>]
  node scripts/designer-training/run-self-improvement-cycle.mjs --run-live-probes [--endpoint <url>] [--show-dir <path>]

The current runner validates readiness, exports anonymized target-behavior summaries from project-local artifacts, and evaluates promotion-gate metrics. Live apply/render probe execution is intentionally manifest-driven so it can be added without changing the promotion/export contract.
`;
}

function runCommand(commandText, { outDir, phaseId }) {
  const [command, ...args] = commandText.split(/\s+/).filter(Boolean);
  return new Promise((resolve) => {
    const startedAt = new Date().toISOString();
    execFile(command, args, { cwd: REPO_ROOT, maxBuffer: 1024 * 1024 * 20 }, (error, stdout, stderr) => {
      const result = {
        id: phaseId,
        type: 'command',
        command: commandText,
        ok: !error,
        exitCode: error?.code ?? 0,
        startedAt,
        completedAt: new Date().toISOString(),
        stdoutPath: path.join(outDir, `${phaseId}.stdout.txt`),
        stderrPath: path.join(outDir, `${phaseId}.stderr.txt`)
      };
      fs.writeFileSync(result.stdoutPath, stdout || '', 'utf8');
      fs.writeFileSync(result.stderrPath, stderr || '', 'utf8');
      resolve(result);
    });
  });
}

function runNodeJson(scriptPath, args, { outDir, phaseId, label }) {
  return new Promise((resolve) => {
    const startedAt = new Date().toISOString();
    execFile(process.execPath, [scriptPath, ...args], { cwd: REPO_ROOT, maxBuffer: 1024 * 1024 * 20 }, (error, stdout, stderr) => {
      const safeLabel = str(label || phaseId).replace(/[^a-z0-9_.-]+/gi, '-').replace(/^-|-$/g, '') || phaseId;
      const stdoutPath = path.join(outDir, `${safeLabel}.stdout.txt`);
      const stderrPath = path.join(outDir, `${safeLabel}.stderr.txt`);
      fs.writeFileSync(stdoutPath, stdout || '', 'utf8');
      fs.writeFileSync(stderrPath, stderr || '', 'utf8');
      let json = null;
      try {
        json = stdout ? JSON.parse(stdout) : null;
      } catch {
        json = null;
      }
      resolve({
        id: phaseId,
        label: safeLabel,
        type: 'node',
        ok: !error,
        exitCode: error?.code ?? 0,
        startedAt,
        completedAt: new Date().toISOString(),
        stdoutPath,
        stderrPath,
        json
      });
    });
  });
}

function walkForTargetBehavior(dir) {
  const found = [];
  if (!dir || !fs.existsSync(dir)) return found;
  const stack = [path.resolve(dir)];
  while (stack.length) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'DerivedData') continue;
        stack.push(entryPath);
      } else if (entry.name === 'target-behavior.json' && path.basename(current) === 'display') {
        found.push(path.dirname(current));
      }
    }
  }
  return found.sort();
}

function collectProjectDirs(args) {
  const dirs = new Set(args.projectDirs.map((row) => path.resolve(REPO_ROOT, row)));
  for (const root of args.discoverUnder) {
    for (const projectDir of walkForTargetBehavior(path.resolve(REPO_ROOT, root))) {
      dirs.add(projectDir);
    }
  }
  return [...dirs].filter((projectDir) => fs.existsSync(path.join(projectDir, 'display', 'target-behavior.json'))).sort();
}

function projectDirFromTargetBehaviorPath(filePath = '') {
  const resolved = path.resolve(filePath);
  return path.basename(path.dirname(resolved)) === 'display'
    ? path.dirname(path.dirname(resolved))
    : '';
}

function resolveRepoPath(filePath = '') {
  const trimmed = str(filePath);
  if (!trimmed) return '';
  return path.isAbsolute(trimmed) ? trimmed : path.resolve(REPO_ROOT, trimmed);
}

function sourceApplyResultPath(fseqPath = '') {
  const resolved = resolveRepoPath(fseqPath);
  if (!resolved) return '';
  const dir = path.dirname(resolved);
  const base = path.basename(resolved, path.extname(resolved));
  return [
    path.join(dir, `${base}-result.json`),
    path.join(dir, 'owned-api-validation-result.json')
  ].find((candidate) => fs.existsSync(candidate)) || '';
}

function normalizeReviewWindow(mark = {}, index = 0) {
  const startMs = Number(mark.windowStartMs ?? mark.startMs ?? 0);
  const endMs = Number(mark.windowEndMs ?? mark.endMs ?? 0);
  return {
    id: str(mark.id || mark.sectionId || mark.label || `window-${index + 1}`)
      .replace(/[^a-z0-9_.-]+/gi, '-')
      .replace(/^-|-$/g, '') || `window-${index + 1}`,
    label: str(mark.label || mark.sectionLabel || mark.id || `Window ${index + 1}`),
    startMs,
    endMs,
    creativeObjective: mark.creativeObjective || {},
    musicRole: mark.musicRole || {},
    paletteIntent: mark.paletteIntent || {},
    summary: str(mark.summary || mark.intentSummary)
  };
}

function windowsFromSourceApplyMarks(review = {}) {
  const resultPath = sourceApplyResultPath(review.fseqPath || review.fseq);
  if (!resultPath) return [];
  try {
    return arr(readJson(resultPath)?.applyPayload?.marks)
      .map(normalizeReviewWindow)
      .filter((window) => Number(window.endMs) > Number(window.startMs));
  } catch {
    return [];
  }
}

async function runRenderReviewPhase({ phase, outDir }) {
  const phaseId = str(phase.id || 'render_review');
  const reviews = arr(phase.reviews).length ? arr(phase.reviews) : [phase];
  const reviewDir = path.join(outDir, 'render-reviews');
  const results = [];
  fs.mkdirSync(reviewDir, { recursive: true });

  reviews.forEach((review, index) => {
    let frameFeaturesPath = resolveRepoPath(review.frameFeaturesPath || review.frameFeatures || review.featuresPath);
    const mediaPath = resolveRepoPath(review.mediaPath || review.videoPath || review.video);
    const intentPath = resolveRepoPath(review.intentPath || review.intent);
    const label = str(review.id || review.sectionId || `${phaseId}-${index + 1}`)
      .replace(/[^a-z0-9_.-]+/gi, '-')
      .replace(/^-|-$/g, '') || `${phaseId}-${index + 1}`;
    const outputPath = resolveRepoPath(review.outPath || path.join(reviewDir, `${label}.json`));
    const mediaOutDir = resolveRepoPath(review.mediaOutDir || path.join(outDir, 'render-review-media', label));
    const result = {
      id: label,
      type: 'render_review',
      ok: false,
      frameFeaturesPath,
      mediaPath,
      mediaExtraction: null,
      intentPath,
      outputPath,
      decision: '',
      overallQuality: null,
      error: ''
    };
    try {
      if ((!frameFeaturesPath || !fs.existsSync(frameFeaturesPath)) && mediaPath) {
        const extraction = extractRenderReviewMedia({
          mediaPath,
          outDir: mediaOutDir,
          frameFeaturesOut: review.frameFeaturesOut,
          framesDir: review.framesDir || review.frameDirectory,
          contactSheetOut: review.contactSheetOut || review.contactSheetPath,
          startMs: Number(review.startMs || 0),
          endMs: Number(review.endMs || 0),
          sampleCount: Number(review.sampleCount || phase.sampleCount || 16),
          keepFrames: review.keepFrames !== false,
          buildContactSheet: review.buildContactSheet !== false
        });
        result.mediaExtraction = extraction;
        frameFeaturesPath = extraction.frameFeaturesPath;
        result.frameFeaturesPath = frameFeaturesPath;
        if (!review.contactSheetPath && extraction.contactSheetPath) review.contactSheetPath = extraction.contactSheetPath;
        if (!review.frameDirectory && !review.frameDir && extraction.framesDir) review.frameDirectory = extraction.framesDir;
      }
      if (!frameFeaturesPath || !fs.existsSync(frameFeaturesPath)) {
        throw new Error(`frame features file not found: ${frameFeaturesPath || '(missing)'}`);
      }
      const frameFeatures = readJson(frameFeaturesPath);
      const intent = intentPath && fs.existsSync(intentPath) ? readJson(intentPath) : {};
      const artifact = buildRenderReviewArtifact({
        frameFeatures,
        intent,
        evidence: {
          videoPath: mediaPath,
          contactSheetPath: resolveRepoPath(review.contactSheetPath || review.contactSheet),
          frameDirectory: resolveRepoPath(review.frameDirectory || review.frameDir),
          sequencePath: resolveRepoPath(review.sequencePath || review.sequence),
          renderObservationPath: resolveRepoPath(review.renderObservationPath),
          frameFeaturesPath
        },
        section: {
          id: str(review.sectionId || review.id),
          label: str(review.sectionLabel || review.label),
          startMs: Number(review.startMs || 0),
          endMs: Number(review.endMs || 0)
        }
      });
      writeJson(outputPath, artifact);
      result.ok = true;
      result.decision = artifact.critique.decision;
      result.overallQuality = artifact.qualityScores.overallQuality;
      result.promotionEligible = artifact.promotion.eligible;
    } catch (error) {
      result.error = error?.message || String(error);
    }
    results.push(result);
  });

  return {
    id: phaseId,
    type: str(phase.type || 'render_review'),
    ok: results.every((result) => result.ok),
    totals: {
      reviewCount: results.length,
      acceptedCount: results.filter((result) => result.decision === 'accept').length,
      reviseCount: results.filter((result) => result.decision === 'revise').length,
      rejectedCount: results.filter((result) => result.decision === 'reject').length
    },
    results
  };
}

async function runFseqRenderReviewPhase({ phase, outDir, buildFseqReview }) {
  const phaseId = str(phase.id || 'fseq_render_review');
  const reviews = arr(phase.reviews).length ? arr(phase.reviews) : [phase];
  const results = [];
  const reviewRoot = path.join(outDir, 'fseq-render-reviews');
  fs.mkdirSync(reviewRoot, { recursive: true });
  const reviewWindows = (review) => {
    const windowSource = str(review.windowsFrom || phase.windowsFrom || review.windowSource || phase.windowSource);
    const sourcedWindows = windowSource === 'source_apply_marks' ? windowsFromSourceApplyMarks(review) : [];
    const windows = arr(review.windows).length ? arr(review.windows) : arr(phase.windows).length ? arr(phase.windows) : sourcedWindows;
    if (!windows.length) return [{ id: '', row: {} }];
    return windows.map((window, windowIndex) => {
      const normalized = normalizeReviewWindow(window, windowIndex);
      return {
        id: str(normalized.id || window.id || window.sectionId || window.label || `window-${windowIndex + 1}`),
        row: { ...normalized, ...window }
      };
    });
  };
  reviews.flatMap((review, index) => reviewWindows(review).map((window) => ({ review, index, window }))).forEach(({ review, index, window }) => {
    const baseLabel = str(review.id || review.sectionId || `${phaseId}-${index + 1}`);
    const label = [baseLabel, window.id].filter(Boolean).join('-')
      .replace(/[^a-z0-9_.-]+/gi, '-')
      .replace(/^-|-$/g, '') || `${phaseId}-${index + 1}`;
    const windowRow = window.row || {};
    const result = {
      id: label,
      type: 'fseq_render_review',
      ok: false,
      fseqPath: resolveRepoPath(review.fseqPath || review.fseq),
      geometryPath: resolveRepoPath(review.geometryPath || phase.geometryPath || review.geometry),
      renderReviewPath: '',
      decision: '',
      overallQuality: null,
      error: ''
    };
    try {
      const run = buildFseqReview({
        geometryPath: result.geometryPath,
        fseqPath: result.fseqPath,
        intentPath: resolveRepoPath(review.intentPath || review.intent),
        intent: {
          effectName: str(review.effectName || review.effect),
          targetHierarchy: review.targetHierarchy || {},
          creativeObjective: windowRow.creativeObjective || review.creativeObjective || {},
          musicRole: windowRow.musicRole || review.musicRole || {},
          paletteIntent: windowRow.paletteIntent || review.paletteIntent || {},
          summary: str(windowRow.summary || windowRow.intentSummary || review.summary || review.intentSummary),
          section: {
            id: str(windowRow.sectionId || windowRow.id || review.sectionId || review.id || 'fseq-window'),
            label: str(windowRow.sectionLabel || windowRow.label || review.sectionLabel || review.label),
            startMs: Number(windowRow.windowStartMs ?? windowRow.startMs ?? review.windowStartMs ?? review.startMs ?? phase.windowStartMs ?? 0),
            endMs: Number(windowRow.windowEndMs ?? windowRow.endMs ?? review.windowEndMs ?? review.endMs ?? phase.windowEndMs ?? 8000)
          }
        },
        outDir: resolveRepoPath(review.outDir || path.join(reviewRoot, label)),
        windowStartMs: Number(windowRow.windowStartMs ?? windowRow.startMs ?? review.windowStartMs ?? review.startMs ?? phase.windowStartMs ?? 0),
        windowEndMs: Number(windowRow.windowEndMs ?? windowRow.endMs ?? review.windowEndMs ?? review.endMs ?? phase.windowEndMs ?? 8000),
        stepMs: Number(windowRow.stepMs ?? review.stepMs ?? phase.stepMs ?? 50),
        sampleCount: Number(windowRow.sampleCount ?? review.sampleCount ?? phase.sampleCount ?? 8),
        frameOffsets: str(windowRow.frameOffsets || review.frameOffsets || phase.frameOffsets),
        width: Number(windowRow.width ?? review.width ?? phase.width ?? 1280),
        height: Number(windowRow.height ?? review.height ?? phase.height ?? 720),
        fps: Number(windowRow.fps ?? review.fps ?? phase.fps ?? 20),
        nodeRadius: Number(windowRow.nodeRadius ?? review.nodeRadius ?? phase.nodeRadius ?? 3),
        includeAuditExcluded: windowRow.includeAuditExcluded === true || review.includeAuditExcluded === true || phase.includeAuditExcluded === true
      });
      result.ok = run.ok === true;
      result.run = run;
      result.renderReviewPath = str(run.renderReviewPath);
      result.decision = str(run.decision);
      result.overallQuality = run.overallQuality ?? null;
      result.window = {
        id: str(windowRow.id || windowRow.sectionId || window.id),
        label: str(windowRow.label || windowRow.sectionLabel),
        startMs: Number(windowRow.windowStartMs ?? windowRow.startMs ?? review.windowStartMs ?? review.startMs ?? phase.windowStartMs ?? 0),
        endMs: Number(windowRow.windowEndMs ?? windowRow.endMs ?? review.windowEndMs ?? review.endMs ?? phase.windowEndMs ?? 8000)
      };
    } catch (error) {
      result.error = error?.message || String(error);
    }
    results.push(result);
  });
  return {
    id: phaseId,
    type: str(phase.type || 'fseq_render_review'),
    ok: results.every((result) => result.ok),
    totals: {
      reviewCount: results.length,
      acceptedCount: results.filter((result) => result.decision === 'accept').length,
      reviseCount: results.filter((result) => result.decision === 'revise').length,
      rejectedCount: results.filter((result) => result.decision === 'reject').length
    },
    results
  };
}

async function runLiveTargetBehaviorProbePhase({ phase, manifest, outDir, endpoint, showDir }) {
  const phaseId = str(phase.id || 'live_custom_submodel_probes');
  const targetScope = str(phase.targetScope || 'custom_submodel');
  const blocked = new Set(arr(manifest?.initialScope?.blockedEffects).map((effect) => str(effect).toLowerCase()));
  const effects = arr(phase.effects).length ? arr(phase.effects) : arr(manifest?.initialScope?.effects);
  const allowedEffects = effects.map((effect) => str(effect)).filter((effect) => effect && !blocked.has(effect.toLowerCase()));
  const durationMs = Number(phase.durationMs || 8000);
  const results = [];
  const projectDirs = [];
  for (const effect of allowedEffects) {
    const runId = `self-improve-${new Date().toISOString().replace(/[:.]/g, '-')}-${effect.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
    const outputPath = path.join(outDir, 'live-probes', `${runId}.json`);
    const args = [
      'scripts/xlights/validate-custom-model-regression.mjs',
      '--endpoint', endpoint,
      '--target-scope', targetScope,
      '--effect-name', effect,
      '--duration-ms', String(Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 8000),
      '--run-id', runId,
      '--output', outputPath
    ];
    if (showDir) args.push('--show-dir', showDir);
    const result = await runNodeJson(args[0], args.slice(1), {
      outDir,
      phaseId,
      label: `${phaseId}-${effect}`
    });
    result.effectName = effect;
    result.targetScope = targetScope;
    result.outputPath = outputPath;
    if (result.ok && fs.existsSync(outputPath)) {
      try {
        const report = readJson(outputPath);
        result.reportSummary = report.summary || {};
        const projectDir = projectDirFromTargetBehaviorPath(report.persistenceArtifactPath);
        if (projectDir) projectDirs.push(projectDir);
      } catch {
        // Report parsing is useful for exports, but the probe result still carries stdout/stderr.
      }
    }
    results.push(result);
  }
  return {
    id: phaseId,
    type: str(phase.type || 'live_target_behavior_probe'),
    targetScope,
    ok: results.every((result) => result.ok),
    effects: allowedEffects,
    results,
    projectDirs: [...new Set(projectDirs)].sort()
  };
}

function exportTargetBehaviorSummaries({ projectDirs, outDir }) {
  const summaries = [];
  const summaryDir = path.join(outDir, 'target-behavior-summaries');
  fs.mkdirSync(summaryDir, { recursive: true });
  projectDirs.forEach((projectDir, index) => {
    const targetBehaviorPath = path.join(projectDir, 'display', 'target-behavior.json');
    const modelIndexPath = path.join(projectDir, 'display', 'model-index.json');
    const targetBehavior = readJson(targetBehaviorPath);
    const modelIndex = fs.existsSync(modelIndexPath) ? readJson(modelIndexPath) : null;
    const summary = buildTargetBehaviorTrainingSummary({ targetBehavior, modelIndex });
    const outPath = path.join(summaryDir, `target-behavior-summary-${String(index + 1).padStart(3, '0')}.json`);
    writeJson(outPath, summary);
    summaries.push({
      ok: true,
      projectDirHash: `pdh1:${stableHash(projectDir)}`,
      outputPath: outPath,
      summary: summary.summary,
      records: summary.records
    });
  });
  return summaries;
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

function validateManifest(manifest) {
  const errors = [];
  if (manifest?.artifactType !== 'xlightsdesigner_self_improvement_loop_manifest_v1') {
    errors.push('manifest artifactType must be xlightsdesigner_self_improvement_loop_manifest_v1');
  }
  const effects = arr(manifest?.initialScope?.effects).map((effect) => str(effect));
  const blocked = new Set(arr(manifest?.initialScope?.blockedEffects).map((effect) => str(effect).toLowerCase()));
  if (!effects.length) errors.push('manifest initialScope.effects is required');
  for (const effect of effects) {
    if (blocked.has(effect.toLowerCase())) errors.push(`manifest effect is blocked for this loop: ${effect}`);
  }
  if (effects.some((effect) => effect.toLowerCase() === 'shimmer')) {
    errors.push('Shimmer is intentionally excluded from the initial self-improvement validation scope');
  }
  if (!effects.some((effect) => effect.toLowerCase() === 'singlestrand')) {
    errors.push('SingleStrand must be included in the initial limited validation scope');
  }
  return errors;
}

function evaluatePromotionGate({ manifest, exportedSummaries }) {
  const gate = manifest.promotionGate || {};
  const minSamplesPerPromotablePattern = Number(gate.minSamplesPerPromotablePattern || 0);
  const minPromotablePatterns = Number(gate.minPromotablePatterns || gate.minEffectsCovered || 0);
  const totals = {
    recordCount: 0,
    sampleCount: 0,
    submodelRecordCount: 0,
    customParentRecordCount: 0,
    builtInParentRecordCount: 0,
    effectFamilies: new Set(),
    promotablePatternCount: 0
  };
  const patternSamples = new Map();
  for (const exported of exportedSummaries) {
    const summary = exported.summary || {};
    totals.recordCount += Number(summary.recordCount || 0);
    totals.submodelRecordCount += Number(summary.submodelRecordCount || 0);
    totals.customParentRecordCount += Number(summary.customParentRecordCount || 0);
    const builtIn = Number(summary.builtInParentRecordCount || 0) + Number(summary.builtInTargetRecordCount || 0);
    totals.builtInParentRecordCount += Math.max(0, builtIn);
    for (const effect of Object.keys(summary.effectFamilyCounts || {})) totals.effectFamilies.add(effect);
    for (const record of arr(exported.records || exported.document?.records)) {
      const sampleCount = Number(record?.stats?.sampleCount || 0);
      totals.sampleCount += Math.max(0, sampleCount);
      const canonicalType = str(record?.targetCanonicalType || record?.parentContext?.canonicalType || 'unknown');
      const patternKey = [
        canonicalType,
        str(record?.targetKind || 'unknown'),
        str(record?.probeScope || 'unknown'),
        str(record?.effectFamily || record?.effectName || 'unknown')
      ].join('|');
      patternSamples.set(patternKey, Number(patternSamples.get(patternKey) || 0) + Math.max(0, sampleCount));
    }
  }
  totals.promotablePatternCount = [...patternSamples.values()]
    .filter((sampleCount) => sampleCount >= minSamplesPerPromotablePattern)
    .length;
  const checks = [
    { id: 'minTotalRecords', actual: totals.recordCount, expected: Number(gate.minTotalRecords || 0) },
    { id: 'minSubmodelRecords', actual: totals.submodelRecordCount, expected: Number(gate.minSubmodelRecords || 0) },
    { id: 'minCustomParentRecords', actual: totals.customParentRecordCount, expected: Number(gate.minCustomParentRecords || 0) },
    { id: 'minBuiltInParentRecords', actual: totals.builtInParentRecordCount, expected: Number(gate.minBuiltInParentRecords || 0) },
    { id: 'minEffectsCovered', actual: totals.effectFamilies.size, expected: Number(gate.minEffectsCovered || 0) },
    { id: 'minPromotablePatterns', actual: totals.promotablePatternCount, expected: minPromotablePatterns }
  ].map((check) => ({ ...check, ok: check.actual >= check.expected }));
  return {
    promoteReady: checks.every((check) => check.ok),
    totals: {
      ...totals,
      effectFamilies: [...totals.effectFamilies].sort()
    },
    patternSamples: Object.fromEntries([...patternSamples.entries()].sort((left, right) => left[0].localeCompare(right[0]))),
    checks
  };
}

function evaluateRenderReviewGate({ phases = [] } = {}) {
  const reviewPhases = arr(phases).filter((phase) => ['render_review', 'fseq_render_review'].includes(str(phase.type)));
  const results = reviewPhases.flatMap((phase) => arr(phase.results));
  const totals = {
    reviewCount: results.length,
    acceptedCount: results.filter((result) => str(result.decision) === 'accept').length,
    reviseCount: results.filter((result) => str(result.decision) === 'revise').length,
    rejectedCount: results.filter((result) => str(result.decision) === 'reject').length,
    failedCount: results.filter((result) => result.ok !== true).length
  };
  return {
    applicable: totals.reviewCount > 0,
    promoteReady: totals.reviewCount > 0 && totals.acceptedCount === totals.reviewCount && totals.failedCount === 0,
    totals,
    checks: [
      { id: 'hasRenderReviews', actual: totals.reviewCount, expected: 1, ok: totals.reviewCount > 0 },
      { id: 'allRenderReviewsAccepted', actual: totals.acceptedCount, expected: totals.reviewCount, ok: totals.reviewCount > 0 && totals.acceptedCount === totals.reviewCount },
      { id: 'noRenderReviewFailures', actual: totals.failedCount, expected: 0, ok: totals.failedCount === 0 }
    ]
  };
}

function runRenderReviewRevisionObjectivesPhase({ phase, phases, outDir }) {
  const phaseId = str(phase.id || 'render_review_revision_objectives');
  const reviewPaths = [
    ...arr(phase.reviewPaths),
    ...arr(phases)
      .filter((row) => ['render_review', 'fseq_render_review'].includes(str(row.type)))
      .flatMap((row) => arr(row.results))
      .map((result) => str(result.renderReviewPath || result.outputPath))
      .filter(Boolean)
  ];
  const outputPath = resolveRepoPath(phase.outPath || path.join(outDir, 'render-review-revision-objectives.json'));
  const artifact = buildRenderReviewRevisionObjectives({
    reviewPaths,
    cycleSummaryPath: '',
    outPath: outputPath
  });
  return {
    id: phaseId,
    type: str(phase.type || 'render_review_revision_objectives'),
    ok: true,
    outputPath,
    summary: artifact.summary,
    objectiveCount: artifact.summary.objectiveCount,
    skippedCount: artifact.summary.skippedCount
  };
}

function runRenderReviewRevisionAttemptsPhase({ phase, phases, outDir }) {
  const phaseId = str(phase.id || 'render_review_revision_attempts');
  const objectivePhase = [...arr(phases)]
    .reverse()
    .find((row) => str(row.type) === 'render_review_revision_objectives' && str(row.outputPath));
  const objectivesPath = resolveRepoPath(phase.objectivesPath || objectivePhase?.outputPath || path.join(outDir, 'render-review-revision-objectives.json'));
  const outputPath = resolveRepoPath(phase.outPath || path.join(outDir, 'render-review-revision-attempts.json'));
  const artifact = buildRenderReviewRevisionAttempts({
    objectivesPath,
    outPath: outputPath,
    targetPolicy: phase.targetPolicy || {},
    defaultEffectName: str(phase.defaultEffectName),
    layer: Number(phase.layer || 0),
    clearExisting: phase.clearExisting === true
  });
  return {
    id: phaseId,
    type: str(phase.type || 'render_review_revision_attempts'),
    ok: true,
    outputPath,
    summary: artifact.summary,
    attemptCount: artifact.summary.attemptCount,
    plannedCount: artifact.summary.plannedCount,
    blockedCount: artifact.summary.blockedCount
  };
}

async function runRenderReviewRevisionExecutionPhase({ phase, phases, outDir, endpoint }) {
  const phaseId = str(phase.id || 'render_review_revision_execution');
  const attemptsPhase = [...arr(phases)]
    .reverse()
    .find((row) => str(row.type) === 'render_review_revision_attempts' && str(row.outputPath));
  const attemptsPath = resolveRepoPath(phase.attemptsPath || attemptsPhase?.outputPath || path.join(outDir, 'render-review-revision-attempts.json'));
  const outputPath = resolveRepoPath(phase.outPath || path.join(outDir, 'render-review-revision-execution.json'));
  const artifact = await runRenderReviewRevisionAttempts({
    attemptsPath,
    outPath: outputPath,
    endpoint: str(phase.endpoint || endpoint),
    sequencePath: str(phase.sequencePath),
    maxAttempts: Number(phase.maxAttempts || 0)
  });
  return {
    id: phaseId,
    type: str(phase.type || 'render_review_revision_execution'),
    ok: artifact.summary.failedCount === 0,
    outputPath,
    summary: artifact.summary,
    executionCount: artifact.summary.executionCount,
    succeededCount: artifact.summary.succeededCount,
    skippedCount: artifact.summary.skippedCount,
    failedCount: artifact.summary.failedCount,
    fseqPaths: arr(artifact.results).map((result) => str(result.fseqPath)).filter(Boolean)
  };
}

function runRenderReviewRevisionComparisonPhase({ phase, phases, outDir, buildFseqReview }) {
  const phaseId = str(phase.id || 'render_review_revision_comparison');
  const executionPhase = [...arr(phases)]
    .reverse()
    .find((row) => str(row.type) === 'render_review_revision_execution' && str(row.outputPath));
  const reviewPhase = [...arr(phases)]
    .reverse()
    .find((row) => str(row.type) === 'fseq_render_review');
  const executionPath = resolveRepoPath(phase.executionPath || executionPhase?.outputPath || path.join(outDir, 'render-review-revision-execution.json'));
  const outputPath = resolveRepoPath(phase.outPath || path.join(outDir, 'render-review-revision-comparisons.json'));
  const artifact = buildRenderReviewRevisionComparisons({
    executionPath,
    geometryPath: resolveRepoPath(phase.geometryPath || reviewPhase?.results?.[0]?.geometryPath || phase.geometry),
    outPath: outputPath,
    outDir: resolveRepoPath(phase.outDir || path.join(outDir, 'render-review-revision-comparison')),
    windowStartMs: Number(phase.windowStartMs ?? 0),
    windowEndMs: Number(phase.windowEndMs ?? 8000),
    stepMs: Number(phase.stepMs ?? 50),
    sampleCount: Number(phase.sampleCount ?? 8),
    width: Number(phase.width ?? 1280),
    height: Number(phase.height ?? 720),
    fps: Number(phase.fps ?? 20),
    nodeRadius: Number(phase.nodeRadius ?? 3),
    buildFseqReview
  });
  return {
    id: phaseId,
    type: str(phase.type || 'render_review_revision_comparison'),
    ok: artifact.summary.regressionCount === 0 && artifact.summary.comparisonCount > 0,
    outputPath,
    summary: artifact.summary,
    comparisonCount: artifact.summary.comparisonCount,
    improvedCount: artifact.summary.improvedCount,
    acceptedAfterRevisionCount: artifact.summary.acceptedAfterRevisionCount,
    regressionCount: artifact.summary.regressionCount
  };
}

export async function runSelfImprovementCycle({
  manifestPath = DEFAULT_MANIFEST,
  outDir = '',
  projectDirs = [],
  discoverUnder = [],
  skipCommands = false,
  runLiveProbes = false,
  endpoint = process.env.XLIGHTS_ENDPOINT || 'http://127.0.0.1:49915/xlightsdesigner/api',
  showDir = '',
  continueOnFailure = false,
  buildFseqReview = buildRenderReviewFromFseq
} = {}) {
  const resolvedManifestPath = path.resolve(REPO_ROOT, manifestPath);
  const manifest = readJson(resolvedManifestPath);
  const manifestErrors = validateManifest(manifest);
  if (manifestErrors.length) {
    return { ok: false, manifestPath: resolvedManifestPath, errors: manifestErrors };
  }

  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const resolvedOutDir = path.resolve(REPO_ROOT, outDir || path.join(DEFAULT_LOG_ROOT, runId));
  fs.mkdirSync(resolvedOutDir, { recursive: true });
  fs.mkdirSync(path.dirname(path.join(REPO_ROOT, DEFAULT_LOG_ROOT, 'latest')), { recursive: true });
  try {
    fs.rmSync(path.join(REPO_ROOT, DEFAULT_LOG_ROOT, 'latest'), { force: true });
    fs.symlinkSync(resolvedOutDir, path.join(REPO_ROOT, DEFAULT_LOG_ROOT, 'latest'), 'dir');
  } catch {
    // Symlink creation is helpful but not required for the cycle result.
  }

  const phases = [];
  if (!skipCommands) {
    for (const phase of arr(manifest.cyclePhases).filter((row) => row?.type === 'command')) {
      const result = await runCommand(str(phase.command), { outDir: resolvedOutDir, phaseId: str(phase.id) });
      phases.push(result);
      if (!result.ok && phase.required !== false && !continueOnFailure) {
        const output = { ok: false, manifestPath: resolvedManifestPath, outDir: resolvedOutDir, phases, errors: [`phase failed: ${phase.id}`] };
        writeJson(path.join(resolvedOutDir, 'cycle-summary.json'), output);
        return output;
      }
    }
  }
  for (const phase of arr(manifest.cyclePhases).filter((row) => row?.type === 'render_review')) {
    const result = await runRenderReviewPhase({ phase, outDir: resolvedOutDir });
    phases.push(result);
    if (!result.ok && phase.required !== false && !continueOnFailure) {
      const output = { ok: false, manifestPath: resolvedManifestPath, outDir: resolvedOutDir, phases, errors: [`phase failed: ${phase.id}`] };
      writeJson(path.join(resolvedOutDir, 'cycle-summary.json'), output);
      return output;
    }
  }
  for (const phase of arr(manifest.cyclePhases).filter((row) => row?.type === 'fseq_render_review')) {
    const result = await runFseqRenderReviewPhase({ phase, outDir: resolvedOutDir, buildFseqReview });
    phases.push(result);
    if (!result.ok && phase.required !== false && !continueOnFailure) {
      const output = { ok: false, manifestPath: resolvedManifestPath, outDir: resolvedOutDir, phases, errors: [`phase failed: ${phase.id}`] };
      writeJson(path.join(resolvedOutDir, 'cycle-summary.json'), output);
      return output;
    }
  }
  for (const phase of arr(manifest.cyclePhases).filter((row) => row?.type === 'render_review_revision_objectives')) {
    const result = runRenderReviewRevisionObjectivesPhase({ phase, phases, outDir: resolvedOutDir });
    phases.push(result);
  }
  for (const phase of arr(manifest.cyclePhases).filter((row) => row?.type === 'render_review_revision_attempts')) {
    const result = runRenderReviewRevisionAttemptsPhase({ phase, phases, outDir: resolvedOutDir });
    phases.push(result);
  }
  for (const phase of arr(manifest.cyclePhases).filter((row) => row?.type === 'render_review_revision_execution')) {
    const result = await runRenderReviewRevisionExecutionPhase({ phase, phases, outDir: resolvedOutDir, endpoint: str(endpoint) });
    phases.push(result);
    if (!result.ok && phase.required !== false && !continueOnFailure) {
      const output = { ok: false, manifestPath: resolvedManifestPath, outDir: resolvedOutDir, phases, errors: [`phase failed: ${phase.id}`] };
      writeJson(path.join(resolvedOutDir, 'cycle-summary.json'), output);
      return output;
    }
  }
  for (const phase of arr(manifest.cyclePhases).filter((row) => row?.type === 'render_review_revision_comparison')) {
    const result = runRenderReviewRevisionComparisonPhase({ phase, phases, outDir: resolvedOutDir, buildFseqReview });
    phases.push(result);
    if (!result.ok && phase.required !== false && !continueOnFailure) {
      const output = { ok: false, manifestPath: resolvedManifestPath, outDir: resolvedOutDir, phases, errors: [`phase failed: ${phase.id}`] };
      writeJson(path.join(resolvedOutDir, 'cycle-summary.json'), output);
      return output;
    }
  }
  const liveProjectDirs = [];
  if (runLiveProbes) {
    for (const phase of arr(manifest.cyclePhases).filter((row) => ['live_custom_model_probe', 'live_target_behavior_probe'].includes(row?.type))) {
      const result = await runLiveTargetBehaviorProbePhase({
        phase,
        manifest,
        outDir: resolvedOutDir,
        endpoint: str(endpoint),
        showDir: str(showDir)
      });
      phases.push(result);
      liveProjectDirs.push(...arr(result.projectDirs));
      if (!result.ok && phase.required !== false && !continueOnFailure) {
        const output = { ok: false, manifestPath: resolvedManifestPath, outDir: resolvedOutDir, phases, errors: [`phase failed: ${phase.id}`] };
        writeJson(path.join(resolvedOutDir, 'cycle-summary.json'), output);
        return output;
      }
    }
  }

  const resolvedProjectDirs = collectProjectDirs({
    projectDirs: [...arr(projectDirs), ...liveProjectDirs],
    discoverUnder
  });
  const exportedSummaries = exportTargetBehaviorSummaries({ projectDirs: resolvedProjectDirs, outDir: resolvedOutDir });
  const promotionGate = evaluatePromotionGate({ manifest, exportedSummaries });
  const renderReviewGate = evaluateRenderReviewGate({ phases });
  const nextActions = renderReviewGate.applicable && !renderReviewGate.promoteReady
    ? ['revise render-review sections and rerun FSEQ/media review before promotion']
    : promotionGate.promoteReady
      ? ['review anonymized summaries for shared-training promotion']
      : ['generate more accepted apply/render outcomes for the initial effect and target scope'];
  const output = {
    ok: phases.every((phase) => phase.ok) && true,
    manifestPath: resolvedManifestPath,
    outDir: resolvedOutDir,
    initialScope: manifest.initialScope,
    phases,
    targetBehaviorExports: exportedSummaries,
    promotionGate,
    renderReviewGate,
    nextActions
  };
  writeJson(path.join(resolvedOutDir, 'cycle-summary.json'), output);
  return output;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      process.stdout.write(usage());
      process.exit(0);
    }
    const result = await runSelfImprovementCycle(args);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!result.ok) process.exit(1);
  } catch (error) {
    console.error(error?.stack || String(error));
    process.exit(1);
  }
}
