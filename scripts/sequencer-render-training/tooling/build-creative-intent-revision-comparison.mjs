#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function str(value = "") {
  return String(value || "").trim();
}

function num(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round6(value) {
  return Math.round(num(value) * 1_000_000) / 1_000_000;
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

function passKey(experimentId = "", passId = "") {
  return `${str(experimentId)}::${str(passId)}`;
}

function passMetadata(plan = {}) {
  const rows = new Map();
  for (const experiment of arr(plan.experiments)) {
    if (str(experiment.family) !== "creative_intent_revision_comparison") continue;
    for (const pass of arr(experiment.passes)) {
      rows.set(passKey(experiment.experimentId, pass.passId), {
        experimentId: str(experiment.experimentId),
        family: str(experiment.family),
        paletteProfile: str(experiment.paletteProfile),
        designType: str(experiment.designType),
        revisionComparisonContract: experiment.revisionComparisonContract || null,
        passId: str(pass.passId),
        comparisonBasePassId: str(pass.comparisonBasePassId),
        changeType: str(pass.changeType),
        placementCount: arr(pass.placements).length
      });
    }
  }
  return rows;
}

function resultRows(runRoot = "") {
  const root = resolvePath(runRoot);
  const summary = readJsonIfExists(path.join(root, "pass-runner-summary.json")) || {};
  const rows = [];
  for (const result of arr(summary.results)) {
    const quality = readJsonIfExists(result.renderReviewQualityRef) || {};
    const review = readJsonIfExists(quality.renderReviewRef || result.renderReviewRef) || {};
    const scores = review.qualityScores || {};
    rows.push({
      experimentId: str(result.experimentId || quality.experimentId),
      passId: str(result.passId || quality.passId),
      status: str(result.status),
      decision: str(result.renderReviewDecision || quality.decision || review.critique?.decision),
      evidenceEligible: Boolean(result.renderReviewEvidenceEligible || quality.evidenceEligible),
      measurementStatus: str(result.renderReviewMeasurementStatus || quality.measurementStatus),
      overallQuality: round6(scores.overallQuality ?? result.renderReviewOverallQuality ?? quality.overallQuality),
      intentMatch: round6(scores.intentMatch),
      visualReadability: round6(scores.visualReadability),
      motionCoherence: round6(scores.motionCoherence),
      clutterControl: round6(scores.clutterControl),
      renderReviewRef: str(quality.renderReviewRef || result.renderReviewRef),
      renderReviewQualityRef: str(result.renderReviewQualityRef)
    });
  }
  return rows;
}

function comparePair({ baseline = {}, revised = {}, metadata = {} } = {}) {
  const intentMatchDelta = round6(revised.intentMatch - baseline.intentMatch);
  const visualReadabilityDelta = round6(revised.visualReadability - baseline.visualReadability);
  const overallQualityDelta = round6(revised.overallQuality - baseline.overallQuality);
  const motionCoherenceDelta = round6(revised.motionCoherence - baseline.motionCoherence);
  const clutterControlDelta = round6(revised.clutterControl - baseline.clutterControl);
  const blockers = [];
  if (!baseline.evidenceEligible) blockers.push("baseline_not_evidence_eligible");
  if (!revised.evidenceEligible) blockers.push("revised_not_evidence_eligible");
  if (str(revised.decision) !== "accept") blockers.push("revised_review_not_accepted");
  if (intentMatchDelta < 0.02) blockers.push("intent_match_not_improved");
  if (visualReadabilityDelta < -0.03) blockers.push("readability_regressed");
  if (clutterControlDelta < -0.03) blockers.push("clutter_control_regressed");
  return {
    experimentId: str(metadata.experimentId || revised.experimentId),
    paletteProfile: str(metadata.paletteProfile),
    baselinePassId: str(baseline.passId),
    revisedPassId: str(revised.passId),
    changeType: str(metadata.changeType),
    comparisonStatus: blockers.length ? "blocked" : "improved",
    promotionEligible: blockers.length === 0,
    blockers,
    deltas: {
      overallQuality: overallQualityDelta,
      intentMatch: intentMatchDelta,
      visualReadability: visualReadabilityDelta,
      motionCoherence: motionCoherenceDelta,
      clutterControl: clutterControlDelta
    },
    baseline: {
      decision: str(baseline.decision),
      evidenceEligible: Boolean(baseline.evidenceEligible),
      overallQuality: round6(baseline.overallQuality),
      intentMatch: round6(baseline.intentMatch),
      visualReadability: round6(baseline.visualReadability),
      motionCoherence: round6(baseline.motionCoherence),
      clutterControl: round6(baseline.clutterControl),
      renderReviewRef: str(baseline.renderReviewRef),
      renderReviewQualityRef: str(baseline.renderReviewQualityRef)
    },
    revised: {
      decision: str(revised.decision),
      evidenceEligible: Boolean(revised.evidenceEligible),
      overallQuality: round6(revised.overallQuality),
      intentMatch: round6(revised.intentMatch),
      visualReadability: round6(revised.visualReadability),
      motionCoherence: round6(revised.motionCoherence),
      clutterControl: round6(revised.clutterControl),
      renderReviewRef: str(revised.renderReviewRef),
      renderReviewQualityRef: str(revised.renderReviewQualityRef)
    }
  };
}

export function buildCreativeIntentRevisionComparison({
  runRoot = "",
  outPath = ""
} = {}) {
  const root = resolvePath(runRoot);
  if (!root || !fs.existsSync(root)) throw new Error(`runRoot not found: ${root || "(missing)"}`);
  const plan = readJsonIfExists(path.join(root, "training-plan.json")) || {};
  const metadataByPass = passMetadata(plan);
  const resultByPass = new Map(resultRows(root).map((row) => [passKey(row.experimentId, row.passId), row]));
  const comparisons = [];
  for (const metadata of metadataByPass.values()) {
    if (str(metadata.changeType) !== "creative_intent_revision" || !metadata.comparisonBasePassId) continue;
    const baseline = resultByPass.get(passKey(metadata.experimentId, metadata.comparisonBasePassId));
    const revised = resultByPass.get(passKey(metadata.experimentId, metadata.passId));
    if (!baseline || !revised) continue;
    comparisons.push(comparePair({ baseline, revised, metadata }));
  }
  const improved = comparisons.filter((row) => row.comparisonStatus === "improved");
  const artifact = {
    artifactType: "creative_intent_revision_comparison_v1",
    artifactVersion: 1,
    generatedAt: new Date().toISOString(),
    runRoot: root,
    status: comparisons.length ? "ready" : "no_revision_pairs",
    comparisonCount: comparisons.length,
    improvedComparisonCount: improved.length,
    promotionEligibleCount: comparisons.filter((row) => row.promotionEligible).length,
    meanIntentMatchDelta: round6(improved.reduce((sum, row) => sum + row.deltas.intentMatch, 0) / (improved.length || 1)),
    comparisons
  };
  const resolvedOutPath = resolvePath(outPath || path.join(root, "creative-intent-revision-comparison.json"));
  writeJson(resolvedOutPath, artifact);
  return artifact;
}

function parseArgs(argv = []) {
  const args = { runRoot: "", outPath: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = str(argv[index]);
    if (arg === "--run-root") args.runRoot = argv[++index];
    else if (arg === "--out") args.outPath = argv[++index];
    else if (arg === "--help") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return `Usage:
  node scripts/sequencer-render-training/tooling/build-creative-intent-revision-comparison.mjs --run-root <completed-run-root> [--out creative-intent-revision-comparison.json]
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
    const artifact = buildCreativeIntentRevisionComparison(args);
    process.stdout.write(`${JSON.stringify({
      ok: true,
      out: resolvePath(args.outPath || path.join(args.runRoot, "creative-intent-revision-comparison.json")),
      status: artifact.status,
      comparisonCount: artifact.comparisonCount,
      improvedComparisonCount: artifact.improvedComparisonCount
    }, null, 2)}\n`);
  } catch (error) {
    console.error(error?.stack || String(error));
    process.exit(1);
  }
}
