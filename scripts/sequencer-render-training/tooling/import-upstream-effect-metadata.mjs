import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function slug(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeKey(value = "") {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function stable(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => stable(entry));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort((a, b) => a.localeCompare(b))
        .map((key) => [key, stable(value[key])])
    );
  }
  return value;
}

const EFFECT_ALIASES = new Map([
  ["on", "On"],
  ["singlestrand", "SingleStrand"],
  ["shimmer", "Shimmer"],
  ["bars", "Bars"],
  ["spirals", "Spirals"],
  ["marquee", "Marquee"],
  ["pinwheel", "Pinwheel"],
  ["shockwave", "Shockwave"],
  ["twinkle", "Twinkle"],
  ["colorwash", "Color Wash"]
]);

const PARAMETER_ALIASES = {
  On: {
    startLevel: ["Eff_On_Start"],
    endLevel: ["Eff_On_End"],
    cycles: ["On_Cycles"],
    shimmer: ["On_Shimmer"]
  },
  SingleStrand: {
    mode: ["SingleStrand_Colors", "SingleStrand_FX"],
    numberChases: ["Number_Chases"],
    chaseSize: ["Color_Mix1"],
    cycles: ["Chase_Rotations"],
    skipSize: ["Skips_SkipSize"],
    bandSize: ["Skips_BandSize"],
    advances: ["Skips_Advance"],
    intensity: ["FX_Intensity"],
    chaseType: ["Chase_Type1"],
    fadeType: ["Fade_Type"]
  },
  Shimmer: {
    dutyFactor: ["Shimmer_Duty_Factor"],
    cycles: ["Shimmer_Cycles"],
    useAllColors: ["Shimmer_Use_All_Colors"]
  },
  Bars: {
    barCount: ["Bars_BarCount"],
    cycles: ["Bars_Cycles"],
    direction: ["Bars_Direction"],
    highlight: ["Bars_Highlight"],
    "3D": ["Bars_3D"],
    gradient: ["Bars_Gradient"]
  },
  Spirals: {
    count: ["Spirals_Count"],
    rotation: ["Spirals_Rotation"],
    thickness: ["Spirals_Thickness"],
    movement: ["Spirals_Movement"],
    blend: ["Spirals_Blend"],
    "3D": ["Spirals_3D"],
    grow: ["Spirals_Grow"],
    shrink: ["Spirals_Shrink"]
  },
  Marquee: {
    bandSize: ["Marquee_Band_Size"],
    skipSize: ["Marquee_Skip_Size"],
    thickness: ["Marquee_Thickness"],
    stagger: ["Marquee_Stagger"],
    speed: ["Marquee_Speed"],
    reverse: ["Marquee_Reverse"]
  },
  Pinwheel: {
    arms: ["Pinwheel_Arms"],
    armSize: ["Pinwheel_ArmSize"],
    twist: ["Pinwheel_Twist"],
    thickness: ["Pinwheel_Thickness"],
    speed: ["Pinwheel_Speed"],
    style: ["Pinwheel_Style"],
    rotation: ["Pinwheel_Rotation"],
    "3DMode": ["Pinwheel_3D"]
  },
  Shockwave: {
    centerX: ["Shockwave_CenterX"],
    centerY: ["Shockwave_CenterY"],
    startRadius: ["Shockwave_Start_Radius"],
    endRadius: ["Shockwave_End_Radius"],
    startWidth: ["Shockwave_Start_Width"],
    endWidth: ["Shockwave_End_Width"],
    accel: ["Shockwave_Accel"],
    cycles: ["Shockwave_Cycles"],
    blendEdges: ["Shockwave_Blend_Edges"],
    scale: ["Shockwave_Scale"]
  },
  Twinkle: {
    count: ["Twinkle_Count"],
    steps: ["Twinkle_Steps"],
    style: ["Twinkle_Style"],
    strobe: ["Twinkle_Strobe"],
    reRandomize: ["Twinkle_ReRandom"]
  },
  "Color Wash": {
    cycles: ["ColorWash_Cycles"],
    vFade: ["ColorWash_VFade"],
    hFade: ["ColorWash_HFade"],
    reverseFades: ["ColorWash_ReverseFades"],
    shimmer: ["ColorWash_Shimmer"],
    circularPalette: ["ColorWash_CircularPalette"]
  },
  Butterfly: {
    colors: ["Butterfly_Colors"],
    style: ["Butterfly_Style"],
    chunks: ["Butterfly_Chunks"],
    skip: ["Butterfly_Skip"],
    speed: ["Butterfly_Speed"],
    direction: ["Butterfly_Direction"]
  },
  Circles: {
    count: ["Circles_Count"],
    size: ["Circles_Size"],
    speed: ["Circles_Speed"],
    bounce: ["Circles_Bounce"],
    radial: ["Circles_Radial"],
    plasma: ["Circles_Plasma"],
    radial3D: ["Circles_Radial_3D"],
    bubbles: ["Circles_Bubbles"],
    linearFade: ["Circles_Linear_Fade"],
    xCenter: ["Circles_XC"],
    yCenter: ["Circles_YC"]
  },
  Fire: {
    height: ["Fire_Height"],
    hueShift: ["Fire_HueShift"],
    growthCycles: ["Fire_GrowthCycles"],
    growWithMusic: ["Fire_GrowWithMusic"],
    location: ["Fire_Location"]
  },
  Fireworks: {
    explosions: ["Fireworks_Explosions"],
    count: ["Fireworks_Count"],
    velocity: ["Fireworks_Velocity"],
    xVelocity: ["Fireworks_XVelocity"],
    yVelocity: ["Fireworks_YVelocity"],
    xLocation: ["Fireworks_XLocation"],
    yLocation: ["Fireworks_YLocation"],
    holdColour: ["Fireworks_HoldColour"],
    gravity: ["Fireworks_Gravity"],
    fade: ["Fireworks_Fade"],
    useMusic: ["Fireworks_UseMusic"],
    sensitivity: ["Fireworks_Sensitivity"],
    fireTiming: ["FIRETIMING"],
    fireTimingTrack: ["FIRETIMINGTRACK"]
  },
  Lightning: {
    numberBolts: ["Number_Bolts"],
    numberSegments: ["Number_Segments"],
    forked: ["ForkedLightning"],
    topX: ["Lightning_TopX"],
    topY: ["Lightning_TopY"],
    bottomX: ["Lightning_BOTX"],
    width: ["Lightning_WIDTH"],
    direction: ["Lightning_Direction"]
  },
  Snowflakes: {
    count: ["Snowflakes_Count"],
    type: ["Snowflakes_Type"],
    speed: ["Snowflakes_Speed"],
    falling: ["Falling"],
    warmupFrames: ["Snowflakes_WarmupFrames"]
  },
  Strobe: {
    numberStrobes: ["Number_Strobes"],
    duration: ["Strobe_Duration"],
    type: ["Strobe_Type"],
    music: ["Strobe_Music"]
  },
  Wave: {
    type: ["Wave_Type"],
    fillColors: ["Fill_Colors"],
    mirrorWave: ["Mirror_Wave"],
    numberWaves: ["Number_Waves"],
    thickness: ["Thickness_Percentage"],
    waveHeight: ["Wave_Height"],
    waveSpeed: ["Wave_Speed"],
    direction: ["Wave_Direction"],
    yOffset: ["Wave_YOffset"]
  }
};

