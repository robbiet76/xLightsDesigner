#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function str(value = '') {
  return String(value || '').trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function obj(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function number(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, number(value)));
}

function average(values = []) {
  const rows = arr(values).map((value) => number(value, NaN)).filter(Number.isFinite);
  return rows.length ? rows.reduce((sum, value) => sum + value, 0) / rows.length : 0;
}

function max(values = []) {
  const rows = arr(values).map((value) => number(value, NaN)).filter(Number.isFinite);
  return rows.length ? Math.max(...rows) : 0;
}

function round(value) {
  return Math.round(number(value) * 1_000_000) / 1_000_000;
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
    frameFeaturesPath: '',
    intentPath: '',
    outPath: '',
    videoPath: '',
    contactSheetPath: '',
    frameDirectory: '',
    sequencePath: '',
    sectionId: '',
    sectionLabel: '',
    startMs: 0,
    endMs: 0
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = str(argv[index]);
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${token}`);
      return argv[index];
    };
    if (token === '--frame-features') args.frameFeaturesPath = path.resolve(next());
    else if (token === '--intent') args.intentPath = path.resolve(next());
    else if (token === '--out') args.outPath = path.resolve(next());
    else if (token === '--video') args.videoPath = path.resolve(next());
    else if (token === '--contact-sheet') args.contactSheetPath = path.resolve(next());
    else if (token === '--frame-dir') args.frameDirectory = path.resolve(next());
    else if (token === '--sequence') args.sequencePath = path.resolve(next());
    else if (token === '--section-id') args.sectionId = str(next());
    else if (token === '--section-label') args.sectionLabel = str(next());
    else if (token === '--start-ms') args.startMs = Number(next());
    else if (token === '--end-ms') args.endMs = Number(next());
    else if (token === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${token}`);
  }
  return args;
}

function usage() {
  return `Usage:
  node scripts/designer-training/build-render-review-artifact.mjs --frame-features features.json --out review.json [options]

Options:
  --intent intent.json
  --video section.mp4
  --contact-sheet sheet.jpg
  --frame-dir frames/
  --sequence sequence.xsq
  --section-id id
  --section-label label
  --start-ms 0 --end-ms 8000
`;
}

function normalizeFrameFeatures(features = {}) {
  const sampled = arr(features.sampledFrameMetrics);
  const transitions = arr(features.sampledFrameTransitions);
  const preview = obj(features.previewWindowSignals);
  return {
    source: features,
    sampled,
    transitions,
    sampledFrameCount: number(features.sampledFrameCount, sampled.length),
    nonBlankSampledFrameRatio: clamp01(features.nonBlankSampledFrameRatio),
    temporalMotionMean: number(features.temporalMotionMean, average(transitions.map((row) => row.combinedDelta))),
    temporalMotionPeak: number(features.temporalMotionPeak, max(transitions.map((row) => row.combinedDelta))),
    temporalColorDeltaMean: number(features.temporalColorDeltaMean, average(transitions.map((row) => row.colorDelta))),
    temporalBrightnessDeltaMean: number(features.temporalBrightnessDeltaMean, average(transitions.map((row) => row.brightnessDelta))),
    temporalActiveDeltaMean: number(features.temporalActiveDeltaMean, average(transitions.map((row) => row.activeDelta))),
    representativeActiveRatio: number(features.representativeSampledFrameActivePixelRatio, max(sampled.map((row) => row.frameActivePixelRatio))),
    representativeBrightness: number(features.representativeSampledFrameAverageBrightness, max(sampled.map((row) => row.frameAverageBrightness))),
    representativeDominantRatio: number(features.representativeSampledFrameDominantPixelRatio, max(sampled.map((row) => row.frameDominantPixelRatio))),
    representativeUniqueColorCount: number(features.representativeSampledFrameUniqueColorCount, max(sampled.map((row) => row.frameUniqueColorCount))),
    meanActiveRatio: average(sampled.map((row) => row.frameActivePixelRatio)),
    meanBrightness: average(sampled.map((row) => row.frameAverageBrightness)),
    meanDominantRatio: average(sampled.map((row) => row.frameDominantPixelRatio)),
    meanUniqueColorCount: average(sampled.map((row) => row.frameUniqueColorCount)),
    previewWindowSignals: preview
  };
}

