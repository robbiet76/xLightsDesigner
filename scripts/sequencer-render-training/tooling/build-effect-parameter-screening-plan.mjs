import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve, join } from "node:path";

function str(value = "") {
  return String(value || "").trim();
}

const automationPlan = JSON.parse(
  readFileSync(resolve("scripts/sequencer-render-training/catalog/effect-training-automation-plan-v1.json"), "utf8")
);
const unified = JSON.parse(
  readFileSync(resolve("scripts/sequencer-render-training/catalog/sequencer-unified-training-set-v1.json"), "utf8")
);
const registry = JSON.parse(
  readFileSync(resolve("scripts/sequencer-render-training/catalog/effect-parameter-registry.json"), "utf8")
);

const manifestsDir = resolve("scripts/sequencer-render-training/manifests");
const generatedDir = resolve("scripts/sequencer-render-training/manifests/generated/effect-parameter-screening");

function listExpandedBaseManifests(effectName = "") {
  const prefix = `${str(effectName).toLowerCase().replaceAll(" ", "")}-`;
  return readdirSync(manifestsDir)
    .filter((name) => name.toLowerCase().startsWith(prefix) && name.includes("expanded-sweep") && name.endsWith(".json"))
    .sort((a, b) => a.localeCompare(b))
    .map((name) => join(manifestsDir, name));
}

function listRunnableEffects() {
  return (Array.isArray(automationPlan?.effects) ? automationPlan.effects : [])
    .filter((row) => row?.readiness === "ready_for_parameter_screening" || row?.readiness === "ready_for_expansion")
    .map((row) => str(row.effectName))
    .filter(Boolean);
}

const unifiedByName = new Map((Array.isArray(unified?.effects) ? unified.effects : []).map((row) => [str(row.effectName), row]));

function listRegistryParameters(effectName = "") {
  const effectRegistry = registry?.effects?.[str(effectName)];
  const params = effectRegistry && typeof effectRegistry.parameters === "object" ? effectRegistry.parameters : {};
  return Object.entries(params)
    .map(([parameterName, meta]) => ({
      parameterName,
      practicalPriority: str(meta?.practicalPriority || meta?.importance || "medium"),
      phase: str(meta?.phase || "screen"),
      target: str(meta?.target || "effectSettings")
    }))
    .sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return (order[a.practicalPriority] ?? 9) - (order[b.practicalPriority] ?? 9) || a.parameterName.localeCompare(b.parameterName);
    });
}

function buildRows() {
  const rows = [];
  for (const effectName of listRunnableEffects()) {
    const baseManifests = listExpandedBaseManifests(effectName);
    const effectEntry = unifiedByName.get(effectName) || {};
    const coveredParameters = new Set([
      ...(Array.isArray(effectEntry?.parameterLearning?.retainedParameterNames) ? effectEntry.parameterLearning.retainedParameterNames : []),
      ...(Array.isArray(effectEntry?.parameterLearning?.screenedParameterNames) ? effectEntry.parameterLearning.screenedParameterNames : [])
    ].map((row) => str(row)));
    const parameters = listRegistryParameters(effectName)
      .filter((row) => !coveredParameters.has(str(row.parameterName)));
    for (const baseManifestPath of baseManifests) {
      const baseManifestName = basename(baseManifestPath, ".json");
      for (const parameter of parameters) {
        rows.push({
          effectName,
          baseManifestPath,
          baseManifestName,
          parameterName: parameter.parameterName,
          practicalPriority: parameter.practicalPriority,
          phase: parameter.phase,
          target: parameter.target,
          generatedManifestPath: join(
            generatedDir,
            `${baseManifestName}-${parameter.parameterName}.generated.json`
          )
        });
      }
    }
  }
  return rows;
}

const rows = buildRows();
const artifact = {
  artifactType: "effect_parameter_screening_plan_v1",
  artifactVersion: "1.0",
  generatedAt: new Date().toISOString(),
  summary: {
    effectCount: [...new Set(rows.map((row) => row.effectName))].length,
    manifestCount: rows.length,
    runnableEffects: listRunnableEffects()
  },
  rows
};

const outputPath = process.argv[2]
  ? resolve(process.argv[2])
  : resolve("scripts/sequencer-render-training/catalog/effect-parameter-screening-plan-v1.json");

writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  ok: true,
  output: outputPath,
  artifactType: artifact.artifactType,
  manifestCount: artifact.summary.manifestCount
}, null, 2));
