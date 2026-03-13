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
      parentId: String(submodel?.parentId || "").trim()
    });
  }
  return uniqueById(rows);
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
  const displayByName = mapDisplayElements(displayElements);
  const chosen = new Map();
  const unresolved = new Map();

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
    } else {
      recordUnresolved(target);
    }
  }

  const tagSet = new Set((intent.tags || []).map(normalizeName));
  if (tagSet.size) {
    for (const assignment of metadataAssignments || []) {
      const id = String(assignment?.targetId || "").trim();
      if (!id || !byId.has(id)) continue;
      const tags = Array.isArray(assignment?.tags) ? assignment.tags : [];
      const matches = tags.some((tag) => tagSet.has(normalizeName(tag)));
      if (!matches) continue;
      const target = byId.get(id);
      if (isWritableTarget(target)) {
        chosen.set(id, target);
      } else {
        recordUnresolved(target);
      }
    }
  }

  let matchedGoalTarget = false;
  if (!chosen.size && intent.goal) {
    const goal = normalizeName(intent.goal);
    for (const target of liveTargets) {
      const name = normalizeName(target.name);
      if (!name || !goal.includes(name)) continue;
      matchedGoalTarget = true;
      if (isWritableTarget(target)) {
        chosen.set(target.id, target);
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
  }

  return {
    targets: Array.from(chosen.values()),
    unresolvedTargets: Array.from(unresolved.values())
  };
}

export function resolveTargets(input = {}) {
  return resolveTargetSelection(input).targets;
}
