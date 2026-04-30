import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { writeGeneratedRecordOutput } from "./generated-record-catalog.mjs";
function str(value = "") { return String(value || "").trim(); }
function slug(value = "") { return str(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
const outputPath = process.argv[2] ? resolve(process.argv[2]) : resolve("scripts/sequencer-render-training/catalog/generated-record-packs/parameter-interaction-semantics-records.records.jsonl");
const manifestsDir = resolve(process.argv[3] || "scripts/sequencer-render-training/manifests");
const files = readdirSync(manifestsDir).filter((name) => name.endsWith("-interactions-v1.json")).sort((a,b)=>a.localeCompare(b));
const records = [];
for (const name of files) {
  const manifest = JSON.parse(readFileSync(join(manifestsDir, name), "utf8"));
  const samples = Array.isArray(manifest?.samples) ? manifest.samples : [];
  const effectName = str(samples[0]?.effectName || "");
  const geometryProfile = str(manifest?.fixture?.modelType ? `${manifest.fixture.modelType}_standard` : "unknown");
  const parameterNames = [...new Set(samples.flatMap((sample) => Object.keys(sample.effectSettings || {})))];
  const interactionPairs = [];
  for (let i = 0; i < parameterNames.length; i += 1) {
    for (let j = i + 1; j < parameterNames.length; j += 1) {
      interactionPairs.push([parameterNames[i], parameterNames[j]]);
    }
  }
  for (const [primaryParameter, secondaryParameter] of interactionPairs) {
    const relevantSamples = samples.filter((sample) => primaryParameter in (sample.effectSettings || {}) && secondaryParameter in (sample.effectSettings || {}));
    if (!relevantSamples.length) continue;
    records.push({
      artifactType: "parameter_interaction_semantics_record_v1",
      artifactVersion: "1.0",
      recordId: `${slug(effectName)}-${slug(primaryParameter)}-${slug(secondaryParameter)}-${slug(name.replace(/\.json$/, ""))}`,
      createdAt: new Date().toISOString(),
      effectName,
      geometryProfile,
      primaryParameter,
      secondaryParameter,
      secondarySettingKind: "effect_parameter",
      interactionRegion: {
        primaryValueRegion: [...new Set(relevantSamples.map((sample) => String(sample.effectSettings?.[primaryParameter])))],
        secondaryValueRegion: [...new Set(relevantSamples.map((sample) => String(sample.effectSettings?.[secondaryParameter])))],
        sharedSettingsContext: [...new Set(relevantSamples.map((sample) => sample.sharedSettings?.renderStyle).filter(Boolean))],
        paletteContext: [],
        stabilityNotes: []
      },
      interactionType: "planned_interaction_sweep",
      affectedSignals: [...new Set(relevantSamples.flatMap((sample) => sample.labelHints || []))],
      behaviorImpactSummary: [...new Set(relevantSamples.flatMap((sample) => sample.labelHints || []))].join(","),
      geometrySensitivity: "manifest_scoped",
      confidence: {
        level: "low",
        evidenceClass: "planned_manifest_only",
        coverageStatus: "narrow"
      },
      evidenceCount: relevantSamples.length,
      traceability: {
        sourceArtifactIds: [name],
        sourceGeometryProfiles: [geometryProfile],
        generatedBy: "build-parameter-interaction-semantics-records.mjs"
      }
    });
  }
}
writeGeneratedRecordOutput({
  outputPath,
  records,
  indexArtifactType: "parameter_interaction_semantics_record_index_v1"
});
console.log(JSON.stringify({ ok: true, artifactType: "parameter_interaction_semantics_record_index_v1", outputPath, recordCount: records.length }, null, 2));
