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

function isHighRiskGroupRenderPolicy(category = "") {
  const key = normText(category).toLowerCase();
  return key === "overlay" || key === "stack" || key === "single_line" || key === "per_model_strand";
}

const SHARED_EFFECT_SETTINGS = {
  B_CHOICE_BufferStyle: {
    type: "enum",
    enumValues: [
      "Default",
      "Per Preview",
      "Per Model Default",
      "Per Model Per Preview",
      "Per Model Single Line",
      "Single Line",
      "Single Line Model As A Pixel",
      "Horizontal Stack",
      "Horizontal Per Model",
      "Horizontal Per Strand",
      "Horizontal Per Model/Strand",
      "Vertical Stack - Scaled",
      "Overlay - Centered",
      "Overlay - Scaled",
      "Layer Star",
      "Default Model As A Pixel"
    ]
  },
  B_CHOICE_BufferTransform: {
    type: "enum",
    enumValues: [
      "None",
      "Flip Horizontal",
      "Flip Vertical",
      "Rotate 180",
      "Rotate CC 90",
      "Rotate CW 90",
      "Rotate CW 90 Flip Horizontal"
    ]
  },
  B_CHOICE_PerPreviewCamera: {
    type: "enum",
    enumValues: ["2D", "3D"]
  },
  B_CUSTOM_SubBuffer: { type: "string" },
  B_SLIDER_PivotPointX: { type: "int" },
  B_SLIDER_PivotPointY: { type: "int" },
  B_SLIDER_ZoomQuality: { type: "int" },
  B_SLIDER_Rotations: { type: "int" },
  B_SLIDER_Blur: { type: "int" },
  B_SLIDER_XRotation: { type: "int" },
  B_SLIDER_Rotation: { type: "int" },
  B_SLIDER_Zoom: { type: "int" },
  B_VALUECURVE_Rotation: { type: "curve" },
  B_VALUECURVE_XRotation: { type: "curve" },
  B_VALUECURVE_Zoom: { type: "curve" },
  B_VALUECURVE_Blur: { type: "curve" },
  T_CHECKBOX_LayerMorph: { type: "bool" },
  T_CHOICE_LayerMethod: {
    type: "enum",
    enumValues: [
      "Normal",
      "Effect 1",
      "Effect 2",
      "1 is Mask",
      "2 is Mask",
      "1 is Unmask",
      "2 is Unmask",
      "1 is True Unmask",
      "2 is True Unmask",
      "1 reveals 2",
      "2 reveals 1",
      "Shadow 1 on 2",
      "Shadow 2 on 1",
      "Layered",
      "Average",
      "Bottom-Top",
      "Left-Right",
      "Highlight",
      "Highlight Vibrant",
      "Additive",
      "Subtractive",
      "Brightness",
      "Max",
      "Min"
    ]
  },
  T_SLIDER_EffectLayerMix: { type: "int", min: 0, max: 100 },
  T_CHOICE_In_Transition_Type: {
    type: "enum",
    enumValues: [
      "Blend",
      "Blinds",
      "Blobs",
      "Bow Tie",
      "Circle Explode",
      "Circles",
      "Circular Swirl",
      "Clock",
      "Dissolve",
      "Doorway",
      "Fade",
      "Fold",
      "From Middle",
      "Pinwheel",
      "Shatter",
      "Slide Bars",
      "Slide Checks",
      "Square Explode",
      "Star",
      "Swap",
      "Wipe",
      "Zoom"
    ]
  },
  T_CHOICE_Out_Transition_Type: {
    type: "enum",
    enumValues: [
      "Blend",
      "Blinds",
      "Blobs",
      "Bow Tie",
      "Circle Explode",
      "Circles",
      "Circular Swirl",
      "Clock",
      "Dissolve",
      "Doorway",
      "Fade",
      "Fold",
      "From Middle",
      "Pinwheel",
      "Shatter",
      "Slide Bars",
      "Slide Checks",
      "Square Explode",
      "Star",
      "Swap",
      "Wipe",
      "Zoom"
    ]
  },
  T_SLIDER_In_Transition_Adjust: { type: "int", min: 0, max: 100 },
  T_SLIDER_Out_Transition_Adjust: { type: "int", min: 0, max: 100 },
  T_CHECKBOX_In_Transition_Reverse: { type: "bool" },
  T_CHECKBOX_Out_Transition_Reverse: { type: "bool" },
  C_SLIDER_Brightness: { type: "int", min: 0, max: 400 },
  C_SLIDER_Color_HueAdjust: { type: "int", min: -100, max: 100 },
  C_SLIDER_Color_SaturationAdjust: { type: "int", min: -100, max: 100 },
  C_SLIDER_Color_ValueAdjust: { type: "int", min: -100, max: 100 },
  C_SLIDER_Contrast: { type: "int", min: -100, max: 100 }
};

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
    const param = params[key] || SHARED_EFFECT_SETTINGS[key];
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

      const sourceGroupId = normText(params.sourceGroupId);
      const sourceGroupRenderPolicy = normText(params.sourceGroupRenderPolicy).toLowerCase();
      const sourceGroupBufferStyle = normText(params.sourceGroupBufferStyle);
      if (sourceGroupId && sourceGroupRenderPolicy) {
        if (isHighRiskGroupRenderPolicy(sourceGroupRenderPolicy)) {
          warnings.push(
            `Expanded member-level effect from high-risk group render target ${sourceGroupId} (${sourceGroupBufferStyle || sourceGroupRenderPolicy}); xLights group render semantics may differ from member expansion.`
          );
        } else if (sourceGroupRenderPolicy !== "default") {
          warnings.push(
            `Expanded member-level effect from non-default group render target ${sourceGroupId} (${sourceGroupBufferStyle || sourceGroupRenderPolicy}).`
          );
        }
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
