#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function num(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function resolvePath(filePath = "") {
  const value = str(filePath);
  if (!value) return "";
  return path.isAbsolute(value) ? value : path.resolve(REPO_ROOT, value);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readJsonIfExists(filePath = "") {
  const resolved = resolvePath(filePath);
  if (!resolved || !fs.existsSync(resolved)) return null;
  return readJson(resolved);
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function round6(value) {
  return Math.round(num(value) * 1_000_000) / 1_000_000;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, num(value)));
}

function present(value) {
  return Number.isFinite(num(value, NaN));
}

function average(values = []) {
  const rows = arr(values).map((value) => num(value, NaN)).filter(Number.isFinite);
  return rows.length ? rows.reduce((sum, value) => sum + value, 0) / rows.length : 0;
}

function rangeScore(values = [], expectedRange = 0.5) {
  const rows = arr(values).map((value) => num(value, NaN)).filter(Number.isFinite);
  if (rows.length < 2) return 0.5;
  const range = Math.max(...rows) - Math.min(...rows);
  return clamp01(range / expectedRange);
}

function consistencyScore(values = [], toleratedRange = 0.35) {
  return clamp01(1 - rangeScore(values, toleratedRange));
}

function adjacentContinuityScore(values = [], toleratedDelta = 0.35) {
  const rows = arr(values).map((value) => num(value, NaN)).filter(Number.isFinite);
  if (rows.length < 2) return 0.5;
  const pairScores = [];
  for (let index = 1; index < rows.length; index += 1) {
    pairScores.push(clamp01(1 - Math.abs(rows[index] - rows[index - 1]) / toleratedDelta));
  }
  return average(pairScores);
}

function bandScore(value, min, max) {
  const parsed = num(value, NaN);
  if (!Number.isFinite(parsed)) return NaN;
  if (parsed >= min && parsed <= max) return 1;
  const width = Math.max(max - min, 0.000001);
  if (parsed < min) return clamp01(parsed / min);
  return clamp01(1 - (parsed - max) / width);
}

function passDirFromQualityRef(ref = "") {
  const resolved = resolvePath(ref);
  if (!resolved) return "";
  const marker = `${path.sep}render-review-quality${path.sep}`;
  const index = resolved.indexOf(marker);
  if (index < 0) return "";
  return resolved.slice(0, index);
}

function scoreFromProgression(progression = {}) {
  const handoff = progression.handoff?.scores || {};
  const development = progression.development?.scores || {};
  const repetition = progression.repetition?.scores || {};
  const energyArc = progression.energyArc?.scores || {};
  return {
    displayEvolution: average([
      energyArc.arcCoherence,
      energyArc.energyShapeClarity,
      development.developmentStrength,
      development.variationAdequacy,
      present(development.stagnationRisk) ? 1 - num(development.stagnationRisk) : NaN
    ]),
    pacingVariety: average([
      development.variationAdequacy,
      present(repetition.stalenessRisk) ? 1 - num(repetition.stalenessRisk) : NaN,
      present(repetition.motionReuseLevel) ? 1 - num(repetition.motionReuseLevel) : NaN,
      handoff.continuityAdequacy
    ]),
    transitionFlow: average([
      handoff.handoffClarity,
      handoff.continuityAdequacy,
      handoff.arrivalReadability,
      present(handoff.transitionAbruptness) ? 1 - num(handoff.transitionAbruptness) : NaN
    ])
  };
}

