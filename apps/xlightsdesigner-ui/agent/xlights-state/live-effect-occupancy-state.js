function str(value = "") {
  return String(value || "").trim();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeQuery(query = {}) {
  return {
    modelName: str(query?.modelName),
    layerIndex: Number.isFinite(Number(query?.layerIndex)) ? Number(query.layerIndex) : null,
    startMs: Number.isFinite(Number(query?.startMs)) ? Number(query.startMs) : null,
    endMs: Number.isFinite(Number(query?.endMs)) ? Number(query.endMs) : null,
    effectName: str(query?.effectName)
  };
}

function queryKey(query = {}) {
  return [
    str(query?.modelName),
    query?.layerIndex == null ? "*" : String(query.layerIndex),
    query?.startMs == null ? "*" : String(query.startMs),
    query?.endMs == null ? "*" : String(query.endMs),
    str(query?.effectName || "*")
  ].join("|");
}

function normalizeEffect(effect = {}) {
  return {
    modelName: str(effect?.modelName),
    layerIndex: Number.isFinite(Number(effect?.layerIndex)) ? Number(effect.layerIndex) : null,
    effectName: str(effect?.effectName),
    startMs: Number.isFinite(Number(effect?.startMs)) ? Number(effect.startMs) : null,
    endMs: Number.isFinite(Number(effect?.endMs)) ? Number(effect.endMs) : null
  };
}

function matchesEffect(query, effect) {
  if (query.modelName && query.modelName !== effect.modelName) return false;
  if (query.layerIndex != null && query.layerIndex !== effect.layerIndex) return false;
  if (query.effectName && query.effectName !== effect.effectName) return false;
  if (query.startMs != null && query.startMs !== effect.startMs) return false;
  if (query.endMs != null && query.endMs !== effect.endMs) return false;
  return true;
}

export function buildXLightsEffectOccupancyState({ queries = [], effectsByQuery = {} } = {}) {
  const normalizedQueries = asArray(queries).map(normalizeQuery).filter((query) => query.modelName);
  const rows = normalizedQueries.map((query) => {
    const key = queryKey(query);
    const effects = asArray(effectsByQuery[key]).map(normalizeEffect);
    const matched = effects.filter((effect) => matchesEffect(query, effect));
    return {
      query,
      queryKey: key,
      effectCount: effects.length,
      matchedCount: matched.length,
      matched,
      ok: matched.length > 0
    };
  });
  return {
    contract: "xlights_effect_occupancy_state_v1",
    version: "1.0",
    summary: rows.length
      ? `${rows.filter((row) => row.ok).length}/${rows.length} occupancy quer${rows.length === 1 ? "y" : "ies"} matched.`
      : "No effect occupancy queries were requested.",
    queryCount: rows.length,
    matchedCount: rows.filter((row) => row.ok).length,
    rows
  };
}

export async function readXLightsEffectOccupancyState(endpoint, queries = [], deps = {}) {
  const { listEffects } = deps;
  if (typeof listEffects !== "function") throw new Error("listEffects is required");
  const normalizedQueries = asArray(queries).map(normalizeQuery).filter((query) => query.modelName);
  const effectsByQuery = {};
  await Promise.all(
    normalizedQueries.map(async (query) => {
      const key = queryKey(query);
      const resp = await listEffects(endpoint, {
        modelName: query.modelName,
        layerIndex: query.layerIndex == null ? undefined : query.layerIndex,
        startMs: query.startMs == null ? undefined : query.startMs,
        endMs: query.endMs == null ? undefined : query.endMs
      });
      effectsByQuery[key] = asArray(resp?.data?.effects);
    })
  );
  return buildXLightsEffectOccupancyState({ queries: normalizedQueries, effectsByQuery });
}