const SYNTHETIC_EFFECT_REGISTRY = {
  Butterfly: {
    complexityClass: "complex",
    earlySamplingPolicy: "broad_geometry_first",
    notes: "Expansion-wave motion texture effect. Style, chunking, palette source, and direction are first-order levers; skip acts as a secondary texture control.",
    parameters: {
      colors: { type: "enum", anchors: ["Rainbow", "Palette"], importance: "high", phase: "baseline", practicalPriority: "high", stopRule: "all_meaningful_options", interactionHypotheses: ["style", "direction"] },
      style: { type: "numeric", range: { min: 1, max: 10 }, anchors: [1, 3, 5, 8, 10], importance: "high", phase: "screen", practicalPriority: "high", stopRule: "stop_when_regions_stabilize", interactionHypotheses: ["colors", "speed", "geometryProfile"] },
      chunks: { type: "numeric", range: { min: 1, max: 10 }, anchors: [1, 3, 6, 10], importance: "medium", phase: "screen", practicalPriority: "medium", stopRule: "refine_only_near_breakpoints", interactionHypotheses: ["skip", "style"] },
      speed: { type: "numeric", range: { min: 0, max: 100 }, anchors: [0, 10, 35, 70, 100], importance: "high", phase: "screen", practicalPriority: "high", stopRule: "stop_when_regions_stabilize", interactionHypotheses: ["direction", "style", "geometryProfile"] },
      direction: { type: "enum", anchors: ["Normal", "Reverse"], importance: "medium", phase: "baseline", practicalPriority: "medium", stopRule: "all_meaningful_options", interactionHypotheses: ["speed", "style"] }
    }
  },
  Circles: {
    complexityClass: "complex",
    earlySamplingPolicy: "broad_geometry_first",
    notes: "Expansion-wave particle motion effect. Count, size, speed, and radial/plasma modes are first-order controls; spatial offsets are deferred.",
    parameters: {
      count: { type: "numeric", range: { min: 1, max: 10 }, anchors: [1, 3, 5, 8, 10], importance: "high", phase: "screen", practicalPriority: "high", stopRule: "stop_when_regions_stabilize", interactionHypotheses: ["size", "speed", "geometryProfile"] },
      size: { type: "numeric", range: { min: 1, max: 20 }, anchors: [2, 5, 10, 15, 20], importance: "high", phase: "screen", practicalPriority: "high", stopRule: "refine_only_near_breakpoints", interactionHypotheses: ["count", "radial"] },
      speed: { type: "numeric", range: { min: 1, max: 30 }, anchors: [1, 5, 10, 20, 30], importance: "high", phase: "screen", practicalPriority: "high", stopRule: "stop_when_regions_stabilize", interactionHypotheses: ["bounce", "geometryProfile"] },
      bounce: { type: "boolean", anchors: [false, true], importance: "medium", phase: "baseline", practicalPriority: "medium", stopRule: "all_meaningful_options", interactionHypotheses: ["speed"] },
      radial: { type: "boolean", anchors: [false, true], importance: "medium", phase: "baseline", practicalPriority: "medium", stopRule: "all_meaningful_options", interactionHypotheses: ["count", "size", "geometryProfile"] }
    }
  },
  Fire: {
    complexityClass: "complex",
    earlySamplingPolicy: "broad_geometry_first",
    notes: "Expansion-wave organic texture effect. Height, growth, hue shift, and location are first-order levers. Music-coupled growth is deferred for the first sweep.",
    parameters: {
      height: { type: "numeric", range: { min: 1, max: 100 }, anchors: [10, 30, 50, 70, 100], importance: "high", phase: "screen", practicalPriority: "high", stopRule: "stop_when_regions_stabilize", interactionHypotheses: ["growthCycles", "location", "geometryProfile"] },
      hueShift: { type: "numeric", range: { min: 0, max: 100 }, anchors: [0, 25, 50, 75, 100], importance: "medium", phase: "screen", practicalPriority: "medium", stopRule: "all_meaningful_options", interactionHypotheses: ["height"] },
      growthCycles: { type: "numeric", range: { min: 0, max: 20 }, anchors: [0, 2, 5, 10, 20], importance: "high", phase: "screen", practicalPriority: "high", stopRule: "refine_only_near_breakpoints", interactionHypotheses: ["height", "location"] },
      location: { type: "enum", anchors: ["Bottom", "Top", "Left", "Right"], importance: "high", phase: "baseline", practicalPriority: "high", stopRule: "all_meaningful_options", interactionHypotheses: ["height", "geometryProfile"] }
    }
  },
  Fireworks: {
    complexityClass: "complex",
    earlySamplingPolicy: "broad_geometry_first",
    notes: "Expansion-wave particle burst effect. Explosion cadence, particle count, velocity, fade, and launch placement are the primary levers. Music/timing modes are deferred.",
    parameters: {
      explosions: { type: "numeric", range: { min: 1, max: 50 }, anchors: [1, 8, 16, 32, 50], importance: "high", phase: "screen", practicalPriority: "high", stopRule: "stop_when_regions_stabilize", interactionHypotheses: ["count", "velocity", "geometryProfile"] },
      count: { type: "numeric", range: { min: 1, max: 100 }, anchors: [10, 30, 50, 75, 100], importance: "high", phase: "screen", practicalPriority: "high", stopRule: "refine_only_near_breakpoints", interactionHypotheses: ["explosions", "fade"] },
      velocity: { type: "numeric", range: { min: 1, max: 10 }, anchors: [1, 2, 4, 7, 10], importance: "high", phase: "screen", practicalPriority: "high", stopRule: "stop_when_regions_stabilize", interactionHypotheses: ["fade", "gravity"] },
      fade: { type: "numeric", range: { min: 1, max: 100 }, anchors: [10, 30, 50, 75, 100], importance: "medium", phase: "screen", practicalPriority: "medium", stopRule: "refine_only_near_breakpoints", interactionHypotheses: ["velocity", "count"] },
      gravity: { type: "boolean", anchors: [false, true], importance: "medium", phase: "baseline", practicalPriority: "medium", stopRule: "all_meaningful_options", interactionHypotheses: ["velocity"] },
      xLocation: { type: "numeric", range: { min: -1, max: 100 }, anchors: [-1, 25, 50, 75], importance: "medium", phase: "screen", practicalPriority: "medium", stopRule: "all_meaningful_options", interactionHypotheses: ["yLocation", "geometryProfile"] }
    }
  },
  Lightning: {
    complexityClass: "complex",
    earlySamplingPolicy: "broad_geometry_first",
    notes: "Expansion-wave directional strike effect. Bolt count, segmentation, branching, width, and direction are first-order levers; strike origin offsets are secondary.",
    parameters: {
      numberBolts: { type: "numeric", range: { min: 1, max: 50 }, anchors: [1, 5, 10, 25, 50], importance: "high", phase: "screen", practicalPriority: "high", stopRule: "stop_when_regions_stabilize", interactionHypotheses: ["forked", "width"] },
      numberSegments: { type: "numeric", range: { min: 1, max: 20 }, anchors: [1, 5, 10, 15, 20], importance: "high", phase: "screen", practicalPriority: "high", stopRule: "refine_only_near_breakpoints", interactionHypotheses: ["forked", "geometryProfile"] },
      forked: { type: "boolean", anchors: [false, true], importance: "high", phase: "baseline", practicalPriority: "high", stopRule: "all_meaningful_options", interactionHypotheses: ["numberBolts", "numberSegments"] },
      width: { type: "numeric", range: { min: 1, max: 7 }, anchors: [1, 2, 4, 7], importance: "medium", phase: "screen", practicalPriority: "medium", stopRule: "all_meaningful_options", interactionHypotheses: ["forked"] },
      direction: { type: "enum", anchors: ["Up", "Down"], importance: "medium", phase: "baseline", practicalPriority: "medium", stopRule: "all_meaningful_options", interactionHypotheses: ["topY", "geometryProfile"] }
    }
  },
  Snowflakes: {
    complexityClass: "moderate",
    earlySamplingPolicy: "broad_geometry_first",
    notes: "Expansion-wave particle texture effect. Count, type, speed, and falling mode are the main levers; warmup is secondary.",
    parameters: {
      count: { type: "numeric", range: { min: 1, max: 100 }, anchors: [1, 5, 15, 40, 100], importance: "high", phase: "screen", practicalPriority: "high", stopRule: "stop_when_regions_stabilize", interactionHypotheses: ["type", "speed", "geometryProfile"] },
      type: { type: "numeric", range: { min: 0, max: 9 }, anchors: [0, 1, 3, 6, 9], importance: "high", phase: "screen", practicalPriority: "high", stopRule: "all_meaningful_options", interactionHypotheses: ["count", "falling"] },
      speed: { type: "numeric", range: { min: 0, max: 50 }, anchors: [0, 5, 10, 25, 50], importance: "high", phase: "screen", practicalPriority: "high", stopRule: "stop_when_regions_stabilize", interactionHypotheses: ["falling"] },
      falling: { type: "enum", anchors: ["Driving", "Falling", "Falling & Accumulating"], importance: "medium", phase: "baseline", practicalPriority: "medium", stopRule: "all_meaningful_options", interactionHypotheses: ["speed", "type"] }
    }
  },
  Strobe: {
    complexityClass: "moderate",
    earlySamplingPolicy: "broad_geometry_first",
    notes: "Expansion-wave cadence effect. Strobe count, duration, and type are the primary levers. Music mode is deferred for the first sweep.",
    parameters: {
      numberStrobes: { type: "numeric", range: { min: 1, max: 300 }, anchors: [1, 3, 10, 50, 150], importance: "high", phase: "screen", practicalPriority: "high", stopRule: "stop_when_regions_stabilize", interactionHypotheses: ["duration", "type"] },
      duration: { type: "numeric", range: { min: 1, max: 100 }, anchors: [1, 5, 10, 25, 50], importance: "high", phase: "screen", practicalPriority: "high", stopRule: "refine_only_near_breakpoints", interactionHypotheses: ["numberStrobes", "type"] },
      type: { type: "numeric", range: { min: 1, max: 4 }, anchors: [1, 2, 3, 4], importance: "high", phase: "baseline", practicalPriority: "high", stopRule: "all_meaningful_options", interactionHypotheses: ["duration"] }
    }
  },
  Wave: {
    complexityClass: "complex",
    earlySamplingPolicy: "broad_geometry_first",
    notes: "Expansion-wave motion texture effect. Wave type, count, speed, amplitude, fill, and direction are the first-order levers; mirroring and offsets are secondary.",
    parameters: {
      type: { type: "enum", anchors: ["Sine", "Triangle", "Square", "Decaying Sine", "Fractal/ivy"], importance: "high", phase: "baseline", practicalPriority: "high", stopRule: "all_meaningful_options", interactionHypotheses: ["numberWaves", "fillColors"] },
      fillColors: { type: "enum", anchors: ["None", "Rainbow", "Palette"], importance: "medium", phase: "baseline", practicalPriority: "medium", stopRule: "all_meaningful_options", interactionHypotheses: ["type"] },
      numberWaves: { type: "numeric", range: { min: 0.5, max: 10 }, anchors: [0.5, 1.0, 2.5, 5.0, 10.0], importance: "high", phase: "screen", practicalPriority: "high", stopRule: "stop_when_regions_stabilize", interactionHypotheses: ["waveSpeed", "direction", "geometryProfile"] },
      waveSpeed: { type: "numeric", range: { min: 0, max: 50 }, anchors: [0, 5, 10, 25, 50], importance: "high", phase: "screen", practicalPriority: "high", stopRule: "stop_when_regions_stabilize", interactionHypotheses: ["numberWaves", "direction"] },
      waveHeight: { type: "numeric", range: { min: 0, max: 100 }, anchors: [0, 25, 50, 75, 100], importance: "medium", phase: "screen", practicalPriority: "medium", stopRule: "refine_only_near_breakpoints", interactionHypotheses: ["thickness", "type"] },
      direction: { type: "enum", anchors: ["Right to Left", "Left to Right"], importance: "medium", phase: "baseline", practicalPriority: "medium", stopRule: "all_meaningful_options", interactionHypotheses: ["numberWaves", "waveSpeed"] }
    }
  }
};

