import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function str(value = "") {
  return String(value || "").trim();
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeText(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text);
}

function unique(values = []) {
  return [...new Set(arr(values).map(str).filter(Boolean))];
}

function relativePathFromRoot(value = "", root = "") {
  const normalized = str(value);
  const normalizedRoot = str(root);
  if (!normalized || !normalizedRoot) return normalized;
  const absoluteValue = path.resolve(normalized);
  const absoluteRoot = path.resolve(normalizedRoot);
  const relative = path.relative(absoluteRoot, absoluteValue);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return normalized;
  return relative;
}

function repoRelativePath(value = "") {
  const normalized = str(value);
  if (!normalized) return "";
  const relative = path.relative(process.cwd(), path.resolve(normalized));
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return normalized;
  return relative;
}

function compactRuntimePrior(prior = {}, sourceRunRoot = "") {
  const compacted = { ...prior };
  if (str(compacted.sourceObservationRef)) {
    compacted.sourceObservationRef = relativePathFromRoot(compacted.sourceObservationRef, sourceRunRoot);
  }
  if (str(compacted.sourcePassPlanRef)) {
    compacted.sourcePassPlanRef = relativePathFromRoot(compacted.sourcePassPlanRef, sourceRunRoot);
  }
  return compacted;
}

function outcomeTags(prior = {}) {
  const observed = prior.observedEffects || {};
  const tags = [];
  if (Number(observed.activeModelCountDeltaFromBaseline || 0) > 0) tags.push("active_models_added");
  if (Number(observed.maxActiveNodeCountDeltaFromBaseline || 0) > 0) tags.push("coverage_added");
  if (observed.sceneSpreadDirectionFromBaseline === "increase") tags.push("scene_spread_increased");
  if (observed.sceneSpreadDirectionFromBaseline === "decrease") tags.push("scene_spread_decreased");
  if (observed.colorSpreadDirectionFromBaseline === "increase") tags.push("color_spread_increased");
  if (observed.multicolorFrameRatioDirectionFromBaseline === "increase") tags.push("multicolor_increased");
  if (observed.motionDirectionFromPrevious === "increase") tags.push("motion_increased");
  if (str(observed.equivalentToPass)) tags.push("order_equivalent");
  return unique(tags);
}

function compactScope(scope = {}) {
  return {
    family: str(scope.family),
    paletteProfile: str(scope.paletteProfile),
    compositionIntent: str(scope.compositionIntent),
    targetScopes: unique(scope.targetScopes),
    modelTypes: unique(scope.modelTypes),
    geometryProfiles: unique(scope.geometryProfiles),
    effectNames: unique(scope.effectNames),
    layerIndexes: arr(scope.layerIndexes).map(Number).filter(Number.isFinite)
  };
}

function compactObservedEffects(observed = {}) {
  return {
    activeModelCountDeltaFromBaseline: Number(observed.activeModelCountDeltaFromBaseline || 0),
    maxActiveNodeCountDeltaFromBaseline: Number(observed.maxActiveNodeCountDeltaFromBaseline || 0),
    sceneSpreadDirectionFromBaseline: str(observed.sceneSpreadDirectionFromBaseline),
    colorSpreadDirectionFromBaseline: str(observed.colorSpreadDirectionFromBaseline),
    multicolorFrameRatioDirectionFromBaseline: str(observed.multicolorFrameRatioDirectionFromBaseline),
    motionDirectionFromPrevious: str(observed.motionDirectionFromPrevious),
    brightnessVariationDirectionFromPrevious: str(observed.brightnessVariationDirectionFromPrevious),
    equivalentToPass: str(observed.equivalentToPass)
  };
}

function compactQualityEvidence(evidence = {}) {
  if (!evidence || typeof evidence !== "object" || !evidence.recordId) return null;
  return {
    recordId: str(evidence.recordId),
    durableCandidate: evidence.durableCandidate === true,
    sampleCount: Number(evidence.sampleCount || 0),
    trendStatus: str(evidence.trendStatus),
    effectName: str(evidence.effectName),
    leadTargets: unique(evidence.leadTargets),
    latestOverallQuality: Number(evidence.latestOverallQuality || 0),
    meanOverallQuality: Number(evidence.meanOverallQuality || 0),
    meanVisualReadability: Number(evidence.meanVisualReadability || 0),
    meanIntentMatch: Number(evidence.meanIntentMatch || 0),
    meanMotionCoherence: Number(evidence.meanMotionCoherence || 0)
  };
}

function addIndex(index, key, priorId) {
  const normalized = str(key);
  if (!normalized) return;
  if (!index[normalized]) index[normalized] = [];
  if (!index[normalized].includes(priorId)) index[normalized].push(priorId);
}

