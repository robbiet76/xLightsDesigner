function normText(value = "") {
  return String(value || "").trim();
}

function normArray(value) {
  return Array.isArray(value) ? value : [];
}

function normType(value = "") {
  const key = normText(value).toLowerCase();
  if (["int", "integer", "number"].includes(key)) return "int";
  if (["bool", "boolean"].includes(key)) return "bool";
  if (["enum", "choice"].includes(key)) return "enum";
  if (["curve", "valuecurve"].includes(key)) return "curve";
  if (["file", "filepath"].includes(key)) return "file";
  if (["string", "text"].includes(key)) return "string";
  return "string";
}

function normalizeParam(entry = {}) {
  const row = entry && typeof entry === "object" ? entry : {};
  const name = normText(row.name);
  if (!name) return null;
  const out = {
    name,
    type: normType(row.type),
    required: Boolean(row.required),
    description: normText(row.description),
    defaultValue: row.default
  };
  if (Number.isFinite(Number(row.min))) out.min = Number(row.min);
  if (Number.isFinite(Number(row.max))) out.max = Number(row.max);
  if (Array.isArray(row.enumValues)) {
    out.enumValues = row.enumValues.map((v) => normText(v)).filter(Boolean);
  }
  return out;
}

function normalizeDefinition(entry = {}) {
  const row = entry && typeof entry === "object" ? entry : {};
  const effectName = normText(row.effectName);
  if (!effectName) return null;

  const params = [];
  const seen = new Set();
  for (const param of normArray(row.params)) {
    const normalized = normalizeParam(param);
    if (!normalized) continue;
    if (seen.has(normalized.name)) continue;
    seen.add(normalized.name);
    params.push(normalized);
  }

  const effectId = Number.isFinite(Number(row.effectId)) ? Number(row.effectId) : null;
  return {
    effectName,
    effectId,
    displayName: normText(row.displayName) || effectName,
    category: normText(row.category).toLowerCase() || "general",
    supportsPartialTimeInterval: Boolean(row.supportsPartialTimeInterval),
    params,
    paramIndex: Object.fromEntries(params.map((p) => [p.name, p]))
  };
}

export function buildEffectDefinitionCatalog(definitions = [], metadata = {}) {
  const rows = normArray(definitions);
  const normalized = [];
  const byName = {};
  const byId = {};
  const categoryCounts = {};

  for (const row of rows) {
    const effect = normalizeDefinition(row);
    if (!effect) continue;
    normalized.push(effect);
    byName[effect.effectName] = effect;
    if (effect.effectId != null) byId[String(effect.effectId)] = effect;
    categoryCounts[effect.category] = Number(categoryCounts[effect.category] || 0) + 1;
  }

  normalized.sort((a, b) => a.effectName.localeCompare(b.effectName));

  return {
    loaded: true,
    source: normText(metadata.source) || "effects.listDefinitions",
    loadedAt: metadata.loadedAt || new Date().toISOString(),
    definitionCount: normalized.length,
    categoryCounts,
    definitions: normalized,
    byName,
    byId
  };
}

export function emptyEffectDefinitionCatalog(reason = "") {
  return {
    loaded: false,
    source: "",
    loadedAt: "",
    definitionCount: 0,
    categoryCounts: {},
    definitions: [],
    byName: {},
    byId: {},
    error: normText(reason)
  };
}