function summarizeProperty(property = {}) {
  return {
    id: property.id || null,
    label: property.label || null,
    description: property.description || property.tooltip || null,
    type: property.type || null,
    controlType: property.controlType || null,
    default: property.default,
    min: property.min ?? null,
    max: property.max ?? null,
    divisor: property.divisor ?? 1,
    valueCurve: Boolean(property.valueCurve),
    vcMin: property.vcMin ?? null,
    vcMax: property.vcMax ?? null,
    lockable: Boolean(property.lockable),
    options: Array.isArray(property.options) ? property.options : [],
    dynamicOptions: property.dynamicOptions || null,
    separator: Boolean(property.separator),
    suppressIfDefault: Boolean(property.suppressIfDefault),
    settingPrefix: property.settingPrefix || null,
    fileFilter: property.fileFilter || null,
    fileMessage: property.fileMessage || null
  };
}

function collectFiles(dir) {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort((a, b) => a.localeCompare(b));
}

const outputDir = process.argv[2]
  ? resolve(process.argv[2])
  : resolve("scripts/sequencer-render-training/catalog/upstream-effectmetadata");
const sourceDir = process.argv[3]
  ? resolve(process.argv[3])
  : resolve("/Users/robterry/xLights-2026.06/resources/effectmetadata");
