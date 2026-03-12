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

export function resolveTargets({
  normalizedIntent,
  models = [],
  submodels = [],
  metadataAssignments = []
} = {}) {
  const liveTargets = mapLiveTargets(models, submodels);
  const byId = new Map(liveTargets.map((row) => [row.id, row]));
  const chosen = new Map();

  const intent = normalizedIntent || {};
  for (const id of intent.targetIds || []) {
    if (byId.has(id)) chosen.set(id, byId.get(id));
  }

  const tagSet = new Set((intent.tags || []).map(normalizeName));
  if (tagSet.size) {
    for (const assignment of metadataAssignments || []) {
      const id = String(assignment?.targetId || "").trim();
      if (!id || !byId.has(id)) continue;
      const tags = Array.isArray(assignment?.tags) ? assignment.tags : [];
      const matches = tags.some((tag) => tagSet.has(normalizeName(tag)));
      if (matches) chosen.set(id, byId.get(id));
    }
  }

  if (!chosen.size && intent.goal) {
    const goal = normalizeName(intent.goal);
    for (const target of liveTargets) {
      const name = normalizeName(target.name);
      if (name && goal.includes(name)) chosen.set(target.id, target);
    }
  }

  if (!chosen.size) {
    for (const target of liveTargets.slice(0, 4)) chosen.set(target.id, target);
  }

  return Array.from(chosen.values());
}
