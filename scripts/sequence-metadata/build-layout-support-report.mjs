import fs from "node:fs";
import path from "node:path";

import { classifyModelDisplayType } from "../../apps/xlightsdesigner-ui/agent/sequence-agent/model-type-catalog.js";
import { getStage1TrainedEffectBundle } from "../../apps/xlightsdesigner-ui/agent/sequence-agent/trained-effect-knowledge.js";

function norm(value = "") {
  return String(value || "").trim();
}

function low(value = "") {
  return norm(value).toLowerCase();
}

function unique(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map((row) => norm(row)).filter(Boolean))];
}

function mapClassificationToTrainingBuckets(classification = {}) {
  const rawType = low(classification?.rawType);
  const canonicalType = low(classification?.canonicalType);
  const buckets = new Set();
  if (canonicalType === "single_line" || canonicalType === "poly_line") buckets.add("single_line");
  if (canonicalType === "arches") buckets.add("arch");
  if (canonicalType === "candy_canes") buckets.add("cane");
  if (canonicalType === "spinner") buckets.add("spinner");
  if (canonicalType === "star") buckets.add("star");
  if (canonicalType === "matrix_horizontal" || canonicalType === "matrix_vertical") buckets.add("matrix");
  if (canonicalType === "icicles") buckets.add("icicles");
  if (canonicalType === "tree") {
    buckets.add("tree_360");
    buckets.add("tree_flat");
  }
  if (rawType.includes("tree flat")) buckets.add("tree_flat");
  if (rawType.includes("tree") && rawType.includes("360")) buckets.add("tree_360");
  return [...buckets];
}

function deriveRuntimeSupportState({ targetKind = "", active = true } = {}) {
  if (!active) return "runtime_unsupported";
  if (targetKind === "model" || targetKind === "group" || targetKind === "submodel") return "runtime_targetable";
  return "runtime_unsupported";
}

function deriveTrainingSupportState({ trainedBuckets = [] } = {}) {
  return trainedBuckets.length ? "trained_supported" : "runtime_targetable_only";
}

function readDesktopState(inputPath) {
  const raw = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  return JSON.parse(raw.localStateRaw);
}

function buildAssignmentIndex(assignments = []) {
  const index = new Map();
  for (const row of Array.isArray(assignments) ? assignments : []) {
    const targetId = norm(row?.targetId);
    if (!targetId) continue;
    index.set(targetId, {
      tags: unique(row?.tags),
      targetType: norm(row?.targetType),
      targetName: norm(row?.targetName),
      targetParentId: norm(row?.targetParentId),
      targetParentName: norm(row?.targetParentName)
    });
  }
  return index;
}

function buildGroupMembershipIndex(groupsById = {}) {
  const out = new Map();
  for (const group of Object.values(groupsById || {})) {
    const groupId = norm(group?.id || group?.name);
    if (!groupId) continue;
    const members = Array.isArray(group?.members?.flattened)
      ? group.members.flattened
      : Array.isArray(group?.members?.direct)
        ? group.members.direct
        : [];
    for (const member of members) {
      const memberId = norm(member?.id || member?.name);
      if (!memberId) continue;
      const list = out.get(memberId) || [];
      list.push(groupId);
      out.set(memberId, list);
    }
  }
  return out;
}

