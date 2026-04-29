import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildLayerCompositionExecutionScaffold } from "./run-layer-composition-execution-scaffold.mjs";

const REFILL_VARIANTS = {
  bandSize: [1, 2, 4, 5, 6, 8, 9, 10, 11, 13, 15, 18, 21, 24, 28, 32],
  skipSize: [0, 1, 2, 3, 5, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 36],
  thickness: [1, 3, 5, 6, 8, 10, 12, 16, 20, 24, 30, 36, 42, 50, 60, 70],
  speed: [1, 2, 3, 4, 6, 8, 9, 11, 13, 15, 18, 22, 26, 32, 40, 50],
  count: [1, 2, 3, 5, 7, 9, 11, 13, 17, 21, 27, 35, 45, 60, 80, 100],
  steps: [5, 10, 15, 20, 30, 40, 50, 60, 75, 90, 110, 130, 150, 175, 200, 240]
};

const RENDER_SETTING_REFILL_VARIANTS = {
  brightness: [20, 35, 50, 65, 80, 95, 110, 125, 140, 155, 170, 185, 200, 220, 240, 255],
  contrast: [5, 15, 25, 35, 50, 65, 80, 95, 110, 125, 140, 155, 170, 190, 215, 240],
  mixThreshold: [5, 10, 15, 25, 35, 45, 55, 65, 75, 85, 95, 110, 130, 150, 180, 220],
  blur: [1, 2, 3, 4, 6, 8, 10, 12, 16, 20, 24, 30, 36, 45, 55, 70],
  fadeIn: ["0.10", "0.25", "0.50", "0.75", "1.00", "1.25", "1.50", "1.75", "2.00", "2.50", "3.00", "3.50", "4.00", "4.50", "5.00", "6.00"],
  fadeOut: ["0.10", "0.25", "0.50", "0.75", "1.00", "1.25", "1.50", "1.75", "2.00", "2.50", "3.00", "3.50", "4.00", "4.50", "5.00", "6.00"]
};

