#!/usr/bin/env node

import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadScreeningRecordCatalog } from "./screening-record-catalog.mjs";

function str(value = "") {
  return String(value || "").trim();
}

function slug(value = "") {
  return str(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "unknown";
}

function round6(value = 0) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? Number(num.toFixed(6)) : 0;
}

function firstFiniteOrNaN(...values) {
  for (const value of values) {
    const num = Number(value);
    if (Number.isFinite(num)) return num;
  }
  return NaN;
}

function rgbTuple(value) {
  if (!Array.isArray(value) || value.length < 3) return null;
  return value.slice(0, 3).map((channel) => Math.max(0, Math.min(255, Math.round(Number(channel) || 0))));
}

function rgbEnergy(tuple = []) {
  return Number(tuple[0] || 0) + Number(tuple[1] || 0) + Number(tuple[2] || 0);
}

function colorClassKey(tuple = []) {
  const max = Math.max(Number(tuple[0] || 0), Number(tuple[1] || 0), Number(tuple[2] || 0));
  const min = Math.min(Number(tuple[0] || 0), Number(tuple[1] || 0), Number(tuple[2] || 0));
  if (max <= 8) return "";
  if (max - min <= 12) return "white";
  return tuple.map((channel) => Math.round((Number(channel || 0) / max) * 4) / 4).join(",");
}

function rgbDistance(a = [], b = []) {
  const dr = Number(a[0] || 0) - Number(b[0] || 0);
  const dg = Number(a[1] || 0) - Number(b[1] || 0);
  const db = Number(a[2] || 0) - Number(b[2] || 0);
  return Math.sqrt((dr * dr) + (dg * dg) + (db * db)) / Math.sqrt(3 * 255 * 255);
}

function average(values = []) {
  const nums = values.map(Number).filter(Number.isFinite);
  return nums.length ? nums.reduce((sum, value) => sum + value, 0) / nums.length : NaN;
}

function frameRgbRows(features = {}) {
  if (!Array.isArray(features?.frames)) return [];
  return features.frames
    .map((frame) => Array.isArray(frame?.nodeRgb) ? frame.nodeRgb.map(rgbTuple).filter(Boolean) : [])
    .filter((rows) => rows.length);
}

