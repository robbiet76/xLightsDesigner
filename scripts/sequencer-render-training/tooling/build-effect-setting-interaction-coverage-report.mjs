import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";

function str(value = "") {
  return String(value || "").trim();
}

function normalize(value = "") {
  return str(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

const automationPlanPath = process.argv[2]
  ? resolve(process.argv[2])
  : resolve("scripts/sequencer-render-training/catalog/effect-training-automation-plan-v1.json");
const outputPath = process.argv[3]
  ? resolve(process.argv[3])
  : resolve("scripts/sequencer-render-training/catalog/effect-setting-interaction-coverage-report-v1.json");
const manifestsDir = resolve("scripts/sequencer-render-training/manifests");

const automationPlan = JSON.parse(readFileSync(automationPlanPath, "utf8"));

const runnableStatuses = new Set([
  "ready_for_parameter_screening",
  "ready_for_expansion",
  "screened_current_registry"
]);

function listInteractionManifests() {
  return readdirSync(manifestsDir)
    .filter((name) => name.endsWith("-interactions-v1.json"))
    .sort((a, b) => a.localeCompare(b));
}

function parseInteractionManifestName(name = "") {
  const base = basename(name, ".json");
  const stem = base.replace(/-interactions-v1$/, "");
  const parts = stem.split("-").filter(Boolean);
  return {
    effectKey: parts[0] || "",
    geometryKey: parts.slice(1).join("-") || "unknown"
  };
}

const planEffects = Array.isArray(automationPlan?.effects) ? automationPlan.effects : [];
const effects = planEffects.map((row) => ({
  effectName: str(row.effectName),
  readiness: str(row.readiness),
  coverageStatus: str(row.coverageStatus),
  requiresInteractionCoverage: runnableStatuses.has(str(row.readiness))
}));

const byNormalizedEffect = new Map(effects.map((row) => [normalize(row.effectName), row]));
const interactionManifests = listInteractionManifests();
const effectCoverage = new Map();
for (const manifestName of interactionManifests) {
  const parsed = parseInteractionManifestName(manifestName);
  const key = normalize(parsed.effectKey);
  const current = effectCoverage.get(key) || { manifestNames: [], geometryKeys: new Set() };
  current.manifestNames.push(manifestName);
  current.geometryKeys.add(parsed.geometryKey);
  effectCoverage.set(key, current);
}

const reportEffects = effects.map((row) => {
  const coverage = effectCoverage.get(normalize(row.effectName)) || { manifestNames: [], geometryKeys: new Set() };
  return {
    effectName: row.effectName,
    readiness: row.readiness,
    coverageStatus: row.coverageStatus,
    requiresInteractionCoverage: row.requiresInteractionCoverage,
    interactionManifestCount: coverage.manifestNames.length,
    interactionGeometries: [...coverage.geometryKeys].sort((a, b) => a.localeCompare(b)),
    interactionManifestNames: coverage.manifestNames.slice().sort((a, b) => a.localeCompare(b)),
    hasInteractionCoverage: coverage.manifestNames.length > 0,
    interactionCoverageStatus: row.requiresInteractionCoverage
      ? (coverage.manifestNames.length > 0 ? "present" : "missing")
      : (coverage.manifestNames.length > 0 ? "present_not_required" : "not_required")
  };
});

const runnableEffects = reportEffects.filter((row) => row.requiresInteractionCoverage);
const missingCoverage = runnableEffects.filter((row) => !row.hasInteractionCoverage);

const report = {
  artifactType: "effect_setting_interaction_coverage_report_v1",
  artifactVersion: "1.0",
  generatedAt: new Date().toISOString(),
  sourceAutomationPlan: automationPlanPath,
  sourceManifestDirectory: manifestsDir,
  summary: {
    effectCount: reportEffects.length,
    runnableEffectCount: runnableEffects.length,
    totalInteractionManifestCount: interactionManifests.length,
    effectsWithInteractionCoverageCount: reportEffects.filter((row) => row.hasInteractionCoverage).length,
    missingInteractionCoverageCount: missingCoverage.length,
    interactionCoverageReady: missingCoverage.length === 0 && runnableEffects.length > 0
  },
  missingCoverageEffects: missingCoverage.map((row) => row.effectName).sort((a, b) => a.localeCompare(b)),
  effects: reportEffects.sort((a, b) => a.effectName.localeCompare(b.effectName))
};

writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  ok: true,
  output: outputPath,
  artifactType: report.artifactType,
  missingInteractionCoverageCount: report.summary.missingInteractionCoverageCount,
  totalInteractionManifestCount: report.summary.totalInteractionManifestCount
}, null, 2));
