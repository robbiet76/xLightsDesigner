import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function str(value = "") { return String(value || "").trim(); }
function slug(value = "") { return str(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }

const outputDir = process.argv[2]
  ? resolve(process.argv[2])
  : resolve("scripts/sequencer-render-training/catalog/generated-records/behavior-capability-records");
const unifiedPath = process.argv[3]
  ? resolve(process.argv[3])
  : resolve("scripts/sequencer-render-training/catalog/sequencer-unified-training-set-v1.json");

const unified = JSON.parse(readFileSync(unifiedPath, "utf8"));
const effects = Array.isArray(unified?.effects) ? unified.effects : [];
mkdirSync(outputDir, { recursive: true });

const records = [];
for (const effect of effects) {
  const effectName = str(effect.effectName);
  const priors = Array.isArray(effect?.parameterLearning?.derivedPriors?.priors)
    ? effect.parameterLearning.derivedPriors.priors
    : [];
  if (priors.length) {
    for (const prior of priors) {
      const anchorProfiles = Array.isArray(prior.anchorProfiles) ? prior.anchorProfiles : [];
      for (const anchor of anchorProfiles) {
        records.push({
          artifactType: "behavior_capability_record_v1",
          artifactVersion: "1.0",
          recordId: `${slug(effectName)}-${slug(prior.parameterName)}-${slug(prior.geometryProfile)}-${slug(prior.paletteMode)}-${slug(String(anchor.parameterValue))}`,
          createdAt: new Date().toISOString(),
          effectName,
          geometryProfile: str(prior.geometryProfile),
          modelType: str(anchor.modelType || effect?.screeningLearning?.configurationRepresentativeness?.profiles?.find((p) => p.geometryProfile === prior.geometryProfile)?.modelType),
          parameterRegion: {
            parameterName: str(prior.parameterName),
            regionKind: "single_value",
            valueSummary: String(anchor.parameterValue),
            interactionAssumptions: []
          },
          sharedSettingsContext: {
            paletteMode: str(prior.paletteMode)
          },
          paletteContext: {
            paletteMode: str(prior.paletteMode)
          },
          behaviorSignals: {
            primaryMotion: Array.isArray(anchor.temporalSignatureHints) ? anchor.temporalSignatureHints[0] || "unknown" : "unknown",
            primaryTexture: Array.isArray(anchor.behaviorHints) ? anchor.behaviorHints[0] || "unknown" : "unknown",
            motionPacing: Array.isArray(anchor.temporalSignatureHints) ? anchor.temporalSignatureHints.join(",") : "",
            textureDensity: Array.isArray(anchor.behaviorHints) ? anchor.behaviorHints.join(",") : "",
            energyLevel: anchor.meanTemporalMotion >= 0.08 ? "elevated" : anchor.meanTemporalMotion > 0.02 ? "moderate" : "restrained",
            coverageLevel: anchor.meanNonBlankRatio >= 0.75 ? "broad" : anchor.meanNonBlankRatio >= 0.35 ? "focused" : "sparse",
            hierarchySuitability: "unknown",
            geometryCoupling: "observed",
            stability: str(prior.confidence || "low")
          },
          renderOutcomeSignals: {
            temporalRead: Array.isArray(anchor.temporalSignatureHints) ? anchor.temporalSignatureHints[0] || "unknown" : "unknown",
            densityRead: anchor.meanNonBlankRatio >= 0.75 ? "dense" : anchor.meanNonBlankRatio >= 0.35 ? "moderate" : "sparse",
            nonBlankRatio: anchor.meanNonBlankRatio || 0,
            temporalMotion: anchor.meanTemporalMotion || 0,
            temporalColorDelta: anchor.meanTemporalColorDelta || 0,
            temporalBrightnessDelta: anchor.meanTemporalBrightnessDelta || 0,
            clarityRead: "unknown",
            contrastRead: "unknown"
          },
          confidence: {
            level: str(prior.confidence || "low"),
            evidenceClass: "aggregated_render",
            coverageStatus: str(prior.configurationCoverageStatus || "narrow")
          },
          evidenceCount: Number(anchor.sampleCount || prior.sampleCount || 0),
          traceability: {
            sourceArtifactIds: ["sequencer_unified_training_set_v1"],
            sourceGeometryProfiles: [str(prior.geometryProfile)],
            generatedBy: "build-behavior-capability-records.mjs"
          }
        });
      }
    }
  } else {
    records.push({
      artifactType: "behavior_capability_record_v1",
      artifactVersion: "1.0",
      recordId: `${slug(effectName)}-baseline`,
      createdAt: new Date().toISOString(),
      effectName,
      geometryProfile: "cross_geometry",
      modelType: "mixed",
      parameterRegion: {
        parameterName: "baseline",
        regionKind: "cluster",
        valueSummary: "current_baseline_capability",
        interactionAssumptions: []
      },
      sharedSettingsContext: {},
      paletteContext: {},
      behaviorSignals: {
        primaryMotion: Array.isArray(effect?.baseline?.intentTags) ? effect.baseline.intentTags[0] || "unknown" : "unknown",
        primaryTexture: Array.isArray(effect?.baseline?.patternFamilies) ? effect.baseline.patternFamilies[0] || "unknown" : "unknown",
        motionPacing: Array.isArray(effect?.baseline?.intentTags) ? effect.baseline.intentTags.join(",") : "",
        textureDensity: Array.isArray(effect?.baseline?.patternFamilies) ? effect.baseline.patternFamilies.join(",") : "",
        energyLevel: "unknown",
        coverageLevel: "unknown",
        hierarchySuitability: "unknown",
        geometryCoupling: "mixed",
        stability: "low"
      },
      renderOutcomeSignals: {
        temporalRead: "unknown",
        densityRead: "unknown",
        nonBlankRatio: 0,
        temporalMotion: 0,
        temporalColorDelta: 0,
        temporalBrightnessDelta: 0,
        clarityRead: "unknown",
        contrastRead: "unknown"
      },
      confidence: {
        level: "low",
        evidenceClass: "aggregated_render",
        coverageStatus: str(effect?.parameterLearning?.coverageStatus || "narrow")
      },
      evidenceCount: Number(effect?.screeningLearning?.screeningRecordCount || 0),
      traceability: {
        sourceArtifactIds: ["sequencer_unified_training_set_v1"],
        sourceGeometryProfiles: Array.isArray(effect?.baseline?.supportedGeometryProfiles) ? effect.baseline.supportedGeometryProfiles : [],
        generatedBy: "build-behavior-capability-records.mjs"
      }
    });
  }
}

for (const record of records) {
  writeFileSync(join(outputDir, `${record.recordId}.json`), `${JSON.stringify(record, null, 2)}\n`, "utf8");
}

writeFileSync(join(outputDir, `index.json`), `${JSON.stringify({
  artifactType: "behavior_capability_record_index_v1",
  artifactVersion: "1.0",
  generatedAt: new Date().toISOString(),
  recordCount: records.length
}, null, 2)}\n`, "utf8");

console.log(JSON.stringify({ ok: true, artifactType: "behavior_capability_record_index_v1", outputDir, recordCount: records.length }, null, 2));
