import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function str(value = "") {
  return String(value || "").trim();
}

const unified = JSON.parse(
  readFileSync(resolve("scripts/sequencer-render-training/catalog/sequencer-unified-training-set-v1.json"), "utf8")
);
const coverage = JSON.parse(
  readFileSync(resolve("scripts/sequencer-render-training/catalog/effect-settings-coverage-report-v1.json"), "utf8")
);

const unifiedByName = new Map((Array.isArray(unified?.effects) ? unified.effects : []).map((row) => [str(row.effectName), row]));

function classifyReadiness(row = {}) {
  const status = str(row.coverageStatus);
  const registryCount = Array.isArray(row.registryParameterNames) ? row.registryParameterNames.length : 0;
  const coveredCount = new Set([
    ...(Array.isArray(row.retainedParameterNames) ? row.retainedParameterNames : []),
    ...(Array.isArray(row.screenedParameterNames) ? row.screenedParameterNames : [])
  ]).size;
  if (status === "registry_defined_not_screened") return "ready_for_parameter_screening";
  if (status === "screened_parameter_subset" && coveredCount < registryCount) return "ready_for_expansion";
  if (status === "screened_parameter_subset" && coveredCount >= registryCount && registryCount > 0) return "screened_current_registry";
  return "needs_registry";
}

function classifyPriority(row = {}) {
  const readiness = classifyReadiness(row);
  if (readiness === "ready_for_parameter_screening") return "now";
  if (readiness === "ready_for_expansion") return "later";
  if (readiness === "screened_current_registry") return "later";
  return "blocked";
}

function classifyNextAction(row = {}) {
  const readiness = classifyReadiness(row);
  if (readiness === "ready_for_parameter_screening") return "generate_parameter_sweeps";
  if (readiness === "ready_for_expansion") return "deepen_screened_subset";
  if (readiness === "screened_current_registry") return "harvest_outcomes_or_add_interactions";
  return "author_registry_and_base_manifests";
}

const effects = (Array.isArray(coverage?.effects) ? coverage.effects : []).map((row) => {
  const effectName = str(row.effectName);
  const unifiedRow = unifiedByName.get(effectName) || {};
  return {
    effectName,
    family: str(row.family),
    coverageStatus: str(row.coverageStatus),
    readiness: classifyReadiness(row),
    priority: classifyPriority(row),
    nextAction: classifyNextAction(row),
    registryParameterCount: Array.isArray(row.registryParameterNames) ? row.registryParameterNames.length : 0,
    retainedParameterCount: Array.isArray(row.retainedParameterNames) ? row.retainedParameterNames.length : 0,
    screenedParameterCount: Array.isArray(row.screenedParameterNames) ? row.screenedParameterNames.length : 0,
    outcomeRecordCount: Number(unifiedRow?.liveOutcomeLearning?.outcomeRecordCount || 0)
  };
});

const byPriority = { now: 0, later: 0, blocked: 0 };
for (const row of effects) byPriority[row.priority] += 1;

const artifact = {
  artifactType: "effect_training_automation_plan_v1",
  artifactVersion: "1.0",
  generatedAt: new Date().toISOString(),
  summary: {
    effectCount: effects.length,
    runnableNowCount: byPriority.now,
    runnableLaterCount: byPriority.later,
    blockedCount: byPriority.blocked
  },
  orderingRule: [
    "ready_for_parameter_screening",
    "ready_for_expansion",
    "needs_registry"
  ],
  effects: effects.sort((a, b) => {
    const p = { now: 0, later: 1, blocked: 2 };
    return p[a.priority] - p[b.priority] || a.effectName.localeCompare(b.effectName);
  })
};

const outputPath = process.argv[2]
  ? resolve(process.argv[2])
  : resolve("scripts/sequencer-render-training/catalog/effect-training-automation-plan-v1.json");

writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  ok: true,
  output: outputPath,
  artifactType: artifact.artifactType,
  runnableNowCount: artifact.summary.runnableNowCount
}, null, 2));
