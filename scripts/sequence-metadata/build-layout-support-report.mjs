import fs from "node:fs";
import path from "node:path";

import { buildNormalizedTargetMetadataRecords } from "../../apps/xlightsdesigner-ui/runtime/target-metadata-runtime.js";

function norm(value = "") {
  return String(value || "").trim();
}

function readAppState(inputPath) {
  const raw = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  return JSON.parse(raw.localStateRaw);
}

function summarizeByTargetKind(records = []) {
  return records.reduce((out, row) => {
    const key = norm(row?.targetKind || "unknown") || "unknown";
    out[key] = Number(out[key] || 0) + 1;
    return out;
  }, {});
}

function summarizeModelSlices(records = []) {
  const out = {};
  for (const row of records) {
    if (row?.targetKind !== "model") continue;
    const key = norm(row?.identity?.canonicalType || "unknown") || "unknown";
    const entry = out[key] || {
      total: 0,
      trainedSupported: 0,
      runtimeOnly: 0,
      examples: []
    };
    entry.total += 1;
    if (row?.training?.trainedSupportState === "trained_supported") {
      entry.trainedSupported += 1;
    } else {
      entry.runtimeOnly += 1;
      if (entry.examples.length < 8) entry.examples.push(norm(row?.identity?.displayName || row?.targetId));
    }
    out[key] = entry;
  }
  return out;
}

function summarizeSubmodelSupport(records = []) {
  const submodels = records.filter((row) => row?.targetKind === "submodel");
  const withParentIdentity = submodels.filter((row) => (
    norm(row?.identity?.parentId)
    || norm(row?.structure?.submodelMetadata?.parentId)
  ));
  const withNodeCoverage = submodels.filter((row) => (
    Number(row?.structure?.submodelMetadata?.nodeCoverage?.nodeCount || 0) > 0
  ));
  return {
    total: submodels.length,
    withParentIdentity: withParentIdentity.length,
    withNodeCoverage: withNodeCoverage.length
  };
}

function summarizeRecords(records = []) {
  const modelSlices = summarizeModelSlices(records);
  return {
    totalTargets: records.length,
    modelCount: records.filter((row) => row?.targetKind === "model").length,
    groupCount: records.filter((row) => row?.targetKind === "group").length,
    submodelCount: records.filter((row) => row?.targetKind === "submodel").length,
    byTargetKind: summarizeByTargetKind(records),
    modelSlices,
    runtimeOnlyModelCount: Object.values(modelSlices).reduce((sum, row) => sum + Number(row.runtimeOnly || 0), 0),
    trainedSupportedModelCount: Object.values(modelSlices).reduce((sum, row) => sum + Number(row.trainedSupported || 0), 0),
    submodelSupport: summarizeSubmodelSupport(records)
  };
}

function summarizeCustomModelStructure(records = []) {
  const profileCounts = {};
  let customModelCount = 0;
  let modelsWithSubmodels = 0;
  for (const row of records) {
    const structure = row?.structure?.customStructure;
    if (row?.targetKind !== "model" || !structure) continue;
    customModelCount += 1;
    if (Number(structure?.submodels?.count || 0) > 0) modelsWithSubmodels += 1;
    const profile = norm(structure?.profile || "unknown") || "unknown";
    profileCounts[profile] = Number(profileCounts[profile] || 0) + 1;
  }
  return { customModelCount, modelsWithSubmodels, profileCounts };
}

function defaultAppStatePath() {
  return path.join(process.env.HOME || "", "Library/Application Support/xLightsDesigner/xlightsdesigner-state.json");
}

function main() {
  const inputPath = process.argv[2] || defaultAppStatePath();
  const outputPath = process.argv[3] || "/tmp/layout-support-report.v1.json";
  const state = readAppState(inputPath);
  const records = buildNormalizedTargetMetadataRecords({
    sceneGraph: state.sceneGraph || {},
    metadataAssignments: state.metadata?.assignments || [],
    metadataPreferencesByTargetId: state.metadata?.preferencesByTargetId || {}
  });
  const report = {
    artifactType: "layout_support_report_v1",
    artifactVersion: "1.0",
    createdAt: new Date().toISOString(),
    sourceStatePath: inputPath,
    sequencePath: norm(state.sequencePathInput),
    projectName: norm(state.projectName),
    metadataTagCount: Array.isArray(state.metadata?.tags) ? state.metadata.tags.length : 0,
    metadataAssignmentCount: Array.isArray(state.metadata?.assignments) ? state.metadata.assignments.length : 0,
    summary: {
      ...summarizeRecords(records),
      customModelStructure: summarizeCustomModelStructure(records)
    },
    records
  };
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(outputPath);
}

main();