function scoreBand(value, { low = 0.15, ideal = 0.45, high = 0.85 } = {}) {
  const v = clamp01(value);
  if (v <= low) return v / Math.max(low, 0.0001);
  if (v <= ideal) return 1;
  if (v >= high) return Math.max(0, 1 - ((v - high) / Math.max(1 - high, 0.0001)));
  return 1 - ((v - ideal) / Math.max(high - ideal, 0.0001)) * 0.35;
}

function buildDeterministicMetrics(normalized = {}) {
  const activeCoverageMean = clamp01(normalized.meanActiveRatio);
  const activeCoveragePeak = clamp01(normalized.representativeActiveRatio);
  const brightnessMean = clamp01(normalized.meanBrightness);
  const brightnessPeak = clamp01(normalized.representativeBrightness);
  const dominantBrightnessPeak = clamp01(normalized.representativeDominantRatio);
  const colorDiversityMean = Math.min(1, normalized.meanUniqueColorCount / 64);
  const motionMean = clamp01(normalized.temporalMotionMean);
  const motionPeak = clamp01(normalized.temporalMotionPeak);
  const blankRisk = 1 - clamp01(normalized.nonBlankSampledFrameRatio || (activeCoverageMean > 0.005 ? 1 : 0));
  const overexposureRisk = clamp01((dominantBrightnessPeak - 0.25) / 0.55);
  const flatnessRisk = clamp01((0.025 - motionMean) / 0.025);
  const clutterRisk = clamp01(((activeCoveragePeak - 0.75) / 0.25) * 0.55 + ((colorDiversityMean - 0.75) / 0.25) * 0.45);

  return {
    sampledFrameCount: normalized.sampledFrameCount,
    activeCoverageMean: round(activeCoverageMean),
    activeCoveragePeak: round(activeCoveragePeak),
    brightnessMean: round(brightnessMean),
    brightnessPeak: round(brightnessPeak),
    dominantBrightnessPeak: round(dominantBrightnessPeak),
    colorDiversityMean: round(colorDiversityMean),
    temporalMotionMean: round(motionMean),
    temporalMotionPeak: round(motionPeak),
    temporalColorDeltaMean: round(normalized.temporalColorDeltaMean),
    temporalBrightnessDeltaMean: round(normalized.temporalBrightnessDeltaMean),
    temporalActiveDeltaMean: round(normalized.temporalActiveDeltaMean),
    activeModelCountMean: round(normalized.previewWindowSignals.meanActiveModelCount),
    activeModelCountPeak: round(normalized.previewWindowSignals.maxActiveModelCount),
    activeNodeCountMean: round(normalized.previewWindowSignals.meanActiveNodeCount),
    activeNodeCountPeak: round(normalized.previewWindowSignals.maxActiveNodeCount),
    activeNodeRatioMean: round(normalized.previewWindowSignals.meanActiveNodeRatio),
    activeNodeRatioPeak: round(normalized.previewWindowSignals.maxActiveNodeRatio),
    activeTargetNodeRatioMean: round(normalized.previewWindowSignals.meanActiveTargetNodeRatio),
    activeTargetNodeRatioPeak: round(normalized.previewWindowSignals.maxActiveTargetNodeRatio),
    blankRisk: round(blankRisk),
    overexposureRisk: round(overexposureRisk),
    flatnessRisk: round(flatnessRisk),
    clutterRisk: round(clutterRisk)
  };
}

