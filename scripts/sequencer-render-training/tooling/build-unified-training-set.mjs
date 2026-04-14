import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

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

function buildEffectEntry(effectName = "", bundle = null, outcomeRecords = []) {
  const trained = bundle?.effectsByName?.[effectName] || {};
  const capability = getEffectIntentCapability(effectName) || {};
  const roleOutcomeMemory = mergeRoleOutcomeMemory({}, outcomeRecords, effectName);
  const totalSamples = Object.values(roleOutcomeMemory).reduce((sum, row) => sum + Number(row?.sampleCount || 0), 0);
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
      retainedParameters: Array.isArray(trained.retainedParameters) ? trained.retainedParameters : []
    },
    capability: {
      family: String(capability.family || "").trim(),
      supportedSettingsIntent: Array.isArray(capability.supportedSettingsIntent) ? capability.supportedSettingsIntent : [],
      supportedPaletteIntent: Array.isArray(capability.supportedPaletteIntent) ? capability.supportedPaletteIntent : [],
      supportedLayerIntent: Array.isArray(capability.supportedLayerIntent) ? capability.supportedLayerIntent : [],
      supportedRenderIntent: Array.isArray(capability.supportedRenderIntent) ? capability.supportedRenderIntent : []
    },
    liveOutcomeLearning: {
      status: totalSamples > 0 ? "populated" : "seeded_empty",
      storageClass: "general_training",
      outcomeRecordCount: outcomeRecords.filter((row) => String(row?.effectName || "").trim() === effectName).length,
      roleOutcomeMemory
    }
  };
}

function buildTrainingSet() {
  const bundle = getStage1TrainedEffectBundle();
  const recordsDirPath = process.argv[3]
    ? resolve(process.argv[3])
    : resolve("scripts/sequencer-render-training/catalog/effect-family-outcomes");
  const outcomeRecords = loadOutcomeRecords(recordsDirPath);
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
        status: outcomeRecords.length ? "framework_with_outcome_records" : "framework_seed_only",
        currentDataShape: [
          "revision_role",
          "request_scope_mode",
          "review_level",
          "unresolved_signals",
          "rendered_outcome_shift"
        ],
        currentPopulation: outcomeRecords.length
          ? `${outcomeRecords.length} durable general-training outcome records loaded`
          : "not yet harvested into durable general-training records",
        outcomeRecordDirectory: recordsDirPath
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
    effects: effectNames.map((effectName) => buildEffectEntry(effectName, bundle, outcomeRecords))
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
  liveOutcomeRecordCount: Number(artifact?.sources?.liveLearning?.currentPopulation?.split?.(" ")[0] || 0) || 0
}, null, 2));
