import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

function str(value = "") {
  return String(value || "").trim();
}

function slug(value = "") {
  return str(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function loadJson(path) {
  return JSON.parse(readFileSync(resolve(path), "utf8"));
}

const outputDir = process.argv[2]
  ? resolve(process.argv[2])
  : resolve("scripts/sequencer-render-training/catalog/effect-training-dossiers");
const unifiedPath = process.argv[3]
  ? resolve(process.argv[3])
  : resolve("scripts/sequencer-render-training/catalog/sequencer-unified-training-set-v1.json");
const coveragePath = process.argv[4]
  ? resolve(process.argv[4])
  : resolve("scripts/sequencer-render-training/catalog/effect-settings-coverage-report-v1.json");
const interactionCoveragePath = process.argv[5]
  ? resolve(process.argv[5])
  : resolve("scripts/sequencer-render-training/catalog/effect-setting-interaction-coverage-report-v1.json");
const registryPath = process.argv[6]
  ? resolve(process.argv[6])
  : resolve("scripts/sequencer-render-training/catalog/effective-effect-parameter-registry.json");

const unified = JSON.parse(readFileSync(unifiedPath, "utf8"));
const coverage = JSON.parse(readFileSync(coveragePath, "utf8"));
const registry = JSON.parse(readFileSync(registryPath, "utf8"));
let interactionCoverage = null;
try {
  interactionCoverage = JSON.parse(readFileSync(interactionCoveragePath, "utf8"));
} catch {
  interactionCoverage = { effects: [] };
}

const manifestsDir = resolve("scripts/sequencer-render-training/manifests");
const recordsDir = resolve("scripts/sequencer-render-training/catalog/effect-screening-records");

const unifiedByName = new Map((Array.isArray(unified?.effects) ? unified.effects : []).map((row) => [str(row.effectName), row]));
const coverageByName = new Map((Array.isArray(coverage?.effects) ? coverage.effects : []).map((row) => [str(row.effectName), row]));
const interactionByName = new Map((Array.isArray(interactionCoverage?.effects) ? interactionCoverage.effects : []).map((row) => [str(row.effectName), row]));
const effectNames = [...new Set([
  ...unifiedByName.keys(),
  ...coverageByName.keys(),
  ...Object.keys(registry?.effects || {})
])].filter(Boolean).sort((a, b) => a.localeCompare(b));

function listManifestsForEffect(effectName = "") {
  const key = slug(effectName).replace(/-/g, "");
  const names = readdirSync(manifestsDir).filter((name) => name.endsWith(".json"));
  const rows = names.filter((name) => name.toLowerCase().startsWith(key + "-")).sort((a, b) => a.localeCompare(b));
  return {
    expandedSweep: rows.filter((name) => name.includes("expanded-sweep")),
    range: rows.filter((name) => name.includes("-range-")),
    combos: rows.filter((name) => name.includes("-combos-")),
    interactions: rows.filter((name) => name.includes("-interactions-")),
    all: rows
  };
}

function listScreeningRecordsForEffect(effectName = "") {
  const key = slug(effectName);
  return readdirSync(recordsDir)
    .filter((name) => name.endsWith(".record.json") && name.startsWith(key + "-"))
    .sort((a, b) => a.localeCompare(b));
}

mkdirSync(outputDir, { recursive: true });
const outputFiles = [];

for (const effectName of effectNames) {
  const unifiedEffect = unifiedByName.get(effectName) || {};
  const coverageEffect = coverageByName.get(effectName) || {};
  const registryEffect = registry?.effects?.[effectName] || {};
  const interactionEffect = interactionByName.get(effectName) || {};
  const manifests = listManifestsForEffect(effectName);
  const screeningRecords = listScreeningRecordsForEffect(effectName);

  const artifact = {
    artifactType: "effect_training_dossier_v1",
    artifactVersion: "1.0",
    generatedAt: new Date().toISOString(),
    status: "transitional_current_evidence",
    effectName,
    family: str(coverageEffect.family || unifiedEffect?.capability?.family),
    intentSurface: {
      supportedSettingsIntent: Array.isArray(coverageEffect.supportedSettingsIntent) ? coverageEffect.supportedSettingsIntent : [],
      supportedPaletteIntent: Array.isArray(unifiedEffect?.capability?.supportedPaletteIntent) ? unifiedEffect.capability.supportedPaletteIntent : [],
      supportedLayerIntent: Array.isArray(unifiedEffect?.capability?.supportedLayerIntent) ? unifiedEffect.capability.supportedLayerIntent : [],
      supportedRenderIntent: Array.isArray(unifiedEffect?.capability?.supportedRenderIntent) ? unifiedEffect.capability.supportedRenderIntent : []
    },
    currentCoverage: {
      coverageStatus: str(coverageEffect.coverageStatus || unifiedEffect?.parameterLearning?.coverageStatus),
      exhaustiveSettingCoverage: Boolean(coverageEffect.exhaustiveSettingCoverage),
      registryParameterNames: Array.isArray(coverageEffect.registryParameterNames) ? coverageEffect.registryParameterNames : [],
      retainedParameterNames: Array.isArray(coverageEffect.retainedParameterNames) ? coverageEffect.retainedParameterNames : [],
      screenedParameterNames: Array.isArray(coverageEffect.screenedParameterNames) ? coverageEffect.screenedParameterNames : [],
      screeningRecordCount: screeningRecords.length
    },
    upstreamMetadata: {
      sourceFile: str(registryEffect.upstreamSourceFile),
      propertyCount: Number(registryEffect.upstreamPropertyCount || 0),
      visibilityRuleCount: Number(registryEffect.upstreamVisibilityRuleCount || 0),
      parameters: Object.fromEntries(
        Object.entries(registryEffect.parameters || {}).map(([parameterName, meta]) => [
          parameterName,
          {
            upstreamId: str(meta?.upstream?.id),
            label: str(meta?.upstream?.label),
            description: str(meta?.upstream?.description),
            default: meta?.upstream?.default,
            min: meta?.upstream?.min ?? null,
            max: meta?.upstream?.max ?? null,
            options: Array.isArray(meta?.upstream?.options) ? meta.upstream.options : []
          }
        ])
      )
    },
    registryDefinition: registryEffect,
    interactionCoverage: {
      requiresInteractionCoverage: Boolean(interactionEffect.requiresInteractionCoverage),
      hasInteractionCoverage: Boolean(interactionEffect.hasInteractionCoverage),
      interactionCoverageStatus: str(interactionEffect.interactionCoverageStatus),
      interactionGeometries: Array.isArray(interactionEffect.interactionGeometries) ? interactionEffect.interactionGeometries : [],
      interactionManifestNames: Array.isArray(interactionEffect.interactionManifestNames) ? interactionEffect.interactionManifestNames : []
    },
    manifestIndex: {
      expandedSweep: manifests.expandedSweep,
      range: manifests.range,
      combos: manifests.combos,
      interactions: manifests.interactions,
      all: manifests.all
    },
    evidenceIndex: {
      screeningRecords: screeningRecords,
      screeningRecordPaths: screeningRecords.map((name) => join(recordsDir, name))
    },
    currentTrainingReference: unifiedEffect
  };

  const outPath = join(outputDir, `${slug(effectName)}.json`);
  writeFileSync(outPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  outputFiles.push(outPath);
}

  const summary = {
  artifactType: "effect_training_dossier_index_v1",
  artifactVersion: "1.0",
  generatedAt: new Date().toISOString(),
  effectCount: outputFiles.length,
  outputDir,
  unifiedPath,
  coveragePath,
  interactionCoveragePath,
  registryPath,
  effects: effectNames.map((effectName) => ({
    effectName,
    fileName: `${slug(effectName)}.json`
  }))
};
writeFileSync(join(outputDir, "index.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  ok: true,
  artifactType: summary.artifactType,
  outputDir,
  effectCount: outputFiles.length
}, null, 2));
