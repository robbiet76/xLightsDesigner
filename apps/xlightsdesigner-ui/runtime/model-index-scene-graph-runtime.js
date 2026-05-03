import { normalizeModelIndexTargetRecords } from "./target-behavior-learning-runtime.js";

function str(value = "") {
  return String(value || "").trim();
}

function obj(value = null) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function arr(value = []) {
  return Array.isArray(value) ? value : [];
}

function finiteOrNull(value) {
  const out = Number(value);
  return Number.isFinite(out) ? out : null;
}

export function buildSubmodelsByIdFromModelIndexTargetRecords(targetRecords = []) {
  const out = {};
  for (const record of arr(targetRecords)) {
    if (str(record?.targetKind) !== "submodel") continue;
    const targetId = str(record?.targetId);
    if (!targetId) continue;
    const identity = obj(record?.identity);
    const structure = obj(record?.structure);
    const submodelMetadata = obj(structure.submodelMetadata);
    const nodeCoverage = obj(submodelMetadata.nodeCoverage);
    out[targetId] = {
      id: targetId,
      name: str(submodelMetadata.name || identity.displayName || targetId),
      parentId: str(identity.parentId || submodelMetadata.parentId),
      parentName: str(identity.parentName || submodelMetadata.parentId),
      type: str(submodelMetadata.type || identity.canonicalType || "submodel"),
      layoutGroup: str(submodelMetadata.layoutGroup),
      startChannel: finiteOrNull(submodelMetadata.startChannel),
      endChannel: finiteOrNull(submodelMetadata.endChannel),
      lines: str(submodelMetadata.lines),
      siblingCount: Number(submodelMetadata.siblingCount || 0),
      siblingIds: arr(submodelMetadata.siblingIds).map((row) => str(row)).filter(Boolean),
      overlappingSiblingIds: arr(submodelMetadata.overlappingSiblingIds).map((row) => str(row)).filter(Boolean),
      overlapsSibling: Boolean(submodelMetadata.overlapsSibling),
      structureHints: arr(submodelMetadata.structureHints).map((row) => str(row)).filter(Boolean),
      nodeCoverage: {
        nodeCount: Number(nodeCoverage.nodeCount || structure.nodeCount || 0),
        parentNodeCount: finiteOrNull(nodeCoverage.parentNodeCount),
        ratio: finiteOrNull(nodeCoverage.ratio)
      },
      identity: {
        displayName: str(identity.displayName || targetId),
        fingerprint: str(identity.fingerprint),
        fingerprintVersion: str(identity.fingerprintVersion)
      }
    };
  }
  return out;
}

export function normalizeModelIndexArtifactSubmodels(modelIndexArtifact = null) {
  return buildSubmodelsByIdFromModelIndexTargetRecords(normalizeModelIndexTargetRecords(modelIndexArtifact));
}

export function buildDisplayElementsByIdFromModelIndexTargetRecords(targetRecords = []) {
  const out = {};
  for (const record of arr(targetRecords)) {
    const targetId = str(record?.targetId);
    if (!targetId) continue;
    const identity = obj(record?.identity);
    const structure = obj(record?.structure);
    out[targetId] = {
      id: targetId,
      name: str(identity.displayName || targetId),
      type: str(record?.targetKind || identity.canonicalType || "model"),
      displayAs: str(identity.rawType),
      canonicalType: str(identity.canonicalType),
      targetFingerprint: str(identity.fingerprint),
      fingerprintVersion: str(identity.fingerprintVersion),
      identity: {
        displayName: str(identity.displayName || targetId),
        fingerprint: str(identity.fingerprint),
        fingerprintVersion: str(identity.fingerprintVersion),
        parentId: str(identity.parentId),
        parentName: str(identity.parentName)
      },
      structure: {
        submodelCount: Number(structure.submodelCount || 0),
        submodelMetadata: obj(structure.submodelMetadata),
        customStructure: obj(structure.customStructure)
      }
    };
  }
  return out;
}

export function mergeModelIndexTargetsIntoDisplayElements(displayElements = [], modelIndexTargetRecords = []) {
  const existing = arr(displayElements);
  const byId = buildDisplayElementsByIdFromModelIndexTargetRecords(modelIndexTargetRecords);
  const seen = new Set();
  const merged = existing.map((row) => {
    const id = str(row?.id || row?.name);
    if (!id) return row;
    seen.add(id);
    const enriched = obj(byId[id]);
    if (!Object.keys(enriched).length) return row;
    return {
      ...enriched,
      ...obj(row),
      targetFingerprint: str(row?.targetFingerprint || row?.fingerprint || row?.identity?.fingerprint || enriched.targetFingerprint),
      fingerprintVersion: str(row?.fingerprintVersion || row?.identity?.fingerprintVersion || enriched.fingerprintVersion),
      identity: {
        ...obj(enriched.identity),
        ...obj(row?.identity),
        fingerprint: str(row?.identity?.fingerprint || row?.targetFingerprint || row?.fingerprint || enriched.identity?.fingerprint),
        fingerprintVersion: str(row?.identity?.fingerprintVersion || row?.fingerprintVersion || enriched.identity?.fingerprintVersion)
      },
      structure: {
        ...obj(enriched.structure),
        ...obj(row?.structure)
      }
    };
  });
  for (const [id, row] of Object.entries(byId)) {
    if (!seen.has(id)) merged.push(row);
  }
  return merged;
}

export function mergeModelIndexSubmodelsIntoSceneGraph(sceneGraph = {}, modelIndexTargetRecords = []) {
  const base = obj(sceneGraph);
  const existingSubmodels = obj(base.submodelsById);
  const modelIndexSubmodels = buildSubmodelsByIdFromModelIndexTargetRecords(modelIndexTargetRecords);
  const submodelsById = { ...existingSubmodels };
  for (const [targetId, modelIndexSubmodel] of Object.entries(modelIndexSubmodels)) {
    const existing = obj(existingSubmodels[targetId]);
    submodelsById[targetId] = {
      ...existing,
      ...modelIndexSubmodel,
      membership: obj(existing.membership),
      renderPolicy: obj(existing.renderPolicy),
      identity: {
        ...obj(existing.identity),
        ...obj(modelIndexSubmodel.identity)
      }
    };
  }
  return {
    ...base,
    submodelsById,
    stats: {
      ...obj(base.stats),
      submodelCount: Math.max(Number(base.stats?.submodelCount || 0), Object.keys(submodelsById).length)
    }
  };
}
