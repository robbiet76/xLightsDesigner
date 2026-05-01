import { normalizeMetadataTagName } from "./metadata-tag-schema.js";
import { mergeVisualHintDefinitions } from "./visual-hint-definitions.js";

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function norm(value = "") {
  return normalizeMetadataTagName(value);
}

function normBucket(value = "") {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function buildMergedAssignment(baseAssignment = {}, preference = {}, definitionIndex = new Map()) {
  const semanticHints = Array.from(new Set([
    ...arr(preference?.semanticHints),
    ...arr(preference?.submodelHints)
  ].map(norm).filter(Boolean)));
  const trainingBuckets = Array.from(new Set([
    ...arr(baseAssignment?.trainingBuckets),
    ...arr(preference?.trainingBuckets)
  ].map(normBucket).filter(Boolean)));
  const tags = Array.from(new Set([
    ...arr(baseAssignment?.tags),
    ...(preference?.rolePreference ? [preference.rolePreference] : []),
    ...semanticHints,
    ...trainingBuckets
  ].map(norm).filter(Boolean)));
  const merged = {
    ...baseAssignment,
    tags,
    semanticHints,
    visualHintDefinitions: semanticHints
      .map((name) => definitionIndex.get(name) || null)
      .filter((row) => row && row.status === "defined"),
    effectAvoidances: arr(preference?.effectAvoidances).map(norm).filter(Boolean),
    rolePreference: preference?.rolePreference ? norm(preference.rolePreference) : ""
  };
  if (trainingBuckets.length) merged.trainingBuckets = trainingBuckets;
  else delete merged.trainingBuckets;
  return merged;
}

export function buildEffectiveMetadataAssignments(assignments = [], preferencesByTargetId = {}, { resolveTarget = null, visualHintDefinitions = [] } = {}) {
  const base = Array.isArray(assignments) ? assignments : [];
  const prefIndex = preferencesByTargetId && typeof preferencesByTargetId === "object" ? preferencesByTargetId : {};
  const definitionIndex = new Map(
    mergeVisualHintDefinitions(visualHintDefinitions).map((row) => [row.name, row])
  );
  const byTargetId = new Map();

  for (const assignment of base) {
    const targetId = String(assignment?.targetId || "").trim();
    if (!targetId) continue;
    const pref = prefIndex[targetId] && typeof prefIndex[targetId] === "object" ? prefIndex[targetId] : null;
    byTargetId.set(targetId, pref ? buildMergedAssignment(assignment, pref, definitionIndex) : { ...assignment });
  }

  for (const [targetId, pref] of Object.entries(prefIndex)) {
    const id = String(targetId || "").trim();
    if (!id || byTargetId.has(id) || !pref || typeof pref !== "object") continue;
    const target = typeof resolveTarget === "function" ? resolveTarget(id) : null;
    const assignment = {
      targetId: id,
      targetType: String(target?.type || "").trim(),
      targetParentId: String(target?.parentId || "").trim(),
      tags: []
    };
    byTargetId.set(id, buildMergedAssignment(assignment, pref, definitionIndex));
  }

  return Array.from(byTargetId.values());
}
