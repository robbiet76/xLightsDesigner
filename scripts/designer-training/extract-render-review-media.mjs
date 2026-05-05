#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ACTIVE_PIXEL_THRESHOLD = 0.05;
const DOMINANT_PIXEL_THRESHOLD = 0.8;
const ACTIVE_PIXEL_EPSILON = 0.0003;
const ACTIVE_BRIGHTNESS_EPSILON = 0.0003;
const COLOR_QUANTIZATION_STEP = 32;

function str(value = '') {
  return String(value || '').trim();
}

function number(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round6(value) {
  return Math.round(number(value) * 1_000_000) / 1_000_000;
}

function resolvePath(filePath = '') {
  const value = str(filePath);
  if (!value) return '';
  return path.isAbsolute(value) ? value : path.resolve(REPO_ROOT, value);
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function parseArgs(argv = []) {
  const args = {
    mediaPath: '',
    outDir: '',
    frameFeaturesOut: '',
    framesDir: '',
    contactSheetOut: '',
    startMs: 0,
    endMs: 0,
    sampleCount: 16,
    keepFrames: true,
    buildContactSheet: true
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = str(argv[index]);
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${token}`);
      return argv[index];
    };
    if (token === '--media') args.mediaPath = resolvePath(next());
    else if (token === '--out-dir') args.outDir = resolvePath(next());
    else if (token === '--frame-features-out') args.frameFeaturesOut = resolvePath(next());
    else if (token === '--frames-dir') args.framesDir = resolvePath(next());
    else if (token === '--contact-sheet-out') args.contactSheetOut = resolvePath(next());
    else if (token === '--start-ms') args.startMs = Number(next());
    else if (token === '--end-ms') args.endMs = Number(next());
    else if (token === '--sample-count') args.sampleCount = Number(next());
    else if (token === '--no-frames') args.keepFrames = false;
    else if (token === '--no-contact-sheet') args.buildContactSheet = false;
    else if (token === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${token}`);
  }
  return args;
}

function usage() {
  return `Usage:
  node scripts/designer-training/extract-render-review-media.mjs --media section.mp4 --out-dir var/tmp/review-media

Options:
  --start-ms 0 --end-ms 8000
  --sample-count 16
  --frame-features-out features.json
  --frames-dir frames/
  --contact-sheet-out contact-sheet.jpg
  --no-frames
  --no-contact-sheet
`;
}

function run(command, args, options = {}) {
  return execFileSync(command, args, { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1024 * 1024 * 256, ...options });
}

function probeMedia(mediaPath) {
  const payload = JSON.parse(run('ffprobe', [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height',
    '-show_entries', 'format=duration',
    '-of', 'json',
    mediaPath
  ]).toString('utf8'));
  const stream = (payload.streams || [{}])[0];
  const width = Number(stream.width || 0);
  const height = Number(stream.height || 0);
  const durationSeconds = Number(payload.format?.duration || 0);
  if (!width || !height) throw new Error(`Unable to determine media dimensions: ${mediaPath}`);
  return { width, height, durationSeconds: durationSeconds > 0 ? durationSeconds : 1 };
}

function sectionTiming({ durationSeconds, startMs, endMs }) {
  const startSeconds = Math.max(0, number(startMs) / 1000);
  const requestedEndSeconds = number(endMs) > 0 ? number(endMs) / 1000 : durationSeconds;
  const endSeconds = Math.min(Math.max(requestedEndSeconds, startSeconds), durationSeconds);
  const sectionDurationSeconds = Math.max(0.001, endSeconds - startSeconds || durationSeconds);
  return { startSeconds, endSeconds, sectionDurationSeconds };
}

function ffmpegInputArgs({ mediaPath, startSeconds, sectionDurationSeconds }) {
  const args = [];
  if (startSeconds > 0) args.push('-ss', String(startSeconds));
  args.push('-i', mediaPath);
  if (sectionDurationSeconds > 0) args.push('-t', String(sectionDurationSeconds));
  return args;
}

function sampleRawFrames({ mediaPath, width, height, startSeconds, sectionDurationSeconds, sampleCount }) {
  const fps = Math.max(1, Math.min(30, number(sampleCount, 16) / Math.max(sectionDurationSeconds, 0.001)));
  const raw = run('ffmpeg', [
    '-v', 'error',
    ...ffmpegInputArgs({ mediaPath, startSeconds, sectionDurationSeconds }),
    '-vf', `fps=${fps.toFixed(6)}`,
    '-f', 'rawvideo',
    '-pix_fmt', 'rgb24',
    'pipe:1'
  ]);
  const frameSize = width * height * 3;
  const frameCount = frameSize > 0 ? Math.floor(raw.length / frameSize) : 0;
  const metrics = [];
  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const start = frameIndex * frameSize;
    const end = start + frameSize;
    const chunk = raw.subarray(start, end);
    metrics.push(measureFrame(chunk, width, height, frameIndex));
  }
  return { fps: round6(fps), metrics };
}

