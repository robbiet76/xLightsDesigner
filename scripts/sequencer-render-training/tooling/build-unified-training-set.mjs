import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";

import { getStage1TrainedEffectBundle } from "../../../apps/xlightsdesigner-ui/agent/sequence-agent/trained-effect-knowledge.js";
import { getEffectIntentCapability } from "../../../apps/xlightsdesigner-ui/agent/sequence-agent/effect-intent-capabilities.js";

const REVISION_ROLES = [
  "strengthen_lead",
  "reduce_competing_support",
  "widen_support",
  "increase_section_contrast",
  "add_section_development"
];

const REQUEST_SCOPE_MODES = [
  "whole_sequence",
  "section_selection",
  "section_target_refinement",
  "target_refinement"
];

const REVIEW_LEVELS = [
  "macro",
  "section",
  "group",
  "model",
  "effect"
];

const EFFECT_PARAMETER_REGISTRY = JSON.parse(
  readFileSync(resolve("scripts/sequencer-render-training/catalog/effect-parameter-registry.json"), "utf8")
);

const ROLE_FAMILY_SEED_PRIORS = Object.freeze({
  Bars: [
    {
      role: "increase_section_contrast",
      priority: "primary",
      source: "legacy_runtime_heuristic",
      conditions: ["default"]
    },
    {
      role: "add_section_development",
      priority: "primary",
      source: "legacy_runtime_heuristic",
      conditions: ["motion:not_restrained"]
    },
    {
      role: "widen_support",
      priority: "primary",
      source: "legacy_runtime_heuristic",
      conditions: ["motion:not_restrained"]
    },
    {
      role: "strengthen_lead",
      priority: "primary",
      source: "legacy_runtime_heuristic",
      conditions: ["motion:not_still"]
    }
  ],
  Shimmer: [
    {
      role: "add_section_development",
      priority: "primary",
      source: "legacy_runtime_heuristic",
      conditions: ["motion:restrained"]
    },
    {
      role: "reduce_competing_support",
      priority: "primary",
      source: "legacy_runtime_heuristic",
      conditions: ["motion:restrained"]
    }
  ],
  On: [
    {
      role: "reduce_competing_support",
      priority: "primary",
      source: "legacy_runtime_heuristic",
      conditions: ["motion:not_restrained"]
    },
    {
      role: "strengthen_lead",
      priority: "primary",
      source: "legacy_runtime_heuristic",
      conditions: ["motion:still"]
    }
  ],
  "Color Wash": [
    {
      role: "widen_support",
      priority: "primary",
      source: "legacy_runtime_heuristic",
      conditions: ["motion:restrained"]
    }
  ]
});

function buildRoleOutcomeSeed() {
  return Object.fromEntries(
    REVISION_ROLES.map((role) => [
      role,
      {
        sampleCount: 0,
        successfulUses: 0,
        failedUses: 0,
        favoredScopes: [],
        favoredSignals: [],
        cautionSignals: []
      }
    ])
  );
}

function uniqueStrings(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map((row) => String(row || "").trim()).filter(Boolean))];
}

function round6(value = 0) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? Number(num.toFixed(6)) : 0;
}

