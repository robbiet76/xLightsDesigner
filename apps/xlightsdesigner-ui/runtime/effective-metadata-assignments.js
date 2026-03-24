import { normalizeMetadataTagName } from "./metadata-tag-schema.js";
import { mergeVisualHintDefinitions } from "./visual-hint-definitions.js";

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function norm(value = "") {
  return normalizeMetadataTagName(value);
}

function buildMergedAssignment(baseAssignment = {}, preference = {}, definitionIndex = new Map()) {
  const semanticHints = Array.from(new Set([
    ...arr(preference?.semanticHints),
    ...arr(preference?.submodelHints)
  ].map(norm).filter(Boolean)));
  const tags = Array.from(new Set([
    ...arr(baseAssignment?.tags),
    ...(preference?.rolePreference ? [preference.rolePreference] : []),
    ...semanticHints
  ].map(norm).filter(Boolean)));
  return {
    ...baseAssignment,
    tags,
    semanticHints,
    visualHintDefinitions: semanticHints
      .map((name) => definitionIndex.get(name) || null)
      .filter((row) => row && row.status === "defined"),
    effectAvoidances: arr(preference?.effectAvoidances).map(norm).filter(Boolean),
    rolePreference: preference?.rolePreference ? norm(preference.rolePreference) : ""
  };
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
