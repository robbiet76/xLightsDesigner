import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const dossierDir = process.argv[2]
  ? resolve(process.argv[2])
  : resolve("scripts/sequencer-render-training/catalog/effect-training-dossiers");
const outputPath = process.argv[3]
  ? resolve(process.argv[3])
  : resolve(join(dossierDir, "effect-training-learnings-summary.md"));

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

const files = readdirSync(dossierDir)
  .filter((name) => name.endsWith(".json") && name !== "index.json")
  .sort((a, b) => a.localeCompare(b));

const rows = files.map((name) => readJson(join(dossierDir, name)));

function list(values = []) {
  return values.length ? values.join(", ") : "none";
}

function bulletList(values = [], indent = "") {
  return values.length ? values.map((value) => `${indent}- ${value}\n`).join("") : `${indent}- none\n`;
}

function describeParameter(name, definition = {}) {
  const anchors = list(definition.anchors || []);
  const hypotheses = list(definition.interactionHypotheses || []);
  const range =
    definition.range && typeof definition.range === "object"
      ? `${definition.range.min}..${definition.range.max}`
      : "n/a";
  return `${name}: type=${definition.type || "unknown"} range=${range} anchors=${anchors} importance=${definition.importance || "unknown"} phase=${definition.phase || "unknown"} practicalPriority=${definition.practicalPriority || "unknown"} interactions=${hypotheses}`;
}

let md = "# Effect Training Learnings Summary\n\n";
md += `Generated: ${new Date().toISOString()}\n\n`;
md += `Effect count: ${rows.length}\n\n`;
for (const row of rows) {
  const coverage = row.currentCoverage || {};
  const interactions = row.interactionCoverage || {};
  const baseline = row.currentTrainingReference?.baseline || {};
  const capability = row.currentTrainingReference?.capability || {};
  const parameterLearning = row.currentTrainingReference?.parameterLearning || {};
  const screeningLearning = row.currentTrainingReference?.screeningLearning || {};
  const liveOutcomeLearning = row.currentTrainingReference?.liveOutcomeLearning || {};
  const selectorEvidence = baseline.selectorEvidence || {};
  const roleOutcomeMemory = liveOutcomeLearning.roleOutcomeMemory || {};
  const registryNotes = row.registryDefinition?.notes || "";
  md += `## ${row.effectName}\n\n`;
  md += `- Family: ${row.family || "unknown"}\n`;
  md += `- Registry complexity: ${row.registryDefinition?.complexityClass || "unknown"}\n`;
  md += `- Early sampling policy: ${row.registryDefinition?.earlySamplingPolicy || "unknown"}\n`;
  md += `- Coverage status: ${coverage.coverageStatus || "unknown"}\n`;
  md += `- Screening records: ${coverage.screeningRecordCount ?? 0}\n`;
  md += `- Selector-ready stage: ${baseline.currentStage || "unknown"}\n`;
  md += `- Selector evidence: selected=${selectorEvidence.selectedCaseCount ?? 0} passed=${selectorEvidence.passedCaseCount ?? 0} cases=${list(selectorEvidence.caseIds || [])}\n`;
  md += `\n### Capability Surface\n\n`;
  md += `- Supported model types: ${list(baseline.supportedModelTypes || [])}\n`;
  md += `- Supported geometry profiles: ${list(baseline.supportedGeometryProfiles || [])}\n`;
  md += `- Baseline intent tags: ${list(baseline.intentTags || [])}\n`;
  md += `- Baseline pattern families: ${list(baseline.patternFamilies || [])}\n`;
  md += `- Supported settings intent: ${list(capability.supportedSettingsIntent || row.intentSurface?.supportedSettingsIntent || [])}\n`;
  md += `- Supported palette intent: ${list(capability.supportedPaletteIntent || row.intentSurface?.supportedPaletteIntent || [])}\n`;
  md += `- Supported layer intent: ${list(capability.supportedLayerIntent || row.intentSurface?.supportedLayerIntent || [])}\n`;
  md += `- Supported render intent: ${list(capability.supportedRenderIntent || row.intentSurface?.supportedRenderIntent || [])}\n`;
  md += `\n### Parameter Semantics\n\n`;
  md += `- Registry parameters: ${list(coverage.registryParameterNames || [])}\n`;
  md += `- Retained parameters: ${list(coverage.retainedParameterNames || [])}\n`;
  md += `- Screened parameters: ${list(coverage.screenedParameterNames || [])}\n`;
  md += `- Derived priors: ${parameterLearning.derivedPriors?.status || "unknown"} count=${parameterLearning.derivedPriors?.priorCount ?? 0}\n`;
  md += `- Supported intent axes:\n`;
  md += bulletList(parameterLearning.supportedIntentAxes?.settings || [], "  ");
  md += `- Registry parameter definitions:\n`;
  const parameterDefinitions = Object.entries(row.registryDefinition?.parameters || {}).map(([name, definition]) =>
    describeParameter(name, definition),
  );
  md += bulletList(parameterDefinitions, "  ");
  md += `\n### Interaction Semantics\n\n`;
  md += `- Interaction coverage: ${interactions.interactionCoverageStatus || "unknown"}\n`;
  md += `- Interaction geometries: ${list(interactions.interactionGeometries || [])}\n`;
  md += `- Interaction manifests: ${list(interactions.interactionManifestNames || [])}\n`;
  md += `\n### Screening Evidence\n\n`;
  md += `- Screening learning status: ${screeningLearning.status || "unknown"}\n`;
  md += `- Sampled model types: ${list(screeningLearning.sampledModelTypes || [])}\n`;
  md += `- Sampled geometry profiles: ${list(screeningLearning.sampledGeometryProfiles || [])}\n`;
  md += `- Observed label hints: ${list(screeningLearning.observedLabelHints || [])}\n`;
  md += `- Configuration representativeness: ${screeningLearning.configurationRepresentativeness?.coverageStatus || "unknown"} profiles=${screeningLearning.configurationRepresentativeness?.profileCount ?? 0}\n`;
  md += `\n### Outcome Learning\n\n`;
  md += `- Outcome learning status: ${liveOutcomeLearning.status || "unknown"}\n`;
  md += `- Outcome record count: ${liveOutcomeLearning.outcomeRecordCount ?? 0}\n`;
  md += `- Seed role priors: ${list((liveOutcomeLearning.seedRolePriors || []).map((item) => `${item.role}:${item.priority}`))}\n`;
  md += `- Role outcome memory:\n`;
  const roleLines = Object.entries(roleOutcomeMemory).map(
    ([role, value]) =>
      `${role}: samples=${value.sampleCount ?? 0} success=${value.successfulUses ?? 0} failed=${value.failedUses ?? 0} favoredSignals=${list(value.favoredSignals || [])} cautionSignals=${list(value.cautionSignals || [])}`,
  );
  md += bulletList(roleLines, "  ");
  if (registryNotes) {
    md += `\n### Notes\n\n`;
    md += `- Registry notes: ${registryNotes}\n`;
  }
  md += `\n`;
}

writeFileSync(outputPath, md, "utf8");
console.log(JSON.stringify({ ok: true, output: outputPath, effectCount: rows.length }, null, 2));
