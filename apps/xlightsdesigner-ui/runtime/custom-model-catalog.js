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

function stableHash(value = "") {
  let hash = 2166136261;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
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
  let modelsWithSubmodels = 0;
  for (const model of models) {
    const profile = norm(model?.profile || "unknown") || "unknown";
    profileCounts[profile] = Number(profileCounts[profile] || 0) + 1;
    if (Number(model?.submodels?.count || 0) > 0) modelsWithSubmodels += 1;
  }
  return {
    customModelCount: models.length,
    modelsWithSubmodels,
    profileCounts
  };
}

export function buildCustomModelFingerprint(model = {}, analysis = {}) {
  const payload = {
    rawType: norm(model?.displayAs || model?.type || model?.displayType || ""),
    profile: norm(analysis?.profile),
    nodeCount: Number(analysis?.nodeCount || model?.nodeCount || 0),
    construction: {
      source: norm(analysis?.construction?.source),
      dimensions: analysis?.construction?.dimensions || null,
      occupancy: analysis?.construction?.occupancy ?? null
    },
    submodels: Array.isArray(analysis?.submodels?.details)
      ? analysis.submodels.details.map((row) => ({
          name: norm(row?.name),
          type: norm(row?.type),
          nodeCount: Number(row?.nodeCount || 0),
          range: norm(row?.range)
        }))
      : []
  };
  return `cmf1:${stableHash(stableJson(payload))}`;
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
      modelName: norm(model?.name || targetId),
      submodels: childSubmodels,
      faceInfo: model?.faceInfo || model?.attributes?.faceInfo || null,
      nodeLayout: model?.nodeLayout || model?.customNodeLayout || model?.attributes?.customNodeLayout || null
    });
    const fingerprint = buildCustomModelFingerprint(model, analysis);
    models.push({
      targetId,
      fingerprint,
      fingerprintVersion: "custom-model-fingerprint-v1",
      modelName: norm(model?.name || targetId),
      rawType: displayType,
      canonicalType: "custom",
      profile: analysis.profile,
      traits: analysis.traits,
      confidence: analysis.confidence,
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
