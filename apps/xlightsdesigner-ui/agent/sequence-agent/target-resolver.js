import { parseSubmodelParentId } from "../shared/target-semantics-registry.js";

function normalizeName(value) {
  return String(value || "").trim().toLowerCase();
}

function uniqueById(rows) {
  const byId = new Map();
  for (const row of rows || []) {
    const id = String(row?.id || "").trim();
    if (!id || byId.has(id)) continue;
    byId.set(id, row);
  }
  return Array.from(byId.values());
}

function mapDisplayElements(elements = []) {
  const byId = new Map();
  for (const row of elements || []) {
    const id = String(row?.id ?? row?.name ?? "").trim();
    const name = String(row?.name ?? row?.id ?? "").trim();
    if (id) byId.set(id, row);
    if (name) byId.set(name, row);
  }
  return byId;
}

function mapLiveTargets(models = [], submodels = []) {
  const rows = [];
  for (const model of models) {
    const id = String(model?.id ?? model?.modelId ?? model?.name ?? "").trim();
    if (!id) continue;
    rows.push({
      id,
      name: String(model?.name || id),
      type: String(model?.type || "model").toLowerCase(),
      parentId: ""
    });
  }
  for (const submodel of submodels) {
    const id = String(submodel?.id || "").trim();
    if (!id) continue;
    rows.push({
      id,
      name: String(submodel?.name || id),
      type: "submodel",
      parentId: String(submodel?.parentId || parseSubmodelParentId(id)).trim()
    });
  }
  return uniqueById(rows);
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function exactGoalTokenMatch(goal = "", token = "", { allowSlashBoundary = false } = {}) {
  const normalizedGoal = normalizeName(goal);
  const normalizedToken = normalizeName(token);
  if (!normalizedGoal || !normalizedToken) return false;
  const boundaryClass = allowSlashBoundary ? "a-z0-9" : "a-z0-9/";
  const pattern = new RegExp(`(^|[^${boundaryClass}])${escapeRegex(normalizedToken)}([^${boundaryClass}]|$)`, "i");
  return pattern.test(normalizedGoal);
}

function buildNameCounts(targets = []) {
  const counts = new Map();
  for (const target of targets || []) {
    const name = normalizeName(target?.name);
    if (!name) continue;
    counts.set(name, Number(counts.get(name) || 0) + 1);
  }
  return counts;
}

function goalMentionsTarget(goal = "", target = null, nameCounts = new Map()) {
  const normalizedGoal = normalizeName(goal);
  const name = normalizeName(target?.name);
  if (!normalizedGoal || !name) return false;
  const id = normalizeName(target?.id);
  const parentId = normalizeName(target?.parentId);

  if (id && exactGoalTokenMatch(normalizedGoal, id)) return true;
  if (parentId && name && exactGoalTokenMatch(normalizedGoal, `${parentId}/${name}`)) return true;
  if (parentId && name && exactGoalTokenMatch(normalizedGoal, `${parentId} ${name}`, { allowSlashBoundary: true })) return true;

  if (!exactGoalTokenMatch(normalizedGoal, name)) return false;

  if (target?.type === "submodel") {
    const nameCount = Number(nameCounts.get(name) || 0);
    if (nameCount > 1) return false;
    if (name.length <= 4) return false;
    if (!parentId) return false;
  }

  return true;
}

export function resolveTargetSelection({
  normalizedIntent,
  models = [],
  submodels = [],
  metadataAssignments = [],
  displayElements = []
} = {}) {
  const liveTargets = mapLiveTargets(models, submodels);
  const byId = new Map(liveTargets.map((row) => [row.id, row]));
  const nameCounts = buildNameCounts(liveTargets);
  const displayByName = mapDisplayElements(displayElements);
  const chosen = new Map();
  const unresolved = new Map();
  let resolutionSource = "none";

  const metadataTermsForAssignment = (assignment = {}) => {
    const tags = Array.isArray(assignment?.tags) ? assignment.tags : [];
    const semanticHints = Array.isArray(assignment?.semanticHints) ? assignment.semanticHints : [];
    return [...new Set([...tags, ...semanticHints].map(normalizeName).filter(Boolean))];
  };

  const isWritableTarget = (target) => {
    if (!target) return false;
    if (!displayByName.size) return true;
    if (target.type === "submodel") return true;
    return displayByName.has(String(target.id || "").trim()) || displayByName.has(String(target.name || "").trim());
  };

  const recordUnresolved = (target) => {
    const id = String(target?.id || "").trim();
    if (!id || unresolved.has(id)) return;
    unresolved.set(id, target);
  };

  const intent = normalizedIntent || {};
  for (const id of intent.targetIds || []) {
    if (!byId.has(id)) continue;
    const target = byId.get(id);
    if (isWritableTarget(target)) {
      chosen.set(id, target);
      resolutionSource = "explicit";
    } else {
      recordUnresolved(target);
    }
  }

  const tagSet = new Set((intent.tags || []).map(normalizeName));
  if (tagSet.size) {
    for (const assignment of metadataAssignments || []) {
      const id = String(assignment?.targetId || "").trim();
      if (!id || !byId.has(id)) continue;
      const terms = metadataTermsForAssignment(assignment);
      const matches = terms.some((term) => tagSet.has(term));
      if (!matches) continue;
      const target = byId.get(id);
      if (isWritableTarget(target)) {
        chosen.set(id, target);
        if (resolutionSource === "none") resolutionSource = "tag";
      } else {
        recordUnresolved(target);
      }
    }
  }

  let matchedGoalTarget = false;
  if (!chosen.size && intent.goal) {
    const goal = normalizeName(intent.goal);
    for (const target of liveTargets) {
      if (!goalMentionsTarget(goal, target, nameCounts)) continue;
      matchedGoalTarget = true;
      if (isWritableTarget(target)) {
        chosen.set(target.id, target);
        if (resolutionSource === "none") resolutionSource = "goal_match";
      } else {
        recordUnresolved(target);
      }
    }
  }

  if (!chosen.size && !matchedGoalTarget && !unresolved.size) {
    const fallbackTargets = displayByName.size
      ? liveTargets.filter((target) => isWritableTarget(target))
      : liveTargets;
    for (const target of fallbackTargets.slice(0, 4)) chosen.set(target.id, target);
    if (chosen.size) resolutionSource = "fallback";
  }

  return {
    targets: Array.from(chosen.values()),
    unresolvedTargets: Array.from(unresolved.values()),
    resolutionSource
  };
}

export function resolveTargets(input = {}) {
  return resolveTargetSelection(input).targets;
}
