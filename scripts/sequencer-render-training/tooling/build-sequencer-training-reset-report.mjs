import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function parseArgs(argv = []) {
  const args = {
    settingsCoverage: "",
    automationPlan: "",
    screeningPlan: "",
    interactionCoverage: "",
    harvestSummary: "",
    output: resolve("scripts/sequencer-render-training/catalog/sequencer-training-reset-report-v1.json")
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = String(argv[i] || "").trim();
    if (arg === "--settings-coverage") args.settingsCoverage = resolve(String(argv[i + 1] || "").trim());
    if (arg === "--automation-plan") args.automationPlan = resolve(String(argv[i + 1] || "").trim());
    if (arg === "--screening-plan") args.screeningPlan = resolve(String(argv[i + 1] || "").trim());
    if (arg === "--interaction-coverage") args.interactionCoverage = resolve(String(argv[i + 1] || "").trim());
    if (arg === "--harvest-summary") args.harvestSummary = resolve(String(argv[i + 1] || "").trim());
    if (arg === "--output") args.output = resolve(String(argv[i + 1] || "").trim());
  }
  return args;
}

function loadJson(path = "") {
  return path ? JSON.parse(readFileSync(path, "utf8")) : null;
}

const args = parseArgs(process.argv.slice(2));
const settingsCoverage = loadJson(args.settingsCoverage);
const automationPlan = loadJson(args.automationPlan);
const screeningPlan = loadJson(args.screeningPlan);
const interactionCoverage = loadJson(args.interactionCoverage);
const harvestSummary = args.harvestSummary && existsSync(args.harvestSummary)
  ? loadJson(args.harvestSummary)
  : null;

const interactionRecordGeneratorPresent = existsSync(resolve("scripts/sequencer-render-training/tooling/build-parameter-interaction-semantics-records.mjs"));
const behaviorRecordGeneratorPresent = existsSync(resolve("scripts/sequencer-render-training/tooling/build-behavior-capability-records.mjs"));
const parameterRecordGeneratorPresent = existsSync(resolve("scripts/sequencer-render-training/tooling/build-parameter-semantics-records.mjs"));
const sharedSettingRecordGeneratorPresent = existsSync(resolve("scripts/sequencer-render-training/tooling/build-shared-setting-semantics-records.mjs"));

const blockers = [];
if (!interactionCoverage?.summary?.interactionCoverageReady) blockers.push("interaction_coverage_incomplete");
if (!interactionRecordGeneratorPresent) blockers.push("missing_parameter_interaction_record_generator");
if (!behaviorRecordGeneratorPresent) blockers.push("missing_behavior_record_generator");
if (!parameterRecordGeneratorPresent) blockers.push("missing_parameter_record_generator");
if (!sharedSettingRecordGeneratorPresent) blockers.push("missing_shared_setting_record_generator");

const report = {
  artifactType: "sequencer_training_reset_report_v1",
  artifactVersion: "1.0",
  generatedAt: new Date().toISOString(),
  inputs: {
    settingsCoverage: args.settingsCoverage,
    automationPlan: args.automationPlan,
    screeningPlan: args.screeningPlan,
    interactionCoverage: args.interactionCoverage,
    harvestSummary: harvestSummary ? args.harvestSummary : ""
  },
  summary: {
    effectCount: settingsCoverage?.summary?.effectCount || 0,
    runnableEffectCount: automationPlan?.summary?.runnableNowCount || 0,
    screeningManifestCount: screeningPlan?.summary?.manifestCount || 0,
    interactionManifestCount: interactionCoverage?.summary?.totalInteractionManifestCount || 0,
    harvestedRecordCount: harvestSummary?.copiedCount || 0,
    interactionCoverageReady: Boolean(interactionCoverage?.summary?.interactionCoverageReady),
    recordGeneratorsReady: behaviorRecordGeneratorPresent && parameterRecordGeneratorPresent && sharedSettingRecordGeneratorPresent && interactionRecordGeneratorPresent,
    cleanRegenerationAllowed: blockers.length === 0
  },
  generatorStatus: {
    behaviorRecordGeneratorPresent,
    parameterRecordGeneratorPresent,
    sharedSettingRecordGeneratorPresent,
    interactionRecordGeneratorPresent
  },
  blockers,
  notes: [
    "This report is the unattended regeneration gate summary.",
    "A clean regeneration run remains blocked until interaction-aware record generators exist and interaction coverage is complete."
  ]
};

writeFileSync(args.output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  ok: true,
  output: args.output,
  artifactType: report.artifactType,
  cleanRegenerationAllowed: report.summary.cleanRegenerationAllowed,
  blockerCount: report.blockers.length
}, null, 2));
