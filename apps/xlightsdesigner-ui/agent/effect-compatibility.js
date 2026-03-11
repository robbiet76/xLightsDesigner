function normText(value = "") {
  return String(value || "").trim();
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asObject(value) {
  return isPlainObject(value) ? value : {};
}

function isEffectMutationCommand(cmd = "") {
  const key = normText(cmd);
  return key.startsWith("effects.");
}

function checkParamValueType(param = {}, value) {
  const type = normText(param.type).toLowerCase();
  if (type === "bool") return typeof value === "boolean";
  if (type === "int") return Number.isFinite(Number(value));
  if (type === "enum") return typeof value === "string";
  if (type === "curve") return typeof value === "string" || value == null;
  if (type === "file") return typeof value === "string";
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function evaluateSettingsAgainstDefinition(settings = {}, definition = {}) {
  const warnings = [];
  const params = asObject(definition.paramIndex);
  for (const [key, value] of Object.entries(asObject(settings))) {
    const param = params[key];
    if (!param) {
      warnings.push(`Unknown settings key for effect ${definition.effectName}: ${key}`);
      continue;
    }
    if (!checkParamValueType(param, value)) {
      warnings.push(`Type mismatch for ${definition.effectName}.${key} (expected ${param.type})`);
      continue;
    }
    if (param.type === "enum" && Array.isArray(param.enumValues) && param.enumValues.length) {
      if (!param.enumValues.includes(String(value))) {
        warnings.push(`Enum value out of range for ${definition.effectName}.${key}: ${String(value)}`);
      }
    }
    if (param.type === "int" && Number.isFinite(Number(value))) {
      const n = Number(value);
      if (Number.isFinite(Number(param.min)) && n < Number(param.min)) {
        warnings.push(`Value below min for ${definition.effectName}.${key}: ${n} < ${param.min}`);
      }
      if (Number.isFinite(Number(param.max)) && n > Number(param.max)) {
        warnings.push(`Value above max for ${definition.effectName}.${key}: ${n} > ${param.max}`);
      }
    }
  }
  return warnings;
}

export function evaluateEffectCommandCompatibility({ commands = [], effectCatalog = null } = {}) {
  const rows = Array.isArray(commands) ? commands : [];
  const catalog = isPlainObject(effectCatalog) ? effectCatalog : null;
  const catalogByName = isPlainObject(catalog?.byName) ? catalog.byName : {};
  const loaded = Boolean(catalog?.loaded);

  if (!loaded) {
    return {
      ok: true,
      skipped: true,
      checkedCount: 0,
      errors: [],
      warnings: []
    };
  }

  const errors = [];
  const warnings = [];
  let checkedCount = 0;

  for (const row of rows) {
    const cmd = normText(row?.cmd);
    if (!isEffectMutationCommand(cmd)) continue;
    checkedCount += 1;
    const params = asObject(row?.params);

    if (cmd === "effects.create" || (cmd === "effects.update" && normText(params.effectName))) {
      const effectName = normText(params.effectName);
      if (!effectName) {
        errors.push(`${cmd}: effectName is required`);
        continue;
      }
      const def = catalogByName[effectName];
      if (!def) {
        errors.push(`${cmd}: unknown effectName '${effectName}'`);
        continue;
      }
      const settings = params.settings;
      if (isPlainObject(settings)) {
        warnings.push(...evaluateSettingsAgainstDefinition(settings, def));
      }
    }
  }

  return {
    ok: errors.length === 0,
    skipped: false,
    checkedCount,
    errors,
    warnings
  };
}