const registryPath = process.argv[4]
  ? resolve(process.argv[4])
  : resolve("scripts/sequencer-render-training/catalog/effect-parameter-registry.json");
const xlightsVersion = process.argv[5] || "2026.06";

mkdirSync(outputDir, { recursive: true });

const registry = loadJson(registryPath);
const mergedRegistryEffects = {
  ...(registry.effects || {}),
  ...SYNTHETIC_EFFECT_REGISTRY
};
const sharedDir = join(sourceDir, "shared");
const schemaPath = join(sourceDir, "_schema.json");

const schema = loadJson(schemaPath);
const effectFiles = collectFiles(sourceDir).filter((name) => name !== "_schema.json");
const sharedFiles = collectFiles(sharedDir);

const effects = [];
const fileFingerprints = [];
for (const fileName of effectFiles) {
  const path = join(sourceDir, fileName);
  const rawText = readFileSync(path, "utf8");
  const raw = JSON.parse(rawText);
  fileFingerprints.push({
    kind: "effect",
    fileName,
    sha256: sha256(rawText)
  });
  effects.push({
    effectName: raw.effectName,
    sourceFile: fileName,
    sourcePath: path,
    jsonSha256: sha256(rawText),
    canvasMode: Boolean(raw.canvasMode),
    propertyCount: Array.isArray(raw.properties) ? raw.properties.length : 0,
    groupCount: Array.isArray(raw.groups) ? raw.groups.length : 0,
    visibilityRuleCount: Array.isArray(raw.visibilityRules) ? raw.visibilityRules.length : 0,
    properties: (Array.isArray(raw.properties) ? raw.properties : []).map((property) => summarizeProperty(property)),
    groups: Array.isArray(raw.groups) ? raw.groups : [],
    visibilityRules: Array.isArray(raw.visibilityRules) ? raw.visibilityRules : []
  });
}

