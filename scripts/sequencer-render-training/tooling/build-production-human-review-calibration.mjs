#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const VALID_STATUSES = new Set(["pending", "reviewed", "excluded"]);
const VALID_RECOMMENDATIONS = new Set(["approve", "adjust", "exclude", "pending"]);
export const REVIEW_CHOICES = {
  energyArc: {
    label: "Energy Arc",
    prompt: "Does the sequence build, release, and hold intensity in a way that matches the song?",
    options: [
      { id: "excellent_dynamic_arc", score: 1, label: "Excellent dynamic arc", description: "Energy changes feel musical, intentional, and well timed across sections." },
      { id: "good_with_minor_flat_spots", score: 0.78, label: "Good with minor flat spots", description: "The arc generally works, with a few sections that could build or release more clearly." },
      { id: "mostly_flat_or_overdriven", score: 0.45, label: "Mostly flat or overdriven", description: "The sequence tends to stay at one intensity or push too hard too often." },
      { id: "poor_energy_match", score: 0.15, label: "Poor energy match", description: "Visual intensity does not follow the song in a useful way." },
      { id: "not_sure", score: null, label: "Not sure", description: "Do not use this metric from this review." }
    ]
  },
  sectionContrast: {
    label: "Section Contrast",
    prompt: "Do verses, choruses, bridges, breaks, and phrase changes read as distinct visual ideas?",
    options: [
      { id: "excellent_section_identity", score: 1, label: "Excellent section identity", description: "Sections are clearly differentiated while still belonging to the same sequence." },
      { id: "good_some_repetition", score: 0.75, label: "Good, some repetition", description: "Most sections read well, with some repeated looks that are acceptable or mildly limiting." },
      { id: "weak_section_separation", score: 0.4, label: "Weak separation", description: "Several sections blend together or lack clear visual intent." },
      { id: "no_clear_section_design", score: 0.1, label: "No clear section design", description: "The sequence does not visibly respond to song structure." },
      { id: "not_sure", score: null, label: "Not sure", description: "Do not use this metric from this review." }
    ]
  },
  paletteEvolution: {
    label: "Palette Evolution",
    prompt: "Is color used with purpose, including variation, contrast, and development over time?",
    options: [
      { id: "excellent_color_story", score: 1, label: "Excellent color story", description: "Colors feel intentional, varied, and coordinated with musical moments." },
      { id: "good_palette_minor_noise", score: 0.74, label: "Good, minor noise", description: "Color use is strong overall, with occasional busy or less purposeful moments." },
      { id: "limited_or_inconsistent_color", score: 0.42, label: "Limited or inconsistent", description: "Color is too static, too random, or not clearly connected to the musical goal." },
      { id: "poor_color_use", score: 0.12, label: "Poor color use", description: "Color choices distract from or flatten the sequence." },
      { id: "not_sure", score: null, label: "Not sure", description: "Do not use this metric from this review." }
    ]
  },
  focalHandoff: {
    label: "Focal Handoff",
    prompt: "Does attention move between display areas/models in a way that feels directed rather than accidental?",
    options: [
      { id: "excellent_focus_direction", score: 1, label: "Excellent focus direction", description: "Lead focus moves clearly and musically across the display." },
      { id: "good_focus_some_static", score: 0.76, label: "Good, sometimes static", description: "Focus is mostly clear, with a few sections that hold too long or shift less clearly." },
      { id: "weak_or_unclear_focus", score: 0.38, label: "Weak or unclear focus", description: "The viewer is often unsure where to look." },
      { id: "chaotic_or_absent_focus", score: 0.1, label: "Chaotic or absent", description: "Focus is either random, cluttered, or missing." },
      { id: "not_sure", score: null, label: "Not sure", description: "Do not use this metric from this review." }
    ]
  },
  targetHierarchy: {
    label: "Target Hierarchy",
    prompt: "Are lead, support, background, and accent roles clear across selected models/layers?",
    options: [
      { id: "excellent_layer_hierarchy", score: 1, label: "Excellent hierarchy", description: "Model roles are clear and create depth without clutter." },
      { id: "good_hierarchy_minor_competition", score: 0.73, label: "Good, minor competition", description: "Roles generally work, with some moments where models compete." },
      { id: "weak_hierarchy", score: 0.36, label: "Weak hierarchy", description: "Many models feel equal in priority or the supporting layer is not useful." },
      { id: "cluttered_or_empty", score: 0.08, label: "Cluttered or empty", description: "The display is either too busy to read or too sparse for the phrase." },
      { id: "not_sure", score: null, label: "Not sure", description: "Do not use this metric from this review." }
    ]
  },
  overallFit: {
    label: "Overall Fit",
    prompt: "As a full sequence render, does it feel like mature, musical, human-quality sequencing?",
    options: [
      { id: "excellent_reference", score: 1, label: "Excellent reference", description: "Use as a strong positive reference for this dimension set." },
      { id: "good_reference", score: 0.78, label: "Good reference", description: "Use as a positive reference, with normal stylistic variation." },
      { id: "mixed_reference", score: 0.5, label: "Mixed reference", description: "Useful for calibration, but only with notes or adjusted interpretation." },
      { id: "poor_reference", score: 0.15, label: "Poor reference", description: "Do not use as a positive calibration example." },
      { id: "not_sure", score: null, label: "Not sure", description: "Do not use this metric from this review." }
    ]
  }
};

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

