#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const VALID_STATUSES = new Set(["pending", "reviewed", "excluded"]);
const VALID_RECOMMENDATIONS = new Set(["approve", "adjust", "exclude", "pending"]);

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

function blankReview(sequenceId = "", profileRow = {}) {
  return {
    sequenceId,
    status: "pending",
    recommendation: "pending",
    reviewer: "",
    reviewedAt: "",
    summary: "",
    knownStrengths: [],
    knownWeaknesses: [],
    calibrationNotes: {
      energyArc: "",
      sectionContrast: "",
      paletteEvolution: "",
      focalHandoff: "",
      targetHierarchy: "",
      overallFit: ""
    },
    bandAdjustments: {},
    profileSnapshot: {
      combinedCalibrationScore: round6(profileRow.combinedCalibrationScore),
      dimensions: profileRow.dimensions || {}
    }
  };
}

function normalizeReview(row = {}, profileRow = {}) {
  const sequenceId = str(row.sequenceId || profileRow.sequenceId);
  const status = VALID_STATUSES.has(str(row.status)) ? str(row.status) : "pending";
  const recommendation = VALID_RECOMMENDATIONS.has(str(row.recommendation)) ? str(row.recommendation) : "pending";
  return {
    ...blankReview(sequenceId, profileRow),
    ...row,
    sequenceId,
    status,
    recommendation,
    knownStrengths: arr(row.knownStrengths).map(str).filter(Boolean),
    knownWeaknesses: arr(row.knownWeaknesses).map(str).filter(Boolean),
    calibrationNotes: {
      ...blankReview(sequenceId, profileRow).calibrationNotes,
      ...(row.calibrationNotes || {})
    },
    bandAdjustments: row.bandAdjustments && typeof row.bandAdjustments === "object" && !Array.isArray(row.bandAdjustments)
      ? row.bandAdjustments
      : {},
    profileSnapshot: {
      combinedCalibrationScore: round6(profileRow.combinedCalibrationScore),
      dimensions: profileRow.dimensions || {}
    }
  };
}

function reviewCompleteness(row = {}) {
  if (str(row.status) !== "reviewed") return 0;
  const checks = [
    str(row.summary),
    arr(row.knownStrengths).length,
    arr(row.knownWeaknesses).length,
    Object.values(row.calibrationNotes || {}).some((value) => str(value)),
    str(row.recommendation) && str(row.recommendation) !== "pending"
  ];
  return checks.filter(Boolean).length / checks.length;
}

function buildTemplate(profile = {}) {
  return {
    artifactType: "production_human_review_notes_v1",
    artifactVersion: 1,
    generatedAt: new Date().toISOString(),
    profilePath: "",
    instructions: [
      "Review the MP4/contact sheet in xLights or the generated artifacts before changing status.",
      "Use status=reviewed and recommendation=approve only when the production reference should calibrate scorer bands.",
      "Use recommendation=adjust when the sequence is useful but one or more dimensions need interpretation notes.",
      "Use recommendation=exclude when the reference should not calibrate scoring."
    ],
    reviews: arr(profile.references).map((row) => blankReview(str(row.sequenceId), row))
  };
}

function indexReviews(notes = {}) {
  return new Map(arr(notes.reviews).map((row) => [str(row.sequenceId), row]).filter(([key]) => key));
}

function evaluateStatus(reviews = []) {
  const total = reviews.length;
  const reviewed = reviews.filter((row) => str(row.status) === "reviewed").length;
  const approved = reviews.filter((row) => str(row.status) === "reviewed" && str(row.recommendation) === "approve").length;
  const adjusted = reviews.filter((row) => str(row.status) === "reviewed" && str(row.recommendation) === "adjust").length;
  const excluded = reviews.filter((row) => str(row.status) === "excluded" || str(row.recommendation) === "exclude").length;
  const pending = Math.max(0, total - reviewed - reviews.filter((row) => str(row.status) === "excluded").length);
  const meanCompleteness = total ? reviews.reduce((sum, row) => sum + reviewCompleteness(row), 0) / total : 0;
  let status = "human_review_pending";
  if (total && approved + adjusted > 0 && pending > 0) status = "partially_reviewed";
  if (total && pending === 0 && approved > 0 && adjusted === 0) status = "approved";
  if (total && pending === 0 && approved + adjusted > 0 && adjusted > 0) status = "approved_with_adjustments";
  if (total && pending === 0 && approved + adjusted === 0) status = "not_approved";
  return {
    status,
    total,
    reviewed,
    approved,
    adjusted,
    excluded,
    pending,
    meanCompleteness: round6(meanCompleteness)
  };
}

