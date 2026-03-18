import { getEffectIntentCapability } from "./effect-intent-capabilities.js";

function normText(value = "") {
  return String(value || "").trim();
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asObject(value) {
  return isPlainObject(value) ? value : {};
}

function normalizeCatalog(effectCatalog = null) {
  return effectCatalog && typeof effectCatalog === "object" && effectCatalog.byName && typeof effectCatalog.byName === "object"
    ? effectCatalog.byName
    : {};
}

function clampInt(value, min, max, fallback = null) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function mapScale(value = "", mapping = {}) {
  const key = normText(value).toLowerCase();
  return Object.prototype.hasOwnProperty.call(mapping, key) ? mapping[key] : null;
}

function normalizeEnumKey(value = "") {
  return normText(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function resolveEnumValue(param = null, desiredValue = "") {
  const desired = normText(desiredValue);
  const enumValues = Array.isArray(param?.enumValues) ? param.enumValues.map((row) => normText(row)).filter(Boolean) : [];
  if (!desired || !enumValues.length) return null;

  const exact = enumValues.find((row) => row.toLowerCase() === desired.toLowerCase());
  if (exact) return exact;

  const normalizedDesired = normalizeEnumKey(desired);
  const normalized = enumValues.find((row) => normalizeEnumKey(row) === normalizedDesired);
  return normalized || null;
}

const COLOR_MAP = {
  "warm gold": "#ffd166",
  amber: "#ffbf69",
  gold: "#ffd700",
  "deep red": "#b22222",
  red: "#ff0000",
  green: "#00ff00",
  blue: "#0000ff",
  "ice blue": "#9fdcff",
  "cool white": "#dff6ff",
  "warm white": "#ffd39b",
  white: "#ffffff",
  orange: "#ff7f00",
  yellow: "#ffff00",
  pink: "#ff4fa3",
  purple: "#8000ff"
};

function colorToHex(value = "") {
  const key = normText(value).toLowerCase();
  return COLOR_MAP[key] || "";
}

function buildPaletteFromIntent(paletteIntent = {}) {
  const out = {};
  const colors = Array.isArray(paletteIntent?.colors) ? paletteIntent.colors.map((row) => colorToHex(row)).filter(Boolean) : [];
  colors.slice(0, 4).forEach((hex, idx) => {
    const index = idx + 1;
    out[`C_BUTTON_Palette${index}`] = hex;
    out[`C_CHECKBOX_Palette${index}`] = "1";
  });
  const brightness = mapScale(paletteIntent?.brightness, {
    low: 70,
    medium: 100,
    medium_high: 125,
    high: 150
  });
  if (brightness != null) out.C_SLIDER_Brightness = brightness;
  const contrast = mapScale(paletteIntent?.contrast, {
    low: -10,
    medium: 0,
    high: 35
  });
  if (contrast != null) out.C_SLIDER_Contrast = contrast;
  const saturation = mapScale(paletteIntent?.saturation, {
    low: -25,
    medium: 0,
    high: 25
  });
  if (saturation != null) out.C_SLIDER_Color_SaturationAdjust = saturation;
  return out;
}

function buildLayerSettingsFromIntent(layerIntent = {}) {
  const out = {};
  const blendRole = normText(layerIntent?.blendRole).toLowerCase();
  const overlayPolicy = normText(layerIntent?.overlayPolicy).toLowerCase();
  const maskPolicy = normText(layerIntent?.maskPolicy).toLowerCase();
  const method =
    blendRole === "accent_overlay" ? "Highlight" :
    blendRole === "rhythmic_overlay" ? "Additive" :
    blendRole === "support_overlay" ? "Average" :
    blendRole === "foundation" ? "Normal" :
    overlayPolicy === "preserve_masks" && maskPolicy === "mask" ? "1 is Mask" :
    overlayPolicy === "preserve_masks" && maskPolicy === "unmask" ? "1 is Unmask" :
    "";
  if (method) out.T_CHOICE_LayerMethod = method;
  const mixAmount = layerIntent?.mixAmount;
  const mix = typeof mixAmount === "number"
    ? clampInt(mixAmount, 0, 100, null)
    : mapScale(mixAmount, {
        subtle: 25,
        low: 35,
        default: 50,
        medium: 60,
        high: 80
      });
  if (mix != null && out.T_CHOICE_LayerMethod && out.T_CHOICE_LayerMethod !== "Normal") {
    out.T_SLIDER_EffectLayerMix = mix;
  }
  return out;
}

function buildRenderSettingsFromIntent(renderIntent = {}) {
  const out = {};
  const bufferStyle = normText(renderIntent?.bufferStyle);
  const normalized = bufferStyle.toLowerCase();
  if (!bufferStyle || normalized === "inherit" || normalized === "default") return out;
  const mapped =
    normalized === "overlay" || normalized === "overlay_scaled" ? "Overlay - Scaled" :
    normalized === "overlay_centered" ? "Overlay - Centered" :
    normalized === "stack" ? "Horizontal Stack" :
    normalized === "single_line" ? "Single Line" :
    normalized === "per_model" ? "Per Model Default" :
    normalized === "per_model_strand" ? "Per Model/Strand" :
    bufferStyle;
  out.B_CHOICE_BufferStyle = mapped;
  return out;
}

function chooseEffectParam(effectDefinition = null, patterns = []) {
  const params = effectDefinition && Array.isArray(effectDefinition.params) ? effectDefinition.params : [];
  const regexes = patterns.map((row) => {
    if (row instanceof RegExp) {
      const flags = row.flags.includes("i") ? row.flags : `${row.flags}i`;
      return new RegExp(row.source, flags);
    }
    return new RegExp(String(row), "i");
  });
  for (const param of params) {
    const name = normText(param?.name);
    if (!name) continue;
    if (regexes.some((re) => re.test(name))) return param;
  }
  return null;
}

function writeEffectSpecificSetting(settings, effectDefinition, value, patterns = [], enumMap = null, intMap = null) {
  const param = chooseEffectParam(effectDefinition, patterns);
  if (!param) return;
  if (param.type === "enum" && enumMap) {
    const mapped = enumMap[normText(value).toLowerCase()];
    const resolved = resolveEnumValue(param, mapped || value);
    if (resolved) settings[param.name] = resolved;
    return;
  }
  if (param.type === "int" && intMap) {
    const mapped = intMap[normText(value).toLowerCase()];
    if (mapped != null) {
      const min = Number.isFinite(Number(param.min)) ? Number(param.min) : Number.MIN_SAFE_INTEGER;
      const max = Number.isFinite(Number(param.max)) ? Number(param.max) : Number.MAX_SAFE_INTEGER;
      settings[param.name] = clampInt(mapped, min, max, mapped);
    }
  }
}

function buildSharedSettingsFromIntent(settingsIntent = {}, effectDefinition = null, capability = null) {
  const out = {};
  const intensity = mapScale(settingsIntent?.intensity, {
    low: 70,
    medium: 100,
    medium_high: 125,
    high: 150
  });
  if (intensity != null) out.C_SLIDER_Brightness = intensity;
  const contrast = mapScale(settingsIntent?.contrast, {
    low: -10,
    medium: 0,
    medium_high: 20,
    high: 35
  });
  if (contrast != null) out.C_SLIDER_Contrast = contrast;
  const motion = normText(settingsIntent?.motion).toLowerCase();
  if (motion === "wash") {
    out.T_CHOICE_In_Transition_Type = "Blend";
    out.T_CHOICE_Out_Transition_Type = "Blend";
  } else if (motion === "sparkle") {
    out.T_CHOICE_In_Transition_Type = "Fade";
    out.T_CHOICE_Out_Transition_Type = "Fade";
  } else if (motion === "rhythmic") {
    out.T_CHOICE_In_Transition_Type = "Slide Bars";
    out.T_CHOICE_Out_Transition_Type = "Slide Bars";
  }
  const patterns = capability?.effectParamPatterns || {};
  writeEffectSpecificSetting(out, effectDefinition, settingsIntent?.speed, patterns.speed || [/speed/, /velocity/, /rate/], null, {
    slow: 2,
    medium: 5,
    medium_fast: 7,
    fast: 9
  });
  writeEffectSpecificSetting(out, effectDefinition, settingsIntent?.density, patterns.density || [/dens/, /count/, /repeat/], null, {
    light: 2,
    medium: 5,
    dense: 8
  });
  writeEffectSpecificSetting(out, effectDefinition, settingsIntent?.thickness, patterns.thickness || [/thick/, /width/, /bars/], null, {
    thin: 20,
    medium: 50,
    thick: 80
  });
  writeEffectSpecificSetting(out, effectDefinition, settingsIntent?.direction, patterns.direction || [/dir/, /mode/], {
    forward: "Forward",
    reverse: "Reverse",
    inward: "Inward",
    outward: "Outward"
  });
  return out;
}

export function translatePlacementIntentToXlights({
  placement = {},
  effectCatalog = null
} = {}) {
  const effectName = normText(placement?.effectName);
  const effectDefinition = normalizeCatalog(effectCatalog)[effectName] || null;
  const capability = getEffectIntentCapability(effectName);
  const translatedSettings = {
    ...buildSharedSettingsFromIntent(asObject(placement?.settingsIntent), effectDefinition, capability),
    ...buildLayerSettingsFromIntent(asObject(placement?.layerIntent)),
    ...buildRenderSettingsFromIntent(asObject(placement?.renderIntent))
  };
  const translatedPalette = buildPaletteFromIntent(asObject(placement?.paletteIntent));
  return {
    settings: {
      ...translatedSettings,
      ...asObject(placement?.settings)
    },
    palette: {
      ...translatedPalette,
      ...asObject(placement?.palette)
    }
  };
}
