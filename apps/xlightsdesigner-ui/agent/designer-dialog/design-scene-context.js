function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function average(values = []) {
  const nums = values.map((row) => Number(row)).filter((row) => Number.isFinite(row));
  if (!nums.length) return null;
  return nums.reduce((sum, row) => sum + row, 0) / nums.length;
}

function extractWorldPoint(node = {}) {
  const coords = node?.coords?.world || node?.coords?.buffer || null;
  if (!isPlainObject(coords)) return null;
  const x = Number(coords.x);
  const y = Number(coords.y);
  const z = Number(coords.z);
  return {
    x: Number.isFinite(x) ? x : null,
    y: Number.isFinite(y) ? y : null,
    z: Number.isFinite(z) ? z : null
  };
}

function summarizeModelPosition(model = {}) {
  const nodes = arr(model?.nodes);
  const points = nodes.map(extractWorldPoint).filter(Boolean);
  const x = average(points.map((row) => row.x));
  const y = average(points.map((row) => row.y));
  const z = average(points.map((row) => row.z));
  return { x, y, z, nodeCount: points.length };
}

function classifyAxisZone(value, min, max) {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max) || min === max) return "";
  const first = min + (max - min) / 3;
  const second = min + ((max - min) * 2) / 3;
  if (value <= first) return "low";
  if (value >= second) return "high";
  return "mid";
}

function classifyHorizontalZone(value, min, max) {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max) || min === max) return "";
  const first = min + (max - min) / 3;
  const second = min + ((max - min) * 2) / 3;
  if (value <= first) return "left";
  if (value >= second) return "right";
  return "center";
}

function classifyDepthZone(value, min, max) {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max) || min === max) return "";
  const first = min + (max - min) / 3;
  const second = min + ((max - min) * 2) / 3;
  if (value <= first) return "foreground";
  if (value >= second) return "background";
  return "midground";
}

export function buildDesignSceneContext({
  sceneGraph = {},
  revision = ""
} = {}) {
  const modelsById = isPlainObject(sceneGraph?.modelsById) ? sceneGraph.modelsById : {};
  const groupsById = isPlainObject(sceneGraph?.groupsById) ? sceneGraph.groupsById : {};
  const submodelsById = isPlainObject(sceneGraph?.submodelsById) ? sceneGraph.submodelsById : {};
  const stats = isPlainObject(sceneGraph?.stats) ? sceneGraph.stats : {};

  const positioned = Object.values(modelsById)
    .map((model) => ({
      id: str(model?.id || model?.name),
      name: str(model?.name || model?.id),
      type: str(model?.type || "Model"),
      ...summarizeModelPosition(model)
    }))
    .filter((row) => row.id && row.nodeCount > 0);

  const xs = positioned.map((row) => row.x).filter(Number.isFinite);
  const ys = positioned.map((row) => row.y).filter(Number.isFinite);
  const zs = positioned.map((row) => row.z).filter(Number.isFinite);
  const minX = xs.length ? Math.min(...xs) : 0;
  const maxX = xs.length ? Math.max(...xs) : 0;
  const minY = ys.length ? Math.min(...ys) : 0;
  const maxY = ys.length ? Math.max(...ys) : 0;
  const minZ = zs.length ? Math.min(...zs) : 0;
  const maxZ = zs.length ? Math.max(...zs) : 0;

  const spatialZones = {
    left: [],
    center: [],
    right: [],
    foreground: [],
    midground: [],
    background: [],
    high: [],
    mid: [],
    low: []
  };

  for (const row of positioned) {
    const horizontal = classifyHorizontalZone(row.x, minX, maxX);
    const vertical = classifyAxisZone(row.y, minY, maxY);
    const depth = classifyDepthZone(row.z, minZ, maxZ);
    if (horizontal) spatialZones[horizontal].push(row.id);
    if (vertical) spatialZones[vertical].push(row.id);
    if (depth) spatialZones[depth].push(row.id);
  }

  const focalCandidates = positioned
    .slice()
    .sort((a, b) => Number(b.nodeCount || 0) - Number(a.nodeCount || 0))
    .slice(0, 8)
    .map((row) => row.id);

  const broadGroups = Object.values(groupsById)
    .filter((row) => Number(row?.members?.flattened?.length || 0) >= 3)
    .map((row) => str(row?.id || row?.name))
    .filter(Boolean);

  const detailTargets = Object.values(submodelsById)
    .slice(0, 20)
    .map((row) => str(row?.id || row?.name))
    .filter(Boolean);

  return {
    artifactType: "design_scene_context_v1",
    artifactVersion: "1.0",
    layoutRevision: str(revision || stats.layoutMode || "unknown"),
    spatialZones,
    focalCandidates,
    coverageDomains: {
      broad: broadGroups,
      detail: detailTargets
    },
    metadata: {
      layoutMode: str(stats.layoutMode || "unknown"),
      modelCount: Number(stats.modelCount || 0),
      groupCount: Number(stats.groupCount || 0),
      submodelCount: Number(stats.submodelCount || 0)
    }
  };
}