export function buildProductionHumanReviewCalibration({
  profilePath = "",
  notesPath = "",
  outPath = "",
  writeTemplatePath = ""
} = {}) {
  const resolvedProfilePath = resolvePath(profilePath);
  if (!resolvedProfilePath || !fs.existsSync(resolvedProfilePath)) {
    throw new Error(`profile not found: ${resolvedProfilePath || "(missing)"}`);
  }
  const profile = readJson(resolvedProfilePath);
  const resolvedTemplatePath = resolvePath(writeTemplatePath);
  if (resolvedTemplatePath) {
    const template = buildTemplate(profile);
    template.profilePath = resolvedProfilePath;
    writeJson(resolvedTemplatePath, template);
  }
  const notes = readJsonIfExists(notesPath) || null;
  const notesBySequence = indexReviews(notes || {});
  const reviews = arr(profile.references).map((profileRow) => normalizeReview(
    notesBySequence.get(str(profileRow.sequenceId)) || {},
    profileRow
  ));
  const summary = evaluateStatus(reviews);
  const resolvedOutPath = resolvePath(outPath || path.join(path.dirname(resolvedProfilePath), "production-human-review-calibration.json"));
  const artifact = {
    artifactType: "production_human_review_calibration_v1",
    artifactVersion: 1,
    generatedAt: new Date().toISOString(),
    profilePath: resolvedProfilePath,
    notesPath: notesPath ? resolvePath(notesPath) : "",
    status: summary.status,
    metricScope: "full_sequence_render",
    promotionUse: "human_calibrated_scorer_gate",
    policy: {
      requiresHumanReviewBeforeTrainingUse: true,
      generatedTrainingMayUseProfile: ["approved", "approved_with_adjustments"].includes(summary.status),
      approvedRowsOnly: true,
      sourceSequencesReadOnly: true
    },
    summary,
    approvedSequenceIds: reviews
      .filter((row) => str(row.status) === "reviewed" && str(row.recommendation) === "approve")
      .map((row) => row.sequenceId),
    adjustmentSequenceIds: reviews
      .filter((row) => str(row.status) === "reviewed" && str(row.recommendation) === "adjust")
      .map((row) => row.sequenceId),
    excludedSequenceIds: reviews
      .filter((row) => str(row.status) === "excluded" || str(row.recommendation) === "exclude")
      .map((row) => row.sequenceId),
    reviews
  };
  writeJson(resolvedOutPath, artifact);
  return { ...artifact, outPath: resolvedOutPath, templatePath: resolvedTemplatePath || "" };
}

function parseArgs(argv = []) {
  const args = { profilePath: "", notesPath: "", outPath: "", writeTemplatePath: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = str(argv[index]);
    if (arg === "--profile") args.profilePath = argv[++index];
    else if (arg === "--notes") args.notesPath = argv[++index];
    else if (arg === "--out") args.outPath = argv[++index];
    else if (arg === "--write-template") args.writeTemplatePath = argv[++index];
    else if (arg === "--help") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return `Usage:
  node scripts/sequencer-render-training/tooling/build-production-human-review-calibration.mjs \\
    --profile var/benchmarks/production-sequence-read/video-review-owned/production-scorer-calibration-profile.json \\
    --write-template var/benchmarks/production-sequence-read/human-review-notes.template.json \\
    --out var/benchmarks/production-sequence-read/video-review-owned/production-human-review-calibration.json
`;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help || !args.profilePath) {
      process.stdout.write(usage());
      process.exit(args.help ? 0 : 1);
    }
    const artifact = buildProductionHumanReviewCalibration(args);
    process.stdout.write(`${JSON.stringify({
      ok: true,
      outPath: artifact.outPath,
      templatePath: artifact.templatePath,
      status: artifact.status,
      summary: artifact.summary
    }, null, 2)}\n`);
  } catch (error) {
    console.error(error?.stack || String(error));
    process.exit(1);
  }
}