const MANIFEST_SAMPLE_CHUNK_SIZE = 36;
const DEFAULT_MANIFEST_DIR = "scripts/sequencer-render-training/manifests";

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function str(value = "") {
  return String(value || "").trim();
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readOptionalJson(filePath) {
  try {
    return readJson(filePath);
  } catch {
    return null;
  }
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function safeSlug(value = "") {
  return String(value ?? "").trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "value";
}

function manifestPaths() {
  const root = path.resolve(DEFAULT_MANIFEST_DIR);
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root)
    .filter((name) => name.endsWith(".json"))
    .map((name) => path.join(DEFAULT_MANIFEST_DIR, name))
    .sort();
}

function refillSuffix(refillAttempt) {
  return `refill_${String(refillAttempt).padStart(3, "0")}`;
}

function refillValue(settingName, refillAttempt) {
  const values = REFILL_VARIANTS[settingName] || [];
  const index = Math.max(1, Number(refillAttempt) || 1) - 1;
  return index < values.length ? values[index] : undefined;
}

function renderSettingRefillValue(settingName, refillAttempt) {
  const values = RENDER_SETTING_REFILL_VARIANTS[settingName] || [];
  const index = Math.max(1, Number(refillAttempt) || 1) - 1;
  return index < values.length ? values[index] : undefined;
}

function selectedEffectSettingExperiment(experiment = {}) {
  const tier = str(experiment.runtimeSelection?.tier);
  return ["primary_setting_attribution", "high_value_geometry_retest"].includes(tier);
}

function selectedRenderSettingExperiment(experiment = {}) {
  return ["same_target_layer_stack", "setting_sensitivity_edge_probe"].includes(str(experiment.family));
}

function cloneBaselinePass(pass = {}, suffix = "") {
  const next = JSON.parse(JSON.stringify(pass));
  next.passId = `${pass.passId}_${suffix}`;
  next.refillSourcePassId = pass.passId;
  next.learningSeed.learningId = `${pass.learningSeed.learningId}:adaptive_refill:${suffix}`;
  next.learningSeed.coverageKey = `${pass.learningSeed.coverageKey}|adaptive_refill:${suffix}`;
  next.learningSeed.evidenceFingerprintInputs = {
    ...(next.learningSeed.evidenceFingerprintInputs || {}),
    adaptiveRefill: true,
    refillSourcePassId: pass.passId,
    refillSuffix: suffix
  };
  return next;
}

function adjustEffectSettingPass(pass = {}, suffix = "", refillAttempt = 1) {
  const next = JSON.parse(JSON.stringify(pass));
  let adjusted = false;
  for (const placement of arr(next.placements)) {
    const probe = placement.layerIntent?.effectSettingProbe;
    const settingName = str(probe?.settingName);
    if (!settingName || !(settingName in REFILL_VARIANTS)) continue;
    const variantValue = refillValue(settingName, refillAttempt);
    if (variantValue === undefined) continue;
    placement.effectSettings = {
      ...(placement.effectSettings || {}),
      [settingName]: variantValue
    };
    placement.layerIntent = {
      ...(placement.layerIntent || {}),
      attributionRole: "adaptive_refill_single_effect_setting_ab_variant",
      adaptiveRefill: {
        sourcePassId: pass.passId,
        refillAttempt,
        policy: "deterministic_deeper_setting_probe"
      },
      effectSettingProbe: {
        ...probe,
        variantValue
      }
    };
    adjusted = true;
  }
  if (!adjusted) return null;
  const settingName = str(next.placements?.find((placement) => placement.layerIntent?.effectSettingProbe)?.layerIntent?.effectSettingProbe?.settingName);
  const variantValue = next.placements?.find((placement) => placement.layerIntent?.effectSettingProbe)?.layerIntent?.effectSettingProbe?.variantValue;
  next.passId = `${pass.passId}_${suffix}_${safeSlug(settingName)}_${safeSlug(variantValue)}`;
  next.comparisonBasePassId = pass.comparisonBasePassId ? `${pass.comparisonBasePassId}_${suffix}` : "";
  next.refillSourcePassId = pass.passId;
  next.refillPolicy = "deterministic_deeper_setting_probe";
  next.learningSeed.learningId = `${pass.learningSeed.learningId}:adaptive_refill:${suffix}:${settingName}:${variantValue}`;
  next.learningSeed.coverageKey = `${pass.learningSeed.coverageKey}|adaptive_refill:${suffix}`;
  next.learningSeed.evidenceFingerprintInputs = {
    ...(next.learningSeed.evidenceFingerprintInputs || {}),
    adaptiveRefill: true,
    refillSourcePassId: pass.passId,
    refillSuffix: suffix,
    refillSettingName: settingName,
    refillVariantValue: variantValue
  };
  return next;
}

function changedRenderSettingNames(pass = {}) {
  const names = new Set();
  for (const placement of arr(pass.placements)) {
    for (const name of Object.keys(placement.layerSettings || {})) {
      if (name in RENDER_SETTING_REFILL_VARIANTS) names.add(name);
    }
  }
  return [...names];
}

function adjustRenderSettingPass(pass = {}, suffix = "", refillAttempt = 1) {
  const settingNames = changedRenderSettingNames(pass);
  if (!settingNames.length) return null;
  const next = JSON.parse(JSON.stringify(pass));
  const changed = [];
  for (const settingName of settingNames) {
    const variantValue = renderSettingRefillValue(settingName, refillAttempt);
    if (variantValue === undefined) continue;
    for (const placement of arr(next.placements)) {
      if (!(settingName in (placement.layerSettings || {}))) continue;
      placement.layerSettings = {
        ...(placement.layerSettings || {}),
        [settingName]: variantValue
      };
      placement.layerIntent = {
        ...(placement.layerIntent || {}),
        attributionRole: "adaptive_refill_layer_render_setting_variant",
        adaptiveRefill: {
          sourcePassId: pass.passId,
          refillAttempt,
          policy: "deterministic_render_setting_probe"
        },
        renderSettingProbe: {
          settingName,
          variantValue
        }
      };
      changed.push({ settingName, variantValue });
    }
  }
  if (!changed.length) return null;
  const idBits = changed.map((row) => `${safeSlug(row.settingName)}_${safeSlug(row.variantValue)}`).join("_");
  next.passId = `${pass.passId}_${suffix}_${idBits}`;
  next.comparisonBasePassId = pass.comparisonBasePassId ? `${pass.comparisonBasePassId}_${suffix}` : "";
  next.refillSourcePassId = pass.passId;
  next.refillPolicy = "deterministic_render_setting_probe";
  next.learningSeed.learningId = `${pass.learningSeed.learningId}:adaptive_refill:${suffix}:${changed.map((row) => `${row.settingName}:${row.variantValue}`).join(":")}`;
  next.learningSeed.coverageKey = `${pass.learningSeed.coverageKey}|adaptive_refill:${suffix}`;
  next.learningSeed.evidenceFingerprintInputs = {
    ...(next.learningSeed.evidenceFingerprintInputs || {}),
    adaptiveRefill: true,
    refillSourcePassId: pass.passId,
    refillSuffix: suffix,
    refillRenderSettings: changed
  };
  return next;
}

function buildEffectSettingRefillExperiment(experiment = {}, suffix = "", refillAttempt = 1) {
  const baselinePassIds = new Set(arr(experiment.passes)
    .filter((pass) => str(pass.passId).includes("baseline"))
    .map((pass) => pass.passId));
  const adjustedPasses = arr(experiment.passes)
    .filter((pass) => pass.changeType === "effect_setting")
    .map((pass) => adjustEffectSettingPass(pass, suffix, refillAttempt))
    .filter(Boolean);
  const neededBaselineIds = new Set(adjustedPasses.map((pass) => str(pass.comparisonBasePassId).replace(`_${suffix}`, "")));
  const baselinePasses = arr(experiment.passes)
    .filter((pass) => baselinePassIds.has(pass.passId) && neededBaselineIds.has(pass.passId))
    .map((pass) => cloneBaselinePass(pass, suffix));
  return {
    ...JSON.parse(JSON.stringify(experiment)),
    experimentId: `${experiment.experimentId}-${suffix}`,
    refillSourceExperimentId: experiment.experimentId,
    adaptiveRefill: {
      refillAttempt,
      policy: "deterministic_deeper_setting_probe",
      sourceExperimentId: experiment.experimentId
    },
    passes: [...baselinePasses, ...adjustedPasses]
  };
}

function buildRenderSettingRefillExperiment(experiment = {}, suffix = "", refillAttempt = 1) {
  const adjustedPasses = arr(experiment.passes)
    .filter((pass) => pass.changeType === "layer_render_setting")
    .map((pass) => adjustRenderSettingPass(pass, suffix, refillAttempt))
    .filter(Boolean);
  const neededBaselineIds = new Set(adjustedPasses.map((pass) => str(pass.comparisonBasePassId).replace(`_${suffix}`, "")));
  const baselinePasses = arr(experiment.passes)
    .filter((pass) => neededBaselineIds.has(pass.passId))
    .map((pass) => cloneBaselinePass(pass, suffix));
  return {
    ...JSON.parse(JSON.stringify(experiment)),
    experimentId: `${experiment.experimentId}-render-${suffix}`,
    refillSourceExperimentId: experiment.experimentId,
    adaptiveRefill: {
      refillAttempt,
      policy: "deterministic_render_setting_probe",
      sourceExperimentId: experiment.experimentId
    },
    passes: [...baselinePasses, ...adjustedPasses]
  };
}

function sampleSpecsForAttempt(refillAttempt = 1) {
  const allSpecs = [];
  for (const manifestPath of manifestPaths()) {
    const manifest = readOptionalJson(manifestPath);
    const fixture = manifest?.fixture || {};
    const modelName = str(fixture.modelName);
    if (!modelName) continue;
    for (const sample of arr(manifest.samples)) {
      if (!sample?.sampleId || !sample?.effectName) continue;
      allSpecs.push({
        manifestPath,
        packId: str(manifest.packId),
        sampleId: str(sample.sampleId),
        effectName: str(sample.effectName),
        effectSettings: {
          ...(sample.sharedSettings || {}),
          ...(sample.effectSettings || {})
        },
        labelHints: arr(sample.labelHints).map(str).filter(Boolean),
        target: {
          modelName,
          modelType: str(fixture.modelType || "unknown"),
          geometryProfile: str(fixture.modelType || "unknown"),
          analyzerFamily: str(fixture.modelType || "unknown")
        },
        startMs: Number(fixture.startMs) || 1000,
        endMs: Number(fixture.endMs) || 5000
      });
    }
  }
  const start = (Math.max(1, Number(refillAttempt) || 1) - 1) * MANIFEST_SAMPLE_CHUNK_SIZE;
  return allSpecs.slice(start, start + MANIFEST_SAMPLE_CHUNK_SIZE);
}

function learningSeed({ family, paletteProfile, passId, coverageKey, effectName = "", sampleId = "", refillAttempt = 1, suffix = "" } = {}) {
  return {
    learningId: [
      "layer_composition",
      family,
      paletteProfile,
      passId,
      effectName,
      sampleId,
      suffix
    ].map(str).filter(Boolean).join(":"),
    coverageKey,
    curriculumStage: "setting_sensitivity_survey",
    revalidationPolicy: {
      skipWhenDurablePriorExists: true,
      validReasons: [
        "xlights_renderer_version_changed",
        "owned_api_layer_behavior_changed",
        "observation_extractor_changed",
        "canonical_fixture_geometry_changed",
        "prior_confidence_low",
        "conflicting_new_evidence",
        "benchmark_gap_requires_deeper_sampling"
      ]
    },
    evidenceFingerprintInputs: {
      adaptiveRefill: true,
      refillAttempt,
      paletteProfile,
      family,
      passId,
      effectName,
      sampleId,
      refillSuffix: suffix
    }
  };
}

function buildManifestSampleExperiment({ spec, paletteProfile, suffix, refillAttempt }) {
  const family = "manifest_sample_effect_survey";
  const experimentId = [
    family,
    safeSlug(spec.effectName),
    safeSlug(spec.target.modelName),
    safeSlug(spec.sampleId),
    paletteProfile,
    suffix
  ].join("-");
  const coverageKey = [
    family,
    paletteProfile,
    "model",
    spec.target.modelType,
    spec.effectName
  ].join("|");
  const baselinePassId = "empty_baseline";
  const samplePassId = `sample_${safeSlug(spec.sampleId)}_${suffix}`;
  return {
    experimentId,
    family,
    paletteProfile,
    curriculumStage: "setting_sensitivity_survey",
    designType: "manifest_sample_single_effect_survey",
    coverageKey,
    runtimeSelection: {
      tier: "manifest_sample_effect_survey",
      queueRank: 70,
      budgetWeight: 4,
      selectionRole: "broad_effect_geometry_sample_survey"
    },
    targetSets: [{ scope: "model", targets: [spec.target] }],
    adaptiveRefill: {
      refillAttempt,
      policy: "manifest_sample_effect_survey",
      sourceManifestPath: spec.manifestPath,
      sourceSampleId: spec.sampleId
    },
    passes: [
      {
        passId: baselinePassId,
        compositionPass: "empty_baseline",
        placements: [],
        displayElementOrder: [spec.target.modelName],
        refillSourcePassId: "manifest_empty_baseline",
        learningSeed: learningSeed({
          family,
          paletteProfile,
          passId: baselinePassId,
          coverageKey,
          refillAttempt,
          suffix
        })
      },
      {
        passId: samplePassId,
        compositionPass: "manifest_sample_effect",
        changeType: "manifest_sample_effect",
        comparisonBasePassId: baselinePassId,
        refillSourcePassId: spec.sampleId,
        refillPolicy: "manifest_sample_effect_survey",
        placements: [
          {
            placementId: `manifest-${safeSlug(spec.sampleId)}-${suffix}`,
            targetScope: "model",
            target: spec.target.modelName,
            modelType: spec.target.modelType,
            geometryProfile: spec.target.geometryProfile,
            effectName: spec.effectName,
            compositionPass: "manifest_sample_effect",
            layerIndex: 0,
            startMs: spec.startMs,
            endMs: spec.endMs,
            effectSettings: spec.effectSettings,
            layerSettings: { mixMethod: "Normal" },
            layerIntent: {
              blendRole: "sample",
              attributionRole: "manifest_sample_effect_survey",
              labelHints: spec.labelHints,
              trainingSampleRef: {
                manifestPath: spec.manifestPath,
                packId: spec.packId,
                sampleId: spec.sampleId,
                labelHints: spec.labelHints
              },
              adaptiveRefill: {
                refillAttempt,
                policy: "manifest_sample_effect_survey"
              }
            }
          }
        ],
        displayElementOrder: [spec.target.modelName],
        learningSeed: learningSeed({
          family,
          paletteProfile,
          passId: samplePassId,
          coverageKey,
          effectName: spec.effectName,
          sampleId: spec.sampleId,
          refillAttempt,
          suffix
        })
      }
    ]
  };
}

function buildManifestSampleRefillExperiments(sourcePlan = {}, suffix = "", refillAttempt = 1) {
  const profiles = arr(sourcePlan.paletteProfiles).map((row) => str(row.profile || row)).filter(Boolean);
  const paletteProfiles = profiles.length ? profiles : ["mono_white", "rgb_primary"];
  return sampleSpecsForAttempt(refillAttempt).flatMap((spec) => paletteProfiles
    .map((paletteProfile) => buildManifestSampleExperiment({ spec, paletteProfile, suffix, refillAttempt })));
}

export function buildLayerCompositionAdaptiveRefillPlan({ plan, refillAttempt = 1 } = {}) {
  const sourcePlan = typeof plan === "string" ? readJson(plan) : plan;
  const suffix = refillSuffix(refillAttempt);
  const effectSettingExperiments = arr(sourcePlan?.experiments)
    .filter(selectedEffectSettingExperiment)
    .map((experiment) => buildEffectSettingRefillExperiment(experiment, suffix, refillAttempt))
    .filter((experiment) => arr(experiment.passes).length > 0);
  const renderSettingExperiments = arr(sourcePlan?.experiments)
    .filter(selectedRenderSettingExperiment)
    .map((experiment) => buildRenderSettingRefillExperiment(experiment, suffix, refillAttempt))
    .filter((experiment) => arr(experiment.passes).length > 0);
  const manifestSampleExperiments = buildManifestSampleRefillExperiments(sourcePlan, suffix, refillAttempt);
  const experiments = [...effectSettingExperiments, ...renderSettingExperiments, ...manifestSampleExperiments];
  return {
    ...JSON.parse(JSON.stringify(sourcePlan)),
    artifactType: "layer_composition_experiment_manifest_v1",
    generatedAt: new Date().toISOString(),
    status: "adaptive_refill_plan",
    runId: sourcePlan.runId,
    adaptiveRefill: {
      refillAttempt,
      policy: "multi_source_deterministic_refill",
      sourceRunId: sourcePlan.runId
    },
    experiments
  };
}

export function appendLayerCompositionAdaptiveRefill({ runRoot, plan, planPath = "", refillAttempt = 1 } = {}) {
  const root = path.resolve(str(runRoot));
  if (!root) throw new Error("runRoot is required");
  const sourcePlanPath = planPath || path.join(root, "training-plan.json");
  const sourcePlan = plan || readJson(sourcePlanPath);
  const refillPlan = buildLayerCompositionAdaptiveRefillPlan({ plan: sourcePlan, refillAttempt });
  if (!arr(refillPlan.experiments).length) {
    return {
      artifactType: "layer_composition_adaptive_refill_result_v1",
      artifactVersion: 1,
      generatedAt: new Date().toISOString(),
      status: "no_valid_non_repeated_experiment",
      appendedCheckpointCount: 0,
      stopReason: "no_valid_non_repeated_experiment"
    };
  }
  const refillPlanPath = path.join(root, "adaptive-refills", `${refillSuffix(refillAttempt)}-plan.json`);
  writeJson(refillPlanPath, refillPlan);
  const scaffold = buildLayerCompositionExecutionScaffold({
    plan: refillPlan,
    planPath: refillPlanPath,
    runRoot: root,
    append: true,
    mode: "adaptive_refill"
  });
  return {
    artifactType: "layer_composition_adaptive_refill_result_v1",
    artifactVersion: 1,
    generatedAt: new Date().toISOString(),
    status: scaffold.appendedCheckpointCount > 0 ? "appended_pending_apply_render" : "no_new_unique_checkpoints",
    refillAttempt,
    refillPlanRef: refillPlanPath,
    experimentCount: arr(refillPlan.experiments).length,
    appendedCheckpointCount: scaffold.appendedCheckpointCount,
    stopReason: scaffold.appendedCheckpointCount > 0 ? "" : "no_new_unique_checkpoints"
  };
}

function parseArgs(argv) {
  const args = { runRoot: "", planPath: "", outPath: "", refillAttempt: 1 };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--run-root") args.runRoot = argv[++index];
    else if (arg === "--plan") args.planPath = argv[++index];
    else if (arg === "--refill-attempt") args.refillAttempt = Number(argv[++index]);
    else if (arg === "--out") args.outPath = argv[++index];
    else if (arg === "--help") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return `Usage:
  node scripts/sequencer-render-training/tooling/build-layer-composition-adaptive-refill.mjs --run-root <run-dir> [--plan <training-plan.json>] [--refill-attempt 1] [--out <result.json>]
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(usage());
    return;
  }
  const result = appendLayerCompositionAdaptiveRefill({
    runRoot: args.runRoot,
    planPath: args.planPath,
    refillAttempt: args.refillAttempt
  });
  if (args.outPath) writeJson(args.outPath, result);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch((error) => {
    console.error(error?.stack || String(error));
    process.exit(1);
  });
}