function quantizedColorKey(rByte, gByte, bByte) {
  const quantize = (value) => Math.max(0, Math.min(7, Math.floor(value / COLOR_QUANTIZATION_STEP)));
  return `${quantize(rByte)},${quantize(gByte)},${quantize(bByte)}`;
}

function colorClassKey(rByte, gByte, bByte) {
  const max = Math.max(rByte, gByte, bByte);
  const min = Math.min(rByte, gByte, bByte);
  if (max - min <= 18) return 'white';
  if (rByte >= gByte * 1.25 && rByte >= bByte * 1.25) return 'red';
  if (gByte >= rByte * 1.25 && gByte >= bByte * 1.25) return 'green';
  if (bByte >= rByte * 1.25 && bByte >= gByte * 1.25) return 'blue';
  if (rByte >= bByte * 1.2 && gByte >= bByte * 1.2) return 'yellow';
  if (rByte >= gByte * 1.2 && bByte >= gByte * 1.2) return 'magenta';
  if (gByte >= rByte * 1.2 && bByte >= rByte * 1.2) return 'cyan';
  return 'mixed';
}

function measureFrame(chunk, width, height, frameIndex) {
  const total = width * height;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let sumBrightness = 0;
  let active = 0;
  let dominant = 0;
  const seen = new Set();
  const activeQuantized = new Set();
  const activeClasses = new Set();
  for (let index = 0; index < chunk.length; index += 3) {
    const rByte = chunk[index];
    const gByte = chunk[index + 1];
    const bByte = chunk[index + 2];
    const r = rByte / 255;
    const g = gByte / 255;
    const b = bByte / 255;
    const brightness = (r + g + b) / 3;
    sumR += r;
    sumG += g;
    sumB += b;
    sumBrightness += brightness;
    if (brightness > ACTIVE_PIXEL_THRESHOLD) {
      active += 1;
      activeQuantized.add(quantizedColorKey(rByte, gByte, bByte));
      activeClasses.add(colorClassKey(rByte, gByte, bByte));
    }
    if (brightness > DOMINANT_PIXEL_THRESHOLD) dominant += 1;
    seen.add(`${rByte},${gByte},${bByte}`);
  }
  return {
    frameIndex,
    frameAverageBrightness: total ? sumBrightness / total : 0,
    frameActivePixelRatio: total ? active / total : 0,
    frameDominantPixelRatio: total ? dominant / total : 0,
    frameUniqueColorCount: seen.size,
    frameActiveUniqueColorCount: activeQuantized.size,
    frameActiveColorClassCount: activeClasses.size,
    frameAverageRgb: {
      r: total ? sumR / total : 0,
      g: total ? sumG / total : 0,
      b: total ? sumB / total : 0
    }
  };
}

function bestFrame(metrics = []) {
  return [...metrics].sort((left, right) => (
    (right.frameActivePixelRatio - left.frameActivePixelRatio)
    || (right.frameAverageBrightness - left.frameAverageBrightness)
    || (right.frameUniqueColorCount - left.frameUniqueColorCount)
  ))[0];
}