const shared = {};
for (const fileName of sharedFiles) {
  const path = join(sharedDir, fileName);
  const rawText = readFileSync(path, "utf8");
  const raw = JSON.parse(rawText);
  fileFingerprints.push({
    kind: "shared",
    fileName: `shared/${fileName}`,
    sha256: sha256(rawText)
  });
  shared[basename(fileName, ".json")] = {
    sourceFile: fileName,
    jsonSha256: sha256(rawText),
    propertyCount: Array.isArray(raw.properties) ? raw.properties.length : 0,
    properties: (Array.isArray(raw.properties) ? raw.properties : []).map((property) => summarizeProperty(property)),
    groups: Array.isArray(raw.groups) ? raw.groups : [],
    visibilityRules: Array.isArray(raw.visibilityRules) ? raw.visibilityRules : []
  };
}

const normalizedBundle = {
  artifactType: "xlights_effect_metadata_bundle_v1",
  artifactVersion: "1.0",
  generatedAt: new Date().toISOString(),
  source: {
    xlightsVersion,
    sourceDir,
    schemaPath,
    schemaSha256: sha256(readFileSync(schemaPath, "utf8"))
  },
  schema,
  effectCount: effects.length,
  sharedCount: Object.keys(shared).length,
  effects: effects.sort((a, b) => a.effectName.localeCompare(b.effectName)),
  shared
};