function buildQualityScores(metrics = {}, intent = {}) {
  const desiredEnergy = str(intent?.musicRole?.energy || intent?.energy || '').toLowerCase();
  const desiredMotion = str(intent?.motion || intent?.creativeObjective?.motion || '').toLowerCase();
  const expectedCoverage = str(intent?.coverage || intent?.creativeObjective?.coverage || '').toLowerCase();

  let coverageScore = scoreBand(metrics.activeCoverageMean, { low: 0.04, ideal: 0.28, high: 0.82 });
  if (/wide|big|full|chorus|finale/.test(expectedCoverage)) {
    coverageScore = scoreBand(metrics.activeCoverageMean, { low: 0.15, ideal: 0.55, high: 0.95 });
  } else if (/sparse|accent|detail|small/.test(expectedCoverage)) {
    coverageScore = scoreBand(metrics.activeCoverageMean, { low: 0.01, ideal: 0.12, high: 0.45 });
  }

  let motionScore = scoreBand(metrics.temporalMotionMean, { low: 0.005, ideal: 0.06, high: 0.22 });
  if (/high|build|chorus|finale|fast|active/.test(`${desiredEnergy} ${desiredMotion}`)) {
    motionScore = scoreBand(metrics.temporalMotionMean, { low: 0.025, ideal: 0.12, high: 0.35 });
  } else if (/calm|quiet|hold|static|slow/.test(`${desiredEnergy} ${desiredMotion}`)) {
    motionScore = scoreBand(metrics.temporalMotionMean, { low: 0.001, ideal: 0.025, high: 0.12 });
  }

  const readability = clamp01(
    (coverageScore * 0.4) +
    ((1 - metrics.blankRisk) * 0.25) +
    ((1 - metrics.clutterRisk) * 0.2) +
    ((1 - metrics.overexposureRisk) * 0.15)
  );
  const colorDiscipline = clamp01(1 - Math.max(0, metrics.colorDiversityMean - 0.72) * 1.3);
  const transitionQuality = clamp01((motionScore * 0.65) + ((1 - metrics.flatnessRisk) * 0.35));
  const musicalFit = clamp01((motionScore * 0.55) + (coverageScore * 0.25) + ((1 - metrics.blankRisk) * 0.2));
  const overall = clamp01(
    (readability * 0.25) +
    (musicalFit * 0.2) +
    (transitionQuality * 0.15) +
    (colorDiscipline * 0.15) +
    ((1 - metrics.clutterRisk) * 0.15) +
    ((1 - metrics.overexposureRisk) * 0.1)
  );

  return {
    intentMatch: round((coverageScore + motionScore + readability) / 3),
    musicalFit: round(musicalFit),
    visualReadability: round(readability),
    targetHierarchy: null,
    compositionBalance: null,
    colorDiscipline: round(colorDiscipline),
    motionCoherence: round(motionScore),
    transitionQuality: round(transitionQuality),
    clutterControl: round(1 - metrics.clutterRisk),
    overallQuality: round(overall)
  };
}

function buildEvidenceQualification(metrics = {}, intent = {}, critique = {}) {
  const effectName = str(intent.effectName || intent.effect?.name || intent.effect);
  const targetHierarchy = obj(intent.targetHierarchy);
  const renderPlan = obj(intent.renderPlan);
  const plannedEffectCount = number(renderPlan.plannedEffectCount, effectName ? 1 : 0);
  const plannedTargetCount = number(
    renderPlan.plannedTargetCount,
    arr(targetHierarchy.leadTargets).length + arr(targetHierarchy.supportTargets).length
  );
  const reasons = [];
  if (metrics.sampledFrameCount < 2) reasons.push('insufficient_sampled_frames');
  if (plannedEffectCount <= 0) reasons.push('no_planned_effects');
  if (plannedTargetCount <= 0) reasons.push('no_planned_targets');
  if (metrics.blankRisk > 0.35) reasons.push('high_blank_risk');
  if (metrics.activeNodeCountPeak <= 0 && metrics.activeCoveragePeak <= 0.0003) reasons.push('no_active_nodes_or_pixels');
  if (arr(critique.issues).length) reasons.push('open_quality_issues');
  const eligible = reasons.length === 0 && str(critique.decision) === 'accept';
  return {
    status: eligible ? 'quality_evidence' : 'render_health_observation',
    eligible,
    reasons,
    plannedEffectCount,
    plannedTargetCount,
    confidence: metrics.sampledFrameCount >= 3 && (metrics.activeNodeCountPeak > 0 || metrics.activeCoveragePeak > 0.001)
      ? 'measured'
      : 'weak'
  };
}

