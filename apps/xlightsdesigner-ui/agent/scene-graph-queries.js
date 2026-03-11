function toFiniteOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

const DEPTH_SEMANTIC_TO_Z = Object.freeze({
  foreground: 0,
  midground: 50,
  background: 100
});

export function normalizeDepthSemanticTag(value = "") {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  const key = raw.startsWith("depth:") ? raw.slice(6).trim() : raw;
  if (["foreground", "front", "near", "nearfield", "near-field"].includes(key)) return "foreground";
  if (["midground", "mid", "middle"].includes(key)) return "midground";
  if (["background", "back", "rear", "far", "farfield", "far-field"].includes(key)) return "background";
  return "";
}

export function depthSemanticToZ(semantic = "") {
  const key = normalizeDepthSemanticTag(semantic);
  if (!key) return null;
  return Object.prototype.hasOwnProperty.call(DEPTH_SEMANTIC_TO_Z, key) ? DEPTH_SEMANTIC_TO_Z[key] : null;
}

function normalizeLayoutMode(value = "") {
  const key = String(value || "").trim().toLowerCase();
  if (key === "2d") return "2d";
  if (key === "3d") return "3d";
  return "2d";
}

export function inferLayoutMode({ cameras = [] } = {}) {
  const rows = Array.isArray(cameras) ? cameras : [];
  const normalized = rows
    .map((row) => ({
      type: normalizeLayoutMode(row?.type),
      isDefault: Boolean(row?.isDefault)
    }))
    .filter((row) => row.type !== "unknown");

  if (!normalized.length) return "2d";

  const defaults = normalized.filter((row) => row.isDefault);
  const defaultTypes = Array.from(new Set(defaults.map((row) => row.type)));
  if (defaultTypes.length === 1) return defaultTypes[0];

  const allTypes = Array.from(new Set(normalized.map((row) => row.type)));
  if (allTypes.length === 1) return allTypes[0];
  return "2d";
}

function getNodePos(node = {}) {
  const p = node?.transform?.position || {};
  return {
    x: toFiniteOrNull(p.x),
    y: toFiniteOrNull(p.y),
    z: toFiniteOrNull(p.z)
  };
}

export function collectSpatialNodes(sceneGraph = {}, options = {}) {
  const includeGroups = options?.includeGroups !== false;
  const includeSubmodels = options?.includeSubmodels === true;

  const rows = [];
  const models = sceneGraph?.modelsById && typeof sceneGraph.modelsById === "object" ? sceneGraph.modelsById : {};
  for (const node of Object.values(models)) {
    const pos = getNodePos(node);
    if (pos.x == null || pos.y == null || pos.z == null) continue;
    rows.push({ id: String(node?.id || ""), type: "model", position: pos, node });
  }

  if (includeGroups) {
    const groups = sceneGraph?.groupsById && typeof sceneGraph.groupsById === "object" ? sceneGraph.groupsById : {};
    for (const node of Object.values(groups)) {
      const pos = getNodePos(node);
      if (pos.x == null || pos.y == null || pos.z == null) continue;
      rows.push({ id: String(node?.id || ""), type: "group", position: pos, node });
    }
  }

  if (includeSubmodels) {
    const subs = sceneGraph?.submodelsById && typeof sceneGraph.submodelsById === "object" ? sceneGraph.submodelsById : {};
    for (const node of Object.values(subs)) {
      const pos = getNodePos(node);
      if (pos.x == null || pos.y == null || pos.z == null) continue;
      rows.push({ id: String(node?.id || ""), type: "submodel", position: pos, node });
    }
  }

  return rows.filter((row) => row.id);
}

export function computeSceneBounds(nodes = []) {
  const rows = Array.isArray(nodes) ? nodes : [];
  if (!rows.length) {
    return {
      hasBounds: false,
      min: { x: null, y: null, z: null },
      max: { x: null, y: null, z: null },
      center: { x: null, y: null, z: null },
      size: { x: null, y: null, z: null }
    };
  }

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  for (const row of rows) {
    const p = row?.position || {};
    const x = toFiniteOrNull(p.x);
    const y = toFiniteOrNull(p.y);
    const z = toFiniteOrNull(p.z);
    if (x == null || y == null || z == null) continue;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }

  if (!Number.isFinite(minX) || !Number.isFinite(maxX)) {
    return {
      hasBounds: false,
      min: { x: null, y: null, z: null },
      max: { x: null, y: null, z: null },
      center: { x: null, y: null, z: null },
      size: { x: null, y: null, z: null }
    };
  }

  return {
    hasBounds: true,
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
    center: {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      z: (minZ + maxZ) / 2
    },
    size: {
      x: maxX - minX,
      y: maxY - minY,
      z: maxZ - minZ
    }
  };
}

export function findNodesInAxisAlignedRegion(sceneGraph = {}, region = {}, options = {}) {
  const nodes = collectSpatialNodes(sceneGraph, options);
  const min = region?.min || {};
  const max = region?.max || {};
  const minX = toFiniteOrNull(min.x);
  const minY = toFiniteOrNull(min.y);
  const minZ = toFiniteOrNull(min.z);
  const maxX = toFiniteOrNull(max.x);
  const maxY = toFiniteOrNull(max.y);
  const maxZ = toFiniteOrNull(max.z);
  if ([minX, minY, minZ, maxX, maxY, maxZ].some((v) => v == null)) return [];

  return nodes.filter((row) => {
    const p = row.position;
    return p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY && p.z >= minZ && p.z <= maxZ;
  });
}

export function findNearestNodes(sceneGraph = {}, anchorId = "", options = {}) {
  const nodes = collectSpatialNodes(sceneGraph, options);
  const anchor = nodes.find((row) => row.id === String(anchorId || ""));
  if (!anchor) return [];
  const limit = Number.isFinite(Number(options?.limit)) ? Math.max(1, Number(options.limit)) : 5;

  return nodes
    .filter((row) => row.id !== anchor.id)
    .map((row) => {
      const dx = row.position.x - anchor.position.x;
      const dy = row.position.y - anchor.position.y;
      const dz = row.position.z - anchor.position.z;
      const distance = Math.sqrt((dx * dx) + (dy * dy) + (dz * dz));
      return { ...row, distance };
    })
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}

export function classifyDepthBands(sceneGraph = {}, options = {}) {
  const nodes = collectSpatialNodes(sceneGraph, options);
  const bounds = computeSceneBounds(nodes);
  if (!bounds.hasBounds) {
    return {
      front: [],
      mid: [],
      rear: [],
      axis: "z",
      bounds
    };
  }

  const span = bounds.size.z;
  if (span <= 0) {
    return {
      front: nodes.map((row) => row.id),
      mid: [],
      rear: [],
      axis: "z",
      bounds
    };
  }

  const frontRatio = Number.isFinite(Number(options?.frontRatio)) ? Math.min(0.49, Math.max(0.05, Number(options.frontRatio))) : 0.33;
  const rearRatio = Number.isFinite(Number(options?.rearRatio)) ? Math.min(0.49, Math.max(0.05, Number(options.rearRatio))) : 0.33;
  const frontMax = bounds.min.z + (span * frontRatio);
  const rearMin = bounds.max.z - (span * rearRatio);

  const front = [];
  const mid = [];
  const rear = [];
  for (const row of nodes) {
    if (row.position.z <= frontMax) front.push(row.id);
    else if (row.position.z >= rearMin) rear.push(row.id);
    else mid.push(row.id);
  }

  return { front, mid, rear, axis: "z", bounds };
}
