export function estimateImpactCount(sourceLines = []) {
  const count = Array.isArray(sourceLines) ? sourceLines.filter(Boolean).length : 0;
  return Math.max(0, count * 11);
}

function normText(value = "") {
  return String(value || "").trim();
}

function splitModelTokenList(raw = "") {
  const rows = String(raw || "")
    .split(/\+|,|&/)
    .map((p) => normText(p))
    .filter(Boolean);
  const genericScopes = new Set(["whole show", "whole yard", "global", "all", "all props"]);
  return rows.filter((row) => !genericScopes.has(row.toLowerCase()));
}

function parseProposalLine(line = "") {
  const parts = String(line || "").split("/").map((p) => normText(p));
  if (!parts.length) return { section: "General", models: [], description: "" };
  const section = parts[0] || "General";
  const modelPart = parts.length > 1 ? parts[1] : "";
  const description = parts.length > 2 ? parts.slice(2).join(" / ") : "";
  return {
    section,
    models: splitModelTokenList(modelPart),
    description
  };
}

function normalizeEffectCatalog(effectCatalog = null) {
  return effectCatalog && typeof effectCatalog === "object" && effectCatalog.byName && typeof effectCatalog.byName === "object"
    ? effectCatalog.byName
    : {};
}

function chooseTemplateEffectName(effectCatalog = null) {
  const byName = normalizeEffectCatalog(effectCatalog);
  const preferred = ["On", "Bars", "Color Wash", "Butterfly", "Shimmer"];
  for (const name of preferred) {
    if (Object.prototype.hasOwnProperty.call(byName, name)) return name;
  }
  const names = Object.keys(byName);
  return names.length ? names[0] : "";
}

function inferTargets(source = [], explicitTargetIds = []) {
  const explicit = Array.isArray(explicitTargetIds) ? explicitTargetIds.map((v) => normText(v)).filter(Boolean) : [];
  if (explicit.length) return Array.from(new Set(explicit));
  const inferred = [];
  for (const line of source) {
    for (const name of parseProposalLine(line).models) inferred.push(name);
  }
  return Array.from(new Set(inferred));
}

function inferEffectNameFromDescription(description = "", effectCatalog = null) {
  const byName = normalizeEffectCatalog(effectCatalog);
  const text = normText(description).toLowerCase();
  const aliases = [
    { effectName: "Bars", patterns: ["bars", "bar hits", "striped"] },
    { effectName: "Shimmer", patterns: ["shimmer", "sparkle", "twinkle", "glitter"] },
    { effectName: "Color Wash", patterns: ["wash", "color wash", "sweep"] },
    { effectName: "Butterfly", patterns: ["butterfly"] },
    { effectName: "On", patterns: ["hold", "solid", "steady", "glow"] }
  ];
  for (const row of aliases) {
    if (!Object.prototype.hasOwnProperty.call(byName, row.effectName)) continue;
    if (row.patterns.some((pattern) => text.includes(pattern))) return row.effectName;
  }
  return chooseTemplateEffectName(effectCatalog);
}