function loadWindow(fullWindow = {}) {
  const quality = readJsonIfExists(fullWindow.renderReviewQualityRef) || {};
  const review = readJsonIfExists(quality.renderReviewRef || fullWindow.renderReviewRef) || {};
  const passDir = passDirFromQualityRef(fullWindow.renderReviewQualityRef);
  const observation = readJsonIfExists(fullWindow.renderObservationRef || path.join(passDir, "render-observation.json")) || {};
  const scores = review.qualityScores || {};
  const metrics = review.deterministicMetrics || {};
  const macro = observation.macro || {};
  const leadModelShare = num(macro.leadModelShare, NaN);
  const spread = num(macro.meanSceneSpreadRatio, NaN);
  const activeModelRatio = num(macro.maxActiveModelRatio, NaN);
  const clutterRisk = present(metrics.clutterRisk) ? num(metrics.clutterRisk) : num(fullWindow.clutterRisk, NaN);
  return {
    passId: str(fullWindow.passId || quality.passId),
    startMs: num(fullWindow.startMs ?? quality.passWindow?.startMs ?? review.section?.startMs),
    endMs: num(fullWindow.endMs ?? quality.passWindow?.endMs ?? review.section?.endMs),
    evidenceEligible: Boolean(fullWindow.evidenceEligible || quality.evidenceEligible),
    decision: str(fullWindow.decision || quality.decision || review.critique?.decision),
    measurementStatus: str(fullWindow.measurementStatus || quality.measurementStatus),
    overallQuality: num(scores.overallQuality ?? fullWindow.overallQuality),
    visualReadability: num(scores.visualReadability, NaN),
    intentMatch: num(scores.intentMatch, NaN),
    motionCoherence: num(scores.motionCoherence, NaN),
    colorDiscipline: num(scores.colorDiscipline, NaN),
    transitionQuality: num(scores.transitionQuality, NaN),
    clutterControl: present(scores.clutterControl)
      ? num(scores.clutterControl)
      : present(clutterRisk) ? 1 - clutterRisk : NaN,
    focalClarity: present(scores.targetHierarchy)
      ? num(scores.targetHierarchy)
      : present(leadModelShare) ? clamp01(leadModelShare) : NaN,
    visualBalance: present(scores.compositionBalance)
      ? num(scores.compositionBalance)
      : average([
        present(spread) ? clamp01(spread / 0.25) : NaN,
        present(activeModelRatio) ? clamp01(activeModelRatio / 0.25) : NaN,
        present(metrics.activeCoverageMean) ? clamp01(num(metrics.activeCoverageMean) / 0.12) : NaN
      ]),
    activeCoverageMean: num(metrics.activeCoverageMean, NaN),
    activeModelCountMean: num(metrics.activeModelCountMean, NaN),
    temporalMotionMean: num(metrics.temporalMotionMean, NaN),
    colorDiversityMean: num(metrics.colorDiversityMean, NaN),
    renderReviewRef: str(quality.renderReviewRef || fullWindow.renderReviewRef),
    renderReviewQualityRef: str(fullWindow.renderReviewQualityRef)
  };
}

function trainingPlanPassMetadata(runRoot = "") {
  const plan = readJsonIfExists(path.join(resolvePath(runRoot), "training-plan.json")) || {};
  const metadata = new Map();
  for (const pass of arr(plan.experiments).flatMap((experiment) => arr(experiment.passes))) {
    const passId = str(pass.passId);
    if (!passId) continue;
    const placements = arr(pass.placements);
    metadata.set(passId, {
      selectedByController: Boolean(pass.controllerSelection?.selectedByController),
      placementCount: placements.length,
      localEvidenceRoles: [...new Set(placements
        .map((placement) => str(placement.layerIntent?.localEvidenceRole))
        .filter(Boolean))],
      colorPurposes: [...new Set(placements
        .map((placement) => str(placement.layerIntent?.colorPurpose))
        .filter(Boolean))],
      displayReviewRoles: [...new Set(placements
        .map((placement) => str(placement.layerIntent?.displayReviewRole))
        .filter(Boolean))]
    });
  }
  return metadata;
}

function controllerSelectedPassIds(passMetadata = new Map()) {
  return new Set([...passMetadata.entries()]
    .filter(([, metadata]) => metadata.selectedByController)
    .map(([passId]) => passId)
    .filter(Boolean));
}

