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

function isGenericScopeToken(raw = "") {
  const key = normText(raw).toLowerCase();
  return new Set(["whole show", "whole yard", "global", "all", "all props"]).has(key);
}

function normalizeGroupGraph(groupsById = {}, groupIds = []) {
  const out = {};
  const ids = new Set(Array.isArray(groupIds) ? groupIds.map((v) => normText(v)).filter(Boolean) : []);
  if (groupsById && typeof groupsById === "object" && !Array.isArray(groupsById)) {
    for (const [key, value] of Object.entries(groupsById)) {
      const id = normText(key);
      if (!id) continue;
      ids.add(id);
      const direct = Array.isArray(value?.members?.direct) ? value.members.direct : [];
      const flattened = Array.isArray(value?.members?.flattenedAll) ? value.members.flattenedAll
        : Array.isArray(value?.members?.flattened) ? value.members.flattened
          : direct;
      out[id] = {
        id,
        direct: new Set(direct.map((row) => normText(row?.id || row?.name)).filter(Boolean)),
        flattened: new Set(flattened.map((row) => normText(row?.id || row?.name)).filter(Boolean)),
        renderPolicy: {
          layout: normText(value?.renderPolicy?.layout),
          defaultBufferStyle: normText(value?.renderPolicy?.defaultBufferStyle || "Default") || "Default",
          category: normText(value?.renderPolicy?.category || "default") || "default"
        }
      };
    }
  }
  for (const id of ids) {
    if (!out[id]) {
      out[id] = {
        id,
        direct: new Set(),
        flattened: new Set(),
        renderPolicy: {
          layout: "",
          defaultBufferStyle: "Default",
          category: "default"
        }
      };
    }
  }
  return out;
}

function looksLikeAggregateTarget(name = "", groupIds = [], groupsById = {}) {
  const text = normText(name);
  if (!text) return false;
  const groupGraph = normalizeGroupGraph(groupsById, groupIds);
  if (groupGraph[text]) return true;
  return /(all|group|props|outlines|borders|greens|floods|wreath|snowflakes|spirals|train|front|upper|bulbs)/i.test(text);
}

function scoreAggregateTarget(id = "", orderedTargets = [], groupGraph = {}) {
  const group = groupGraph[id];
  if (!group) return Number.NEGATIVE_INFINITY;
  const others = orderedTargets.filter((row) => row !== id);
  const containedTargets = others.filter((row) => group.flattened.has(row) || group.direct.has(row)).length;
  const breadth = group.flattened.size || group.direct.size || 0;
  const positionBias = orderedTargets.indexOf(id) >= 0 ? (orderedTargets.length - orderedTargets.indexOf(id)) / 1000 : 0;
  const renderPolicy = String(group?.renderPolicy?.category || "default").trim() || "default";
  const renderPolicyBias = renderPolicy === "default" ? 0 : 100;
  return (containedTargets * 1000) + breadth + renderPolicyBias + positionBias;
}

function choosePrimaryAggregateTarget(orderedTargets = [], groupIds = [], groupsById = {}) {
  const groupGraph = normalizeGroupGraph(groupsById, groupIds);
  const aggregateCandidates = orderedTargets.filter((id) => groupGraph[id] || looksLikeAggregateTarget(id, groupIds, groupsById));
  if (!aggregateCandidates.length) return "";
  const scored = aggregateCandidates
    .map((id) => ({ id, score: scoreAggregateTarget(id, orderedTargets, groupGraph) }))
    .sort((a, b) => b.score - a.score);
  return scored[0]?.id || aggregateCandidates[0] || "";
}

function sortAggregateTargets(targetIds = [], groupIds = [], groupsById = {}) {
  const groupGraph = normalizeGroupGraph(groupsById, groupIds);
  return targetIds
    .filter((id) => looksLikeAggregateTarget(id, groupIds, groupsById))
    .slice()
    .sort((a, b) => scoreAggregateTarget(b, targetIds, groupGraph) - scoreAggregateTarget(a, targetIds, groupGraph));
}

