export function estimateImpactCount(sourceLines = []) {
  const count = Array.isArray(sourceLines) ? sourceLines.filter(Boolean).length : 0;
  return Math.max(0, count * 11);
}

function normText(value = "") {
  return String(value || "").trim();
}

function splitModelTokenList(raw = "") {
  return String(raw || "")
    .split(/\+|,|&/)
    .map((p) => normText(p))
    .filter(Boolean);
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

function chooseTemplateEffectName(effectCatalog = null) {
  const byName = effectCatalog && typeof effectCatalog === "object" && effectCatalog.byName && typeof effectCatalog.byName === "object"
    ? effectCatalog.byName
    : {};
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

export function buildDesignerPlanCommands(
  sourceLines = [],
  { trackName = "XD:ProposedPlan", targetIds = [], effectCatalog = null } = {}
) {
  const source = Array.isArray(sourceLines) ? sourceLines.filter(Boolean) : [];
  if (!source.length) {
    throw new Error("No proposed changes available for current section selection.");
  }

  const marks = source.slice(0, 24).map((label, idx) => {
    const startMs = idx * 1000;
    return {
      startMs,
      endMs: startMs + 1000,
      label
    };
  });

  return [
    {
      cmd: "timing.createTrack",
      params: {
        trackName,
        replaceIfExists: true
      }
    },
    {
      cmd: "timing.insertMarks",
      params: {
        trackName,
        marks
      }
    }
  ].concat((() => {
    const effectName = chooseTemplateEffectName(effectCatalog);
    if (!effectName) return [];
    const targets = inferTargets(source, targetIds);
    if (!targets.length) return [];
    const out = [];
    const maxRows = Math.min(16, Math.max(targets.length, source.length));
    for (let i = 0; i < maxRows; i++) {
      const modelName = targets[i % targets.length];
      const baseStart = i * 1000;
      out.push({
        cmd: "effects.create",
        params: {
          modelName,
          layerIndex: 0,
          effectName,
          startMs: baseStart,
          endMs: baseStart + 1000,
          settings: {},
          palette: {}
        }
      });
    }
    return out;
  })());
}