function summarizeFrameMetrics(metrics = []) {
  if (!metrics.length) {
    return {
      sampledFrameCount: 0,
      nonBlankSampledFrameCount: 0,
      nonBlankSampledFrameRatio: 0,
      activeSampledFrameStartIndex: null,
      activeSampledFrameEndIndex: null,
      activeSampledFrameSpanRatio: 0,
      temporalBrightnessDeltaMean: 0,
      temporalActiveDeltaMean: 0,
      temporalDominantDeltaMean: 0,
      temporalUniqueColorDeltaMean: 0,
      temporalColorDeltaMean: 0,
      temporalMotionMean: 0,
      temporalMotionPeak: 0,
      temporalSignature: 'static_or_near_static',
      sampledFrameMetrics: [],
      sampledFrameTransitions: [],
      representativeSampledFrameIndex: 0,
      representativeSampledFrameAverageBrightness: 0,
      representativeSampledFrameActivePixelRatio: 0,
      representativeSampledFrameDominantPixelRatio: 0,
      representativeSampledFrameUniqueColorCount: 0,
      representativeSampledFrameActiveUniqueColorCount: 0,
      representativeSampledFrameActiveColorClassCount: 0,
      meanSampledFrameActiveUniqueColorCount: 0,
      meanSampledFrameActiveColorClassCount: 0,
      representativeSampledFrameAverageRgb: { r: 0, g: 0, b: 0 }
    };
  }

  const transitions = [];
  for (let index = 1; index < metrics.length; index += 1) {
    const previous = metrics[index - 1];
    const current = metrics[index];
    const brightnessDelta = Math.abs(current.frameAverageBrightness - previous.frameAverageBrightness);
    const activeDelta = Math.abs(current.frameActivePixelRatio - previous.frameActivePixelRatio);
    const dominantDelta = Math.abs(current.frameDominantPixelRatio - previous.frameDominantPixelRatio);
    const uniqueColorDelta = Math.abs(current.frameUniqueColorCount - previous.frameUniqueColorCount);
    const colorDelta = (
      Math.abs(current.frameAverageRgb.r - previous.frameAverageRgb.r)
      + Math.abs(current.frameAverageRgb.g - previous.frameAverageRgb.g)
      + Math.abs(current.frameAverageRgb.b - previous.frameAverageRgb.b)
    ) / 3;
    const combinedDelta = (
      brightnessDelta * 0.35
      + activeDelta * 0.25
      + dominantDelta * 0.1
      + Math.min(uniqueColorDelta / 8, 1) * 0.1
      + colorDelta * 0.2
    );
    transitions.push({
      fromFrameIndex: previous.frameIndex,
      toFrameIndex: current.frameIndex,
      brightnessDelta: round6(brightnessDelta),
      activeDelta: round6(activeDelta),
      dominantDelta: round6(dominantDelta),
      uniqueColorDelta,
      colorDelta: round6(colorDelta),
      combinedDelta: round6(combinedDelta)
    });
  }

  const average = (key) => transitions.length
    ? transitions.reduce((sum, row) => sum + row[key], 0) / transitions.length
    : 0;
  const maximum = (key) => transitions.length
    ? Math.max(...transitions.map((row) => row[key]))
    : 0;
  const activeFrames = metrics.filter((row) => (
    row.frameActivePixelRatio > ACTIVE_PIXEL_EPSILON
    || row.frameAverageBrightness > ACTIVE_BRIGHTNESS_EPSILON
    || row.frameUniqueColorCount > 1
  ));
  const activeStart = activeFrames.length ? activeFrames[0].frameIndex : null;
  const activeEnd = activeFrames.length ? activeFrames[activeFrames.length - 1].frameIndex : null;
  const activeSpanRatio = activeFrames.length ? (activeFrames.length - 1) / Math.max(1, metrics.length - 1) : 0;
  const motionMean = average('combinedDelta');
  const representative = bestFrame(metrics);
  const temporalSignature = motionMean >= 0.12
    ? 'high_motion'
    : motionMean >= 0.04
      ? 'moderate_motion'
      : motionMean > 0.01
        ? 'subtle_motion'
        : 'static_or_near_static';

  return {
    sampledFrameCount: metrics.length,
    nonBlankSampledFrameCount: activeFrames.length,
    nonBlankSampledFrameRatio: round6(activeFrames.length / metrics.length),
    activeSampledFrameStartIndex: activeStart,
    activeSampledFrameEndIndex: activeEnd,
    activeSampledFrameSpanRatio: round6(activeSpanRatio),
    temporalBrightnessDeltaMean: round6(average('brightnessDelta')),
    temporalActiveDeltaMean: round6(average('activeDelta')),
    temporalDominantDeltaMean: round6(average('dominantDelta')),
    temporalUniqueColorDeltaMean: round6(average('uniqueColorDelta')),
    temporalColorDeltaMean: round6(average('colorDelta')),
    temporalMotionMean: round6(motionMean),
    temporalMotionPeak: round6(maximum('combinedDelta')),
    temporalSignature,
    sampledFrameMetrics: metrics.map((row) => ({
      frameIndex: row.frameIndex,
      frameAverageBrightness: round6(row.frameAverageBrightness),
      frameActivePixelRatio: round6(row.frameActivePixelRatio),
      frameDominantPixelRatio: round6(row.frameDominantPixelRatio),
      frameUniqueColorCount: row.frameUniqueColorCount,
      frameActiveUniqueColorCount: row.frameActiveUniqueColorCount,
      frameActiveColorClassCount: row.frameActiveColorClassCount,
      frameAverageRgb: {
        r: round6(row.frameAverageRgb.r),
        g: round6(row.frameAverageRgb.g),
        b: round6(row.frameAverageRgb.b)
      }
    })),
    sampledFrameTransitions: transitions,
    representativeSampledFrameIndex: representative.frameIndex,
    representativeSampledFrameAverageBrightness: round6(representative.frameAverageBrightness),
    representativeSampledFrameActivePixelRatio: round6(representative.frameActivePixelRatio),
    representativeSampledFrameDominantPixelRatio: round6(representative.frameDominantPixelRatio),
    representativeSampledFrameUniqueColorCount: representative.frameUniqueColorCount,
    representativeSampledFrameActiveUniqueColorCount: representative.frameActiveUniqueColorCount,
    representativeSampledFrameActiveColorClassCount: representative.frameActiveColorClassCount,
    meanSampledFrameActiveUniqueColorCount: round6(metrics.reduce((sum, row) => sum + row.frameActiveUniqueColorCount, 0) / metrics.length),
    meanSampledFrameActiveColorClassCount: round6(metrics.reduce((sum, row) => sum + row.frameActiveColorClassCount, 0) / metrics.length),
    representativeSampledFrameAverageRgb: {
      r: round6(representative.frameAverageRgb.r),
      g: round6(representative.frameAverageRgb.g),
      b: round6(representative.frameAverageRgb.b)
    }
  };
}

