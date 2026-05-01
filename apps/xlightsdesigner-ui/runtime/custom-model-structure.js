function norm(value = "") {
  return String(value || "").trim();
}

function low(value = "") {
  return norm(value).toLowerCase();
}

function toPositive(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function unique(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map((row) => norm(row)).filter(Boolean))];
}

function parseCompressedCustomModel(value = "") {
  const entries = norm(value).split(";").map((row) => row.trim()).filter(Boolean);
  if (!entries.length) return [];
  const parsed = [];
  let maxLayer = 0;
  let maxRow = 0;
  let maxCol = 0;
  for (const entry of entries) {
    const parts = entry.split(",").map((row) => Number(row.trim()));
    if (parts.length !== 3 && parts.length !== 4) continue;
    if (!parts.every((row) => Number.isFinite(row))) continue;
    const [node, row, col] = parts;
    const layer = parts.length === 4 ? parts[3] : 0;
    parsed.push({ node, row, col, layer });
    maxLayer = Math.max(maxLayer, layer);
    maxRow = Math.max(maxRow, row);
    maxCol = Math.max(maxCol, col);
  }
  if (!parsed.length) return [];
  const layers = Array.from({ length: maxLayer + 1 }, () =>
    Array.from({ length: maxRow + 1 }, () => Array.from({ length: maxCol + 1 }, () => -1))
  );
  for (const point of parsed) {
    layers[point.layer][point.row][point.col] = point.node;
  }
  return layers;
}

function parsePlainCustomModel(value = "") {
  const source = norm(value);
  if (!source) return [];
  const rawLayers = source.split("|").map((layer) => layer.split(";").map((row) => row.split(",")));
  const maxHeight = Math.max(1, ...rawLayers.map((layer) => layer.length));
  const maxWidth = Math.max(1, ...rawLayers.flatMap((layer) => layer.map((row) => row.length)));
  return rawLayers.map((layer) => {
    const rows = layer.map((row) => {
      const out = row.map((cell) => {
        const n = Number(norm(cell));
        return Number.isFinite(n) && n > 0 ? n : -1;
      });
      while (out.length < maxWidth) out.push(-1);
      return out;
    });
    while (rows.length < maxHeight) rows.push(Array.from({ length: maxWidth }, () => -1));
    return rows;
  });
}

export function parseCustomModelGrid(attrs = {}) {
  const compressed = parseCompressedCustomModel(attrs?.CustomModelCompressed);
  if (compressed.length) return compressed;
  return parsePlainCustomModel(attrs?.CustomModel);
}

function pointStats(points = []) {
  if (!points.length) return null;
  const rows = points.map((point) => point.row);
  const cols = points.map((point) => point.col);
  const layers = points.map((point) => point.layer);
  const minRow = Math.min(...rows);
  const maxRow = Math.max(...rows);
  const minCol = Math.min(...cols);
  const maxCol = Math.max(...cols);
  const minLayer = Math.min(...layers);
  const maxLayer = Math.max(...layers);
  const width = maxCol - minCol + 1;
  const height = maxRow - minRow + 1;
  const area = width * height;
  const centerRow = minRow + ((height - 1) / 2);
  const centerCol = minCol + ((width - 1) / 2);
  const maxRadius = Math.max(...points.map((point) => Math.hypot(point.row - centerRow, point.col - centerCol)), 1);
  const centerRadius = maxRadius * 0.22;
  const centerCount = points.filter((point) => Math.hypot(point.row - centerRow, point.col - centerCol) <= centerRadius).length;
  const angleBins = new Set();
  const outerCount = points.filter((point) => {
    const dr = point.row - centerRow;
    const dc = point.col - centerCol;
    const radius = Math.hypot(dr, dc);
    if (radius < maxRadius * 0.45) return false;
    const angle = Math.atan2(dr, dc);
    const bin = Math.floor((((angle + Math.PI) / (Math.PI * 2)) * 12));
    angleBins.add(Math.max(0, Math.min(11, bin)));
    return true;
  }).length;
  return {
    minRow,
    maxRow,
    minCol,
    maxCol,
    minLayer,
    maxLayer,
    width,
    height,
    layers: maxLayer - minLayer + 1,
    area,
    nodeCount: new Set(points.map((point) => point.node)).size,
    activeCellCount: points.length,
    occupancy: area > 0 ? points.length / area : 0,
    aspectRatio: Math.max(width, height) / Math.max(1, Math.min(width, height)),
    centerFillRatio: points.length ? centerCount / points.length : 0,
    outerFillRatio: points.length ? outerCount / points.length : 0,
    occupiedAngleBins: angleBins.size
  };
}

