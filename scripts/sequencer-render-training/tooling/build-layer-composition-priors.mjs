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

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function num(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function qualitativeDirection(value, tolerance = 0.000001) {
  const n = num(value);
  if (n > tolerance) return "increase";
  if (n < -tolerance) return "decrease";
  return "no_measured_change";
}

function qualityRecordKey(record = {}) {
  return [
    str(record.experimentId),
    str(record.passId)
  ].join("::");
}

function qualityEvidenceSummary(record = {}) {
  return {
    recordId: str(record.recordId),
    durableCandidate: Boolean(record.promotion?.durableCandidate),
    sampleCount: num(record.sampleCount),
    trendStatus: str(record.trendStatus),
    effectName: str(record.effectName),
    leadTargets: arr(record.leadTargets).map(str).filter(Boolean),
    latestOverallQuality: num(record.quality?.latestOverallQuality),
    meanOverallQuality: num(record.quality?.meanOverallQuality),
    meanVisualReadability: num(record.observedMetrics?.meanVisualReadability),
    meanIntentMatch: num(record.observedMetrics?.meanIntentMatch),
    meanMotionCoherence: num(record.observedMetrics?.meanMotionCoherence),
    latestRenderReviewRef: str(record.evidence?.latestRenderReviewRef),
    latestQualityRef: str(record.evidence?.latestQualityRef),
    promotionBlockers: arr(record.promotion?.blockers).map(str).filter(Boolean)
  };
}

function compositionIntent(passId = "") {
  const id = str(passId);
  if (id.includes("baseline")) return "control";
  if (id.includes("foundation") || id.includes("group_only") || id.includes("one_layer")) return "foundation";
  if (id.includes("model_only")) return "model_focus";
  if (id.includes("group_then_model")) return "foundation_plus_model_focus";
  if (id.includes("order_variant") || id.includes("reversed")) return "order_sensitivity";
  if (id.includes("brightness")) return "render_setting_sensitivity";
  if (id.includes("two_layer")) return "two_layer_stack";
  if (id.includes("three_layer")) return "three_layer_stack";
  return "composition_stack";
}

function priorScope(experiment = {}, pass = {}) {
  const placement = pass.placementSummary && typeof pass.placementSummary === "object" ? pass.placementSummary : {};
  return {
    family: str(experiment.family),
    paletteProfile: str(experiment.paletteProfile),
    compositionIntent: compositionIntent(pass.passId),
    targetScopes: arr(placement.targetScopes).map(str).filter(Boolean),
    modelTypes: arr(placement.modelTypes).map(str).filter(Boolean),
    geometryProfiles: arr(placement.geometryProfiles).map(str).filter(Boolean),
    effectNames: arr(placement.effectNames).map(str).filter(Boolean),
    compositionPasses: arr(placement.compositionPasses).map(str).filter(Boolean),
    layerIndexes: arr(placement.layerIndexes).map(Number).filter(Number.isFinite),
    layerBlendRoles: arr(placement.layerBlendRoles).map(str).filter(Boolean),
    passId: str(pass.passId),
    experimentId: str(experiment.experimentId)
  };
}

function buildPrior(experiment = {}, pass = {}, qualityRecordByPass = new Map()) {
  const baselineDelta = pass.baselineDelta || {};
  const previousDelta = pass.previousDelta || {};
  const current = baselineDelta.current || {};
  const statements = arr(pass?.candidateLearning?.statements).map(str).filter(Boolean);
  const renderSettingDeltas = arr(pass.renderSettingDeltas);
  const effectSettingDeltas = arr(pass.effectSettingDeltas);
  const noMacroChange = str(pass?.candidateLearning?.confidence) === "no_macro_change_detected";
  const renderSettingGuidance = renderSettingDeltas.flatMap((delta) => arr(delta.interpretedDeltas)
    .map(str)
    .filter(Boolean)
    .map((label) => `${str(delta.settingName)}: ${label}`));
  const effectSettingGuidance = effectSettingDeltas.flatMap((delta) => arr(delta.interpretedDeltas)
    .map(str)
    .filter(Boolean)
    .map((label) => `${str(delta.affectedLayer?.effectName)} ${str(delta.settingName)}: ${label}`));
  const qualityEvidence = qualityRecordByPass.get(qualityRecordKey({
    experimentId: experiment.experimentId,
    passId: pass.passId
  })) || null;
  const compactQualityEvidence = qualityEvidence ? qualityEvidenceSummary(qualityEvidence) : null;
  const qualityGuidance = compactQualityEvidence?.durableCandidate
    ? [`quality evidence accepted across ${compactQualityEvidence.sampleCount} samples; mean quality ${compactQualityEvidence.meanOverallQuality}`]
    : [];
  return {
    priorId: [
      "layer_composition",
      str(experiment.family),
      str(experiment.paletteProfile),
      str(pass.passId)
    ].filter(Boolean).join(":"),
    artifactType: "layer_composition_prior_v1",
    sourceLearningId: str(pass.learningId),
    sourceObservationRef: str(pass.observationRef),
    sourcePassPlanRef: str(pass.passPlanRef),
    sourceExperimentId: str(experiment.experimentId),
    confidence: noMacroChange ? "control_or_no_observed_change" : "smoke_observed",
    selectorReady: false,
    promotionState: "staged",
    qualityEvidence: compactQualityEvidence,
    scope: priorScope(experiment, pass),
    conditions: {
      paletteProfile: str(experiment.paletteProfile),
      experimentFamily: str(experiment.family),
      observedActiveModels: arr(current.activeModelNames).map(str).filter(Boolean),
      leadModel: str(current.leadModel),
      dominantColorRole: str(current.dominantColorRole || "unknown"),
      targetScopes: arr(pass.placementSummary?.targetScopes).map(str).filter(Boolean),
      geometryProfiles: arr(pass.placementSummary?.geometryProfiles).map(str).filter(Boolean),
      effectNames: arr(pass.placementSummary?.effectNames).map(str).filter(Boolean),
      layerIndexes: arr(pass.placementSummary?.layerIndexes).map(Number).filter(Number.isFinite),
      changedLayerSettings: arr(pass.changedLayerSettings).map((row) => ({
        settingName: str(row.settingName),
        baselineValue: row.baselineValue ?? null,
        variantValue: row.variantValue ?? null,
        affectedLayer: row.affectedLayer || {}
      })).filter((row) => row.settingName),
      changedEffectSettings: arr(pass.changedEffectSettings).map((row) => ({
        settingName: str(row.settingName),
        baselineValue: row.baselineValue ?? null,
        variantValue: row.variantValue ?? null,
        affectedLayer: row.affectedLayer || {}
      })).filter((row) => row.settingName)
    },
    observedEffects: {
      activeModelCountDeltaFromBaseline: num(baselineDelta.activeModelCountDelta),
      maxActiveNodeCountDeltaFromBaseline: num(baselineDelta.maxActiveNodeCountDelta),
      sceneSpreadDirectionFromBaseline: qualitativeDirection(baselineDelta.meanSceneSpreadRatioDelta, 0.001),
      colorSpreadDirectionFromBaseline: qualitativeDirection(baselineDelta.meanColorSpreadDelta, 0.001),
      multicolorFrameRatioDirectionFromBaseline: qualitativeDirection(baselineDelta.multicolorFrameRatioDelta, 0.001),
      motionDirectionFromPrevious: qualitativeDirection(previousDelta.centroidMotionMeanDelta, 0.01),
      brightnessVariationDirectionFromPrevious: qualitativeDirection(previousDelta.brightnessDeltaMeanDelta, 0.001),
      equivalentToPass: str(pass.equivalentToPass),
      renderSettingDeltas: renderSettingDeltas.map((delta) => ({
        settingName: str(delta.settingName),
        interpretedDeltas: arr(delta.interpretedDeltas).map(str).filter(Boolean),
        metricDeltas: {
          meanSceneSpreadRatioDelta: num(delta.metricDeltas?.meanSceneSpreadRatioDelta),
          meanColorSpreadDelta: num(delta.metricDeltas?.meanColorSpreadDelta),
          multicolorFrameRatioDelta: num(delta.metricDeltas?.multicolorFrameRatioDelta),
          centroidMotionMeanDelta: num(delta.metricDeltas?.centroidMotionMeanDelta),
          brightnessDeltaMeanDelta: num(delta.metricDeltas?.brightnessDeltaMeanDelta),
          brightnessDeltaMaxDelta: num(delta.metricDeltas?.brightnessDeltaMaxDelta),
          meanModelActiveNodeRatioDelta: num(delta.metricDeltas?.meanModelActiveNodeRatioDelta),
          modelActiveNodeRatioStddevMeanDelta: num(delta.metricDeltas?.modelActiveNodeRatioStddevMeanDelta),
          meanModelBrightnessStddevDelta: num(delta.metricDeltas?.meanModelBrightnessStddevDelta),
          meanEdgeSoftnessDelta: num(delta.metricDeltas?.meanEdgeSoftnessDelta),
          meanColorBoundarySoftnessDelta: num(delta.metricDeltas?.meanColorBoundarySoftnessDelta),
          meanAdjacentColorDeltaDelta: num(delta.metricDeltas?.meanAdjacentColorDeltaDelta),
          activeNodeRetentionMeanDelta: num(delta.metricDeltas?.activeNodeRetentionMeanDelta),
          rgbSimilarityMeanDelta: num(delta.metricDeltas?.rgbSimilarityMeanDelta),
          brightnessSimilarityMeanDelta: num(delta.metricDeltas?.brightnessSimilarityMeanDelta),
          colorSequenceChangeMeanDelta: num(delta.metricDeltas?.colorSequenceChangeMeanDelta),
          colorSequenceChangeMaxDelta: num(delta.metricDeltas?.colorSequenceChangeMaxDelta),
          openingToMiddleBrightnessDeltaDelta: num(delta.metricDeltas?.openingToMiddleBrightnessDeltaDelta),
          middleToClosingBrightnessDeltaDelta: num(delta.metricDeltas?.middleToClosingBrightnessDeltaDelta),
          openingToClosingActiveNodeDeltaDelta: num(delta.metricDeltas?.openingToClosingActiveNodeDeltaDelta)
        }
      })),
      effectSettingDeltas: effectSettingDeltas.map((delta) => ({
        settingName: str(delta.settingName),
        effectName: str(delta.affectedLayer?.effectName),
        interpretedDeltas: arr(delta.interpretedDeltas).map(str).filter(Boolean),
        metricDeltas: {
          meanSceneSpreadRatioDelta: num(delta.metricDeltas?.meanSceneSpreadRatioDelta),
          meanColorSpreadDelta: num(delta.metricDeltas?.meanColorSpreadDelta),
          multicolorFrameRatioDelta: num(delta.metricDeltas?.multicolorFrameRatioDelta),
          centroidMotionMeanDelta: num(delta.metricDeltas?.centroidMotionMeanDelta),
          brightnessDeltaMeanDelta: num(delta.metricDeltas?.brightnessDeltaMeanDelta),
          brightnessDeltaMaxDelta: num(delta.metricDeltas?.brightnessDeltaMaxDelta),
          meanModelActiveNodeRatioDelta: num(delta.metricDeltas?.meanModelActiveNodeRatioDelta),
          modelActiveNodeRatioStddevMeanDelta: num(delta.metricDeltas?.modelActiveNodeRatioStddevMeanDelta),
          meanModelBrightnessStddevDelta: num(delta.metricDeltas?.meanModelBrightnessStddevDelta),
          meanEdgeSoftnessDelta: num(delta.metricDeltas?.meanEdgeSoftnessDelta),
          meanColorBoundarySoftnessDelta: num(delta.metricDeltas?.meanColorBoundarySoftnessDelta),
          meanAdjacentColorDeltaDelta: num(delta.metricDeltas?.meanAdjacentColorDeltaDelta),
          activeNodeRetentionMeanDelta: num(delta.metricDeltas?.activeNodeRetentionMeanDelta),
          rgbSimilarityMeanDelta: num(delta.metricDeltas?.rgbSimilarityMeanDelta),
          brightnessSimilarityMeanDelta: num(delta.metricDeltas?.brightnessSimilarityMeanDelta),
          colorSequenceChangeMeanDelta: num(delta.metricDeltas?.colorSequenceChangeMeanDelta),
          colorSequenceChangeMaxDelta: num(delta.metricDeltas?.colorSequenceChangeMaxDelta),
          openingToMiddleBrightnessDeltaDelta: num(delta.metricDeltas?.openingToMiddleBrightnessDeltaDelta),
          middleToClosingBrightnessDeltaDelta: num(delta.metricDeltas?.middleToClosingBrightnessDeltaDelta),
          openingToClosingActiveNodeDeltaDelta: num(delta.metricDeltas?.openingToClosingActiveNodeDeltaDelta)
        }
      }))
    },
    guidance: [...statements, ...renderSettingGuidance, ...effectSettingGuidance, ...qualityGuidance].length
      ? [...statements, ...renderSettingGuidance, ...effectSettingGuidance, ...qualityGuidance]
      : ["No macro-level visual change was measured in the sampled window."],
    safeguards: [
      "Do not reuse as a fixed sequencing recipe.",
      "Use only as conditional evidence about layering behavior.",
      "Require broader overnight evidence before selector-ready promotion."
    ]
  };
}

export function buildLayerCompositionPriors({ deltaSummary, qualityRecords = null } = {}) {
  const summary = typeof deltaSummary === "string" ? readJson(deltaSummary) : deltaSummary;
  const quality = typeof qualityRecords === "string" ? readJson(qualityRecords) : qualityRecords;
  const qualityRecordByPass = new Map(arr(quality?.records)
    .filter((record) => record.promotion?.durableCandidate)
    .map((record) => [qualityRecordKey(record), record]));
  const priors = arr(summary?.experiments).flatMap((experiment) => arr(experiment.passDeltas)
    .filter((pass) => str(pass.passId) !== "empty_baseline")
    .map((pass) => buildPrior(experiment, pass, qualityRecordByPass)));
  return {
    artifactType: "layer_composition_priors_v1",
    artifactVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceRunId: str(summary?.runId),
    sourceRunRoot: str(summary?.runRoot),
    sourceDeltaSummaryRef: str(summary?.sourceDeltaSummaryRef),
    sourceQualityRecordsRef: str(quality?.sourceQualityRecordsRef || quality?.sourceQualityTrendRef || ""),
    priorCount: priors.length,
    qualityBackedPriorCount: priors.filter((prior) => prior.qualityEvidence?.durableCandidate).length,
    selectorReadyCount: priors.filter((prior) => prior.selectorReady).length,
    promotionState: "staged",
    promotionBlockers: [
      "Smoke run is proof of mechanics only.",
      "Needs longer adaptive run before selector-ready promotion.",
      "Needs render-setting support gaps resolved or explicitly excluded."
    ],
    priors
  };
}

function parseArgs(argv) {
  const args = { deltaSummaryPath: "", qualityRecordsPath: "", outPath: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--delta-summary") args.deltaSummaryPath = argv[++index];
    else if (arg === "--quality-records") args.qualityRecordsPath = argv[++index];
    else if (arg === "--out") args.outPath = argv[++index];
    else if (arg === "--help") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return `Usage:
  node scripts/sequencer-render-training/tooling/build-layer-composition-priors.mjs --delta-summary <summary.json> [--quality-records quality-records.json] --out <priors.json>
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(usage());
    return;
  }
  if (!args.deltaSummaryPath) throw new Error("--delta-summary is required");
  if (!args.outPath) throw new Error("--out is required");
  const summary = readJson(args.deltaSummaryPath);
  summary.sourceDeltaSummaryRef = path.resolve(args.deltaSummaryPath);
  const qualityRecords = args.qualityRecordsPath ? readJson(args.qualityRecordsPath) : null;
  if (qualityRecords) qualityRecords.sourceQualityRecordsRef = path.resolve(args.qualityRecordsPath);
  const priors = buildLayerCompositionPriors({ deltaSummary: summary, qualityRecords });
  writeJson(args.outPath, priors);
  process.stdout.write(`${args.outPath}\n`);
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch((error) => {
    console.error(error?.stack || String(error));
    process.exit(1);
  });
}
