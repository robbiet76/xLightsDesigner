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

function unique(values = []) {
  return [...new Set(arr(values).map((row) => norm(row)).filter(Boolean))];
}

function readDesktopState(inputPath) {
  const raw = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  return JSON.parse(raw.localStateRaw);
}

function buildTraitSet(record = {}) {
  return new Set([
    ...arr(record?.semantics?.inferredSemanticTraits),
    ...arr(record?.user?.semanticHints),
    ...arr(record?.user?.tags),
    norm(record?.identity?.canonicalType)
  ].map((row) => low(row)).filter(Boolean));
}

function buildExplicitMetadataTraitSet(record = {}) {
  return new Set([
    ...arr(record?.user?.semanticHints),
    ...arr(record?.user?.tags)
  ].map((row) => low(row)).filter(Boolean));
}

function deriveCandidateBucketsFromTraits(traits = new Set()) {
  const matches = [];
  const reasons = [];
  if (traits.has("tree_like")) {
    matches.push("tree_flat", "tree_360");
    reasons.push("Metadata indicates tree-like structure.");
  }
  if (traits.has("radial_like")) {
    matches.push("spinner", "star");
    reasons.push("Metadata indicates radial or rotational structure.");
  }
  if (traits.has("linear_like")) {
    matches.push("single_line", "cane");
    reasons.push("Metadata indicates linear or cane-like structure.");
  }
  if (traits.has("matrix_like")) {
    matches.push("matrix");
    reasons.push("Metadata indicates matrix-like behavior.");
  }
  if (traits.has("icicle_like")) {
    matches.push("icicles");
    reasons.push("Metadata indicates icicle-like behavior.");
  }
  if (traits.has("arch_like")) {
    matches.push("arch");
    reasons.push("Metadata indicates arch-like behavior.");
  }
  return {
    candidateBuckets: unique(matches),
    reasons
  };
}

function classifyCustomModelStage1Candidate(record = {}) {
  const canonicalType = low(record?.identity?.canonicalType);
  const explicitMetadataTraits = buildExplicitMetadataTraitSet(record);
  const rolePreference = low(record?.user?.rolePreference);
  const trainedBuckets = arr(record?.training?.trainedModelBuckets).map((row) => norm(row)).filter(Boolean);

  if (canonicalType && canonicalType !== "custom") {
    return {
      status: trainedBuckets.length ? "stage1_mapped" : "metadata_partial",
      candidateBuckets: trainedBuckets,
      confidence: Number(record?.provenance?.confidence || 0),
      reasons: [
        trainedBuckets.length
          ? `Already maps to Stage 1 buckets: ${trainedBuckets.join(", ")}.`
          : `Canonical type is ${canonicalType}, but no Stage 1 bucket is currently mapped.`
      ]
    };
  }

  const explicit = deriveCandidateBucketsFromTraits(explicitMetadataTraits);
  if (explicit.candidateBuckets.length) {
    return {
      status: "metadata_ready",
      candidateBuckets: explicit.candidateBuckets,
      confidence: Math.max(0.5, Number(record?.provenance?.confidence || 0)),
      basis: "explicit_metadata",
      reasons: explicit.reasons
    };
  }

  const metadataSignals = unique([
    ...arr(record?.user?.semanticHints),
    ...arr(record?.user?.tags),
    rolePreference ? `role:${rolePreference}` : ""
  ]);

  if (metadataSignals.length) {
    return {
      status: "metadata_partial",
      candidateBuckets: [],
      confidence: Math.max(0.35, Number(record?.provenance?.confidence || 0)),
      basis: "explicit_metadata",
      reasons: [
        `Metadata signals exist but do not yet map cleanly to Stage 1 buckets: ${metadataSignals.join(", ")}.`
      ]
    };
  }

  return {
    status: "metadata_needed",
    candidateBuckets: [],
    confidence: Number(record?.provenance?.confidence || 0),
    basis: "none",
    reasons: [
      "Custom target has no strong metadata-driven mapping to an existing Stage 1 bucket yet."
    ]
  };
}

function summarize(records = [], candidates = []) {
  const modelRecords = records.filter((row) => row?.targetKind === "model");
  const customModels = modelRecords.filter((row) => low(row?.identity?.canonicalType) === "custom");
  const byStatus = {};
  for (const row of candidates) {
    const key = norm(row?.classification?.status || "unknown") || "unknown";
    byStatus[key] = Number(byStatus[key] || 0) + 1;
  }
  const bucketCounts = {};
  for (const row of candidates) {
    for (const bucket of arr(row?.classification?.candidateBuckets)) {
      bucketCounts[bucket] = Number(bucketCounts[bucket] || 0) + 1;
    }
  }
  return {
    modelCount: modelRecords.length,
    customModelCount: customModels.length,
    classificationCounts: byStatus,
    candidateBucketCounts: bucketCounts
  };
}

function main() {
  const inputPath = process.argv[2] || path.join(process.env.HOME || "", "Library/Application Support/xlightsdesigner-desktop-v2/xlightsdesigner-state.json");
  const outputPath = process.argv[3] || "/tmp/custom-model-stage1-candidate-report.v1.json";
  const state = readDesktopState(inputPath);
  const records = buildNormalizedTargetMetadataRecords({
    sceneGraph: state.sceneGraph || {},
    metadataAssignments: state.metadata?.assignments || [],
    metadataPreferencesByTargetId: state.metadata?.preferencesByTargetId || {}
  });
  const modelRecords = records.filter((row) => row?.targetKind === "model");
  const candidates = modelRecords.map((record) => ({
    targetId: record.targetId,
    displayName: norm(record?.identity?.displayName || record?.targetId),
    canonicalType: norm(record?.identity?.canonicalType),
    supportState: norm(record?.training?.trainedSupportState),
    inferredSemanticTraits: arr(record?.semantics?.inferredSemanticTraits),
    semanticHints: arr(record?.user?.semanticHints),
    tags: arr(record?.user?.tags),
    classification: classifyCustomModelStage1Candidate(record)
  }));
  const report = {
    artifactType: "custom_model_stage1_candidate_report_v1",
    artifactVersion: "1.0",
    createdAt: new Date().toISOString(),
    sourceStatePath: inputPath,
    sequencePath: norm(state.sequencePathInput),
    summary: summarize(records, candidates.filter((row) => low(row?.canonicalType) === "custom")),
    candidates: candidates
      .filter((row) => low(row?.canonicalType) === "custom")
      .sort((a, b) => {
        const statusCmp = norm(a?.classification?.status).localeCompare(norm(b?.classification?.status));
        if (statusCmp !== 0) return statusCmp;
        return a.displayName.localeCompare(b.displayName);
      })
  };
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(outputPath);
}

main();