function nodeOrderStats(points = []) {
  const byNode = new Map();
  for (const point of points) {
    if (!byNode.has(point.node)) byNode.set(point.node, point);
  }
  const ordered = [...byNode.entries()].sort((a, b) => a[0] - b[0]).map((entry) => entry[1]);
  if (ordered.length < 2) {
    return {
      nodeCount: ordered.length,
      adjacentStepRatio: 0,
      medianStepDistance: null,
      maxStepDistance: null
    };
  }
  const distances = [];
  for (let index = 1; index < ordered.length; index += 1) {
    const prev = ordered[index - 1];
    const next = ordered[index];
    distances.push(Math.hypot(next.row - prev.row, next.col - prev.col, next.layer - prev.layer));
  }
  const sorted = [...distances].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return {
    nodeCount: ordered.length,
    adjacentStepRatio: distances.filter((distance) => distance <= 1.5).length / distances.length,
    medianStepDistance: Number(median.toFixed(3)),
    maxStepDistance: Number(Math.max(...distances).toFixed(3))
  };
}

function parseNodeRangeToken(token = "") {
  const raw = norm(token);
  if (!raw) return [];
  const match = raw.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
  if (!match) return [];
  const start = Number(match[1]);
  const end = Number(match[2] || match[1]);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return [];
  const step = start <= end ? 1 : -1;
  const out = [];
  for (let value = start; step > 0 ? value <= end : value >= end; value += step) out.push(value);
  return out;
}

function parseNodeRanges(value = "") {
  const nodes = [];
  for (const token of norm(value).split(",")) {
    nodes.push(...parseNodeRangeToken(token));
  }
  return unique(nodes.map((node) => String(node))).map((node) => Number(node)).filter((node) => Number.isFinite(node));
}