function paletteRoleDisciplineScore(colorPurposes = []) {
  const purposes = new Set(arr(colorPurposes).map(str).filter(Boolean));
  if (!purposes.size) return NaN;
  const hasStructure = [...purposes].some((purpose) => purpose.includes("structure") || purpose.includes("background"));
  const hasMotionSupport = [...purposes].some((purpose) => purpose.includes("motion") || purpose.includes("support"));
  const hasAccent = [...purposes].some((purpose) => purpose.includes("accent") || purpose.includes("focal"));
  return average([
    clamp01(purposes.size / 4),
    hasStructure ? 1 : 0,
    hasMotionSupport ? 1 : 0,
    hasAccent ? 1 : 0
  ]);
}

function recommendationRows(scores = {}) {
  const rows = [];
  if (scores.displayEvolution < 0.65) rows.push("Strengthen the beginning-to-end energy shape and make each window feel like a purposeful step.");
  if (scores.pacingVariety < 0.65) rows.push("Add clearer variation in motion, density, or palette across repeated sections.");
  if (scores.focalClarity < 0.65) rows.push("Improve target hierarchy so the viewer can identify the lead idea quickly.");
  if (scores.visualBalance < 0.55) rows.push("Rebalance coverage across the display or explicitly use negative space as an intentional choice.");
  if (scores.colorDiscipline < 0.65) rows.push("Tighten palette choices so color changes support the section instead of reading as noise.");
  if (scores.localEvidenceReadability < 0.65) rows.push("Make local model detail readable within the whole-display context by reducing clutter or shortening accent windows.");
  if (scores.temporalContinuity < 0.65) rows.push("Smooth adjacent-window changes so motion, color, and coverage shifts feel intentional instead of abrupt.");
  if (scores.qualityConsistency < 0.65) rows.push("Reduce large quality swings between adjacent reviewed windows.");
  return rows;
}

