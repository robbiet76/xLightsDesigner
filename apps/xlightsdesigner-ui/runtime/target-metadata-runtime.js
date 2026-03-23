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
  const semanticHints = arr(preference?.semanticHints).map((row) => norm(row)).filter(Boolean);
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
    ? "metadata_ready"
    : targetKind === "group"
      ? (memberCount > 0 ? "metadata_partial" : "metadata_needed")
      : (Number(submodelCount) > 0 ? "metadata_partial" : "metadata_ready");
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
      source: arr(preference?.semanticHints).length ? "user_override" : "none",
      detail: arr(preference?.semanticHints).length
        ? `User semantic hints: ${unique(preference.semanticHints).join(", ")}.`
        : "No explicit semantic hints."
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
    const confidence = trainedBuckets.length ? 1 : (classification?.canonicalType === "custom" ? 0.25 : 0.5);
    const submodelCount = Object.values(submodelsById).filter((row) => norm(row?.parentId) === targetId).length;
    const inferredRole = inferRole({ userTags, targetKind: "model", groupMemberships });
    const inferredSemanticTraits = inferSemanticTraits({
      canonicalType: classification?.canonicalType,
      userTags,
      semanticHints: unique(preference?.semanticHints)
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
        submodelCount
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
        semanticHints: unique(preference?.semanticHints),
        effectAvoidances: unique(preference?.effectAvoidances),
        tags: userTags
      },
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
    const confidence = 0.5;
    const inferredRole = inferRole({ userTags, targetKind: "group", groupMemberships: [] });
    const inferredSemanticTraits = unique(["aggregate", ...userTags, ...unique(preference?.semanticHints)]);
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
        memberCount: flattened.length
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
        semanticHints: unique(preference?.semanticHints),
        effectAvoidances: unique(preference?.effectAvoidances),
        tags: userTags
      },
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
    const inferredSemanticTraits = unique(["submodel", ...userTags, ...unique(preference?.semanticHints)]);
    const metadataCompleteness = buildMetadataCompleteness({
      targetKind: "submodel",
      canonicalType: "submodel",
      inferredRole,
      inferredSemanticTraits,
      preference,
      userTags,
      trainedBuckets: [],
      memberCount: Number(submodel?.membership?.nodeCount || 0)
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
        memberCount: Number(submodel?.membership?.nodeCount || 0)
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
        semanticHints: unique(preference?.semanticHints),
        effectAvoidances: unique(preference?.effectAvoidances),
        tags: userTags
      },
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
