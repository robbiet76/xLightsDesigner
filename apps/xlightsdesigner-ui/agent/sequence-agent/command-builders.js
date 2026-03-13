export function estimateImpactCount(sourceLines = []) {
  const count = Array.isArray(sourceLines) ? sourceLines.filter(Boolean).length : 0;
  return Math.max(0, count * 11);
}

function normText(value = "") {
  return String(value || "").trim();
}

function parseSubmodelParentId(targetId = "") {
  const id = normText(targetId);
  const slash = id.indexOf("/");
  if (slash <= 0) return "";
  return id.slice(0, slash);
}

function inferBufferStyleFamily(style = "") {
  const key = normText(style).toLowerCase();
  if (!key || key === "default") return "default";
  if (key === "overlay" || key.includes("overlay")) return "overlay";
  if (key === "stack" || key.includes("stack")) return "stack";
  if (key === "single_line" || key.includes("single line")) return "single_line";
  if (key === "per_model_strand" || key.includes("per strand")) return "per_model_strand";
  if (key === "per_model" || key.includes("per model")) return "per_model";
  return "default";
}

function inferRenderRiskLevel(family = "") {
  const key = normText(family).toLowerCase();
  if (key === "overlay" || key === "stack" || key === "single_line" || key === "per_model_strand") return "high";
  if (key === "per_model") return "medium";
  return "low";
}

function normalizeSequenceSettings(sequenceSettings = {}) {
  const row = sequenceSettings && typeof sequenceSettings === "object" && !Array.isArray(sequenceSettings)
    ? sequenceSettings
    : {};
  return {
    sequenceType: normText(row.sequenceType || "Media") || "Media",
    supportsModelBlending: Boolean(row.supportsModelBlending)
  };
}

function splitModelTokenList(raw = "") {
  const rows = String(raw || "")
    .split(/\+|,|&/)
    .map((p) => normText(p))
    .filter(Boolean);
  const genericScopes = new Set(["whole show", "whole yard", "global", "all", "all props"]);
  return rows.filter((row) => !genericScopes.has(row.toLowerCase()));
}

function normalizeSubmodelGraph(submodelsById = {}) {
  const out = {};
  if (submodelsById && typeof submodelsById === "object" && !Array.isArray(submodelsById)) {
    for (const [key, value] of Object.entries(submodelsById)) {
      const id = normText(key || value?.id);
      if (!id) continue;
      const submodelType = normText(value?.renderPolicy?.submodelType || value?.submodelType || "ranges").toLowerCase() || "ranges";
      const bufferStyle = normText(value?.renderPolicy?.bufferStyle || value?.bufferStyle || "Default") || "Default";
      out[id] = {
        id,
        parentId: normText(value?.parentId || parseSubmodelParentId(id)),
        nodeChannels: new Set(
          Array.isArray(value?.membership?.nodeChannels)
            ? value.membership.nodeChannels.map((v) => Number(v)).filter((v) => Number.isFinite(v))
            : []
        ),
        renderPolicy: {
          submodelType,
          bufferStyle,
          availableBufferStyles: Array.isArray(value?.renderPolicy?.availableBufferStyles || value?.availableBufferStyles)
            ? (value?.renderPolicy?.availableBufferStyles || value?.availableBufferStyles).map((row) => normText(row)).filter(Boolean)
            : []
        }
      };
    }
  }
  return out;
}