function inferSharedSettings(description = "") {
  const text = normText(description).toLowerCase();
  const settings = {};

  const blendMap = [
    ["additive", "Additive"],
    ["highlight vibrant", "Highlight Vibrant"],
    ["highlight", "Highlight"],
    ["average", "Average"],
    ["layered", "Layered"],
    ["left-right", "Left-Right"],
    ["bottom-top", "Bottom-Top"],
    ["brightness blend", "Brightness"]
  ];
  for (const [needle, value] of blendMap) {
    if (text.includes(needle)) {
      settings.T_CHOICE_LayerMethod = value;
      break;
    }
  }

  const transitionMap = [
    ["fade", "Fade"],
    ["blend", "Blend"],
    ["wipe", "Wipe"],
    ["zoom", "Zoom"],
    ["slide", "Slide Bars"]
  ];
  for (const [needle, value] of transitionMap) {
    if (text.includes(needle)) {
      settings.T_CHOICE_In_Transition_Type = value;
      settings.T_CHOICE_Out_Transition_Type = value;
      break;
    }
  }

  if (text.includes("cross-fade") || text.includes("crossfade") || text.includes("morph")) {
    settings.T_CHECKBOX_LayerMorph = true;
    if (!settings.T_CHOICE_In_Transition_Type) settings.T_CHOICE_In_Transition_Type = "Blend";
    if (!settings.T_CHOICE_Out_Transition_Type) settings.T_CHOICE_Out_Transition_Type = "Blend";
  }

  if (
    text.includes("higher contrast") ||
    text.includes("high contrast") ||
    text.includes("increase contrast") ||
    text.includes("pulse contrast")
  ) {
    settings.C_SLIDER_Contrast = 35;
  } else if (text.includes("lower contrast") || text.includes("soften contrast")) {
    settings.C_SLIDER_Contrast = -20;
  }

  if (text.includes("reduce brightness") || text.includes("dim") || text.includes("softer intensity")) {
    settings.C_SLIDER_Brightness = 70;
  } else if (text.includes("brighten") || text.includes("brighter") || text.includes("increase brightness")) {
    settings.C_SLIDER_Brightness = 125;
  }

  return settings;
}

function buildTimingMarks(source = []) {
  return source.slice(0, 24).map((label, idx) => {
    const startMs = idx * 1000;
    return {
      startMs,
      endMs: startMs + 1000,
      label
    };
  });
}

function buildSectionWindows(source = [], parsed = []) {
  const sectionOrder = [];
  const seen = new Set();
  for (let i = 0; i < source.length; i++) {
    const section = normText(parsed[i]?.section) || `Section ${i + 1}`;
    if (seen.has(section)) continue;
    seen.add(section);
    sectionOrder.push(section);
  }
  return new Map(sectionOrder.map((section, idx) => [section, { startMs: idx * 1000, endMs: (idx * 1000) + 1000 }]));
}

function buildEffectTemplates(source = [], parsed = [], targetIds = [], effectCatalog = null) {
  const fallbackTargets = inferTargets(source, targetIds);
  if (!fallbackTargets.length) return [];

  const sectionWindows = buildSectionWindows(source, parsed);
  const layerCounts = new Map();
  const out = [];

  for (let i = 0; i < parsed.length; i++) {
    const row = parsed[i];
    const models = row.models.length ? row.models : fallbackTargets;
    const window = sectionWindows.get(row.section) || { startMs: i * 1000, endMs: (i * 1000) + 1000 };

    for (const modelName of models) {
      const layerKey = `${row.section}::${modelName}`;
      const layerIndex = Number(layerCounts.get(layerKey) || 0);
      layerCounts.set(layerKey, layerIndex + 1);

      const effectName = inferEffectNameFromDescription(row.description, effectCatalog);
      if (!effectName) continue;

      out.push({
        id: `effect.${out.length + 1}`,
        dependsOn: ["timing.marks.insert"],
        cmd: "effects.create",
        params: {
          modelName,
          layerIndex,
          effectName,
          startMs: window.startMs,
          endMs: window.endMs,
          settings: inferSharedSettings(row.description),
          palette: {}
        }
      });
    }
  }

  return out.slice(0, 24);
}

export function buildDesignerPlanCommands(
  sourceLines = [],
  { trackName = "XD:ProposedPlan", targetIds = [], effectCatalog = null } = {}
) {
  const source = Array.isArray(sourceLines) ? sourceLines.filter(Boolean) : [];
  if (!source.length) {
    throw new Error("No proposed changes available for current section selection.");
  }

  const parsed = source.map((line) => parseProposalLine(line));
  const marks = buildTimingMarks(source);

  return [
    {
      id: "timing.track.create",
      cmd: "timing.createTrack",
      params: {
        trackName,
        replaceIfExists: true
      }
    },
    {
      id: "timing.marks.insert",
      dependsOn: ["timing.track.create"],
      cmd: "timing.insertMarks",
      params: {
        trackName,
        marks
      }
    }
  ].concat(buildEffectTemplates(source, parsed, targetIds, effectCatalog));
}

export {
  parseProposalLine
};
