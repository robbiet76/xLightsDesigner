import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function str(value = "") {
  return String(value || "").trim();
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function settingValue(value) {
  if (value === true) return "1";
  if (value === false) return "0";
  return String(value);
}

function toSettingsString(settings = {}) {
  return Object.entries(settings && typeof settings === "object" ? settings : {})
    .filter(([key, value]) => str(key) && value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${settingValue(value)}`)
    .join(",");
}

function baseEffectSettingMapping(settingName = "") {
  return {
    renderStyle: "B_CHOICE_BufferStyle"
  }[str(settingName)] || "";
}

function effectSettingMapping(effectName = "", settingName = "") {
  const effect = str(effectName).toLowerCase();
  const key = str(settingName);
  const common = baseEffectSettingMapping(key);
  if (common) return common;
  if (/^E_|^B_|^T_|^C_/.test(key)) return key;
  const mappings = {
    bars: {
      barCount: "E_SLIDER_Bars_Bar_Count",
      direction: "E_CHOICE_Bars_Direction",
      cycles: "E_TEXTCTRL_Bars_Cycles",
      center: "E_SLIDER_Bars_Center",
      highlight: "E_CHECKBOX_Bars_Highlight",
      gradient: "E_CHECKBOX_Bars_Gradient",
      "3D": "E_CHECKBOX_Bars_3D"
    },
    marquee: {
      bandSize: "E_TEXTCTRL_Marquee_Band_Size",
      skipSize: "E_TEXTCTRL_Marquee_Skip_Size",
      thickness: "E_TEXTCTRL_Marquee_Thickness",
      stagger: "E_TEXTCTRL_Marquee_Stagger",
      speed: "E_TEXTCTRL_Marquee_Speed",
      start: "E_TEXTCTRL_Marquee_Start",
      reverse: "E_CHECKBOX_Marquee_Reverse"
    },
    "color wash": {
      cycles: "E_TEXTCTRL_ColorWash_Cycles",
      circularPalette: "E_CHECKBOX_ColorWash_CircularPalette",
      vFade: "E_CHECKBOX_ColorWash_VFade",
      hFade: "E_CHECKBOX_ColorWash_HFade",
      reverseFades: "E_CHECKBOX_ColorWash_ReverseFades",
      shimmer: "E_CHECKBOX_ColorWash_Shimmer"
    },
    pinwheel: {
      arms: "E_SLIDER_Pinwheel_Arms",
      armSize: "E_SLIDER_Pinwheel_Arm_Size",
      thickness: "E_SLIDER_Pinwheel_Thickness",
      twist: "E_SLIDER_Pinwheel_Twist",
      speed: "E_SLIDER_Pinwheel_Speed",
      rotation: "E_SLIDER_Pinwheel_Rotation",
      "3DMode": "E_CHOICE_Pinwheel_3D"
    },
    shimmer: {
      dutyFactor: "E_SLIDER_Shimmer_Duty_Factor",
      cycles: "E_TEXTCTRL_Shimmer_Cycles",
      useAllColors: "E_CHECKBOX_Shimmer_Use_All_Colors"
    },
    twinkle: {
      style: "E_CHOICE_Twinkle_Style",
      count: "E_SLIDER_Twinkle_Count",
      steps: "E_SLIDER_Twinkle_Steps",
      strobe: "E_CHECKBOX_Twinkle_Strobe",
      reRandomize: "E_CHECKBOX_Twinkle_ReRandomize"
    }
  };
  return mappings[effect]?.[key] || key;
}

function normalizeEffectSettings(effectName = "", settings = {}) {
  const out = {};
  for (const [key, value] of Object.entries(settings && typeof settings === "object" ? settings : {})) {
    if (!str(key) || value === undefined || value === null) continue;
    out[effectSettingMapping(effectName, key)] = value;
  }
  return out;
}

function layerRenderSettingMapping(settingName = "") {
  const key = str(settingName);
  if (/^C_BUTTON_Palette[1-8]$/.test(key) || /^C_CHECKBOX_Palette[1-8]$/.test(key)) {
    return { target: "palette", key };
  }
  return {
    mixMethod: { target: "settings", key: "T_CHOICE_LayerMethod" },
    mixThreshold: { target: "settings", key: "T_SLIDER_EffectLayerMix" },
    mixAmount: { target: "settings", key: "T_SLIDER_EffectLayerMix" },
    effectLayerMix: { target: "settings", key: "T_SLIDER_EffectLayerMix" },
    layerMorph: { target: "settings", key: "T_CHECKBOX_LayerMorph" },
    canvas: { target: "settings", key: "T_CHECKBOX_Canvas" },
    persistentOverlay: { target: "settings", key: "B_CHECKBOX_OverlayBkg" },
    persistent: { target: "settings", key: "B_CHECKBOX_OverlayBkg" },
    blur: { target: "settings", key: "B_SLIDER_Blur" },
    zoom: { target: "settings", key: "B_SLIDER_Zoom" },
    rotation: { target: "settings", key: "B_SLIDER_Rotation" },
    fadeIn: { target: "settings", key: "T_TEXTCTRL_Fadein" },
    fadeOut: { target: "settings", key: "T_TEXTCTRL_Fadeout" },
    inTransitionType: { target: "settings", key: "T_CHOICE_In_Transition_Type" },
    outTransitionType: { target: "settings", key: "T_CHOICE_Out_Transition_Type" },
    inTransitionAdjust: { target: "settings", key: "T_SLIDER_In_Transition_Adjust" },
    outTransitionAdjust: { target: "settings", key: "T_SLIDER_Out_Transition_Adjust" },
    inTransitionReverse: { target: "settings", key: "T_CHECKBOX_In_Transition_Reverse" },
    outTransitionReverse: { target: "settings", key: "T_CHECKBOX_Out_Transition_Reverse" },
    brightness: { target: "palette", key: "C_SLIDER_Brightness" },
    contrast: { target: "palette", key: "C_SLIDER_Contrast" },
    hue: { target: "palette", key: "C_SLIDER_Color_HueAdjust" },
    saturation: { target: "palette", key: "C_SLIDER_Color_SaturationAdjust" },
    value: { target: "palette", key: "C_SLIDER_Color_ValueAdjust" }
  }[key] || null;
}

function splitLayerRenderSettings(layerSettings = {}) {
  const effectSettings = {};
  const paletteSettings = {};
  const applied = [];
  const unsupported = [];
  for (const [settingName, value] of Object.entries(layerSettings && typeof layerSettings === "object" ? layerSettings : {})) {
    if (value === undefined || value === null) continue;
    const mapping = layerRenderSettingMapping(settingName);
    if (!mapping) {
      unsupported.push({
        settingName,
        value,
        reason: "No verified xLights serialized setting key is mapped for this layer render setting."
      });
      continue;
    }
    if (mapping.target === "palette") paletteSettings[mapping.key] = value;
    else effectSettings[mapping.key] = value;
    applied.push({
      settingName,
      serializedTarget: mapping.target,
      serializedKey: mapping.key,
      value
    });
  }
  return { effectSettings, paletteSettings, applied, unsupported };
}

function paletteProfileMap(plan = {}) {
  return new Map(arr(plan.paletteProfiles).map((row) => [str(row.profile), row.settings || {}]));
}

function normalizePaletteSettings(settings = {}) {
  const out = {};
  for (let slot = 1; slot <= 8; slot += 1) {
    const colorKey = `C_BUTTON_Palette${slot}`;
    if (settings[colorKey]) out[colorKey] = settings[colorKey];
    const checkboxKey = `C_CHECKBOX_Palette${slot}`;
    if (settings[checkboxKey] !== undefined) {
      out[checkboxKey] = settings[checkboxKey] === true ? "1" : settings[checkboxKey] === false ? "0" : String(settings[checkboxKey]);
    }
  }
  return out;
}

function buildEffectRows(passPlan = {}, paletteSettings = {}) {
  return arr(passPlan.placements).map((placement) => {
    const startMs = Number(placement.startMs);
    const endMs = Number(placement.endMs);
    if (!str(placement.target)) throw new Error(`Placement ${placement.placementId || ""} has no target`);
    if (!str(placement.effectName)) throw new Error(`Placement ${placement.placementId || ""} has no effectName`);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
      throw new Error(`Placement ${placement.placementId || ""} has invalid timing`);
    }
    const layerSettingPayload = splitLayerRenderSettings(placement.layerSettings || {});
    return {
      element: str(placement.target),
      layer: Number.isFinite(Number(placement.layerIndex)) ? Number(placement.layerIndex) : 0,
      effectName: str(placement.effectName),
      startMs,
      endMs,
      settings: toSettingsString({
        ...normalizeEffectSettings(placement.effectName, placement.effectSettings || {}),
        ...layerSettingPayload.effectSettings
      }),
      palette: toSettingsString({
        ...normalizePaletteSettings(paletteSettings),
        ...layerSettingPayload.paletteSettings
      }),
      clearExisting: false,
      metadata: {
        placementId: str(placement.placementId),
        targetScope: str(placement.targetScope),
        compositionPass: str(placement.compositionPass),
        layerIntent: placement.layerIntent || {},
        layerSettings: placement.layerSettings || {},
        appliedLayerSettings: layerSettingPayload.applied,
        unsupportedLayerSettings: layerSettingPayload.unsupported
      }
    };
  });
}

function buildMarks(plan = {}, passPlan = {}) {
  const sequenceDurationMs = Number(plan?.trainingDisplay?.sequenceDurationMs || 30000);
  const durationMs = Number.isFinite(sequenceDurationMs) && sequenceDurationMs >= 2000 ? sequenceDurationMs : 30000;
  const windows = arr(passPlan.placements)
    .map((placement) => ({
      startMs: Number(placement.startMs),
      endMs: Number(placement.endMs)
    }))
    .filter((row) => Number.isFinite(row.startMs) && Number.isFinite(row.endMs) && row.endMs > row.startMs);
  const importantEdges = new Set([0, durationMs]);
  for (const window of windows) {
    importantEdges.add(Math.max(0, Math.min(durationMs, window.startMs)));
    importantEdges.add(Math.max(0, Math.min(durationMs, window.endMs)));
  }
  for (let markMs = 5000; markMs < durationMs; markMs += 5000) {
    importantEdges.add(markMs);
  }
  const edges = [...importantEdges].filter(Number.isFinite).sort((a, b) => a - b);
  return edges.slice(0, -1).map((startMs, index) => ({
    label: `section-${String(index + 1).padStart(2, "0")}`,
    startMs,
    endMs: edges[index + 1]
  })).filter((mark) => mark.endMs > mark.startMs);
}

export function buildLayerCompositionPassExecution({
  plan = {},
  passPlan = {}
} = {}) {
  const palettes = paletteProfileMap(plan);
  const paletteProfile = str(passPlan.paletteProfile);
  const paletteSettings = palettes.get(paletteProfile) || {};
  const effects = buildEffectRows(passPlan, paletteSettings);
  const marks = buildMarks(plan, passPlan);
  const directCommands = [];
  const displayElementOrder = arr(passPlan.displayElementOrder).map(str).filter(Boolean);
  if (displayElementOrder.length) {
    directCommands.push({
      cmd: "sequencer.setDisplayElementOrder",
      params: { orderedIds: displayElementOrder }
    });
  }
  return {
    artifactType: "layer_composition_pass_execution_v1",
    artifactVersion: 1,
    generatedAt: new Date().toISOString(),
    runId: str(plan.runId),
    experimentId: str(passPlan.experimentId),
    passId: str(passPlan.passId),
    paletteProfile,
    learningId: str(passPlan.learningSeed?.learningId),
    ownedBatchPayload: {
      track: "XD: Layer Composition Training",
      replaceExistingMarks: true,
      marks,
      effects
    },
    directCommands,
    appliedLayerSettings: effects
      .flatMap((row) => arr(row.metadata.appliedLayerSettings).map((setting) => ({
        placementId: row.metadata.placementId,
        layer: row.layer,
        ...setting
      }))),
    unsupportedLayerSettings: effects
      .flatMap((row) => arr(row.metadata.unsupportedLayerSettings).map((setting) => ({
        placementId: row.metadata.placementId,
        layer: row.layer,
        ...setting
      })))
  };
}

function parseArgs(argv) {
  const args = { planPath: "", passPlanPath: "", outPath: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--plan") args.planPath = argv[++index];
    else if (arg === "--pass-plan") args.passPlanPath = argv[++index];
    else if (arg === "--out") args.outPath = argv[++index];
    else if (arg === "--help") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return `Usage:
  node scripts/sequencer-render-training/tooling/build-layer-composition-pass-execution.mjs --plan <training-plan.json> --pass-plan <pass-plan.json> --out <execution.json>
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(usage());
    return;
  }
  if (!args.planPath) throw new Error("--plan is required");
  if (!args.passPlanPath) throw new Error("--pass-plan is required");
  if (!args.outPath) throw new Error("--out is required");
  const payload = buildLayerCompositionPassExecution({
    plan: readJson(args.planPath),
    passPlan: readJson(args.passPlanPath)
  });
  writeJson(args.outPath, payload);
  process.stdout.write(`${args.outPath}\n`);
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
