import { finalizeArtifact } from "../shared/artifact-ids.js";

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
  const xs = points.map((row) => row.x).filter(Number.isFinite);
  const ys = points.map((row) => row.y).filter(Number.isFinite);
  const zs = points.map((row) => row.z).filter(Number.isFinite);
  return {
    x,
    y,
    z,
    nodeCount: points.length,
    minX: xs.length ? Math.min(...xs) : null,
    maxX: xs.length ? Math.max(...xs) : null,
    minY: ys.length ? Math.min(...ys) : null,
    maxY: ys.length ? Math.max(...ys) : null,
    minZ: zs.length ? Math.min(...zs) : null,
    maxZ: zs.length ? Math.max(...zs) : null
  };
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

function safeSpan(min, max, fallback = 1) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return fallback;
  const span = Math.abs(max - min);
  return span > 0 ? span : fallback;
}

function normalizeFraction(value, total) {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.max(0, Math.min(1, value / total));
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
  const layoutWidth = safeSpan(minX, maxX);
  const layoutHeight = safeSpan(minY, maxY);
  const layoutArea = layoutWidth * layoutHeight;
  const totalNodeCount = positioned.reduce((sum, row) => sum + Number(row.nodeCount || 0), 0);

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

  const impactByTarget = {};
  let totalImpactWeight = 0;
  for (const row of positioned) {
    const width = safeSpan(row.minX, row.maxX);
    const height = safeSpan(row.minY, row.maxY);
    const footprintArea = Math.max(1, width * height);
    const nodeShare = normalizeFraction(Number(row.nodeCount || 0), totalNodeCount);
    const footprintShare = normalizeFraction(footprintArea, layoutArea);
    const weightedImpact = (nodeShare * 0.7) + (footprintShare * 0.3);
    totalImpactWeight += weightedImpact;
    impactByTarget[row.id] = {
      nodeCount: Number(row.nodeCount || 0),
      nodeShare: Number(nodeShare.toFixed(4)),
      footprintArea: Number(footprintArea.toFixed(4)),
      footprintShare: Number(footprintShare.toFixed(4)),
      weightedImpact: Number(weightedImpact.toFixed(4)),
      position: {
        x: Number.isFinite(row.x) ? Number(row.x.toFixed(2)) : null,
        y: Number.isFinite(row.y) ? Number(row.y.toFixed(2)) : null,
        z: Number.isFinite(row.z) ? Number(row.z.toFixed(2)) : null
      }
    };
  }

  const rankedImpactTargets = Object.entries(impactByTarget)
    .map(([id, metrics]) => ({ id, ...metrics }))
    .sort((a, b) => Number(b.weightedImpact || 0) - Number(a.weightedImpact || 0))
    .slice(0, 12);

  return finalizeArtifact({
    artifactType: "design_scene_context_v1",
    artifactVersion: "1.0",
    layoutRevision: str(revision || stats.layoutMode || "unknown"),
    spatialZones,
    focalCandidates,
    coverageDomains: {
      broad: broadGroups,
      detail: detailTargets
    },
    impactMetrics: {
      totalNodeCount,
      layoutWidth: Number(layoutWidth.toFixed(2)),
      layoutHeight: Number(layoutHeight.toFixed(2)),
      layoutArea: Number(layoutArea.toFixed(2)),
      totalImpactWeight: Number(totalImpactWeight.toFixed(4)),
      impactByTarget,
      rankedTargets: rankedImpactTargets
    },
    metadata: {
      layoutMode: str(stats.layoutMode || "unknown"),
      modelCount: Number(stats.modelCount || 0),
      groupCount: Number(stats.groupCount || 0),
      submodelCount: Number(stats.submodelCount || 0)
    }
  });
}