function slug(value = "") {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function loadOutcomeRecords(recordsDirPath) {
  if (!existsSync(recordsDirPath)) return [];
  return readdirSync(recordsDirPath)
    .filter((name) => name.endsWith(".json"))
    .map((name) => {
      try {
        return JSON.parse(readFileSync(join(recordsDirPath, name), "utf8"));
      } catch {
        return null;
      }
    })
    .filter((row) => row && row.artifactType === "effect_family_outcome_record_v1");
}

function loadScreeningRecords(recordsDirPath) {
  if (!existsSync(recordsDirPath)) return [];
  return readdirSync(recordsDirPath)
    .filter((name) => name.endsWith(".json"))
    .map((name) => {
      try {
        return JSON.parse(readFileSync(join(recordsDirPath, name), "utf8"));
      } catch {
        return null;
      }
    })
    .filter((row) => row && row.recordVersion === "1.0" && String(row?.effectName || "").trim());
}

function buildSeedRolePriors(effectName = "") {
  return (ROLE_FAMILY_SEED_PRIORS[String(effectName || "").trim()] || []).map((row) => ({
    role: String(row.role || "").trim(),
    priority: String(row.priority || "").trim(),
    source: String(row.source || "").trim(),
    conditions: Array.isArray(row.conditions) ? row.conditions.map((item) => String(item || "").trim()).filter(Boolean) : []
  }));
}

function listRegistryParameters(effectName = "") {
  const effectEntry = EFFECT_PARAMETER_REGISTRY?.effects?.[String(effectName || "").trim()];
  return effectEntry && typeof effectEntry === "object" && effectEntry.parameters && typeof effectEntry.parameters === "object"
    ? Object.keys(effectEntry.parameters).sort((a, b) => a.localeCompare(b))
    : [];
}

function classifyParameterCoverage({ capability = {}, retainedParameters = [], registryParameters = [] } = {}) {
  if (retainedParameters.length) return "screened_parameter_subset";
  if (registryParameters.length) return "registry_defined_not_screened";
  if (Array.isArray(capability?.supportedSettingsIntent) && capability.supportedSettingsIntent.length) {
    return "intent_translatable_only";
  }
  return "family_only";
}

function inferScreenedParameterName(record = {}, registryParameters = []) {
  const explicit = String(record?.trainingContext?.screenedParameterName || "").trim();
  if (explicit) return explicit;
  const sampleId = String(record?.sampleId || "").trim().toLowerCase();
  const labels = uniqueStrings(record?.observations?.labels || []);
  const labelSlugSet = new Set(labels.map((row) => slug(row)));
  for (const parameterName of registryParameters) {
    const parameterSlug = slug(parameterName);
    if (!parameterSlug) continue;
    if (sampleId.includes(`-${parameterSlug}-`) || sampleId.includes(`${parameterSlug}_`)) return parameterName;
    if (labelSlugSet.has(parameterSlug)) return parameterName;
  }
  return "";
}

function buildParameterLearningSummary({ effectName = "", capability = {}, retainedParameters = [] } = {}) {
  const registryParameters = listRegistryParameters(effectName);
  return {
    registryParameterNames: registryParameters,
    retainedParameterNames: retainedParameters.map((row) => String(row?.parameterName || "").trim()).filter(Boolean),
    supportedIntentAxes: {
      settings: Array.isArray(capability?.supportedSettingsIntent) ? capability.supportedSettingsIntent : [],
      palette: Array.isArray(capability?.supportedPaletteIntent) ? capability.supportedPaletteIntent : [],
      layer: Array.isArray(capability?.supportedLayerIntent) ? capability.supportedLayerIntent : [],
      render: Array.isArray(capability?.supportedRenderIntent) ? capability.supportedRenderIntent : []
    },
    coverageStatus: classifyParameterCoverage({ capability, retainedParameters, registryParameters }),
    exhaustiveSettingCoverage: false
  };
}

function normalizeStructuralSettings(settings = {}) {
  if (!settings || typeof settings !== "object") return {};
  const excluded = new Set(["X", "Y", "Z", "X2", "Y2", "Z2", "StartChannel", "StartChannelZero", "EndChannel"]);
  return Object.fromEntries(
    Object.entries(settings)
      .filter(([key]) => !excluded.has(String(key || "").trim()))
      .map(([key, value]) => [String(key || "").trim(), String(value || "").trim()])
      .filter(([key, value]) => key && value)
      .sort((a, b) => a[0].localeCompare(b[0]))
  );
}

function nodeCountBucket(nodeCount = 0) {
  const value = Number(nodeCount || 0);
  if (value <= 0) return "unknown";
  if (value <= 25) return "very_small";
  if (value <= 100) return "small";
  if (value <= 300) return "medium";
  if (value <= 900) return "large";
  return "very_large";
}

function buildConfigurationProfile(record = {}) {
  const fixture = record?.fixture || {};
  const meta = record?.modelMetadata || {};
  const structuralSettings = normalizeStructuralSettings(meta?.structuralSettings || {});
  const identity = {
    modelType: String(fixture?.modelType || meta?.resolvedModelType || "").trim(),
    geometryProfile: String(fixture?.geometryProfile || meta?.resolvedGeometryProfile || "").trim(),
    analyzerFamily: String(meta?.analyzerFamily || "").trim(),
    displayAsNormalized: String(meta?.displayAsNormalized || "").trim(),
    stringType: String(meta?.stringType || structuralSettings.StringType || "").trim(),
    nodeCount: Number(meta?.nodeCount || 0),
    nodeCountBucket: nodeCountBucket(meta?.nodeCount),
    channelsPerNode: Number(meta?.channelsPerNode || 0),
    geometryTraits: uniqueStrings(meta?.geometryTraits || []),
    structuralSettings
  };
  const signatureSource = JSON.stringify(identity);
  return {
    ...identity,
    structuralSignature: createHash("sha1").update(signatureSource).digest("hex").slice(0, 12)
  };
}

function summarizeConfigurationProfiles(records = []) {
  const map = new Map();
  for (const record of records) {
    const profile = buildConfigurationProfile(record);
    const key = JSON.stringify(profile);
    if (!map.has(key)) {
      map.set(key, { ...profile, sampleCount: 0 });
    }
    map.get(key).sampleCount += 1;
  }
  const profiles = [...map.values()].sort((a, b) =>
    b.sampleCount - a.sampleCount ||
    a.geometryProfile.localeCompare(b.geometryProfile) ||
    a.structuralSignature.localeCompare(b.structuralSignature)
  );
  const distinctGeometryProfiles = new Set(profiles.map((row) => row.geometryProfile).filter(Boolean));
  let coverageStatus = "none";
  if (profiles.length > 0 && distinctGeometryProfiles.size === profiles.length) coverageStatus = "single_reference_per_geometry";
  if (profiles.length > distinctGeometryProfiles.size) coverageStatus = "multi_configuration_sampled";
  return {
    coverageStatus,
    profileCount: profiles.length,
    profiles
  };
}

function toAnchorKey(value) {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  return String(value || "").trim();
}

function average(values = []) {
  const nums = (Array.isArray(values) ? values : []).map((row) => Number(row)).filter((row) => Number.isFinite(row));
  if (!nums.length) return 0;
  return nums.reduce((sum, row) => sum + row, 0) / nums.length;
}

function filterBehaviorHints(labels = [], parameterName = "") {
  const excludedPrefixes = ["effect:", "model:", "palette_", "render_style:"];
  const excludedExact = new Set([String(parameterName || "").trim(), "range_sample"]);
  return uniqueStrings(labels).filter((label) => {
    const value = String(label || "").trim();
    if (!value || excludedExact.has(value)) return false;
    return !excludedPrefixes.some((prefix) => value.startsWith(prefix));
  });
}

function confidenceForDerivedPrior({ distinctAnchorCount = 0, sampleCount = 0, coverageStatus = "none" } = {}) {
  if (distinctAnchorCount >= 3 && sampleCount >= 6 && coverageStatus === "multi_configuration_sampled") return "high";
  if (distinctAnchorCount >= 2 && sampleCount >= 4) return "medium";
  if (sampleCount > 0) return "low";
  return "none";
}

function buildDerivedParameterPriors(records = [], configurationRepresentativeness = { coverageStatus: "none", profiles: [] }) {
  const groups = new Map();
  for (const record of records) {
    const parameterName = String(record?.trainingContext?.screenedParameterName || "").trim();
    if (!parameterName) continue;
    const geometryProfile = String(record?.fixture?.geometryProfile || record?.modelMetadata?.resolvedGeometryProfile || "").trim();
    const paletteMode = String(record?.trainingContext?.screeningPaletteMode || "").trim() || "default";
    const key = JSON.stringify([parameterName, geometryProfile, paletteMode]);
    if (!groups.has(key)) {
      groups.set(key, {
        parameterName,
        geometryProfile,
        paletteMode,
        records: []
      });
    }
    groups.get(key).records.push(record);
  }

  const priors = [...groups.values()].map((group) => {
    const anchorMap = new Map();
    for (const record of group.records) {
      const rawValue = record?.effectSettings?.[group.parameterName];
      const anchorKey = toAnchorKey(rawValue);
      if (!anchorMap.has(anchorKey)) {
        anchorMap.set(anchorKey, {
          parameterValue: rawValue,
          sampleCount: 0,
          temporalMotionMean: [],
          temporalColorDeltaMean: [],
          temporalBrightnessDeltaMean: [],
          nonBlankSampledFrameRatio: [],
          temporalSignatures: [],
          behaviorHints: [],
          structuralSignatures: []
        });
      }
      const next = anchorMap.get(anchorKey);
      next.sampleCount += 1;
      next.temporalMotionMean.push(record?.features?.temporalMotionMean);
      next.temporalColorDeltaMean.push(record?.features?.temporalColorDeltaMean);
      next.temporalBrightnessDeltaMean.push(record?.features?.temporalBrightnessDeltaMean);
      next.nonBlankSampledFrameRatio.push(record?.features?.nonBlankSampledFrameRatio);
      next.temporalSignatures.push(String(record?.features?.temporalSignature || "").trim());
      next.behaviorHints.push(...filterBehaviorHints(record?.observations?.labels || [], group.parameterName));
      next.structuralSignatures.push(buildConfigurationProfile(record).structuralSignature);
    }
    const anchorProfiles = [...anchorMap.values()].map((row) => ({
      parameterValue: row.parameterValue,
      sampleCount: row.sampleCount,
      temporalSignatureHints: uniqueStrings(row.temporalSignatures),
      meanTemporalMotion: round6(average(row.temporalMotionMean)),
      meanTemporalColorDelta: round6(average(row.temporalColorDeltaMean)),
      meanTemporalBrightnessDelta: round6(average(row.temporalBrightnessDeltaMean)),
      meanNonBlankRatio: round6(average(row.nonBlankSampledFrameRatio)),
      behaviorHints: uniqueStrings(row.behaviorHints).slice(0, 12),
      structuralSignatures: uniqueStrings(row.structuralSignatures)
    })).sort((a, b) =>
      b.meanTemporalMotion - a.meanTemporalMotion ||
      b.meanTemporalColorDelta - a.meanTemporalColorDelta ||
      String(a.parameterValue).localeCompare(String(b.parameterValue))
    );
    const geometryProfiles = configurationRepresentativeness?.profiles || [];
    const matchingProfiles = geometryProfiles.filter((row) => row.geometryProfile === group.geometryProfile);
    return {
      parameterName: group.parameterName,
      geometryProfile: group.geometryProfile,
      paletteMode: group.paletteMode,
      sampleCount: group.records.length,
      distinctAnchorCount: anchorProfiles.length,
      configurationCoverageStatus: matchingProfiles.length > 1
        ? "multi_configuration_sampled"
        : (matchingProfiles.length === 1 ? "single_reference_per_geometry" : "none"),
      configurationProfileCount: matchingProfiles.length,
      structuralSignatures: uniqueStrings(matchingProfiles.map((row) => row.structuralSignature)),
      confidence: confidenceForDerivedPrior({
        distinctAnchorCount: anchorProfiles.length,
        sampleCount: group.records.length,
        coverageStatus: matchingProfiles.length > 1 ? "multi_configuration_sampled" : (matchingProfiles.length === 1 ? "single_reference_per_geometry" : "none")
      }),
      anchorProfiles
    };
  }).sort((a, b) =>
    a.parameterName.localeCompare(b.parameterName) ||
    a.geometryProfile.localeCompare(b.geometryProfile) ||
    a.paletteMode.localeCompare(b.paletteMode)
  );

  return {
    status: priors.length ? "populated" : "empty",
    priorCount: priors.length,
    priors
  };
}

function mergeRoleOutcomeMemory(roleOutcomeMemory = {}, outcomeRecords = [], effectName = "") {
  const next = buildRoleOutcomeSeed();
  for (const role of Object.keys(roleOutcomeMemory || {})) {
    if (next[role]) next[role] = { ...next[role], ...(roleOutcomeMemory[role] || {}) };
  }
  const relevantRecords = outcomeRecords.filter((row) => String(row?.effectName || "").trim() === effectName);
  for (const record of relevantRecords) {
    const roles = uniqueStrings(record?.revisionRoles);
    const scopeMode = String(record?.requestScope?.mode || "").trim();
    const positiveSignals = uniqueStrings(record?.resolvedSignals);
    const cautionSignals = uniqueStrings([...(record?.persistedSignals || []), ...(record?.newSignals || [])]);
    const status = String(record?.outcome?.status || "").trim();
    const positiveEvidence = record?.outcome?.improved === true || positiveSignals.length > 0 || status === "mixed";
    const negativeEvidence = cautionSignals.length > 0 || status === "regressed" || status === "unchanged";
    for (const role of roles) {
      if (!next[role]) continue;
      next[role].sampleCount += 1;
      if (positiveEvidence) next[role].successfulUses += 1;
      if (negativeEvidence) next[role].failedUses += 1;
      next[role].favoredScopes = uniqueStrings([
        ...next[role].favoredScopes,
        ...(positiveEvidence && scopeMode ? [scopeMode] : [])
      ]);
      next[role].favoredSignals = uniqueStrings([
        ...next[role].favoredSignals,
        ...(positiveEvidence ? positiveSignals : [])
      ]);
      next[role].cautionSignals = uniqueStrings([
        ...next[role].cautionSignals,
        ...(negativeEvidence ? cautionSignals : [])
      ]);
    }
  }
  return next;
}

function normalizeAnchorValue(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? Number(value) : String(value);
  return String(value ?? "").trim();
}

function mergeParameterOutcomeMemory(outcomeRecords = [], effectName = "") {
  const relevantRecords = outcomeRecords.filter((row) => String(row?.effectName || "").trim() === effectName);
  const out = {};
  for (const record of relevantRecords) {
    const scopeMode = String(record?.requestScope?.mode || "").trim();
    const positiveSignals = uniqueStrings(record?.resolvedSignals);
    const cautionSignals = uniqueStrings([...(record?.persistedSignals || []), ...(record?.newSignals || [])]);
    const status = String(record?.outcome?.status || "").trim();
    const improved = record?.outcome?.improved === true || positiveSignals.length > 0 || status === "mixed";
    const regressed = cautionSignals.length > 0 || status === "regressed" || status === "unchanged";
    for (const row of Array.isArray(record?.appliedParameterGuidance) ? record.appliedParameterGuidance : []) {
      const parameterName = String(row?.parameterName || "").trim();
      if (!parameterName) continue;
      if (!out[parameterName]) out[parameterName] = {};
      const key = JSON.stringify({
        value: normalizeAnchorValue(row?.appliedValue),
        paletteMode: String(row?.paletteMode || "").trim(),
        geometryProfile: String(row?.geometryProfile || "").trim(),
        modelType: String(row?.modelType || "").trim()
      });
      if (!out[parameterName][key]) {
        out[parameterName][key] = {
          parameterValue: normalizeAnchorValue(row?.appliedValue),
          paletteMode: String(row?.paletteMode || "").trim(),
          geometryProfile: String(row?.geometryProfile || "").trim(),
          modelType: String(row?.modelType || "").trim(),
          confidence: String(row?.confidence || "").trim(),
          recommendationModes: [],
          behaviorHints: [],
          temporalSignatureHints: [],
          sampleCount: 0,
          successfulUses: 0,
          failedUses: 0,
          favoredScopes: [],
          favoredSignals: [],
          cautionSignals: []
        };
      }
      const target = out[parameterName][key];
      target.sampleCount += 1;
      if (improved) target.successfulUses += 1;
      if (regressed) target.failedUses += 1;
      target.recommendationModes = uniqueStrings([...target.recommendationModes, String(row?.recommendationMode || "").trim()]);
      target.behaviorHints = uniqueStrings([...target.behaviorHints, ...(row?.behaviorHints || [])]);
      target.temporalSignatureHints = uniqueStrings([...target.temporalSignatureHints, ...(row?.temporalSignatureHints || [])]);
      target.favoredScopes = uniqueStrings([...target.favoredScopes, ...(improved && scopeMode ? [scopeMode] : [])]);
      target.favoredSignals = uniqueStrings([...target.favoredSignals, ...(improved ? positiveSignals : [])]);
      target.cautionSignals = uniqueStrings([...target.cautionSignals, ...(regressed ? cautionSignals : [])]);
    }
  }
  return Object.fromEntries(
    Object.entries(out)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([parameterName, entries]) => [
        parameterName,
        Object.values(entries).sort((a, b) =>
          b.sampleCount - a.sampleCount ||
          String(a.parameterValue).localeCompare(String(b.parameterValue))
        )
      ])
  );
}

