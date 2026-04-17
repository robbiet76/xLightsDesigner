function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function num(value, fallback = 0) {
  const out = Number(value);
  return Number.isFinite(out) ? out : fallback;
}

function parentTargetId(targetId = "", submodelsById = {}) {
  const normalized = str(targetId);
  if (!normalized) return "";
  const explicitParent = str(submodelsById?.[normalized]?.parentId);
  if (explicitParent) return explicitParent;
  return normalized.includes("/") ? normalized.split("/")[0] : normalized;
}

function windowsOverlap(a, b) {
  return num(a?.startMs) < num(b?.endMs) && num(b?.startMs) < num(a?.endMs);
}

function windowsTouchOrOverlap(a, b, toleranceMs = 1) {
  return num(a?.startMs) <= num(b?.endMs) + toleranceMs
    && num(b?.startMs) <= num(a?.endMs) + toleranceMs;
}

function makeGroupId(prefix, placements = []) {
  const ids = placements.map((row) => str(row?.placementId)).filter(Boolean).sort();
  return `${prefix}:${ids.join("|")}`;
}

function pairwiseGroups(placements = [], predicate = () => false) {
  const out = [];
  for (let i = 0; i < placements.length; i += 1) {
    for (let j = i + 1; j < placements.length; j += 1) {
      const left = placements[i];
      const right = placements[j];
      if (!predicate(left, right)) continue;
      out.push([left, right]);
    }
  }
  return out;
}

function uniqByGroupId(groups = []) {
  const seen = new Set();
  const out = [];
  for (const group of groups) {
    if (seen.has(group.groupId)) continue;
    seen.add(group.groupId);
    out.push(group);
  }
  return out;
}

function sortPlacements(placements = []) {
  return arr(placements).slice().sort((a, b) => (
    num(a?.startMs) - num(b?.startMs)
      || num(a?.endMs) - num(b?.endMs)
      || str(a?.targetId).localeCompare(str(b?.targetId))
      || num(a?.layerIndex) - num(b?.layerIndex)
      || str(a?.placementId).localeCompare(str(b?.placementId))
  ));
}

export function buildLayeringPlacementGroups({ effectPlacements = [], submodelsById = {} } = {}) {
  const placements = sortPlacements(effectPlacements).map((row) => ({
    ...row,
    targetId: str(row?.targetId),
    parentTargetId: parentTargetId(row?.targetId, submodelsById),
    layerIndex: Number.isInteger(Number(row?.layerIndex)) ? Number(row.layerIndex) : 0,
    startMs: num(row?.startMs),
    endMs: num(row?.endMs)
  })).filter((row) => row.targetId && row.endMs > row.startMs);

  const groups = [];
  const unresolved = [];

  const byTarget = new Map();
  for (const placement of placements) {
    const key = placement.targetId;
    if (!byTarget.has(key)) byTarget.set(key, []);
    byTarget.get(key).push(placement);
  }

  for (const [targetId, targetPlacements] of byTarget.entries()) {
    for (const [left, right] of pairwiseGroups(targetPlacements, windowsOverlap)) {
      groups.push({
        artifactType: "layering_placement_group_v1",
        groupId: makeGroupId("same_target_layer_stack", [left, right]),
        taxonomy: "same_target_layer_stack",
        targetId,
        parentTargetId: left.parentTargetId,
        overlapType: "same_target",
        placements: [left, right],
        evidenceReady: true,
        unresolvedReason: ""
      });
    }
    for (const [left, right] of pairwiseGroups(targetPlacements, (a, b) => !windowsOverlap(a, b) && windowsTouchOrOverlap(a, b))) {
      groups.push({
        artifactType: "layering_placement_group_v1",
        groupId: makeGroupId("same_target_transition", [left, right]),
        taxonomy: "same_target_transition",
        targetId,
        parentTargetId: left.parentTargetId,
        overlapType: "same_target_transition",
        placements: [left, right],
        evidenceReady: true,
        unresolvedReason: ""
      });
    }
  }

  const byParent = new Map();
  for (const placement of placements) {
    const key = placement.parentTargetId;
    if (!key) continue;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(placement);
  }

  for (const [parentId, siblingPlacements] of byParent.entries()) {
    for (const [left, right] of pairwiseGroups(siblingPlacements, (a, b) => (
      a.targetId !== b.targetId
      && windowsOverlap(a, b)
      && (a.targetId === parentId || b.targetId === parentId)
    ))) {
      groups.push({
        artifactType: "layering_placement_group_v1",
        groupId: makeGroupId("parent_submodel_overlap", [left, right]),
        taxonomy: "parent_submodel_overlap",
        targetId: left.targetId === parentId ? left.targetId : right.targetId,
        parentTargetId: parentId,
        overlapType: "parent_submodel",
        placements: [left, right],
        evidenceReady: true,
        unresolvedReason: ""
      });
    }
    for (const [left, right] of pairwiseGroups(siblingPlacements, (a, b) => (
      a.targetId !== b.targetId
      && windowsOverlap(a, b)
      && a.targetId !== parentId
      && b.targetId !== parentId
    ))) {
      unresolved.push({
        artifactType: "layering_placement_group_v1",
        groupId: makeGroupId("sibling_submodel_overlap", [left, right]),
        taxonomy: "sibling_submodel_overlap",
        targetId: "",
        parentTargetId: parentId,
        overlapType: "sibling_submodel_overlap",
        placements: [left, right],
        evidenceReady: false,
        unresolvedReason: "effectPlacements provide shared parent ancestry but not enough physical ownership detail to prove sibling overlap."
      });
    }
  }

  for (const placement of placements) {
    if (placement.renderIntent?.bufferStyle === "canvas" || placement.layerIntent?.blendRole === "canvas") {
      unresolved.push({
        artifactType: "layering_placement_group_v1",
        groupId: makeGroupId("canvas_preload_stack", [placement]),
        taxonomy: "canvas_preload_stack",
        targetId: placement.targetId,
        parentTargetId: placement.parentTargetId,
        overlapType: "same_target",
        placements: [placement],
        evidenceReady: false,
        unresolvedReason: "canvas/preload behavior is engine-owned and cannot be proven from effectPlacements alone."
      });
    }
  }

  return {
    artifactType: "layering_placement_group_set_v1",
    artifactVersion: 1,
    groups: uniqByGroupId(groups),
    unresolved: uniqByGroupId(unresolved)
  };
}

