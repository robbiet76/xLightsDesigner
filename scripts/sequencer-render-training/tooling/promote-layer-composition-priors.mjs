#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_MIN_SAMPLE_COUNT = 2;
const DEFAULT_MIN_QUALITY = 0.72;
const ACCEPTED_TRENDS = ["stable", "improving"];

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

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function promotionChecks(prior = {}, { minSampleCount = DEFAULT_MIN_SAMPLE_COUNT, minQuality = DEFAULT_MIN_QUALITY } = {}) {
  const evidence = prior.qualityEvidence || {};
  const checks = [
    {
      id: "has_durable_quality_evidence",
      ok: evidence.durableCandidate === true
    },
    {
      id: "sample_count",
      ok: num(evidence.sampleCount) >= minSampleCount,
      actual: num(evidence.sampleCount),
      required: minSampleCount
    },
    {
      id: "trend_status",
      ok: ACCEPTED_TRENDS.includes(str(evidence.trendStatus)),
      actual: str(evidence.trendStatus),
      accepted: ACCEPTED_TRENDS
    },
    {
      id: "latest_quality",
      ok: num(evidence.latestOverallQuality) >= minQuality,
      actual: num(evidence.latestOverallQuality),
      required: minQuality
    },
    {
      id: "mean_quality",
      ok: num(evidence.meanOverallQuality) >= minQuality,
      actual: num(evidence.meanOverallQuality),
      required: minQuality
    },
    {
      id: "quality_record_has_no_blockers",
      ok: arr(evidence.promotionBlockers).length === 0,
      actual: arr(evidence.promotionBlockers)
    }
  ];
  return checks;
}

function blockedReasons(checks = []) {
  return arr(checks)
    .filter((check) => check.ok !== true)
    .map((check) => str(check.id))
    .filter(Boolean);
}

function creativeRevisionComparisonByPass(comparison = {}) {
  const rows = new Map();
  for (const row of arr(comparison?.comparisons)) {
    const revisedPassId = str(row.revisedPassId);
    if (revisedPassId) rows.set(revisedPassId, row);
  }
  return rows;
}

function creativeRevisionPromotionChecks(prior = {}, options = {}) {
  const scope = prior.scope || {};
  if (str(scope.family) !== "creative_intent_revision_comparison") return [];
  const passId = str(scope.passId);
  const comparison = options.creativeRevisionComparisonByPass?.get(passId);
  if (!comparison) return [];
  return [{
    id: "creative_revision_comparison_promotion_eligible",
    ok: comparison.promotionEligible === true,
    actual: str(comparison.comparisonStatus),
    blockers: arr(comparison.blockers).map(str).filter(Boolean)
  }];
}

function promotePrior(prior = {}, options = {}) {
  const checks = [
    ...promotionChecks(prior, options),
    ...creativeRevisionPromotionChecks(prior, options)
  ];
  const blockers = blockedReasons(checks);
  const promoted = blockers.length === 0;
  return {
    ...prior,
    confidence: promoted ? "quality_backed" : str(prior.confidence || "smoke_observed"),
    selectorReady: promoted,
    promotionState: promoted ? "selector_ready" : str(prior.promotionState || "staged"),
    promotionReview: {
      artifactType: "layer_composition_prior_promotion_review_v1",
      reviewedAt: new Date().toISOString(),
      reviewedBy: "scripts/sequencer-render-training/tooling/promote-layer-composition-priors.mjs",
      selectorReady: promoted,
      blockers,
      policy: {
        minSampleCount: num(options.minSampleCount, DEFAULT_MIN_SAMPLE_COUNT),
        minQuality: num(options.minQuality, DEFAULT_MIN_QUALITY),
        acceptedTrendStatuses: ACCEPTED_TRENDS
      },
      checks
    },
    safeguards: promoted
      ? [
        ...arr(prior.safeguards).map(str).filter(Boolean),
        "Selector use must still match compatible family, palette, intent, target scope, and effect context.",
        "Shared baseline priors may be overridden or narrowed by project-local target behavior evidence."
      ]
      : arr(prior.safeguards).map(str).filter(Boolean)
  };
}

