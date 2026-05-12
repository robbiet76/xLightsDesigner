#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { exportXLightsPreviewVideo } from "./export-xlights-preview-video.mjs";
import { extractRenderReviewMedia } from "../../designer-training/extract-render-review-media.mjs";
import { buildRenderReviewArtifact } from "../../designer-training/build-render-review-artifact.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const DEFAULT_ENDPOINT = "http://127.0.0.1:49915/xlightsdesigner/api";
const DEFAULT_OUT_DIR = "var/benchmarks/production-sequence-read/video-review";
const DEFAULT_VIDEO_LONG_SIDE = 2000;
const DEFAULT_VIDEO_ASPECT_RATIO = 16 / 9;

function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function num(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function resolvePath(filePath = "") {
  const value = str(filePath);
  if (!value) return "";
  return path.isAbsolute(value) ? value : path.resolve(REPO_ROOT, value);
}

function slug(value = "") {
  return str(value).toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "sequence";
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function readTextIfExists(filePath = "") {
  const resolved = resolvePath(filePath);
  if (!resolved || !fs.existsSync(resolved)) return "";
  return fs.readFileSync(resolved, "utf8");
}

function evenDimension(value) {
  const rounded = Math.max(2, Math.round(Number(value) || 0));
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

function positive(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function derivePreviewVideoSize({
  previewWidth = 0,
  previewHeight = 0,
  requestedWidth = 0,
  requestedHeight = 0,
  longSide = DEFAULT_VIDEO_LONG_SIDE
} = {}) {
  const explicitWidth = positive(requestedWidth);
  const explicitHeight = positive(requestedHeight);
  if (explicitWidth || explicitHeight) {
    if (!(explicitWidth && explicitHeight)) {
      throw new Error("--video-width and --video-height must be provided together");
    }
    return {
      width: evenDimension(explicitWidth),
      height: evenDimension(explicitHeight),
      source: "explicit"
    };
  }

  const layoutWidth = positive(previewWidth);
  const layoutHeight = positive(previewHeight);
  const aspectRatio = layoutWidth && layoutHeight
    ? layoutWidth / layoutHeight
    : DEFAULT_VIDEO_ASPECT_RATIO;
  const targetLongSide = evenDimension(positive(longSide) || DEFAULT_VIDEO_LONG_SIDE);
  if (aspectRatio >= 1) {
    return {
      width: targetLongSide,
      height: evenDimension(targetLongSide / aspectRatio),
      source: layoutWidth && layoutHeight ? "layout_preview_canvas" : "fallback_aspect_ratio",
      previewWidth: layoutWidth || null,
      previewHeight: layoutHeight || null
    };
  }
  return {
    width: evenDimension(targetLongSide * aspectRatio),
    height: targetLongSide,
    source: layoutWidth && layoutHeight ? "layout_preview_canvas" : "fallback_aspect_ratio",
    previewWidth: layoutWidth || null,
    previewHeight: layoutHeight || null
  };
}

async function readLayoutSettings(endpoint = DEFAULT_ENDPOINT, {
  fetchImpl = globalThis.fetch,
  timeoutMs = 30000
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("fetch is unavailable");
  }
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timeout = setTimeout(() => controller?.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${str(endpoint).replace(/\/+$/, "")}/layout/settings`, {
      signal: controller?.signal
    });
    const payload = await response.json();
    if (!response.ok || payload?.ok === false) {
      throw new Error(`layout.getSettings failed: ${payload?.error?.message || response.statusText}`);
    }
    return payload?.data || {};
  } finally {
    clearTimeout(timeout);
  }
}

function parseArgs(argv = []) {
  const args = {
    manifestPath: "",
    outDir: DEFAULT_OUT_DIR,
    endpoint: DEFAULT_ENDPOINT,
    maxSequences: 0,
    sequenceIds: [],
    excludeSequenceIds: [],
    initialAuditOnly: false,
    skipExport: false,
    reuseExistingVideos: false,
    sampleCount: 32,
    keepFrames: false,
    videoWidth: 0,
    videoHeight: 0,
    videoLongSide: DEFAULT_VIDEO_LONG_SIDE,
    automationTimeoutMs: 600000
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = str(argv[index]);
    if (arg === "--manifest") args.manifestPath = argv[++index];
    else if (arg === "--out-dir") args.outDir = argv[++index];
    else if (arg === "--endpoint") args.endpoint = argv[++index];
    else if (arg === "--sequence") args.sequenceIds.push(argv[++index]);
    else if (arg === "--exclude-sequence") args.excludeSequenceIds.push(argv[++index]);
    else if (arg === "--max-sequences") args.maxSequences = Number(argv[++index]);
    else if (arg === "--initial-audit-only") args.initialAuditOnly = true;
    else if (arg === "--skip-export") args.skipExport = true;
    else if (arg === "--reuse-existing-videos") args.reuseExistingVideos = true;
    else if (arg === "--sample-count") args.sampleCount = Number(argv[++index]);
    else if (arg === "--keep-frames") args.keepFrames = true;
    else if (arg === "--video-width") args.videoWidth = Number(argv[++index]);
    else if (arg === "--video-height") args.videoHeight = Number(argv[++index]);
    else if (arg === "--video-long-side") args.videoLongSide = Number(argv[++index]);
    else if (arg === "--automation-timeout-ms") args.automationTimeoutMs = Number(argv[++index]);
    else if (arg === "--help") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return `Usage:
  node scripts/sequencer-render-training/tooling/run-production-sequence-video-read.mjs \\
    --manifest var/benchmarks/production-sequence-read/manifest.json \\
    --out-dir var/benchmarks/production-sequence-read/video-review \\
    --max-sequences 1

Options:
  --endpoint <url>          Owned xLightsDesigner API endpoint. Default: ${DEFAULT_ENDPOINT}
  --sequence <id>           Only process a sequenceId/folderName. Repeatable.
  --exclude-sequence <id>   Skip a sequenceId/folderName. Repeatable.
  --initial-audit-only      Only process manifest rows marked initialAuditSubset.
  --skip-export             Reuse existing per-sequence MP4s in --out-dir/videos.
  --reuse-existing-videos   Reuse existing MP4s when present, export missing ones.
  --sample-count <n>        Sampled video frame count for compact metrics. Default: 32.
  --keep-frames             Keep extracted PNG frames. Default deletes/skips frame dump.
  --video-width <n>         Owned API preview export width. Default derives from xLights layout preview.
  --video-height <n>        Owned API preview export height. Default derives from xLights layout preview.
  --video-long-side <n>     Long side used for derived export size. Default: ${DEFAULT_VIDEO_LONG_SIDE}.
  --automation-timeout-ms <n>
`;
}

function normalizeId(value = "") {
  return slug(value);
}

function sequenceMatches(sequence = {}, ids = []) {
  if (!ids.length) return true;
  const candidates = [
    sequence.sequenceId,
    sequence.folderName,
    path.basename(str(sequence.folderPath))
  ].map(normalizeId).filter(Boolean);
  return ids.some((id) => candidates.includes(normalizeId(id)));
}

function selectSequences(manifest = {}, {
  initialAuditOnly = false,
  maxSequences = 0,
  sequenceIds = [],
  excludeSequenceIds = []
} = {}) {
  let sequences = arr(manifest.sequences)
    .filter((sequence) => sequence?.readOnly === true)
    .filter((sequence) => str(sequence?.xsq?.path));
  const included = arr(sequenceIds).map(str).filter(Boolean);
  const excluded = arr(excludeSequenceIds).map(str).filter(Boolean);
  if (included.length) {
    sequences = sequences.filter((sequence) => sequenceMatches(sequence, included));
  }
  if (excluded.length) {
    sequences = sequences.filter((sequence) => !sequenceMatches(sequence, excluded));
  }
  if (initialAuditOnly) {
    sequences = sequences.filter((sequence) => sequence.initialAuditSubset === true);
  }
  if (num(maxSequences) > 0) {
    sequences = sequences.slice(0, num(maxSequences));
  }
  return sequences;
}

function buildFullSequenceIntent(sequence = {}) {
  return {
    effectName: "full_sequence_render",
    section: {
      id: "full_sequence",
      label: "Full sequence",
      startMs: 0,
      endMs: 0
    },
    creativeObjective: {
      scope: "full_sequence_render",
      readGoals: arr(sequence.readGoals).map(str).filter(Boolean),
      styleTags: arr(sequence.styleTags).map(str).filter(Boolean)
    },
    musicRole: {
      timingContext: "full_song",
      audioRequired: true
    },
    targetHierarchy: {
      scope: "whole_display",
      evaluateTargetUsageAndHandoff: true
    },
    paletteIntent: {
      evaluateColorStory: true
    },
    renderPlan: {
      evidenceScope: "full_sequence_render",
      calibrationOnly: true,
      sourceReadOnly: true
    },
    rawSummary: "Read a mature production sequence as whole-display video/audio calibration evidence. Do not copy stylistic patterns directly."
  };
}

function sourceSequenceSummary(sequence = {}) {
  const xsqPath = resolvePath(sequence?.xsq?.path);
  const text = readTextIfExists(xsqPath);
  const effectTagCount = (text.match(/<Effect\b/g) || []).length;
  const namedEffectCount = (text.match(/<Effect\b[^>]*\bname=/g) || []).length;
  return {
    xsqPath,
    effectTagCount,
    namedEffectCount,
    hasEditableEffects: namedEffectCount > 0
  };
}

function invalidSourceRow(sequence = {}, summary = {}, reason = {}) {
  const sequenceId = str(sequence.sequenceId || sequence.folderName || path.basename(str(sequence.folderPath)));
  return {
    sequenceId,
    status: "invalid_source_sequence",
    invalidReasonCode: reason.code,
    invalidReason: reason.message,
    sourceSequence: summary,
    videoPath: "",
    exportArtifactPath: "",
    renderReviewPath: "",
    frameFeaturesPath: "",
    contactSheetPath: "",
    sampledFrameCount: 0,
    nonBlankSampledFrameRatio: 0,
    temporalMotionMean: 0,
    temporalPixelDeltaMean: 0,
    overallQuality: null,
    decision: "invalid_source_sequence",
    exportMode: "not_exported"
  };
}

function failedSequenceRow(sequence = {}, error, { status = "export_failed" } = {}) {
  const sequenceId = str(sequence.sequenceId || sequence.folderName || path.basename(str(sequence.folderPath)));
  return {
    sequenceId,
    status,
    invalidReasonCode: "PREVIEW_VIDEO_EXPORT_FAILED",
    invalidReason: error?.message || String(error),
    sourceSequence: sourceSequenceSummary(sequence),
    videoPath: "",
    exportArtifactPath: "",
    renderReviewPath: "",
    frameFeaturesPath: "",
    contactSheetPath: "",
    sampledFrameCount: 0,
    nonBlankSampledFrameRatio: 0,
    temporalMotionMean: 0,
    temporalPixelDeltaMean: 0,
    overallQuality: null,
    decision: status,
    exportMode: "failed"
  };
}

function previewVideoValidity(frameFeatures = {}) {
  const sampledFrameCount = num(frameFeatures.sampledFrameCount);
  const nonBlankRatio = num(frameFeatures.nonBlankSampledFrameRatio);
  const temporalMotionMean = num(frameFeatures.temporalMotionMean);
  const temporalPixelDeltaMean = num(frameFeatures.temporalPixelDeltaMean);
  const durationSeconds = num(frameFeatures.mediaDurationSeconds);
  if (sampledFrameCount < 2) {
    return {
      valid: false,
      code: "INSUFFICIENT_VIDEO_SAMPLES",
      message: "Preview video did not produce enough sampled frames for full-sequence review."
    };
  }
  if (durationSeconds >= 30 && nonBlankRatio > 0.5 && temporalMotionMean <= 0.000001 && temporalPixelDeltaMean <= 0.000001) {
    return {
      valid: false,
      code: "STATIC_PREVIEW_VIDEO",
      message: "Preview video appears static even though the sequence is nonblank; treat as failed export evidence."
    };
  }
  return { valid: true, code: "", message: "" };
}

async function processSequence(sequence = {}, {
  outDir = "",
  endpoint = DEFAULT_ENDPOINT,
  skipExport = false,
  reuseExistingVideos = false,
  sampleCount = 32,
  keepFrames = false,
  videoWidth = 0,
  videoHeight = 0,
  videoSize = derivePreviewVideoSize({ requestedWidth: videoWidth, requestedHeight: videoHeight }),
  automationTimeoutMs = 600000,
  deps = {}
} = {}) {
  const sequenceId = str(sequence.sequenceId || sequence.folderName || path.basename(str(sequence.folderPath)));
  const sourceSummary = sourceSequenceSummary(sequence);
  if (!sourceSummary.hasEditableEffects) {
    return invalidSourceRow(sequence, sourceSummary, {
      code: "NO_EDITABLE_EFFECTS",
      message: "Source .xsq contains no named effects, so House Preview video export is not valid sequence evidence."
    });
  }
  const baseName = slug(sequenceId);
  const sequenceDir = path.join(outDir, baseName);
  const videoDir = path.join(outDir, "videos");
  const videoPath = path.join(videoDir, `${baseName}.mp4`);
  const exportArtifactPath = path.join(videoDir, `${baseName}.preview-video.json`);
  const mediaDir = path.join(sequenceDir, "render-review-media");
  const frameFeaturesPath = path.join(mediaDir, "frame-features.json");
  const contactSheetPath = path.join(mediaDir, "contact-sheet.jpg");
  const reviewPath = path.join(sequenceDir, "render-review.json");
  const intentPath = path.join(sequenceDir, "full-sequence-intent.json");
  fs.mkdirSync(sequenceDir, { recursive: true });
  fs.mkdirSync(videoDir, { recursive: true });

  const exportVideo = deps.exportVideo || exportXLightsPreviewVideo;
  const extractMedia = deps.extractMedia || extractRenderReviewMedia;
  const buildReview = deps.buildReview || buildRenderReviewArtifact;
  let exportArtifact = null;
  const shouldExport = !skipExport && !(reuseExistingVideos && fs.existsSync(videoPath));
  if (shouldExport) {
    exportArtifact = await exportVideo({
      apiMode: "owned",
      xlightsEndpoint: endpoint,
      sequence: resolvePath(sequence.xsq.path),
      out: videoPath,
      artifact: exportArtifactPath,
      width: videoSize.width,
      height: videoSize.height,
      automationTimeoutMs
    });
  } else if (!fs.existsSync(videoPath)) {
    throw new Error(`--skip-export requested but video does not exist: ${videoPath}`);
  }

  const media = extractMedia({
    mediaPath: videoPath,
    outDir: mediaDir,
    frameFeaturesOut: frameFeaturesPath,
    contactSheetOut: contactSheetPath,
    sampleCount,
    keepFrames,
    buildContactSheet: true
  });
  const frameFeatures = readJson(frameFeaturesPath);
  const validity = previewVideoValidity(frameFeatures);
  if (!validity.valid) {
    return {
      sequenceId,
      status: "invalid_export",
      invalidReasonCode: validity.code,
      invalidReason: validity.message,
      videoPath,
      exportArtifactPath: skipExport || !shouldExport ? "" : exportArtifactPath,
      renderReviewPath: "",
      frameFeaturesPath,
      contactSheetPath,
      sampledFrameCount: num(media.sampledFrameCount),
      nonBlankSampledFrameRatio: num(media.nonBlankSampledFrameRatio),
      temporalMotionMean: num(media.temporalMotionMean),
      temporalPixelDeltaMean: num(frameFeatures.temporalPixelDeltaMean),
      overallQuality: null,
      decision: "invalid_export",
      exportMode: shouldExport ? str(exportArtifact?.source?.apiMode || "owned") : "existing_video",
      sourceSequence: sourceSummary
    };
  }
  const intent = buildFullSequenceIntent(sequence);
  writeJson(intentPath, intent);
  const review = buildReview({
    frameFeatures,
    intent,
    evidence: {
      videoPath,
      contactSheetPath,
      frameDirectory: keepFrames ? media.framesDir : "",
      sequencePath: resolvePath(sequence.xsq.path),
      frameFeaturesPath
    },
    section: {
      id: "full_sequence",
      label: sequenceId,
      startMs: 0,
      endMs: Math.round(num(frameFeatures.mediaDurationSeconds) * 1000)
    }
  });
  review.calibrationPolicy = {
    source: "production_sequence_read",
    benchmarkUse: str(sequence.benchmarkUse),
    readOnly: true,
    trainSequencingPolicy: false,
    copyStylisticPatterns: false,
    promotionRequiresHumanReview: true
  };
  writeJson(reviewPath, review);

  return {
    sequenceId,
    status: "reviewed",
    videoPath,
    exportArtifactPath: skipExport ? "" : exportArtifactPath,
    renderReviewPath: reviewPath,
    frameFeaturesPath,
    contactSheetPath,
    sampledFrameCount: num(media.sampledFrameCount),
    nonBlankSampledFrameRatio: num(media.nonBlankSampledFrameRatio),
    temporalMotionMean: num(media.temporalMotionMean),
    sourceSequence: sourceSummary,
    overallQuality: num(review.qualityScores?.overallQuality),
    decision: str(review.critique?.decision),
    exportMode: shouldExport ? str(exportArtifact?.source?.apiMode || "owned") : "existing_video"
  };
}

export async function runProductionSequenceVideoRead({
  manifestPath = "",
  outDir = DEFAULT_OUT_DIR,
  endpoint = DEFAULT_ENDPOINT,
  maxSequences = 0,
  sequenceIds = [],
  excludeSequenceIds = [],
  initialAuditOnly = false,
  skipExport = false,
  reuseExistingVideos = false,
  sampleCount = 32,
  keepFrames = false,
  videoWidth = 0,
  videoHeight = 0,
  videoLongSide = DEFAULT_VIDEO_LONG_SIDE,
  automationTimeoutMs = 600000,
  deps = {}
} = {}) {
  const resolvedManifestPath = resolvePath(manifestPath);
  if (!resolvedManifestPath || !fs.existsSync(resolvedManifestPath)) {
    throw new Error(`manifest not found: ${resolvedManifestPath || "(missing)"}`);
  }
  const manifest = readJson(resolvedManifestPath);
  const resolvedOutDir = resolvePath(outDir || DEFAULT_OUT_DIR);
  const sequences = selectSequences(manifest, { initialAuditOnly, maxSequences, sequenceIds, excludeSequenceIds });
  const shouldResolveLayoutSize = !(positive(videoWidth) && positive(videoHeight))
    && !skipExport
    && (typeof deps.getLayoutSettings === "function" || !deps.exportVideo);
  const layoutSettings = shouldResolveLayoutSize
    ? await (deps.getLayoutSettings || readLayoutSettings)(endpoint, { fetchImpl: deps.fetchImpl })
    : {};
  const videoSize = derivePreviewVideoSize({
    previewWidth: layoutSettings?.previewWidth,
    previewHeight: layoutSettings?.previewHeight,
    requestedWidth: videoWidth,
    requestedHeight: videoHeight,
    longSide: videoLongSide
  });
  const rows = [];
  for (const sequence of sequences) {
    try {
      rows.push(await processSequence(sequence, {
        outDir: resolvedOutDir,
        endpoint,
        skipExport,
        reuseExistingVideos,
        sampleCount,
        keepFrames,
        videoSize,
        automationTimeoutMs,
        deps
      }));
    } catch (error) {
      if (deps.failFast) throw error;
      rows.push(failedSequenceRow(sequence, error));
    }
  }
  const summary = {
    artifactType: "production_sequence_video_read_run_v1",
    artifactVersion: 1,
    generatedAt: new Date().toISOString(),
    manifestPath: resolvedManifestPath,
    outDir: resolvedOutDir,
    readOnly: true,
    evidenceScope: "full_sequence_render",
    videoSource: "xlights_house_preview_mp4_with_sequence_audio_when_present",
    requestedVideoSize: {
      width: videoSize.width,
      height: videoSize.height,
      source: videoSize.source,
      previewWidth: videoSize.previewWidth || null,
      previewHeight: videoSize.previewHeight || null
    },
    sequenceCount: rows.length,
    rows,
    cleanupPolicy: {
      keepFrames,
      rawVideoRetained: true,
      compactArtifactsRetained: [
        "preview-video.json",
        "frame-features.json",
        "contact-sheet.jpg",
        "render-review.json"
      ]
    }
  };
  const summaryPath = path.join(resolvedOutDir, "production-sequence-video-read-summary.json");
  writeJson(summaryPath, summary);
  return { ...summary, summaryPath };
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help || !args.manifestPath) {
      process.stdout.write(usage());
      process.exit(args.help ? 0 : 1);
    }
    const summary = await runProductionSequenceVideoRead(args);
    process.stdout.write(`${JSON.stringify({
      ok: true,
      summaryPath: summary.summaryPath,
      sequenceCount: summary.sequenceCount,
      rows: summary.rows.map((row) => ({
        sequenceId: row.sequenceId,
        decision: row.decision,
        overallQuality: row.overallQuality,
        videoPath: row.videoPath,
        renderReviewPath: row.renderReviewPath
      }))
    }, null, 2)}\n`);
  } catch (error) {
    console.error(error?.stack || String(error));
    process.exit(1);
  }
}