function shouldExpandGroupTarget(description = "") {
  const text = normText(description).toLowerCase();
  return [
    "each member",
    "each prop",
    "per member",
    "per prop",
    "fan out",
    "spread across members",
    "distribute across members",
    "split across members",
    "stagger members",
    "alternate members"
  ].some((needle) => text.includes(needle));
}

function hasExplicitMemberExpansionOverride(description = "") {
  const text = normText(description).toLowerCase();
  return [
    "each member",
    "each prop",
    "per member",
    "per prop",
    "flatten members",
    "all nested members",
    "expand nested groups",
    "direct members"
  ].some((needle) => text.includes(needle));
}

function inferGroupDistributionStrategy(description = "") {
  const text = normText(description).toLowerCase();
  return {
    expand: shouldExpandGroupTarget(text),
    explicitOverride: hasExplicitMemberExpansionOverride(text),
    flatten: text.includes("flatten members") || text.includes("all nested members") || text.includes("expand nested groups"),
    stagger: text.includes("stagger members") || text.includes("fan out") || text.includes("spread across members"),
    fanout: text.includes("fan out members") || text.includes("round robin members") || text.includes("rotate members"),
    mirror: text.includes("mirror members") || text.includes("reverse members"),
    alternate: text.includes("alternate members")
  };
}

function orderDistributedMembers(members = [], strategy = {}, alternationSeed = 0) {
  let ordered = members.slice();
  if (strategy.fanout && ordered.length > 1) {
    const offset = alternationSeed % ordered.length;
    ordered = ordered.slice(offset).concat(ordered.slice(0, offset));
  }
  if (strategy.mirror) ordered = ordered.slice().reverse();
  if (strategy.alternate && ordered.length > 2) {
    ordered = ordered.filter((_, idx) => idx % 2 === 0).concat(ordered.filter((_, idx) => idx % 2 === 1));
  }
  if (!strategy.fanout && alternationSeed % 2 === 1) ordered = ordered.slice().reverse();
  return ordered;
}

