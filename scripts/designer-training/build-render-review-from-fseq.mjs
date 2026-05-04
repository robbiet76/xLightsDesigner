#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildRenderReviewArtifact } from './build-render-review-artifact.mjs';
import { extractRenderReviewMedia } from './extract-render-review-media.mjs';
import { renderPreviewWindowMedia } from './render-preview-window-media.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function str(value = '') {
  return String(value || '').trim();
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

export function buildFrameOffsets({ startMs = 0, endMs = 0, stepMs = 50, sampleCount = 8, frameOffsets = '' } = {}) {
  const explicit = str(frameOffsets)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => Number(part))
    .filter((value) => Number.isInteger(value) && value >= 0);
  if (explicit.length) return [...new Set(explicit)].sort((left, right) => left - right);

  const durationMs = Math.max(1, number(endMs) - number(startMs));
  const frames = Math.max(1, Math.ceil(durationMs / Math.max(1, number(stepMs, 50))));
  const last = Math.max(0, frames - 1);
  const count = Math.max(1, Math.min(last + 1, Math.round(number(sampleCount, 8))));
  if (count === 1) return [Math.round(last / 2)];
  const offsets = [];
  for (let index = 0; index < count; index += 1) {
    offsets.push(Math.round((last * index) / (count - 1)));
  }
  return [...new Set(offsets)].sort((left, right) => left - right);
}

function parseArgs(argv = []) {
  const args = {
    geometryPath: '',
    fseqPath: '',
    intentPath: '',
    outDir: '',
    windowStartMs: 0,
    windowEndMs: 8000,
    stepMs: 50,
    sampleCount: 8,
    frameOffsets: '',
    width: 1280,
    height: 720,
    fps: 20,
    nodeRadius: 3,
    includeAuditExcluded: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = str(argv[index]);
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${token}`);
      return argv[index];
    };
    if (token === '--geometry') args.geometryPath = resolvePath(next());
    else if (token === '--fseq') args.fseqPath = resolvePath(next());
    else if (token === '--intent') args.intentPath = resolvePath(next());
    else if (token === '--out-dir') args.outDir = resolvePath(next());
    else if (token === '--window-start-ms') args.windowStartMs = Number(next());
    else if (token === '--window-end-ms') args.windowEndMs = Number(next());
    else if (token === '--step-ms') args.stepMs = Number(next());
    else if (token === '--sample-count') args.sampleCount = Number(next());
    else if (token === '--frame-offsets') args.frameOffsets = str(next());
    else if (token === '--width') args.width = Number(next());
    else if (token === '--height') args.height = Number(next());
    else if (token === '--fps') args.fps = Number(next());
    else if (token === '--node-radius') args.nodeRadius = Number(next());
    else if (token === '--include-audit-excluded') args.includeAuditExcluded = true;
    else if (token === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${token}`);
  }
  return args;
}

function usage() {
  return `Usage:
  node scripts/designer-training/build-render-review-from-fseq.mjs \
    --geometry preview-scene-geometry.json \
    --fseq sequence.fseq \
    --out-dir var/tmp/fseq-render-review \
    --window-start-ms 0 \
    --window-end-ms 8000

Options:
  --intent section-intent.json
  --frame-offsets 0,8,16
  --step-ms 50
  --sample-count 8
  --width 1280 --height 720 --fps 20 --node-radius 3
  --include-audit-excluded
`;
}