export function buildVideoAestheticScore({
  runRoot = "",
  fullSequenceReviewPath = "",
  outPath = ""
} = {}) {
  const root = resolvePath(runRoot);
  if (!root || !fs.existsSync(root)) throw new Error(`runRoot not found: ${root || "(missing)"}`);
  const fullPath = resolvePath(fullSequenceReviewPath || path.join(root, "full-sequence-review-loop.json"));
  const fullSequence = readJsonIfExists(fullPath);
  if (!fullSequence) throw new Error(`fullSequenceReviewPath not found: ${fullPath}`);
  const resolvedOutPath = resolvePath(outPath || path.join(root, "video-aesthetic-score.json"));
  const windows = arr(fullSequence.windows).map(loadWindow);
  const eligibleWindows = windows.filter((row) => row.evidenceEligible);
  const passMetadata = trainingPlanPassMetadata(root);
  const selectedPassIds = controllerSelectedPassIds(passMetadata);
  const selectedEligibleWindows = eligibleWindows.filter((row) => selectedPassIds.has(row.passId));
  const progression = readJsonIfExists(fullSequence.progressionObservationRef) || {};
  const progressionScores = scoreFromProgression(progression);
  const fallbackWindows = eligibleWindows.length >= 2 ? eligibleWindows : windows.filter((row) => row.measurementStatus !== "render_health_observation");
  const basisWindows = selectedEligibleWindows.length ? selectedEligibleWindows : fallbackWindows;
  const motionVariety = rangeScore(basisWindows.map((row) => row.temporalMotionMean), 0.25);
  const colorVariety = rangeScore(basisWindows.map((row) => row.colorDiversityMean), 1);
  const coverageVariety = rangeScore(basisWindows.map((row) => row.activeCoverageMean), 0.08);
  const temporalContinuity = average([
    adjacentContinuityScore(basisWindows.map((row) => row.temporalMotionMean), 0.2),
    adjacentContinuityScore(basisWindows.map((row) => row.colorDiversityMean), 0.65),
    adjacentContinuityScore(basisWindows.map((row) => row.activeCoverageMean), 0.08),
    adjacentContinuityScore(basisWindows.map((row) => row.overallQuality), 0.18)
  ]);
  const localEvidenceWindows = basisWindows.filter((row) => arr(passMetadata.get(row.passId)?.localEvidenceRoles).length);
  const localEvidenceBasis = localEvidenceWindows.length ? localEvidenceWindows : basisWindows;
  const localEvidenceReadability = average([
    average(localEvidenceBasis.map((row) => row.focalClarity)),
    average(localEvidenceBasis.map((row) => row.clutterControl)),
    average(localEvidenceBasis.map((row) => row.motionCoherence)),
    average(localEvidenceBasis.map((row) => row.visualBalance)),
    average(localEvidenceBasis.map((row) => bandScore(row.activeCoverageMean, 0.025, 0.12)))
  ]);
  const paletteRoleDiscipline = average(basisWindows.map((row) => paletteRoleDisciplineScore(passMetadata.get(row.passId)?.colorPurposes)));
  const renderColorDiscipline = average(basisWindows.map((row) => row.colorDiscipline));
  const colorDiscipline = Number.isFinite(paletteRoleDiscipline)
    ? Math.max(renderColorDiscipline, paletteRoleDiscipline)
    : renderColorDiscipline;
  const scores = {
    displayEvolution: round6(progressionScores.displayEvolution),
    pacingVariety: round6(average([
      progressionScores.pacingVariety,
      motionVariety,
      colorVariety,
      coverageVariety
    ])),
    transitionFlow: round6(average([
      progressionScores.transitionFlow,
      average(basisWindows.map((row) => row.transitionQuality))
    ])),
    focalClarity: round6(average(basisWindows.map((row) => row.focalClarity))),
    visualBalance: round6(average(basisWindows.map((row) => row.visualBalance))),
    colorDiscipline: round6(colorDiscipline),
    motionInterest: round6(average([
      average(basisWindows.map((row) => row.motionCoherence)),
      motionVariety
    ])),
    temporalContinuity: round6(temporalContinuity),
    localEvidenceReadability: round6(localEvidenceReadability),
    clutterControl: round6(average(basisWindows.map((row) => row.clutterControl))),
    intentMatch: round6(average(basisWindows.map((row) => row.intentMatch))),
    sectionQualityMean: round6(average(basisWindows.map((row) => row.overallQuality))),
    qualityConsistency: round6(consistencyScore(basisWindows.map((row) => row.overallQuality)))
  };
  scores.overallAestheticScore = round6(average([
    scores.sectionQualityMean,
    scores.displayEvolution,
    scores.pacingVariety,
    scores.transitionFlow,
    scores.focalClarity,
    scores.visualBalance,
    scores.colorDiscipline,
    scores.motionInterest,
    scores.temporalContinuity,
    scores.localEvidenceReadability,
    scores.clutterControl,
    scores.intentMatch,
    scores.qualityConsistency
  ]));
  const minimumScoredWindows = selectedEligibleWindows.length ? 1 : 2;
  const status = str(fullSequence.status) === "ready" && basisWindows.length >= minimumScoredWindows
    ? "ready"
    : "insufficient_video_windows";
  const artifact = {
    artifactType: "video_aesthetic_score_v1",
    artifactVersion: 1,
    generatedAt: new Date().toISOString(),
    runRoot: root,
    status,
    fullSequenceReviewRef: fullPath,
    progressionObservationRef: str(fullSequence.progressionObservationRef),
    windowCount: windows.length,
    scoredWindowCount: basisWindows.length,
    evidenceEligibleWindowCount: eligibleWindows.length,
    controllerSelectedWindowCount: selectedEligibleWindows.length,
    minimumScoredWindows,
    scoreBasis: selectedEligibleWindows.length
      ? "controller_selected_window_metrics_and_progression_observation"
      : "deterministic_window_metrics_and_progression_observation",
    qualityDimensions: [
      "display_evolution",
      "pacing_variety",
      "transition_flow",
      "focal_clarity",
      "visual_balance",
      "motion_interest",
      "temporal_continuity",
      "local_evidence_readability",
      "color_discipline",
      "clutter_control",
      "quality_consistency"
    ],
    scoringSignals: {
      localEvidenceWindowCount: localEvidenceWindows.length,
      localEvidenceRoles: [...new Set(localEvidenceWindows.flatMap((row) => arr(passMetadata.get(row.passId)?.localEvidenceRoles)))],
      colorPurposes: [...new Set(basisWindows.flatMap((row) => arr(passMetadata.get(row.passId)?.colorPurposes)))],
      paletteRoleDiscipline: round6(paletteRoleDiscipline),
      renderColorDiscipline: round6(renderColorDiscipline),
      temporalContinuityInputs: {
        temporalMotionMean: basisWindows.map((row) => round6(row.temporalMotionMean)),
        colorDiversityMean: basisWindows.map((row) => round6(row.colorDiversityMean)),
        activeCoverageMean: basisWindows.map((row) => round6(row.activeCoverageMean)),
        overallQuality: basisWindows.map((row) => round6(row.overallQuality))
      }
    },
    scores,
    recommendationSummary: recommendationRows(scores),
    promotion: {
      evidenceEligible: status === "ready" && scores.overallAestheticScore >= 0.72,
      blockers: [
        ...(status === "ready" ? [] : ["insufficient_scored_windows"]),
        ...(scores.overallAestheticScore >= 0.72 ? [] : ["overall_aesthetic_score_below_threshold"])
      ]
    },
    windows: basisWindows.map((row) => ({
      passId: row.passId,
      startMs: row.startMs,
      endMs: row.endMs,
      decision: row.decision,
      overallQuality: round6(row.overallQuality),
      visualReadability: round6(row.visualReadability),
      intentMatch: round6(row.intentMatch),
      motionCoherence: round6(row.motionCoherence),
      colorDiscipline: round6(row.colorDiscipline),
      focalClarity: round6(row.focalClarity),
      visualBalance: round6(row.visualBalance),
      temporalMotionMean: round6(row.temporalMotionMean),
      colorDiversityMean: round6(row.colorDiversityMean),
      activeCoverageMean: round6(row.activeCoverageMean),
      localEvidenceRoles: arr(passMetadata.get(row.passId)?.localEvidenceRoles),
      renderReviewRef: row.renderReviewRef,
      renderReviewQualityRef: row.renderReviewQualityRef
    }))
  };
  writeJson(resolvedOutPath, artifact);
  return artifact;
}

function parseArgs(argv = []) {
  const args = { runRoot: "", fullSequenceReviewPath: "", outPath: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = str(argv[index]);
    if (arg === "--run-root") args.runRoot = argv[++index];
    else if (arg === "--full-sequence-review") args.fullSequenceReviewPath = argv[++index];
    else if (arg === "--out") args.outPath = argv[++index];
    else if (arg === "--help") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return `Usage:
  node scripts/sequencer-render-training/tooling/build-video-aesthetic-score.mjs --run-root <completed-run-root> [--out video-aesthetic-score.json]
`;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help || !args.runRoot) {
      process.stdout.write(usage());
      process.exit(args.help ? 0 : 1);
    }
    const artifact = buildVideoAestheticScore(args);
    process.stdout.write(`${JSON.stringify({
      ok: true,
      out: resolvePath(args.outPath || path.join(args.runRoot, "video-aesthetic-score.json")),
      status: artifact.status,
      overallAestheticScore: artifact.scores.overallAestheticScore,
      scoredWindowCount: artifact.scoredWindowCount
    }, null, 2)}\n`);
  } catch (error) {
    console.error(error?.stack || String(error));
    process.exit(1);
  }
}