function resolveExplicitTargetModels(models = [], description = "", groupIds = [], groupsById = {}, alternationSeed = 0) {
  const groupGraph = normalizeGroupGraph(groupsById, groupIds);
  const strategy = inferGroupDistributionStrategy(description);
  const out = [];
  for (const name of models) {
    const id = normText(name);
    if (!id) continue;
    const group = groupGraph[id];
    if (!group || !strategy.expand) {
      out.push({ modelName: id, sourceGroupId: "" });
      continue;
    }
    const renderCategory = normText(group?.renderPolicy?.category).toLowerCase();
    const preserveNonDefaultGroup = renderCategory && renderCategory !== "default" && !strategy.explicitOverride;
    if (preserveNonDefaultGroup) {
      out.push({ modelName: id, sourceGroupId: "" });
      continue;
    }
    const sourceMembers = strategy.flatten ? Array.from(group.flattened).filter(Boolean) : Array.from(group.direct).filter(Boolean);
    const orderedMembers = orderDistributedMembers(sourceMembers, strategy, alternationSeed);
    if (!orderedMembers.length) {
      out.push({ modelName: id, sourceGroupId: "" });
      continue;
    }
    out.push(...orderedMembers.map((memberName) => ({
      modelName: memberName,
      sourceGroupId: id
    })));
  }
  const deduped = [];
  const seen = new Set();
  for (const row of out) {
    const key = `${row.modelName}::${row.sourceGroupId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
  }
  return deduped;
}

export function collectGroupRenderPolicyWarnings(sourceLines = [], { groupIds = [], groupsById = {} } = {}) {
  const lines = Array.isArray(sourceLines) ? sourceLines.filter(Boolean) : [];
  if (!lines.length) return [];
  const groupGraph = normalizeGroupGraph(groupsById, groupIds);
  const warnings = [];
  for (const line of lines) {
    const parsed = parseProposalLine(line);
    const strategy = inferGroupDistributionStrategy(parsed.description);
    if (!strategy.expand || strategy.explicitOverride) continue;
    for (const modelName of parsed.models) {
      const id = normText(modelName);
      const group = groupGraph[id];
      const renderCategory = normText(group?.renderPolicy?.category).toLowerCase();
      if (!group || !renderCategory || renderCategory === "default") continue;
      const defaultBufferStyle = normText(group?.renderPolicy?.defaultBufferStyle) || "non-default";
      warnings.push(
        `Preserving group render target ${id} (${defaultBufferStyle}); explicit member override required to expand this non-default group render policy.`
      );
    }
  }
  return Array.from(new Set(warnings));
}

function derivePerMemberWindow(window, memberIndex = 0, totalMembers = 1, description = "") {
  const strategy = inferGroupDistributionStrategy(description);
  if (!strategy.stagger || totalMembers <= 1) return window;
  const startMs = Number(window?.startMs || 0);
  const endMs = Number(window?.endMs || startMs);
  const duration = Math.max(1, endMs - startMs);
  const slice = Math.max(1, Math.floor(duration / totalMembers));
  const memberStart = startMs + (slice * memberIndex);
  const memberEnd = memberIndex === totalMembers - 1 ? endMs : Math.min(endMs, memberStart + slice);
  return {
    startMs: memberStart,
    endMs: Math.max(memberStart + 1, memberEnd)
  };
}

function parseProposalLine(line = "") {
  const parts = String(line || "").split("/").map((p) => normText(p));
  if (!parts.length) return { section: "General", models: [], description: "" };
  const section = parts[0] || "General";
  const modelPart = parts.length > 1 ? parts[1] : "";
  const description = parts.length > 2 ? parts.slice(2).join(" / ") : "";
  return {
    section,
    rawTarget: modelPart,
    hasGenericScope: isGenericScopeToken(modelPart),
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

function buildDisplayElementOrderCommand({
  targetIds = [],
  displayElements = [],
  groupIds = [],
  groupsById = {},
  trackName = ""
} = {}) {
  const current = Array.isArray(displayElements)
    ? displayElements
      .map((row) => ({
        id: normText(row?.id || row?.name),
        type: normText(row?.type).toLowerCase()
      }))
      .filter((row) => row.id)
    : [];
  if (!current.length) return null;

  const timingIds = current.filter((row) => row.type === "timing").map((row) => row.id);
  const modelIds = current.filter((row) => row.type !== "timing").map((row) => row.id);
  const desiredTargets = Array.isArray(targetIds)
    ? targetIds.map((v) => normText(v)).filter(Boolean)
    : [];
  if (!desiredTargets.length) return null;

  const aggregateTargets = sortAggregateTargets(desiredTargets, groupIds, groupsById);
  const specificTargets = desiredTargets.filter((id) => !looksLikeAggregateTarget(id, groupIds, groupsById));
  const prioritized = Array.from(new Set(aggregateTargets.concat(specificTargets)));
  const currentModelSet = new Set(modelIds);
  const prioritizedInCurrent = prioritized.filter((id) => currentModelSet.has(id));
  if (!prioritizedInCurrent.length) return null;

  const remainingModels = modelIds.filter((id) => !prioritizedInCurrent.includes(id));
  const timingOut = timingIds.slice();
  const normalizedTrackName = normText(trackName);
  if (normalizedTrackName && !timingOut.includes(normalizedTrackName)) {
    timingOut.push(normalizedTrackName);
  }

  const orderedIds = timingOut.concat(prioritizedInCurrent, remainingModels);
  const currentIds = current.map((row) => row.id);
  if (
    orderedIds.length === currentIds.length &&
    orderedIds.every((id, idx) => id === currentIds[idx])
  ) {
    return null;
  }

  return {
    id: "display.order.apply",
    dependsOn: ["timing.track.create"],
    cmd: "sequencer.setDisplayElementOrder",
    params: {
      orderedIds
    }
  };
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

function buildEffectTemplates(source = [], parsed = [], targetIds = [], effectCatalog = null, groupIds = [], groupsById = {}) {
  const fallbackTargets = inferTargets(source, targetIds);
  if (!fallbackTargets.length) return [];

  const sectionWindows = buildSectionWindows(source, parsed);
  const layerCounts = new Map();
  const distributionCounts = new Map();
  const out = [];

  for (let i = 0; i < parsed.length; i++) {
    const row = parsed[i];
    const sourceTargetKey = row.models.length ? row.models.map((v) => normText(v)).filter(Boolean).join("|") : "__fallback__";
    const distributionKey = `${row.section}::${sourceTargetKey}::${normText(row.description).toLowerCase()}`;
    const alternationSeed = Number(distributionCounts.get(distributionKey) || 0);
    distributionCounts.set(distributionKey, alternationSeed + 1);
    let models = row.models.length
      ? resolveExplicitTargetModels(row.models, row.description, groupIds, groupsById, alternationSeed)
      : fallbackTargets.map((modelName) => ({ modelName, sourceGroupId: "" }));
    if (row.hasGenericScope && Array.isArray(targetIds) && targetIds.length) {
      const orderedTargets = targetIds.map((v) => normText(v)).filter(Boolean);
      const firstAggregate = choosePrimaryAggregateTarget(orderedTargets, groupIds, groupsById);
      if (firstAggregate) {
        models = [{ modelName: firstAggregate, sourceGroupId: "" }];
      } else {
        models = orderedTargets.map((modelName) => ({ modelName, sourceGroupId: "" }));
      }
    }
    const window = sectionWindows.get(row.section) || { startMs: i * 1000, endMs: (i * 1000) + 1000 };

    for (let modelIdx = 0; modelIdx < models.length; modelIdx++) {
      const target = models[modelIdx];
      const modelName = target?.modelName;
      const layerKey = `${row.section}::${modelName}`;
      const layerIndex = Number(layerCounts.get(layerKey) || 0);
      layerCounts.set(layerKey, layerIndex + 1);

      const effectName = inferEffectNameFromDescription(row.description, effectCatalog);
      if (!effectName) continue;
      const scopedWindow = target?.sourceGroupId
        ? derivePerMemberWindow(window, modelIdx, models.length, row.description)
        : window;

      out.push({
        id: `effect.${out.length + 1}`,
        dependsOn: ["timing.marks.insert"],
        cmd: "effects.create",
        params: {
          modelName,
          layerIndex,
          effectName,
          startMs: scopedWindow.startMs,
          endMs: scopedWindow.endMs,
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
  { trackName = "XD:ProposedPlan", targetIds = [], effectCatalog = null, displayElements = [], groupIds = [], groupsById = {} } = {}
) {
  const source = Array.isArray(sourceLines) ? sourceLines.filter(Boolean) : [];
  if (!source.length) {
    throw new Error("No proposed changes available for current section selection.");
  }

  const parsed = source.map((line) => parseProposalLine(line));
  const marks = buildTimingMarks(source);

  const baseCommands = [
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
  ];

  const displayOrderCommand = buildDisplayElementOrderCommand({
    targetIds,
    displayElements,
    groupIds,
    groupsById,
    trackName
  });

  const effectCommands = buildEffectTemplates(source, parsed, targetIds, effectCatalog, groupIds, groupsById).map((row) => {
    if (!displayOrderCommand) return row;
    const dependsOn = Array.isArray(row.dependsOn) ? row.dependsOn.slice() : [];
    if (!dependsOn.includes(displayOrderCommand.id)) {
      dependsOn.push(displayOrderCommand.id);
    }
    return {
      ...row,
      dependsOn
    };
  });

  return baseCommands
    .concat(displayOrderCommand ? [displayOrderCommand] : [])
    .concat(effectCommands);
}

export {
  parseProposalLine
};
