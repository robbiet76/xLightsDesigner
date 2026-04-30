import { classifyModelDisplayType } from "../agent/sequence-agent/model-type-catalog.js";
import { analyzeCustomModelStructure } from "./custom-model-structure.js";

function norm(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function valuesOf(value = {}) {
  return value && typeof value === "object" && !Array.isArray(value) ? Object.values(value) : [];
}

function modelAttributes(model = {}) {
  return model?.attributes && typeof model.attributes === "object"
    ? model.attributes
    : model;
}

function childSubmodelsFor(parentId = "", submodelsById = {}) {
  const id = norm(parentId);
  if (!id) return [];
  return valuesOf(submodelsById).filter((row) => norm(row?.parentId) === id);
}

function summarizeProfiles(models = []) {
  const profileCounts = {};
  const bucketCounts = {};
  let modelsWithSubmodels = 0;
  for (const model of models) {
    const profile = norm(model?.profile || "unknown") || "unknown";
    profileCounts[profile] = Number(profileCounts[profile] || 0) + 1;
    if (Number(model?.submodels?.count || 0) > 0) modelsWithSubmodels += 1;
    for (const bucket of arr(model?.trainingBuckets)) {
      bucketCounts[bucket] = Number(bucketCounts[bucket] || 0) + 1;
    }
  }
  return {
    customModelCount: models.length,
    modelsWithSubmodels,
    profileCounts,
    bucketCounts
  };
}

export function buildCustomModelStructureCatalog({
  sceneGraph = {},
  source = {},
  createdAt = new Date().toISOString()
} = {}) {
  const modelsById = sceneGraph?.modelsById || {};
  const submodelsById = sceneGraph?.submodelsById || {};
  const models = [];

  for (const model of valuesOf(modelsById)) {
    const targetId = norm(model?.id || model?.name);
    if (!targetId) continue;
    const displayType = norm(model?.displayAs || model?.type || model?.displayType || "");
    const classification = classifyModelDisplayType(displayType);
    if (classification?.canonicalType !== "custom") continue;
    const childSubmodels = childSubmodelsFor(targetId, submodelsById);
    const analysis = analyzeCustomModelStructure(modelAttributes(model), {
      submodels: childSubmodels,
      faceInfo: model?.faceInfo || model?.attributes?.faceInfo || null
    });
    models.push({
      targetId,
      modelName: norm(model?.name || targetId),
      rawType: displayType,
      canonicalType: "custom",
      profile: analysis.profile,
      traits: analysis.traits,
      confidence: analysis.confidence,
      trainingBuckets: analysis.trainingBuckets,
      construction: analysis.construction || null,
      nodeOrder: analysis.nodeOrder || null,
      submodels: analysis.submodels || {
        count: 0,
        names: [],
        semanticCounts: {},
        details: []
      }
    });
  }

  return {
    artifactType: "custom_model_structure_catalog_v1",
    artifactVersion: "1.0",
    createdAt,
    source,
    summary: summarizeProfiles(models),
    models: models.sort((a, b) => a.modelName.localeCompare(b.modelName))
  };
}