function buildEffectEntry(effectName = "", bundle = null, outcomeRecords = [], screeningRecords = []) {
  const trained = bundle?.effectsByName?.[effectName] || {};
  const capability = getEffectIntentCapability(effectName) || {};
  const roleOutcomeMemory = mergeRoleOutcomeMemory({}, outcomeRecords, effectName);
  const parameterOutcomeMemory = mergeParameterOutcomeMemory(outcomeRecords, effectName);
  const totalSamples = Object.values(roleOutcomeMemory).reduce((sum, row) => sum + Number(row?.sampleCount || 0), 0);
  const seedRolePriors = buildSeedRolePriors(effectName);
  const retainedParameters = Array.isArray(trained.retainedParameters) ? trained.retainedParameters : [];
  const relevantScreeningRecords = screeningRecords.filter((row) => String(row?.effectName || "").trim() === effectName);
  const registryParameters = listRegistryParameters(effectName);
  const screenedParameterNames = uniqueStrings(
    relevantScreeningRecords
      .map((row) => inferScreenedParameterName(row, registryParameters))
      .filter(Boolean)
  );
  const parameterLearning = buildParameterLearningSummary({
    effectName,
    capability,
    retainedParameters
  });
  parameterLearning.screenedParameterNames = screenedParameterNames;
  if (screenedParameterNames.length && parameterLearning.coverageStatus === "registry_defined_not_screened") {
    parameterLearning.coverageStatus = "screened_parameter_subset";
  }
  const configurationRepresentativeness = summarizeConfigurationProfiles(relevantScreeningRecords);
  parameterLearning.derivedPriors = buildDerivedParameterPriors(relevantScreeningRecords, configurationRepresentativeness);
  return {
    effectName,
    baseline: {
      currentStage: String(trained.currentStage || "").trim(),
      selectorReady: Boolean(trained?.stages?.selector_ready),
      selectorEvidence: trained.selectorEvidence || {},
      supportedModelTypes: Array.isArray(trained.supportedModelTypes) ? trained.supportedModelTypes : [],
      supportedGeometryProfiles: Array.isArray(trained.supportedGeometryProfiles) ? trained.supportedGeometryProfiles : [],
      intentTags: Array.isArray(trained.intentTags) ? trained.intentTags : [],
      patternFamilies: Array.isArray(trained.patternFamilies) ? trained.patternFamilies : [],
      retainedParameters
    },
    capability: {
      family: String(capability.family || "").trim(),
      supportedSettingsIntent: Array.isArray(capability.supportedSettingsIntent) ? capability.supportedSettingsIntent : [],
      supportedPaletteIntent: Array.isArray(capability.supportedPaletteIntent) ? capability.supportedPaletteIntent : [],
      supportedLayerIntent: Array.isArray(capability.supportedLayerIntent) ? capability.supportedLayerIntent : [],
      supportedRenderIntent: Array.isArray(capability.supportedRenderIntent) ? capability.supportedRenderIntent : []
    },
    parameterLearning,
    liveOutcomeLearning: {
      status: totalSamples > 0 ? "populated" : "seeded_empty",
      storageClass: "general_training",
      outcomeRecordCount: outcomeRecords.filter((row) => String(row?.effectName || "").trim() === effectName).length,
      seedRolePriors,
      roleOutcomeMemory,
      parameterOutcomeMemory
    },
    screeningLearning: {
      status: relevantScreeningRecords.length > 0 ? "populated" : "empty",
      storageClass: "general_training",
      screeningRecordCount: relevantScreeningRecords.length,
      screenedParameterNames,
      sampledModelTypes: uniqueStrings(relevantScreeningRecords.map((row) => row?.fixture?.modelType)),
      sampledGeometryProfiles: uniqueStrings(relevantScreeningRecords.map((row) => row?.fixture?.geometryProfile)),
      observedLabelHints: uniqueStrings(relevantScreeningRecords.flatMap((row) => row?.observations?.labels || [])),
      configurationRepresentativeness
    }
  };
}