function reviewChoiceIds() {
  return Object.fromEntries(Object.entries(REVIEW_CHOICES).map(([dimension, spec]) => [
    dimension,
    spec.options.map((option) => option.id)
  ]));
}

function blankMetricChoices() {
  return Object.fromEntries(Object.keys(REVIEW_CHOICES).map((dimension) => [dimension, ""]));
}

function validMetricChoice(dimension = "", value = "") {
  const choice = str(value);
  if (!choice) return "";
  const validIds = new Set((REVIEW_CHOICES[dimension]?.options || []).map((option) => option.id));
  return validIds.has(choice) ? choice : "";
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
    metricChoices: blankMetricChoices(),
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
    metricChoices: Object.fromEntries(Object.keys(REVIEW_CHOICES).map((dimension) => [
      dimension,
      validMetricChoice(dimension, row.metricChoices?.[dimension])
    ])),
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
  const choiceValues = Object.values(row.metricChoices || {}).map(str).filter(Boolean);
  const checks = [
    choiceValues.length >= 4,
    str(row.summary) || choiceValues.length === Object.keys(REVIEW_CHOICES).length,
    arr(row.knownStrengths).length || choiceValues.length >= 4,
    arr(row.knownWeaknesses).length || choiceValues.length >= 4,
    str(row.recommendation) && str(row.recommendation) !== "pending"
  ];
  return checks.filter(Boolean).length / checks.length;
}

function summarizeMetricChoices(reviews = []) {
  const summary = {};
  for (const dimension of Object.keys(REVIEW_CHOICES)) {
    const counts = {};
    const scores = [];
    const scoreById = new Map(REVIEW_CHOICES[dimension].options.map((option) => [option.id, option.score]));
    for (const row of reviews) {
      if (str(row.status) !== "reviewed") continue;
      const choice = str(row.metricChoices?.[dimension]);
      if (!choice) continue;
      counts[choice] = (counts[choice] || 0) + 1;
      const score = scoreById.get(choice);
      if (Number.isFinite(score)) scores.push(score);
    }
    summary[dimension] = {
      reviewedChoices: Object.values(counts).reduce((sum, count) => sum + count, 0),
      meanChoiceScore: scores.length ? round6(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null,
      counts
    };
  }
  return summary;
}

function buildTemplate(profile = {}) {
  return {
    artifactType: "production_human_review_notes_v1",
    artifactVersion: 2,
    generatedAt: new Date().toISOString(),
    profilePath: "",
    reviewSchema: {
      inputMode: "multiple_choice_with_optional_notes",
      requiredFields: ["sequenceId", "status", "recommendation", "metricChoices"],
      validStatuses: [...VALID_STATUSES],
      validRecommendations: [...VALID_RECOMMENDATIONS],
      metricOrder: Object.keys(REVIEW_CHOICES),
      metricChoices: REVIEW_CHOICES,
      validMetricChoiceIds: reviewChoiceIds()
    },
    instructions: [
      "Review the MP4/contact sheet in xLights or the generated artifacts before changing status.",
      "For each metric, set metricChoices.<metricName> to the option id that most closely matches the render.",
      "Use status=reviewed and recommendation=approve only when the production reference should calibrate scorer bands.",
      "Use recommendation=adjust when the sequence is useful but one or more dimensions need interpretation notes.",
      "Use recommendation=exclude when the reference should not calibrate scoring.",
      "Use calibrationNotes only when a selected option needs extra context."
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
    metricChoiceSummary: summarizeMetricChoices(reviews),
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
