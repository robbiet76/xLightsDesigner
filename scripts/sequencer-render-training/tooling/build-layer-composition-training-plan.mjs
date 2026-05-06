import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_MODEL_CATALOG = "scripts/sequencer-render-training/catalog/generic-layout-model-catalog.json";
const DEFAULT_OUT = "var/logs/sequencer-layer-composition-training-runs/manual-plan/training-plan.json";
const DEFAULT_RUN_TYPE = "overnight";

export const DEFAULT_PALETTE_PROFILES = ["mono_white", "rgb_primary"];
export const RGB_DISPLAY_AUTO_REFILL_VALIDATION_CYCLE_COUNT = 12;

export const RUNTIME_BUDGETS = {
  smoke: {
    minRuntimeMinutes: 15,
    targetRuntimeMinutes: 30,
    maxRuntimeMinutes: 45,
    purpose: "Validate plan shape, API readiness, render capture, and observation plumbing only."
  },
  focused_evening: {
    minRuntimeMinutes: 120,
    targetRuntimeMinutes: 180,
    maxRuntimeMinutes: 240,
    purpose: "Validate a new experiment family with enough samples to inspect stability."
  },
  overnight: {
    minRuntimeMinutes: 480,
    targetRuntimeMinutes: 540,
    maxRuntimeMinutes: 600,
    purpose: "Normal unattended learning run for meaningful composition evidence."
  },
  extended: {
    minRuntimeMinutes: 600,
    targetRuntimeMinutes: 720,
    maxRuntimeMinutes: 900,
    purpose: "Longer run after overnight stability has already been proven."
  }
};

export const RENDER_SETTING_CANDIDATES = [
  "mixMethod",
  "mixThreshold",
  "canvas",
  "persistentOverlay",
  "brightness",
  "contrast",
  "saturation",
  "hue",
  "value",
  "blur",
  "zoom",
  "rotation",
  "fadeIn",
  "fadeOut",
  "transition"
];

export const VERIFIED_OWNED_LAYER_RENDER_SETTINGS = [
  "mixMethod",
  "mixThreshold",
  "canvas",
  "persistentOverlay",
  "brightness",
  "contrast",
  "saturation",
  "hue",
  "value",
  "blur",
  "zoom",
  "rotation",
  "fadeIn",
  "fadeOut"
];

export const CURRICULUM_STAGES = [
  {
    stageId: "broad_composition_survey",
    priority: 1,
    breadthFirst: true,
    purpose: "Answer broad composition mechanics before spending runtime on narrow detail."
  },
  {
    stageId: "family_contrast_survey",
    priority: 2,
    breadthFirst: true,
    purpose: "Compare learned mechanics across major geometry families."
  },
  {
    stageId: "setting_sensitivity_survey",
    priority: 3,
    breadthFirst: false,
    purpose: "Measure high-impact setting deltas after broad mechanics are covered."
  },
  {
    stageId: "interaction_deepening",
    priority: 4,
    breadthFirst: false,
    purpose: "Deepen only ambiguous, contradictory, or high-value interactions."
  },
  {
    stageId: "sequence_pattern_validation",
    priority: 5,
    breadthFirst: false,
    purpose: "Validate priors inside longer sequence-like plans."
  }
];

export const ADAPTIVE_REFILL_ORDER = [
  "uncovered_broad_composition_coverage",
  "uncovered_geometry_family_contrast",
  "low_confidence_broad_revalidation",
  "contradictory_learning_confirmation",
  "high_impact_render_setting_sensitivity",
  "benchmark_driven_deepening",
  "controlled_repeat_confidence_calibration"
];

export const RUNTIME_SELECTION_TIERS = [
  "primary_setting_attribution",
  "high_value_geometry_retest",
  "broad_layer_composition",
  "group_model_ordering",
  "core_effect_fit",
  "expanded_effect_fit",
  "display_quality_review",
  "music_structure_review",
  "interaction_deepening",
  "deferred_low_yield_retest"
];

export const DEFAULT_RETENTION_POLICY = {
  summarizeAsYouGo: true,
  cleanupMode: "purge_summarized_raw_artifacts",
  checkpoints: [
    "after_rendered_pass",
    "after_delta_pair",
    "after_experiment",
    "before_adaptive_refill",
    "at_run_completion"
  ],
  alwaysKeep: [
    "training_plan",
    "checkpoint",
    "run_summary",
    "composition_stack_observation",
    "layer_delta_observation",
    "order_permutation_observation",
    "render_setting_delta_observation",
    "prior_bundle",
    "failure_summary"
  ],
  compactKeep: [
    "artifact_fingerprint",
    "small_preview",
    "metric_summary",
    "extractor_version",
    "renderer_identity"
  ],
  purgeWhenSummarized: [
    "raw_fseq",
    "full_gif",
    "decoded_frame_dump",
    "temporary_sequence_copy",
    "intermediate_render_export"
  ],
  debugRetention: {
    failedPassRawArtifactPolicy: "keep_until_daytime_review_or_failure_classified",
    smokeRunPolicy: "keep_short_term_for_inspection",
    overnightPolicy: "compact_continuously"
  },
  diskGuardrails: {
    enabled: true,
    preferCleanupBeforeStop: true,
    warningFreeDiskGb: 25,
    stopFreeDiskGb: 10
  }
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function readOptionalJson(filePath) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) return null;
  return readJson(resolved);
}

function str(value = "") {
  return String(value || "").trim();
}