function buildTrainingSet() {
  const bundle = getStage1TrainedEffectBundle();
  const recordsDirPath = process.argv[3]
    ? resolve(process.argv[3])
    : resolve("scripts/sequencer-render-training/catalog/effect-family-outcomes");
  const screeningRecordsDirPath = process.argv[4]
    ? resolve(process.argv[4])
    : resolve("scripts/sequencer-render-training/catalog/effect-screening-records");
  const outcomeRecords = loadOutcomeRecords(recordsDirPath);
  const screeningRecords = loadScreeningRecords(screeningRecordsDirPath);
  const effectNames = Object.keys(bundle?.effectsByName || {}).sort((a, b) => a.localeCompare(b));
  return {
    artifactType: "sequencer_unified_training_set_v1",
    artifactVersion: "1.0",
    generatedAt: new Date().toISOString(),
    description: "Unified general-training set combining Stage 1 trained effect knowledge with Phase 3 live-learning slots.",
    sources: {
      stage1Bundle: {
        artifactType: String(bundle?.artifactType || "").trim(),
        artifactVersion: String(bundle?.artifactVersion || "").trim(),
        targetState: String(bundle?.stage1?.targetState || "").trim(),
        effectCount: Number(bundle?.stage1?.effectCount || 0),
        equalizedCount: Number(bundle?.stage1?.equalizedCount || 0),
        selectorReadyEffects: Array.isArray(bundle?.selectorReadyEffects) ? bundle.selectorReadyEffects : []
      },
      liveLearning: {
        status: outcomeRecords.length ? "framework_with_outcome_records" : "framework_with_seed_priors",
        currentDataShape: [
          "revision_role",
          "request_scope_mode",
          "review_level",
          "unresolved_signals",
          "rendered_outcome_shift"
        ],
        currentPopulation: outcomeRecords.length
          ? `${outcomeRecords.length} durable general-training outcome records loaded`
          : "seed priors loaded; no harvested durable outcome records yet",
        legacyHeuristicSeedSource: "sequence-agent revision-role family routing",
        outcomeRecordDirectory: recordsDirPath
      },
      screeningLearning: {
        status: screeningRecords.length ? "framework_with_screening_records" : "framework_without_screening_records",
        currentDataShape: [
          "effect_settings",
          "artifact_features",
          "heuristic_observations",
          "fixture_model_context"
        ],
        currentPopulation: screeningRecords.length
          ? `${screeningRecords.length} durable general-training screening records loaded`
          : "no harvested screening records yet",
        screeningRecordDirectory: screeningRecordsDirPath
      }
    },
    boundaries: {
      generalTraining: {
        purpose: "portable shared sequencing knowledge",
        storageRule: "eligible_for_shared_sync",
        includes: [
          "stage1_effect_selection_evidence",
          "effect_family_outcome_memory",
          "scope_and_role_conditioned_revision_learning"
        ]
      },
      preferenceTraining: {
        purpose: "user_or_project_taste_bias",
        storageRule: "separate_store_required",
        excludedFromThisArtifact: true,
        includes: [
          "director_taste",
          "project_show_preferences",
          "user_accept_reject_patterns"
        ]
      }
    },
    runtimeContracts: {
      revisionRoles: REVISION_ROLES,
      requestScopeModes: REQUEST_SCOPE_MODES,
      reviewLevels: REVIEW_LEVELS
    },
    effects: effectNames.map((effectName) => buildEffectEntry(effectName, bundle, outcomeRecords, screeningRecords))
  };
}

const outputPath = process.argv[2]
  ? resolve(process.argv[2])
  : resolve("scripts/sequencer-render-training/catalog/sequencer-unified-training-set-v1.json");

const artifact = buildTrainingSet();
writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  ok: true,
  output: outputPath,
  artifactType: artifact.artifactType,
  effectCount: artifact.effects.length,
  liveOutcomeRecordCount: Number(artifact?.sources?.liveLearning?.currentPopulation?.split?.(" ")[0] || 0) || 0,
  screeningRecordCount: Number(artifact?.sources?.screeningLearning?.currentPopulation?.split?.(" ")[0] || 0) || 0
}, null, 2));
