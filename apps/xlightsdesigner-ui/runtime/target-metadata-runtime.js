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

function inferSemanticTraits({ canonicalType = "", targetId = "", groupMemberships = [], userTags = [] } = {}) {
  const traits = new Set();
  const canonical = low(canonicalType);
  if (canonical) traits.add(canonical);
  for (const tag of unique(userTags)) traits.add(low(tag));
  const haystack = `${norm(targetId)} ${unique(groupMemberships).join(" ")}`.toLowerCase();
  if (canonical === "custom" && /snowman|train|present|tune|sign|wreath|snowflake|snowball/.test(haystack)) {
    traits.add("figure_like");
  }
  if (canonical === "custom" && /spinner|star|radial/.test(haystack)) {
    traits.add("radial_like");
  }
  if (canonical === "custom" && /cane/.test(haystack)) {
    traits.add("linear_like");
  }
  if (canonical === "custom" && /tree/.test(haystack)) {
    traits.add("tree_like");
  }
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
        submodelCount: Object.values(submodelsById).filter((row) => norm(row?.parentId) === targetId).length
      },
      semantics: {
        inferredRole: inferRole({ userTags, targetKind: "model", groupMemberships }),
        inferredSemanticTraits: inferSemanticTraits({
          canonicalType: classification?.canonicalType,
          targetId,
          groupMemberships,
          userTags
        }),
        supportState: supportStateLabel({ trainedBuckets })
      },
      training: {
        trainedModelBuckets: trainedBuckets,
        trainedSupportState: trainedBuckets.length ? "trained_supported" : "out_of_stage1_model_support",
        trainingArtifactVersion: artifactVersion
      },
      user: {
        rolePreference: norm(preference?.rolePreference),
        semanticHints: unique(preference?.semanticHints),
        effectAvoidances: unique(preference?.effectAvoidances),
        tags: userTags
      },
      provenance: {
        updatedAt: now,
        confidence: trainedBuckets.length ? 1 : (classification?.canonicalType === "custom" ? 0.25 : 0.5)
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
        memberCount: flattened.length
      },
      semantics: {
        inferredRole: inferRole({ userTags, targetKind: "group", groupMemberships: [] }),
        inferredSemanticTraits: unique(["aggregate", ...userTags]),
        supportState: "runtime_targetable_only"
      },
      training: {
        trainedModelBuckets: [],
        trainedSupportState: "runtime_targetable_only",
        trainingArtifactVersion: artifactVersion
      },
      user: {
        rolePreference: norm(preference?.rolePreference),
        semanticHints: unique(preference?.semanticHints),
        effectAvoidances: unique(preference?.effectAvoidances),
        tags: userTags
      },
      provenance: {
        updatedAt: now,
        confidence: 0.5
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
        memberCount: Number(submodel?.membership?.nodeCount || 0)
      },
      semantics: {
        inferredRole: inferRole({ userTags, targetKind: "submodel", groupMemberships: [] }),
        inferredSemanticTraits: unique(["submodel", ...userTags]),
        supportState: "runtime_targetable_only"
      },
      training: {
        trainedModelBuckets: [],
        trainedSupportState: "runtime_targetable_only",
        trainingArtifactVersion: artifactVersion
      },
      user: {
        rolePreference: norm(preference?.rolePreference),
        semanticHints: unique(preference?.semanticHints),
        effectAvoidances: unique(preference?.effectAvoidances),
        tags: userTags
      },
      provenance: {
        updatedAt: now,
        confidence: 0.5
      }
    });
  }

  return records;
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