export function buildLayerCompositionPriorsBundle({ stagedPriors, sourcePath = "", sourceRunRoot = "" } = {}) {
  const source = typeof stagedPriors === "string" ? readJson(stagedPriors) : stagedPriors;
  const resolvedSourcePath = str(sourcePath) ? path.resolve(sourcePath) : "";
  const resolvedRunRoot = str(sourceRunRoot)
    ? path.resolve(sourceRunRoot)
    : (resolvedSourcePath ? path.dirname(resolvedSourcePath) : "");
  const records = {};
  const indexes = {
    byFamily: {},
    byPaletteProfile: {},
    byCompositionIntent: {},
    byOutcomeTag: {},
    byPromotionState: {},
    qualityBackedPriorIds: [],
    selectorReadyPriorIds: [],
    stagedPriorIds: []
  };
  for (const prior of arr(source?.priors)) {
    const priorId = str(prior.priorId);
    if (!priorId) continue;
    const tags = outcomeTags(prior);
    const compactedPrior = compactRuntimePrior(prior, resolvedRunRoot);
    records[priorId] = {
      priorId,
      confidence: str(compactedPrior.confidence),
      selectorReady: compactedPrior.selectorReady === true,
      promotionState: str(compactedPrior.promotionState),
      scope: compactScope(compactedPrior.scope || {}),
      observedEffects: compactObservedEffects(compactedPrior.observedEffects || {}),
      qualityEvidence: compactQualityEvidence(compactedPrior.qualityEvidence),
      guidance: unique(compactedPrior.guidance),
      safeguards: unique(compactedPrior.safeguards),
      sourceObservationRef: str(compactedPrior.sourceObservationRef),
      sourcePassPlanRef: str(compactedPrior.sourcePassPlanRef),
      sourceExperimentId: str(compactedPrior.sourceExperimentId || compactedPrior.scope?.experimentId),
      outcomeTags: tags
    };
    addIndex(indexes.byFamily, prior.scope?.family, priorId);
    addIndex(indexes.byPaletteProfile, prior.scope?.paletteProfile, priorId);
    addIndex(indexes.byCompositionIntent, prior.scope?.compositionIntent, priorId);
    addIndex(indexes.byPromotionState, prior.promotionState, priorId);
    for (const tag of tags) addIndex(indexes.byOutcomeTag, tag, priorId);
    if (prior.qualityEvidence?.durableCandidate) indexes.qualityBackedPriorIds.push(priorId);
    if (prior.selectorReady === true) indexes.selectorReadyPriorIds.push(priorId);
    else indexes.stagedPriorIds.push(priorId);
  }
  return {
    artifactType: "sequencer_layer_composition_priors_bundle",
    artifactVersion: "1.0",
    generatedAt: new Date().toISOString(),
    provenance: {
      generatedBy: "scripts/sequencer-render-training/tooling/export-layer-composition-priors-bundle.mjs",
      sourcePath: repoRelativePath(sourcePath),
      sourceRunRoot: repoRelativePath(resolvedRunRoot),
      sourceArtifactType: str(source?.artifactType),
      sourceRunId: str(source?.sourceRunId),
      sourceRecordCount: arr(source?.priors).length,
      compactionPolicy: "runtime_bundle_relativizes_raw_evidence_refs_and_omits_no_raw_frame_payloads"
    },
    sourceArtifactType: str(source?.artifactType),
    sourceRunId: str(source?.sourceRunId),
    sourcePath: repoRelativePath(sourcePath),
    recordType: "layer_composition_prior_v1",
    recordCount: Object.keys(records).length,
    qualityBackedCount: indexes.qualityBackedPriorIds.length,
    selectorReadyCount: indexes.selectorReadyPriorIds.length,
    stagedCount: indexes.stagedPriorIds.length,
    retrievalContract: {
      primaryFacets: ["family", "paletteProfile", "compositionIntent", "outcomeTags"],
      rankingPolicy: "facet_match_confidence_then_observed_strength",
      consumptionPolicy: "advisory_evidence_not_recipe"
    },
    indexes,
    records
  };
}

function parseArgs(argv) {
  const args = { priorsPath: "", outPath: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--priors") args.priorsPath = argv[++index];
    else if (arg === "--out") args.outPath = argv[++index];
    else if (arg === "--help") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return `Usage:
  node scripts/sequencer-render-training/tooling/export-layer-composition-priors-bundle.mjs --priors <layer-composition-priors-staged.json> --out <bundle.js>
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
  const bundle = buildLayerCompositionPriorsBundle({
    stagedPriors: readJson(args.priorsPath),
    sourcePath: path.resolve(args.priorsPath),
    sourceRunRoot: path.dirname(path.resolve(args.priorsPath))
  });
  writeText(args.outPath, `// Auto-generated by scripts/sequencer-render-training/tooling/export-layer-composition-priors-bundle.mjs\nexport const LAYER_COMPOSITION_PRIORS_BUNDLE = ${JSON.stringify(bundle)};\n`);
  process.stdout.write(`${args.outPath}\n`);
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch((error) => {
    console.error(error?.stack || String(error));
    process.exit(1);
  });
}