function extractFrameImages({ mediaPath, framesDir, startSeconds, sectionDurationSeconds, fps }) {
  fs.mkdirSync(framesDir, { recursive: true });
  run('ffmpeg', [
    '-y',
    '-v', 'error',
    ...ffmpegInputArgs({ mediaPath, startSeconds, sectionDurationSeconds }),
    '-vf', `fps=${fps}`,
    path.join(framesDir, 'frame-%03d.png')
  ]);
}

function buildContactSheet({ mediaPath, contactSheetPath, startSeconds, sectionDurationSeconds, fps, sampleCount }) {
  fs.mkdirSync(path.dirname(contactSheetPath), { recursive: true });
  const columns = Math.ceil(Math.sqrt(Math.max(1, number(sampleCount, 16))));
  const rows = Math.ceil(Math.max(1, number(sampleCount, 16)) / columns);
  run('ffmpeg', [
    '-y',
    '-v', 'error',
    ...ffmpegInputArgs({ mediaPath, startSeconds, sectionDurationSeconds }),
    '-vf', `fps=${fps},scale=320:-1,tile=${columns}x${rows}`,
    '-frames:v', '1',
    contactSheetPath
  ]);
}

export function extractRenderReviewMedia({
  mediaPath,
  outDir = '',
  frameFeaturesOut = '',
  framesDir = '',
  contactSheetOut = '',
  startMs = 0,
  endMs = 0,
  sampleCount = 16,
  keepFrames = true,
  buildContactSheet: shouldBuildContactSheet = true
} = {}) {
  const resolvedMediaPath = resolvePath(mediaPath);
  if (!resolvedMediaPath || !fs.existsSync(resolvedMediaPath)) {
    throw new Error(`media file not found: ${resolvedMediaPath || '(missing)'}`);
  }
  const resolvedOutDir = resolvePath(outDir || path.join(path.dirname(resolvedMediaPath), 'render-review-media'));
  const resolvedFrameFeaturesOut = resolvePath(frameFeaturesOut || path.join(resolvedOutDir, 'frame-features.json'));
  const resolvedFramesDir = resolvePath(framesDir || path.join(resolvedOutDir, 'frames'));
  const resolvedContactSheetOut = resolvePath(contactSheetOut || path.join(resolvedOutDir, 'contact-sheet.jpg'));
  fs.mkdirSync(resolvedOutDir, { recursive: true });

  const probe = probeMedia(resolvedMediaPath);
  const timing = sectionTiming({ durationSeconds: probe.durationSeconds, startMs, endMs });
  const sampled = sampleRawFrames({
    mediaPath: resolvedMediaPath,
    width: probe.width,
    height: probe.height,
    startSeconds: timing.startSeconds,
    sectionDurationSeconds: timing.sectionDurationSeconds,
    sampleCount
  });
  const features = {
    artifactType: 'render_review_frame_features_v1',
    artifactVersion: '1.0',
    mediaPath: resolvedMediaPath,
    mediaWidth: probe.width,
    mediaHeight: probe.height,
    mediaDurationSeconds: round6(probe.durationSeconds),
    analysisWindowStartMs: Math.round(timing.startSeconds * 1000),
    analysisWindowEndMs: Math.round(timing.endSeconds * 1000),
    analysisWindowDurationMs: Math.round(timing.sectionDurationSeconds * 1000),
    requestedSampleCount: Math.max(1, Math.round(number(sampleCount, 16))),
    sampleFps: sampled.fps,
    ...summarizeFrameMetrics(sampled.metrics)
  };
  writeJson(resolvedFrameFeaturesOut, features);

  if (keepFrames) {
    extractFrameImages({
      mediaPath: resolvedMediaPath,
      framesDir: resolvedFramesDir,
      startSeconds: timing.startSeconds,
      sectionDurationSeconds: timing.sectionDurationSeconds,
      fps: sampled.fps
    });
  }
  if (shouldBuildContactSheet) {
    buildContactSheet({
      mediaPath: resolvedMediaPath,
      contactSheetPath: resolvedContactSheetOut,
      startSeconds: timing.startSeconds,
      sectionDurationSeconds: timing.sectionDurationSeconds,
      fps: sampled.fps,
      sampleCount
    });
  }

  return {
    ok: true,
    artifactType: 'render_review_media_extraction_v1',
    mediaPath: resolvedMediaPath,
    outDir: resolvedOutDir,
    frameFeaturesPath: resolvedFrameFeaturesOut,
    framesDir: keepFrames ? resolvedFramesDir : '',
    contactSheetPath: shouldBuildContactSheet ? resolvedContactSheetOut : '',
    sampledFrameCount: features.sampledFrameCount,
    nonBlankSampledFrameRatio: features.nonBlankSampledFrameRatio,
    temporalMotionMean: features.temporalMotionMean,
    temporalSignature: features.temporalSignature
  };
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help || !args.mediaPath) {
      process.stdout.write(usage());
      process.exit(args.help ? 0 : 1);
    }
    const result = extractRenderReviewMedia(args);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    console.error(error?.stack || String(error));
    process.exit(1);
  }
}