function numericCoord(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function coordinateFromNode(node = {}) {
  const coords = Array.isArray(node?.coords) ? node.coords : [];
  const coord = coords.find((row) => row?.buffer && numericCoord(row.buffer.x) !== null && numericCoord(row.buffer.y) !== null)
    || coords.find((row) => row?.screen && numericCoord(row.screen.x) !== null && numericCoord(row.screen.y) !== null)
    || coords.find((row) => row?.world && numericCoord(row.world.x) !== null && numericCoord(row.world.y) !== null)
    || null;
  if (!coord) return null;
  if (coord.buffer) return { col: numericCoord(coord.buffer.x), row: numericCoord(coord.buffer.y), layer: 0, source: "buffer" };
  if (coord.screen) return { col: numericCoord(coord.screen.x), row: numericCoord(coord.screen.y), layer: numericCoord(coord.screen.z) || 0, source: "screen" };
  if (coord.world) return { col: numericCoord(coord.world.x), row: numericCoord(coord.world.y), layer: numericCoord(coord.world.z) || 0, source: "world" };
  return null;
}

function pointsFromApiNodeLayout(layout = {}) {
  const nodes = Array.isArray(layout?.nodes)
    ? layout.nodes
    : Array.isArray(layout?.modelNodes)
      ? layout.modelNodes
      : Array.isArray(layout?.data?.nodes)
        ? layout.data.nodes
        : Array.isArray(layout?.data?.modelNodes)
          ? layout.data.modelNodes
          : [];
  if (!nodes.length) return [];
  const rawPoints = [];
  for (const row of nodes) {
    const node = Number(row?.nodeId ?? row?.node ?? row?.id);
    const coord = coordinateFromNode(row);
    if (!Number.isFinite(node) || node <= 0 || !coord) continue;
    rawPoints.push({
      node,
      row: coord.row,
      col: coord.col,
      layer: coord.layer,
      coordinateSource: coord.source
    });
  }
  if (!rawPoints.length) return [];
  const rows = [...new Set(rawPoints.map((point) => point.row))].sort((a, b) => a - b);
  const cols = [...new Set(rawPoints.map((point) => point.col))].sort((a, b) => a - b);
  const layers = [...new Set(rawPoints.map((point) => point.layer))].sort((a, b) => a - b);
  const rowIndex = new Map(rows.map((value, index) => [value, index]));
  const colIndex = new Map(cols.map((value, index) => [value, index]));
  const layerIndex = new Map(layers.map((value, index) => [value, index]));
  return rawPoints.map((point) => ({
    node: point.node,
    row: rowIndex.get(point.row) ?? 0,
    col: colIndex.get(point.col) ?? 0,
    layer: layerIndex.get(point.layer) ?? 0,
    coordinateSource: point.coordinateSource
  }));
}

function pointCoordinateSourceCounts(points = []) {
  const counts = {};
  for (const point of points) {
    const source = norm(point?.coordinateSource || "grid") || "grid";
    counts[source] = Number(counts[source] || 0) + 1;
  }
  return counts;
}

function nodeMapSummary(points = [], { sampleSize = 24 } = {}) {
  const byNode = new Map();
  for (const point of points) {
    if (!Number.isFinite(point?.node) || byNode.has(point.node)) continue;
    byNode.set(point.node, {
      node: point.node,
      row: point.row,
      col: point.col,
      layer: point.layer,
      coordinateSource: norm(point.coordinateSource || "grid") || "grid"
    });
  }
  const ordered = [...byNode.values()].sort((a, b) => a.node - b.node);
  const sampled = ordered.slice(0, sampleSize);
  return {
    nodeCount: ordered.length,
    sampleSize: sampled.length,
    firstNodes: sampled,
    coordinateSourceCounts: pointCoordinateSourceCounts(ordered)
  };
}

export function analyzeModelNodeLayout(nodeLayout = null) {
  const points = pointsFromApiNodeLayout(nodeLayout);
  const stats = pointStats(points);
  if (!stats) return null;
  const nodeOrder = nodeOrderStats(points);
  return {
    source: "layout.getModelNodes",
    dimensions: {
      width: stats.width,
      height: stats.height,
      layers: stats.layers || 1
    },
    occupancy: Number(stats.occupancy.toFixed(4)),
    nodeOrderContinuity: Number(nodeOrder.adjacentStepRatio.toFixed(4)),
    nodeOrder,
    nodeMap: nodeMapSummary(points)
  };
}

function submodelLineValue(submodel = {}) {
  const attrs = submodel?.attributes || {};
  const lines = [];
  for (const [key, value] of Object.entries({ ...attrs, ...submodel })) {
    if (/^line\d+$/i.test(key) && norm(value)) lines.push(norm(value));
  }
  return lines.join(",");
}

function analyzeSubmodelStructure(submodels = [], faceInfo = null) {
  const rows = Array.isArray(submodels) ? submodels : [];
  const names = rows.map((row) => norm(row?.name || row?.id || row?.targetId)).filter(Boolean);
  const lowerNames = names.map((name) => low(name));
  const semanticCounts = {
    face: 0,
    eye: 0,
    mouth: 0,
    outline: 0,
    spoke: 0,
    ring: 0,
    layer: 0,
    center: 0
  };
  for (const name of lowerNames) {
    if (/(face|bulb|socket)/.test(name)) semanticCounts.face += 1;
    if (/eye|blink/.test(name)) semanticCounts.eye += 1;
    if (/mouth|phoneme|viseme/.test(name)) semanticCounts.mouth += 1;
    if (/outline|border/.test(name)) semanticCounts.outline += 1;
    if (/spoke|arm/.test(name)) semanticCounts.spoke += 1;
    if (/circle|ring/.test(name)) semanticCounts.ring += 1;
    if (/outer|middle|inner|layer/.test(name)) semanticCounts.layer += 1;
    if (/center|centre/.test(name)) semanticCounts.center += 1;
  }
  if (faceInfo && typeof faceInfo === "object") {
    for (const key of Object.keys(faceInfo)) {
      const lowered = low(key);
      if (lowered.includes("mouth")) semanticCounts.mouth += 1;
      if (lowered.includes("eye")) semanticCounts.eye += 1;
      if (lowered.includes("outline") || lowered.includes("face")) semanticCounts.face += 1;
    }
  }
  const details = rows.map((row) => {
    const nodes = parseNodeRanges(submodelLineValue(row));
    return {
      name: norm(row?.name || row?.id || row?.targetId),
      type: norm(row?.type || row?.renderPolicy?.submodelType || row?.submodelType),
      nodeCount: nodes.length || toPositive(row?.membership?.nodeCount) || null,
      range: submodelLineValue(row)
    };
  });
  const traits = [];
  if (semanticCounts.eye && semanticCounts.mouth) traits.push("face_submodels", "custom_face_like");
  if (semanticCounts.spoke >= 4) traits.push("spoke_submodels", "custom_radial_submodels");
  if (semanticCounts.ring >= 2) traits.push("ring_submodels", "custom_radial_submodels");
  if (semanticCounts.layer >= 2) traits.push("layered_submodels");
  return {
    count: rows.length,
    names,
    semanticCounts,
    traits: unique(traits),
    details
  };
}

export function analyzeCustomModelStructure(attrs = {}, options = {}) {
  const layers = parseCustomModelGrid(attrs);
  const submodels = analyzeSubmodelStructure(options?.submodels || attrs?.submodels || [], options?.faceInfo || attrs?.faceInfo || null);
  const nodeLayout = options?.nodeLayout || attrs?.customNodeLayout || attrs?.nodeLayout || null;
  const modelName = low(options?.modelName || attrs?.name || attrs?.modelName || "");
  const apiNodePoints = pointsFromApiNodeLayout(nodeLayout);
  const apiNodeLayoutAnalysis = analyzeModelNodeLayout(nodeLayout);
  const gridPoints = [];
  for (let layer = 0; layer < layers.length; layer += 1) {
    const rows = layers[layer] || [];
    for (let row = 0; row < rows.length; row += 1) {
      const cols = rows[row] || [];
      for (let col = 0; col < cols.length; col += 1) {
        const node = Number(cols[col]);
        if (Number.isFinite(node) && node > 0) gridPoints.push({ layer, row, col, node, coordinateSource: "grid" });
      }
    }
  }
  const points = apiNodePoints.length ? apiNodePoints : gridPoints;

  const directPixelCount = toPositive(attrs?.PixelCount);
  const stats = pointStats(points);
  const nodeOrder = nodeOrderStats(points);
  if (!stats) {
    return {
      traits: ["custom_unparsed"],
      trainingBuckets: [],
      confidence: 0.25,
      nodeCount: directPixelCount,
      profile: "custom_unparsed",
      submodels
    };
  }

  const traits = ["custom_grid"];
  if (apiNodePoints.length) traits.push("api_node_layout");
  const buckets = new Set();
  let profile = "custom_sparse_shape";
  let confidence = 0.35;

  if (stats.occupancy >= 0.45 && stats.area >= 64) {
    traits.push("custom_matrix_like", "matrix_like");
    buckets.add("matrix");
    profile = "custom_matrix_like";
    confidence = 0.75;
  } else if ((stats.aspectRatio >= 2 && stats.occupancy >= 0.05) || Math.min(stats.width, stats.height) <= 3) {
    traits.push("custom_linear_like", "linear_like");
    buckets.add("single_line");
    buckets.add("cane");
    profile = "custom_linear_like";
    confidence = 0.65;
  } else if (
    stats.aspectRatio <= 1.55
    && stats.occupancy <= 0.35
    && stats.occupiedAngleBins >= 7
    && stats.outerFillRatio >= 0.35
    && stats.centerFillRatio <= 0.2
  ) {
    traits.push("custom_radial_like", "radial_like");
    buckets.add("spinner");
    buckets.add("star");
    profile = "custom_radial_like";
    confidence = 0.6;
  }

  if (stats.occupancy < 0.2) traits.push("sparse_custom_grid");
  if (stats.aspectRatio >= 2) traits.push(stats.height >= stats.width ? "vertical_span" : "horizontal_span");
  if (nodeOrder.adjacentStepRatio >= 0.75) traits.push("continuous_node_path");
  if (modelName.includes("cane")) {
    traits.push("custom_linear_like", "linear_like", "name_hint_cane");
    buckets.delete("spinner");
    buckets.delete("star");
    buckets.add("single_line");
    buckets.add("cane");
    profile = "custom_linear_like";
    confidence = Math.max(confidence, 0.68);
  }
  traits.push(...submodels.traits);
  if (submodels.traits.includes("custom_face_like")) {
    profile = "custom_face_like";
    confidence = Math.max(confidence, 0.7);
    buckets.clear();
  } else if (submodels.traits.includes("custom_radial_submodels") && !buckets.size) {
    traits.push("custom_radial_like", "radial_like");
    buckets.add("spinner");
    buckets.add("star");
    profile = "custom_radial_like";
    confidence = Math.max(confidence, 0.65);
  }

  return {
    traits: unique(traits),
    trainingBuckets: [...buckets],
    confidence,
    nodeCount: directPixelCount || stats.nodeCount,
    profile,
    stats,
    nodeOrder,
    submodels,
    construction: {
      source: apiNodePoints.length ? "layout.getModelNodes" : attrs?.CustomModelCompressed ? "CustomModelCompressed" : "CustomModel",
      dimensions: {
        width: stats.width,
        height: stats.height,
        layers: stats.layers || layers.length || 1
      },
      occupancy: Number(stats.occupancy.toFixed(4)),
      nodeOrderContinuity: Number(nodeOrder.adjacentStepRatio.toFixed(4)),
      nodeMap: apiNodeLayoutAnalysis?.nodeMap || nodeMapSummary(points)
    }
  };
}

export function mapClassificationToTrainingBuckets(classification = {}, structure = {}) {
  const rawType = low(classification?.rawType);
  const canonicalType = low(classification?.canonicalType);
  const structureBuckets = Array.isArray(structure?.trainingBuckets) ? structure.trainingBuckets : [];
  const buckets = new Set(structureBuckets);
  if (canonicalType === "single_line" || canonicalType === "poly_line") buckets.add("single_line");
  if (canonicalType === "arches") buckets.add("arch");
  if (canonicalType === "candy_canes") buckets.add("cane");
  if (canonicalType === "spinner") buckets.add("spinner");
  if (canonicalType === "star") buckets.add("star");
  if (canonicalType === "matrix_horizontal" || canonicalType === "matrix_vertical" || canonicalType === "matrix") buckets.add("matrix");
  if (canonicalType === "icicles") buckets.add("icicles");
  if (canonicalType === "tree") {
    buckets.add("tree_360");
    buckets.add("tree_flat");
  }
  if (rawType.includes("tree flat")) buckets.add("tree_flat");
  if (rawType.includes("tree") && rawType.includes("360")) buckets.add("tree_360");
  if (rawType.includes("tree") && rawType.includes("180")) buckets.add("tree_flat");
  return [...buckets];
}