const effectiveRegistry = {
  ...registry,
  version: registry.version || "1.0",
  metadataSource: {
    type: "xlights_effectmetadata_overlay",
    xlightsVersion,
    generatedAt: normalizedBundle.generatedAt,
    bundlePath: join(outputDir, `xlights-effectmetadata-bundle-${xlightsVersion}.json`)
  },
  effects: {}
};

const fingerprint = {
  artifactType: "xlights_effect_metadata_fingerprint_v1",
  artifactVersion: "1.0",
  generatedAt: new Date().toISOString(),
  xlightsVersion,
  sourceDir,
  schemaSha256: normalizedBundle.source.schemaSha256,
  effectCount: effects.length,
  sharedCount: Object.keys(shared).length,
  fileFingerprints: fileFingerprints.sort((a, b) => a.fileName.localeCompare(b.fileName)),
  bundleSha256: sha256(JSON.stringify(stable(normalizedBundle)))
};

const upstreamEffectsByLocalName = new Map();
for (const effect of effects) {
  const normalized = normalizeKey(effect.effectName);
  const localName = EFFECT_ALIASES.get(normalized) || effect.effectName;
  upstreamEffectsByLocalName.set(localName, effect);
}

const diff = {
  artifactType: "xlights_effect_metadata_diff_v1",
  artifactVersion: "1.0",
  generatedAt: new Date().toISOString(),
  xlightsVersion,
  sourceDir,
  registryPath,
  localRegistryEffectCount: Object.keys(mergedRegistryEffects).length,
  upstreamEffectCount: effects.length,
  overlapEffects: [],
  registryOnlyEffects: [],
  upstreamOnlyEffects: [],
  breakingChanges: [],
  warnings: []
};