function buildRecordsFromSceneState(state = {}) {
  const sceneGraph = state.sceneGraph || {};
  const modelsById = sceneGraph.modelsById || {};
  const groupsById = sceneGraph.groupsById || {};
  const submodelsById = sceneGraph.submodelsById || {};
  const assignmentIndex = buildAssignmentIndex(state.metadata?.assignments || []);
  const groupMembershipIndex = buildGroupMembershipIndex(groupsById);
  const trainedBundle = getStage1TrainedEffectBundle();
  const selectorReadyEffects = unique(trainedBundle?.selectorReadyEffects);
  const trainedModelBuckets = new Set(Object.keys(trainedBundle?.modelTypeIndex || {}));

  const records = [];

  for (const model of Object.values(modelsById)) {
    const targetId = norm(model?.id || model?.name);
    if (!targetId) continue;
    const assignment = assignmentIndex.get(targetId) || {};
    const displayType = norm(model?.displayAs || model?.type || model?.displayType || "");
    const classification = classifyModelDisplayType(displayType);
    const buckets = mapClassificationToTrainingBuckets(classification).filter((bucket) => trainedModelBuckets.has(bucket));
    records.push({
      targetId,
      targetKind: "model",
      identity: {
        name: norm(model?.name || targetId),
        displayName: norm(model?.name || targetId),
        rawType: norm(displayType),
        canonicalType: norm(classification?.canonicalType),
        parentId: "",
        parentName: "",
        source: "layout.getModels"
      },
      structure: {
        geometryTraits: unique([classification?.canonicalType, classification?.category]),
        topologyTraits: [],
        spatialTraits: [],
        groupMemberships: unique(groupMembershipIndex.get(targetId) || []),
        submodelCount: Object.values(submodelsById).filter((row) => norm(row?.parentId) === targetId).length,
        nodeCount: Number(model?.nodeCount || model?.membership?.nodeCount || 0),
        coverageClass: "",
        renderRisk: ""
      },
      semantics: {
        inferredRole: "",
        inferredSemanticTraits: [],
        inferredMotionAffinities: [],
        inferredEffectAffinities: [],
        supportState: deriveTrainingSupportState({ trainedBuckets: buckets })
      },
      training: {
        trainedModelBuckets: buckets,
        trainedSupportState: buckets.length ? "trained_supported" : "out_of_stage1_model_support",
        trainingArtifactVersion: norm(trainedBundle?.artifactVersion || "1.0"),
        selectorReadyEffects,
        confidence: buckets.length ? 1 : 0
      },
      user: {
        rolePreference: "",
        semanticHints: [],
        effectPreferences: [],
        effectAvoidances: [],
        tags: unique(assignment.tags || [])
      },
      provenance: {
        inferredAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sources: ["layout", "training_bundle", "metadata_assignments"],
        confidence: buckets.length ? 1 : 0.25
      },
      runtimeSupportState: deriveRuntimeSupportState({ targetKind: "model", active: true })
    });
  }

  for (const group of Object.values(groupsById)) {
    const targetId = norm(group?.id || group?.name);
    if (!targetId) continue;
    const assignment = assignmentIndex.get(targetId) || {};
    const members = Array.isArray(group?.members?.flattened)
      ? group.members.flattened
      : Array.isArray(group?.members?.direct)
        ? group.members.direct
        : [];
    records.push({
      targetId,
      targetKind: "group",
      identity: {
        name: norm(group?.name || targetId),
        displayName: norm(group?.name || targetId),
        rawType: norm(group?.type || "group"),
        canonicalType: "model_group",
        parentId: "",
        parentName: "",
        source: "layout.getModelGroups"
      },
      structure: {
        geometryTraits: ["aggregate"],
        topologyTraits: ["group"],
        spatialTraits: [],
        groupMemberships: [],
        submodelCount: members.filter((row) => low(row?.type) === "submodel").length,
        nodeCount: 0,
        coverageClass: "aggregate",
        renderRisk: ""
      },
      semantics: {
        inferredRole: "",
        inferredSemanticTraits: [],
        inferredMotionAffinities: [],
        inferredEffectAffinities: [],
        supportState: "runtime_targetable_only"
      },
      training: {
        trainedModelBuckets: [],
        trainedSupportState: "runtime_targetable_only",
        trainingArtifactVersion: norm(trainedBundle?.artifactVersion || "1.0"),
        selectorReadyEffects,
        confidence: 0.5
      },
      user: {
        rolePreference: "",
        semanticHints: [],
        effectPreferences: [],
        effectAvoidances: [],
        tags: unique(assignment.tags || [])
      },
      provenance: {
        inferredAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sources: ["layout", "metadata_assignments"],
        confidence: 0.5
      },
      runtimeSupportState: deriveRuntimeSupportState({ targetKind: "group", active: true })
    });
  }

  for (const submodel of Object.values(submodelsById)) {
    const targetId = norm(submodel?.id || submodel?.name);
    if (!targetId) continue;
    const assignment = assignmentIndex.get(targetId) || {};
    const parentId = norm(submodel?.parentId);
    records.push({
      targetId,
      targetKind: "submodel",
      identity: {
        name: norm(submodel?.name || targetId),
        displayName: parentId ? `${parentId} / ${norm(submodel?.name || targetId)}` : norm(submodel?.name || targetId),
        rawType: "SubModel",
        canonicalType: "submodel",
        parentId,
        parentName: parentId,
        source: "layout.getSubmodels"
      },
      structure: {
        geometryTraits: ["submodel"],
        topologyTraits: [low(submodel?.renderPolicy?.submodelType || submodel?.submodelType || "ranges") || "ranges"],
        spatialTraits: [],
        groupMemberships: unique(groupMembershipIndex.get(targetId) || []),
        submodelCount: 0,
        nodeCount: Number(submodel?.membership?.nodeCount || 0),
        coverageClass: "detail",
        renderRisk: ""
      },
      semantics: {
        inferredRole: "",
        inferredSemanticTraits: [],
        inferredMotionAffinities: [],
        inferredEffectAffinities: [],
        supportState: "runtime_targetable_only"
      },
      training: {
        trainedModelBuckets: [],
        trainedSupportState: "runtime_targetable_only",
        trainingArtifactVersion: norm(trainedBundle?.artifactVersion || "1.0"),
        selectorReadyEffects,
        confidence: 0.5
      },
      user: {
        rolePreference: "",
        semanticHints: [],
        effectPreferences: [],
        effectAvoidances: [],
        tags: unique(assignment.tags || [])
      },
      provenance: {
        inferredAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sources: ["layout", "metadata_assignments"],
        confidence: 0.5
      },
      runtimeSupportState: deriveRuntimeSupportState({ targetKind: "submodel", active: true })
    });
  }

  return records;
}

