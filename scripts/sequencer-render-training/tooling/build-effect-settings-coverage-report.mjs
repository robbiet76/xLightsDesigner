import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { getStage1TrainedEffectBundle } from "../../../apps/xlightsdesigner-ui/agent/sequence-agent/trained-effect-knowledge.js";
import { listEffectIntentCapabilities } from "../../../apps/xlightsdesigner-ui/agent/sequence-agent/effect-intent-capabilities.js";

const bundle = getStage1TrainedEffectBundle();
const capabilities = listEffectIntentCapabilities();

function str(value = "") {
  return String(value || "").trim();
}

function classifyCoverage({ capability = {}, parameterLearning = {} } = {}) {
  const unifiedStatus = str(parameterLearning.coverageStatus);
  if (unifiedStatus) return unifiedStatus;
  const supportedSettingsIntent = Array.isArray(capability?.supportedSettingsIntent) ? capability.supportedSettingsIntent : [];
  return supportedSettingsIntent.length ? "intent_translatable_only" : "family_only";
}

const byName = new Map(capabilities.map((row) => [str(row.effectName), row]));
const effectNames = [...new Set([
  ...Object.keys(bundle?.effectsByName || {}),
  ...capabilities.map((row) => str(row.effectName))
])].filter(Boolean).sort((a, b) => a.localeCompare(b));

const unified = JSON.parse(
  readFileSync(resolve("scripts/sequencer-render-training/catalog/sequencer-unified-training-set-v1.json"), "utf8")
);

const unifiedByName = new Map((Array.isArray(unified?.effects) ? unified.effects : []).map((row) => [str(row.effectName), row]));

const summary = {
  effectCount: effectNames.length,
  screenedParameterSubsetCount: 0,
  registryDefinedNotScreenedCount: 0,
  intentTranslatableOnlyCount: 0,
  familyOnlyCount: 0,
  exhaustiveSettingCoverage: false
};

const effects = effectNames.map((effectName) => {
  const unifiedEffect = unifiedByName.get(effectName) || {};
  const capability = byName.get(effectName) || {};
  const parameterLearning = unifiedEffect.parameterLearning || {};
  const coverageStatus = classifyCoverage({ capability, parameterLearning });
  if (coverageStatus === "screened_parameter_subset") summary.screenedParameterSubsetCount += 1;
  else if (coverageStatus === "registry_defined_not_screened") summary.registryDefinedNotScreenedCount += 1;
  else if (coverageStatus === "intent_translatable_only") summary.intentTranslatableOnlyCount += 1;
  else summary.familyOnlyCount += 1;
  return {
    effectName,
    family: str(capability.family),
    coverageStatus,
    supportedSettingsIntent: Array.isArray(capability.supportedSettingsIntent) ? capability.supportedSettingsIntent : [],
    registryParameterNames: Array.isArray(parameterLearning.registryParameterNames) ? parameterLearning.registryParameterNames : [],
    retainedParameterNames: Array.isArray(parameterLearning.retainedParameterNames) ? parameterLearning.retainedParameterNames : [],
    exhaustiveSettingCoverage: false
  };
});

const report = {
  artifactType: "effect_settings_coverage_report_v1",
  artifactVersion: "1.0",
  generatedAt: new Date().toISOString(),
  summary,
  effects
};

const outputPath = process.argv[2]
  ? resolve(process.argv[2])
  : resolve("scripts/sequencer-render-training/catalog/effect-settings-coverage-report-v1.json");

writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  ok: true,
  output: outputPath,
  artifactType: report.artifactType,
  effectCount: report.summary.effectCount
}, null, 2));