function calculateRenderedColorMetrics(record = {}) {
  const frames = frameRgbRows(record?.features || {});
  if (!frames.length) {
    return {
      renderedColorDiversity: NaN,
      renderedDominantColorStability: NaN,
      renderedColorBandDensity: NaN,
      renderedGradientSmoothness: NaN,
      renderedTemporalColorTravel: NaN
    };
  }
  const distinctColors = new Set();
  const dominantKeys = [];
  const bandDensities = [];
  const adjacentSmoothness = [];
  let temporalTravelSum = 0;
  let temporalTravelPairs = 0;
  let activeFrameCount = 0;

  for (const frame of frames) {
    const active = frame.filter((tuple) => rgbEnergy(tuple) > 8);
    if (!active.length) continue;
    activeFrameCount += 1;
    const counts = new Map();
    for (const tuple of active) {
      const key = colorClassKey(tuple);
      if (!key) continue;
      distinctColors.add(key);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    dominantKeys.push(dominant?.[0] || "");

    let transitions = 0;
    let adjacentDelta = 0;
    let adjacentPairs = 0;
    let previousActiveKey = "";
    let previousActiveTuple = null;
    for (const tuple of frame) {
      if (rgbEnergy(tuple) <= 8) continue;
      const key = colorClassKey(tuple);
      if (!key) continue;
      if (previousActiveKey && key !== previousActiveKey) transitions += 1;
      if (previousActiveTuple) {
        adjacentDelta += rgbDistance(previousActiveTuple, tuple);
        adjacentPairs += 1;
      }
      previousActiveKey = key;
      previousActiveTuple = tuple;
    }
    bandDensities.push(active.length > 1 ? transitions / (active.length - 1) : 0);
    adjacentSmoothness.push(adjacentPairs ? Math.max(0, 1 - (adjacentDelta / adjacentPairs)) : 1);
  }

  if (!activeFrameCount) {
    return {
      renderedColorDiversity: NaN,
      renderedDominantColorStability: NaN,
      renderedColorBandDensity: NaN,
      renderedGradientSmoothness: NaN,
      renderedTemporalColorTravel: NaN
    };
  }

  for (let index = 1; index < frames.length; index += 1) {
    const previous = frames[index - 1];
    const current = frames[index];
    const length = Math.min(previous.length, current.length);
    for (let nodeIndex = 0; nodeIndex < length; nodeIndex += 1) {
      temporalTravelSum += rgbDistance(previous[nodeIndex], current[nodeIndex]);
      temporalTravelPairs += 1;
    }
  }

  let dominantTransitions = 0;
  let dominantComparisons = 0;
  for (let index = 1; index < dominantKeys.length; index += 1) {
    const previous = dominantKeys[index - 1];
    const current = dominantKeys[index];
    if (!previous || !current) continue;
    dominantComparisons += 1;
    if (previous !== current) dominantTransitions += 1;
  }

  return {
    renderedColorDiversity: round6(Math.min(1, distinctColors.size / 8)),
    renderedDominantColorStability: round6(dominantComparisons ? 1 - (dominantTransitions / dominantComparisons) : 1),
    renderedColorBandDensity: round6(average(bandDensities)),
    renderedGradientSmoothness: round6(average(adjacentSmoothness)),
    renderedTemporalColorTravel: round6(temporalTravelPairs ? temporalTravelSum / temporalTravelPairs : 0)
  };
}

function compactScreeningRecord(record = {}) {
  if (!record || record.recordVersion !== "1.0") return record;
  const features = record.features || {};
  const fixture = record.fixture || {};
  const sharedSettings = record.sharedSettings || {};
  const modelMetadata = record.modelMetadata || {};
  const colorMetrics = calculateRenderedColorMetrics(record);
  return {
    recordVersion: record.recordVersion,
    sampleId: record.sampleId,
    effectName: record.effectName,
    placementId: record.placementId,
    effectSettings: record.effectSettings || {},
    sharedSettings: {
      renderStyle: sharedSettings.renderStyle,
      paletteProfile: sharedSettings.paletteProfile,
      palette: sharedSettings.palette || {},
      trainingBrightnessPercent: sharedSettings.trainingBrightnessPercent,
      trainingPaletteStandard: sharedSettings.trainingPaletteStandard,
      brightnessPolicy: sharedSettings.brightnessPolicy,
      paletteActivationMode: sharedSettings.paletteActivationMode,
      paletteActiveSlots: Array.isArray(sharedSettings.paletteActiveSlots) ? sharedSettings.paletteActiveSlots : []
    },
    trainingContext: record.trainingContext || {},
    observations: record.observations || {},
    fixture: {
      modelType: fixture.modelType,
      geometryProfile: fixture.geometryProfile,
      expectedModelType: fixture.expectedModelType,
      startMs: fixture.startMs,
      endMs: fixture.endMs,
      durationMs: fixture.durationMs,
      durationClass: fixture.durationClass
    },
    modelMetadata: {
      displayAsNormalized: modelMetadata.displayAsNormalized,
      resolvedModelType: modelMetadata.resolvedModelType,
      resolvedGeometryProfile: modelMetadata.resolvedGeometryProfile,
      geometryTraits: Array.isArray(modelMetadata.geometryTraits) ? modelMetadata.geometryTraits : [],
      analyzerFamily: modelMetadata.analyzerFamily,
      structuralSettings: modelMetadata.structuralSettings || {},
      stringType: modelMetadata.stringType,
      nodeCount: modelMetadata.nodeCount,
      channelsPerNode: modelMetadata.channelsPerNode
    },
    features: {
      temporalMotionMean: features.temporalMotionMean,
      temporalChangeMean: features.temporalChangeMean,
      centroidMotionMean: features.centroidMotionMean,
      temporalColorDeltaMean: features.temporalColorDeltaMean,
      temporalRgbDeltaMean: features.temporalRgbDeltaMean,
      temporalBrightnessDeltaMean: features.temporalBrightnessDeltaMean,
      nonBlankSampledFrameRatio: features.nonBlankSampledFrameRatio,
      averageActiveNodeRatio: features.averageActiveNodeRatio,
      maxActiveNodeRatio: features.maxActiveNodeRatio,
      temporalSignature: features.temporalSignature,
      renderedColorDiversity: firstFiniteOrNaN(features.renderedColorDiversity, colorMetrics.renderedColorDiversity),
      renderedDominantColorStability: firstFiniteOrNaN(features.renderedDominantColorStability, colorMetrics.renderedDominantColorStability),
      renderedColorBandDensity: firstFiniteOrNaN(features.renderedColorBandDensity, colorMetrics.renderedColorBandDensity),
      renderedGradientSmoothness: firstFiniteOrNaN(features.renderedGradientSmoothness, colorMetrics.renderedGradientSmoothness),
      renderedTemporalColorTravel: firstFiniteOrNaN(features.renderedTemporalColorTravel, colorMetrics.renderedTemporalColorTravel),
      analysis: {
        qualitySignals: features?.analysis?.qualitySignals || {}
      }
    }
  };
}

function parseArgs(argv = []) {
  const args = {
    source: "scripts/sequencer-render-training/catalog/effect-screening-record-packs",
    outDir: "scripts/sequencer-render-training/catalog/effect-screening-record-packs"
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--source") args.source = argv[++index];
    else if (arg === "--out-dir") args.outDir = argv[++index];
    else if (arg === "--help") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return `Usage:
  node scripts/sequencer-render-training/tooling/pack-effect-screening-records.mjs [--source <record-dir>] [--out-dir <pack-dir>]
`;
}

export function packEffectScreeningRecords({ source, outDir } = {}) {
  const resolvedOut = path.resolve(outDir);
  const stagingOut = `${resolvedOut}.tmp-${process.pid}`;
  rmSync(stagingOut, { recursive: true, force: true });
  mkdirSync(stagingOut, { recursive: true });
  const recordsBySampleId = new Map();
  for (const record of loadScreeningRecordCatalog(path.resolve(source), { compactRecord: compactScreeningRecord })) {
    const key = [
      slug(record.effectName),
      slug(record.fixture?.geometryProfile || record.fixture?.modelType),
      slug(record.trainingContext?.screeningPaletteMode || record.trainingContext?.trainingPaletteStandard || record.sharedSettings?.paletteProfile),
      str(record.sampleId) || `sample-${recordsBySampleId.size}`
    ].filter(Boolean).join(":");
    recordsBySampleId.set(key, record);
  }
  const records = [...recordsBySampleId.values()];
  const byEffect = new Map();
  for (const record of records) {
    const key = slug(record.effectName);
    if (!byEffect.has(key)) byEffect.set(key, []);
    byEffect.get(key).push(record);
  }
  const packs = [];
  for (const [effectSlug, rows] of [...byEffect.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    rows.sort((a, b) => str(a.sampleId).localeCompare(str(b.sampleId)));
    const fileName = `${effectSlug}.records.jsonl`;
    const filePath = path.join(stagingOut, fileName);
    writeFileSync(filePath, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");
    packs.push({
      effectSlug,
      fileName,
      recordCount: rows.length,
      effectNames: [...new Set(rows.map((row) => str(row.effectName)).filter(Boolean))].sort((a, b) => a.localeCompare(b))
    });
  }
  const index = {
    artifactType: "effect_screening_record_pack_index_v1",
    artifactVersion: "1.0",
    generatedAt: new Date().toISOString(),
    source,
    compactionPolicy: "promoted_runtime_training_evidence_without_raw_frame_payloads_artifact_paths_channel_addresses_or_machine_local_palette_paths",
    recordCount: records.length,
    packCount: packs.length,
    packs
  };
  writeFileSync(path.join(stagingOut, "index.json"), `${JSON.stringify(index, null, 2)}\n`, "utf8");
  rmSync(resolvedOut, { recursive: true, force: true });
  renameSync(stagingOut, resolvedOut);
  return index;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      process.stdout.write(usage());
      process.exit(0);
    }
    const result = packEffectScreeningRecords(args);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    console.error(error?.stack || String(error));
    process.exit(1);
  }
}
