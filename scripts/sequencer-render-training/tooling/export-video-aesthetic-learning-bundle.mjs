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

function writeText(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text, "utf8");
}

function unique(values = []) {
  return [...new Set(arr(values).map(str).filter(Boolean))];
}

function slug(value = "") {
  return str(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "unknown";
}

function addIndex(index, key, id) {
  const normalized = slug(key);
  if (!normalized || !id) return;
  if (!index[normalized]) index[normalized] = [];
  if (!index[normalized].includes(id)) index[normalized].push(id);
}

function selectedPasses(plan = {}) {
  return arr(plan.experiments).flatMap((experiment) => arr(experiment.passes)
    .filter((pass) => pass?.controllerSelection?.selectedByController)
    .map((pass) => ({
      ...pass,
      experimentId: str(experiment.experimentId),
      family: str(experiment.family),
      paletteProfile: str(experiment.paletteProfile)
    })));
}

function dimensionRows(comparison = {}, predicate = () => false) {
  return arr(comparison.deltas)
    .filter((row) => predicate(num(row.delta, NaN)))
    .map((row) => ({
      dimension: str(row.dimension),
      baseline: round6(row.baseline),
      candidate: round6(row.candidate),
      delta: round6(row.delta)
    }));
}

function strategyFromPass(pass = {}) {
  const roles = unique(arr(pass.placements).map((placement) => placement?.layerIntent?.displayReviewRole));
  return roles[0] || str(pass.changeType).replace(/^video_aesthetic_/, "").replace(/_revision$/, "") || str(pass.passId);
}

function guidanceForRecord({ strategy = "", improved = [], regressed = [] } = {}) {
  const improvedNames = improved.filter((row) => row.dimension !== "overall_aesthetic_score").slice(0, 3).map((row) => row.dimension).join(", ");
  const regressedNames = regressed.slice(0, 2).map((row) => row.dimension).join(", ");
  return [
    improvedNames ? `${strategy} improved ${improvedNames}.` : "",
    regressedNames ? `Watch tradeoffs in ${regressedNames}.` : "",
    "Use as display-level aesthetic guidance, not as a fixed recipe."
  ].filter(Boolean);
}

export function buildVideoAestheticLearningBundle({ runRoot = "" } = {}) {
  const root = resolvePath(runRoot);
  if (!root || !fs.existsSync(root)) throw new Error(`runRoot not found: ${root || "(missing)"}`);
  const score = readJsonIfExists(path.join(root, "video-aesthetic-score.json")) || {};
  const comparison = readJsonIfExists(path.join(root, "video-aesthetic-attempt-comparison.json")) || {};
  const plan = readJsonIfExists(path.join(root, "training-plan.json")) || {};
  const passes = selectedPasses(plan);
  const selectedWindows = new Map(arr(score.windows).map((window) => [str(window.passId), window]));
  const records = {};
  const indexes = {
    byStrategy: {},
    byPaletteProfile: {},
    byImprovedDimension: {},
    byRegressedDimension: {}
  };

  for (const pass of passes) {
    const strategy = strategyFromPass(pass);
    const recordId = `video_aesthetic:${slug(pass.paletteProfile)}:${slug(strategy)}:${slug(pass.passId)}`;
    const improved = dimensionRows(comparison, (delta) => delta >= 0.01);
    const regressed = dimensionRows(comparison, (delta) => delta <= -0.01);
    const promoted = str(score.status) === "ready"
      && score.promotion?.evidenceEligible === true
      && str(comparison.comparisonStatus) === "improved"
      && comparison.promotionEligible === true;
    const window = selectedWindows.get(str(pass.passId)) || {};
    records[recordId] = {
      recordId,
      artifactType: "video_aesthetic_learning_record_v1",
      confidence: promoted ? "quality_backed" : "candidate_observed",
      promotionState: promoted ? "selector_ready" : "staged",
      selectorReady: promoted,
      strategy,
      passId: str(pass.passId),
      experimentId: str(pass.experimentId),
      paletteProfile: str(pass.paletteProfile),
      scoreBasis: str(score.scoreBasis),
      scores: {
        overallAestheticScore: round6(score.scores?.overallAestheticScore),
        sectionQualityMean: round6(score.scores?.sectionQualityMean),
        focalClarity: round6(score.scores?.focalClarity),
        pacingVariety: round6(score.scores?.pacingVariety),
        motionInterest: round6(score.scores?.motionInterest),
        colorDiscipline: round6(score.scores?.colorDiscipline),
        visualBalance: round6(score.scores?.visualBalance),
        qualityConsistency: round6(score.scores?.qualityConsistency)
      },
      comparison: {
        status: str(comparison.comparisonStatus),
        overallAestheticScoreDelta: round6(comparison.summary?.overallAestheticScoreDelta),
        improvedDimensions: improved,
        regressedDimensions: regressed
      },
      selectedWindow: {
        passId: str(window.passId),
        overallQuality: round6(window.overallQuality),
        focalClarity: round6(window.focalClarity),
        visualBalance: round6(window.visualBalance),
        colorDiscipline: round6(window.colorDiscipline),
        motionCoherence: round6(window.motionCoherence)
      },
      scope: {
        family: str(pass.family),
        paletteProfile: str(pass.paletteProfile),
        targetScopes: unique(arr(pass.placements).map((placement) => placement.targetScope)),
        modelTypes: unique(arr(pass.placements).map((placement) => placement.modelType)),
        geometryProfiles: unique(arr(pass.placements).map((placement) => placement.geometryProfile)),
        effectNames: unique(arr(pass.placements).map((placement) => placement.effectName)),
        blendRoles: unique(arr(pass.placements).map((placement) => placement?.layerIntent?.blendRole))
      },
      guidance: guidanceForRecord({ strategy, improved, regressed }),
      safeguards: [
        "Match strategy to compatible display-level intent and palette context.",
        "Revalidate if visual balance or quality consistency are primary blockers.",
        "Do not copy target names or placements directly into user sequences."
      ]
    };
    addIndex(indexes.byStrategy, strategy, recordId);
    addIndex(indexes.byPaletteProfile, pass.paletteProfile, recordId);
    for (const row of improved) addIndex(indexes.byImprovedDimension, row.dimension, recordId);
    for (const row of regressed) addIndex(indexes.byRegressedDimension, row.dimension, recordId);
  }

  const selectorReadyCount = Object.values(records).filter((record) => record.selectorReady).length;
  return {
    artifactType: "sequencer_video_aesthetic_learning_bundle",
    artifactVersion: "1.0",
    generatedAt: new Date().toISOString(),
    recordType: "video_aesthetic_learning_record_v1",
    recordCount: Object.keys(records).length,
    selectorReadyCount,
    promotionGate: {
      selectorRuntimeReady: selectorReadyCount > 0,
      selectorReadyRecordCount: selectorReadyCount,
      blockers: selectorReadyCount > 0 ? [] : ["no_selector_ready_video_aesthetic_records"]
    },
    retrievalContract: {
      primaryFacets: ["strategy", "paletteProfile", "improvedDimensions", "regressedDimensions"],
      rankingPolicy: "dimension_match_then_score_delta",
      consumptionPolicy: "display_level_advisory_evidence_not_recipe"
    },
    provenance: {
      generatedBy: "scripts/sequencer-render-training/tooling/export-video-aesthetic-learning-bundle.mjs",
      sourceRunId: str(plan.runId),
      sourceScoreStatus: str(score.status),
      sourceComparisonStatus: str(comparison.comparisonStatus)
    },
    indexes,
    records
  };
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
  node scripts/sequencer-render-training/tooling/export-video-aesthetic-learning-bundle.mjs --run-root <completed-run-root> --out apps/xlightsdesigner-ui/agent/sequence-agent/generated/video-aesthetic-learning-bundle.js
`;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help || !args.runRoot || !args.outPath) {
      process.stdout.write(usage());
      process.exit(args.help ? 0 : 1);
    }
    const bundle = buildVideoAestheticLearningBundle({ runRoot: args.runRoot });
    const output = `// Auto-generated by scripts/sequencer-render-training/tooling/export-video-aesthetic-learning-bundle.mjs\nexport const VIDEO_AESTHETIC_LEARNING_BUNDLE = ${JSON.stringify(bundle)};\n`;
    writeText(resolvePath(args.outPath), output);
    process.stdout.write(`${resolvePath(args.outPath)}\n`);
  } catch (error) {
    console.error(error?.stack || String(error));
    process.exit(1);
  }
}
