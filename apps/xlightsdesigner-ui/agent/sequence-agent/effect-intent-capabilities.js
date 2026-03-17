function normText(value = "") {
  return String(value || "").trim();
}

const EFFECT_INTENT_CAPABILITIES = {
  "Color Wash": {
    family: "wash",
    supportedSettingsIntent: ["intensity", "speed", "density", "coverage", "motion", "variation"],
    supportedPaletteIntent: ["colors", "temperature", "contrast", "brightness", "saturation", "accentUsage"],
    supportedLayerIntent: ["priority", "blendRole", "mixAmount", "overlayPolicy"],
    supportedRenderIntent: ["groupPolicy", "bufferStyle", "expansionPolicy", "riskTolerance"],
    effectParamPatterns: {
      speed: [/speed/, /velocity/, /rate/],
      density: [/dens/, /count/, /repeat/]
    }
  },
  Shimmer: {
    family: "sparkle",
    supportedSettingsIntent: ["intensity", "speed", "density", "coverage", "motion", "variation"],
    supportedPaletteIntent: ["colors", "temperature", "contrast", "brightness", "saturation", "accentUsage"],
    supportedLayerIntent: ["priority", "blendRole", "mixAmount", "overlayPolicy"],
    supportedRenderIntent: ["groupPolicy", "bufferStyle", "expansionPolicy", "riskTolerance"],
    effectParamPatterns: {
      speed: [/speed/, /velocity/, /rate/],
      density: [/dens/, /count/, /repeat/]
    }
  },
  Bars: {
    family: "rhythmic",
    supportedSettingsIntent: ["intensity", "speed", "density", "coverage", "motion", "direction", "thickness", "variation"],
    supportedPaletteIntent: ["colors", "temperature", "contrast", "brightness", "saturation", "accentUsage"],
    supportedLayerIntent: ["priority", "blendRole", "mixAmount", "overlayPolicy"],
    supportedRenderIntent: ["groupPolicy", "bufferStyle", "expansionPolicy", "riskTolerance"],
    effectParamPatterns: {
      speed: [/speed/, /velocity/, /rate/],
      density: [/dens/, /count/, /repeat/],
      thickness: [/thick/, /width/, /bars/],
      direction: [/dir/, /mode/]
    }
  },
  On: {
    family: "hold",
    supportedSettingsIntent: ["intensity", "coverage", "motion"],
    supportedPaletteIntent: ["colors", "temperature", "contrast", "brightness", "saturation", "accentUsage"],
    supportedLayerIntent: ["priority", "blendRole", "mixAmount", "overlayPolicy"],
    supportedRenderIntent: ["groupPolicy", "bufferStyle", "expansionPolicy", "riskTolerance"],
    effectParamPatterns: {}
  }
};

export function getEffectIntentCapability(effectName = "") {
  return EFFECT_INTENT_CAPABILITIES[normText(effectName)] || null;
}

export function listEffectIntentCapabilities() {
  return Object.entries(EFFECT_INTENT_CAPABILITIES).map(([effectName, row]) => ({
    effectName,
    ...row
  }));
}
