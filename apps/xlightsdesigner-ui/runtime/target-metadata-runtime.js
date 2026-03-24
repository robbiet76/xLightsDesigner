import { classifyModelDisplayType } from "../agent/sequence-agent/model-type-catalog.js";
import { getStage1TrainedEffectBundle } from "../agent/sequence-agent/trained-effect-knowledge.js";

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

function toFiniteOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function safeFixed(value, digits = 1) {
  return Number.isFinite(Number(value)) ? Number(Number(value).toFixed(digits)) : null;
}

function classifyThirdsZone(value, min, max, lowLabel = "", midLabel = "", highLabel = "") {
  const v = toFiniteOrNull(value);
  const lo = toFiniteOrNull(min);
  const hi = toFiniteOrNull(max);
  if (v == null || lo == null || hi == null || lo === hi) return "";
  const first = lo + (hi - lo) / 3;
  const second = lo + ((hi - lo) * 2) / 3;
  if (v <= first) return lowLabel;
  if (v >= second) return highLabel;
  return midLabel;
}

function buildLocationMetadata({
  targetKind = "",
  node = null,
  parentNode = null,
  bounds = null
} = {}) {
  const sourceNode = node && node.transform?.position
    ? node
    : (targetKind === "submodel" && parentNode?.transform?.position ? parentNode : null);
  const position = sourceNode?.transform?.position || {};
  const x = toFiniteOrNull(position.x);
  const y = toFiniteOrNull(position.y);
  const z = toFiniteOrNull(position.z);
  const hasPosition = x != null || y != null || z != null;
  if (!hasPosition) return null;

  const min = bounds?.min || {};
  const max = bounds?.max || {};
  return {
    source: sourceNode === node ? "direct" : "parent",
    position: {
      x: safeFixed(x),
      y: safeFixed(y),
      z: safeFixed(z)
    },
    zones: {
      horizontal: classifyThirdsZone(x, min.x, max.x, "left", "center", "right"),
      vertical: classifyThirdsZone(y, min.y, max.y, "low", "mid", "high"),
      depth: classifyThirdsZone(z, min.z, max.z, "front", "middle", "rear")
    }
  };
}

function normalizePositive(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function countCustomModelPixels(customModel = "") {
  const source = norm(customModel);
  if (!source) return null;
  const matches = source.match(/\d+/g);
  if (!matches?.length) return null;
  const ids = new Set();
  for (const match of matches) {
    const numeric = Number(match);
    if (Number.isFinite(numeric) && numeric > 0) ids.add(numeric);
  }
  return ids.size || null;
}

function parsePointDataTriplets(value = "") {
  const raw = norm(value);
  if (!raw) return [];
  const parts = raw.split(",").map((row) => Number(row)).filter((row) => Number.isFinite(row));
  const points = [];
  for (let index = 0; index + 2 < parts.length; index += 3) {
    points.push({ x: parts[index], y: parts[index + 1], z: parts[index + 2] });
  }
  return points;
}

function computeScaledPolylineLength(node = {}) {
  const attrs = node?.attributes || {};
  const points = parsePointDataTriplets(attrs?.PointData);
  if (points.length < 2) return null;
  const scale = node?.transform?.scale || {};
  const sx = normalizePositive(scale.x) || normalizePositive(attrs?.ScaleX) || 1;
  const sy = normalizePositive(scale.y) || normalizePositive(attrs?.ScaleY) || 1;
  const sz = normalizePositive(scale.z) || normalizePositive(attrs?.ScaleZ) || 1;
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const prev = points[index - 1];
    const next = points[index];
    const dx = (next.x - prev.x) * sx;
    const dy = (next.y - prev.y) * sy;
    const dz = (next.z - prev.z) * sz;
    total += Math.sqrt((dx * dx) + (dy * dy) + (dz * dz));
  }
  return normalizePositive(total);
}

function percentile(values = [], p = 0) {
  const rows = arr(values).map((row) => Number(row)).filter((row) => Number.isFinite(row)).sort((a, b) => a - b);
  if (!rows.length) return null;
  if (rows.length === 1) return rows[0];
  const clamped = Math.max(0, Math.min(1, Number(p) || 0));
  const index = (rows.length - 1) * clamped;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return rows[lower];
  const t = index - lower;
  return rows[lower] * (1 - t) + rows[upper] * t;
}

