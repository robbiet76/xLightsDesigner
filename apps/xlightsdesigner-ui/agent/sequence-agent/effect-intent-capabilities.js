import {
  getStage1TrainedEffectBundle,
  getStage1TrainedEffectProfile
} from "./trained-effect-knowledge.js";

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
  SingleStrand: {
    family: "strand_pattern",
    supportedSettingsIntent: ["intensity", "speed", "density", "coverage", "motion", "direction", "thickness", "variation"],
    supportedPaletteIntent: ["colors", "temperature", "contrast", "brightness", "saturation", "accentUsage"],
    supportedLayerIntent: ["priority", "blendRole", "mixAmount", "overlayPolicy"],
    supportedRenderIntent: ["groupPolicy", "bufferStyle", "expansionPolicy", "riskTolerance"],
    effectParamPatterns: {
      speed: [/speed/, /velocity/, /rate/, /chase/],
      density: [/count/, /repeat/, /skip/, /segments?/, /group/],
      thickness: [/width/, /size/, /thick/, /band/],
      direction: [/direction/, /dir/, /style/, /mirror/, /chase/]
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

function mergeTrainingProfileIntoCapability(effectName = "", baseCapability = null) {
  const trainingProfile = getStage1TrainedEffectProfile(effectName);
  if (!baseCapability && !trainingProfile) return null;
  const capability = baseCapability ? { ...baseCapability } : {
    family: "trained_effect",
    supportedSettingsIntent: [],
    supportedPaletteIntent: [],
    supportedLayerIntent: [],
    supportedRenderIntent: [],
    effectParamPatterns: {}
  };
  if (!trainingProfile) return capability;
  const trainingFamilies = Array.isArray(trainingProfile.patternFamilies) ? trainingProfile.patternFamilies : [];
  capability.training = {
    currentStage: normText(trainingProfile.currentStage),
    equalized: Boolean(trainingProfile.equalized),
    supportedModelTypes: Array.isArray(trainingProfile.supportedModelTypes) ? trainingProfile.supportedModelTypes.slice() : [],
    supportedGeometryProfiles: Array.isArray(trainingProfile.supportedGeometryProfiles) ? trainingProfile.supportedGeometryProfiles.slice() : [],
    intentTags: Array.isArray(trainingProfile.intentTags) ? trainingProfile.intentTags.slice() : [],
    patternFamilies: trainingFamilies.slice(),
    selectorEvidence: trainingProfile.selectorEvidence || {}
  };
  if (!capability.family || capability.family === "trained_effect") {
    capability.family = trainingFamilies[0] || capability.family;
  }
  return capability;
}

export function getEffectIntentCapability(effectName = "") {
  return mergeTrainingProfileIntoCapability(effectName, EFFECT_INTENT_CAPABILITIES[normText(effectName)] || null);
}

export function listEffectIntentCapabilities() {
  const trainingNames = Object.keys(getStage1TrainedEffectBundle()?.effectsByName || {});
  return [...new Set([...Object.keys(EFFECT_INTENT_CAPABILITIES), ...trainingNames])].map((effectName) => ({
    effectName,
    ...getEffectIntentCapability(effectName)
  }));
}
