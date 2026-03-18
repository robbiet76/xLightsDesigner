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
      thickness: [/thick/, /width/, /size/],
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
  },
  Butterfly: {
    family: "motion_texture",
    supportedSettingsIntent: ["intensity", "speed", "density", "coverage", "motion", "direction", "variation"],
    supportedPaletteIntent: ["colors", "temperature", "contrast", "brightness", "saturation", "accentUsage"],
    supportedLayerIntent: ["priority", "blendRole", "mixAmount", "overlayPolicy"],
    supportedRenderIntent: ["groupPolicy", "bufferStyle", "expansionPolicy", "riskTolerance"],
    effectParamPatterns: {
      speed: [/speed/],
      density: [/chunks/, /skip/, /style/],
      direction: [/direction/]
    }
  },
  Circles: {
    family: "particle_motion",
    supportedSettingsIntent: ["intensity", "speed", "density", "coverage", "motion", "variation"],
    supportedPaletteIntent: ["colors", "temperature", "contrast", "brightness", "saturation", "accentUsage"],
    supportedLayerIntent: ["priority", "blendRole", "mixAmount", "overlayPolicy"],
    supportedRenderIntent: ["groupPolicy", "bufferStyle", "expansionPolicy", "riskTolerance"],
    effectParamPatterns: {
      speed: [/speed/],
      density: [/count/, /size/]
    }
  },
  Curtain: {
    family: "transition_motion",
    supportedSettingsIntent: ["intensity", "speed", "coverage", "motion", "direction", "variation"],
    supportedPaletteIntent: ["colors", "temperature", "contrast", "brightness", "saturation", "accentUsage"],
    supportedLayerIntent: ["priority", "blendRole", "mixAmount", "overlayPolicy"],
    supportedRenderIntent: ["groupPolicy", "bufferStyle", "expansionPolicy", "riskTolerance"],
    effectParamPatterns: {
      speed: [/speed/],
      direction: [/edge/, /effect/]
    }
  },
  Fan: {
    family: "radial_motion",
    supportedSettingsIntent: ["intensity", "speed", "density", "coverage", "motion", "direction", "variation"],
    supportedPaletteIntent: ["colors", "temperature", "contrast", "brightness", "saturation", "accentUsage"],
    supportedLayerIntent: ["priority", "blendRole", "mixAmount", "overlayPolicy"],
    supportedRenderIntent: ["groupPolicy", "bufferStyle", "expansionPolicy", "riskTolerance"],
    effectParamPatterns: {
      speed: [/revolutions?/],
      density: [/blades?/, /elements?/],
      direction: [/angle/]
    }
  },
  Fire: {
    family: "organic_texture",
    supportedSettingsIntent: ["intensity", "speed", "coverage", "motion", "variation"],
    supportedPaletteIntent: ["colors", "temperature", "contrast", "brightness", "saturation", "accentUsage"],
    supportedLayerIntent: ["priority", "blendRole", "mixAmount", "overlayPolicy"],
    supportedRenderIntent: ["groupPolicy", "bufferStyle", "expansionPolicy", "riskTolerance"],
    effectParamPatterns: {
      speed: [/growth/, /cycles?/],
      density: [/height/],
      direction: [/location/]
    }
  },
  Morph: {
    family: "path_motion",
    supportedSettingsIntent: ["intensity", "speed", "density", "coverage", "motion", "direction", "thickness", "variation"],
    supportedPaletteIntent: ["colors", "temperature", "contrast", "brightness", "saturation", "accentUsage"],
    supportedLayerIntent: ["priority", "blendRole", "mixAmount", "overlayPolicy"],
    supportedRenderIntent: ["groupPolicy", "bufferStyle", "expansionPolicy", "riskTolerance"],
    effectParamPatterns: {
      speed: [/duration/, /time/, /rate/],
      density: [/length/],
      thickness: [/thick/, /width/],
      direction: [/start_/, /end_/]
    }
  },
  Meteors: {
    family: "particle_motion",
    supportedSettingsIntent: ["intensity", "speed", "density", "coverage", "motion", "direction", "thickness", "variation"],
    supportedPaletteIntent: ["colors", "temperature", "contrast", "brightness", "saturation", "accentUsage"],
    supportedLayerIntent: ["priority", "blendRole", "mixAmount", "overlayPolicy"],
    supportedRenderIntent: ["groupPolicy", "bufferStyle", "expansionPolicy", "riskTolerance"],
    effectParamPatterns: {
      speed: [/speed/],
      density: [/count/],
      thickness: [/length/],
      direction: [/effect/]
    }
  },
  Pinwheel: {
    family: "radial_motion",
    supportedSettingsIntent: ["intensity", "speed", "density", "coverage", "motion", "direction", "thickness", "variation"],
    supportedPaletteIntent: ["colors", "temperature", "contrast", "brightness", "saturation", "accentUsage"],
    supportedLayerIntent: ["priority", "blendRole", "mixAmount", "overlayPolicy"],
    supportedRenderIntent: ["groupPolicy", "bufferStyle", "expansionPolicy", "riskTolerance"],
    effectParamPatterns: {
      speed: [/speed/, /rotation/],
      density: [/arms?/],
      thickness: [/thick/, /armsize/],
      direction: [/style/, /3d/]
    }
  },
  Snowflakes: {
    family: "particle_motion",
    supportedSettingsIntent: ["intensity", "speed", "density", "coverage", "motion", "variation"],
    supportedPaletteIntent: ["colors", "temperature", "contrast", "brightness", "saturation", "accentUsage"],
    supportedLayerIntent: ["priority", "blendRole", "mixAmount", "overlayPolicy"],
    supportedRenderIntent: ["groupPolicy", "bufferStyle", "expansionPolicy", "riskTolerance"],
    effectParamPatterns: {
      speed: [/speed/],
      density: [/count/, /type/],
      direction: [/falling/]
    }
  },
  Spirals: {
    family: "motion_texture",
    supportedSettingsIntent: ["intensity", "speed", "density", "coverage", "motion", "direction", "thickness", "variation"],
    supportedPaletteIntent: ["colors", "temperature", "contrast", "brightness", "saturation", "accentUsage"],
    supportedLayerIntent: ["priority", "blendRole", "mixAmount", "overlayPolicy"],
    supportedRenderIntent: ["groupPolicy", "bufferStyle", "expansionPolicy", "riskTolerance"],
    effectParamPatterns: {
      speed: [/movement/, /rotation/],
      density: [/count/],
      thickness: [/thick/],
      direction: [/grow/, /shrink/]
    }
  },
  "VU Meter": {
    family: "audio_reactive",
    supportedSettingsIntent: ["intensity", "speed", "density", "coverage", "motion", "direction", "variation"],
    supportedPaletteIntent: ["colors", "temperature", "contrast", "brightness", "saturation", "accentUsage"],
    supportedLayerIntent: ["priority", "blendRole", "mixAmount", "overlayPolicy"],
    supportedRenderIntent: ["groupPolicy", "bufferStyle", "expansionPolicy", "riskTolerance"],
    effectParamPatterns: {
      speed: [/gain/, /sensitivity/],
      density: [/bars?/, /note/],
      direction: [/type/, /shape/]
    }
  },
  Wave: {
    family: "motion_texture",
    supportedSettingsIntent: ["intensity", "speed", "density", "coverage", "motion", "direction", "thickness", "variation"],
    supportedPaletteIntent: ["colors", "temperature", "contrast", "brightness", "saturation", "accentUsage"],
    supportedLayerIntent: ["priority", "blendRole", "mixAmount", "overlayPolicy"],
    supportedRenderIntent: ["groupPolicy", "bufferStyle", "expansionPolicy", "riskTolerance"],
    effectParamPatterns: {
      speed: [/speed/, /movement/, /rate/],
      density: [/dens/, /count/, /repeat/],
      thickness: [/thick/, /width/, /size/, /height/],
      direction: [/direction/, /dir/, /mode/]
    }
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
