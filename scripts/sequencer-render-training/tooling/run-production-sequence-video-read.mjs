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

function parseArgs(argv = []) {
  const args = {
    manifestPath: "",
    outDir: DEFAULT_OUT_DIR,
    endpoint: DEFAULT_ENDPOINT,
    maxSequences: 0,
    initialAuditOnly: false,
    skipExport: false,
    reuseExistingVideos: false,
    sampleCount: 32,
    keepFrames: false,
    automationTimeoutMs: 600000
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = str(argv[index]);
    if (arg === "--manifest") args.manifestPath = argv[++index];
    else if (arg === "--out-dir") args.outDir = argv[++index];
    else if (arg === "--endpoint") args.endpoint = argv[++index];
    else if (arg === "--max-sequences") args.maxSequences = Number(argv[++index]);
    else if (arg === "--initial-audit-only") args.initialAuditOnly = true;
    else if (arg === "--skip-export") args.skipExport = true;
    else if (arg === "--reuse-existing-videos") args.reuseExistingVideos = true;
    else if (arg === "--sample-count") args.sampleCount = Number(argv[++index]);
    else if (arg === "--keep-frames") args.keepFrames = true;
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
  --initial-audit-only      Only process manifest rows marked initialAuditSubset.
  --skip-export             Reuse existing per-sequence MP4s in --out-dir/videos.
  --reuse-existing-videos   Reuse existing MP4s when present, export missing ones.
  --sample-count <n>        Sampled video frame count for compact metrics. Default: 32.
  --keep-frames             Keep extracted PNG frames. Default deletes/skips frame dump.
  --automation-timeout-ms <n>
`;
}

function selectSequences(manifest = {}, { initialAuditOnly = false, maxSequences = 0 } = {}) {
  let sequences = arr(manifest.sequences)
    .filter((sequence) => sequence?.readOnly === true)
    .filter((sequence) => str(sequence?.xsq?.path));
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
  automationTimeoutMs = 600000,
  deps = {}
} = {}) {
  const sequenceId = str(sequence.sequenceId || sequence.folderName || path.basename(str(sequence.folderPath)));
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
      exportMode: shouldExport ? str(exportArtifact?.source?.apiMode || "owned") : "existing_video"
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
  initialAuditOnly = false,
  skipExport = false,
  reuseExistingVideos = false,
  sampleCount = 32,
  keepFrames = false,
  automationTimeoutMs = 600000,
  deps = {}
} = {}) {
  const resolvedManifestPath = resolvePath(manifestPath);
  if (!resolvedManifestPath || !fs.existsSync(resolvedManifestPath)) {
    throw new Error(`manifest not found: ${resolvedManifestPath || "(missing)"}`);
  }
  const manifest = readJson(resolvedManifestPath);
  const resolvedOutDir = resolvePath(outDir || DEFAULT_OUT_DIR);
  const sequences = selectSequences(manifest, { initialAuditOnly, maxSequences });
  const rows = [];
  for (const sequence of sequences) {
    rows.push(await processSequence(sequence, {
      outDir: resolvedOutDir,
      endpoint,
      skipExport,
      reuseExistingVideos,
      sampleCount,
      keepFrames,
      automationTimeoutMs,
      deps
    }));
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