function summarizeRecords(records = []) {
  const models = records.filter((row) => row.targetKind === "model");
  const groups = records.filter((row) => row.targetKind === "group");
  const submodels = records.filter((row) => row.targetKind === "submodel");
  const trainedSupportedModels = models.filter((row) => row.training.trainedSupportState === "trained_supported");
  const runtimeOnlyModels = models.filter((row) => row.training.trainedSupportState !== "trained_supported");

  const byCanonicalType = {};
  for (const row of models) {
    const key = norm(row?.identity?.canonicalType || "unknown") || "unknown";
    byCanonicalType[key] = Number(byCanonicalType[key] || 0) + 1;
  }

  const outOfStage1ByCanonicalType = {};
  for (const row of runtimeOnlyModels) {
    const key = norm(row?.identity?.canonicalType || "unknown") || "unknown";
    const list = outOfStage1ByCanonicalType[key] || [];
    list.push(row.targetId);
    outOfStage1ByCanonicalType[key] = list;
  }

  return {
    totalTargets: records.length,
    modelCount: models.length,
    groupCount: groups.length,
    submodelCount: submodels.length,
    trainedSupportedModelCount: trainedSupportedModels.length,
    runtimeOnlyModelCount: runtimeOnlyModels.length,
    canonicalTypeCounts: byCanonicalType,
    outOfStage1ByCanonicalType
  };
}

function main() {
  const inputPath = process.argv[2] || path.join(process.env.HOME || "", "Library/Application Support/xlightsdesigner-desktop/xlightsdesigner-state.json");
  const outputPath = process.argv[3] || "/tmp/layout-support-report.v1.json";
  const state = readDesktopState(inputPath);
  const records = buildRecordsFromSceneState(state);
  const report = {
    artifactType: "layout_support_report_v1",
    artifactVersion: "1.0",
    createdAt: new Date().toISOString(),
    sourceStatePath: inputPath,
    sequencePath: norm(state.sequencePathInput),
    projectName: norm(state.projectName),
    metadataTagCount: Array.isArray(state.metadata?.tags) ? state.metadata.tags.length : 0,
    metadataAssignmentCount: Array.isArray(state.metadata?.assignments) ? state.metadata.assignments.length : 0,
    summary: summarizeRecords(records),
    records
  };
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(outputPath);
}

main();