const localEffectNames = Object.keys(mergedRegistryEffects).sort((a, b) => a.localeCompare(b));
const upstreamEffectNames = new Set(effects.map((effect) => effect.effectName));

for (const effectName of localEffectNames) {
  const localEffect = mergedRegistryEffects[effectName] || {};
  const upstreamEffect = upstreamEffectsByLocalName.get(effectName) || null;
  if (!upstreamEffect) {
    effectiveRegistry.effects[effectName] = localEffect;
    diff.registryOnlyEffects.push(effectName);
    diff.warnings.push({
      type: "registry_only_effect",
      effectName,
      message: `Local registry effect '${effectName}' has no upstream effectmetadata match`
    });
    continue;
  }

  const localParams = localEffect.parameters || {};
  const upstreamById = new Map((upstreamEffect.properties || []).map((property) => [property.id, property]));
  const aliases = PARAMETER_ALIASES[effectName] || {};
  const parameterRows = [];
  const mergedParams = {};

  for (const parameterName of Object.keys(localParams).sort((a, b) => a.localeCompare(b))) {
    const aliasIds = aliases[parameterName] || [];
    const matched = aliasIds.map((id) => upstreamById.get(id)).find(Boolean) || null;
    const localParam = localParams[parameterName];
    const row = {
      localParameter: parameterName,
      upstreamId: matched?.id || null,
      upstreamLabel: matched?.label || null,
      matched: Boolean(matched),
      localType: localParam.type || null,
      upstreamType: matched?.type || null,
      localRange: localParam.range || null,
      upstreamRange: matched ? { min: matched.min, max: matched.max } : null,
      localAnchors: Array.isArray(localParam.anchors) ? localParam.anchors : [],
      upstreamDefault: matched?.default,
      localAppliesWhen: localParam.appliesWhen || null,
      upstreamVisibilityRuleCount: Array.isArray(upstreamEffect.visibilityRules) ? upstreamEffect.visibilityRules.length : 0
    };
    parameterRows.push(row);

    if (!matched) {
      diff.breakingChanges.push({
        type: "missing_upstream_parameter_mapping",
        effectName,
        localParameter: parameterName,
        expectedUpstreamIds: aliasIds
      });
    }
    mergedParams[parameterName] = {
      ...localParam,
      upstream: matched
        ? {
            id: matched.id,
            label: matched.label,
            description: matched.description || null,
            type: matched.type,
            controlType: matched.controlType,
            default: matched.default,
            min: matched.min ?? null,
            max: matched.max ?? null,
            divisor: matched.divisor ?? 1,
            valueCurve: Boolean(matched.valueCurve),
            vcMin: matched.vcMin ?? null,
            vcMax: matched.vcMax ?? null,
            lockable: Boolean(matched.lockable),
            options: Array.isArray(matched.options) ? matched.options : [],
            dynamicOptions: matched.dynamicOptions || null,
            suppressIfDefault: Boolean(matched.suppressIfDefault)
          }
        : null
    };
  }

  const mappedUpstreamIds = new Set(Object.values(aliases).flat());
  const unmappedUpstreamProperties = (upstreamEffect.properties || [])
    .filter((property) => !mappedUpstreamIds.has(property.id))
    .map((property) => ({
      id: property.id,
      label: property.label
    }));

  diff.overlapEffects.push({
    effectName,
    localParameterCount: Object.keys(localParams).length,
    upstreamPropertyCount: upstreamEffect.properties.length,
    upstreamVisibilityRuleCount: upstreamEffect.visibilityRuleCount,
    matchedParameterCount: parameterRows.filter((row) => row.matched).length,
    missingParameterCount: parameterRows.filter((row) => !row.matched).length,
    parameterMappings: parameterRows,
    unmappedUpstreamProperties
  });
  effectiveRegistry.effects[effectName] = {
    ...localEffect,
    upstreamEffectName: upstreamEffect.effectName,
    upstreamSourceFile: upstreamEffect.sourceFile,
    upstreamPropertyCount: upstreamEffect.propertyCount,
    upstreamVisibilityRuleCount: upstreamEffect.visibilityRuleCount,
    upstreamSharedMetadata: ["Buffer", "Color", "Timing"],
    parameters: mergedParams,
    upstreamUnmappedProperties: unmappedUpstreamProperties
  };
}