function buildCritique(metrics = {}, scores = {}) {
  const strengths = [];
  const issues = [];
  const revisionRecommendations = [];
  if (metrics.blankRisk <= 0.15) strengths.push('section remains visually active through the sampled window');
  if (scores.visualReadability >= 0.7) strengths.push('render has acceptable deterministic readability signals');
  if (scores.motionCoherence >= 0.7) strengths.push('temporal change is consistent with the requested motion/energy band');
  if (metrics.blankRisk > 0.35) {
    issues.push('blank-span risk is high');
    revisionRecommendations.push('increase active target coverage or extend effect duration through the section');
  }
  if (metrics.flatnessRisk > 0.6) {
    issues.push('section appears too temporally flat');
    revisionRecommendations.push('add motion, palette evolution, or section-boundary transitions');
  }
  if (metrics.clutterRisk > 0.55) {
    issues.push('display may be visually cluttered');
    revisionRecommendations.push('reduce simultaneous active targets or simplify palette/effect layering');
  }
  if (metrics.overexposureRisk > 0.55) {
    issues.push('dominant brightness suggests overexposure risk');
    revisionRecommendations.push('lower intensity, reduce full-white coverage, or add supporting contrast');
  }
  const decision = scores.overallQuality >= 0.72 && issues.length === 0
    ? 'accept'
    : scores.overallQuality >= 0.55
      ? 'revise'
      : 'reject';
  return {
    strengths,
    issues,
    revisionRecommendations,
    decision
  };
}

export function buildRenderReviewArtifact({
  frameFeatures = {},
  intent = {},
  evidence = {},
  section = {}
} = {}) {
  const normalized = normalizeFrameFeatures(frameFeatures);
  const deterministicMetrics = buildDeterministicMetrics(normalized);
  const qualityScores = buildQualityScores(deterministicMetrics, intent);
  const critique = buildCritique(deterministicMetrics, qualityScores);
  const evidenceQualification = buildEvidenceQualification(deterministicMetrics, intent, critique);
  return {
    artifactType: 'render_review_v1',
    artifactVersion: '1.0',
    createdAt: new Date().toISOString(),
    section: {
      id: str(section.id || intent?.section?.id || 'section'),
      label: str(section.label || intent?.section?.label || ''),
      startMs: number(section.startMs ?? intent?.section?.startMs, 0),
      endMs: number(section.endMs ?? intent?.section?.endMs, 0)
    },
    intent: {
      effectName: str(intent.effectName || intent.effect?.name || intent.effect),
      creativeObjective: obj(intent.creativeObjective),
      musicRole: obj(intent.musicRole),
      targetHierarchy: obj(intent.targetHierarchy),
      paletteIntent: obj(intent.paletteIntent),
      renderPlan: obj(intent.renderPlan),
      rawSummary: str(intent.rawSummary || intent.summary || intent.intent || '')
    },
    evidence: {
      videoPath: str(evidence.videoPath),
      frameDirectory: str(evidence.frameDirectory),
      contactSheetPath: str(evidence.contactSheetPath),
      sequencePath: str(evidence.sequencePath),
      renderObservationPath: str(evidence.renderObservationPath),
      frameFeaturesPath: str(evidence.frameFeaturesPath)
    },
    deterministicMetrics,
    qualityScores,
    critique,
    evidenceQualification,
    promotion: {
      eligible: evidenceQualification.eligible,
      blockers: evidenceQualification.eligible
        ? []
        : [
          'render review requires revision or additional repeated evidence before promotion',
          ...evidenceQualification.reasons
        ]
    }
  };
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help || !args.frameFeaturesPath) {
      process.stdout.write(usage());
      process.exit(args.help ? 0 : 1);
    }
    const frameFeatures = readJson(args.frameFeaturesPath);
    const intent = args.intentPath ? readJson(args.intentPath) : {};
    const artifact = buildRenderReviewArtifact({
      frameFeatures,
      intent,
      evidence: {
        videoPath: args.videoPath,
        contactSheetPath: args.contactSheetPath,
        frameDirectory: args.frameDirectory,
        sequencePath: args.sequencePath,
        frameFeaturesPath: args.frameFeaturesPath
      },
      section: {
        id: args.sectionId,
        label: args.sectionLabel,
        startMs: args.startMs,
        endMs: args.endMs
      }
    });
    if (args.outPath) writeJson(args.outPath, artifact);
    else process.stdout.write(`${JSON.stringify(artifact, null, 2)}\n`);
  } catch (error) {
    console.error(error?.stack || String(error));
    process.exit(1);
  }
}
