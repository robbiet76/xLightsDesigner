#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 ? String(process.argv[index + 1] || "").trim() : fallback;
}

function normText(value = "") {
  return String(value || "").trim();
}

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function listJsonFiles(dirPath) {
  if (!dirPath || !existsSync(dirPath)) return [];
  const out = [];
  for (const name of readdirSync(dirPath)) {
    const fullPath = join(dirPath, name);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) out.push(...listJsonFiles(fullPath));
    else if (name.endsWith(".json")) out.push(fullPath);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

function listRecordFiles(dirPath) {
  return listJsonFiles(dirPath).filter((filePath) => basename(filePath).endsWith(".record.json"));
}

function hasPathSegment(filePath = "", segment = "") {
  return String(filePath || "").split(/[\\/]+/).includes(segment);
}

function sampleIdFromExistingRecord(filePath = "", record = null) {
  const explicit = normText(record?.sampleId);
  if (explicit) return explicit;
  return basename(filePath).replace(/\.record\.json$/, "");
}

function loadRecordRows(runRoot) {
  return listRecordFiles(runRoot)
    .filter((filePath) => !hasPathSegment(filePath, "staging"))
    .map((filePath) => {
      const record = compactRecord(readJson(filePath, null));
      if (!record || record.recordVersion !== "1.0") return null;
      return {
        filePath,
        sampleId: normText(record.sampleId),
        effectName: normText(record.effectName),
        status: "recorded",
        blank: Array.isArray(record?.observations?.labels) && record.observations.labels.includes("blank_sampled_frame"),
        labels: Array.isArray(record?.observations?.labels) ? record.observations.labels : [],
        record
      };
    })
    .filter(Boolean);
}

function compactRecord(record = null) {
  if (!record || record.recordVersion !== "1.0") return record;
  return {
    recordVersion: record.recordVersion,
    sampleId: record.sampleId,
    effectName: record.effectName,
    observations: record.observations || {},
    trainingContext: record.trainingContext || {},
    sharedSettings: record.sharedSettings || {}
  };
}

function loadExistingSampleIds(existingRecordsDir) {
  const ids = new Set();
  for (const filePath of listRecordFiles(existingRecordsDir)) {
    const record = readJson(filePath, null);
    const sampleId = sampleIdFromExistingRecord(filePath, record);
    if (sampleId) ids.add(sampleId);
  }
  return ids;
}

function collectRunSummaries(runRoot) {
  return listJsonFiles(runRoot)
    .filter((filePath) => basename(filePath) === "run-summary.json")
    .map((filePath) => readJson(filePath, null))
    .filter(Boolean);
}

function countBehaviorDimensions(trainingSet = {}) {
  const priors = [];
  for (const effect of Array.isArray(trainingSet?.effects) ? trainingSet.effects : []) {
    for (const prior of Array.isArray(effect?.parameterLearning?.derivedPriors?.priors) ? effect.parameterLearning.derivedPriors.priors : []) {
      priors.push({ effectName: effect.effectName, prior });
    }
  }
  let behaviorRuleCount = 0;
  let priorsWithRules = 0;
  let flatOrInconclusivePriorCount = 0;
  const ruleRows = [];
  const byPalette = new Map();
  const ensurePalette = (paletteMode = "") => {
    const key = normText(paletteMode) || "default";
    if (!byPalette.has(key)) {
      byPalette.set(key, {
        paletteMode: key,
        derivedPriorCount: 0,
        priorsWithRules: 0,
        behaviorRuleCount: 0,
        flatOrInconclusivePriorCount: 0
      });
    }
    return byPalette.get(key);
  };
  for (const { effectName, prior } of priors) {
    const rules = Array.isArray(prior?.behaviorDimensions?.behaviorRules) ? prior.behaviorDimensions.behaviorRules : [];
    const paletteSummary = ensurePalette(prior?.paletteMode);
    paletteSummary.derivedPriorCount += 1;
    behaviorRuleCount += rules.length;
    paletteSummary.behaviorRuleCount += rules.length;
    if (rules.length) {
      priorsWithRules += 1;
      paletteSummary.priorsWithRules += 1;
      for (const rule of rules) {
        ruleRows.push({
          effectName,
          parameterName: normText(prior.parameterName),
          geometryProfile: normText(prior.geometryProfile),
          paletteMode: normText(prior.paletteMode),
          dimension: normText(rule.dimension),
          direction: normText(rule.direction),
          magnitude: Number(rule.magnitude || 0),
          summary: normText(rule.summary)
        });
      }
    } else {
      flatOrInconclusivePriorCount += 1;
      paletteSummary.flatOrInconclusivePriorCount += 1;
    }
  }
  return {
    derivedPriorCount: priors.length,
    priorsWithRules,
    behaviorRuleCount,
    flatOrInconclusivePriorCount,
    byPalette: [...byPalette.values()].sort((a, b) => a.paletteMode.localeCompare(b.paletteMode)),
    topBehaviorRules: ruleRows
      .sort((a, b) => b.magnitude - a.magnitude || a.summary.localeCompare(b.summary))
      .slice(0, 25)
  };
}

function paletteRepresentativeClass(paletteMode = "") {
  const value = normText(paletteMode);
  if (value === "mono_white") return "single_color_representative";
  if (value === "rgb_primary") return "multi_color_representative";
  return value ? "custom_palette_mode" : "default";
}

const runRoot = resolve(argValue("--run-root", "."));
const trainingSetPath = argValue("--training-set", "");
const existingRecordsDir = resolve(argValue("--existing-records-dir", "scripts/sequencer-render-training/catalog/effect-screening-records"));
const outPath = resolve(argValue("--out", join(runRoot, "learning-gate.json")));

const records = loadRecordRows(runRoot);
const existingSampleIds = loadExistingSampleIds(existingRecordsDir);
const runSummaries = collectRunSummaries(runRoot);
const trainingSet = trainingSetPath ? readJson(resolve(trainingSetPath), {}) : {};
const behavior = countBehaviorDimensions(trainingSet);
const recordPaletteCounts = new Map();
for (const row of records) {
  const paletteMode = normText(row.record?.trainingContext?.screeningPaletteMode)
    || normText(row.record?.trainingContext?.trainingPaletteStandard)
    || normText(row.record?.sharedSettings?.paletteProfile)
    || "default";
  recordPaletteCounts.set(paletteMode, (recordPaletteCounts.get(paletteMode) || 0) + 1);
}
const requiredPaletteModes = [...new Set([
  ...recordPaletteCounts.keys(),
  ...behavior.byPalette.map((row) => row.paletteMode)
])].filter(Boolean).sort((a, b) => a.localeCompare(b));

const totalPackCount = runSummaries.length;
const passedSampleCount = runSummaries.reduce((sum, row) => sum + Number(row.passedSamples || 0), 0);
const failedSampleCount = runSummaries.reduce((sum, row) => sum + Number(row.failedSamples || 0), 0);
const blankRecordCount = records.filter((row) => row.blank).length;
const newSampleIds = records.map((row) => row.sampleId).filter((id) => id && !existingSampleIds.has(id));
const existingSampleIdCount = records.filter((row) => row.sampleId && existingSampleIds.has(row.sampleId)).length;

const blockers = [];
if (failedSampleCount > 0) blockers.push("sample_failures_present");
if (!records.length) blockers.push("no_screening_records");
if (records.length && blankRecordCount / records.length > 0.25) blockers.push("blank_record_share_too_high");
if (behavior.derivedPriorCount === 0) blockers.push("no_derived_parameter_priors");
if (behavior.behaviorRuleCount === 0) blockers.push("no_generalized_behavior_rules");
for (const paletteMode of requiredPaletteModes) {
  const paletteBehavior = behavior.byPalette.find((row) => row.paletteMode === paletteMode);
  if (!paletteBehavior || paletteBehavior.derivedPriorCount === 0) blockers.push(`palette_${paletteMode}_has_no_derived_priors`);
  else if (paletteBehavior.behaviorRuleCount === 0) blockers.push(`palette_${paletteMode}_has_no_generalized_behavior_rules`);
}
if (records.length && !newSampleIds.length) blockers.push("no_new_sample_ids");

const report = {
  artifactType: "effects_usage_learning_gate_v1",
  artifactVersion: "1.0",
  generatedAt: new Date().toISOString(),
  runRoot,
  trainingSetPath: trainingSetPath ? resolve(trainingSetPath) : "",
  existingRecordsDir,
  summary: {
    promotionReady: blockers.length === 0,
    packCount: totalPackCount,
    passedSampleCount,
    failedSampleCount,
    recordCount: records.length,
    blankRecordCount,
    blankRecordShare: records.length ? Number((blankRecordCount / records.length).toFixed(6)) : 0,
    existingSampleIdCount,
    newSampleIdCount: newSampleIds.length,
    derivedPriorCount: behavior.derivedPriorCount,
    priorsWithRules: behavior.priorsWithRules,
    behaviorRuleCount: behavior.behaviorRuleCount,
    flatOrInconclusivePriorCount: behavior.flatOrInconclusivePriorCount,
    requiredPaletteModes
  },
  byPalette: requiredPaletteModes.map((paletteMode) => ({
    paletteMode,
    representativeClass: paletteRepresentativeClass(paletteMode),
    recordCount: recordPaletteCounts.get(paletteMode) || 0,
    ...(behavior.byPalette.find((row) => row.paletteMode === paletteMode) || {
      derivedPriorCount: 0,
      priorsWithRules: 0,
      behaviorRuleCount: 0,
      flatOrInconclusivePriorCount: 0
    })
  })),
  blockers,
  topBehaviorRules: behavior.topBehaviorRules,
  notes: [
    "Passing xLights render samples is necessary but not sufficient for promotion.",
    "Promotion should require reusable generalized behavior rules, not only flat sample records."
  ]
};

writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify({
  ok: true,
  out: outPath,
  promotionReady: report.summary.promotionReady,
  blockers
}, null, 2)}\n`);
