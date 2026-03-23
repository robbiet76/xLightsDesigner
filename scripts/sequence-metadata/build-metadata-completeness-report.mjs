import fs from "node:fs";
import path from "node:path";

import { buildNormalizedTargetMetadataRecords } from "../../apps/xlightsdesigner-ui/runtime/target-metadata-runtime.js";

function norm(value = "") {
  return String(value || "").trim();
}

function low(value = "") {
  return norm(value).toLowerCase();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function readDesktopState(inputPath) {
  const raw = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  return JSON.parse(raw.localStateRaw);
}

function increment(map, key) {
  map[key] = Number(map[key] || 0) + 1;
}

function summarizeByTargetKind(records = []) {
  const out = {};
  for (const record of arr(records)) {
    const kind = norm(record?.targetKind || "unknown") || "unknown";
    const bucket = out[kind] || {
      total: 0,
      overall: {},
      structure: {},
      semantic: {},
      role: {},
      submodel: {},
      sequencing: {}
    };
    bucket.total += 1;
    const completeness = record?.semantics?.metadataCompleteness || {};
    increment(bucket.overall, norm(completeness?.overall || "unknown") || "unknown");
    increment(bucket.structure, norm(completeness?.structure || "unknown") || "unknown");
    increment(bucket.semantic, norm(completeness?.semantic || "unknown") || "unknown");
    increment(bucket.role, norm(completeness?.role || "unknown") || "unknown");
    increment(bucket.submodel, norm(completeness?.submodel || "unknown") || "unknown");
    increment(bucket.sequencing, norm(completeness?.sequencing || "unknown") || "unknown");
    out[kind] = bucket;
  }
  return out;
}

function summarizeModelSlices(records = []) {
  const models = arr(records).filter((row) => row?.targetKind === "model");
  const builtIn = models.filter((row) => low(row?.identity?.canonicalType) && low(row?.identity?.canonicalType) !== "custom");
  const custom = models.filter((row) => low(row?.identity?.canonicalType) === "custom");
  const summarizeOverall = (rows) => {
    const out = { total: rows.length, overall: {} };
    for (const row of rows) {
      increment(out.overall, norm(row?.semantics?.metadataCompleteness?.overall || "unknown") || "unknown");
    }
    return out;
  };
  return {
    builtInModels: summarizeOverall(builtIn),
    customModels: summarizeOverall(custom)
  };
}

function extractGapExamples(records = [], limit = 20) {
  return arr(records)
    .filter((row) => norm(row?.semantics?.metadataCompleteness?.overall) !== "metadata_ready")
    .sort((a, b) => {
      const kindCmp = norm(a?.targetKind).localeCompare(norm(b?.targetKind));
      if (kindCmp !== 0) return kindCmp;
      return norm(a?.identity?.displayName || a?.targetId).localeCompare(norm(b?.identity?.displayName || b?.targetId));
    })
    .slice(0, Math.max(1, Number(limit) || 20))
    .map((row) => ({
      targetId: norm(row?.targetId),
      targetKind: norm(row?.targetKind),
      displayName: norm(row?.identity?.displayName || row?.targetId),
      canonicalType: norm(row?.identity?.canonicalType),
      overall: norm(row?.semantics?.metadataCompleteness?.overall),
      structure: norm(row?.semantics?.metadataCompleteness?.structure),
      semantic: norm(row?.semantics?.metadataCompleteness?.semantic),
      role: norm(row?.semantics?.metadataCompleteness?.role),
      submodel: norm(row?.semantics?.metadataCompleteness?.submodel),
      sequencing: norm(row?.semantics?.metadataCompleteness?.sequencing)
    }));
}

function main() {
  const inputPath = process.argv[2] || path.join(process.env.HOME || "", "Library/Application Support/xlightsdesigner-desktop-v2/xlightsdesigner-state.json");
  const outputPath = process.argv[3] || "/tmp/metadata-completeness-report.v1.json";
  const state = readDesktopState(inputPath);
  const records = buildNormalizedTargetMetadataRecords({
    sceneGraph: state.sceneGraph || {},
    metadataAssignments: state.metadata?.assignments || [],
    metadataPreferencesByTargetId: state.metadata?.preferencesByTargetId || {}
  });
  const report = {
    artifactType: "metadata_completeness_report_v1",
    artifactVersion: "1.0",
    createdAt: new Date().toISOString(),
    sourceStatePath: inputPath,
    sequencePath: norm(state.sequencePathInput),
    summary: {
      totalTargets: records.length,
      byTargetKind: summarizeByTargetKind(records),
      modelSlices: summarizeModelSlices(records)
    },
    gapExamples: extractGapExamples(records, 40)
  };
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(outputPath);
}

main();