function normalizedToken(value = "") {
  const token = str(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (token === "singlestrand") return "single_strand";
  return token;
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function model(catalog, key) {
  const row = catalog?.canonicalModels?.[key];
  if (!row) {
    throw new Error(`Missing canonical model '${key}' in model catalog`);
  }
  return {
    key,
    modelName: row.modelName,
    modelType: row.modelType,
    geometryProfile: row.geometryProfile,
    analyzerFamily: row.analyzerFamily
  };
}

function submodelTarget(catalog, key) {
  const row = catalog?.submodelTargets?.[key];
  if (!row) return null;
  const parent = row.parentModel || {};
  const submodels = arr(row.submodels)
    .map((submodel, index) => ({
      key: submodel.key || `${key}_submodel_${index + 1}`,
      modelName: submodel.fullName || submodel.modelName,
      submodelName: submodel.name || "",
      parentModelName: submodel.parentModelName || parent.modelName || row.parentModelName || "",
      modelType: submodel.modelType || row.modelType || parent.modelType || "custom",
      geometryProfile: submodel.geometryProfile || row.geometryProfile || "submodel_structural",
      analyzerFamily: submodel.analyzerFamily || row.analyzerFamily || "submodel",
      nodeCount: Number(submodel.nodeCount) || 0,
      lines: submodel.lines || "",
      submodelType: submodel.type || ""
    }))
    .filter((submodel) => str(submodel.modelName));
  if (!str(parent.modelName) || submodels.length < 2) return null;
  return {
    key,
    parent: {
      key: parent.key || `${key}_parent`,
      modelName: parent.modelName,
      modelType: parent.modelType || row.modelType || "custom",
      geometryProfile: parent.geometryProfile || row.geometryProfile || "custom_parent",
      analyzerFamily: parent.analyzerFamily || row.analyzerFamily || "submodel"
    },
    submodels,
    modelType: row.modelType || parent.modelType || "custom",
    geometryProfile: row.geometryProfile || "submodel_structural",
    analyzerFamily: row.analyzerFamily || "submodel"
  };
}

function paletteSettings(profile) {
  const base = {
    C_BUTTON_Palette1: "#FFFFFF",
    C_BUTTON_Palette2: "#FF0000",
    C_BUTTON_Palette3: "#00FF00",
    C_BUTTON_Palette4: "#0000FF",
    C_BUTTON_Palette5: "#FFFF00",
    C_BUTTON_Palette6: "#000000",
    C_BUTTON_Palette7: "#00FFFF",
    C_BUTTON_Palette8: "#FF00FF"
  };
  if (profile === "rgb_primary") {
    return {
      ...base,
      C_CHECKBOX_Palette1: false,
      C_CHECKBOX_Palette2: true,
      C_CHECKBOX_Palette3: true,
      C_CHECKBOX_Palette4: true,
      C_CHECKBOX_Palette5: false,
      C_CHECKBOX_Palette6: false,
      C_CHECKBOX_Palette7: false,
      C_CHECKBOX_Palette8: false
    };
  }
  return {
    ...base,
    C_CHECKBOX_Palette1: true,
    C_CHECKBOX_Palette2: false,
    C_CHECKBOX_Palette3: false,
    C_CHECKBOX_Palette4: false,
    C_CHECKBOX_Palette5: false,
    C_CHECKBOX_Palette6: false,
    C_CHECKBOX_Palette7: false,
    C_CHECKBOX_Palette8: false
  };
}

function palettePurpose(profile) {
  if (profile === "rgb_primary") {
    return {
      profile,
      designIntent: "Use RGB as assigned roles, not as an always-on three-color palette.",
      colorRoles: [
        {
          slot: 1,
          color: "#FFFFFF",
          role: "structure",
          purpose: "Primary readable structure, base geometry, and continuity layer.",
          recommendedUse: "Use as the default foundation and motion thread when color discipline is weak."
        },
        {
          slot: 2,
          color: "#FF0000",
          role: "warm_focal_accent",
          purpose: "Short-duration focal emphasis on one lead element.",
          recommendedUse: "Use sparingly on a single focal target or submodel; avoid full-display red washes."
        },
        {
          slot: 3,
          color: "#00FF00",
          role: "reserved_secondary_accent",
          purpose: "Optional second accent only when the design needs a clear contrast change.",
          recommendedUse: "Avoid in early RGB discipline repair passes unless green has a stated design reason."
        },
        {
          slot: 4,
          color: "#0000FF",
          role: "cool_motion_accent",
          purpose: "Low-density motion or response accent that should not compete with the focal color.",
          recommendedUse: "Use only after the focal color is stable; do not combine with red on the same layer stack."
        }
      ],
      constraints: [
        "Assign each active color a role before selecting effects.",
        "Prefer one chromatic accent plus white structure until color discipline is stable.",
        "Do not enable all primary colors on every effect by default.",
        "Treat additional active hues as a deliberate design change that needs validation."
      ]
    };
  }
  return {
    profile,
    designIntent: "Use mono-white as a readability and structure baseline.",
    colorRoles: [
      {
        slot: 1,
        color: "#FFFFFF",
        role: "structure",
        purpose: "Readable foundation, focal clarity, and neutral motion.",
        recommendedUse: "Use for baseline display structure and comparison passes."
      }
    ],
    constraints: [
      "Keep hue changes out of mono-white baseline passes.",
      "Use brightness, timing, target selection, and movement for variation."
    ]
  };
}

function paletteLayerSettings(profile, purpose, settings = {}) {
  const activeSlots = (() => {
    if (profile !== "rgb_primary") return [1];
    if (purpose === "warm_focal_accent") return [2];
    if (purpose === "cool_motion_accent") return [4];
    if (purpose === "reserved_secondary_accent") return [3];
    if (purpose === "background_structure") return [1, 4];
    if (purpose === "structure_motion_support") return [1, 4];
    return [1];
  })();
  const layerSettings = { ...settings };
  for (let slot = 1; slot <= 8; slot += 1) {
    layerSettings[`C_CHECKBOX_Palette${slot}`] = activeSlots.includes(slot);
  }
  return layerSettings;
}

function placement({
  id,
  target,
  targetScope,
  effectName,
  compositionPass,
  layerIndex,
  startMs = 1000,
  endMs = 5000,
  effectSettings = {},
  layerSettings = {},
  layerIntent = {}
}) {
  return {
    placementId: id,
    targetScope,
    target: target.modelName,
    modelType: target.modelType,
    geometryProfile: target.geometryProfile,
    effectName,
    compositionPass,
    layerIndex,
    startMs,
    endMs,
    effectSettings,
    layerSettings,
    layerIntent
  };
}

function manifestSample({ manifestPath, sampleId }) {
  const manifest = readOptionalJson(manifestPath);
  const sample = (manifest?.samples || []).find((row) => String(row.sampleId || "") === sampleId)
    || (manifest?.samples || [])[0]
    || null;
  if (!sample) {
    throw new Error(`Missing manifest sample '${sampleId}' in ${manifestPath}`);
  }
  return {
    effectName: sample.effectName,
    effectSettings: {
      ...(sample.sharedSettings || {}),
      ...(sample.effectSettings || {})
    },
    trainingSampleRef: {
      manifestPath,
      packId: manifest.packId || "",
      sampleId: sample.sampleId || sampleId,
      labelHints: sample.labelHints || []
    }
  };
}

function placementFromSample(options = {}) {
  const sample = manifestSample(options.sampleRef);
  return placement({
    ...options,
    effectName: sample.effectName,
    effectSettings: sample.effectSettings,
    layerIntent: {
      ...(options.layerIntent || {}),
      trainingSampleRef: sample.trainingSampleRef
    }
  });
}

function effectSettingVariant(basePlacement, {
  id,
  settingName,
  variantValue,
  visualProbe = "",
  attributionRole = "single_effect_setting_ab_variant"
} = {}) {
  const next = {
    ...basePlacement,
    placementId: id,
    effectSettings: {
      ...(basePlacement.effectSettings || {}),
      [settingName]: variantValue
    },
    layerIntent: {
      ...(basePlacement.layerIntent || {}),
      visualProbe: visualProbe || basePlacement.layerIntent?.visualProbe || "",
      attributionRole,
      effectSettingProbe: {
        settingName,
        baselineValue: basePlacement.effectSettings?.[settingName] ?? null,
        variantValue
      }
    }
  };
  return next;
}

function makeGroupModelExperiment({ paletteProfile, archGroup, archSingle, spinner }) {
  const groupFoundation = placement({
    id: `gm-${paletteProfile}-group-foundation`,
    target: archGroup,
    targetScope: "group",
    effectName: "Bars",
    compositionPass: "foundation",
    layerIndex: 0,
    effectSettings: { barCount: 3, cycles: 5, direction: "right", gradient: true },
    layerIntent: { blendRole: "foundation", priority: "broad" }
  });
  const modelFocal = placement({
    id: `gm-${paletteProfile}-model-focal`,
    target: archSingle,
    targetScope: "model",
    effectName: "Marquee",
    compositionPass: "focal",
    layerIndex: 0,
    effectSettings: { speed: 5, thickness: 4, stagger: 2 },
    layerIntent: { blendRole: "focal", priority: "specific" }
  });
  const modelDetail = placement({
    id: `gm-${paletteProfile}-model-detail`,
    target: spinner,
    targetScope: "model",
    effectName: "Pinwheel",
    compositionPass: "detail",
    layerIndex: 0,
    effectSettings: { speed: 10, armSize: 50 },
    layerIntent: { blendRole: "detail", priority: "specific" }
  });

  return {
    experimentId: `group-model-interplay-${paletteProfile}`,
    family: "group_model_interplay",
    paletteProfile,
    layeringTaxonomy: ["parent_submodel_overlap", "display_element_order"],
    targetSets: [
      { scope: "group", targets: [archGroup] },
      { scope: "model", targets: [archSingle, spinner] }
    ],
    passes: [
      {
        passId: "empty_baseline",
        compositionPass: "empty_baseline",
        placements: [],
        displayElementOrder: [archGroup.modelName, archSingle.modelName, spinner.modelName]
      },
      {
        passId: "foundation_group_only",
        compositionPass: "foundation",
        placements: [groupFoundation],
        displayElementOrder: [archGroup.modelName, archSingle.modelName, spinner.modelName]
      },
      {
        passId: "model_only",
        compositionPass: "focal",
        placements: [modelFocal, modelDetail],
        displayElementOrder: [archGroup.modelName, archSingle.modelName, spinner.modelName]
      },
      {
        passId: "group_then_model",
        compositionPass: "focal",
        placements: [groupFoundation, modelFocal, modelDetail],
        displayElementOrder: [archGroup.modelName, archSingle.modelName, spinner.modelName]
      },
      {
        passId: "model_then_group_order_variant",
        compositionPass: "order_variant",
        placements: [groupFoundation, modelFocal, modelDetail],
        displayElementOrder: [archSingle.modelName, spinner.modelName, archGroup.modelName],
        comparisonBasePassId: "group_then_model",
        changeType: "display_element_order"
      }
    ]
  };
}

function makeSameTargetLayerExperiment({ paletteProfile, star }) {
  const foundation = placement({
    id: `st-${paletteProfile}-foundation`,
    target: star,
    targetScope: "model",
    effectName: "Color Wash",
    compositionPass: "foundation",
    layerIndex: 0,
    effectSettings: { cycles: 1, circularPalette: true },
    layerSettings: { mixMethod: "Normal" },
    layerIntent: { blendRole: "foundation" }
  });
  const structure = placement({
    id: `st-${paletteProfile}-structure`,
    target: star,
    targetScope: "model",
    effectName: "Pinwheel",
    compositionPass: "structure",
    layerIndex: 1,
    effectSettings: { speed: 7, armSize: 50 },
    layerSettings: { mixMethod: "Normal" },
    layerIntent: { blendRole: "structure" }
  });
  const detail = placement({
    id: `st-${paletteProfile}-detail`,
    target: star,
    targetScope: "model",
    effectName: "SingleStrand",
    compositionPass: "detail",
    layerIndex: 2,
    effectSettings: { effect: "Chase", cycles: 3, colorSpeed: 4 },
    layerSettings: { mixMethod: "Normal" },
    layerIntent: { blendRole: "detail" }
  });
  const brightFoundation = {
    ...foundation,
    placementId: `st-${paletteProfile}-foundation-brightness-variant`,
    layerSettings: { ...foundation.layerSettings, brightness: 65 }
  };
  const contrastFoundation = {
    ...foundation,
    placementId: `st-${paletteProfile}-foundation-contrast-variant`,
    layerSettings: { ...foundation.layerSettings, contrast: 35 }
  };
  const canvasFoundation = {
    ...foundation,
    placementId: `st-${paletteProfile}-foundation-canvas-variant`,
    layerSettings: { ...foundation.layerSettings, canvas: true }
  };
  const additiveStructure = {
    ...structure,
    placementId: `st-${paletteProfile}-structure-additive-variant`,
    layerSettings: { ...structure.layerSettings, mixMethod: "Additive" }
  };
  const mixThresholdStructure = {
    ...structure,
    placementId: `st-${paletteProfile}-structure-mix-threshold-variant`,
    layerSettings: { ...structure.layerSettings, mixThreshold: 45 }
  };
  const blurredDetail = {
    ...detail,
    placementId: `st-${paletteProfile}-detail-blur-variant`,
    layerSettings: { ...detail.layerSettings, blur: 5 }
  };
  const persistentDetail = {
    ...detail,
    placementId: `st-${paletteProfile}-detail-persistent-variant`,
    layerSettings: { ...detail.layerSettings, persistentOverlay: true }
  };
  const fadedDetail = {
    ...detail,
    placementId: `st-${paletteProfile}-detail-fade-variant`,
    layerSettings: { ...detail.layerSettings, fadeIn: "0.75", fadeOut: "0.75" }
  };
  const reversedFoundation = { ...foundation, placementId: `st-${paletteProfile}-foundation-reordered`, layerIndex: 2 };
  const reversedDetail = { ...detail, placementId: `st-${paletteProfile}-detail-reordered`, layerIndex: 0 };

  return {
    experimentId: `same-target-layer-stack-${paletteProfile}`,
    family: "same_target_layer_stack",
    paletteProfile,
    layeringTaxonomy: ["same_target_layer_stack"],
    targetSets: [{ scope: "model", targets: [star] }],
    passes: [
      {
        passId: "empty_baseline",
        compositionPass: "empty_baseline",
        placements: [],
        displayElementOrder: [star.modelName]
      },
      {
        passId: "one_layer_foundation",
        compositionPass: "foundation",
        placements: [foundation],
        displayElementOrder: [star.modelName]
      },
      {
        passId: "two_layer_default",
        compositionPass: "structure",
        placements: [foundation, structure],
        displayElementOrder: [star.modelName],
        comparisonBasePassId: "one_layer_foundation",
        changeType: "layer_added"
      },
      {
        passId: "three_layer_default",
        compositionPass: "detail",
        placements: [foundation, structure, detail],
        displayElementOrder: [star.modelName],
        comparisonBasePassId: "two_layer_default",
        changeType: "layer_added"
      },
      {
        passId: "reversed_layer_order",
        compositionPass: "order_variant",
        placements: [reversedDetail, structure, reversedFoundation],
        displayElementOrder: [star.modelName],
        comparisonBasePassId: "three_layer_default",
        changeType: "layer_order"
      },
      {
        passId: "foundation_brightness_variant",
        compositionPass: "render_setting_variant",
        placements: [brightFoundation, structure, detail],
        displayElementOrder: [star.modelName],
        comparisonBasePassId: "three_layer_default",
        changeType: "layer_render_setting"
      },
      {
        passId: "foundation_contrast_variant",
        compositionPass: "render_setting_variant",
        placements: [contrastFoundation, structure, detail],
        displayElementOrder: [star.modelName],
        comparisonBasePassId: "three_layer_default",
        changeType: "layer_render_setting"
      },
      {
        passId: "foundation_canvas_variant",
        compositionPass: "render_setting_variant",
        placements: [canvasFoundation, structure, detail],
        displayElementOrder: [star.modelName],
        comparisonBasePassId: "three_layer_default",
        changeType: "layer_render_setting"
      },
      {
        passId: "structure_additive_mix_variant",
        compositionPass: "render_setting_variant",
        placements: [foundation, additiveStructure, detail],
        displayElementOrder: [star.modelName],
        comparisonBasePassId: "three_layer_default",
        changeType: "layer_render_setting"
      },
      {
        passId: "structure_mix_threshold_variant",
        compositionPass: "render_setting_variant",
        placements: [foundation, mixThresholdStructure, detail],
        displayElementOrder: [star.modelName],
        comparisonBasePassId: "three_layer_default",
        changeType: "layer_render_setting"
      },
      {
        passId: "detail_blur_variant",
        compositionPass: "render_setting_variant",
        placements: [foundation, structure, blurredDetail],
        displayElementOrder: [star.modelName],
        comparisonBasePassId: "three_layer_default",
        changeType: "layer_render_setting"
      },
      {
        passId: "detail_persistent_variant",
        compositionPass: "render_setting_variant",
        placements: [foundation, structure, persistentDetail],
        displayElementOrder: [star.modelName],
        comparisonBasePassId: "three_layer_default",
        changeType: "layer_render_setting"
      },
      {
        passId: "detail_fade_variant",
        compositionPass: "render_setting_variant",
        placements: [foundation, structure, fadedDetail],
        displayElementOrder: [star.modelName],
        comparisonBasePassId: "three_layer_default",
        changeType: "layer_render_setting"
      }
    ]
  };
}

function makeSubmodelStructureExperiment({ paletteProfile, target }) {
  if (!target) return null;
  const [primarySubmodel, siblingSubmodel] = target.submodels;
  if (!primarySubmodel || !siblingSubmodel) return null;

  const parentFoundation = placement({
    id: `sm-${paletteProfile}-parent-foundation`,
    target: target.parent,
    targetScope: "model",
    effectName: "Color Wash",
    compositionPass: "foundation",
    layerIndex: 0,
    effectSettings: { cycles: 1, circularPalette: true },
    layerSettings: { mixMethod: "Normal" },
    layerIntent: {
      blendRole: "foundation",
      structuralRole: "parent_model_reference"
    }
  });
  const submodelFoundation = placement({
    id: `sm-${paletteProfile}-submodel-foundation`,
    target: primarySubmodel,
    targetScope: "submodel",
    effectName: "Color Wash",
    compositionPass: "foundation",
    layerIndex: 0,
    effectSettings: { cycles: 1, circularPalette: true },
    layerSettings: { mixMethod: "Normal" },
    layerIntent: {
      blendRole: "foundation",
      structuralRole: "single_submodel_reference",
      parentModelName: primarySubmodel.parentModelName,
      submodelName: primarySubmodel.submodelName,
      nodeCount: primarySubmodel.nodeCount,
      lines: primarySubmodel.lines
    }
  });
  const siblingAccent = placement({
    id: `sm-${paletteProfile}-sibling-accent`,
    target: siblingSubmodel,
    targetScope: "submodel",
    effectName: "SingleStrand",
    compositionPass: "detail",
    layerIndex: 1,
    effectSettings: { effect: "Chase", cycles: 3, colorSpeed: 4 },
    layerSettings: { mixMethod: "Normal" },
    layerIntent: {
      blendRole: "detail",
      structuralRole: "sibling_submodel_contrast",
      parentModelName: siblingSubmodel.parentModelName,
      submodelName: siblingSubmodel.submodelName,
      nodeCount: siblingSubmodel.nodeCount,
      lines: siblingSubmodel.lines
    }
  });

  return {
    experimentId: `submodel-structure-${target.key}-${paletteProfile}`,
    family: "submodel_structure",
    paletteProfile,
    curriculumStage: "family_contrast_survey",
    layeringTaxonomy: ["parent_submodel_overlap", "submodel_targeting", "sibling_submodel_layering"],
    targetSets: [
      { scope: "model", targets: [target.parent] },
      { scope: "submodel", targets: [primarySubmodel, siblingSubmodel] }
    ],
    passes: [
      {
        passId: "empty_baseline",
        compositionPass: "empty_baseline",
        placements: [],
        displayElementOrder: [target.parent.modelName]
      },
      {
        passId: "parent_model_foundation",
        compositionPass: "foundation",
        placements: [parentFoundation],
        displayElementOrder: [target.parent.modelName]
      },
      {
        passId: "single_submodel_foundation",
        compositionPass: "foundation",
        placements: [submodelFoundation],
        displayElementOrder: [target.parent.modelName],
        comparisonBasePassId: "parent_model_foundation",
        changeType: "target_scope"
      },
      {
        passId: "sibling_submodels_split",
        compositionPass: "detail",
        placements: [submodelFoundation, siblingAccent],
        displayElementOrder: [target.parent.modelName],
        comparisonBasePassId: "single_submodel_foundation",
        changeType: "sibling_submodel_layer_added"
      }
    ]
  };
}

function makeCreativeIntentProbeExperiment({ paletteProfile, star, singleLineHorizontal }) {
  const moodPalettePace = placement({
    id: `ci-${paletteProfile}-mood-palette-pace`,
    target: star,
    targetScope: "model",
    effectName: "Color Wash",
    compositionPass: "foundation",
    layerIndex: 0,
    startMs: 1000,
    endMs: 5000,
    effectSettings: { cycles: 1, circularPalette: true },
    layerSettings: { mixMethod: "Normal" },
    layerIntent: {
      blendRole: "foundation",
      creativeIntent: {
        mood: "warm_build",
        palette: paletteProfile === "rgb_primary" ? "rgb_primary" : "mono_white",
        pace: "slow_build",
        style: "smooth_wash",
        dimensions: ["mood", "palette", "pace", "style"],
        reviewMethods: ["deterministic_metrics"]
      }
    }
  });
  const emphasisAccent = placement({
    id: `ci-${paletteProfile}-emphasis-accent`,
    target: singleLineHorizontal,
    targetScope: "model",
    effectName: "SingleStrand",
    compositionPass: "detail",
    layerIndex: 1,
    startMs: 3000,
    endMs: 5000,
    effectSettings: { effect: "Chase", cycles: 2, colorSpeed: 5 },
    layerSettings: { mixMethod: "Normal" },
    layerIntent: {
      blendRole: "accent",
      creativeIntent: {
        emphasis: "late_section_accent",
        negativeSpace: "preserve_opening_space",
        pace: "accent_lift",
        style: "linear_chase",
        dimensions: ["emphasis", "negative_space", "pace", "style"],
        reviewMethods: ["deterministic_metrics"]
      }
    }
  });

  return {
    experimentId: `creative-intent-probe-${paletteProfile}`,
    family: "creative_intent_probe",
    paletteProfile,
    curriculumStage: "sequence_pattern_validation",
    layeringTaxonomy: ["creative_intent_match", "section_energy_shape", "negative_space"],
    targetSets: [
      { scope: "model", targets: [star, singleLineHorizontal] }
    ],
    passes: [
      {
        passId: "empty_baseline",
        compositionPass: "empty_baseline",
        placements: [],
        displayElementOrder: [star.modelName, singleLineHorizontal.modelName]
      },
      {
        passId: "mood_palette_pace",
        compositionPass: "foundation",
        placements: [moodPalettePace],
        displayElementOrder: [star.modelName, singleLineHorizontal.modelName]
      },
      {
        passId: "emphasis_negative_space",
        compositionPass: "detail",
        placements: [moodPalettePace, emphasisAccent],
        displayElementOrder: [star.modelName, singleLineHorizontal.modelName],
        comparisonBasePassId: "mood_palette_pace",
        changeType: "creative_intent_dimension_added"
      }
    ]
  };
}

function makeCreativeIntentRevisionComparisonExperiment({ paletteProfile, archGroup, star, singleLineHorizontal }) {
  const sharedRevisionIntent = {
    mood: "warm_build",
    palette: paletteProfile === "rgb_primary" ? "rgb_primary" : "mono_white",
    pace: "slow_build_with_late_lift",
    emphasis: "late_section_lift",
    style: "smooth_wash_with_clean_linear_response",
    negativeSpace: "preserve_opening_breath",
    dimensions: ["mood", "palette", "pace", "emphasis", "style", "negative_space"],
    reviewMethods: ["deterministic_metrics", "before_after_revision_comparison"],
    revisionTarget: "add a readable late accent while preserving opening negative space"
  };
  const baselineWash = placement({
    id: `cr-${paletteProfile}-baseline-wash`,
    target: star,
    targetScope: "model",
    effectName: "Color Wash",
    compositionPass: "creative_revision",
    layerIndex: 0,
    startMs: 0,
    endMs: 6000,
    effectSettings: { cycles: 1, circularPalette: true },
    layerSettings: { mixMethod: "Normal" },
    layerIntent: {
      blendRole: "foundation",
      creativeIntent: {
        ...sharedRevisionIntent,
        revisionRole: "baseline_candidate",
        revisionIssue: "section lacks a clear late emphasis and may read too flat"
      }
    }
  });
  const baselineBackground = placement({
    id: `cr-${paletteProfile}-baseline-background`,
    target: archGroup,
    targetScope: "group",
    effectName: "Bars",
    compositionPass: "creative_revision",
    layerIndex: 1,
    startMs: 0,
    endMs: 6000,
    effectSettings: { direction: "up", cycles: 2 },
    layerSettings: { mixMethod: "Normal" },
    layerIntent: {
      blendRole: "support",
      creativeIntent: {
        ...sharedRevisionIntent,
        revisionRole: "baseline_candidate",
        supportRole: "directional_background"
      }
    }
  });
  const revisedAccent = placement({
    id: `cr-${paletteProfile}-revised-accent`,
    target: singleLineHorizontal,
    targetScope: "model",
    effectName: "SingleStrand",
    compositionPass: "creative_revision",
    layerIndex: 2,
    startMs: 3600,
    endMs: 6000,
    effectSettings: { effect: "Chase", cycles: 2, colorSpeed: 6 },
    layerSettings: { mixMethod: "Normal", fadeIn: "0.5", fadeOut: "0.5" },
    layerIntent: {
      blendRole: "accent",
      creativeIntent: {
        ...sharedRevisionIntent,
        revisionRole: "targeted_revision",
        supportRole: "late_linear_accent"
      }
    }
  });
  const revisedWash = {
    ...baselineWash,
    placementId: `cr-${paletteProfile}-revised-wash`,
    startMs: 700,
    layerIntent: {
      ...baselineWash.layerIntent,
      creativeIntent: {
        ...baselineWash.layerIntent.creativeIntent,
        revisionRole: "targeted_revision",
        revisionTarget: "delay the foundation slightly to create intentional opening space"
      }
    }
  };
  const focusRevisionBackground = {
    ...baselineBackground,
    placementId: `cr-${paletteProfile}-focus-revision-background`,
    startMs: 1600,
    endMs: 6000,
    layerSettings: { ...baselineBackground.layerSettings, brightness: 55 },
    layerIntent: {
      ...baselineBackground.layerIntent,
      creativeIntent: {
        ...baselineBackground.layerIntent.creativeIntent,
        revisionRole: "targeted_revision",
        revisionVariant: "focus_simplification",
        supportRole: "reduced_density_background",
        revisionTarget: "reduce background density so the focal idea reads more clearly"
      }
    }
  };
  const focusRevisionAccent = {
    ...revisedAccent,
    placementId: `cr-${paletteProfile}-focus-revision-accent`,
    startMs: 4200,
    endMs: 5600,
    layerSettings: { ...revisedAccent.layerSettings, brightness: 65, fadeIn: "0.35", fadeOut: "0.7" },
    layerIntent: {
      ...revisedAccent.layerIntent,
      creativeIntent: {
        ...revisedAccent.layerIntent.creativeIntent,
        revisionRole: "targeted_revision",
        revisionVariant: "focus_simplification",
        supportRole: "shorter_late_linear_accent",
        revisionTarget: "shorten the late accent so emphasis is clear without overfilling the section"
      }
    }
  };
  const handoffRevisionBackground = {
    ...baselineBackground,
    placementId: `cr-${paletteProfile}-handoff-revision-background`,
    layerIntent: {
      ...baselineBackground.layerIntent,
      creativeIntent: {
        ...baselineBackground.layerIntent.creativeIntent,
        revisionRole: "targeted_revision",
        revisionVariant: "focal_handoff_stability",
        supportRole: "preserved_directional_background",
        revisionTarget: "preserve the first draft background while adding only a clear late handoff accent"
      }
    }
  };
  const handoffRevisionAccent = {
    ...revisedAccent,
    placementId: `cr-${paletteProfile}-handoff-revision-accent`,
    startMs: 3800,
    endMs: 5400,
    layerSettings: { ...revisedAccent.layerSettings, brightness: 50, fadeIn: "0.4", fadeOut: "0.75" },
    layerIntent: {
      ...revisedAccent.layerIntent,
      creativeIntent: {
        ...revisedAccent.layerIntent.creativeIntent,
        revisionRole: "targeted_revision",
        revisionVariant: "focal_handoff_stability",
        supportRole: "clear_late_focal_handoff",
        revisionTarget: "make the late accent arrive as a clear handoff rather than a separate event"
      }
    }
  };
  const pacingRevisionBackground = {
    ...baselineBackground,
    placementId: `cr-${paletteProfile}-pacing-revision-background`,
    startMs: 1200,
    endMs: 6000,
    effectSettings: { ...baselineBackground.effectSettings, cycles: 3 },
    layerSettings: { ...baselineBackground.layerSettings, brightness: 50, fadeIn: "0.6", fadeOut: "0.4" },
    layerIntent: {
      ...baselineBackground.layerIntent,
      creativeIntent: {
        ...baselineBackground.layerIntent.creativeIntent,
        revisionRole: "targeted_revision",
        revisionVariant: "pacing_balance",
        supportRole: "restrained_motion_pacing_support",
        revisionTarget: "add clearer pacing variation while keeping coverage balanced"
      }
    }
  };
  const pacingRevisionAccent = {
    ...revisedAccent,
    placementId: `cr-${paletteProfile}-pacing-revision-accent`,
    startMs: 3000,
    endMs: 5900,
    effectSettings: { ...revisedAccent.effectSettings, cycles: 3, colorSpeed: 4 },
    layerSettings: { ...revisedAccent.layerSettings, brightness: 60, fadeIn: "0.45", fadeOut: "0.45" },
    layerIntent: {
      ...revisedAccent.layerIntent,
      creativeIntent: {
        ...revisedAccent.layerIntent.creativeIntent,
        revisionRole: "targeted_revision",
        revisionVariant: "pacing_balance",
        supportRole: "paced_late_linear_accent",
        revisionTarget: "make motion pacing more readable without overfilling the section"
      }
    }
  };

  return {
    experimentId: `creative-intent-revision-comparison-${paletteProfile}`,
    family: "creative_intent_revision_comparison",
    paletteProfile,
    curriculumStage: "sequence_pattern_validation",
    designType: "before_after_revision_pair",
    layeringTaxonomy: ["creative_intent_match", "revision_comparison", "negative_space", "emphasis"],
    targetSets: [
      { scope: "group", targets: [archGroup] },
      { scope: "model", targets: [star, singleLineHorizontal] }
    ],
    revisionComparisonContract: {
      baselinePassId: "intent_first_draft",
      revisedPassId: "intent_targeted_revision",
      scoringSignals: [
        "overall_quality_delta",
        "intent_match_delta",
        "visual_readability_delta",
        "motion_coherence_delta",
        "clutter_regression_guard",
        "video_v2_narrative_shape",
        "video_v2_focal_handoff_stability",
        "video_v2_palette_purpose_coverage",
        "video_v2_full_sequence_context"
      ],
      promotionUse: "Revision evidence is promoted only when the revised pass improves intent match without reducing readability."
    },
    passes: [
      {
        passId: "empty_baseline",
        compositionPass: "empty_baseline",
        placements: [],
        displayElementOrder: [archGroup.modelName, star.modelName, singleLineHorizontal.modelName]
      },
      {
        passId: "intent_first_draft",
        compositionPass: "creative_revision",
        placements: [baselineWash, baselineBackground],
        displayElementOrder: [archGroup.modelName, star.modelName, singleLineHorizontal.modelName]
      },
      {
        passId: "intent_targeted_revision",
        compositionPass: "creative_revision",
        placements: [revisedWash, baselineBackground, revisedAccent],
        displayElementOrder: [archGroup.modelName, star.modelName, singleLineHorizontal.modelName],
        comparisonBasePassId: "intent_first_draft",
        changeType: "creative_intent_revision"
      },
      {
        passId: "intent_focus_simplification_revision",
        compositionPass: "creative_revision",
        placements: [revisedWash, focusRevisionBackground, focusRevisionAccent],
        displayElementOrder: [archGroup.modelName, star.modelName, singleLineHorizontal.modelName],
        comparisonBasePassId: "intent_first_draft",
        changeType: "creative_intent_revision_variant"
      },
      {
        passId: "intent_focal_handoff_revision",
        compositionPass: "creative_revision",
        placements: [baselineWash, handoffRevisionBackground, handoffRevisionAccent],
        displayElementOrder: [archGroup.modelName, star.modelName, singleLineHorizontal.modelName],
        comparisonBasePassId: "intent_first_draft",
        changeType: "creative_intent_revision_variant"
      },
      {
        passId: "intent_pacing_balance_revision",
        compositionPass: "creative_revision",
        placements: [revisedWash, pacingRevisionBackground, pacingRevisionAccent],
        displayElementOrder: [archGroup.modelName, star.modelName, singleLineHorizontal.modelName],
        comparisonBasePassId: "intent_first_draft",
        changeType: "creative_intent_revision_variant"
      }
    ]
  };
}

function makeCoreEffectFitExperiment({ paletteProfile, singleLineHorizontal, archGroup, star, spinner, treeFlat }) {
  const lineSingleStrand = placement({
    id: `ef-${paletteProfile}-line-single-strand`,
    target: singleLineHorizontal,
    targetScope: "model",
    effectName: "SingleStrand",
    compositionPass: "effect_fit",
    layerIndex: 0,
    effectSettings: { effect: "Chase", cycles: 3, colorSpeed: 5 },
    layerSettings: { mixMethod: "Normal" },
    layerIntent: {
      blendRole: "effect_fit_probe",
      effectFitRole: "linear_motion_baseline"
    }
  });
  const archBars = placement({
    id: `ef-${paletteProfile}-arch-bars`,
    target: archGroup,
    targetScope: "group",
    effectName: "Bars",
    compositionPass: "effect_fit",
    layerIndex: 0,
    effectSettings: { direction: "left", cycles: 2 },
    layerSettings: { mixMethod: "Normal" },
    layerIntent: {
      blendRole: "effect_fit_probe",
      effectFitRole: "group_motion_baseline"
    }
  });
  const starWash = placement({
    id: `ef-${paletteProfile}-star-color-wash`,
    target: star,
    targetScope: "model",
    effectName: "Color Wash",
    compositionPass: "effect_fit",
    layerIndex: 0,
    effectSettings: { cycles: 1, circularPalette: true },
    layerSettings: { mixMethod: "Normal" },
    layerIntent: {
      blendRole: "effect_fit_probe",
      effectFitRole: "radial_fill_baseline"
    }
  });
  const lineMarquee = placement({
    id: `ef-${paletteProfile}-line-marquee`,
    target: singleLineHorizontal,
    targetScope: "model",
    effectName: "Marquee",
    compositionPass: "effect_fit",
    layerIndex: 0,
    effectSettings: { bandSize: 4, skipSize: 3, speed: 6, reverse: false },
    layerSettings: { mixMethod: "Normal" },
    layerIntent: {
      blendRole: "effect_fit_probe",
      effectFitRole: "segmented_linear_motion"
    }
  });
  const spinnerPinwheel = placement({
    id: `ef-${paletteProfile}-spinner-pinwheel`,
    target: spinner,
    targetScope: "model",
    effectName: "Pinwheel",
    compositionPass: "effect_fit",
    layerIndex: 0,
    effectSettings: { arms: 4, twists: 1, rotation: 20 },
    layerSettings: { mixMethod: "Normal" },
    layerIntent: {
      blendRole: "effect_fit_probe",
      effectFitRole: "radial_rotational_motion"
    }
  });
  const treeFire = placement({
    id: `ef-${paletteProfile}-tree-fire`,
    target: treeFlat,
    targetScope: "model",
    effectName: "Fire",
    compositionPass: "effect_fit",
    layerIndex: 0,
    effectSettings: { height: 50, hueShift: 0, growthCycles: 2 },
    layerSettings: { mixMethod: "Normal" },
    layerIntent: {
      blendRole: "effect_fit_probe",
      effectFitRole: "vertical_texture_motion"
    }
  });
  const starButterfly = placement({
    id: `ef-${paletteProfile}-star-butterfly`,
    target: star,
    targetScope: "model",
    effectName: "Butterfly",
    compositionPass: "effect_fit",
    layerIndex: 0,
    effectSettings: { chunks: 4, skip: 2, speed: 5 },
    layerSettings: { mixMethod: "Normal" },
    layerIntent: {
      blendRole: "effect_fit_probe",
      effectFitRole: "radial_pattern_motion"
    }
  });

  return {
    experimentId: `core-effect-fit-${paletteProfile}`,
    family: "core_effect_fit",
    paletteProfile,
    curriculumStage: "family_contrast_survey",
    layeringTaxonomy: ["effect_fit", "single_effect_baseline", "geometry_family_contrast"],
    targetSets: [
      { scope: "model", targets: [singleLineHorizontal, star, spinner, treeFlat] },
      { scope: "group", targets: [archGroup] }
    ],
    passes: [
      {
        passId: "empty_baseline",
        compositionPass: "empty_baseline",
        placements: [],
        displayElementOrder: [singleLineHorizontal.modelName, archGroup.modelName, star.modelName]
      },
      {
        passId: "single_strand_linear_motion",
        compositionPass: "effect_fit",
        placements: [lineSingleStrand],
        displayElementOrder: [singleLineHorizontal.modelName, archGroup.modelName, star.modelName]
      },
      {
        passId: "bars_group_motion",
        compositionPass: "effect_fit",
        placements: [archBars],
        displayElementOrder: [singleLineHorizontal.modelName, archGroup.modelName, star.modelName]
      },
      {
        passId: "color_wash_radial_fill",
        compositionPass: "effect_fit",
        placements: [starWash],
        displayElementOrder: [singleLineHorizontal.modelName, archGroup.modelName, star.modelName]
      },
      {
        passId: "marquee_linear_segments",
        compositionPass: "effect_fit",
        placements: [lineMarquee],
        displayElementOrder: [singleLineHorizontal.modelName, archGroup.modelName, star.modelName, spinner.modelName, treeFlat.modelName]
      },
      {
        passId: "pinwheel_spinner_rotation",
        compositionPass: "effect_fit",
        placements: [spinnerPinwheel],
        displayElementOrder: [singleLineHorizontal.modelName, archGroup.modelName, star.modelName, spinner.modelName, treeFlat.modelName]
      },
      {
        passId: "fire_tree_texture",
        compositionPass: "effect_fit",
        placements: [treeFire],
        displayElementOrder: [singleLineHorizontal.modelName, archGroup.modelName, star.modelName, spinner.modelName, treeFlat.modelName]
      },
      {
        passId: "butterfly_star_pattern",
        compositionPass: "effect_fit",
        placements: [starButterfly],
        displayElementOrder: [singleLineHorizontal.modelName, archGroup.modelName, star.modelName, spinner.modelName, treeFlat.modelName]
      }
    ]
  };
}

function makeExpandedEffectFitExperiment({ paletteProfile, singleLineHorizontal, archSingle, star, spinner, treeFlat }) {
  const lineMarquee = placement({
    id: `xf-${paletteProfile}-line-marquee`,
    target: singleLineHorizontal,
    targetScope: "model",
    effectName: "Marquee",
    compositionPass: "effect_fit",
    layerIndex: 0,
    effectSettings: { bandSize: 4, skipSize: 3, thickness: 2, speed: 6, reverse: false },
    layerSettings: { mixMethod: "Normal" },
    layerIntent: {
      blendRole: "effect_fit_probe",
      effectFitRole: "rgb_linear_segmented_motion"
    }
  });
  const archSingleStrand = placement({
    id: `xf-${paletteProfile}-arch-single-strand`,
    target: archSingle,
    targetScope: "model",
    effectName: "SingleStrand",
    compositionPass: "effect_fit",
    layerIndex: 0,
    effectSettings: { effect: "Chase", cycles: 3, colorSpeed: 5 },
    layerSettings: { mixMethod: "Normal" },
    layerIntent: {
      blendRole: "effect_fit_probe",
      effectFitRole: "curved_linear_chase"
    }
  });
  const treeBars = placement({
    id: `xf-${paletteProfile}-tree-bars`,
    target: treeFlat,
    targetScope: "model",
    effectName: "Bars",
    compositionPass: "effect_fit",
    layerIndex: 0,
    effectSettings: { direction: "up", barCount: 3, cycles: 5, gradient: true },
    layerSettings: { mixMethod: "Normal" },
    layerIntent: {
      blendRole: "effect_fit_probe",
      effectFitRole: "vertical_tree_bar_motion"
    }
  });
  const treeWash = placement({
    id: `xf-${paletteProfile}-tree-color-wash`,
    target: treeFlat,
    targetScope: "model",
    effectName: "Color Wash",
    compositionPass: "effect_fit",
    layerIndex: 0,
    effectSettings: { cycles: 1.5, hFade: true, vFade: true, circularPalette: true },
    layerSettings: { mixMethod: "Normal" },
    layerIntent: {
      blendRole: "effect_fit_probe",
      effectFitRole: "tree_gradient_fill"
    }
  });
  const archMarquee = placement({
    id: `xf-${paletteProfile}-arch-marquee`,
    target: archSingle,
    targetScope: "model",
    effectName: "Marquee",
    compositionPass: "effect_fit",
    layerIndex: 0,
    effectSettings: { bandSize: 4, skipSize: 2, thickness: 3, speed: 6, reverse: false },
    layerSettings: { mixMethod: "Normal" },
    layerIntent: {
      blendRole: "effect_fit_probe",
      effectFitRole: "curved_segmented_motion"
    }
  });
  const starPinwheel = placement({
    id: `xf-${paletteProfile}-star-pinwheel`,
    target: star,
    targetScope: "model",
    effectName: "Pinwheel",
    compositionPass: "effect_fit",
    layerIndex: 0,
    effectSettings: { arms: 5, armSize: 45, thickness: 35, speed: 10, rotation: true },
    layerSettings: { mixMethod: "Normal" },
    layerIntent: {
      blendRole: "effect_fit_probe",
      effectFitRole: "star_radial_rotation"
    }
  });
  const spinnerFire = placement({
    id: `xf-${paletteProfile}-spinner-fire`,
    target: spinner,
    targetScope: "model",
    effectName: "Fire",
    compositionPass: "effect_fit",
    layerIndex: 0,
    effectSettings: { height: 45, hueShift: 15, growthCycles: 2 },
    layerSettings: { mixMethod: "Normal" },
    layerIntent: {
      blendRole: "effect_fit_probe",
      effectFitRole: "radial_texture_stress"
    }
  });
  const spinnerButterfly = placement({
    id: `xf-${paletteProfile}-spinner-butterfly`,
    target: spinner,
    targetScope: "model",
    effectName: "Butterfly",
    compositionPass: "effect_fit",
    layerIndex: 0,
    effectSettings: { chunks: 4, skip: 2, speed: 5 },
    layerSettings: { mixMethod: "Normal" },
    layerIntent: {
      blendRole: "effect_fit_probe",
      effectFitRole: "radial_pattern_stress"
    }
  });

  return {
    experimentId: `expanded-effect-fit-${paletteProfile}`,
    family: "expanded_effect_fit",
    paletteProfile,
    curriculumStage: "family_contrast_survey",
    layeringTaxonomy: ["effect_fit", "rgb_model_matrix", "geometry_family_contrast"],
    targetSets: [
      { scope: "model", targets: [singleLineHorizontal, archSingle, treeFlat, star, spinner] }
    ],
    passes: [
      {
        passId: "empty_baseline",
        compositionPass: "empty_baseline",
        placements: [],
        displayElementOrder: [singleLineHorizontal.modelName, archSingle.modelName, treeFlat.modelName, star.modelName, spinner.modelName]
      },
      {
        passId: "marquee_single_line_rgb_segments",
        compositionPass: "effect_fit",
        placements: [lineMarquee],
        displayElementOrder: [singleLineHorizontal.modelName, archSingle.modelName, treeFlat.modelName, star.modelName, spinner.modelName]
      },
      {
        passId: "single_strand_arch_chase",
        compositionPass: "effect_fit",
        placements: [archSingleStrand],
        displayElementOrder: [singleLineHorizontal.modelName, archSingle.modelName, treeFlat.modelName, star.modelName, spinner.modelName]
      },
      {
        passId: "bars_tree_vertical_motion",
        compositionPass: "effect_fit",
        placements: [treeBars],
        displayElementOrder: [singleLineHorizontal.modelName, archSingle.modelName, treeFlat.modelName, star.modelName, spinner.modelName]
      },
      {
        passId: "color_wash_tree_gradient",
        compositionPass: "effect_fit",
        placements: [treeWash],
        displayElementOrder: [singleLineHorizontal.modelName, archSingle.modelName, treeFlat.modelName, star.modelName, spinner.modelName]
      },
      {
        passId: "marquee_arch_segments",
        compositionPass: "effect_fit",
        placements: [archMarquee],
        displayElementOrder: [singleLineHorizontal.modelName, archSingle.modelName, treeFlat.modelName, star.modelName, spinner.modelName]
      },
      {
        passId: "pinwheel_star_rotation",
        compositionPass: "effect_fit",
        placements: [starPinwheel],
        displayElementOrder: [singleLineHorizontal.modelName, archSingle.modelName, treeFlat.modelName, star.modelName, spinner.modelName]
      },
      {
        passId: "fire_spinner_texture",
        compositionPass: "effect_fit",
        placements: [spinnerFire],
        displayElementOrder: [singleLineHorizontal.modelName, archSingle.modelName, treeFlat.modelName, star.modelName, spinner.modelName]
      },
      {
        passId: "butterfly_spinner_pattern",
        compositionPass: "effect_fit",
        placements: [spinnerButterfly],
        displayElementOrder: [singleLineHorizontal.modelName, archSingle.modelName, treeFlat.modelName, star.modelName, spinner.modelName]
      }
    ]
  };
}

function makeTargetTransferAdaptationExperiment({ paletteProfile, archGroup, caneGroup, matrixLowDensity }) {
  const sharedArchPriorProbe = placement({
    id: `tt-${paletteProfile}-arch-compatible-prior`,
    target: archGroup,
    targetScope: "group",
    effectName: "Bars",
    compositionPass: "target_transfer",
    layerIndex: 0,
    effectSettings: { direction: "up", barCount: 3, cycles: 2 },
    layerSettings: { mixMethod: "Normal", brightness: 62 },
    layerIntent: {
      blendRole: "shared_prior_reference",
      transferRole: "compatible_source_context",
      compatibilityExpectation: "compatible",
      sharedPriorApplicability: "direct_reuse_allowed_with_matching_structure_and_effect_context",
      projectLocalValidation: "not_required_for_known_compatible_context"
    }
  });
  const similarCaneTransferProbe = placement({
    id: `tt-${paletteProfile}-cane-similar-transfer`,
    target: caneGroup,
    targetScope: "group",
    effectName: "SingleStrand",
    compositionPass: "target_transfer",
    layerIndex: 0,
    effectSettings: { effect: "Chase", cycles: 3, colorSpeed: 5 },
    layerSettings: { mixMethod: "Normal", brightness: 58 },
    layerIntent: {
      blendRole: "similar_structure_probe",
      transferRole: "similar_linear_target",
      compatibilityExpectation: "similar",
      sharedPriorApplicability: "advisory_starting_point",
      projectLocalValidation: "recommended_before_confident_reuse"
    }
  });
  const weakMatrixLocalProbe = placement({
    id: `tt-${paletteProfile}-matrix-weak-transfer`,
    target: matrixLowDensity,
    targetScope: "model",
    effectName: "Bars",
    compositionPass: "target_transfer",
    layerIndex: 0,
    effectSettings: { direction: "up", barCount: 3, cycles: 2 },
    layerSettings: { mixMethod: "Normal", brightness: 48 },
    layerIntent: {
      blendRole: "local_validation_probe",
      transferRole: "structurally_different_target",
      compatibilityExpectation: "weak_match",
      sharedPriorApplicability: "do_not_confidently_reuse_without_local_evidence",
      projectLocalValidation: "required_before_selector_confidence"
    }
  });

  return {
    experimentId: `target-transfer-adaptation-${paletteProfile}`,
    family: "target_transfer_adaptation",
    paletteProfile,
    curriculumStage: "project_specific_adaptation",
    layeringTaxonomy: ["shared_prior_transfer", "target_compatibility", "project_local_validation"],
    targetSets: [
      { scope: "group", targets: [archGroup, caneGroup] },
      { scope: "model", targets: [matrixLowDensity] }
    ],
    transferContract: {
      sharedLearningLayer: "shared_baseline",
      localLearningLayer: "display/target-behavior.json",
      compatibilitySignals: ["canonical_type", "geometry_profile", "target_scope", "effect_name", "metadata_role"],
      policy: "Use shared priors as compatible-structure guidance; require project-local validation for weak or structurally different targets."
    },
    passes: [
      {
        passId: "empty_baseline",
        compositionPass: "empty_baseline",
        placements: [],
        displayElementOrder: [archGroup.modelName, caneGroup.modelName, matrixLowDensity.modelName]
      },
      {
        passId: "compatible_arch_prior_context",
        compositionPass: "target_transfer",
        placements: [sharedArchPriorProbe],
        displayElementOrder: [archGroup.modelName, caneGroup.modelName, matrixLowDensity.modelName]
      },
      {
        passId: "similar_cane_transfer_probe",
        compositionPass: "target_transfer",
        placements: [similarCaneTransferProbe],
        displayElementOrder: [archGroup.modelName, caneGroup.modelName, matrixLowDensity.modelName],
        comparisonBasePassId: "compatible_arch_prior_context",
        changeType: "target_transfer_similar_structure_probe"
      },
      {
        passId: "weak_matrix_local_validation_probe",
        compositionPass: "target_transfer",
        placements: [weakMatrixLocalProbe],
        displayElementOrder: [archGroup.modelName, caneGroup.modelName, matrixLowDensity.modelName],
        comparisonBasePassId: "compatible_arch_prior_context",
        changeType: "target_transfer_local_validation_required"
      }
    ]
  };
}

function makeDisplayQualityReviewExperiment({ paletteProfile, singleLineHorizontal, archGroup, star, spinner, treeFlat }) {
  const archFoundation = placement({
    id: `dq-${paletteProfile}-arch-foundation`,
    target: archGroup,
    targetScope: "group",
    effectName: "Bars",
    compositionPass: "display_review",
    layerIndex: 0,
    startMs: 0,
    endMs: 6000,
    effectSettings: { direction: "left", cycles: 2 },
    layerSettings: { mixMethod: "Normal" },
    layerIntent: { blendRole: "foundation", displayReviewRole: "foreground_background_base" }
  });
  const starFocus = placement({
    id: `dq-${paletteProfile}-star-focus`,
    target: star,
    targetScope: "model",
    effectName: "Color Wash",
    compositionPass: "display_review",
    layerIndex: 1,
    startMs: 1000,
    endMs: 5000,
    effectSettings: { cycles: 1, circularPalette: true },
    layerSettings: { mixMethod: "Normal" },
    layerIntent: { blendRole: "focus", displayReviewRole: "central_readability_anchor" }
  });
  const lineAccent = placement({
    id: `dq-${paletteProfile}-line-accent`,
    target: singleLineHorizontal,
    targetScope: "model",
    effectName: "Marquee",
    compositionPass: "display_review",
    layerIndex: 2,
    startMs: 2500,
    endMs: 6000,
    effectSettings: { bandSize: 4, skipSize: 3, speed: 6 },
    layerSettings: { mixMethod: "Normal" },
    layerIntent: { blendRole: "accent", displayReviewRole: "regional_motion_contrast" }
  });
  const spinnerMotion = placement({
    id: `dq-${paletteProfile}-spinner-motion`,
    target: spinner,
    targetScope: "model",
    effectName: "Pinwheel",
    compositionPass: "display_review",
    layerIndex: 3,
    startMs: 1500,
    endMs: 5500,
    effectSettings: { arms: 4, twists: 1, rotation: 20 },
    layerSettings: { mixMethod: "Normal" },
    layerIntent: { blendRole: "regional_motion", displayReviewRole: "motion_coherence_probe" }
  });
  const treeTexture = placement({
    id: `dq-${paletteProfile}-tree-texture`,
    target: treeFlat,
    targetScope: "model",
    effectName: "Fire",
    compositionPass: "display_review",
    layerIndex: 4,
    startMs: 0,
    endMs: 6000,
    effectSettings: { height: 50, hueShift: 0, growthCycles: 2 },
    layerSettings: { mixMethod: "Normal" },
    layerIntent: { blendRole: "background_texture", displayReviewRole: "regional_variety_probe" }
  });
  const linePacingPulse = placement({
    id: `dq-${paletteProfile}-line-pacing-pulse`,
    target: singleLineHorizontal,
    targetScope: "model",
    effectName: "SingleStrand",
    compositionPass: "display_review",
    layerIndex: 0,
    startMs: 0,
    endMs: 6000,
    effectSettings: { effect: "Chase", cycles: 5, colorSpeed: 7 },
    layerSettings: { mixMethod: "Normal" },
    layerIntent: { blendRole: "paced_motion", displayReviewRole: "pacing_variety_revision" }
  });
  const archEntrance = placement({
    id: `dq-${paletteProfile}-arch-entrance`,
    target: archGroup,
    targetScope: "group",
    effectName: "Bars",
    compositionPass: "display_review",
    layerIndex: 1,
    startMs: 0,
    endMs: 2500,
    effectSettings: { direction: "up", cycles: 3 },
    layerSettings: { mixMethod: "Normal" },
    layerIntent: { blendRole: "entrance_foundation", displayReviewRole: "display_evolution_revision" }
  });
  const starMiddleAnchor = placement({
    id: `dq-${paletteProfile}-star-middle-anchor`,
    target: star,
    targetScope: "model",
    effectName: "Color Wash",
    compositionPass: "display_review",
    layerIndex: 2,
    startMs: 1800,
    endMs: 4300,
    effectSettings: { cycles: 2, circularPalette: true },
    layerSettings: { mixMethod: "Normal" },
    layerIntent: { blendRole: "middle_anchor", displayReviewRole: "focal_clarity_revision" }
  });
  const spinnerLateMotion = placement({
    id: `dq-${paletteProfile}-spinner-late-motion`,
    target: spinner,
    targetScope: "model",
    effectName: "Pinwheel",
    compositionPass: "display_review",
    layerIndex: 3,
    startMs: 3200,
    endMs: 6000,
    effectSettings: { arms: 6, twists: 2, rotation: 35 },
    layerSettings: { mixMethod: "Normal" },
    layerIntent: { blendRole: "late_motion", displayReviewRole: "motion_interest_revision" }
  });
  const treeReleaseTexture = placement({
    id: `dq-${paletteProfile}-tree-release-texture`,
    target: treeFlat,
    targetScope: "model",
    effectName: "Fire",
    compositionPass: "display_review",
    layerIndex: 4,
    startMs: 4200,
    endMs: 6000,
    effectSettings: { height: 70, hueShift: 0, growthCycles: 3 },
    layerSettings: { mixMethod: "Normal" },
    layerIntent: { blendRole: "release_texture", displayReviewRole: "visual_balance_revision" }
  });
  const treeBalanceFill = placement({
    id: `dq-${paletteProfile}-tree-balance-fill`,
    target: treeFlat,
    targetScope: "model",
    effectName: "Color Wash",
    compositionPass: "display_review",
    layerIndex: 0,
    startMs: 0,
    endMs: 6000,
    effectSettings: { cycles: 1, circularPalette: true },
    layerSettings: { mixMethod: "Normal" },
    layerIntent: { blendRole: "wide_balance_fill", displayReviewRole: "visual_balance_revision" }
  });
  const archOpeningWindow = placement({
    id: `dq-${paletteProfile}-arch-opening-window`,
    target: archGroup,
    targetScope: "group",
    effectName: "Bars",
    compositionPass: "display_review",
    layerIndex: 0,
    startMs: 0,
    endMs: 2200,
    effectSettings: { direction: "up", cycles: 3 },
    layerSettings: { mixMethod: "Normal" },
    layerIntent: { blendRole: "opening_region", displayReviewRole: "section_window_pacing_balance" }
  });
  const lineMiddleWindow = placement({
    id: `dq-${paletteProfile}-line-middle-window`,
    target: singleLineHorizontal,
    targetScope: "model",
    effectName: "SingleStrand",
    compositionPass: "display_review",
    layerIndex: 1,
    startMs: 1800,
    endMs: 4200,
    effectSettings: { effect: "Chase", cycles: 6, colorSpeed: 8 },
    layerSettings: { mixMethod: "Normal" },
    layerIntent: { blendRole: "middle_motion_region", displayReviewRole: "section_window_pacing_balance" }
  });
  const spinnerClosingWindow = placement({
    id: `dq-${paletteProfile}-spinner-closing-window`,
    target: spinner,
    targetScope: "model",
    effectName: "Pinwheel",
    compositionPass: "display_review",
    layerIndex: 2,
    startMs: 3800,
    endMs: 6000,
    effectSettings: { arms: 6, twists: 2, rotation: 45 },
    layerSettings: { mixMethod: "Normal" },
    layerIntent: { blendRole: "closing_motion_region", displayReviewRole: "section_window_pacing_balance" }
  });
  const starAccentWindow = placement({
    id: `dq-${paletteProfile}-star-accent-window`,
    target: star,
    targetScope: "model",
    effectName: "Color Wash",
    compositionPass: "display_review",
    layerIndex: 3,
    startMs: 2800,
    endMs: 4400,
    effectSettings: { cycles: 2, circularPalette: true },
    layerSettings: { mixMethod: "Normal" },
    layerIntent: { blendRole: "short_focal_accent", displayReviewRole: "section_window_focal_anchor" }
  });
  const archFocusBase = placement({
    id: `dq-${paletteProfile}-arch-focus-base`,
    target: archGroup,
    targetScope: "group",
    effectName: "Bars",
    compositionPass: "display_review",
    layerIndex: 0,
    startMs: 0,
    endMs: 6000,
    effectSettings: { direction: "left", cycles: 1 },
    layerSettings: { mixMethod: "Normal" },
    layerIntent: { blendRole: "restrained_foundation", displayReviewRole: "regional_focus_contrast" }
  });
  const starFocusContrast = placement({
    id: `dq-${paletteProfile}-star-focus-contrast`,
    target: star,
    targetScope: "model",
    effectName: "Pinwheel",
    compositionPass: "display_review",
    layerIndex: 1,
    startMs: 1600,
    endMs: 4600,
    effectSettings: { arms: 5, twists: 1, rotation: 30 },
    layerSettings: { mixMethod: "Normal" },
    layerIntent: { blendRole: "high_contrast_focus", displayReviewRole: "regional_focus_contrast" }
  });
  const lineReleaseAccent = placement({
    id: `dq-${paletteProfile}-line-release-accent`,
    target: singleLineHorizontal,
    targetScope: "model",
    effectName: "Marquee",
    compositionPass: "display_review",
    layerIndex: 2,
    startMs: 4200,
    endMs: 6000,
    effectSettings: { bandSize: 6, skipSize: 5, speed: 9 },
    layerSettings: { mixMethod: "Normal" },
    layerIntent: { blendRole: "release_accent", displayReviewRole: "regional_focus_contrast" }
  });
  const archConsistencyBase = placement({
    id: `dq-${paletteProfile}-arch-consistency-base`,
    target: archGroup,
    targetScope: "group",
    effectName: "Color Wash",
    compositionPass: "display_review",
    layerIndex: 0,
    startMs: 0,
    endMs: 6000,
    effectSettings: { cycles: 1, circularPalette: false },
    layerSettings: { mixMethod: "Normal" },
    layerIntent: { blendRole: "steady_context", displayReviewRole: "focal_consistency_repair" }
  });
  const starFocalHold = placement({
    id: `dq-${paletteProfile}-star-focal-hold`,
    target: star,
    targetScope: "model",
    effectName: "Pinwheel",
    compositionPass: "display_review",
    layerIndex: 1,
    startMs: 1200,
    endMs: 5200,
    effectSettings: { arms: 4, twists: 1, rotation: 15 },
    layerSettings: { mixMethod: "Normal" },
    layerIntent: { blendRole: "stable_focal_anchor", displayReviewRole: "focal_consistency_repair" }
  });
  const lineMotionThread = placement({
    id: `dq-${paletteProfile}-line-motion-thread`,
    target: singleLineHorizontal,
    targetScope: "model",
    effectName: "SingleStrand",
    compositionPass: "display_review",
    layerIndex: 2,
    startMs: 1800,
    endMs: 6000,
    effectSettings: { effect: "Chase", cycles: 4, colorSpeed: 4 },
    layerSettings: { mixMethod: "Normal" },
    layerIntent: { blendRole: "low_variance_motion_thread", displayReviewRole: "focal_consistency_repair" }
  });
  const archRgbDisciplineBase = placement({
    id: `dq-${paletteProfile}-arch-rgb-discipline-base`,
    target: archGroup,
    targetScope: "group",
    effectName: "Color Wash",
    compositionPass: "display_review",
    layerIndex: 0,
    startMs: 0,
    endMs: 6000,
    effectSettings: {
      cycles: 1,
      circularPalette: false
    },
    layerSettings: {
      mixMethod: "Normal",
      brightness: 75,
      C_CHECKBOX_Palette1: true,
      C_CHECKBOX_Palette2: false,
      C_CHECKBOX_Palette3: false,
      C_CHECKBOX_Palette4: false,
      C_CHECKBOX_Palette5: false,
      C_CHECKBOX_Palette6: false,
      C_CHECKBOX_Palette7: false,
      C_CHECKBOX_Palette8: false
    },
    layerIntent: {
      blendRole: "neutral_structure",
      displayReviewRole: "rgb_color_discipline_repair",
      colorPurpose: "structure"
    }
  });
  const starRgbDisciplinedAccent = placement({
    id: `dq-${paletteProfile}-star-rgb-disciplined-accent`,
    target: star,
    targetScope: "model",
    effectName: "Pinwheel",
    compositionPass: "display_review",
    layerIndex: 1,
    startMs: 1600,
    endMs: 4600,
    effectSettings: {
      arms: 4,
      twists: 1,
      rotation: 15
    },
    layerSettings: {
      mixMethod: "Normal",
      brightness: 55,
      C_CHECKBOX_Palette1: false,
      C_CHECKBOX_Palette2: true,
      C_CHECKBOX_Palette3: false,
      C_CHECKBOX_Palette4: false,
      C_CHECKBOX_Palette5: false,
      C_CHECKBOX_Palette6: false,
      C_CHECKBOX_Palette7: false,
      C_CHECKBOX_Palette8: false
    },
    layerIntent: {
      blendRole: "single_hue_focal_accent",
      displayReviewRole: "rgb_color_discipline_repair",
      colorPurpose: "warm_focal_accent"
    }
  });
  const lineRgbDisciplinedMotion = placement({
    id: `dq-${paletteProfile}-line-rgb-disciplined-motion`,
    target: singleLineHorizontal,
    targetScope: "model",
    effectName: "SingleStrand",
    compositionPass: "display_review",
    layerIndex: 2,
    startMs: 2400,
    endMs: 6000,
    effectSettings: {
      effect: "Chase",
      cycles: 2,
      colorSpeed: 2
    },
    layerSettings: {
      mixMethod: "Normal",
      brightness: 70,
      C_CHECKBOX_Palette1: true,
      C_CHECKBOX_Palette2: false,
      C_CHECKBOX_Palette3: false,
      C_CHECKBOX_Palette4: false,
      C_CHECKBOX_Palette5: false,
      C_CHECKBOX_Palette6: false,
      C_CHECKBOX_Palette7: false,
      C_CHECKBOX_Palette8: false
    },
    layerIntent: {
      blendRole: "neutral_motion_thread",
      displayReviewRole: "rgb_color_discipline_repair",
      colorPurpose: "structure_motion_support"
    }
  });
  const treeRgbStructureBalance = placement({
    id: `dq-${paletteProfile}-tree-rgb-structure-balance`,
    target: treeFlat,
    targetScope: "model",
    effectName: "Color Wash",
    compositionPass: "display_review",
    layerIndex: 0,
    startMs: 0,
    endMs: 6000,
    effectSettings: { cycles: 1, circularPalette: false },
    layerSettings: {
      mixMethod: "Normal",
      brightness: 60,
      C_CHECKBOX_Palette1: true,
      C_CHECKBOX_Palette2: false,
      C_CHECKBOX_Palette3: false,
      C_CHECKBOX_Palette4: false,
      C_CHECKBOX_Palette5: false,
      C_CHECKBOX_Palette6: false,
      C_CHECKBOX_Palette7: false,
      C_CHECKBOX_Palette8: false
    },
    layerIntent: {
      blendRole: "neutral_balance_fill",
      displayReviewRole: "rgb_structure_balance_pacing_repair",
      colorPurpose: "structure"
    }
  });
  const archRgbPacingWindow = placement({
    id: `dq-${paletteProfile}-arch-rgb-pacing-window`,
    target: archGroup,
    targetScope: "group",
    effectName: "Bars",
    compositionPass: "display_review",
    layerIndex: 1,
    startMs: 0,
    endMs: 2400,
    effectSettings: { direction: "up", cycles: 2 },
    layerSettings: {
      mixMethod: "Normal",
      brightness: 65,
      C_CHECKBOX_Palette1: true,
      C_CHECKBOX_Palette2: false,
      C_CHECKBOX_Palette3: false,
      C_CHECKBOX_Palette4: false,
      C_CHECKBOX_Palette5: false,
      C_CHECKBOX_Palette6: false,
      C_CHECKBOX_Palette7: false,
      C_CHECKBOX_Palette8: false
    },
    layerIntent: {
      blendRole: "neutral_opening_pace",
      displayReviewRole: "rgb_structure_balance_pacing_repair",
      colorPurpose: "structure_motion_support"
    }
  });
  const lineRgbPacingWindow = placement({
    id: `dq-${paletteProfile}-line-rgb-pacing-window`,
    target: singleLineHorizontal,
    targetScope: "model",
    effectName: "SingleStrand",
    compositionPass: "display_review",
    layerIndex: 2,
    startMs: 2200,
    endMs: 6000,
    effectSettings: { effect: "Chase", cycles: 3, colorSpeed: 4 },
    layerSettings: {
      mixMethod: "Normal",
      brightness: 70,
      C_CHECKBOX_Palette1: true,
      C_CHECKBOX_Palette2: false,
      C_CHECKBOX_Palette3: false,
      C_CHECKBOX_Palette4: false,
      C_CHECKBOX_Palette5: false,
      C_CHECKBOX_Palette6: false,
      C_CHECKBOX_Palette7: false,
      C_CHECKBOX_Palette8: false
    },
    layerIntent: {
      blendRole: "neutral_late_pace",
      displayReviewRole: "rgb_structure_balance_pacing_repair",
      colorPurpose: "structure_motion_support"
    }
  });
  const starRgbSparseFocalAccent = placement({
    id: `dq-${paletteProfile}-star-rgb-sparse-focal-accent`,
    target: star,
    targetScope: "model",
    effectName: "Pinwheel",
    compositionPass: "display_review",
    layerIndex: 3,
    startMs: 2500,
    endMs: 4100,
    effectSettings: { arms: 3, twists: 1, rotation: 10 },
    layerSettings: {
      mixMethod: "Normal",
      brightness: 45,
      C_CHECKBOX_Palette1: false,
      C_CHECKBOX_Palette2: true,
      C_CHECKBOX_Palette3: false,
      C_CHECKBOX_Palette4: false,
      C_CHECKBOX_Palette5: false,
      C_CHECKBOX_Palette6: false,
      C_CHECKBOX_Palette7: false,
      C_CHECKBOX_Palette8: false
    },
    layerIntent: {
      blendRole: "short_low_intensity_focal_accent",
      displayReviewRole: "rgb_structure_balance_pacing_repair",
      colorPurpose: "warm_focal_accent"
    }
  });
  const safeLocalFoundation = placement({
    id: `dq-${paletteProfile}-safe-local-foundation`,
    target: archGroup,
    targetScope: "group",
    effectName: "Color Wash",
    compositionPass: "display_review",
    layerIndex: 0,
    startMs: 0,
    endMs: 6000,
    effectSettings: { cycles: 1, circularPalette: false },
    layerSettings: {
      mixMethod: "Normal",
      brightness: 52,
      C_CHECKBOX_Palette1: true,
      C_CHECKBOX_Palette2: false,
      C_CHECKBOX_Palette3: false,
      C_CHECKBOX_Palette4: false,
      C_CHECKBOX_Palette5: false,
      C_CHECKBOX_Palette6: false,
      C_CHECKBOX_Palette7: false,
      C_CHECKBOX_Palette8: false
    },
    layerIntent: {
      blendRole: "quiet_display_context",
      displayReviewRole: "safe_local_evidence_repair",
      localEvidenceRole: "display_context",
      colorPurpose: "structure"
    }
  });
  const safeLocalLineThread = placement({
    id: `dq-${paletteProfile}-safe-local-line-thread`,
    target: singleLineHorizontal,
    targetScope: "model",
    effectName: "SingleStrand",
    compositionPass: "display_review",
    layerIndex: 1,
    startMs: 800,
    endMs: 3600,
    effectSettings: { effect: "Chase", cycles: 2, colorSpeed: 2 },
    layerSettings: {
      mixMethod: "Normal",
      brightness: 58,
      C_CHECKBOX_Palette1: true,
      C_CHECKBOX_Palette2: false,
      C_CHECKBOX_Palette3: false,
      C_CHECKBOX_Palette4: false,
      C_CHECKBOX_Palette5: false,
      C_CHECKBOX_Palette6: false,
      C_CHECKBOX_Palette7: false,
      C_CHECKBOX_Palette8: false
    },
    layerIntent: {
      blendRole: "bounded_local_motion_thread",
      displayReviewRole: "safe_local_evidence_repair",
      localEvidenceRole: "linear_node_order_readability",
      colorPurpose: "structure_motion_support"
    }
  });
  const safeLocalStarAccent = placement({
    id: `dq-${paletteProfile}-safe-local-star-accent`,
    target: star,
    targetScope: "model",
    effectName: "Pinwheel",
    compositionPass: "display_review",
    layerIndex: 2,
    startMs: 2400,
    endMs: 4300,
    effectSettings: { arms: 3, twists: 1, rotation: 12 },
    layerSettings: {
      mixMethod: "Normal",
      brightness: 42,
      C_CHECKBOX_Palette1: false,
      C_CHECKBOX_Palette2: true,
      C_CHECKBOX_Palette3: false,
      C_CHECKBOX_Palette4: false,
      C_CHECKBOX_Palette5: false,
      C_CHECKBOX_Palette6: false,
      C_CHECKBOX_Palette7: false,
      C_CHECKBOX_Palette8: false
    },
    layerIntent: {
      blendRole: "short_local_focal_detail",
      displayReviewRole: "safe_local_evidence_repair",
      localEvidenceRole: "radial_structure_readability",
      colorPurpose: "warm_focal_accent"
    }
  });
  const safeLocalTreeFill = placement({
    id: `dq-${paletteProfile}-safe-local-tree-fill`,
    target: treeFlat,
    targetScope: "model",
    effectName: "Bars",
    compositionPass: "display_review",
    layerIndex: 3,
    startMs: 3800,
    endMs: 6000,
    effectSettings: { direction: "up", cycles: 1 },
    layerSettings: {
      mixMethod: "Normal",
      brightness: 48,
      C_CHECKBOX_Palette1: true,
      C_CHECKBOX_Palette2: false,
      C_CHECKBOX_Palette3: false,
      C_CHECKBOX_Palette4: false,
      C_CHECKBOX_Palette5: false,
      C_CHECKBOX_Palette6: false,
      C_CHECKBOX_Palette7: false,
      C_CHECKBOX_Palette8: false
    },
    layerIntent: {
      blendRole: "late_low_intensity_local_fill",
      displayReviewRole: "safe_local_evidence_repair",
      localEvidenceRole: "vertical_structure_readability",
      colorPurpose: "structure"
    }
  });
  const depthContextWash = placement({
    id: `dq-${paletteProfile}-depth-context-wash`,
    target: treeFlat,
    targetScope: "model",
    effectName: "Color Wash",
    compositionPass: "display_review",
    layerIndex: 0,
    startMs: 0,
    endMs: 6000,
    effectSettings: { cycles: 1, circularPalette: true },
    layerSettings: {
      mixMethod: "Normal",
      brightness: 46,
      C_CHECKBOX_Palette1: true,
      C_CHECKBOX_Palette2: false,
      C_CHECKBOX_Palette3: true,
      C_CHECKBOX_Palette4: false,
      C_CHECKBOX_Palette5: false,
      C_CHECKBOX_Palette6: false,
      C_CHECKBOX_Palette7: false,
      C_CHECKBOX_Palette8: false
    },
    layerIntent: {
      blendRole: "quiet_background_depth",
      displayReviewRole: "palette_depth_contrast_motion_repair",
      colorPurpose: "background_structure"
    }
  });
  const depthArchFrame = placement({
    id: `dq-${paletteProfile}-depth-arch-frame`,
    target: archGroup,
    targetScope: "group",
    effectName: "Bars",
    compositionPass: "display_review",
    layerIndex: 1,
    startMs: 0,
    endMs: 2600,
    effectSettings: { direction: "up", cycles: 2 },
    layerSettings: {
      mixMethod: "Normal",
      brightness: 58,
      C_CHECKBOX_Palette1: true,
      C_CHECKBOX_Palette2: true,
      C_CHECKBOX_Palette3: false,
      C_CHECKBOX_Palette4: false,
      C_CHECKBOX_Palette5: false,
      C_CHECKBOX_Palette6: false,
      C_CHECKBOX_Palette7: false,
      C_CHECKBOX_Palette8: false
    },
    layerIntent: {
      blendRole: "opening_depth_frame",
      displayReviewRole: "palette_depth_contrast_motion_repair",
      colorPurpose: "structure_motion_support"
    }
  });
  const depthLineThread = placement({
    id: `dq-${paletteProfile}-depth-line-thread`,
    target: singleLineHorizontal,
    targetScope: "model",
    effectName: "SingleStrand",
    compositionPass: "display_review",
    layerIndex: 2,
    startMs: 1800,
    endMs: 6000,
    effectSettings: { effect: "Chase", cycles: 4, colorSpeed: 4 },
    layerSettings: {
      mixMethod: "Normal",
      brightness: 64,
      C_CHECKBOX_Palette1: false,
      C_CHECKBOX_Palette2: true,
      C_CHECKBOX_Palette3: true,
      C_CHECKBOX_Palette4: false,
      C_CHECKBOX_Palette5: false,
      C_CHECKBOX_Palette6: false,
      C_CHECKBOX_Palette7: false,
      C_CHECKBOX_Palette8: false
    },
    layerIntent: {
      blendRole: "foreground_motion_thread",
      displayReviewRole: "palette_depth_contrast_motion_repair",
      colorPurpose: "structure_motion_support"
    }
  });
  const depthStarAccent = placement({
    id: `dq-${paletteProfile}-depth-star-accent`,
    target: star,
    targetScope: "model",
    effectName: "Pinwheel",
    compositionPass: "display_review",
    layerIndex: 3,
    startMs: 2600,
    endMs: 4700,
    effectSettings: { arms: 4, twists: 1, rotation: 18 },
    layerSettings: {
      mixMethod: "Normal",
      brightness: 52,
      C_CHECKBOX_Palette1: false,
      C_CHECKBOX_Palette2: false,
      C_CHECKBOX_Palette3: false,
      C_CHECKBOX_Palette4: true,
      C_CHECKBOX_Palette5: false,
      C_CHECKBOX_Palette6: false,
      C_CHECKBOX_Palette7: false,
      C_CHECKBOX_Palette8: false
    },
    layerIntent: {
      blendRole: "short_focal_depth_accent",
      displayReviewRole: "palette_depth_contrast_motion_repair",
      colorPurpose: "focal_accent"
    }
  });
  const transitionBackground = placement({
    id: `dq-${paletteProfile}-transition-background`,
    target: treeFlat,
    targetScope: "model",
    effectName: "Color Wash",
    compositionPass: "display_review",
    layerIndex: 0,
    startMs: 0,
    endMs: 6000,
    effectSettings: { cycles: 1, circularPalette: true },
    layerSettings: {
      mixMethod: "Normal",
      brightness: 42,
      C_CHECKBOX_Palette1: true,
      C_CHECKBOX_Palette2: false,
      C_CHECKBOX_Palette3: true,
      C_CHECKBOX_Palette4: false,
      C_CHECKBOX_Palette5: false,
      C_CHECKBOX_Palette6: false,
      C_CHECKBOX_Palette7: false,
      C_CHECKBOX_Palette8: false
    },
    layerIntent: {
      blendRole: "cool_background_harmony",
      displayReviewRole: "palette_transition_harmony_repair",
      colorPurpose: "background_structure"
    }
  });
  const transitionArchWarmEntry = placement({
    id: `dq-${paletteProfile}-transition-arch-warm-entry`,
    target: archGroup,
    targetScope: "group",
    effectName: "Bars",
    compositionPass: "display_review",
    layerIndex: 1,
    startMs: 0,
    endMs: 2200,
    effectSettings: { direction: "up", cycles: 2 },
    layerSettings: {
      mixMethod: "Normal",
      brightness: 58,
      C_CHECKBOX_Palette1: false,
      C_CHECKBOX_Palette2: true,
      C_CHECKBOX_Palette3: false,
      C_CHECKBOX_Palette4: false,
      C_CHECKBOX_Palette5: false,
      C_CHECKBOX_Palette6: false,
      C_CHECKBOX_Palette7: false,
      C_CHECKBOX_Palette8: false
    },
    layerIntent: {
      blendRole: "warm_opening_motion_support",
      displayReviewRole: "palette_transition_harmony_repair",
      colorPurpose: "warm_motion_support"
    }
  });
  const transitionLineBridge = placement({
    id: `dq-${paletteProfile}-transition-line-bridge`,
    target: singleLineHorizontal,
    targetScope: "model",
    effectName: "SingleStrand",
    compositionPass: "display_review",
    layerIndex: 2,
    startMs: 1600,
    endMs: 4600,
    effectSettings: { effect: "Chase", cycles: 3, colorSpeed: 3 },
    layerSettings: {
      mixMethod: "Normal",
      brightness: 62,
      C_CHECKBOX_Palette1: false,
      C_CHECKBOX_Palette2: true,
      C_CHECKBOX_Palette3: true,
      C_CHECKBOX_Palette4: false,
      C_CHECKBOX_Palette5: false,
      C_CHECKBOX_Palette6: false,
      C_CHECKBOX_Palette7: false,
      C_CHECKBOX_Palette8: false
    },
    layerIntent: {
      blendRole: "mid_section_palette_bridge",
      displayReviewRole: "palette_transition_harmony_repair",
      colorPurpose: "transition_motion_bridge"
    }
  });
  const transitionSpinnerCounterpoint = placement({
    id: `dq-${paletteProfile}-transition-spinner-counterpoint`,
    target: spinner,
    targetScope: "model",
    effectName: "Butterfly",
    compositionPass: "display_review",
    layerIndex: 3,
    startMs: 3000,
    endMs: 6000,
    effectSettings: { chunks: 2, skip: 1 },
    layerSettings: {
      mixMethod: "Normal",
      brightness: 50,
      C_CHECKBOX_Palette1: false,
      C_CHECKBOX_Palette2: false,
      C_CHECKBOX_Palette3: true,
      C_CHECKBOX_Palette4: false,
      C_CHECKBOX_Palette5: false,
      C_CHECKBOX_Palette6: false,
      C_CHECKBOX_Palette7: false,
      C_CHECKBOX_Palette8: false
    },
    layerIntent: {
      blendRole: "late_cool_counterpoint",
      displayReviewRole: "palette_transition_harmony_repair",
      colorPurpose: "cool_counterpoint_motion_support"
    }
  });
  const transitionStarAccent = placement({
    id: `dq-${paletteProfile}-transition-star-accent`,
    target: star,
    targetScope: "model",
    effectName: "Pinwheel",
    compositionPass: "display_review",
    layerIndex: 4,
    startMs: 3600,
    endMs: 5200,
    effectSettings: { arms: 4, twists: 1, rotation: 20 },
    layerSettings: {
      mixMethod: "Normal",
      brightness: 56,
      C_CHECKBOX_Palette1: false,
      C_CHECKBOX_Palette2: false,
      C_CHECKBOX_Palette3: false,
      C_CHECKBOX_Palette4: true,
      C_CHECKBOX_Palette5: false,
      C_CHECKBOX_Palette6: false,
      C_CHECKBOX_Palette7: false,
      C_CHECKBOX_Palette8: false
    },
    layerIntent: {
      blendRole: "resolved_focal_accent",
      displayReviewRole: "palette_transition_harmony_repair",
      colorPurpose: "focal_accent"
    }
  });
  const spatialLeftStructure = placement({
    id: `dq-${paletteProfile}-spatial-left-structure`,
    target: archGroup,
    targetScope: "group",
    effectName: "Bars",
    compositionPass: "display_review",
    layerIndex: 0,
    startMs: 0,
    endMs: 6000,
    effectSettings: { direction: "up", cycles: 1 },
    layerSettings: {
      mixMethod: "Normal",
      brightness: 48,
      C_CHECKBOX_Palette1: true,
      C_CHECKBOX_Palette2: false,
      C_CHECKBOX_Palette3: false,
      C_CHECKBOX_Palette4: false,
      C_CHECKBOX_Palette5: false,
      C_CHECKBOX_Palette6: false,
      C_CHECKBOX_Palette7: false,
      C_CHECKBOX_Palette8: false
    },
    layerIntent: {
      blendRole: "left_weight_structure",
      displayReviewRole: "palette_spatial_balance_focal_repair",
      colorPurpose: "background_structure"
    }
  });
  const spatialRightCounterweight = placement({
    id: `dq-${paletteProfile}-spatial-right-counterweight`,
    target: treeFlat,
    targetScope: "model",
    effectName: "Color Wash",
    compositionPass: "display_review",
    layerIndex: 1,
    startMs: 800,
    endMs: 6000,
    effectSettings: { cycles: 1, circularPalette: false },
    layerSettings: {
      mixMethod: "Normal",
      brightness: 44,
      C_CHECKBOX_Palette1: false,
      C_CHECKBOX_Palette2: false,
      C_CHECKBOX_Palette3: true,
      C_CHECKBOX_Palette4: false,
      C_CHECKBOX_Palette5: false,
      C_CHECKBOX_Palette6: false,
      C_CHECKBOX_Palette7: false,
      C_CHECKBOX_Palette8: false
    },
    layerIntent: {
      blendRole: "right_counterweight_structure",
      displayReviewRole: "palette_spatial_balance_focal_repair",
      colorPurpose: "counterweight_structure"
    }
  });
  const spatialCenterFocal = placement({
    id: `dq-${paletteProfile}-spatial-center-focal`,
    target: star,
    targetScope: "model",
    effectName: "Pinwheel",
    compositionPass: "display_review",
    layerIndex: 2,
    startMs: 1800,
    endMs: 4300,
    effectSettings: { arms: 5, twists: 1, rotation: 14 },
    layerSettings: {
      mixMethod: "Normal",
      brightness: 58,
      C_CHECKBOX_Palette1: false,
      C_CHECKBOX_Palette2: true,
      C_CHECKBOX_Palette3: false,
      C_CHECKBOX_Palette4: true,
      C_CHECKBOX_Palette5: false,
      C_CHECKBOX_Palette6: false,
      C_CHECKBOX_Palette7: false,
      C_CHECKBOX_Palette8: false
    },
    layerIntent: {
      blendRole: "center_focal_anchor",
      displayReviewRole: "palette_spatial_balance_focal_repair",
      colorPurpose: "focal_accent"
    }
  });
  const spatialLineBridge = placement({
    id: `dq-${paletteProfile}-spatial-line-bridge`,
    target: singleLineHorizontal,
    targetScope: "model",
    effectName: "SingleStrand",
    compositionPass: "display_review",
    layerIndex: 3,
    startMs: 2600,
    endMs: 6000,
    effectSettings: { effect: "Chase", cycles: 2, colorSpeed: 2 },
    layerSettings: {
      mixMethod: "Normal",
      brightness: 54,
      C_CHECKBOX_Palette1: true,
      C_CHECKBOX_Palette2: true,
      C_CHECKBOX_Palette3: false,
      C_CHECKBOX_Palette4: false,
      C_CHECKBOX_Palette5: false,
      C_CHECKBOX_Palette6: false,
      C_CHECKBOX_Palette7: false,
      C_CHECKBOX_Palette8: false
    },
    layerIntent: {
      blendRole: "focal_to_structure_bridge",
      displayReviewRole: "palette_spatial_balance_focal_repair",
      colorPurpose: "transition_motion_bridge"
    }
  });
  const spatialSpinnerSupport = placement({
    id: `dq-${paletteProfile}-spatial-spinner-support`,
    target: spinner,
    targetScope: "model",
    effectName: "Butterfly",
    compositionPass: "display_review",
    layerIndex: 4,
    startMs: 4200,
    endMs: 6000,
    effectSettings: { chunks: 1, skip: 1 },
    layerSettings: {
      mixMethod: "Normal",
      brightness: 38,
      C_CHECKBOX_Palette1: false,
      C_CHECKBOX_Palette2: false,
      C_CHECKBOX_Palette3: true,
      C_CHECKBOX_Palette4: false,
      C_CHECKBOX_Palette5: false,
      C_CHECKBOX_Palette6: false,
      C_CHECKBOX_Palette7: false,
      C_CHECKBOX_Palette8: false
    },
    layerIntent: {
      blendRole: "late_low_intensity_motion_support",
      displayReviewRole: "palette_spatial_balance_focal_repair",
      colorPurpose: "motion_support"
    }
  });
  const pacingOpeningStructure = placement({
    id: `dq-${paletteProfile}-pacing-opening-structure`,
    target: archGroup,
    targetScope: "group",
    effectName: "Bars",
    compositionPass: "display_review",
    layerIndex: 0,
    startMs: 0,
    endMs: 4000,
    effectSettings: { direction: "up", cycles: 1 },
    layerSettings: {
      mixMethod: "Normal",
      brightness: 54,
      C_CHECKBOX_Palette1: true,
      C_CHECKBOX_Palette2: false,
      C_CHECKBOX_Palette3: false,
      C_CHECKBOX_Palette4: false,
      C_CHECKBOX_Palette5: false,
      C_CHECKBOX_Palette6: false,
      C_CHECKBOX_Palette7: false,
      C_CHECKBOX_Palette8: false
    },
    layerIntent: {
      blendRole: "opening_low_density_structure",
      displayReviewRole: "palette_section_pacing_consistency_repair",
      colorPurpose: "background_structure"
    }
  });
  const pacingMiddleMotion = placement({
    id: `dq-${paletteProfile}-pacing-middle-motion`,
    target: singleLineHorizontal,
    targetScope: "model",
    effectName: "SingleStrand",
    compositionPass: "display_review",
    layerIndex: 1,
    startMs: 1000,
    endMs: 5200,
    effectSettings: { effect: "Chase", cycles: 3, colorSpeed: 3 },
    layerSettings: {
      mixMethod: "Normal",
      brightness: 58,
      C_CHECKBOX_Palette1: true,
      C_CHECKBOX_Palette2: true,
      C_CHECKBOX_Palette3: false,
      C_CHECKBOX_Palette4: false,
      C_CHECKBOX_Palette5: false,
      C_CHECKBOX_Palette6: false,
      C_CHECKBOX_Palette7: false,
      C_CHECKBOX_Palette8: false
    },
    layerIntent: {
      blendRole: "middle_motion_step",
      displayReviewRole: "palette_section_pacing_consistency_repair",
      colorPurpose: "transition_motion_bridge"
    }
  });
  const pacingMiddleFocal = placement({
    id: `dq-${paletteProfile}-pacing-middle-focal`,
    target: star,
    targetScope: "model",
    effectName: "Pinwheel",
    compositionPass: "display_review",
    layerIndex: 2,
    startMs: 2400,
    endMs: 4200,
    effectSettings: { arms: 4, twists: 1, rotation: 10 },
    layerSettings: {
      mixMethod: "Normal",
      brightness: 48,
      C_CHECKBOX_Palette1: false,
      C_CHECKBOX_Palette2: true,
      C_CHECKBOX_Palette3: false,
      C_CHECKBOX_Palette4: true,
      C_CHECKBOX_Palette5: false,
      C_CHECKBOX_Palette6: false,
      C_CHECKBOX_Palette7: false,
      C_CHECKBOX_Palette8: false
    },
    layerIntent: {
      blendRole: "middle_focal_step",
      displayReviewRole: "palette_section_pacing_consistency_repair",
      colorPurpose: "focal_accent"
    }
  });
  const pacingLateCounterweight = placement({
    id: `dq-${paletteProfile}-pacing-late-counterweight`,
    target: treeFlat,
    targetScope: "model",
    effectName: "Color Wash",
    compositionPass: "display_review",
    layerIndex: 3,
    startMs: 2200,
    endMs: 6000,
    effectSettings: { cycles: 1, circularPalette: false },
    layerSettings: {
      mixMethod: "Normal",
      brightness: 50,
      C_CHECKBOX_Palette1: false,
      C_CHECKBOX_Palette2: false,
      C_CHECKBOX_Palette3: true,
      C_CHECKBOX_Palette4: false,
      C_CHECKBOX_Palette5: false,
      C_CHECKBOX_Palette6: false,
      C_CHECKBOX_Palette7: false,
      C_CHECKBOX_Palette8: false
    },
    layerIntent: {
      blendRole: "late_consistent_counterweight",
      displayReviewRole: "palette_section_pacing_consistency_repair",
      colorPurpose: "counterweight_structure"
    }
  });
  const pacingReleaseSupport = placement({
    id: `dq-${paletteProfile}-pacing-release-support`,
    target: spinner,
    targetScope: "model",
    effectName: "Butterfly",
    compositionPass: "display_review",
    layerIndex: 4,
    startMs: 3800,
    endMs: 6000,
    effectSettings: { chunks: 1, skip: 1 },
    layerSettings: {
      mixMethod: "Normal",
      brightness: 42,
      C_CHECKBOX_Palette1: false,
      C_CHECKBOX_Palette2: false,
      C_CHECKBOX_Palette3: true,
      C_CHECKBOX_Palette4: false,
      C_CHECKBOX_Palette5: false,
      C_CHECKBOX_Palette6: false,
      C_CHECKBOX_Palette7: false,
      C_CHECKBOX_Palette8: false
    },
    layerIntent: {
      blendRole: "release_motion_support",
      displayReviewRole: "palette_section_pacing_consistency_repair",
      colorPurpose: "motion_support"
    }
  });
  const generatedValidationPasses = Array.from({ length: RGB_DISPLAY_AUTO_REFILL_VALIDATION_CYCLE_COUNT }, (_, index) => {
    const cycle = String(index + 1).padStart(2, "0");
    return [
      {
        passId: `display_palette_motion_pacing_validation_cycle_${cycle}`,
        compositionPass: "display_review",
        placements: [pacingOpeningStructure, pacingMiddleMotion, pacingMiddleFocal, pacingReleaseSupport],
        displayElementOrder: [archGroup.modelName, singleLineHorizontal.modelName, star.modelName, spinner.modelName, treeFlat.modelName],
        comparisonBasePassId: "display_palette_motion_pacing_holdout",
        changeType: "video_aesthetic_palette_motion_pacing_validation_cycle"
      },
      {
        passId: `display_palette_spatial_negative_space_validation_cycle_${cycle}`,
        compositionPass: "display_review",
        placements: [spatialLeftStructure, spatialCenterFocal, spatialLineBridge, safeLocalStarAccent],
        displayElementOrder: [archGroup.modelName, star.modelName, singleLineHorizontal.modelName, treeFlat.modelName, spinner.modelName],
        comparisonBasePassId: "display_palette_spatial_negative_space_holdout",
        changeType: "video_aesthetic_palette_spatial_negative_space_validation_cycle"
      },
      {
        passId: `display_palette_spatial_focal_validation_cycle_${cycle}`,
        compositionPass: "display_review",
        placements: [spatialLeftStructure, spatialCenterFocal, safeLocalLineThread, safeLocalStarAccent],
        displayElementOrder: [archGroup.modelName, star.modelName, singleLineHorizontal.modelName, treeFlat.modelName, spinner.modelName],
        comparisonBasePassId: "display_palette_spatial_focal_holdout",
        changeType: "video_aesthetic_palette_spatial_focal_validation_cycle"
      },
      {
        passId: `display_palette_color_purpose_motion_validation_cycle_${cycle}`,
        compositionPass: "display_review",
        placements: [spatialLeftStructure, spatialCenterFocal, safeLocalLineThread, safeLocalStarAccent, lineRgbDisciplinedMotion],
        displayElementOrder: [archGroup.modelName, singleLineHorizontal.modelName, star.modelName, treeFlat.modelName, spinner.modelName],
        comparisonBasePassId: "display_palette_color_purpose_motion_holdout",
        changeType: "video_aesthetic_palette_color_purpose_motion_validation_cycle"
      }
    ];
  }).flat();

  return {
    experimentId: `display-quality-review-${paletteProfile}`,
    family: "display_quality_review",
    paletteProfile,
    curriculumStage: "sequence_pattern_validation",
    layeringTaxonomy: ["display_level_quality", "whole_display_balance", "regional_variety"],
    targetSets: [
      { scope: "group", targets: [archGroup] },
      { scope: "model", targets: [star, singleLineHorizontal, spinner, treeFlat] }
    ],
    passes: [
      {
        passId: "empty_baseline",
        compositionPass: "empty_baseline",
        placements: [],
        displayElementOrder: [archGroup.modelName, star.modelName, singleLineHorizontal.modelName, spinner.modelName, treeFlat.modelName]
      },
      {
        passId: "display_balance_foundation",
        compositionPass: "display_review",
        placements: [archFoundation, starFocus, lineAccent],
        displayElementOrder: [archGroup.modelName, star.modelName, singleLineHorizontal.modelName, spinner.modelName, treeFlat.modelName]
      },
      {
        passId: "display_motion_variety",
        compositionPass: "display_review",
        placements: [archFoundation, starFocus, lineAccent, spinnerMotion, treeTexture],
        displayElementOrder: [archGroup.modelName, star.modelName, singleLineHorizontal.modelName, spinner.modelName, treeFlat.modelName],
        comparisonBasePassId: "display_balance_foundation",
        changeType: "display_level_regional_variety_added"
      },
      {
        passId: "display_pacing_balance_revision",
        compositionPass: "display_review",
        placements: [linePacingPulse, archEntrance, starMiddleAnchor, spinnerLateMotion, treeReleaseTexture],
        displayElementOrder: [singleLineHorizontal.modelName, archGroup.modelName, star.modelName, spinner.modelName, treeFlat.modelName],
        comparisonBasePassId: "display_motion_variety",
        changeType: "video_aesthetic_pacing_balance_revision"
      },
      {
        passId: "display_wide_balance_revision",
        compositionPass: "display_review",
        placements: [treeBalanceFill, archFoundation, linePacingPulse, starMiddleAnchor],
        displayElementOrder: [treeFlat.modelName, archGroup.modelName, singleLineHorizontal.modelName, star.modelName, spinner.modelName],
        comparisonBasePassId: "display_balance_foundation",
        changeType: "video_aesthetic_visual_balance_revision"
      },
      {
        passId: "display_section_window_pacing",
        compositionPass: "display_review",
        placements: [archOpeningWindow, lineMiddleWindow, spinnerClosingWindow, starAccentWindow],
        displayElementOrder: [archGroup.modelName, singleLineHorizontal.modelName, spinner.modelName, star.modelName, treeFlat.modelName],
        comparisonBasePassId: "display_motion_variety",
        changeType: "video_aesthetic_section_window_pacing_revision"
      },
      {
        passId: "display_regional_focus_contrast",
        compositionPass: "display_review",
        placements: [archFocusBase, starFocusContrast, lineReleaseAccent],
        displayElementOrder: [archGroup.modelName, star.modelName, singleLineHorizontal.modelName, spinner.modelName, treeFlat.modelName],
        comparisonBasePassId: "display_motion_variety",
        changeType: "video_aesthetic_regional_focus_contrast_revision"
      },
      {
        passId: "display_focal_consistency_repair",
        compositionPass: "display_review",
        placements: [archConsistencyBase, starFocalHold, lineMotionThread],
        displayElementOrder: [archGroup.modelName, star.modelName, singleLineHorizontal.modelName, spinner.modelName, treeFlat.modelName],
        comparisonBasePassId: "display_motion_variety",
        changeType: "video_aesthetic_focal_consistency_repair"
      },
      {
        passId: "display_rgb_color_discipline_repair",
        compositionPass: "display_review",
        placements: [archRgbDisciplineBase, starRgbDisciplinedAccent, lineRgbDisciplinedMotion],
        displayElementOrder: [archGroup.modelName, star.modelName, singleLineHorizontal.modelName, spinner.modelName, treeFlat.modelName],
        comparisonBasePassId: "display_motion_variety",
        changeType: "video_aesthetic_rgb_color_discipline_repair"
      },
      {
        passId: "display_rgb_structure_balance_pacing_repair",
        compositionPass: "display_review",
        placements: [treeRgbStructureBalance, archRgbPacingWindow, lineRgbPacingWindow, starRgbSparseFocalAccent],
        displayElementOrder: [treeFlat.modelName, archGroup.modelName, singleLineHorizontal.modelName, star.modelName, spinner.modelName],
        comparisonBasePassId: "display_rgb_color_discipline_repair",
        changeType: "video_aesthetic_rgb_structure_balance_pacing_repair"
      },
      {
        passId: "display_safe_local_evidence_repair",
        compositionPass: "display_review",
        placements: [safeLocalFoundation, safeLocalLineThread, safeLocalStarAccent, safeLocalTreeFill],
        displayElementOrder: [archGroup.modelName, singleLineHorizontal.modelName, star.modelName, treeFlat.modelName, spinner.modelName],
        comparisonBasePassId: "display_rgb_color_discipline_repair",
        changeType: "video_aesthetic_safe_local_evidence_repair"
      },
      {
        passId: "display_palette_depth_contrast_motion_repair",
        compositionPass: "display_review",
        placements: [depthContextWash, depthArchFrame, depthLineThread, depthStarAccent],
        displayElementOrder: [treeFlat.modelName, archGroup.modelName, singleLineHorizontal.modelName, star.modelName, spinner.modelName],
        comparisonBasePassId: "display_motion_variety",
        changeType: "video_aesthetic_palette_depth_contrast_motion_repair"
      },
      {
        passId: "display_palette_transition_harmony_repair",
        compositionPass: "display_review",
        placements: [transitionBackground, transitionArchWarmEntry, transitionLineBridge, transitionSpinnerCounterpoint, transitionStarAccent],
        displayElementOrder: [treeFlat.modelName, archGroup.modelName, singleLineHorizontal.modelName, spinner.modelName, star.modelName],
        comparisonBasePassId: "display_palette_depth_contrast_motion_repair",
        changeType: "video_aesthetic_palette_transition_harmony_repair"
      },
      {
        passId: "display_palette_spatial_balance_focal_repair",
        compositionPass: "display_review",
        placements: [spatialLeftStructure, spatialRightCounterweight, spatialCenterFocal, spatialLineBridge, spatialSpinnerSupport],
        displayElementOrder: [archGroup.modelName, treeFlat.modelName, star.modelName, singleLineHorizontal.modelName, spinner.modelName],
        comparisonBasePassId: "display_palette_transition_harmony_repair",
        changeType: "video_aesthetic_palette_spatial_balance_focal_repair"
      },
      {
        passId: "display_palette_section_pacing_consistency_repair",
        compositionPass: "display_review",
        placements: [pacingOpeningStructure, pacingMiddleMotion, pacingMiddleFocal, pacingLateCounterweight, pacingReleaseSupport],
        displayElementOrder: [archGroup.modelName, singleLineHorizontal.modelName, star.modelName, treeFlat.modelName, spinner.modelName],
        comparisonBasePassId: "display_palette_spatial_balance_focal_repair",
        changeType: "video_aesthetic_palette_section_pacing_consistency_repair"
      },
      {
        passId: "display_palette_motion_pacing_variation",
        compositionPass: "display_review",
        placements: [pacingOpeningStructure, pacingMiddleMotion, pacingMiddleFocal, pacingReleaseSupport],
        displayElementOrder: [archGroup.modelName, singleLineHorizontal.modelName, star.modelName, spinner.modelName, treeFlat.modelName],
        comparisonBasePassId: "display_palette_section_pacing_consistency_repair",
        changeType: "video_aesthetic_palette_motion_pacing_variation"
      },
      {
        passId: "display_palette_motion_pacing_reprise",
        compositionPass: "display_review",
        placements: [pacingOpeningStructure, pacingMiddleMotion, pacingMiddleFocal, pacingReleaseSupport],
        displayElementOrder: [archGroup.modelName, singleLineHorizontal.modelName, star.modelName, spinner.modelName, treeFlat.modelName],
        comparisonBasePassId: "display_palette_motion_pacing_variation",
        changeType: "video_aesthetic_palette_motion_pacing_reprise"
      },
      {
        passId: "display_palette_motion_pacing_holdout",
        compositionPass: "display_review",
        placements: [pacingOpeningStructure, pacingMiddleMotion, pacingMiddleFocal, pacingReleaseSupport],
        displayElementOrder: [archGroup.modelName, singleLineHorizontal.modelName, star.modelName, spinner.modelName, treeFlat.modelName],
        comparisonBasePassId: "display_palette_motion_pacing_reprise",
        changeType: "video_aesthetic_palette_motion_pacing_holdout"
      },
      {
        passId: "display_palette_motion_depth_holdout",
        compositionPass: "display_review",
        placements: [depthContextWash, depthLineThread, pacingMiddleFocal, pacingReleaseSupport],
        displayElementOrder: [treeFlat.modelName, singleLineHorizontal.modelName, star.modelName, spinner.modelName, archGroup.modelName],
        comparisonBasePassId: "display_palette_motion_pacing_holdout",
        changeType: "video_aesthetic_palette_motion_depth_holdout"
      },
      {
        passId: "display_palette_spatial_negative_space",
        compositionPass: "display_review",
        placements: [spatialLeftStructure, spatialCenterFocal, spatialLineBridge, safeLocalStarAccent],
        displayElementOrder: [archGroup.modelName, star.modelName, singleLineHorizontal.modelName, treeFlat.modelName, spinner.modelName],
        comparisonBasePassId: "display_palette_spatial_balance_focal_repair",
        changeType: "video_aesthetic_palette_spatial_negative_space"
      },
      {
        passId: "display_palette_spatial_negative_space_reprise",
        compositionPass: "display_review",
        placements: [spatialLeftStructure, spatialCenterFocal, spatialLineBridge, safeLocalStarAccent],
        displayElementOrder: [archGroup.modelName, star.modelName, singleLineHorizontal.modelName, treeFlat.modelName, spinner.modelName],
        comparisonBasePassId: "display_palette_spatial_negative_space",
        changeType: "video_aesthetic_palette_spatial_negative_space_reprise"
      },
      {
        passId: "display_palette_spatial_negative_space_holdout",
        compositionPass: "display_review",
        placements: [spatialLeftStructure, spatialCenterFocal, spatialLineBridge, safeLocalStarAccent],
        displayElementOrder: [archGroup.modelName, star.modelName, singleLineHorizontal.modelName, treeFlat.modelName, spinner.modelName],
        comparisonBasePassId: "display_palette_spatial_negative_space_reprise",
        changeType: "video_aesthetic_palette_spatial_negative_space_holdout"
      },
      {
        passId: "display_palette_spatial_focal_holdout",
        compositionPass: "display_review",
        placements: [spatialLeftStructure, spatialCenterFocal, safeLocalLineThread, safeLocalStarAccent],
        displayElementOrder: [archGroup.modelName, star.modelName, singleLineHorizontal.modelName, treeFlat.modelName, spinner.modelName],
        comparisonBasePassId: "display_palette_spatial_negative_space_holdout",
        changeType: "video_aesthetic_palette_spatial_focal_holdout"
      },
      {
        passId: "display_palette_color_purpose_contrast_holdout",
        compositionPass: "display_review",
        placements: [archRgbDisciplineBase, starRgbDisciplinedAccent, lineRgbDisciplinedMotion],
        displayElementOrder: [archGroup.modelName, star.modelName, singleLineHorizontal.modelName, treeFlat.modelName, spinner.modelName],
        comparisonBasePassId: "display_palette_spatial_focal_holdout",
        changeType: "video_aesthetic_palette_color_purpose_contrast_holdout"
      },
      {
        passId: "display_palette_color_purpose_motion_holdout",
        compositionPass: "display_review",
        placements: [spatialLeftStructure, spatialCenterFocal, safeLocalLineThread, safeLocalStarAccent, lineRgbDisciplinedMotion],
        displayElementOrder: [archGroup.modelName, singleLineHorizontal.modelName, star.modelName, treeFlat.modelName, spinner.modelName],
        comparisonBasePassId: "display_palette_spatial_focal_holdout",
        changeType: "video_aesthetic_palette_color_purpose_motion_holdout"
      },
      {
        passId: "display_palette_motion_pacing_validation",
        compositionPass: "display_review",
        placements: [pacingOpeningStructure, pacingMiddleMotion, pacingMiddleFocal, pacingReleaseSupport],
        displayElementOrder: [archGroup.modelName, singleLineHorizontal.modelName, star.modelName, spinner.modelName, treeFlat.modelName],
        comparisonBasePassId: "display_palette_motion_pacing_holdout",
        changeType: "video_aesthetic_palette_motion_pacing_validation"
      },
      {
        passId: "display_palette_spatial_negative_space_validation",
        compositionPass: "display_review",
        placements: [spatialLeftStructure, spatialCenterFocal, spatialLineBridge, safeLocalStarAccent],
        displayElementOrder: [archGroup.modelName, star.modelName, singleLineHorizontal.modelName, treeFlat.modelName, spinner.modelName],
        comparisonBasePassId: "display_palette_spatial_negative_space_holdout",
        changeType: "video_aesthetic_palette_spatial_negative_space_validation"
      },
      {
        passId: "display_palette_spatial_focal_validation",
        compositionPass: "display_review",
        placements: [spatialLeftStructure, spatialCenterFocal, safeLocalLineThread, safeLocalStarAccent],
        displayElementOrder: [archGroup.modelName, star.modelName, singleLineHorizontal.modelName, treeFlat.modelName, spinner.modelName],
        comparisonBasePassId: "display_palette_spatial_focal_holdout",
        changeType: "video_aesthetic_palette_spatial_focal_validation"
      },
      {
        passId: "display_palette_color_purpose_motion_validation",
        compositionPass: "display_review",
        placements: [spatialLeftStructure, spatialCenterFocal, safeLocalLineThread, safeLocalStarAccent, lineRgbDisciplinedMotion],
        displayElementOrder: [archGroup.modelName, singleLineHorizontal.modelName, star.modelName, treeFlat.modelName, spinner.modelName],
        comparisonBasePassId: "display_palette_color_purpose_motion_holdout",
        changeType: "video_aesthetic_palette_color_purpose_motion_validation"
      },
      ...generatedValidationPasses,
      {
        passId: "display_palette_transition_motion_bridge",
        compositionPass: "display_review",
        placements: [transitionBackground, transitionArchWarmEntry, transitionLineBridge, transitionStarAccent],
        displayElementOrder: [treeFlat.modelName, archGroup.modelName, singleLineHorizontal.modelName, spinner.modelName, star.modelName],
        comparisonBasePassId: "display_palette_transition_harmony_repair",
        changeType: "video_aesthetic_palette_transition_motion_bridge"
      }
    ]
  };
}

function makeMusicStructureReviewExperiment({ paletteProfile, singleLineHorizontal, archGroup, star, spinner }) {
  const sectionBuild = placement({
    id: `mq-${paletteProfile}-section-build`,
    target: archGroup,
    targetScope: "group",
    effectName: "Bars",
    compositionPass: "music_review",
    layerIndex: 0,
    startMs: 0,
    endMs: 6000,
    effectSettings: { direction: "up", cycles: 2 },
    layerSettings: paletteLayerSettings(paletteProfile, "structure", { mixMethod: "Normal" }),
    layerIntent: {
      blendRole: "foundation",
      colorPurpose: "structure",
      musicRole: {
        energy: "section_build",
        timingContext: {
          phrase: "intro_phrase_a"
        }
      }
    }
  });
  const beatPulse = placement({
    id: `mq-${paletteProfile}-beat-pulse`,
    target: singleLineHorizontal,
    targetScope: "model",
    effectName: "SingleStrand",
    compositionPass: "music_review",
    layerIndex: 1,
    startMs: 1000,
    endMs: 6000,
    effectSettings: { effect: "Chase", cycles: 4, colorSpeed: 6 },
    layerSettings: paletteLayerSettings(paletteProfile, "structure_motion_support", { mixMethod: "Normal" }),
    layerIntent: {
      blendRole: "beat_pulse",
      colorPurpose: "structure_motion_support",
      musicRole: {
        beat: "four_count_pulse",
        timingContext: {
          beat: "beat_grid_4"
        }
      }
    }
  });
  const lyricAccent = placement({
    id: `mq-${paletteProfile}-lyric-accent`,
    target: star,
    targetScope: "model",
    effectName: "Color Wash",
    compositionPass: "music_review",
    layerIndex: 2,
    startMs: 2500,
    endMs: 4200,
    effectSettings: { cycles: 1, circularPalette: true },
    layerSettings: paletteLayerSettings(paletteProfile, "warm_focal_accent", { mixMethod: "Normal" }),
    layerIntent: {
      blendRole: "lyric_accent",
      colorPurpose: "warm_focal_accent",
      musicRole: {
        lyric: "hook_keyword",
        accent: "lyric_hit",
        timingContext: {
          lyric: "hook_keyword",
          accent: "vocal_accent"
        }
      }
    }
  });
  const accentMotion = placement({
    id: `mq-${paletteProfile}-accent-motion`,
    target: spinner,
    targetScope: "model",
    effectName: "Pinwheel",
    compositionPass: "music_review",
    layerIndex: 3,
    startMs: 4200,
    endMs: 6000,
    effectSettings: { arms: 4, twists: 1, rotation: 20 },
    layerSettings: paletteLayerSettings(paletteProfile, "cool_motion_accent", { mixMethod: "Normal" }),
    layerIntent: {
      blendRole: "accent_motion",
      colorPurpose: "cool_motion_accent",
      musicRole: {
        accent: "section_turnaround",
        timingContext: {
          accent: "section_turnaround"
        }
      }
    }
  });
  const energyArcOpening = placement({
    id: `mq-${paletteProfile}-energy-arc-opening`,
    target: archGroup,
    targetScope: "group",
    effectName: "Bars",
    compositionPass: "music_review",
    layerIndex: 0,
    startMs: 0,
    endMs: 2200,
    effectSettings: { direction: "up", cycles: 1 },
    layerSettings: paletteLayerSettings(paletteProfile, "structure", { mixMethod: "Normal", brightness: 48 }),
    layerIntent: {
      blendRole: "opening_section_anchor",
      colorPurpose: "structure",
      musicRole: {
        energy: "intro_low_energy",
        sectionRole: "opening",
        timingContext: {
          section: "intro",
          phrase: "phrase_a"
        }
      }
    }
  });
  const energyArcBuild = placement({
    id: `mq-${paletteProfile}-energy-arc-build`,
    target: singleLineHorizontal,
    targetScope: "model",
    effectName: "SingleStrand",
    compositionPass: "music_review",
    layerIndex: 1,
    startMs: 1300,
    endMs: 4700,
    effectSettings: { effect: "Chase", cycles: 7, colorSpeed: 8 },
    layerSettings: paletteLayerSettings(paletteProfile, "cool_motion_accent", { mixMethod: "Normal", brightness: 70 }),
    layerIntent: {
      blendRole: "middle_phrase_motion_build",
      colorPurpose: "cool_motion_accent",
      musicRole: {
        energy: "phrase_build",
        beat: "four_count_pulse",
        timingContext: {
          section: "build",
          phrase: "phrase_b",
          beat: "beat_grid_4"
        }
      }
    }
  });
  const energyArcRelease = placement({
    id: `mq-${paletteProfile}-energy-arc-release`,
    target: star,
    targetScope: "model",
    effectName: "Color Wash",
    compositionPass: "music_review",
    layerIndex: 2,
    startMs: 4300,
    endMs: 6000,
    effectSettings: { cycles: 1, circularPalette: true },
    layerSettings: paletteLayerSettings(paletteProfile, "warm_focal_accent", { mixMethod: "Normal", brightness: 62 }),
    layerIntent: {
      blendRole: "closing_phrase_release",
      colorPurpose: "warm_focal_accent",
      musicRole: {
        energy: "release",
        accent: "section_downbeat",
        timingContext: {
          section: "release",
          phrase: "phrase_c",
          accent: "downbeat_release"
        }
      }
    }
  });
  const energyArcTurnaround = placement({
    id: `mq-${paletteProfile}-energy-arc-turnaround`,
    target: spinner,
    targetScope: "model",
    effectName: "Pinwheel",
    compositionPass: "music_review",
    layerIndex: 3,
    startMs: 3000,
    endMs: 5400,
    effectSettings: { arms: 4, twists: 1, rotation: 30 },
    layerSettings: paletteLayerSettings(paletteProfile, "warm_focal_accent", { mixMethod: "Normal", brightness: 48 }),
    layerIntent: {
      blendRole: "section_turnaround_motion",
      colorPurpose: "warm_focal_accent",
      musicRole: {
        energy: "turnaround_lift",
        accent: "section_turnaround",
        timingContext: {
          section: "release",
          accent: "section_turnaround"
        }
      }
    }
  });
  const motifOpening = placement({
    id: `mq-${paletteProfile}-motif-opening`,
    target: archGroup,
    targetScope: "group",
    effectName: "Marquee",
    compositionPass: "music_review",
    layerIndex: 0,
    startMs: 0,
    endMs: 1800,
    effectSettings: { cycles: 3 },
    layerSettings: paletteLayerSettings(paletteProfile, "structure", { mixMethod: "Normal", brightness: 52 }),
    layerIntent: {
      blendRole: "motif_statement",
      colorPurpose: "structure",
      musicRole: {
        motif: "statement",
        timingContext: {
          section: "verse",
          phrase: "motif_a"
        }
      }
    }
  });
  const motifReprise = placement({
    id: `mq-${paletteProfile}-motif-reprise`,
    target: archGroup,
    targetScope: "group",
    effectName: "Marquee",
    compositionPass: "music_review",
    layerIndex: 1,
    startMs: 3000,
    endMs: 4800,
    effectSettings: { cycles: 5 },
    layerSettings: paletteLayerSettings(paletteProfile, "structure_motion_support", { mixMethod: "Normal", brightness: 60 }),
    layerIntent: {
      blendRole: "motif_reprise_variation",
      colorPurpose: "structure_motion_support",
      musicRole: {
        motif: "reprise_variation",
        timingContext: {
          section: "chorus",
          phrase: "motif_a_reprise"
        }
      }
    }
  });
  const motifSupport = placement({
    id: `mq-${paletteProfile}-motif-support`,
    target: spinner,
    targetScope: "model",
    effectName: "Pinwheel",
    compositionPass: "music_review",
    layerIndex: 2,
    startMs: 4200,
    endMs: 6000,
    effectSettings: { arms: 4, twists: 1, rotation: 24 },
    layerSettings: paletteLayerSettings(paletteProfile, "warm_focal_accent", { mixMethod: "Normal", brightness: 46 }),
    layerIntent: {
      blendRole: "motif_release_support",
      colorPurpose: "warm_focal_accent",
      musicRole: {
        motif: "supporting_variation",
        accent: "chorus_tail",
        timingContext: {
          section: "chorus",
          accent: "tail_accent"
        }
      }
    }
  });
  const lyricPhraseSetup = placement({
    id: `mq-${paletteProfile}-lyric-phrase-setup`,
    target: archGroup,
    targetScope: "group",
    effectName: "Color Wash",
    compositionPass: "music_review",
    layerIndex: 0,
    startMs: 0,
    endMs: 2600,
    effectSettings: { cycles: 1, circularPalette: false },
    layerSettings: paletteLayerSettings(paletteProfile, "structure", { mixMethod: "Normal", brightness: 46 }),
    layerIntent: {
      blendRole: "lyric_phrase_context",
      colorPurpose: "structure",
      musicRole: {
        lyric: "phrase_setup",
        timingContext: {
          lyric: "line_setup",
          phrase: "lyric_phrase_a"
        }
      }
    }
  });
  const lyricPhraseHit = placement({
    id: `mq-${paletteProfile}-lyric-phrase-hit`,
    target: star,
    targetScope: "model",
    effectName: "Pinwheel",
    compositionPass: "music_review",
    layerIndex: 1,
    startMs: 2400,
    endMs: 3900,
    effectSettings: { arms: 5, twists: 1, rotation: 26 },
    layerSettings: paletteLayerSettings(paletteProfile, "warm_focal_accent", { mixMethod: "Normal", brightness: 60 }),
    layerIntent: {
      blendRole: "lyric_keyword_focal_hit",
      colorPurpose: "warm_focal_accent",
      musicRole: {
        lyric: "keyword_hit",
        accent: "vocal_hit",
        timingContext: {
          lyric: "keyword",
          accent: "vocal_hit"
        }
      }
    }
  });
  const lyricPhraseRelease = placement({
    id: `mq-${paletteProfile}-lyric-phrase-release`,
    target: singleLineHorizontal,
    targetScope: "model",
    effectName: "SingleStrand",
    compositionPass: "music_review",
    layerIndex: 2,
    startMs: 3800,
    endMs: 6000,
    effectSettings: { effect: "Chase", cycles: 4, colorSpeed: 5 },
    layerSettings: paletteLayerSettings(paletteProfile, "cool_motion_accent", { mixMethod: "Normal", brightness: 58 }),
    layerIntent: {
      blendRole: "lyric_phrase_release_motion",
      colorPurpose: "cool_motion_accent",
      musicRole: {
        lyric: "line_release",
        energy: "release",
        timingContext: {
          lyric: "line_release",
          phrase: "lyric_phrase_resolution"
        }
      }
    }
  });

  return {
    experimentId: `music-structure-review-${paletteProfile}`,
    family: "music_structure_review",
    paletteProfile,
    curriculumStage: "sequence_pattern_validation",
    layeringTaxonomy: ["music_structure_alignment", "section_energy", "beat_phrase_lyric_accent"],
    targetSets: [
      { scope: "group", targets: [archGroup] },
      { scope: "model", targets: [singleLineHorizontal, star, spinner] }
    ],
    passes: [
      {
        passId: "empty_baseline",
        compositionPass: "empty_baseline",
        placements: [],
        displayElementOrder: [archGroup.modelName, singleLineHorizontal.modelName, star.modelName, spinner.modelName]
      },
      {
        passId: "section_phrase_energy",
        compositionPass: "music_review",
        placements: [sectionBuild, beatPulse],
        displayElementOrder: [archGroup.modelName, singleLineHorizontal.modelName, star.modelName, spinner.modelName]
      },
      {
        passId: "lyric_accent_response",
        compositionPass: "music_review",
        placements: [sectionBuild, beatPulse, lyricAccent, accentMotion],
        displayElementOrder: [archGroup.modelName, singleLineHorizontal.modelName, star.modelName, spinner.modelName],
        comparisonBasePassId: "section_phrase_energy",
        changeType: "music_lyric_accent_added"
      },
      {
        passId: "multi_section_energy_arc",
        compositionPass: "music_review",
        placements: [energyArcOpening, energyArcBuild, energyArcRelease, energyArcTurnaround],
        displayElementOrder: [archGroup.modelName, singleLineHorizontal.modelName, star.modelName, spinner.modelName],
        comparisonBasePassId: "section_phrase_energy",
        changeType: "music_multi_section_energy_arc"
      },
      {
        passId: "motif_reprise_variation",
        compositionPass: "music_review",
        placements: [motifOpening, motifReprise, motifSupport],
        displayElementOrder: [archGroup.modelName, spinner.modelName, singleLineHorizontal.modelName, star.modelName],
        comparisonBasePassId: "multi_section_energy_arc",
        changeType: "music_motif_reprise_variation"
      },
      {
        passId: "lyric_phrase_release",
        compositionPass: "music_review",
        placements: [lyricPhraseSetup, lyricPhraseHit, lyricPhraseRelease],
        displayElementOrder: [archGroup.modelName, star.modelName, singleLineHorizontal.modelName, spinner.modelName],
        comparisonBasePassId: "motif_reprise_variation",
        changeType: "music_lyric_phrase_release"
      }
    ]
  };
}

function makeSettingSensitivityEdgeProbeExperiment({ paletteProfile, target }) {
  const foundation = placementFromSample({
    id: `ss-${paletteProfile}-foundation`,
    target,
    targetScope: "group",
    compositionPass: "foundation",
    layerIndex: 0,
    layerSettings: { mixMethod: "Normal" },
    sampleRef: {
      manifestPath: "scripts/sequencer-render-training/manifests/bars-archgroup-expanded-sweep-v1.json",
      sampleId: "bars-archgroup-left-striped-v1"
    },
    layerIntent: { blendRole: "foundation", visualProbe: "edge_rich_base" }
  });
  const structure = placementFromSample({
    id: `ss-${paletteProfile}-structure`,
    target,
    targetScope: "group",
    compositionPass: "structure",
    layerIndex: 1,
    layerSettings: { mixMethod: "Normal" },
    sampleRef: {
      manifestPath: "scripts/sequencer-render-training/manifests/marquee-archgroup-palette-behavior-anchors-v1.json",
      sampleId: "marquee-archgroup-skip-8-anchor-v1"
    },
    layerIntent: { blendRole: "structure", visualProbe: "sparse_edges" }
  });
  const detail = placementFromSample({
    id: `ss-${paletteProfile}-detail`,
    target,
    targetScope: "group",
    compositionPass: "detail",
    layerIndex: 2,
    layerSettings: { mixMethod: "Normal" },
    sampleRef: {
      manifestPath: "scripts/sequencer-render-training/manifests/marquee-archgroup-palette-behavior-anchors-v1.json",
      sampleId: "marquee-archgroup-speed-9-anchor-v1"
    },
    layerIntent: { blendRole: "detail", visualProbe: "fast_sparse_motion" }
  });
  const canvasFoundation = {
    ...foundation,
    placementId: `ss-${paletteProfile}-foundation-canvas-variant`,
    layerSettings: { ...foundation.layerSettings, canvas: true }
  };
  const additiveStructure = {
    ...structure,
    placementId: `ss-${paletteProfile}-structure-additive-variant`,
    layerSettings: { ...structure.layerSettings, mixMethod: "Additive" }
  };
  const thresholdStructure = {
    ...structure,
    placementId: `ss-${paletteProfile}-structure-threshold-variant`,
    layerSettings: { ...structure.layerSettings, mixThreshold: 45 }
  };
  const blurredStructure = {
    ...structure,
    placementId: `ss-${paletteProfile}-structure-blur-variant`,
    layerSettings: { ...structure.layerSettings, blur: 6 }
  };
  const persistentDetail = {
    ...detail,
    placementId: `ss-${paletteProfile}-detail-persistent-variant`,
    layerSettings: { ...detail.layerSettings, persistentOverlay: true }
  };
  const fadedStructure = {
    ...structure,
    placementId: `ss-${paletteProfile}-structure-fade-variant`,
    layerSettings: { ...structure.layerSettings, fadeIn: "1.25", fadeOut: "1.25" }
  };

  return {
    experimentId: `setting-sensitivity-edge-probe-${paletteProfile}`,
    family: "setting_sensitivity_edge_probe",
    paletteProfile,
    curriculumStage: "setting_sensitivity_survey",
    layeringTaxonomy: ["same_target_layer_stack", "render_setting_sensitivity", "edge_rich_overlap"],
    targetSets: [{ scope: "group", targets: [target] }],
    passes: [
      {
        passId: "empty_baseline",
        compositionPass: "empty_baseline",
        placements: [],
        displayElementOrder: [target.modelName]
      },
      {
        passId: "edge_stack_default",
        compositionPass: "detail",
        placements: [foundation, structure, detail],
        displayElementOrder: [target.modelName]
      },
      {
        passId: "foundation_canvas_variant",
        compositionPass: "render_setting_variant",
        placements: [canvasFoundation, structure, detail],
        displayElementOrder: [target.modelName],
        comparisonBasePassId: "edge_stack_default",
        changeType: "layer_render_setting"
      },
      {
        passId: "structure_additive_mix_variant",
        compositionPass: "render_setting_variant",
        placements: [foundation, additiveStructure, detail],
        displayElementOrder: [target.modelName],
        comparisonBasePassId: "edge_stack_default",
        changeType: "layer_render_setting"
      },
      {
        passId: "structure_mix_threshold_variant",
        compositionPass: "render_setting_variant",
        placements: [foundation, thresholdStructure, detail],
        displayElementOrder: [target.modelName],
        comparisonBasePassId: "edge_stack_default",
        changeType: "layer_render_setting"
      },
      {
        passId: "structure_blur_variant",
        compositionPass: "render_setting_variant",
        placements: [foundation, blurredStructure, detail],
        displayElementOrder: [target.modelName],
        comparisonBasePassId: "edge_stack_default",
        changeType: "layer_render_setting"
      },
      {
        passId: "detail_persistent_variant",
        compositionPass: "render_setting_variant",
        placements: [foundation, structure, persistentDetail],
        displayElementOrder: [target.modelName],
        comparisonBasePassId: "edge_stack_default",
        changeType: "layer_render_setting"
      },
      {
        passId: "structure_fade_variant",
        compositionPass: "render_setting_variant",
        placements: [foundation, fadedStructure, detail],
        displayElementOrder: [target.modelName],
        comparisonBasePassId: "edge_stack_default",
        changeType: "layer_render_setting"
      }
    ]
  };
}

function makeSettingAttributionProbeExperiment({ paletteProfile, target }) {
  const structure = placementFromSample({
    id: `sa-${paletteProfile}-structure`,
    target,
    targetScope: "model",
    compositionPass: "structure",
    layerIndex: 0,
    layerSettings: { mixMethod: "Normal" },
    sampleRef: {
      manifestPath: "scripts/sequencer-render-training/manifests/marquee-singlelinehorizontal-expanded-sweep-v1.json",
      sampleId: "marquee-singlelinehorizontal-segmented-v1"
    },
    layerIntent: {
      blendRole: "structure",
      visualProbe: "single_line_segmented_edges",
      attributionRole: "baseline_effect_sample"
    }
  });
  const structureBandSizeEffect = effectSettingVariant(structure, {
    id: `sa-${paletteProfile}-structure-band-size-effect`,
    settingName: "bandSize",
    variantValue: 7,
    visualProbe: "single_line_band_size_change"
  });
  const structureSkipSizeEffect = effectSettingVariant(structure, {
    id: `sa-${paletteProfile}-structure-skip-size-effect`,
    settingName: "skipSize",
    variantValue: 1,
    visualProbe: "single_line_skip_size_change"
  });
  const structureThicknessEffect = effectSettingVariant(structure, {
    id: `sa-${paletteProfile}-structure-thickness-effect`,
    settingName: "thickness",
    variantValue: 4,
    visualProbe: "single_line_thickness_change"
  });
  const structureReverseEffect = effectSettingVariant(structure, {
    id: `sa-${paletteProfile}-structure-reverse-effect`,
    settingName: "reverse",
    variantValue: true,
    visualProbe: "single_line_reverse_motion"
  });
  const structureSpeedEffect = effectSettingVariant(structure, {
    id: `sa-${paletteProfile}-structure-speed-effect`,
    settingName: "speed",
    variantValue: 7,
    visualProbe: "single_line_speed_change"
  });
  const detail = placementFromSample({
    id: `sa-${paletteProfile}-detail`,
    target,
    targetScope: "model",
    compositionPass: "detail",
    layerIndex: 1,
    layerSettings: { mixMethod: "Normal" },
    sampleRef: {
      manifestPath: "scripts/sequencer-render-training/manifests/twinkle-singlelinehorizontal-expanded-sweep-v1.json",
      sampleId: "twinkle-singlelinehorizontal-sparse-v1"
    },
    layerIntent: {
      blendRole: "detail",
      visualProbe: "sparse_texture_overlay",
      attributionRole: "incremental_overlay"
    }
  });
  const detailCountEffect = effectSettingVariant(detail, {
    id: `sa-${paletteProfile}-detail-count-effect`,
    settingName: "count",
    variantValue: 9,
    visualProbe: "dense_texture_count_change"
  });
  const detailStepsEffect = effectSettingVariant(detail, {
    id: `sa-${paletteProfile}-detail-steps-effect`,
    settingName: "steps",
    variantValue: 40,
    visualProbe: "dense_texture_steps_change"
  });
  const additiveDetail = {
    ...detail,
    placementId: `sa-${paletteProfile}-detail-additive-layer`,
    layerSettings: { ...detail.layerSettings, mixMethod: "Additive" },
    layerIntent: {
      ...detail.layerIntent,
      attributionRole: "layer_setting_ab_variant"
    }
  };
  const thresholdDetail = {
    ...detail,
    placementId: `sa-${paletteProfile}-detail-threshold-layer`,
    layerSettings: { ...detail.layerSettings, mixThreshold: 45 },
    layerIntent: {
      ...detail.layerIntent,
      attributionRole: "layer_setting_ab_variant"
    }
  };
  const blurredStructure = {
    ...structure,
    placementId: `sa-${paletteProfile}-structure-blur-layer`,
    layerSettings: { ...structure.layerSettings, blur: 6 },
    layerIntent: {
      ...structure.layerIntent,
      attributionRole: "layer_setting_ab_variant"
    }
  };
  const fadedStructure = {
    ...structure,
    placementId: `sa-${paletteProfile}-structure-fade-layer`,
    layerSettings: { ...structure.layerSettings, fadeIn: "1.25", fadeOut: "1.25" },
    layerIntent: {
      ...structure.layerIntent,
      attributionRole: "layer_setting_ab_variant"
    }
  };

  return {
    experimentId: `setting-attribution-probe-${paletteProfile}`,
    family: "setting_attribution_probe",
    paletteProfile,
    curriculumStage: "setting_sensitivity_survey",
    designType: "ab_and_fractional_factorial",
    layeringTaxonomy: [
      "effect_setting_ab",
      "layer_render_setting_ab",
      "incremental_overlay_attribution",
      "single_variable_change"
    ],
    targetSets: [{ scope: "model", targets: [target] }],
    passes: [
      {
        passId: "empty_baseline",
        compositionPass: "empty_baseline",
        placements: [],
        displayElementOrder: [target.modelName]
      },
      {
        passId: "structure_sparse_baseline",
        compositionPass: "structure",
        placements: [structure],
        displayElementOrder: [target.modelName]
      },
      {
        passId: "structure_effect_band_size_ab",
        compositionPass: "effect_setting_variant",
        placements: [structureBandSizeEffect],
        displayElementOrder: [target.modelName],
        comparisonBasePassId: "structure_sparse_baseline",
        changeType: "effect_setting"
      },
      {
        passId: "structure_effect_skip_size_ab",
        compositionPass: "effect_setting_variant",
        placements: [structureSkipSizeEffect],
        displayElementOrder: [target.modelName],
        comparisonBasePassId: "structure_sparse_baseline",
        changeType: "effect_setting"
      },
      {
        passId: "structure_effect_thickness_ab",
        compositionPass: "effect_setting_variant",
        placements: [structureThicknessEffect],
        displayElementOrder: [target.modelName],
        comparisonBasePassId: "structure_sparse_baseline",
        changeType: "effect_setting"
      },
      {
        passId: "structure_effect_reverse_ab",
        compositionPass: "effect_setting_variant",
        placements: [structureReverseEffect],
        displayElementOrder: [target.modelName],
        comparisonBasePassId: "structure_sparse_baseline",
        changeType: "effect_setting"
      },
      {
        passId: "structure_effect_speed_ab",
        compositionPass: "effect_setting_variant",
        placements: [structureSpeedEffect],
        displayElementOrder: [target.modelName],
        comparisonBasePassId: "structure_sparse_baseline",
        changeType: "effect_setting"
      },
      {
        passId: "structure_blur_layer_ab",
        compositionPass: "render_setting_variant",
        placements: [blurredStructure],
        displayElementOrder: [target.modelName],
        comparisonBasePassId: "structure_sparse_baseline",
        changeType: "layer_render_setting"
      },
      {
        passId: "structure_fade_layer_ab",
        compositionPass: "render_setting_variant",
        placements: [fadedStructure],
        displayElementOrder: [target.modelName],
        comparisonBasePassId: "structure_sparse_baseline",
        changeType: "layer_render_setting"
      },
      {
        passId: "structure_plus_sparse_detail",
        compositionPass: "detail",
        placements: [structure, detail],
        displayElementOrder: [target.modelName],
        comparisonBasePassId: "structure_sparse_baseline",
        changeType: "layer_added"
      },
      {
        passId: "detail_effect_count_ab",
        compositionPass: "effect_setting_variant",
        placements: [structure, detailCountEffect],
        displayElementOrder: [target.modelName],
        comparisonBasePassId: "structure_plus_sparse_detail",
        changeType: "effect_setting"
      },
      {
        passId: "detail_effect_steps_ab",
        compositionPass: "effect_setting_variant",
        placements: [structure, detailStepsEffect],
        displayElementOrder: [target.modelName],
        comparisonBasePassId: "structure_plus_sparse_detail",
        changeType: "effect_setting"
      },
      {
        passId: "detail_additive_layer_ab",
        compositionPass: "render_setting_variant",
        placements: [structure, additiveDetail],
        displayElementOrder: [target.modelName],
        comparisonBasePassId: "structure_plus_sparse_detail",
        changeType: "layer_render_setting"
      },
      {
        passId: "detail_mix_threshold_layer_ab",
        compositionPass: "render_setting_variant",
        placements: [structure, thresholdDetail],
        displayElementOrder: [target.modelName],
        comparisonBasePassId: "structure_plus_sparse_detail",
        changeType: "layer_render_setting"
      }
    ]
  };
}

function makeLowMovementSettingGeometryProbeExperiment({ paletteProfile, target }) {
  const structure = placement({
    id: `lm-${paletteProfile}-${target.key}-structure`,
    target,
    targetScope: "model",
    effectName: "Marquee",
    compositionPass: "structure",
    layerIndex: 0,
    effectSettings: {
      renderStyle: target.modelType === "single_line" ? "Single Line" : "Default",
      bandSize: 3,
      skipSize: 4,
      thickness: 2,
      stagger: 0,
      speed: 5,
      start: 0,
      reverse: false
    },
    layerSettings: { mixMethod: "Normal" },
    layerIntent: {
      blendRole: "structure",
      visualProbe: "alternate_geometry_segmented_marquee",
      attributionRole: "baseline_effect_sample",
      retestReason: "single_line_horizontal_no_or_low_metric_movement"
    }
  });
  const thicknessEffect = effectSettingVariant(structure, {
    id: `lm-${paletteProfile}-${target.key}-structure-thickness-effect`,
    settingName: "thickness",
    variantValue: 4,
    visualProbe: "alternate_geometry_thickness_change"
  });
  const reverseEffect = effectSettingVariant(structure, {
    id: `lm-${paletteProfile}-${target.key}-structure-reverse-effect`,
    settingName: "reverse",
    variantValue: true,
    visualProbe: "alternate_geometry_reverse_motion"
  });
  const speedEffect = effectSettingVariant(structure, {
    id: `lm-${paletteProfile}-${target.key}-structure-speed-effect`,
    settingName: "speed",
    variantValue: 7,
    visualProbe: "alternate_geometry_speed_positive_control"
  });

  return {
    experimentId: `low-movement-setting-geometry-probe-${target.key}-${paletteProfile}`,
    family: "low_movement_setting_geometry_probe",
    paletteProfile,
    curriculumStage: "setting_sensitivity_survey",
    designType: "single_parameter_alternate_geometry",
    layeringTaxonomy: [
      "effect_setting_ab",
      "alternate_geometry_retest",
      "single_variable_change"
    ],
    targetSets: [{ scope: "model", targets: [target] }],
    passes: [
      {
        passId: "empty_baseline",
        compositionPass: "empty_baseline",
        placements: [],
        displayElementOrder: [target.modelName]
      },
      {
        passId: "structure_sparse_baseline",
        compositionPass: "structure",
        placements: [structure],
        displayElementOrder: [target.modelName]
      },
      {
        passId: "structure_effect_thickness_ab",
        compositionPass: "effect_setting_variant",
        placements: [thicknessEffect],
        displayElementOrder: [target.modelName],
        comparisonBasePassId: "structure_sparse_baseline",
        changeType: "effect_setting"
      },
      {
        passId: "structure_effect_reverse_ab",
        compositionPass: "effect_setting_variant",
        placements: [reverseEffect],
        displayElementOrder: [target.modelName],
        comparisonBasePassId: "structure_sparse_baseline",
        changeType: "effect_setting"
      },
      {
        passId: "structure_effect_speed_ab",
        compositionPass: "effect_setting_variant",
        placements: [speedEffect],
        displayElementOrder: [target.modelName],
        comparisonBasePassId: "structure_sparse_baseline",
        changeType: "effect_setting"
      }
    ]
  };
}

function collectUnsupportedRenderSettings(supportedLayerSettings = []) {
  const supported = new Set(supportedLayerSettings);
  return RENDER_SETTING_CANDIDATES
    .filter((setting) => !supported.has(setting))
    .map((setting) => ({
      settingName: setting,
      status: "api_support_unverified",
      recommendation: "Audit owned xLightsDesigner API support before execution."
    }));
}

function normalizePriorRows(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload.flatMap(normalizePriorRows);
  if (Array.isArray(payload.priors)) return payload.priors;
  if (Array.isArray(payload.learnings)) return payload.learnings;
  if (payload.learningId || payload.coverageKey) return [payload];
  return [];
}

function durablePriorKey(prior) {
  const learningId = String(prior?.learningId || "").trim();
  const coverageKey = String(prior?.coverageKey || "").trim();
  if (!learningId || !coverageKey) return "";
  return `${coverageKey}::${learningId}`;
}

function isDurablePrior(prior) {
  const durabilityStatus = String(prior?.durabilityStatus || prior?.status || "").trim();
  const confidence = Number(prior?.confidence ?? prior?.evidenceSummary?.confidence ?? 0);
  const revalidationReasons = Array.isArray(prior?.revalidationReasons) ? prior.revalidationReasons : [];
  return (
    ["durable", "reusable", "promoted"].includes(durabilityStatus)
    && confidence >= 0.65
    && revalidationReasons.length === 0
  );
}

function buildPriorCoverage(priors = []) {
  const durable = new Map();
  const needsRevalidation = [];
  for (const prior of normalizePriorRows(priors)) {
    const key = durablePriorKey(prior);
    if (!key) continue;
    if (isDurablePrior(prior)) {
      durable.set(key, prior);
    } else {
      needsRevalidation.push(prior);
    }
  }
  return { durable, needsRevalidation };
}

function filterPassesByPriorCoverage(experiment, priorCoverage) {
  const plannedPasses = [];
  const skippedPasses = [];
  for (const pass of experiment.passes || []) {
    const seed = pass.learningSeed || {};
    const key = `${seed.coverageKey || ""}::${seed.learningId || ""}`;
    const durablePrior = priorCoverage.durable.get(key);
    if (durablePrior && seed.revalidationPolicy?.skipWhenDurablePriorExists) {
      skippedPasses.push({
        passId: pass.passId,
        learningId: seed.learningId,
        coverageKey: seed.coverageKey,
        skipReason: "durable_prior_exists",
        priorRef: durablePrior.learningId || ""
      });
      continue;
    }
    plannedPasses.push(pass);
  }
  return {
    ...experiment,
    passes: plannedPasses,
    skippedPasses
  };
}

function coverageKeyForExperiment(experiment) {
  const targetScope = (experiment.targetSets || [])
    .map((set) => set.scope)
    .filter(Boolean)
    .join("+");
  const geometryFamilies = [...new Set((experiment.targetSets || [])
    .flatMap((set) => set.targets || [])
    .map((target) => String(target.analyzerFamily || target.modelType || target.geometryProfile || "").trim())
    .filter(Boolean))]
    .sort()
    .join("+");
  return [
    experiment.family,
    experiment.paletteProfile,
    targetScope || "unknown_scope",
    geometryFamilies || "unknown_geometry"
  ].join("|");
}

function learningSeedForPass(experiment, pass) {
  const changedPlacement = (pass.placements || []).find((row) => row.placementId) || {};
  return {
    learningId: [
      "layer_composition",
      experiment.family,
      experiment.paletteProfile,
      pass.passId
    ].join(":"),
    coverageKey: coverageKeyForExperiment(experiment),
    curriculumStage: experiment.curriculumStage,
    revalidationPolicy: {
      skipWhenDurablePriorExists: true,
      validReasons: [
        "xlights_renderer_version_changed",
        "owned_api_layer_behavior_changed",
        "observation_extractor_changed",
        "canonical_fixture_geometry_changed",
        "prior_confidence_low",
        "conflicting_new_evidence",
        "benchmark_gap_requires_deeper_sampling"
      ]
    },
    evidenceFingerprintInputs: {
      paletteProfile: experiment.paletteProfile,
      family: experiment.family,
      passId: pass.passId,
      changeType: pass.changeType || "baseline_or_incremental",
      targetCount: (pass.placements || []).length,
      changedPlacementEffect: changedPlacement.effectName || "",
      changedLayerIndex: changedPlacement.layerIndex ?? null
    }
  };
}

function attachLearningSeeds(experiment) {
  const next = {
    ...experiment,
    curriculumStage: experiment.curriculumStage || "broad_composition_survey",
    coverageKey: coverageKeyForExperiment(experiment)
  };
  next.passes = (next.passes || []).map((pass) => ({
    ...pass,
    learningSeed: learningSeedForPass(next, pass)
  }));
  return next;
}

function firstTargetKey(experiment) {
  return String(experiment?.targetSets?.[0]?.targets?.[0]?.key || "").trim();
}

function runtimeSelectionForExperiment(experiment, runType) {
  const targetKey = firstTargetKey(experiment);
  const common = {
    includeInSmokeValidation: true,
    includeInFocusedValidation: true,
    includeInOvernightQueue: true,
    includeInExtendedQueue: true
  };
  if (experiment.family === "setting_attribution_probe") {
    return {
      ...common,
      tier: "primary_setting_attribution",
      queueRank: 10,
      budgetWeight: 5,
      selectionRole: "dominant_setting_sensitivity_workhorse",
      reason: "Validated single-parameter A/B shape produces causal effect-setting and layer-setting deltas without multi-setting ambiguity."
    };
  }
  if (experiment.family === "low_movement_setting_geometry_probe" && targetKey === "tree_flat") {
    return {
      ...common,
      tier: "high_value_geometry_retest",
      queueRank: 20,
      budgetWeight: 3,
      selectionRole: "alternate_geometry_width_direction_retest",
      reason: "TreeFlat exposed Marquee thickness and reverse movement that did not appear on SingleLineHorizontal or ArchSingle."
    };
  }
  if (experiment.family === "same_target_layer_stack") {
    return {
      ...common,
      tier: "broad_layer_composition",
      queueRank: 30,
      budgetWeight: 2,
      selectionRole: "same_target_layer_order_and_blend_baseline",
      reason: "Keeps overnight learning grounded in additive layer construction and render-setting effects across stacked layers."
    };
  }
  if (experiment.family === "group_model_interplay") {
    return {
      ...common,
      tier: "group_model_ordering",
      queueRank: 40,
      budgetWeight: 2,
      selectionRole: "group_model_overlap_and_display_order_baseline",
      reason: "Covers broad-to-specific target interaction and display element order effects."
    };
  }
  if (experiment.family === "submodel_structure") {
    return {
      ...common,
      tier: "submodel_structure",
      queueRank: 45,
      budgetWeight: 2,
      selectionRole: "parent_submodel_and_sibling_submodel_baseline",
      reason: "Covers model, submodel, and sibling submodel targeting through the same composition/evidence loop."
    };
  }
  if (experiment.family === "creative_intent_probe") {
    return {
      ...common,
      tier: "creative_intent_probe",
      queueRank: 55,
      budgetWeight: 1,
      selectionRole: "creative_intent_dimension_baseline",
      reason: "Measures deterministic mood, palette, pace, emphasis, style, and negative-space intent signals."
    };
  }
  if (experiment.family === "creative_intent_revision_comparison") {
    return {
      ...common,
      tier: "creative_intent_revision_comparison",
      queueRank: 56,
      budgetWeight: 1,
      selectionRole: "before_after_creative_revision_pair",
      reason: "Measures whether a targeted revision improves creative intent match without degrading readability or adding clutter."
    };
  }
  if (experiment.family === "core_effect_fit") {
    return {
      ...common,
      tier: "core_effect_fit",
      queueRank: 57,
      budgetWeight: 1,
      selectionRole: "single_effect_geometry_fit_baseline",
      reason: "Starts core-effect fit with single-effect probes across line, group, and radial targets."
    };
  }
  if (experiment.family === "expanded_effect_fit") {
    return {
      ...common,
      tier: "expanded_effect_fit",
      queueRank: 58,
      budgetWeight: 1,
      selectionRole: "rgb_effect_model_matrix_expansion",
      reason: "Broadens effect/model fit under RGB-primary palette conditions on currently runnable fixture model families."
    };
  }
  if (experiment.family === "display_quality_review") {
    return {
      ...common,
      tier: "display_quality_review",
      queueRank: 58,
      budgetWeight: 1,
      selectionRole: "whole_display_quality_baseline",
      reason: "Measures whole-display balance, regional variety, foreground/background separation, and motion coherence with dedicated review passes."
    };
  }
  if (experiment.family === "music_structure_review") {
    return {
      ...common,
      tier: "music_structure_review",
      queueRank: 59,
      budgetWeight: 1,
      selectionRole: "music_timing_structure_baseline",
      reason: "Measures section energy, phrase/beat alignment, lyric readability, and accent response with dedicated review passes."
    };
  }
  if (experiment.family === "setting_sensitivity_edge_probe") {
    return {
      ...common,
      tier: "interaction_deepening",
      queueRank: 50,
      budgetWeight: 1,
      selectionRole: "multi_layer_interaction_deepening",
      reason: "Retains edge-rich grouped-arch interaction evidence, but not as the main causal setting-sensitivity path."
    };
  }
  if (experiment.family === "low_movement_setting_geometry_probe" && targetKey === "arch_single") {
    return {
      ...common,
      includeInOvernightQueue: false,
      includeInExtendedQueue: false,
      tier: "deferred_low_yield_retest",
      queueRank: 90,
      budgetWeight: 0,
      selectionRole: "validation_only_low_yield_retest",
      reason: "Smoke evidence matched SingleLineHorizontal for this Marquee retest; keep available for validation/debug, but skip normal overnight learning."
    };
  }
  return {
    ...common,
    tier: "interaction_deepening",
    queueRank: 60,
    budgetWeight: 1,
    selectionRole: "unclassified_deepening",
    reason: "Included after higher-confidence training families."
  };
}

function attachRuntimeSelection(experiment, runType) {
  return {
    ...experiment,
    runtimeSelection: runtimeSelectionForExperiment(experiment, runType)
  };
}

function includeExperimentForRunType(experiment, runType) {
  const selection = experiment.runtimeSelection || runtimeSelectionForExperiment(experiment, runType);
  if (runType === "smoke") return selection.includeInSmokeValidation;
  if (runType === "focused_evening") return selection.includeInFocusedValidation;
  if (runType === "extended") return selection.includeInExtendedQueue;
  return selection.includeInOvernightQueue;
}

function sortExperimentsForRunType(experiments, runType) {
  if (runType === "smoke" || runType === "focused_evening") return experiments;
  return [...experiments].sort((a, b) => {
    const aSelection = a.runtimeSelection || {};
    const bSelection = b.runtimeSelection || {};
    return (Number(aSelection.queueRank) || 999) - (Number(bSelection.queueRank) || 999)
      || String(a.experimentId || "").localeCompare(String(b.experimentId || ""));
  });
}

function queueKey(row = {}) {
  return `${str(row.experimentId)}::${str(row.passId)}`;
}

function controllerQueueRows(controllerState = {}) {
  return arr(controllerState?.nextQueue)
    .filter((row) => str(row.experimentId) && str(row.passId));
}

function controllerCoverageGapRows(controllerState = {}) {
  return arr(controllerState?.nextQueue)
    .filter((row) => str(row.reason) === "coverage_gap" && str(row.goalId));
}

function isDisplayQualityGoal(goalId = "") {
  return str(goalId) === "display.full_sequence.quality_v1"
    || str(goalId).startsWith("display.video_aesthetic.");
}

function coverageGapQueueRows(controllerState = {}, experiments = []) {
  const rows = [];
  for (const gap of controllerCoverageGapRows(controllerState)) {
    const goalId = str(gap.goalId);
    if (goalId === "layer.rgb_primary.basic") {
      rows.push(
        {
          experimentId: "group-model-interplay-rgb_primary",
          passId: "group_then_model",
          generatedFromCoverageGap: goalId
        },
        {
          experimentId: "same-target-layer-stack-rgb_primary",
          passId: "one_layer_foundation",
          generatedFromCoverageGap: goalId
        },
        {
          experimentId: "same-target-layer-stack-rgb_primary",
          passId: "two_layer_default",
          generatedFromCoverageGap: goalId
        }
      );
    }
    if (goalId === "submodel.vendor_fixture.basic") {
      for (const paletteProfile of ["mono_white"]) {
        rows.push(
          {
            experimentId: `submodel-structure-vendor_basic-${paletteProfile}`,
            passId: "parent_model_foundation",
            generatedFromCoverageGap: goalId
          },
          {
            experimentId: `submodel-structure-vendor_basic-${paletteProfile}`,
            passId: "single_submodel_foundation",
            generatedFromCoverageGap: goalId
          },
          {
            experimentId: `submodel-structure-vendor_basic-${paletteProfile}`,
            passId: "sibling_submodels_split",
            generatedFromCoverageGap: goalId
          }
        );
      }
    }
    if (goalId === "creative.intent_match.v1") {
      for (const paletteProfile of ["mono_white"]) {
        rows.push(
          {
            experimentId: `creative-intent-probe-${paletteProfile}`,
            passId: "mood_palette_pace",
            generatedFromCoverageGap: goalId
          },
          {
            experimentId: `creative-intent-probe-${paletteProfile}`,
            passId: "emphasis_negative_space",
            generatedFromCoverageGap: goalId
          }
        );
      }
    }
    if (goalId === "creative.intent_revision_comparison.v1") {
      for (const paletteProfile of ["mono_white"]) {
        rows.push(
          {
            experimentId: `creative-intent-revision-comparison-${paletteProfile}`,
            passId: "intent_first_draft",
            generatedFromCoverageGap: goalId
          },
          {
            experimentId: `creative-intent-revision-comparison-${paletteProfile}`,
            passId: "intent_targeted_revision",
            generatedFromCoverageGap: goalId
          }
        );
      }
    }
    if (goalId === "creative.intent_revision_variants.v1") {
      const missingPaletteProfiles = arr(gap.missingCoverageUnits)
        .map((unit) => str(unit.paletteProfile || unit.palette || unit.palette_profile))
        .filter(Boolean);
      const missingPassIds = arr(gap.missingCoverageUnits)
        .map((unit) => str(unit.passId || unit.pass || unit.pass_id))
        .filter(Boolean);
      const paletteProfiles = missingPaletteProfiles.length ? [...new Set(missingPaletteProfiles)] : ["mono_white"];
      const candidatePassIds = missingPassIds.length ? [...new Set(missingPassIds)] : [
        "intent_focus_simplification_revision",
        "intent_focal_handoff_revision",
        "intent_pacing_balance_revision"
      ];
      const passIds = candidatePassIds.slice(0, 1);
      for (const paletteProfile of paletteProfiles) {
        rows.push({
          experimentId: `creative-intent-revision-comparison-${paletteProfile}`,
          passId: "intent_first_draft",
          generatedFromCoverageGap: goalId
        });
        for (const passId of passIds) {
          rows.push({
            experimentId: `creative-intent-revision-comparison-${paletteProfile}`,
            passId,
            generatedFromCoverageGap: goalId
          });
        }
      }
    }
    if (goalId === "target_transfer.compatibility_adaptation.v1") {
      const missingPaletteProfiles = arr(gap.missingCoverageUnits)
        .map((unit) => str(unit.paletteProfile || unit.palette || unit.palette_profile))
        .filter(Boolean);
      const missingPassIds = arr(gap.missingCoverageUnits)
        .map((unit) => str(unit.passId || unit.pass || unit.pass_id))
        .filter(Boolean);
      const paletteProfiles = missingPaletteProfiles.length ? [...new Set(missingPaletteProfiles)] : ["mono_white"];
      const passIds = missingPassIds.length
        ? [...new Set(missingPassIds)]
        : ["compatible_arch_prior_context", "similar_cane_transfer_probe", "weak_matrix_local_validation_probe"];
      for (const paletteProfile of paletteProfiles) {
        for (const passId of passIds) {
          rows.push({
            experimentId: `target-transfer-adaptation-${paletteProfile}`,
            passId,
            generatedFromCoverageGap: goalId
          });
        }
      }
    }
    if (goalId === "effect_fit.core_effects.v1") {
      const passByUnit = new Map([
        ["mono_white|single_strand|single_line", "single_strand_linear_motion"],
        ["mono_white|bars|arch", "bars_group_motion"],
        ["mono_white|color_wash|star", "color_wash_radial_fill"],
        ["mono_white|marquee|single_line", "marquee_linear_segments"],
        ["mono_white|pinwheel|spinner", "pinwheel_spinner_rotation"],
        ["mono_white|fire|tree_flat", "fire_tree_texture"],
        ["mono_white|butterfly|star", "butterfly_star_pattern"]
      ]);
      const missingUnits = arr(gap.missingCoverageUnits)
        .map((unit) => [
          normalizedToken(unit.paletteProfile || unit.palette || "mono_white"),
          normalizedToken(unit.effect || unit.effectName),
          normalizedToken(unit.modelType)
        ].join("|"))
        .map((key) => passByUnit.get(key))
        .filter(Boolean);
      const passIds = missingUnits.length
        ? [...new Set(missingUnits)]
        : ["single_strand_linear_motion", "bars_group_motion", "color_wash_radial_fill"];
      for (const paletteProfile of ["mono_white"]) {
        for (const passId of passIds) {
          rows.push({
            experimentId: `core-effect-fit-${paletteProfile}`,
            passId,
            generatedFromCoverageGap: goalId
          });
        }
      }
    }
    if (goalId === "effect_fit.expanded_model_matrix.v1") {
      const passByUnit = new Map([
        ["rgb_primary|marquee|single_line", "marquee_single_line_rgb_segments"],
        ["rgb_primary|single_strand|arch", "single_strand_arch_chase"],
        ["rgb_primary|bars|tree_flat", "bars_tree_vertical_motion"],
        ["rgb_primary|color_wash|tree_flat", "color_wash_tree_gradient"],
        ["rgb_primary|marquee|arch", "marquee_arch_segments"],
        ["rgb_primary|pinwheel|star", "pinwheel_star_rotation"],
        ["rgb_primary|fire|spinner", "fire_spinner_texture"],
        ["rgb_primary|butterfly|spinner", "butterfly_spinner_pattern"]
      ]);
      const missingUnits = arr(gap.missingCoverageUnits)
        .map((unit) => [
          normalizedToken(unit.paletteProfile || unit.palette || "rgb_primary"),
          normalizedToken(unit.effect || unit.effectName),
          normalizedToken(unit.modelType)
        ].join("|"))
        .map((key) => passByUnit.get(key))
        .filter(Boolean);
      const passIds = missingUnits.length
        ? [...new Set(missingUnits)]
        : ["marquee_single_line_rgb_segments", "single_strand_arch_chase", "bars_tree_vertical_motion"];
      for (const paletteProfile of ["rgb_primary"]) {
        for (const passId of passIds) {
          rows.push({
            experimentId: `expanded-effect-fit-${paletteProfile}`,
            passId,
            generatedFromCoverageGap: goalId
          });
        }
      }
    }
    if (isDisplayQualityGoal(goalId)) {
      const isVideoAestheticImprovement = str(gap.improvementSource) === "video_aesthetic_score";
      const missingPaletteProfiles = arr(gap.missingCoverageUnits)
        .map((unit) => str(unit.paletteProfile || unit.palette || unit.palette_profile))
        .filter(Boolean);
      const paletteProfiles = missingPaletteProfiles.length
        ? [...new Set(missingPaletteProfiles)]
        : str(gap.nextStrategy) === "rgb_primary_regional_focus_contrast"
          || str(gap.nextStrategy) === "rgb_primary_color_discipline_repair"
          || str(gap.nextStrategy) === "rgb_primary_structure_balance_pacing_repair"
          || str(gap.nextStrategy) === "palette_depth_contrast_motion_repair"
          || str(gap.nextStrategy) === "palette_transition_harmony_repair"
          || str(gap.nextStrategy) === "palette_spatial_balance_focal_repair"
          || str(gap.nextStrategy) === "palette_section_pacing_consistency_repair"
        ? ["rgb_primary"]
        : ["mono_white"];
      for (const paletteProfile of paletteProfiles) {
        const missingPassIds = arr(gap.missingCoverageUnits)
          .map((unit) => str(unit.passId || unit.pass || unit.pass_id))
          .filter(Boolean);
        const passIds = missingPassIds.length
          ? [...new Set(missingPassIds)]
          : isVideoAestheticImprovement
          ? str(gap.nextStrategy) === "section_window_pacing_balance"
            ? ["display_section_window_pacing"]
            : str(gap.nextStrategy) === "regional_focus_contrast"
              ? ["display_regional_focus_contrast"]
            : str(gap.nextStrategy) === "rgb_primary_regional_focus_contrast"
              ? ["display_regional_focus_contrast"]
              : str(gap.nextStrategy) === "rgb_primary_color_discipline_repair"
                ? ["display_rgb_color_discipline_repair"]
              : str(gap.nextStrategy) === "rgb_primary_structure_balance_pacing_repair"
                ? ["display_rgb_structure_balance_pacing_repair"]
              : str(gap.nextStrategy) === "focal_consistency_repair"
                ? ["display_focal_consistency_repair"]
              : str(gap.nextStrategy) === "palette_depth_contrast_motion_repair"
                ? ["display_palette_depth_contrast_motion_repair"]
              : str(gap.nextStrategy) === "palette_transition_harmony_repair"
                ? ["display_palette_transition_harmony_repair"]
              : str(gap.nextStrategy) === "palette_spatial_balance_focal_repair"
                ? ["display_palette_spatial_balance_focal_repair"]
              : str(gap.nextStrategy) === "palette_section_pacing_consistency_repair"
                ? ["display_palette_section_pacing_consistency_repair"]
            : ["display_pacing_balance_revision", "display_wide_balance_revision"]
          : ["display_balance_foundation", "display_motion_variety"];
        for (const passId of passIds) {
          rows.push({
            experimentId: `display-quality-review-${paletteProfile}`,
            passId,
            generatedFromCoverageGap: goalId
          });
        }
      }
    }
    if (goalId === "music.structure_alignment.v1") {
      for (const paletteProfile of ["mono_white"]) {
        rows.push(
          {
            experimentId: `music-structure-review-${paletteProfile}`,
            passId: "section_phrase_energy",
            generatedFromCoverageGap: goalId
          },
          {
            experimentId: `music-structure-review-${paletteProfile}`,
            passId: "lyric_accent_response",
            generatedFromCoverageGap: goalId
          }
        );
      }
    }
    if (goalId === "music.multi_section_structure.v1") {
      const missingPaletteProfiles = arr(gap.missingCoverageUnits)
        .map((unit) => str(unit.paletteProfile || unit.palette || unit.palette_profile))
        .filter(Boolean);
      const missingPassIds = arr(gap.missingCoverageUnits)
        .map((unit) => str(unit.passId || unit.pass || unit.pass_id))
        .filter(Boolean);
      const paletteProfiles = missingPaletteProfiles.length ? [...new Set(missingPaletteProfiles)] : ["rgb_primary"];
      const passIds = missingPassIds.length
        ? [...new Set(missingPassIds)]
        : ["multi_section_energy_arc", "motif_reprise_variation", "lyric_phrase_release"];
      for (const paletteProfile of paletteProfiles) {
        for (const passId of passIds) {
          rows.push({
            experimentId: `music-structure-review-${paletteProfile}`,
            passId,
            generatedFromCoverageGap: goalId
          });
        }
      }
    }
  }
  const available = new Set(arr(experiments).flatMap((experiment) => arr(experiment.passes)
    .map((pass) => queueKey({ experimentId: experiment.experimentId, passId: pass.passId }))));
  return rows.filter((row) => available.has(queueKey(row)));
}

function controllerQueueSet(controllerState = {}) {
  return new Set(controllerQueueRows(controllerState).map(queueKey));
}

function dependencyPassIds(experiment = {}, pass = {}) {
  const ids = new Set([str(pass.passId), "empty_baseline"]);
  if (str(experiment.family) === "group_model_interplay" && str(pass.passId) === "group_then_model") {
    ids.add("foundation_group_only");
    ids.add("model_only");
  }
  let cursor = pass;
  const byId = new Map(arr(experiment.passes).map((row) => [str(row.passId), row]));
  while (str(cursor?.comparisonBasePassId)) {
    const baseId = str(cursor.comparisonBasePassId);
    ids.add(baseId);
    cursor = byId.get(baseId);
    if (!cursor) break;
  }
  return ids;
}

function applyControllerStateSelection(experiments = [], controllerState = null) {
  const explicitRows = controllerQueueRows(controllerState);
  const generatedRows = coverageGapQueueRows(controllerState, experiments);
  const selectedRows = [...explicitRows, ...generatedRows];
  const selectedKeys = new Set(selectedRows.map(queueKey));
  if (!selectedKeys.size) {
    return {
      experiments,
      summary: {
        enabled: false,
        selectedQueueCount: 0,
        plannedExperimentCount: experiments.length,
        plannedPassCount: experiments.reduce((total, experiment) => total + arr(experiment.passes).length, 0),
        omittedQueueCount: 0,
        omittedQueue: []
      }
    };
  }

  const omittedQueue = [];
  const generatedKeyReasons = new Map(generatedRows.map((row) => [queueKey(row), "controller_coverage_gap"]));
  const filteredExperiments = [];
  for (const experiment of experiments) {
    const directPasses = arr(experiment.passes)
      .filter((pass) => selectedKeys.has(queueKey({ experimentId: experiment.experimentId, passId: pass.passId })));
    if (!directPasses.length) continue;
    const requiredPassIds = new Set();
    for (const pass of directPasses) {
      for (const passId of dependencyPassIds(experiment, pass)) requiredPassIds.add(passId);
    }
    const directPassIds = new Set(directPasses.map((pass) => str(pass.passId)));
    const passes = arr(experiment.passes)
      .filter((pass) => requiredPassIds.has(str(pass.passId)))
      .map((pass) => ({
        ...pass,
        controllerSelection: {
          selectedByController: directPassIds.has(str(pass.passId)),
          reason: directPassIds.has(str(pass.passId))
            ? generatedKeyReasons.get(queueKey({ experimentId: experiment.experimentId, passId: pass.passId })) || "controller_next_queue"
            : "comparison_dependency"
        }
      }));
    filteredExperiments.push({
      ...experiment,
      controllerSelection: {
        selectedByController: true,
        selectedPassCount: directPasses.length,
        dependencyPassCount: passes.length - directPasses.length
      },
      passes
    });
  }

  const plannedKeys = new Set(filteredExperiments.flatMap((experiment) => arr(experiment.passes)
    .filter((pass) => pass.controllerSelection?.selectedByController)
    .map((pass) => queueKey({ experimentId: experiment.experimentId, passId: pass.passId }))));
  for (const row of selectedRows) {
    if (!plannedKeys.has(queueKey(row))) omittedQueue.push(row);
  }

  return {
    experiments: filteredExperiments,
    summary: {
      enabled: true,
      sourceControllerState: str(controllerState?.artifactType),
      controllerCurriculumId: str(controllerState?.curriculumId),
      controllerLoopIndex: Number(controllerState?.loopIndex) || 0,
      controllerDecision: controllerState?.controllerDecision || null,
      selectedQueueCount: selectedKeys.size,
      explicitQueueCount: explicitRows.length,
      generatedCoverageQueueCount: generatedRows.length,
      plannedExperimentCount: filteredExperiments.length,
      plannedPassCount: filteredExperiments.reduce((total, experiment) => total + arr(experiment.passes).length, 0),
      omittedQueueCount: omittedQueue.length,
      omittedQueue: omittedQueue.map((row) => ({
        experimentId: str(row.experimentId),
        passId: str(row.passId),
        reason: "not_found_in_layer_composition_plan"
      }))
    }
  };
}

export function buildLayerCompositionTrainingPlan({
  modelCatalog,
  runId = `layer-composition-${stamp()}`,
  paletteProfiles = DEFAULT_PALETTE_PROFILES,
  runType = DEFAULT_RUN_TYPE,
  maxRuntimeMinutes = null,
  supportedLayerSettings = VERIFIED_OWNED_LAYER_RENDER_SETTINGS,
  existingPriors = [],
  controllerState = null
} = {}) {
  const runtimeBudget = RUNTIME_BUDGETS[runType] || RUNTIME_BUDGETS.overnight;
  const resolvedMaxRuntimeMinutes = maxRuntimeMinutes !== null && maxRuntimeMinutes !== undefined && Number.isFinite(Number(maxRuntimeMinutes))
    ? Number(maxRuntimeMinutes)
    : runtimeBudget.maxRuntimeMinutes;
  const archGroup = model(modelCatalog, "arch_group");
  const archSingle = model(modelCatalog, "arch_single");
  const singleLineHorizontal = model(modelCatalog, "single_line_horizontal");
  const treeFlat = model(modelCatalog, "tree_flat");
  const caneGroup = model(modelCatalog, "cane_group");
  const matrixLowDensity = model(modelCatalog, "matrix_low_density");
  const spinner = model(modelCatalog, "spinner");
  const star = model(modelCatalog, "star_triple_layer");
  const vendorBasicSubmodel = submodelTarget(modelCatalog, "vendor_basic");
  const baseExperiments = (paletteProfile) => [
    makeGroupModelExperiment({ paletteProfile, archGroup, archSingle, spinner }),
    makeSameTargetLayerExperiment({ paletteProfile, star }),
    makeSubmodelStructureExperiment({ paletteProfile, target: vendorBasicSubmodel }),
    makeCreativeIntentProbeExperiment({ paletteProfile, star, singleLineHorizontal }),
    makeCreativeIntentRevisionComparisonExperiment({ paletteProfile, archGroup, star, singleLineHorizontal }),
    makeCoreEffectFitExperiment({ paletteProfile, singleLineHorizontal, archGroup, star, spinner, treeFlat }),
    makeExpandedEffectFitExperiment({ paletteProfile, singleLineHorizontal, archSingle, star, spinner, treeFlat }),
    makeTargetTransferAdaptationExperiment({ paletteProfile, archGroup, caneGroup, matrixLowDensity }),
    makeDisplayQualityReviewExperiment({ paletteProfile, singleLineHorizontal, archGroup, star, spinner, treeFlat }),
    makeMusicStructureReviewExperiment({ paletteProfile, singleLineHorizontal, archGroup, star, spinner }),
    makeSettingSensitivityEdgeProbeExperiment({ paletteProfile, target: archGroup }),
    makeSettingAttributionProbeExperiment({ paletteProfile, target: singleLineHorizontal }),
    makeLowMovementSettingGeometryProbeExperiment({ paletteProfile, target: archSingle }),
    makeLowMovementSettingGeometryProbeExperiment({ paletteProfile, target: treeFlat })
  ].filter(Boolean);

  const priorCoverage = buildPriorCoverage(existingPriors);
  const plannedExperiments = paletteProfiles.flatMap(baseExperiments)
    .map(attachLearningSeeds)
    .map((experiment) => attachRuntimeSelection(experiment, runType))
    .map((experiment) => filterPassesByPriorCoverage(experiment, priorCoverage))
    .filter((experiment) => (experiment.passes || []).length > 0);
  const runTypeExperiments = sortExperimentsForRunType(
    plannedExperiments.filter((experiment) => includeExperimentForRunType(experiment, runType)),
    runType
  );
  const controllerSelection = applyControllerStateSelection(runTypeExperiments, controllerState);
  const experiments = controllerSelection.experiments;
  const runSelectionSkipCount = plannedExperiments.length - experiments.length;
  const skippedLearningCount = plannedExperiments
    .reduce((total, experiment) => total + (experiment.skippedPasses || []).length, 0);

  return {
    artifactType: "layer_composition_experiment_manifest_v1",
    artifactVersion: 1,
    runId,
    generatedAt: new Date().toISOString(),
    status: "dry_run_plan",
    trainingDisplay: {
      showDir: modelCatalog.showDir,
      fixtureSequencePath: modelCatalog.fixtureSequencePath,
      layoutName: modelCatalog.layoutName
    },
    paletteProfiles: paletteProfiles.map((profile) => ({
      profile,
      settings: paletteSettings(profile),
      purpose: palettePurpose(profile)
    })),
    experimentFamilies: [
      "group_model_interplay",
      "same_target_layer_stack",
      "submodel_structure",
      "creative_intent_probe",
      "creative_intent_revision_comparison",
      "core_effect_fit",
      "expanded_effect_fit",
      "display_quality_review",
      "music_structure_review",
      "setting_sensitivity_edge_probe",
      "setting_attribution_probe",
      "low_movement_setting_geometry_probe"
    ],
    curriculum: {
      strategy: "broad_to_specific",
      activeStage: "broad_composition_survey",
      stages: CURRICULUM_STAGES,
      coveragePolicy: {
        preferBroadUncoveredKeys: true,
        skipDurableCoveredLearnings: true,
        avoidRepeatValidationWithoutReason: true
      },
      adaptiveRefillPolicy: {
        enabled: runType !== "smoke",
        goal: "continue_until_runtime_budget_or_hard_stop",
        refillOrder: ADAPTIVE_REFILL_ORDER,
        earlyStopRequiresReason: true,
        normalCompletionStatus: "runtime_budget_reached",
        hardStopReasons: [
          "xlights_unhealthy",
          "repeated_render_failures",
          "modal_state_unresolved",
          "artifact_write_failed",
          "no_valid_non_repeated_experiment",
          "operator_stop_requested"
        ]
      },
      runtimeSelectionPolicy: {
        strategy: runType === "smoke" || runType === "focused_evening"
          ? "validation_preserves_manifest_order"
          : "prioritized_time_budget_queue",
        tiers: RUNTIME_SELECTION_TIERS,
        budgetWeightMeaning: "relative queue/refill emphasis, not a random sampling probability",
        overnightEmphasis: [
          "setting_attribution_probe",
          "low_movement_setting_geometry_probe:tree_flat",
          "same_target_layer_stack",
          "group_model_interplay"
        ],
        overnightDeferred: [
          {
            family: "low_movement_setting_geometry_probe",
            targetKey: "arch_single",
            reason: "recent smoke evidence showed low yield for Marquee thickness/reverse on this geometry"
          }
        ],
        runSelectionSkipCount
      },
      priorCoverageSummary: {
        durablePriorCount: priorCoverage.durable.size,
        revalidationCandidateCount: priorCoverage.needsRevalidation.length,
        skippedLearningCount
      },
      controllerSelection: controllerSelection.summary
    },
    compositionPasses: [
      "empty_baseline",
      "foundation",
      "structure",
      "focal",
      "detail",
      "order_variant",
      "effect_setting_variant",
      "render_setting_variant"
    ],
    renderOrderContract: {
      sourceSpec: "specs/sequence-agent/render-training-knowledge.md",
      physicalLayerOrderPolicy: "preserve layerIndex separately from compositionPass; do not infer topmost dominance from layer number alone",
      displayElementOrderPolicy: "explicitly test broad-before-specific and specific-before-broad order when group/model targets overlap"
    },
    targetStateKnowledgeContract: {
      goal: "produce indexed advisory evidence for sequencer planning decisions rather than append-only training logs",
      consumptionArtifact: "sequencer_layer_composition_guidance_v1",
      promotionArtifact: "sequencer_layer_composition_priors_bundle",
      retrievalFacets: [
        "compositionIntent",
        "targetScope",
        "modelType",
        "geometryProfile",
        "paletteProfile",
        "effectName",
        "compositionPass",
        "layerIndex",
        "layerBlendRole",
        "observedOutcome",
        "confidence",
        "promotionState"
      ],
      evidenceFlow: [
        "composition_stack_observation_v1",
        "layer_composition_delta_summary_v1",
        "layer_composition_priors_v1",
        "sequencer_layer_composition_priors_bundle",
        "sequencer_layer_composition_guidance_v1"
      ],
      sequencerUsePolicy: "advisory_evidence_not_recipe",
      requiredPriorFields: [
        "priorId",
        "scope",
        "conditions",
        "observedEffects",
        "guidance",
        "safeguards",
        "sourceObservationRef"
      ]
    },
    experiments,
    unsupportedRenderSettings: collectUnsupportedRenderSettings(supportedLayerSettings),
    runType,
    runtimeBudget: {
      ...runtimeBudget,
      maxRuntimeMinutes: resolvedMaxRuntimeMinutes
    },
    resumePolicy: {
      checkpointAfterEachPass: true,
      appendOnlyObservations: true,
      preserveDurableLearningIds: true
    },
    retentionPolicy: {
      ...DEFAULT_RETENTION_POLICY,
      externalDeleteRoots: [modelCatalog.showDir].filter(Boolean)
    },
    promotionPolicy: {
      promoteByDefault: false,
      requiresSmokeRun: true,
      requiresNonEmptyDeltas: true,
      requiresBothPaletteProfiles: true
    },
    maxRuntimeMinutes: resolvedMaxRuntimeMinutes
  };
}

function parseArgs(argv) {
  const args = {
    modelCatalogPath: DEFAULT_MODEL_CATALOG,
    outPath: DEFAULT_OUT,
    runId: "",
    runType: DEFAULT_RUN_TYPE,
    maxRuntimeMinutes: null,
    priorFiles: [],
    controllerStatePath: ""
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--model-catalog") {
      args.modelCatalogPath = argv[++index];
    } else if (arg === "--out") {
      args.outPath = argv[++index];
    } else if (arg === "--run-id") {
      args.runId = argv[++index];
    } else if (arg === "--run-type") {
      args.runType = argv[++index];
    } else if (arg === "--max-runtime-minutes") {
      args.maxRuntimeMinutes = Number(argv[++index]);
    } else if (arg === "--prior-file") {
      args.priorFiles.push(argv[++index]);
    } else if (arg === "--controller-state") {
      args.controllerStatePath = argv[++index];
    } else if (arg === "--help") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function usage() {
  return `Usage:
  node scripts/sequencer-render-training/tooling/build-layer-composition-training-plan.mjs [options]

Options:
  --model-catalog <path>        Canonical model catalog path.
  --out <path>                  Output training plan JSON path.
  --run-id <id>                 Override generated run id.
  --run-type <type>             smoke, focused_evening, overnight, or extended. Default: overnight.
  --max-runtime-minutes <n>     Override run type max runtime metadata.
  --prior-file <path>           Existing layer composition priors to skip durable covered learnings. Repeatable.
  --controller-state <path>     Optional sequencing quality controller state used to filter the plan to nextQueue.
  --help                        Show this help.
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(usage());
    return;
  }
  const modelCatalog = readJson(args.modelCatalogPath);
  const existingPriors = args.priorFiles.flatMap((filePath) => normalizePriorRows(readJson(filePath)));
  const controllerState = args.controllerStatePath ? readJson(args.controllerStatePath) : null;
  const plan = buildLayerCompositionTrainingPlan({
    modelCatalog,
    runId: args.runId || undefined,
    runType: args.runType,
    maxRuntimeMinutes: args.maxRuntimeMinutes,
    existingPriors,
    controllerState
  });
  ensureDir(args.outPath);
  fs.writeFileSync(args.outPath, `${JSON.stringify(plan, null, 2)}\n`);
  process.stdout.write(`${args.outPath}\n`);
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
