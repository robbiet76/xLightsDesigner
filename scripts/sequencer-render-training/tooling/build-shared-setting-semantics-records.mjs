import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
function str(value = "") { return String(value || "").trim(); }
const outputDir = process.argv[2] ? resolve(process.argv[2]) : resolve("scripts/sequencer-render-training/catalog/generated-records/shared-setting-semantics-records");
const unified = JSON.parse(readFileSync(resolve(process.argv[3] || "scripts/sequencer-render-training/catalog/sequencer-unified-training-set-v1.json"), "utf8"));
mkdirSync(outputDir, { recursive: true });
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
for (const record of records) writeFileSync(join(outputDir, `${record.recordId}.json`), `${JSON.stringify(record, null, 2)}\n`, "utf8");
writeFileSync(join(outputDir, `index.json`), `${JSON.stringify({ artifactType: "shared_setting_semantics_record_index_v1", artifactVersion: "1.0", generatedAt: new Date().toISOString(), recordCount: records.length }, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, artifactType: "shared_setting_semantics_record_index_v1", outputDir, recordCount: records.length }, null, 2));
