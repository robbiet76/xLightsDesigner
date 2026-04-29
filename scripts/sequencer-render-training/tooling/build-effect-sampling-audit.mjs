#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const DEFAULT_PALETTE_MODES = ["mono_white", "rgb_primary"];

function normText(value = "") {
  return String(value || "").trim();
}

function unique(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map((row) => normText(row)).filter(Boolean))];
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

function loadScreeningRecords(recordsDirPath) {
  return listJsonFiles(recordsDirPath)
    .filter((filePath) => basename(filePath).endsWith(".record.json"))
    .map((filePath) => compactScreeningRecord(readJson(filePath, null)))
    .filter((record) => record?.recordVersion === "1.0" && normText(record?.effectName));
}

function compactScreeningRecord(record = null) {
  if (!record || record.recordVersion !== "1.0") return record;
  return {
    recordVersion: record.recordVersion,
    effectName: record.effectName,
    effectSettings: record.effectSettings || {},
    trainingContext: record.trainingContext || {},
    observations: record.observations || {}
  };
}

function numericValue(value) {
  if (typeof value === "boolean") return value ? 1 : 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function sortAnchorValues(values = []) {
  return unique(values.map((row) => String(row)))
    .sort((a, b) => {
      const an = numericValue(a);
      const bn = numericValue(b);
      if (an !== null && bn !== null) return an - bn;
      return a.localeCompare(b);
    });
}

function priorityWeight(value = "") {
  const key = normText(value).toLowerCase();
  if (key === "critical") return 5;
  if (key === "high") return 4;
  if (key === "medium") return 2;
  if (key === "low") return 1;
  return 0;
}

function parameterPriority(parameter = {}) {
  return Math.max(
    priorityWeight(parameter.importance),
    priorityWeight(parameter.practicalPriority)
  );
}

function inferEvidenceClass(prior = {}) {
  const hints = new Set(
    (Array.isArray(prior?.anchorProfiles) ? prior.anchorProfiles : [])
      .flatMap((anchor) => Array.isArray(anchor?.behaviorHints) ? anchor.behaviorHints : [])
      .map((hint) => normText(hint))
      .filter(Boolean)
  );
  if (hints.has("behavior_anchor")) return "focused_anchor";
  if (hints.has("registry_generated")) return "focused_anchor";
  if (hints.has("interaction_sweep")) return "interaction_only";
  return "legacy_or_unknown";
}

function blankShareForRecords(records = []) {
  if (!records.length) return 0;
  const blankCount = records.filter((record) =>
    Array.isArray(record?.observations?.labels) && record.observations.labels.includes("blank_sampled_frame")
  ).length;
  return Number((blankCount / records.length).toFixed(6));
}

function recordsForParameter(records = [], effectName = "", parameterName = "", paletteMode = "") {
  return records.filter((record) => {
    if (normText(record?.effectName) !== effectName) return false;
    const recordPalette = normText(record?.trainingContext?.screeningPaletteMode) || "default";
    if (paletteMode && recordPalette !== paletteMode) return false;
    const explicit = normText(record?.trainingContext?.screenedParameterName);
    if (explicit) return explicit === parameterName;
    return Object.prototype.hasOwnProperty.call(record?.effectSettings || {}, parameterName);
  });
}

function summarizePrior(prior = {}, records = [], effectName = "") {
  const rules = Array.isArray(prior?.behaviorDimensions?.behaviorRules) ? prior.behaviorDimensions.behaviorRules : [];
  const anchors = Array.isArray(prior?.anchorProfiles) ? prior.anchorProfiles : [];
  const parameterName = normText(prior?.parameterName);
  const paletteMode = normText(prior?.paletteMode) || "default";
  const relevantRecords = recordsForParameter(records, effectName, parameterName, paletteMode);
  return {
    parameterName,
    paletteMode,
    geometryProfile: normText(prior?.geometryProfile),
    evidenceClass: inferEvidenceClass(prior),
    sampleCount: Number(prior?.sampleCount || 0),
    distinctAnchorCount: Number(prior?.distinctAnchorCount || anchors.length || 0),
    behaviorRuleCount: rules.length,
    blankRecordShare: blankShareForRecords(relevantRecords),
    observedAnchorValues: sortAnchorValues(anchors.map((anchor) => anchor?.parameterValue)),
    dominantDimensions: unique(rules.map((rule) => rule?.dimension)).slice(0, 12)
  };
}

function groupPriorSummaries(effect = {}, records = []) {
  const out = new Map();
  for (const prior of Array.isArray(effect?.parameterLearning?.derivedPriors?.priors) ? effect.parameterLearning.derivedPriors.priors : []) {
    const row = summarizePrior(prior, records, normText(effect.effectName));
    const key = `${row.parameterName}\u0000${row.paletteMode}`;
    if (!out.has(key)) out.set(key, []);
    out.get(key).push(row);
  }
  return out;
}

function desiredAnchorCount(parameter = {}) {
  if (Array.isArray(parameter?.anchors) && parameter.anchors.length) return Math.min(parameter.anchors.length, 5);
  if (parameter?.type === "boolean") return 2;
  if (parameter?.type === "enum") return Math.min(Array.isArray(parameter?.upstream?.options) ? parameter.upstream.options.length : 3, 6);
  if (parameter?.type === "numeric") return 3;
  return 2;
}

function expectedAnchors(parameter = {}) {
  if (Array.isArray(parameter?.anchors) && parameter.anchors.length) return parameter.anchors.map((row) => String(row));
  if (parameter?.type === "boolean") return ["false", "true"];
  const min = parameter?.range?.min ?? parameter?.upstream?.min;
  const max = parameter?.range?.max ?? parameter?.upstream?.max;
  const def = parameter?.upstream?.default;
  if (parameter?.type === "numeric" && Number.isFinite(Number(min)) && Number.isFinite(Number(max))) {
    return sortAnchorValues([min, def, max].filter((row) => row !== null && row !== undefined));
  }
  if (parameter?.type === "enum" && Array.isArray(parameter?.upstream?.options)) {
    return parameter.upstream.options.slice(0, 6).map((row) => String(row));
  }
  return [];
}

function classifyParameterSampling({ parameter = {}, paletteSummaries = [] } = {}) {
  const focused = paletteSummaries.filter((row) => row.evidenceClass === "focused_anchor");
  const withRules = paletteSummaries.filter((row) => row.behaviorRuleCount > 0);
  const focusedWithRules = focused.filter((row) => row.behaviorRuleCount > 0);
  const interactionOnlyWithRules = withRules.length > 0 && focusedWithRules.length === 0;
  const expectedCount = desiredAnchorCount(parameter);
  const maxFocusedAnchorCount = Math.max(0, ...focused.map((row) => row.distinctAnchorCount));
  const maxBlankShare = Math.max(0, ...paletteSummaries.map((row) => row.blankRecordShare));

  if (!paletteSummaries.length) return "missing";
  if (interactionOnlyWithRules) return "needs_causal_anchor_confirmation";
  if (!focused.length) return "interaction_only";
  if (maxBlankShare >= 0.25) return "needs_range_repair";
  if (maxFocusedAnchorCount < Math.min(2, expectedCount)) return "under_sampled";
  if (!focusedWithRules.length && maxFocusedAnchorCount >= expectedCount) return "observed_flat_or_inconclusive";
  if (focusedWithRules.length && maxFocusedAnchorCount < expectedCount) return "needs_anchor_completion";
  if (focusedWithRules.length) return "causal_ready";
  return "under_sampled";
}

function recommendationForStatus(status = "") {
  if (status === "missing") return "add focused low/mid/high or off/on anchor sweep";
  if (status === "needs_causal_anchor_confirmation") return "convert interaction finding into one-parameter focused anchors";
  if (status === "interaction_only") return "add focused anchors before trusting interaction-derived trends";
  if (status === "needs_range_repair") return "repair sampled range; current anchors include too many blank/dead outputs";
  if (status === "under_sampled") return "add missing anchor values for both palette representatives";
  if (status === "needs_anchor_completion") return "add remaining anchors around observed behavior change";
  if (status === "observed_flat_or_inconclusive") return "deprioritize or test alternate geometry/palette if the setting is still design-critical";
  return "retain current evidence; revisit after higher-priority gaps";
}

function scoreSamplingNeed({ status = "", parameter = {}, paletteSummaries = [] } = {}) {
  const baseByStatus = {
    missing: 90,
    needs_causal_anchor_confirmation: 82,
    interaction_only: 74,
    needs_range_repair: 70,
    under_sampled: 64,
    needs_anchor_completion: 58,
    observed_flat_or_inconclusive: 28,
    causal_ready: 5
  };
  const priority = parameterPriority(parameter);
  const maxBlankShare = Math.max(0, ...paletteSummaries.map((row) => row.blankRecordShare));
  const hasRgbRules = paletteSummaries.some((row) => row.paletteMode === "rgb_primary" && row.behaviorRuleCount > 0);
  return Number(((baseByStatus[status] ?? 40) + (priority * 6) + (maxBlankShare * 20) - (hasRgbRules ? 3 : 0)).toFixed(3));
}

function buildParameterAuditRows({ registryEffect = {}, unifiedEffect = {}, records = [] } = {}) {
  const effectName = normText(unifiedEffect?.effectName || registryEffect?.effectName);
  const priorMap = groupPriorSummaries(unifiedEffect, records);
  const parameters = registryEffect?.parameters && typeof registryEffect.parameters === "object" ? registryEffect.parameters : {};
  return Object.entries(parameters)
    .map(([parameterName, parameter]) => {
      const paletteSummaries = DEFAULT_PALETTE_MODES.flatMap((paletteMode) => priorMap.get(`${parameterName}\u0000${paletteMode}`) || []);
      const allSummaries = [...paletteSummaries];
      for (const [key, rows] of priorMap.entries()) {
        const [priorParameter] = key.split("\u0000");
        if (priorParameter === parameterName && !DEFAULT_PALETTE_MODES.some((palette) => key.endsWith(`\u0000${palette}`))) {
          allSummaries.push(...rows);
        }
      }
      const status = classifyParameterSampling({ parameter, paletteSummaries: allSummaries });
      const expected = expectedAnchors(parameter);
      const observedFocused = sortAnchorValues(
        allSummaries
          .filter((row) => row.evidenceClass === "focused_anchor")
          .flatMap((row) => row.observedAnchorValues)
      );
      const missingAnchors = expected.filter((anchor) => !observedFocused.includes(String(anchor)));
      return {
        effectName,
        parameterName,
        parameterType: normText(parameter?.type),
        importance: normText(parameter?.importance),
        practicalPriority: normText(parameter?.practicalPriority),
        stopRule: normText(parameter?.stopRule),
        expectedAnchors: expected,
        observedFocusedAnchors: observedFocused,
        missingFocusedAnchors: missingAnchors,
        paletteSummaries: allSummaries.sort((a, b) =>
          a.paletteMode.localeCompare(b.paletteMode)
          || a.evidenceClass.localeCompare(b.evidenceClass)
          || b.behaviorRuleCount - a.behaviorRuleCount
        ),
        status,
        recommendation: recommendationForStatus(status),
        score: scoreSamplingNeed({ status, parameter, paletteSummaries: allSummaries })
      };
    })
    .sort((a, b) => b.score - a.score || a.effectName.localeCompare(b.effectName) || a.parameterName.localeCompare(b.parameterName));
}

function buildSamplingAudit({
  registry = {},
  trainingSet = {},
  records = []
} = {}) {
  const unifiedByEffect = new Map((Array.isArray(trainingSet?.effects) ? trainingSet.effects : [])
    .map((effect) => [normText(effect.effectName), effect]));
  const effectRows = [];
  for (const [effectName, registryEffect] of Object.entries(registry?.effects || {})) {
    const unifiedEffect = unifiedByEffect.get(effectName) || { effectName };
    const parameters = buildParameterAuditRows({
      registryEffect: { ...registryEffect, effectName },
      unifiedEffect,
      records: records.filter((record) => normText(record.effectName) === effectName)
    });
    const statusCounts = {};
    for (const row of parameters) statusCounts[row.status] = (statusCounts[row.status] || 0) + 1;
    effectRows.push({
      effectName,
      complexityClass: normText(registryEffect?.complexityClass),
      parameterCount: parameters.length,
      statusCounts,
      topSamplingNeeds: parameters.filter((row) => row.status !== "causal_ready").slice(0, 8),
      parameters
    });
  }
  const nextSamplingQueue = effectRows
    .flatMap((effect) => effect.parameters)
    .filter((row) => row.status !== "causal_ready")
    .sort((a, b) => b.score - a.score || a.effectName.localeCompare(b.effectName) || a.parameterName.localeCompare(b.parameterName))
    .slice(0, 40)
    .map((row) => ({
      effectName: row.effectName,
      parameterName: row.parameterName,
      status: row.status,
      score: row.score,
      recommendation: row.recommendation,
      expectedAnchors: row.expectedAnchors,
      observedFocusedAnchors: row.observedFocusedAnchors,
      missingFocusedAnchors: row.missingFocusedAnchors,
      importance: row.importance,
      practicalPriority: row.practicalPriority,
      stopRule: row.stopRule
    }));
  const currentEffectQueue = effectRows
    .flatMap((effect) => effect.parameters)
    .filter((row) => row.status !== "causal_ready" && row.paletteSummaries.length > 0)
    .sort((a, b) => b.score - a.score || a.effectName.localeCompare(b.effectName) || a.parameterName.localeCompare(b.parameterName))
    .slice(0, 40)
    .map((row) => ({
      effectName: row.effectName,
      parameterName: row.parameterName,
      status: row.status,
      score: row.score,
      recommendation: row.recommendation,
      expectedAnchors: row.expectedAnchors,
      observedFocusedAnchors: row.observedFocusedAnchors,
      missingFocusedAnchors: row.missingFocusedAnchors,
      importance: row.importance,
      practicalPriority: row.practicalPriority,
      stopRule: row.stopRule
    }));
  const newEffectExpansionQueue = effectRows
    .flatMap((effect) => effect.parameters)
    .filter((row) => row.status === "missing" && row.paletteSummaries.length === 0)
    .sort((a, b) => b.score - a.score || a.effectName.localeCompare(b.effectName) || a.parameterName.localeCompare(b.parameterName))
    .slice(0, 40)
    .map((row) => ({
      effectName: row.effectName,
      parameterName: row.parameterName,
      status: row.status,
      score: row.score,
      recommendation: row.recommendation,
      expectedAnchors: row.expectedAnchors,
      importance: row.importance,
      practicalPriority: row.practicalPriority,
      stopRule: row.stopRule
    }));
  const summaryStatusCounts = {};
  for (const effect of effectRows) {
    for (const [status, count] of Object.entries(effect.statusCounts)) {
      summaryStatusCounts[status] = (summaryStatusCounts[status] || 0) + count;
    }
  }
  return {
    artifactType: "effect_sampling_audit_v1",
    artifactVersion: "1.0",
    generatedAt: new Date().toISOString(),
    summary: {
      effectCount: effectRows.length,
      parameterCount: effectRows.reduce((sum, effect) => sum + effect.parameterCount, 0),
      statusCounts: Object.fromEntries(Object.entries(summaryStatusCounts).sort(([a], [b]) => a.localeCompare(b))),
      nextSamplingQueueCount: nextSamplingQueue.length,
      currentEffectQueueCount: currentEffectQueue.length,
      newEffectExpansionQueueCount: newEffectExpansionQueue.length,
      paletteModes: DEFAULT_PALETTE_MODES
    },
    evidencePolicy: {
      focusedAnchor: "strongest evidence; one screened parameter changes while other settings are held steady",
      interactionOnly: "useful real-world evidence, but not sufficient to prove which setting caused a behavior",
      recommendation: "promote high-priority parameters from interaction-only or missing status into focused anchor manifests"
    },
    nextSamplingQueue,
    currentEffectQueue,
    newEffectExpansionQueue,
    effects: effectRows.sort((a, b) => a.effectName.localeCompare(b.effectName))
  };
}

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 ? normText(process.argv[index + 1]) : fallback;
}

function main() {
  const registryPath = resolve(argValue("--registry", "scripts/sequencer-render-training/catalog/effective-effect-parameter-registry.json"));
  const trainingSetPath = resolve(argValue("--training-set", "scripts/sequencer-render-training/catalog/sequencer-unified-training-set-v1.json"));
  const recordsDir = resolve(argValue("--records-dir", "scripts/sequencer-render-training/catalog/effect-screening-records"));
  const outPath = resolve(argValue("--out", "scripts/sequencer-render-training/catalog/effect-sampling-audit-v1.json"));
  const audit = buildSamplingAudit({
    registry: readJson(registryPath, {}),
    trainingSet: readJson(trainingSetPath, {}),
    records: loadScreeningRecords(recordsDir)
  });
  writeFileSync(outPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({
    ok: true,
    output: outPath,
    artifactType: audit.artifactType,
    parameterCount: audit.summary.parameterCount,
    statusCounts: audit.summary.statusCounts,
    nextSamplingQueueCount: audit.summary.nextSamplingQueueCount,
    currentEffectQueueCount: audit.summary.currentEffectQueueCount,
    newEffectExpansionQueueCount: audit.summary.newEffectExpansionQueueCount
  }, null, 2)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { buildSamplingAudit };
