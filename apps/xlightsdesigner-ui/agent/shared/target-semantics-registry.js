function normText(value = "") {
  return String(value || "").trim();
}

export const GENERIC_SCOPE_TOKENS = Object.freeze([
  "whole show",
  "whole yard",
  "global",
  "all",
  "all props"
]);

export const AGGREGATE_TARGET_PATTERNS = Object.freeze([
  /all/i,
  /group/i,
  /props/i,
  /outlines/i,
  /borders/i,
  /greens/i,
  /floods/i,
  /wreath/i,
  /snowflakes/i,
  /spirals/i,
  /train/i,
  /front/i,
  /upper/i,
  /bulbs/i
]);

export const GROUP_DISTRIBUTION_PHRASES = Object.freeze({
  expand: ["each member", "each prop", "per member", "per prop", "fan out", "spread across members", "distribute across members", "split across members", "stagger members", "alternate members"],
  explicitOverride: ["each member", "each prop", "per member", "per prop", "flatten members", "all nested members", "expand nested groups", "direct members"],
  forceOverride: ["flatten members", "all nested members", "expand nested groups", "direct members", "force member expansion"]
});

export function parseSubmodelParentId(targetId = "") {
  const id = normText(targetId);
  const slash = id.indexOf("/");
  if (slash <= 0) return "";
  return id.slice(0, slash);
}

export function inferBufferStyleFamily(style = "") {
  const key = normText(style).toLowerCase();
  if (!key || key === "default") return "default";
  if (key === "overlay" || key.includes("overlay")) return "overlay";
  if (key === "stack" || key.includes("stack")) return "stack";
  if (key === "single_line" || key.includes("single line")) return "single_line";
  if (key === "per_model_strand" || key.includes("per strand")) return "per_model_strand";
  if (key === "per_model" || key.includes("per model")) return "per_model";
  return "default";
}

export function inferRenderRiskLevel(family = "") {
  const key = normText(family).toLowerCase();
  if (key === "overlay" || key === "stack" || key === "single_line" || key === "per_model_strand") return "high";
  if (key === "per_model") return "medium";
  return "low";
}

export function isHighRiskGroupRenderPolicy(category = "") {
  return inferRenderRiskLevel(category) === "high";
}

export function isGenericScopeToken(raw = "") {
  return GENERIC_SCOPE_TOKENS.includes(normText(raw).toLowerCase());
}

export function normalizeSubmodelGraph(submodelsById = {}) {
  const out = {};
  if (!submodelsById || typeof submodelsById !== "object" || Array.isArray(submodelsById)) return out;
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
  return out;
}

export function isMaterialSubmodelRenderOverride(entry = null) {
  const submodelType = normText(entry?.renderPolicy?.submodelType || "ranges").toLowerCase() || "ranges";
  const bufferStyle = normText(entry?.renderPolicy?.bufferStyle || "Default");
  return submodelType !== "ranges" || (bufferStyle && bufferStyle.toLowerCase() !== "default");
}

export function normalizeGroupGraph(groupsById = {}, groupIds = []) {
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
      out[id] = {
        id,
        direct: new Set(direct.map((row) => normText(row?.id || row?.name)).filter(Boolean)),
        flattened: new Set(flattened.map((row) => normText(row?.id || row?.name)).filter(Boolean)),
        renderPolicy: {
          layout: normText(value?.renderPolicy?.layout),
          defaultBufferStyle,
          category: normText(value?.renderPolicy?.category || currentFamily || "default") || "default",
          currentFamily,
          riskLevel: inferRenderRiskLevel(currentFamily),
          availableBufferStyles,
          availableFamilies
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

export function looksLikeAggregateTarget(name = "", groupIds = [], groupsById = {}) {
  const text = normText(name);
  if (!text) return false;
  const groupGraph = normalizeGroupGraph(groupsById, groupIds);
  if (groupGraph[text]) return true;
  return AGGREGATE_TARGET_PATTERNS.some((pattern) => pattern.test(text));
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

export function choosePrimaryAggregateTarget(orderedTargets = [], groupIds = [], groupsById = {}) {
  const groupGraph = normalizeGroupGraph(groupsById, groupIds);
  const aggregateCandidates = orderedTargets.filter((id) => groupGraph[id] || looksLikeAggregateTarget(id, groupIds, groupsById));
  if (!aggregateCandidates.length) return "";
  const scored = aggregateCandidates
    .map((id) => ({ id, score: scoreAggregateTarget(id, orderedTargets, groupGraph) }))
    .sort((a, b) => b.score - a.score);
  return scored[0]?.id || aggregateCandidates[0] || "";
}

export function sortAggregateTargets(targetIds = [], groupIds = [], groupsById = {}) {
  const groupGraph = normalizeGroupGraph(groupsById, groupIds);
  return targetIds
    .filter((id) => looksLikeAggregateTarget(id, groupIds, groupsById))
    .slice()
    .sort((a, b) => scoreAggregateTarget(b, targetIds, groupGraph) - scoreAggregateTarget(a, targetIds, groupGraph));
}

function includesAnyPhrase(text = "", phrases = []) {
  return phrases.some((needle) => text.includes(needle));
}

export function shouldExpandGroupTarget(description = "") {
  const text = normText(description).toLowerCase();
  return includesAnyPhrase(text, GROUP_DISTRIBUTION_PHRASES.expand);
}

export function hasExplicitMemberExpansionOverride(description = "") {
  const text = normText(description).toLowerCase();
  return includesAnyPhrase(text, GROUP_DISTRIBUTION_PHRASES.explicitOverride);
}

export function hasForceRenderPolicyExpansionOverride(description = "") {
  const text = normText(description).toLowerCase();
  return includesAnyPhrase(text, GROUP_DISTRIBUTION_PHRASES.forceOverride);
}

export function inferGroupDistributionStrategy(description = "") {
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