function runReconstructPreviewWindow({
  geometryPath,
  fseqPath,
  windowStartMs,
  windowEndMs,
  frameOffsets,
  outPath,
  includeAuditExcluded = false
}) {
  const args = [
    'scripts/sequencer-render-training/tooling/reconstruct-preview-scene-window.py',
    '--geometry', geometryPath,
    '--fseq', fseqPath,
    '--window-start-ms', String(Math.round(number(windowStartMs))),
    '--window-end-ms', String(Math.round(number(windowEndMs))),
    '--frame-offsets', frameOffsets.join(','),
    '--out', outPath
  ];
  if (includeAuditExcluded) args.push('--include-audit-excluded');
  const stdout = execFileSync('python3', args, { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return stdout ? JSON.parse(stdout) : {};
}

export function buildRenderReviewFromFseq({
  geometryPath,
  fseqPath,
  intentPath = '',
  outDir = '',
  windowStartMs = 0,
  windowEndMs = 8000,
  stepMs = 50,
  sampleCount = 8,
  frameOffsets = '',
  width = 1280,
  height = 720,
  fps = 20,
  nodeRadius = 3,
  includeAuditExcluded = false
} = {}) {
  const resolvedGeometryPath = resolvePath(geometryPath);
  const resolvedFseqPath = resolvePath(fseqPath);
  if (!resolvedGeometryPath || !fs.existsSync(resolvedGeometryPath)) throw new Error(`geometry file not found: ${resolvedGeometryPath || '(missing)'}`);
  if (!resolvedFseqPath || !fs.existsSync(resolvedFseqPath)) throw new Error(`fseq file not found: ${resolvedFseqPath || '(missing)'}`);
  const resolvedOutDir = resolvePath(outDir || path.join(REPO_ROOT, 'var/tmp/fseq-render-review'));
  fs.mkdirSync(resolvedOutDir, { recursive: true });

  const offsets = buildFrameOffsets({ startMs: windowStartMs, endMs: windowEndMs, stepMs, sampleCount, frameOffsets });
  const previewWindowPath = path.join(resolvedOutDir, 'preview-scene-window.json');
  const previewMediaPath = path.join(resolvedOutDir, 'preview-window.mp4');
  const reviewPath = path.join(resolvedOutDir, 'render-review.json');
  const reconstruct = runReconstructPreviewWindow({
    geometryPath: resolvedGeometryPath,
    fseqPath: resolvedFseqPath,
    windowStartMs,
    windowEndMs,
    frameOffsets: offsets,
    outPath: previewWindowPath,
    includeAuditExcluded
  });
  const previewMedia = renderPreviewWindowMedia({
    windowPath: previewWindowPath,
    out: previewMediaPath,
    framesDir: path.join(resolvedOutDir, 'preview-media-frames'),
    width,
    height,
    fps,
    nodeRadius
  });
  const mediaExtraction = extractRenderReviewMedia({
    mediaPath: previewMediaPath,
    outDir: path.join(resolvedOutDir, 'render-review-media'),
    sampleCount
  });
  const intent = intentPath && fs.existsSync(resolvePath(intentPath)) ? readJson(resolvePath(intentPath)) : {};
  const review = buildRenderReviewArtifact({
    frameFeatures: readJson(mediaExtraction.frameFeaturesPath),
    intent,
    evidence: {
      videoPath: previewMediaPath,
      contactSheetPath: mediaExtraction.contactSheetPath,
      frameDirectory: mediaExtraction.framesDir,
      frameFeaturesPath: mediaExtraction.frameFeaturesPath,
      sequencePath: resolvedFseqPath
    },
    section: {
      id: str(intent?.section?.id || 'fseq-window'),
      label: str(intent?.section?.label || ''),
      startMs: Number(windowStartMs || 0),
      endMs: Number(windowEndMs || 0)
    }
  });
  writeJson(reviewPath, review);
  const result = {
    ok: true,
    artifactType: 'fseq_render_review_run_v1',
    geometryPath: resolvedGeometryPath,
    fseqPath: resolvedFseqPath,
    outDir: resolvedOutDir,
    previewWindowPath,
    previewMediaPath,
    frameFeaturesPath: mediaExtraction.frameFeaturesPath,
    contactSheetPath: mediaExtraction.contactSheetPath,
    renderReviewPath: reviewPath,
    frameOffsets: offsets,
    reconstruct,
    previewMedia,
    mediaExtraction,
    decision: review.critique.decision,
    overallQuality: review.qualityScores.overallQuality
  };
  writeJson(path.join(resolvedOutDir, 'fseq-render-review-run.json'), result);
  return result;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help || !args.geometryPath || !args.fseqPath) {
      process.stdout.write(usage());
      process.exit(args.help ? 0 : 1);
    }
    process.stdout.write(`${JSON.stringify(buildRenderReviewFromFseq(args), null, 2)}\n`);
  } catch (error) {
    console.error(error?.stack || String(error));
    process.exit(1);
  }
}