export function promoteLayerCompositionPriors({
  priors,
  minSampleCount = DEFAULT_MIN_SAMPLE_COUNT,
  minQuality = DEFAULT_MIN_QUALITY,
  creativeIntentRevisionComparison = null
} = {}) {
  const source = typeof priors === "string" ? readJson(priors) : priors;
  const creativeRevisionComparisonByPassMap = creativeRevisionComparisonByPass(creativeIntentRevisionComparison || {});
  const promotedPriors = arr(source?.priors).map((prior) => promotePrior(prior, {
    minSampleCount,
    minQuality,
    creativeRevisionComparisonByPass: creativeRevisionComparisonByPassMap
  }));
  const selectorReadyPriors = promotedPriors.filter((prior) => prior.selectorReady === true);
  const blockedPriors = promotedPriors.filter((prior) => prior.selectorReady !== true);
  return {
    ...source,
    artifactType: "layer_composition_priors_v1",
    artifactVersion: 1,
    generatedAt: new Date().toISOString(),
    promotionState: selectorReadyPriors.length > 0 ? "reviewed_with_selector_ready_priors" : "reviewed_no_selector_ready_priors",
    promotionPolicy: {
      promotedByDefault: false,
      promotionTool: "scripts/sequencer-render-training/tooling/promote-layer-composition-priors.mjs",
      minSampleCount,
      minQuality,
      acceptedTrendStatuses: ACCEPTED_TRENDS,
      sourceArtifactType: str(source?.artifactType),
      targetApplicability: "compatible_structure_and_metadata_only",
      projectLocalOverrideArtifact: "display/target-behavior.json"
    },
    priorCount: promotedPriors.length,
    qualityBackedPriorCount: promotedPriors.filter((prior) => prior.qualityEvidence?.durableCandidate).length,
    selectorReadyCount: selectorReadyPriors.length,
    blockedPromotionCount: blockedPriors.length,
    promotionBlockers: blockedPriors.length
      ? ["Some priors remain staged because they do not meet quality-backed selector promotion criteria."]
      : [],
    promotionSummary: {
      reviewedPriorCount: promotedPriors.length,
      selectorReadyPriorCount: selectorReadyPriors.length,
      blockedPriorCount: blockedPriors.length,
      selectorReadyPriorIds: selectorReadyPriors.map((prior) => str(prior.priorId)).filter(Boolean),
      blockedPriorIds: blockedPriors.map((prior) => str(prior.priorId)).filter(Boolean)
    },
    priors: promotedPriors
  };
}

function parseArgs(argv = []) {
  const args = {
    priorsPath: "",
    outPath: "",
    minSampleCount: DEFAULT_MIN_SAMPLE_COUNT,
    minQuality: DEFAULT_MIN_QUALITY
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = str(argv[index]);
    if (arg === "--priors") args.priorsPath = argv[++index];
    else if (arg === "--out") args.outPath = argv[++index];
    else if (arg === "--min-sample-count") args.minSampleCount = Number(argv[++index]);
    else if (arg === "--min-quality") args.minQuality = Number(argv[++index]);
    else if (arg === "--help") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return `Usage:
  node scripts/sequencer-render-training/tooling/promote-layer-composition-priors.mjs --priors <layer-composition-priors-staged.json> --out <layer-composition-priors-promoted.json>
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(usage());
    return;
  }
  if (!args.priorsPath) throw new Error("--priors is required");
  if (!args.outPath) throw new Error("--out is required");
  const artifact = promoteLayerCompositionPriors({
    priors: readJson(path.resolve(args.priorsPath)),
    minSampleCount: args.minSampleCount,
    minQuality: args.minQuality
  });
  writeJson(path.resolve(args.outPath), artifact);
  process.stdout.write(`${path.resolve(args.outPath)}\n`);
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch((error) => {
    console.error(error?.stack || String(error));
    process.exit(1);
  });
}
