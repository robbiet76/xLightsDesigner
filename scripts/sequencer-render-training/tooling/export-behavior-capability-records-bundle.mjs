#!/usr/bin/env node
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function str(value = "") {
  return String(value || "").trim();
}

const inputDir = process.argv[2]
  ? resolve(process.argv[2])
  : resolve("scripts/sequencer-render-training/catalog/generated-records/behavior-capability-records");
const outputPath = process.argv[3]
  ? resolve(process.argv[3])
  : resolve("apps/xlightsdesigner-ui/agent/sequence-agent/generated/behavior-capability-records-bundle.js");

const files = readdirSync(inputDir)
  .filter((fileName) => fileName.endsWith(".json") && fileName !== "index.json")
  .sort((a, b) => a.localeCompare(b));

const records = files.map((fileName) => {
  const record = JSON.parse(readFileSync(join(inputDir, fileName), "utf8"));
  return {
    recordId: str(record.recordId),
    effectName: str(record.effectName),
    geometryProfile: str(record.geometryProfile),
    modelType: str(record.modelType),
    parameterRegion: {
      parameterName: str(record.parameterRegion?.parameterName),
      regionKind: str(record.parameterRegion?.regionKind),
      valueSummary: str(record.parameterRegion?.valueSummary)
    },
    paletteMode: str(record.paletteContext?.paletteMode || record.sharedSettingsContext?.paletteMode),
    behaviorSignals: {
      primaryMotion: str(record.behaviorSignals?.primaryMotion),
      primaryTexture: str(record.behaviorSignals?.primaryTexture),
      motionPacing: str(record.behaviorSignals?.motionPacing),
      textureDensity: str(record.behaviorSignals?.textureDensity),
      energyLevel: str(record.behaviorSignals?.energyLevel),
      coverageLevel: str(record.behaviorSignals?.coverageLevel),
      geometryCoupling: str(record.behaviorSignals?.geometryCoupling),
      stability: str(record.behaviorSignals?.stability)
    },
    renderOutcomeSignals: {
      temporalRead: str(record.renderOutcomeSignals?.temporalRead),
      densityRead: str(record.renderOutcomeSignals?.densityRead),
      nonBlankRatio: Number(record.renderOutcomeSignals?.nonBlankRatio || 0),
      temporalMotion: Number(record.renderOutcomeSignals?.temporalMotion || 0),
      temporalColorDelta: Number(record.renderOutcomeSignals?.temporalColorDelta || 0),
      temporalBrightnessDelta: Number(record.renderOutcomeSignals?.temporalBrightnessDelta || 0)
    },
    confidence: {
      level: str(record.confidence?.level),
      evidenceClass: str(record.confidence?.evidenceClass),
      coverageStatus: str(record.confidence?.coverageStatus)
    },
    evidenceCount: Number(record.evidenceCount || 0),
    traceability: {
      sourceGeometryProfiles: Array.isArray(record.traceability?.sourceGeometryProfiles)
        ? record.traceability.sourceGeometryProfiles.map((row) => str(row)).filter(Boolean)
        : []
    }
  };
});

const bundle = {
  artifactType: "sequencer_configured_behavior_capabilities_bundle",
  artifactVersion: "1.0",
  sourceArtifactType: "behavior_capability_record_index_v1",
  generatedAt: new Date().toISOString(),
  recordType: "behavior_capability_record_v1",
  recordCount: records.length,
  effects: [...new Set(records.map((row) => row.effectName).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
  records
};

writeFileSync(
  outputPath,
  `export const BEHAVIOR_CAPABILITY_RECORDS_BUNDLE = ${JSON.stringify(bundle, null, 2)};\n`,
  "utf8"
);

console.log(JSON.stringify({ ok: true, outputPath, recordCount: records.length }, null, 2));