function isMaterialSubmodelRenderOverride(entry = null) {
  const submodelType = normText(entry?.renderPolicy?.submodelType || "ranges").toLowerCase() || "ranges";
  const bufferStyle = normText(entry?.renderPolicy?.bufferStyle || "Default");
  return submodelType !== "ranges" || (bufferStyle && bufferStyle.toLowerCase() !== "default");
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
        renderPolicy: (() => {
          const defaultBufferStyle = normText(value?.renderPolicy?.defaultBufferStyle || "Default") || "Default";
          const availableBufferStyles = Array.isArray(value?.renderPolicy?.availableBufferStyles)
            ? value.renderPolicy.availableBufferStyles.map((row) => normText(row)).filter(Boolean)
            : [];
          const currentFamily = inferBufferStyleFamily(
            normText(value?.renderPolicy?.category) && normText(value?.renderPolicy?.category) !== "default"
              ? normText(value?.renderPolicy?.category)
              : defaultBufferStyle
          );
          const availableFamilies = Array.from(new Set(availableBufferStyles.map((row) => inferBufferStyleFamily(row)).filter(Boolean)));
          return {
            layout: normText(value?.renderPolicy?.layout),
            defaultBufferStyle,
            category: normText(value?.renderPolicy?.category || currentFamily || "default") || "default",
            currentFamily,
            riskLevel: inferRenderRiskLevel(currentFamily),
            availableBufferStyles,
            availableFamilies
          };
        })()
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
          category: "default",
          currentFamily: "default",
          riskLevel: "low",
          availableBufferStyles: [],
          availableFamilies: ["default"]
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
  const renderPolicy = String(group?.renderPolicy?.currentFamily || group?.renderPolicy?.category || "default").trim() || "default";
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

function hasForceRenderPolicyExpansionOverride(description = "") {
  const text = normText(description).toLowerCase();
  return [
    "flatten members",
    "all nested members",
    "expand nested groups",
    "direct members",
    "force member expansion"
  ].some((needle) => text.includes(needle));
}

function inferGroupDistributionStrategy(description = "") {
  const text = normText(description).toLowerCase();
  return {
    expand: shouldExpandGroupTarget(text),
    explicitOverride: hasExplicitMemberExpansionOverride(text),
    forceOverride: hasForceRenderPolicyExpansionOverride(text),
    flatten: text.includes("flatten members") || text.includes("all nested members") || text.includes("expand nested groups"),
    stagger: text.includes("stagger members") || text.includes("fan out") || text.includes("spread across members"),
    fanout: text.includes("fan out members") || text.includes("round robin members") || text.includes("rotate members"),
    mirror: text.includes("mirror members") || text.includes("reverse members"),
    alternate: text.includes("alternate members")
  };
}

function isHighRiskGroupRenderPolicy(category = "") {
  return inferRenderRiskLevel(category) === "high";
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

function collapseParentSubmodelOverlaps(targets = [], submodelsById = {}) {
  const rows = Array.isArray(targets) ? targets : [];
  if (!rows.length) return [];
  const submodelGraph = normalizeSubmodelGraph(submodelsById);
  const modelIds = new Set(rows.map((row) => normText(row?.modelName)).filter(Boolean));
  const riskySubmodelParents = new Set(
    rows
      .map((row) => submodelGraph[normText(row?.modelName)])
      .filter((entry) => entry && entry.parentId && isMaterialSubmodelRenderOverride(entry))
      .map((entry) => entry.parentId)
  );
  return rows.filter((row) => {
    const modelName = normText(row?.modelName);
    if (!modelName) return false;
    if (riskySubmodelParents.has(modelName)) return false;
    const parentId = normText(submodelGraph[modelName]?.parentId || parseSubmodelParentId(modelName));
    if (!parentId) return true;
    if (isMaterialSubmodelRenderOverride(submodelGraph[modelName])) return true;
    return !modelIds.has(parentId);
  });
}

function collapseSiblingSubmodelOverlaps(targets = [], submodelsById = {}) {
  const rows = Array.isArray(targets) ? targets : [];
  if (!rows.length) return [];
  const submodelGraph = normalizeSubmodelGraph(submodelsById);
  const out = [];
  const keptByParent = new Map();
  for (const row of rows) {
    const modelName = normText(row?.modelName);
    if (!modelName) continue;
    const entry = submodelGraph[modelName];
    if (!entry) {
      out.push(row);
      continue;
    }
    const parentId = normText(entry.parentId);
    const nodeChannels = entry.nodeChannels;
    if (!parentId || !nodeChannels.size) {
      out.push(row);
      continue;
    }
    const kept = keptByParent.get(parentId) || [];
    const overlaps = kept.some((other) => {
      if (!other?.nodeChannels?.size) return false;
      for (const ch of nodeChannels) {
        if (other.nodeChannels.has(ch)) return true;
      }
      return false;
    });
    if (overlaps) continue;
    kept.push({ modelName, nodeChannels });
    keptByParent.set(parentId, kept);
    out.push(row);
  }
  return out;
}

function resolveExplicitTargetModels(models = [], description = "", groupIds = [], groupsById = {}, submodelsById = {}, alternationSeed = 0) {
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
    const renderCategory = normText(group?.renderPolicy?.currentFamily || group?.renderPolicy?.category).toLowerCase();
    const preserveNonDefaultGroup = renderCategory && renderCategory !== "default" && !strategy.explicitOverride;
    const preserveHighRiskGroup = isHighRiskGroupRenderPolicy(renderCategory) && !strategy.forceOverride;
    if (preserveNonDefaultGroup) {
      out.push({ modelName: id, sourceGroupId: "" });
      continue;
    }
    if (preserveHighRiskGroup) {
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
  return collapseSiblingSubmodelOverlaps(collapseParentSubmodelOverlaps(deduped, submodelsById), submodelsById);
}

export function collectGroupRenderPolicyWarnings(sourceLines = [], { groupIds = [], groupsById = {} } = {}) {
  const lines = Array.isArray(sourceLines) ? sourceLines.filter(Boolean) : [];
  if (!lines.length) return [];
  const groupGraph = normalizeGroupGraph(groupsById, groupIds);
  const warnings = [];
  for (const line of lines) {
    const parsed = parseProposalLine(line);
    const strategy = inferGroupDistributionStrategy(parsed.description);
    if (!strategy.expand) continue;
    for (const modelName of parsed.models) {
      const id = normText(modelName);
      const group = groupGraph[id];
      const renderCategory = normText(group?.renderPolicy?.currentFamily || group?.renderPolicy?.category).toLowerCase();
      if (!group || !renderCategory || renderCategory === "default") continue;
      const defaultBufferStyle = normText(group?.renderPolicy?.defaultBufferStyle) || "non-default";
      if (isHighRiskGroupRenderPolicy(renderCategory) && !strategy.forceOverride) {
        warnings.push(
          `Preserving high-risk group render target ${id} (${defaultBufferStyle}); force member override required to expand this ${renderCategory} render policy.`
        );
        continue;
      }
      if (strategy.explicitOverride) continue;
      warnings.push(
        `Preserving group render target ${id} (${defaultBufferStyle}); explicit member override required to expand this non-default group render policy.`
      );
    }
  }
  return Array.from(new Set(warnings));
}

export function collectSubmodelRenderWarnings(sourceLines = [], { submodelsById = {}, targetIds = [] } = {}) {
  const lines = Array.isArray(sourceLines) ? sourceLines.filter(Boolean) : [];
  if (!lines.length) return [];
  const submodelGraph = normalizeSubmodelGraph(submodelsById);
  const warnings = [];
  for (const line of lines) {
    const parsed = parseProposalLine(line);
    const explicitModels = parsed.hasGenericScope && Array.isArray(targetIds) && targetIds.length
      ? targetIds.map((row) => normText(row)).filter(Boolean)
      : Array.isArray(parsed.models) ? parsed.models.map((row) => normText(row)).filter(Boolean) : [];
    if (explicitModels.length < 2) continue;
    const explicitSet = new Set(explicitModels);
    for (const modelName of explicitModels) {
      const entry = submodelGraph[modelName];
      if (!entry?.parentId) continue;
      if (!explicitSet.has(entry.parentId)) continue;
      if (!isMaterialSubmodelRenderOverride(entry)) continue;
      const bufferStyle = normText(entry?.renderPolicy?.bufferStyle || "Default");
      const submodelType = normText(entry?.renderPolicy?.submodelType || "ranges");
      warnings.push(
        `Preserving submodel target ${modelName} instead of collapsing into parent ${entry.parentId} because its local render path is materially different (${submodelType}, ${bufferStyle}).`
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
  const raw = String(line || "").trim();
  const parts = raw.split(/\s+\/\s+/).map((p) => normText(p));
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

function extractRequestedDurationMs(description = "") {
  const text = normText(description).toLowerCase();
  const msMatch = text.match(/\bfor\s+(\d{1,9})\s*ms\b/);
  if (msMatch) return Math.max(1, Number(msMatch[1]));
  const secMatch = text.match(/\bfor\s+(\d{1,6})\s*(seconds?|secs?|s)\b/);
  if (secMatch) return Math.max(1, Number(secMatch[1]) * 1000);
  return null;
}

function extractRequestedStartMs(description = "") {
  const text = normText(description).toLowerCase();
  if (text.includes("starting at 0 ms") || text.includes("start at 0 ms") || text.includes("at the beginning of the track")) {
    return 0;
  }
  const msMatch = text.match(/\bstarting at\s+(\d{1,9})\s*ms\b/);
  if (msMatch) return Math.max(0, Number(msMatch[1]));
  const secMatch = text.match(/\bstarting at\s+(\d{1,6})\s*(seconds?|secs?|s)\b/);
  if (secMatch) return Math.max(0, Number(secMatch[1]) * 1000);
  return null;
}

function inferPalette(description = "") {
  const text = normText(description).toLowerCase();
  const colorMap = {
    red: "#ff0000",
    green: "#00ff00",
    blue: "#0000ff",
    white: "#ffffff",
    warmwhite: "#ffd39b",
    warm: "#ffd39b",
    coolwhite: "#dff6ff",
    cool: "#dff6ff",
    yellow: "#ffff00",
    orange: "#ff7f00",
    purple: "#8000ff",
    pink: "#ff4fa3"
  };
  for (const [name, hex] of Object.entries(colorMap)) {
    if (text.includes(` in ${name}`) || text.includes(`${name} please`) || text.endsWith(name)) {
      return {
        C_BUTTON_Palette1: hex,
        C_CHECKBOX_Palette1: "1"
      };
    }
  }
  return {};
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

function shouldEnableModelBlendingForPlan(effectCommands = [], groupIds = []) {
  const rows = Array.isArray(effectCommands) ? effectCommands : [];
  const groups = new Set((Array.isArray(groupIds) ? groupIds : []).map((row) => normText(row)).filter(Boolean));
  let hasGroupTarget = false;
  let hasSpecificTarget = false;
  for (const row of rows) {
    const modelName = normText(row?.params?.modelName);
    if (!modelName) continue;
    if (groups.has(modelName)) {
      hasGroupTarget = true;
    } else {
      hasSpecificTarget = true;
    }
    if (hasGroupTarget && hasSpecificTarget) return true;
  }
  return false;
}

function buildSequenceSettingsCommand({ effectCommands = [], groupIds = [], sequenceSettings = {} } = {}) {
  const current = normalizeSequenceSettings(sequenceSettings);
  if (current.supportsModelBlending) return null;
  if (!shouldEnableModelBlendingForPlan(effectCommands, groupIds)) return null;
  return {
    id: "sequence.settings.update",
    dependsOn: ["timing.marks.insert"],
    cmd: "sequence.setSettings",
    params: {
      supportsModelBlending: true
    }
  };
}

function inferEffectNameFromDescription(description = "", effectCatalog = null) {
  const byName = normalizeEffectCatalog(effectCatalog);
  const text = normText(description).toLowerCase();
  const aliases = [
    { effectName: "On", patterns: [" on effect", "apply on", "make on", "simple on", "effect on"] },
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
    const parsed = parseProposalLine(label);
    const requestedStartMs = extractRequestedStartMs(parsed.description);
    const requestedDurationMs = extractRequestedDurationMs(parsed.description);
    const startMs = requestedStartMs != null ? requestedStartMs : idx * 1000;
    return {
      startMs,
      endMs: startMs + (requestedDurationMs != null ? requestedDurationMs : 1000),
      label
    };
  });
}

function buildSectionWindows(source = [], parsed = []) {
  const windows = new Map();
  for (let i = 0; i < source.length; i++) {
    const section = normText(parsed[i]?.section) || `Section ${i + 1}`;
    if (windows.has(section)) continue;
    const requestedStartMs = extractRequestedStartMs(parsed[i]?.description);
    const requestedDurationMs = extractRequestedDurationMs(parsed[i]?.description);
    const startMs = requestedStartMs != null ? requestedStartMs : i * 1000;
    const endMs = startMs + (requestedDurationMs != null ? requestedDurationMs : 1000);
    windows.set(section, { startMs, endMs });
  }
  return windows;
}

function buildEffectAnchor({
  trackName = "",
  section = "",
  window = null,
  distributed = false
} = {}) {
  const normalizedTrackName = normText(trackName) || "XD: Sequencer Plan";
  const normalizedSection = normText(section) || "General";
  const startMs = Number(window?.startMs || 0);
  const endMs = Number(window?.endMs || startMs + 1);
  return {
    kind: "timing_track",
    trackName: normalizedTrackName,
    markLabel: normalizedSection,
    startMs,
    endMs,
    basis: distributed ? "section_slice" : "section_window"
  };
}

function buildEffectTemplates(
  source = [],
  parsed = [],
  targetIds = [],
  effectCatalog = null,
  groupIds = [],
  groupsById = {},
  submodelsById = {},
  trackName = "XD: Sequencer Plan",
  enableEffectTimingAlignment = true
) {
  const fallbackTargets = inferTargets(source, targetIds);
  if (!fallbackTargets.length) return [];

  const groupGraph = normalizeGroupGraph(groupsById, groupIds);
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
      ? resolveExplicitTargetModels(row.models, row.description, groupIds, groupsById, submodelsById, alternationSeed)
      : fallbackTargets.map((modelName) => ({ modelName, sourceGroupId: "" }));
    models = collapseSiblingSubmodelOverlaps(collapseParentSubmodelOverlaps(models, submodelsById), submodelsById);
    if (row.hasGenericScope && Array.isArray(targetIds) && targetIds.length) {
      const orderedTargets = targetIds.map((v) => normText(v)).filter(Boolean);
      const firstAggregate = choosePrimaryAggregateTarget(orderedTargets, groupIds, groupsById);
      if (firstAggregate) {
        models = [{ modelName: firstAggregate, sourceGroupId: "" }];
      } else {
        models = collapseSiblingSubmodelOverlaps(
          collapseParentSubmodelOverlaps(orderedTargets.map((modelName) => ({ modelName, sourceGroupId: "" })), submodelsById),
          submodelsById
        );
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
        anchor: buildEffectAnchor({
          trackName,
          section: row.section,
          window: scopedWindow,
          distributed: Boolean(target?.sourceGroupId)
        }),
        cmd: "effects.create",
        params: {
          modelName,
          layerIndex,
          effectName,
          startMs: scopedWindow.startMs,
          endMs: scopedWindow.endMs,
          settings: inferSharedSettings(row.description),
          palette: inferPalette(row.description),
          sourceGroupId: normText(target?.sourceGroupId),
          sourceGroupRenderPolicy: normText(groupGraph[target?.sourceGroupId]?.renderPolicy?.currentFamily || groupGraph[target?.sourceGroupId]?.renderPolicy?.category),
          sourceGroupBufferStyle: normText(groupGraph[target?.sourceGroupId]?.renderPolicy?.defaultBufferStyle),
          sourceGroupRenderRisk: normText(groupGraph[target?.sourceGroupId]?.renderPolicy?.riskLevel)
        }
      });

      if (enableEffectTimingAlignment) {
        const effectNodeId = `effect.${out.length}`;
        out.push({
          id: `effect.align.${out.length}`,
          dependsOn: [effectNodeId],
          cmd: "effects.alignToTiming",
          params: {
            modelName,
            layerIndex,
            startMs: scopedWindow.startMs,
            endMs: scopedWindow.endMs,
            timingTrackName: normText(trackName) || "XD: Sequencer Plan",
            mode: "nearest"
          }
        });
      }
    }
  }

  return out.slice(0, 24);
}

export function buildDesignerPlanCommands(
  sourceLines = [],
  {
    trackName = "XD:ProposedPlan",
    targetIds = [],
    effectCatalog = null,
    sequenceSettings = {},
    displayElements = [],
    groupIds = [],
    groupsById = {},
    submodelsById = {},
    enableEffectTimingAlignment = true
  } = {}
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

  const effectCommands = buildEffectTemplates(
    source,
    parsed,
    targetIds,
    effectCatalog,
    groupIds,
    groupsById,
    submodelsById,
    trackName,
    enableEffectTimingAlignment
  ).map((row) => {
    const dependsOn = Array.isArray(row.dependsOn) ? row.dependsOn.slice() : [];
    if (displayOrderCommand && !dependsOn.includes(displayOrderCommand.id)) {
      dependsOn.push(displayOrderCommand.id);
    }
    return {
      ...row,
      dependsOn
    };
  });

  const sequenceSettingsCommand = buildSequenceSettingsCommand({
    effectCommands,
    groupIds,
    sequenceSettings
  });

  const normalizedEffectCommands = effectCommands.map((row) => {
    if (!sequenceSettingsCommand) return row;
    const dependsOn = Array.isArray(row.dependsOn) ? row.dependsOn.slice() : [];
    if (!dependsOn.includes(sequenceSettingsCommand.id)) {
      dependsOn.push(sequenceSettingsCommand.id);
    }
    return {
      ...row,
      dependsOn
    };
  });

  return baseCommands
    .concat(sequenceSettingsCommand ? [sequenceSettingsCommand] : [])
    .concat(displayOrderCommand ? [displayOrderCommand] : [])
    .concat(normalizedEffectCommands);
}

export {
  parseProposalLine
};