function labelVisualWeight(value, thresholds = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  const lower = Number(thresholds?.p25);
  const upper = Number(thresholds?.p75);
  if (!Number.isFinite(lower) || !Number.isFinite(upper)) return "medium";
  if (n <= lower) return "light";
  if (n >= upper) return "heavy";
  return "medium";
}

function applyVisualWeightBands(records = []) {
  const values = arr(records)
    .map((row) => row?.structure?.densityMetadata?.value)
    .map((row) => Number(row))
    .filter((row) => Number.isFinite(row));
  if (!values.length) return records;
  const thresholds = {
    p25: percentile(values, 0.25),
    p75: percentile(values, 0.75)
  };
  for (const record of arr(records)) {
    const density = record?.structure?.densityMetadata;
    if (!density) continue;
    density.label = labelVisualWeight(density.value, thresholds);
  }
  return records;
}

function inferNodeCountFromAttributes(attrs = {}, canonicalType = "") {
  const canonical = low(canonicalType);
  if (canonical === "poly_line") {
    const polylinePixels = normalizePositive(attrs?.parm2);
    if (polylinePixels != null) return polylinePixels;
  }
  if (canonical === "single_line") {
    const lineStrings = normalizePositive(attrs?.parm1);
    const linePixelsPerString = normalizePositive(attrs?.parm2);
    if (lineStrings != null && linePixelsPerString != null) return lineStrings * linePixelsPerString;
    if (linePixelsPerString != null) return linePixelsPerString;
  }
  if (canonical === "tree") {
    const treeStrings = normalizePositive(attrs?.parm1);
    const treePixelsPerString = normalizePositive(attrs?.parm2);
    if (treeStrings != null && treePixelsPerString != null) return treeStrings * treePixelsPerString;
    if (treePixelsPerString != null) return treePixelsPerString;
  }
  if (canonical === "icicles") {
    const icicleStrings = normalizePositive(attrs?.parm1);
    const iciclePixelsPerString = normalizePositive(attrs?.parm2);
    if (icicleStrings != null && iciclePixelsPerString != null) return icicleStrings * iciclePixelsPerString;
    if (iciclePixelsPerString != null) return iciclePixelsPerString;
  }
  if (canonical === "star") {
    const starStrings = normalizePositive(attrs?.parm1);
    const starPixelsPerString = normalizePositive(attrs?.parm2);
    if (starStrings != null && starPixelsPerString != null) return starStrings * starPixelsPerString;
    if (starPixelsPerString != null) return starPixelsPerString;
  }

  const direct = normalizePositive(
    attrs?.PixelCount
    || attrs?.NumPoints
    || attrs?.pixelCount
    || attrs?.numPoints
  );
  if (direct != null) return direct;

  if (canonical === "custom") {
    const customPixels = countCustomModelPixels(attrs?.CustomModel);
    if (customPixels != null) return customPixels;
  }

  if (canonical === "matrix_horizontal" || canonical === "matrix_vertical" || canonical === "matrix") {
    const cols = normalizePositive(attrs?.parm1);
    const rows = normalizePositive(attrs?.parm2);
    if (cols != null && rows != null) return cols * rows;
  }
  return null;
}