for (const effect of effects) {
  const localName = EFFECT_ALIASES.get(normalizeKey(effect.effectName)) || effect.effectName;
  if (!mergedRegistryEffects[localName]) {
    diff.upstreamOnlyEffects.push(effect.effectName);
  }
}

diff.ok = diff.breakingChanges.length === 0;

const bundlePath = join(outputDir, `xlights-effectmetadata-bundle-${xlightsVersion}.json`);
const fingerprintPath = join(outputDir, `xlights-effectmetadata-fingerprint-${xlightsVersion}.json`);
const diffPath = join(outputDir, `xlights-effectmetadata-diff-${xlightsVersion}.json`);
const mdPath = join(outputDir, `xlights-effectmetadata-diff-${xlightsVersion}.md`);
const effectiveRegistryVersionedPath = join(outputDir, `effective-effect-parameter-registry-${xlightsVersion}.json`);
const effectiveRegistryCanonicalPath = resolve("scripts/sequencer-render-training/catalog/effective-effect-parameter-registry.json");

writeFileSync(bundlePath, `${JSON.stringify(normalizedBundle, null, 2)}\n`, "utf8");
writeFileSync(fingerprintPath, `${JSON.stringify(fingerprint, null, 2)}\n`, "utf8");
writeFileSync(diffPath, `${JSON.stringify(diff, null, 2)}\n`, "utf8");
writeFileSync(effectiveRegistryVersionedPath, `${JSON.stringify(effectiveRegistry, null, 2)}\n`, "utf8");
writeFileSync(effectiveRegistryCanonicalPath, `${JSON.stringify(effectiveRegistry, null, 2)}\n`, "utf8");

let md = "# xLights Effect Metadata Import\n\n";
md += `Generated: ${normalizedBundle.generatedAt}\n\n`;
md += `xLights version: \`${xlightsVersion}\`\n`;
md += `Upstream effects: ${effects.length}\n`;
md += `Shared metadata files: ${Object.keys(shared).length}\n`;
md += `Bundle hash: \`${fingerprint.bundleSha256}\`\n\n`;
md += "## Diff Summary\n\n";
md += `- overlap effects: ${diff.overlapEffects.length}\n`;
md += `- local-only effects: ${diff.registryOnlyEffects.length}\n`;
md += `- upstream-only effects: ${diff.upstreamOnlyEffects.length}\n`;
md += `- breaking changes: ${diff.breakingChanges.length}\n\n`;
md += "## Registry-Only Effects\n\n";
md += diff.registryOnlyEffects.length
  ? diff.registryOnlyEffects.map((effectName) => `- ${effectName}\n`).join("")
  : "- none\n";
md += "\n## Upstream-Only Effects\n\n";
md += diff.upstreamOnlyEffects.length
  ? diff.upstreamOnlyEffects.map((effectName) => `- ${effectName}\n`).join("")
  : "- none\n";
md += "\n## Overlap Effects\n\n";
for (const row of diff.overlapEffects) {
  md += `### ${row.effectName}\n\n`;
  md += `- local parameters: ${row.localParameterCount}\n`;
  md += `- upstream properties: ${row.upstreamPropertyCount}\n`;
  md += `- matched parameters: ${row.matchedParameterCount}\n`;
  md += `- missing mappings: ${row.missingParameterCount}\n`;
  if (row.unmappedUpstreamProperties.length) {
    md += `- unmapped upstream properties: ${row.unmappedUpstreamProperties.map((property) => `${property.id} (${property.label})`).join(", ")}\n`;
  }
  md += "\n";
}
md += "## Breaking Changes\n\n";
md += diff.breakingChanges.length
  ? diff.breakingChanges.map((row) => `- ${row.effectName}.${row.localParameter}: expected ${row.expectedUpstreamIds.join(", ") || "no alias configured"}\n`).join("")
  : "- none\n";

writeFileSync(mdPath, md, "utf8");

console.log(JSON.stringify({
  ok: true,
  diffOk: diff.ok,
  bundlePath,
  fingerprintPath,
  diffPath,
  mdPath,
  effectiveRegistryVersionedPath,
  effectiveRegistryCanonicalPath,
  overlapEffectCount: diff.overlapEffects.length,
  breakingChangeCount: diff.breakingChanges.length
}, null, 2));
