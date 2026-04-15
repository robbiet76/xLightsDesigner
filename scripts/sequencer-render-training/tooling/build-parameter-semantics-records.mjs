import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
function str(value = "") { return String(value || "").trim(); }
function slug(value = "") { return str(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
function inferAxis(name = "") {
  const n = str(name).toLowerCase();
  if (n.includes("speed") || n === "cycles" || n.includes("advance")) return "speed";
  if (n.includes("count") || n.includes("band") || n.includes("step") || n.includes("thickness") || n.includes("width")) return "density";
  if (n.includes("radius") || n.includes("center") || n.includes("scale")) return "coverage";
  if (n.includes("fade") || n.includes("blend") || n.includes("gradient") || n.includes("shimmer")) return "edge_softness";
  if (n.includes("direction") || n.includes("stagger") || n.includes("mode")) return "directionality";
  if (n.includes("level") || n.includes("intensity") || n.includes("highlight")) return "brightness_profile";
  return "variation";
}
const outputDir = process.argv[2] ? resolve(process.argv[2]) : resolve("scripts/sequencer-render-training/catalog/generated-records/parameter-semantics-records");
const unified = JSON.parse(readFileSync(resolve(process.argv[3] || "scripts/sequencer-render-training/catalog/sequencer-unified-training-set-v1.json"), "utf8"));
const registry = JSON.parse(readFileSync(resolve(process.argv[4] || "scripts/sequencer-render-training/catalog/effect-parameter-registry.json"), "utf8"));
mkdirSync(outputDir, { recursive: true });
const effects = Array.isArray(unified?.effects) ? unified.effects : [];
const records = [];
for (const effect of effects) {
  const effectName = str(effect.effectName);
  const regParams = registry?.effects?.[effectName]?.parameters || {};
  const priors = Array.isArray(effect?.parameterLearning?.derivedPriors?.priors) ? effect.parameterLearning.derivedPriors.priors : [];
  for (const [parameterName, meta] of Object.entries(regParams)) {
    const matchingPriors = priors.filter((p) => str(p.parameterName) === parameterName);
    const valueRegions = matchingPriors.flatMap((prior) => (Array.isArray(prior.anchorProfiles) ? prior.anchorProfiles : []).map((anchor) => ({
      regionId: `${slug(effectName)}-${slug(parameterName)}-${slug(prior.geometryProfile)}-${slug(String(anchor.parameterValue))}`,
      valueSummary: String(anchor.parameterValue),
      behaviorImpactSummary: Array.isArray(anchor.behaviorHints) ? anchor.behaviorHints.join(",") : "",
      affectedSignals: Array.isArray(anchor.behaviorHints) ? anchor.behaviorHints : [],
      geometrySpecificNotes: [str(prior.geometryProfile)],
      confidence: str(prior.confidence || "low"),
      evidenceCount: Number(anchor.sampleCount || 0)
    })));
    const record = {
      artifactType: "parameter_semantics_record_v1",
      artifactVersion: "1.0",
      recordId: `${slug(effectName)}-${slug(parameterName)}`,
      createdAt: new Date().toISOString(),
      effectName,
      parameterName,
      semanticAxis: inferAxis(parameterName),
      observedDirectionality: valueRegions.length > 1 ? "observed_multi_region" : "narrow_or_unknown",
      interactionSensitivity: Array.isArray(meta?.interactionHypotheses) && meta.interactionHypotheses.length ? "suspected" : "unknown",
      geometrySensitivity: matchingPriors.length > 1 ? "observed" : "narrow_or_unknown",
      affectedSignals: [...new Set(valueRegions.flatMap((row) => row.affectedSignals || []))],
      valueRegions,
      confidence: {
        level: valueRegions.length > 1 ? "medium" : "low",
        evidenceClass: valueRegions.length ? "aggregated_render" : "registry_only",
        coverageStatus: valueRegions.length > 1 ? "moderate" : "narrow"
      },
      evidenceCount: valueRegions.reduce((sum, row) => sum + Number(row.evidenceCount || 0), 0),
      traceability: {
        sourceArtifactIds: ["sequencer_unified_training_set_v1", "effect_parameter_registry"],
        sourceGeometryProfiles: [...new Set(valueRegions.flatMap((row) => row.geometrySpecificNotes || []))],
        generatedBy: "build-parameter-semantics-records.mjs"
      }
    };
    records.push(record);
    writeFileSync(join(outputDir, `${record.recordId}.json`), `${JSON.stringify(record, null, 2)}\n`, "utf8");
  }
}
writeFileSync(join(outputDir, `index.json`), `${JSON.stringify({ artifactType: "parameter_semantics_record_index_v1", artifactVersion: "1.0", generatedAt: new Date().toISOString(), recordCount: records.length }, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, artifactType: "parameter_semantics_record_index_v1", outputDir, recordCount: records.length }, null, 2));
