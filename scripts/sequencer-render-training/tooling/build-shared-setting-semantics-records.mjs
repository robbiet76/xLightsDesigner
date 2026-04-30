import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { writeGeneratedRecordOutput } from "./generated-record-catalog.mjs";
function str(value = "") { return String(value || "").trim(); }
const outputPath = process.argv[2] ? resolve(process.argv[2]) : resolve("scripts/sequencer-render-training/catalog/generated-record-packs/shared-setting-semantics-records.records.jsonl");
const unified = JSON.parse(readFileSync(resolve(process.argv[3] || "scripts/sequencer-render-training/catalog/sequencer-unified-training-set-v1.json"), "utf8"));
const shared = unified?.crossEffectSharedSettingLearning?.sharedSettingOutcomeMemory || {};
const defaultSettings = ["bufferStyle", "layerMethod", "effectLayerMix", "inTransitionType", "outTransitionType", "layerMorph"];
const names = [...new Set([...Object.keys(shared), ...defaultSettings])].sort((a,b)=>a.localeCompare(b));
const records = names.map((settingName) => {
  const entries = Array.isArray(shared?.[settingName]) ? shared[settingName] : [];
  return {
    artifactType: "shared_setting_semantics_record_v1",
    artifactVersion: "1.0",
    recordId: settingName,
    createdAt: new Date().toISOString(),
    settingName,
    settingValueRegion: {
      regionKind: entries.length ? "observed_values" : "transitional_empty",
      values: entries.map((entry) => entry.appliedValue)
    },
    affectedBehaviorSignals: [...new Set(entries.flatMap((entry) => entry.behaviorHints || []))],
    interactionTargets: [...new Set(entries.flatMap((entry) => entry.effectNames || []))],
    geometrySensitivity: "cross_effect_or_unknown",
    confidence: {
      level: entries.length ? "low" : "low",
      evidenceClass: entries.length ? "batch_validated" : "no_outcome_evidence",
      coverageStatus: entries.length ? "narrow" : "empty"
    },
    evidenceCount: entries.reduce((sum, entry) => sum + Number(entry.sampleCount || 0), 0),
    traceability: {
      sourceArtifactIds: ["sequencer_unified_training_set_v1"],
      sourceGeometryProfiles: [],
      generatedBy: "build-shared-setting-semantics-records.mjs"
    }
  };
});
writeGeneratedRecordOutput({
  outputPath,
  records,
  indexArtifactType: "shared_setting_semantics_record_index_v1"
});
console.log(JSON.stringify({ ok: true, artifactType: "shared_setting_semantics_record_index_v1", outputPath, recordCount: records.length }, null, 2));