function buildDensityMetadata({
  targetKind = "",
  node = null,
  submodelMetadata = {},
  canonicalType = ""
} = {}) {
  if (!node || typeof node !== "object") return null;
  const dims = node.dimensions || {};
  const width = normalizePositive(dims.width);
  const height = normalizePositive(dims.height);
  const depth = normalizePositive(dims.depth);
  const attrs = node.attributes || {};
  const canonical = low(canonicalType || node?.canonicalType || node?.type);
  const nodeCount = targetKind === "submodel"
    ? normalizePositive(submodelMetadata?.nodeCount)
    : normalizePositive(
        node?.nodeCount
        || inferNodeCountFromAttributes(attrs, canonical)
      );

  const forceLinear = canonical === "single_line"
    || canonical === "poly_line"
    || canonical === "icicles";
  const area = width && height ? width * height : null;
  const derivedPolylineLength = forceLinear ? computeScaledPolylineLength(node) : null;
  const linearSpan = derivedPolylineLength || width || height || depth || null;
  const areaDensity = !forceLinear && area && nodeCount ? nodeCount / area : null;
  const linearDensity = linearSpan && nodeCount ? nodeCount / linearSpan : null;
  const value = areaDensity ?? linearDensity;
  if (!Number.isFinite(value)) return null;

  return {
    basis: areaDensity != null ? "area" : "linear",
    value: safeFixed(value, 3),
    label: "",
    nodeCount: nodeCount != null ? Number(nodeCount) : null,
    footprint: {
      width: safeFixed(width),
      height: safeFixed(height),
      depth: safeFixed(depth),
      area: safeFixed(area),
      span: safeFixed(linearSpan)
    }
  };
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

function buildAssignmentIndex(assignments = []) {
  const index = new Map();
  for (const row of arr(assignments)) {
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

function buildSubmodelMetadata({
  targetKind = "",
  parentId = "",
  parentName = "",
  submodelCount = 0,
  memberCount = 0,
  modelMemberCount = 0,
  submodelMemberCount = 0
} = {}) {
  if (targetKind === "model") {
    return {
      hasSubmodels: Number(submodelCount) > 0,
      submodelCount: Number(submodelCount) || 0
    };
  }
  if (targetKind === "group") {
    return {
      memberCount: Number(memberCount) || 0,
      modelMemberCount: Number(modelMemberCount) || 0,
      submodelMemberCount: Number(submodelMemberCount) || 0,
      hasSubmodelMembers: Number(submodelMemberCount) > 0
    };
  }
  if (targetKind === "submodel") {
    return {
      parentId: norm(parentId),
      parentName: norm(parentName),
      nodeCount: Number(memberCount) || 0
    };
  }
  return {};
}

function inferSemanticTraits({ canonicalType = "", userTags = [], semanticHints = [] } = {}) {
  const traits = new Set();
  const canonical = low(canonicalType);
  if (canonical) traits.add(canonical);
  for (const tag of unique(userTags)) traits.add(low(tag));
  for (const hint of unique(semanticHints)) traits.add(low(hint));
  return [...traits];
}

function inferRole({ userTags = [], targetKind = "", groupMemberships = [] } = {}) {
  const tags = new Set(unique(userTags).map((row) => low(row)));
  if (tags.has("focal") || tags.has("hero")) return "focal";
  if (tags.has("support")) return "support";
  if (tags.has("background") || tags.has("ambient-fill")) return "background";
  if (tags.has("frame") || tags.has("perimeter")) return "frame";
  if (targetKind === "group" && groupMemberships.length) return "aggregate";
  return "";
}

function supportStateLabel({ trainedBuckets = [] } = {}) {
  return trainedBuckets.length ? "trained_supported" : "runtime_targetable_only";
}

function worstMetadataCompleteness(values = []) {
  const normalized = arr(values).map((row) => low(row)).filter(Boolean);
  if (normalized.includes("metadata_needed")) return "metadata_needed";
  if (normalized.includes("metadata_partial")) return "metadata_partial";
  return "metadata_ready";
}

function buildMetadataCompleteness({
  targetKind = "",
  canonicalType = "",
  inferredRole = "",
  inferredSemanticTraits = [],
  preference = {},
  userTags = [],
  trainedBuckets = [],
  submodelCount = 0,
  memberCount = 0
} = {}) {
  const normalizedCanonical = low(canonicalType);
  const semanticHints = unique([
    ...arr(preference?.semanticHints).map((row) => norm(row)).filter(Boolean),
    ...arr(preference?.submodelHints).map((row) => norm(row)).filter(Boolean)
  ]);
  const tags = unique(userTags);
  const structure = normalizedCanonical ? "metadata_ready" : "metadata_needed";
  const semantic = semanticHints.length
    ? "metadata_ready"
    : (arr(inferredSemanticTraits).length > 0 || tags.length || normalizedCanonical)
      ? "metadata_partial"
      : "metadata_needed";
  const role = norm(preference?.rolePreference) || norm(inferredRole)
    ? "metadata_ready"
    : ((targetKind === "group" || tags.length) ? "metadata_partial" : "metadata_needed");
  const submodel = targetKind === "submodel"
    ? (semanticHints.length ? "metadata_ready" : "metadata_partial")
    : targetKind === "group"
      ? (semanticHints.length ? "metadata_ready" : (memberCount > 0 ? "metadata_partial" : "metadata_needed"))
      : (Number(submodelCount) > 0
          ? (semanticHints.length ? "metadata_ready" : "metadata_partial")
          : "metadata_ready");
  const sequencing = trainedBuckets.length
    ? "metadata_ready"
    : normalizedCanonical
      ? "metadata_partial"
      : "metadata_needed";
  return {
    structure,
    semantic,
    role,
    submodel,
    sequencing,
    overall: worstMetadataCompleteness([structure, semantic, role, submodel, sequencing])
  };
}

function buildProvenanceDetail({
  trainedBuckets = [],
  canonicalType = "",
  userTags = [],
  preference = {},
  artifactVersion = "",
  confidence = 0
} = {}) {
  return {
    canonicalType: {
      source: "derived_layout",
      detail: canonicalType ? `Derived from layout/model display type as ${canonicalType}.` : "Canonical type not inferred."
    },
    supportState: {
      source: trainedBuckets.length ? "training_bundle" : "runtime_only",
      detail: trainedBuckets.length
        ? `Mapped into Stage 1 trained buckets: ${trainedBuckets.join(", ")}.`
        : "No Stage 1 trained bucket currently mapped for this target."
    },
    inferredRole: {
      source: userTags.length ? "metadata_tags" : "derived_layout",
      detail: userTags.length
        ? `Role inferred from current metadata tags: ${userTags.join(", ")}.`
        : "Role inferred from structure/layout context."
    },
    inferredSemanticTraits: {
      source: userTags.length ? "derived_plus_tags" : "derived_layout",
      detail: userTags.length
        ? `Traits inferred from layout facts plus metadata tags: ${userTags.join(", ")}.`
        : "Traits inferred from layout facts and target identity."
    },
    rolePreference: {
      source: preference?.rolePreference ? "user_override" : "auto",
      detail: preference?.rolePreference
        ? `User override set to ${norm(preference.rolePreference)}.`
        : "No explicit user override; using automatic role inference."
    },
    semanticHints: {
      source: (arr(preference?.semanticHints).length || arr(preference?.submodelHints).length) ? "user_override" : "none",
      detail: (arr(preference?.semanticHints).length || arr(preference?.submodelHints).length)
        ? `User visual hints: ${unique([...(preference.semanticHints || []), ...(preference.submodelHints || [])]).join(", ")}.`
        : "No explicit visual hints."
    },
    effectAvoidances: {
      source: arr(preference?.effectAvoidances).length ? "user_override" : "none",
      detail: arr(preference?.effectAvoidances).length
        ? `User effect avoidances: ${unique(preference.effectAvoidances).join(", ")}.`
        : "No explicit effect avoidances."
    },
    tags: {
      source: userTags.length ? "controlled_or_project_tags" : "none",
      detail: userTags.length
        ? `Current metadata tags applied: ${userTags.join(", ")}.`
        : "No metadata tags applied."
    },
    metadataCompleteness: {
      source: "metadata_framework",
      detail: "Metadata completeness is computed across structure, semantic, role, submodel, and sequencing dimensions."
    },
    training: {
      source: "training_bundle",
      detail: `Training artifact version ${norm(artifactVersion || "1.0")}.`
    },
    confidence: {
      source: "runtime_estimate",
      detail: `Current normalized metadata confidence is ${Number(confidence || 0).toFixed(2)}.`
    }
  };
}

function buildMetadataRecommendations({
  targetKind = "",
  displayName = "",
  metadataCompleteness = {},
  inferredRole = "",
  submodelMetadata = {}
} = {}) {
  const recs = [];
  const roleState = low(metadataCompleteness?.role);
  const semanticState = low(metadataCompleteness?.semantic);
  const submodelState = low(metadataCompleteness?.submodel);
  const name = norm(displayName) || "This target";

  if (roleState === "metadata_needed") {
    recs.push({
      type: "role_preference",
      priority: "high",
      message: `${name}: set a role preference so the planner understands whether this target should lead, support, frame, or sit in the background.`
    });
  }

  if (semanticState !== "metadata_ready") {
    recs.push({
      type: "prop_hints",
      priority: semanticState === "metadata_needed" ? "high" : "medium",
      message: `${name}: add a small number of visual hints to describe what this target is and what kind of content or look it supports.`
    });
  }

  if (submodelState === "metadata_partial") {
    if (targetKind === "model" && Number(submodelMetadata?.submodelCount || 0) > 0) {
      recs.push({
        type: "prop_hints",
        priority: "high",
        message: `${name}: add visual hints so the app understands what the child regions do, not just that they exist.`
      });
    } else if (targetKind === "group" && submodelMetadata?.hasSubmodelMembers) {
      recs.push({
        type: "prop_hints",
        priority: "high",
        message: `${name}: this group includes submodels; add visual hints so scoped planning can target the right internal regions.`
      });
    } else if (targetKind === "submodel") {
      recs.push({
        type: "prop_hints",
        priority: "high",
        message: `${name}: add visual hints that describe this region's function or visual role.`
      });
    }
  }

  if (!norm(inferredRole) && targetKind === "group") {
    recs.push({
      type: "group_role",
      priority: "medium",
      message: `${name}: clarify whether this group acts as a focal collection, support bed, or framing layer.`
    });
  }

  return recs;
}

export function buildNormalizedTargetMetadataRecords({
  sceneGraph = {},
  metadataAssignments = [],
  metadataPreferencesByTargetId = {}
} = {}) {
  const modelsById = sceneGraph?.modelsById || {};
  const groupsById = sceneGraph?.groupsById || {};
  const submodelsById = sceneGraph?.submodelsById || {};
  const assignmentIndex = buildAssignmentIndex(metadataAssignments);
  const preferenceIndex = metadataPreferencesByTargetId && typeof metadataPreferencesByTargetId === "object"
    ? metadataPreferencesByTargetId
    : {};
  const groupMembershipIndex = buildGroupMembershipIndex(groupsById);
  const trainedBundle = getStage1TrainedEffectBundle();
  const trainedModelBuckets = new Set(Object.keys(trainedBundle?.modelTypeIndex || {}));
  const artifactVersion = norm(trainedBundle?.artifactVersion || "1.0");
  const bounds = sceneGraph?.stats?.bounds || null;
  const now = new Date().toISOString();
  const records = [];

  for (const model of Object.values(modelsById)) {
    const targetId = norm(model?.id || model?.name);
    if (!targetId) continue;
    const assignment = assignmentIndex.get(targetId) || {};
    const preference = preferenceIndex[targetId] && typeof preferenceIndex[targetId] === "object" ? preferenceIndex[targetId] : {};
    const displayType = norm(model?.displayAs || model?.type || model?.displayType || "");
    const classification = classifyModelDisplayType(displayType);
    const trainedBuckets = mapClassificationToTrainingBuckets(classification).filter((bucket) => trainedModelBuckets.has(bucket));
    const groupMemberships = unique(groupMembershipIndex.get(targetId) || []);
    const userTags = unique(assignment?.tags || []);
    const confidence = trainedBuckets.length ? 1 : (classification?.canonicalType === "custom" ? 0.25 : 0.5);
    const submodelCount = Object.values(submodelsById).filter((row) => norm(row?.parentId) === targetId).length;
    const inferredRole = inferRole({ userTags, targetKind: "model", groupMemberships });
    const inferredSemanticTraits = inferSemanticTraits({
      canonicalType: classification?.canonicalType,
      userTags,
      semanticHints: unique([...(preference?.semanticHints || []), ...(preference?.submodelHints || [])])
    });
    const submodelMetadata = buildSubmodelMetadata({
      targetKind: "model",
      submodelCount
    });
    const locationMetadata = buildLocationMetadata({
      targetKind: "model",
      node: model,
      bounds
    });
    const densityMetadata = buildDensityMetadata({
      targetKind: "model",
      node: model,
      submodelMetadata,
      canonicalType: classification?.canonicalType
    });
    const metadataCompleteness = buildMetadataCompleteness({
      targetKind: "model",
      canonicalType: classification?.canonicalType,
      inferredRole,
      inferredSemanticTraits,
      preference,
      userTags,
      trainedBuckets,
      submodelCount
    });
    records.push({
      targetId,
      targetKind: "model",
      identity: {
        displayName: norm(model?.name || targetId),
        rawType: displayType,
        canonicalType: norm(classification?.canonicalType),
        parentId: "",
        parentName: ""
      },
      structure: {
        groupMemberships,
        submodelCount,
        submodelMetadata,
        locationMetadata,
        densityMetadata
      },
      semantics: {
        inferredRole,
        inferredSemanticTraits,
        supportState: supportStateLabel({ trainedBuckets }),
        metadataCompleteness
      },
      training: {
        trainedModelBuckets: trainedBuckets,
        trainedSupportState: trainedBuckets.length ? "trained_supported" : "out_of_stage1_model_support",
        trainingArtifactVersion: artifactVersion
      },
      user: {
        rolePreference: norm(preference?.rolePreference),
        semanticHints: unique([...(preference?.semanticHints || []), ...(preference?.submodelHints || [])]),
        effectAvoidances: unique(preference?.effectAvoidances),
        tags: userTags
      },
      recommendations: buildMetadataRecommendations({
        targetKind: "model",
        displayName: norm(model?.name || targetId),
        metadataCompleteness,
        inferredRole,
        submodelMetadata
      }),
      provenance: {
        updatedAt: now,
        confidence,
        fields: buildProvenanceDetail({
          trainedBuckets,
          canonicalType: norm(classification?.canonicalType),
          userTags,
          preference,
          artifactVersion,
          confidence
        })
      }
    });
  }

  for (const group of Object.values(groupsById)) {
    const targetId = norm(group?.id || group?.name);
    if (!targetId) continue;
    const assignment = assignmentIndex.get(targetId) || {};
    const preference = preferenceIndex[targetId] && typeof preferenceIndex[targetId] === "object" ? preferenceIndex[targetId] : {};
    const userTags = unique(assignment?.tags || []);
    const flattened = Array.isArray(group?.members?.flattened) ? group.members.flattened : [];
    const modelIds = new Set(Object.keys(modelsById || {}).map((row) => norm(row)));
    const submodelIds = new Set(Object.keys(submodelsById || {}).map((row) => norm(row)));
    const modelMemberCount = flattened.filter((row) => modelIds.has(norm(row?.id || row?.name))).length;
    const submodelMemberCount = flattened.filter((row) => submodelIds.has(norm(row?.id || row?.name))).length;
    const confidence = 0.5;
    const inferredRole = inferRole({ userTags, targetKind: "group", groupMemberships: [] });
    const inferredSemanticTraits = unique(["aggregate", ...userTags, ...unique([...(preference?.semanticHints || []), ...(preference?.submodelHints || [])])]);
    const submodelMetadata = buildSubmodelMetadata({
      targetKind: "group",
      memberCount: flattened.length,
      modelMemberCount,
      submodelMemberCount
    });
    const locationMetadata = buildLocationMetadata({
      targetKind: "group",
      node: group,
      bounds
    });
    const densityMetadata = buildDensityMetadata({
      targetKind: "group",
      node: group,
      submodelMetadata,
      canonicalType: "model_group"
    });
    const metadataCompleteness = buildMetadataCompleteness({
      targetKind: "group",
      canonicalType: "model_group",
      inferredRole,
      inferredSemanticTraits,
      preference,
      userTags,
      trainedBuckets: [],
      memberCount: flattened.length
    });
    records.push({
      targetId,
      targetKind: "group",
      identity: {
        displayName: norm(group?.name || targetId),
        rawType: "group",
        canonicalType: "model_group",
        parentId: "",
        parentName: ""
      },
      structure: {
        groupMemberships: [],
        memberCount: flattened.length,
        submodelMetadata,
        locationMetadata,
        densityMetadata
      },
      semantics: {
        inferredRole,
        inferredSemanticTraits,
        supportState: "runtime_targetable_only",
        metadataCompleteness
      },
      training: {
        trainedModelBuckets: [],
        trainedSupportState: "runtime_targetable_only",
        trainingArtifactVersion: artifactVersion
      },
      user: {
        rolePreference: norm(preference?.rolePreference),
        semanticHints: unique([...(preference?.semanticHints || []), ...(preference?.submodelHints || [])]),
        effectAvoidances: unique(preference?.effectAvoidances),
        tags: userTags
      },
      recommendations: buildMetadataRecommendations({
        targetKind: "group",
        displayName: norm(group?.name || targetId),
        metadataCompleteness,
        inferredRole,
        submodelMetadata
      }),
      provenance: {
        updatedAt: now,
        confidence,
        fields: buildProvenanceDetail({
          trainedBuckets: [],
          canonicalType: "model_group",
          userTags,
          preference,
          artifactVersion,
          confidence
        })
      }
    });
  }

  for (const submodel of Object.values(submodelsById)) {
    const targetId = norm(submodel?.id || submodel?.name);
    if (!targetId) continue;
    const assignment = assignmentIndex.get(targetId) || {};
    const preference = preferenceIndex[targetId] && typeof preferenceIndex[targetId] === "object" ? preferenceIndex[targetId] : {};
    const userTags = unique(assignment?.tags || []);
    const parentId = norm(submodel?.parentId);
    const confidence = 0.5;
    const inferredRole = inferRole({ userTags, targetKind: "submodel", groupMemberships: [] });
    const inferredSemanticTraits = unique(["submodel", ...userTags, ...unique([...(preference?.semanticHints || []), ...(preference?.submodelHints || [])])]);
    const nodeCount = Number(submodel?.membership?.nodeCount || 0);
    const parentNode = modelsById[parentId] || groupsById[parentId] || null;
    const submodelMetadata = buildSubmodelMetadata({
      targetKind: "submodel",
      parentId,
      parentName: parentId,
      memberCount: nodeCount
    });
    const locationMetadata = buildLocationMetadata({
      targetKind: "submodel",
      node: submodel,
      parentNode,
      bounds
    });
    const densityMetadata = buildDensityMetadata({
      targetKind: "submodel",
      node: parentNode,
      submodelMetadata,
      canonicalType: parentNode?.canonicalType || parentNode?.type
    });
    const metadataCompleteness = buildMetadataCompleteness({
      targetKind: "submodel",
      canonicalType: "submodel",
      inferredRole,
      inferredSemanticTraits,
      preference,
      userTags,
      trainedBuckets: [],
      memberCount: nodeCount
    });
    records.push({
      targetId,
      targetKind: "submodel",
      identity: {
        displayName: parentId ? `${parentId} / ${norm(submodel?.name || targetId)}` : norm(submodel?.name || targetId),
        rawType: "SubModel",
        canonicalType: "submodel",
        parentId,
        parentName: parentId
      },
      structure: {
        groupMemberships: unique(groupMembershipIndex.get(targetId) || []),
        memberCount: nodeCount,
        submodelMetadata,
        locationMetadata,
        densityMetadata
      },
      semantics: {
        inferredRole,
        inferredSemanticTraits,
        supportState: "runtime_targetable_only",
        metadataCompleteness
      },
      training: {
        trainedModelBuckets: [],
        trainedSupportState: "runtime_targetable_only",
        trainingArtifactVersion: artifactVersion
      },
      user: {
        rolePreference: norm(preference?.rolePreference),
        semanticHints: unique([...(preference?.semanticHints || []), ...(preference?.submodelHints || [])]),
        effectAvoidances: unique(preference?.effectAvoidances),
        tags: userTags
      },
      recommendations: buildMetadataRecommendations({
        targetKind: "submodel",
        displayName: parentId ? `${parentId} / ${norm(submodel?.name || targetId)}` : norm(submodel?.name || targetId),
        metadataCompleteness,
        inferredRole,
        submodelMetadata
      }),
      provenance: {
        updatedAt: now,
        confidence,
        fields: buildProvenanceDetail({
          trainedBuckets: [],
          canonicalType: "submodel",
          userTags,
          preference,
          artifactVersion,
          confidence
        })
      }
    });
  }

  return applyVisualWeightBands(records);
}

export function summarizeNormalizedTargetMetadata(records = []) {
  const rows = arr(records);
  const models = rows.filter((row) => row?.targetKind === "model");
  return {
    total: rows.length,
    models: models.length,
    trainedSupportedModels: models.filter((row) => row?.training?.trainedSupportState === "trained_supported").length,
    runtimeOnlyModels: models.filter((row) => row?.training?.trainedSupportState !== "trained_supported").length
  };
}
