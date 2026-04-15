import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
function str(value = "") { return String(value || "").trim(); }
function slug(value = "") { return str(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
const outputDir = process.argv[2] ? resolve(process.argv[2]) : resolve("scripts/sequencer-render-training/catalog/generated-records/parameter-interaction-semantics-records");
const manifestsDir = resolve(process.argv[3] || "scripts/sequencer-render-training/manifests");
mkdirSync(outputDir, { recursive: true });
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
for (const record of records) writeFileSync(join(outputDir, `${record.recordId}.json`), `${JSON.stringify(record, null, 2)}\n`, "utf8");
writeFileSync(join(outputDir, `index.json`), `${JSON.stringify({ artifactType: "parameter_interaction_semantics_record_index_v1", artifactVersion: "1.0", generatedAt: new Date().toISOString(), recordCount: records.length }, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, artifactType: "parameter_interaction_semantics_record_index_v1", outputDir, recordCount: records.length }, null, 2));
