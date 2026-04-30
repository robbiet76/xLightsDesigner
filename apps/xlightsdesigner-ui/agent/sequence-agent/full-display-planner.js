import { resolveTranslationLayer } from "./translation-layer.js";
import {
  getStage1TrainedEffectBundle,
  recommendConfiguredBehaviorCapabilities,
  recommendLayerCompositionPriors
} from "./trained-effect-knowledge.js";
import {
  filterAvoidedEffects,
  recommendEffectsForTargets,
  recommendEffectsForVisualFamilies,
  resolveDirectCueEffectCandidates
} from "../shared/effect-semantics-registry.js";
import {
  looksLikeAggregateTarget,
  normalizeGroupGraph
} from "../shared/target-semantics-registry.js";

function normText(value = "") {
  return String(value || "").trim();
}

function normArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function uniqueNormTexts(values = []) {
  return [...new Set(normArray(values).map((row) => normText(row)).filter(Boolean))];
}

function buildSectionDirectiveIndex(designHandoff = null) {
  const index = new Map();
  for (const directive of normArray(designHandoff?.sectionDirectives)) {
    const section = normText(directive?.section || directive?.sectionName);
    if (section) index.set(section, directive);
  }
  return index;
}

export function collectEffectAvoidancesForTargets(targetIds = [], metadataAssignmentIndex = new Map()) {
  const out = [];
  const seen = new Set();
  for (const targetId of normArray(targetIds).map((row) => normText(row)).filter(Boolean)) {
    const assignment = metadataAssignmentIndex.get(targetId);
    const values = normArray(assignment?.effectAvoidances).map((row) => normText(row)).filter(Boolean);
    for (const value of values) {
      const key = value.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(value);
    }
  }
  return out;
}

export function collectDefinedVisualHintBehaviorTextForTargets(targetIds = [], metadataAssignmentIndex = new Map()) {
  const out = [];
  const seen = new Set();
  for (const targetId of normArray(targetIds).map((row) => normText(row)).filter(Boolean)) {
    const assignment = metadataAssignmentIndex.get(targetId);
    const definitions = normArray(assignment?.visualHintDefinitions);
    for (const definition of definitions) {
      const value = normText(definition?.behavioralIntent);
      const status = normText(definition?.status).toLowerCase();
      if (!value || (status && status !== "defined")) continue;
      const key = value.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(value);
    }
  }
  return out;
}

function normalizeVisualPaletteRows(rows = []) {
  return normArray(rows)
    .map((row) => ({
      name: normText(row?.name),
      hex: normText(row?.hex),
      role: normText(row?.role)
    }))
    .filter((row) => row.name || row.hex || row.role);
}

export function buildVisualDesignPlanningContext(sequencingDesignHandoff = null) {
  const paletteRows = normalizeVisualPaletteRows(sequencingDesignHandoff?.paletteRoles);
  const motifs = normArray(sequencingDesignHandoff?.motifDirectives).map((row) => normText(row)).filter(Boolean);
  const referencePatterns = sequencingDesignHandoff?.referenceSequencePatterns && typeof sequencingDesignHandoff.referenceSequencePatterns === "object"
    ? sequencingDesignHandoff.referenceSequencePatterns
    : null;
  const referenceEffects = normArray(referencePatterns?.commonEffects)
    .map((row) => normText(row?.name || row))
    .filter(Boolean)
    .slice(0, 12);
  const referenceDensity = referencePatterns?.densityPerMinute && typeof referencePatterns.densityPerMinute === "object"
    ? referencePatterns.densityPerMinute
    : {};
  const paletteText = paletteRows
    .map((row) => [row.name, row.role, row.hex].filter(Boolean).join(" "))
    .filter(Boolean)
    .join(", ");
  const motifText = motifs.join(", ");
  const referenceText = [
    referenceEffects.length ? `reference effects: ${referenceEffects.join(", ")}` : "",
    Number(referenceDensity.median) > 0 ? `reference density median: ${Number(referenceDensity.median)} commands/min` : "",
    Number(referencePatterns?.averageActiveTargets) > 0 ? `reference active targets: ${Number(referencePatterns.averageActiveTargets)}` : "",
    Number(referencePatterns?.averageLayeredTargets) > 0 ? `reference layered targets: ${Number(referencePatterns.averageLayeredTargets)}` : ""
  ].filter(Boolean).join("; ");
  const summaryParts = [
    paletteText ? `palette: ${paletteText}` : "",
    motifText ? `motifs: ${motifText}` : "",
    referenceText
  ].filter(Boolean);
  return {
    paletteRows,
    motifs,
    referenceSequencePatterns: referencePatterns,
    referenceEffects,
    referenceDensity,
    summaryText: summaryParts.join(" | ")
  };
}

function selectorReadyEffectSet() {
  return new Set(normArray(getStage1TrainedEffectBundle()?.selectorReadyEffects).map((row) => normText(row)).filter(Boolean));
}

function availableTrainingEffectSet(availableEffects = null) {
  const selectorReady = selectorReadyEffectSet();
  if (!availableEffects || !(availableEffects instanceof Set) || !availableEffects.size) return selectorReady;
  return new Set([...selectorReady].filter((effectName) => availableEffects.has(effectName)));
}

function filterAvailableTrainingEffects(effectNames = [], availableEffects = null, effectAvoidances = []) {
  const trainingReady = availableTrainingEffectSet(availableEffects);
  return filterAvoidedEffects(normArray(effectNames), effectAvoidances)
    .map((row) => normText(row))
    .filter((row) => row && trainingReady.has(row));
}

function inferFullDisplayVisualFamilies({ summary = "", sectionDirective = null, translationVisualFamilies = [], visualPlanningContext = null } = {}) {
  const text = [
    normText(summary),
    normText(sectionDirective?.sectionPurpose),
    normText(sectionDirective?.motionTarget),
    normText(sectionDirective?.densityTarget),
    normText(sectionDirective?.transitionIntent),
    ...normArray(sectionDirective?.preferredVisualFamilies),
    ...normArray(translationVisualFamilies),
    ...normArray(visualPlanningContext?.motifs)
  ].join(" ").toLowerCase();
  const families = new Set(normArray(sectionDirective?.preferredVisualFamilies));
  for (const row of normArray(translationVisualFamilies)) families.add(row);
  if (/full|whole|display|yard|big|bigger|build|peak|chorus|reveal/.test(text)) families.add("large_form_motion");
  if (/warm|glow|cozy|soft|texture|sparkle|twinkle|shimmer/.test(text)) families.add("soft_texture");
  if (/rhythm|beat|pulse|groove|phrase|downbeat|accent/.test(text)) families.add("segmented_directional");
  if (/flow|sweep|smooth|spiral|develop|motion/.test(text)) families.add("spiral_flow");
  if (/burst|hit|accent|radial|reveal|peak|bigger/.test(text)) families.add("radial_rotation");
  if (!families.size) {
    families.add("large_form_motion");
    families.add("soft_texture");
    families.add("segmented_directional");
  }
  return [...families];
}

function pickPortfolioEffect({ candidates = [], preferred = [], availableEffects = null, effectAvoidances = [], used = new Set() } = {}) {
  const ready = filterAvailableTrainingEffects([...candidates, ...preferred], availableEffects, effectAvoidances)
    .filter((effectName) => !used.has(effectName));
  const chosen = ready[0] || filterAvailableTrainingEffects([...preferred, ...candidates], availableEffects, effectAvoidances)[0] || "";
  if (chosen) used.add(chosen);
  return chosen;
}

function buildDeterministicEffectPortfolio({
  section = "",
  summary = "",
  energy = "",
  density = "",
  targetIds = [],
  displayElements = [],
  sectionDirective = null,
  availableEffects = null,
  effectAvoidances = [],
  visualHintBehaviorText = [],
  translationVisualFamilies = [],
  visualPlanningContext = null
} = {}) {
  const visualFamilies = inferFullDisplayVisualFamilies({
    summary: [summary, ...normArray(visualHintBehaviorText)].join(" "),
    sectionDirective,
    translationVisualFamilies,
    visualPlanningContext
  });
  const familyCandidates = recommendEffectsForVisualFamilies({
    preferredVisualFamilies: visualFamilies,
    targetIds,
    displayElements,
    limit: 10
  }).map((row) => row?.effectName);
  const trainedCandidates = recommendEffectsForTargets({
    summary: [summary, section, ...normArray(visualHintBehaviorText)].join(" "),
    energy,
    density,
    targetIds,
    displayElements,
    limit: 10
  }).map((row) => row?.effectName);
  const directCandidates = resolveDirectCueEffectCandidates({
    goalText: [summary, section].join(" "),
    smoothBias: /flow|smooth|glow|cinematic/.test(normText(summary).toLowerCase())
  });
  const configuredBehavior = recommendConfiguredBehaviorCapabilities({
    summary: [summary, section, energy, density].join(" "),
    preferredVisualFamilies: visualFamilies,
    desiredBehaviorHints: [
      energy,
      density,
      ...normArray(sectionDirective?.preferredVisualFamilies),
      ...normArray(visualHintBehaviorText),
      ...normArray(translationVisualFamilies)
    ],
    targetIds,
    displayElements,
    limit: 16
  });
  const rankedCandidates = filterAvailableTrainingEffects(
    [
      ...directCandidates,
      ...normArray(configuredBehavior?.recommendations).map((row) => row.effectName),
      ...normArray(visualPlanningContext?.referenceEffects),
      ...familyCandidates,
      ...trainedCandidates
    ],
    availableEffects,
    effectAvoidances
  );
  const used = new Set();
  return {
    artifactType: "deterministic_effect_portfolio_v1",
    selectionPolicy: "training_metadata_ranked_no_random",
    visualFamilies,
    rankedCandidates,
    configuredBehaviorRecommendations: normArray(configuredBehavior?.recommendations),
    configuredBehaviorRecordCount: Number(configuredBehavior?.recordCount || 0),
    referencePatternArtifactId: normText(visualPlanningContext?.referenceSequencePatterns?.artifactId),
    roles: {
      foundation: pickPortfolioEffect({ candidates: rankedCandidates, preferred: ["Color Wash", "On", "Shimmer"], availableEffects, effectAvoidances, used }),
      motion: pickPortfolioEffect({ candidates: rankedCandidates, preferred: ["Spirals", "Pinwheel", "Shockwave", "SingleStrand"], availableEffects, effectAvoidances, used }),
      rhythm: pickPortfolioEffect({ candidates: rankedCandidates, preferred: ["Bars", "Marquee", "SingleStrand"], availableEffects, effectAvoidances, used }),
      texture: pickPortfolioEffect({ candidates: rankedCandidates, preferred: ["Twinkle", "Shimmer", "Color Wash"], availableEffects, effectAvoidances, used }),
      accent: pickPortfolioEffect({ candidates: rankedCandidates, preferred: ["Shockwave", "Pinwheel", "Twinkle", "Bars"], availableEffects, effectAvoidances, used })
    }
  };
}

function metadataAssignmentForTarget(targetId = "", metadataAssignmentIndex = new Map()) {
  const id = normText(targetId);
  if (!id || !(metadataAssignmentIndex instanceof Map)) return null;
  return metadataAssignmentIndex.get(id) || metadataAssignmentIndex.get(id.toLowerCase()) || null;
}

function normalizedMetadataRoleForTarget(targetId = "", metadataAssignmentIndex = new Map()) {
  const assignment = metadataAssignmentForTarget(targetId, metadataAssignmentIndex);
  const explicitRole = normText(assignment?.rolePreference).toLowerCase();
  if (/primary|lead|hero|focal/.test(explicitRole)) return "lead";
  if (/occasional|accent|highlight|spark|punctuation|tertiary/.test(explicitRole)) return "accent";
  if (/support|background|framing|frame|rhythm|texture|volume|foundation/.test(explicitRole)) return "support";
  const text = [
    ...normArray(assignment?.tags),
    ...normArray(assignment?.semanticHints)
  ].join(" ").toLowerCase();
  if (!text) return "";
  if (/primary|lead|hero|focal|center stage/.test(text)) return "lead";
  if (/occasional|accent|highlight|spark|punctuation|tertiary/.test(text)) return "accent";
  if (/support|background|framing|frame|rhythm|texture|volume|foundation/.test(text)) return "support";
  return "";
}

function partitionFullDisplayTargets(targetIds = [], { metadataAssignmentIndex = new Map() } = {}) {
  const ids = uniqueNormTexts(targetIds);
  const byPattern = (pattern) => ids.filter((id) => pattern.test(id));
  const byMetadataRole = (rolePattern) => ids.filter((id) => rolePattern.test(normalizedMetadataRoleForTarget(id, metadataAssignmentIndex)));
  const metadataLead = byMetadataRole(/lead/);
  const metadataAccent = byMetadataRole(/accent/);
  const metadataSupport = byMetadataRole(/support/);
  const foundation = diversifyTargetIds(uniqueNormTexts([
    ...metadataSupport,
    ...byPattern(/allmodels|front|flood|house|tree|eave|gutter|border|outline|roof/i),
    ...ids.slice(0, 2)
  ])).slice(0, 8);
  const accent = diversifyTargetIds(uniqueNormTexts([
    ...metadataAccent,
    ...byPattern(/snow|cane|present|sign|star|spinner|northpole/i)
  ])).slice(0, 8);
  const motion = diversifyTargetIds(uniqueNormTexts([
    ...metadataLead,
    ...byPattern(/train|snowman|snowball|hiddentree|star|spinner|wreath|present/i)
  ])).slice(0, 8);
  const fallback = ids.slice(0, 1);
  return {
    foundation: foundation.length ? foundation : fallback,
    accent: accent.length ? accent : fallback,
    motion: motion.length ? motion : accent.slice(0, 2),
    all: ids
  };
}

function behaviorHintsForPlacementNeed({ role = "", targetRole = "", sectionBucket = "", sectionDirective = null } = {}) {
  const hints = [
    role,
    targetRole,
    sectionBucket,
    normText(sectionDirective?.energyTarget),
    normText(sectionDirective?.densityTarget),
    normText(sectionDirective?.motionTarget)
  ].filter(Boolean);
  const normalizedRole = normText(role).toLowerCase();
  const normalizedTargetRole = normText(targetRole).toLowerCase();
  const normalizedBucket = normText(sectionBucket).toLowerCase();
  if (/foundation|background|support/.test(normalizedRole)) hints.push("broad", "moderate", "smooth");
  if (/motion|rhythm|outline/.test(normalizedRole)) hints.push("moderate_motion", "directional", "section_contrast");
  if (/accent|feature|focal/.test(normalizedRole) || /accent|motion/.test(normalizedTargetRole)) hints.push("elevated", "visible", "contrast");
  if (/opening|ending/.test(normalizedBucket)) hints.push("restrained", "clean");
  if (/middle|late_body/.test(normalizedBucket)) hints.push("elevated", "dense");
  return uniqueNormTexts(hints);
}

function displayElementId(row = {}) {
  return normText(row?.id || row?.name || row?.modelName || row?.targetId);
}

function resolveFullDisplayTargetScope({ targetIds = [], displayElements = [] } = {}) {
  const selected = uniqueNormTexts(targetIds);
  const displayIds = uniqueNormTexts(normArray(displayElements).map((row) => displayElementId(row)));
  if (!displayIds.length) return selected;
  const byLower = new Map(displayIds.map((row) => [row.toLowerCase(), row]));
  const broadCandidates = [
    "AllModels",
    "AllModels_NoMatrix_Floods",
    "AllModels_NoMatrix",
    "AllModels_NoFloods",
    "FrontHouse",
    "FrontProps",
    "Borders",
    "Eaves",
    "UpperGutters",
    "Gutters",
    "Outlines",
    "Garland",
    "Floods",
    "Floods House",
    "Floods Trees",
    "Snowflakes",
    "Snowflakes_Large",
    "Snowflakes_Even",
    "Snowflakes_Odd",
    "CandyCanes",
    "MiniCanes",
    "Presents",
    "NorthPoleSign"
  ]
    .map((name) => byLower.get(normText(name).toLowerCase()))
    .filter(Boolean);
  const selectedLower = new Set(selected.map((row) => row.toLowerCase()));
  const additions = broadCandidates.filter((row) => !selectedLower.has(row.toLowerCase())).slice(0, 14);
  return uniqueNormTexts([...additions, ...selected]);
}

function displayElementIds(displayElements = []) {
  return uniqueNormTexts(normArray(displayElements).map((row) => displayElementId(row)));
}

function displayElementById(displayElements = []) {
  const out = new Map();
  for (const row of normArray(displayElements)) {
    const id = displayElementId(row);
    if (id) out.set(id.toLowerCase(), row);
  }
  return out;
}

function toFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function displayElementPosition(row = {}) {
  const x = toFiniteNumber(
    row?.positionX
    ?? row?.x
    ?? row?.centerX
    ?? row?.bounds?.centerX
    ?? row?.transform?.position?.x
  );
  const y = toFiniteNumber(
    row?.positionY
    ?? row?.y
    ?? row?.centerY
    ?? row?.bounds?.centerY
    ?? row?.transform?.position?.y
  );
  if (x == null || y == null) return null;
  return { x, y };
}

function computeDisplaySceneBounds(displayElements = []) {
  const positions = normArray(displayElements)
    .map((row) => displayElementPosition(row))
    .filter(Boolean);
  if (!positions.length) return null;
  const xs = positions.map((row) => row.x);
  const ys = positions.map((row) => row.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    minX,
    maxX,
    minY,
    maxY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
    centerX: minX + ((maxX - minX) / 2),
    centerY: minY + ((maxY - minY) / 2)
  };
}

function spatialInfoForTarget(targetId = "", { displayIndex = new Map(), sceneBounds = null } = {}) {
  const row = displayIndex.get(normText(targetId).toLowerCase());
  const position = displayElementPosition(row);
  if (!position || !sceneBounds || sceneBounds.width <= 0 || sceneBounds.height <= 0) {
    return {
      xBand: "unknown",
      yBand: "unknown",
      quadrant: "unknown",
      positionX: position?.x ?? null,
      positionY: position?.y ?? null
    };
  }
  const xBand = position.x < sceneBounds.centerX ? "left" : "right";
  const yBand = position.y < sceneBounds.centerY ? "top" : "bottom";
  return {
    xBand,
    yBand,
    quadrant: `${yBand}_${xBand}`,
    positionX: position.x,
    positionY: position.y
  };
}

function spatiallyDiversifyRows(rows = [], preferredOrder = ["top_left", "bottom_right", "top_right", "bottom_left", "unknown"]) {
  const buckets = new Map(preferredOrder.map((key) => [key, []]));
  for (const row of normArray(rows)) {
    const key = normText(row?.spatial?.quadrant) || "unknown";
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(row);
  }
  const orderedBuckets = [
    ...preferredOrder.map((key) => buckets.get(key)).filter(Boolean),
    ...[...buckets.entries()].filter(([key]) => !preferredOrder.includes(key)).map(([, value]) => value)
  ];
  const out = [];
  for (let round = 0; out.length < rows.length; round += 1) {
    let added = false;
    for (const bucket of orderedBuckets) {
      if (bucket[round]) {
        out.push(bucket[round]);
        added = true;
      }
    }
    if (!added) break;
  }
  return out;
}

function isConcreteDisplayModelRow(row = {}) {
  const type = normText(row?.type || row?.displayAs || row?.kind).toLowerCase();
  if (!type) return true;
  if (type === "timing") return false;
  return !(type === "model_group" || type === "model group" || type === "modelgroup" || type === "group");
}

function buildSpatialCoverageTargetRows({ displayElements = [], displayIndex = new Map(), sceneBounds = null, existingIds = new Set(), limit = 12 } = {}) {
  const rows = normArray(displayElements)
    .map((displayRow) => displayElementId(displayRow))
    .filter(Boolean)
    .filter((targetId) => !existingIds.has(targetId.toLowerCase()))
    .map((targetId) => {
      const displayRow = displayIndex.get(targetId.toLowerCase()) || {};
      return {
        targetId,
        targetRole: "support",
        layerable: false,
        targetGranularity: "target",
        spatialCoverageFiller: true,
        spatial: spatialInfoForTarget(targetId, { displayIndex, sceneBounds }),
        displayRow
      };
    })
    .filter((row) => isConcreteDisplayModelRow(row.displayRow))
    .filter((row) => normText(row.spatial?.quadrant) !== "unknown");
  const buckets = new Map();
  for (const row of rows) {
    const key = normText(row.spatial?.quadrant);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(row);
  }
  for (const bucket of buckets.values()) {
    bucket.sort((a, b) => {
      const yCompare = Math.abs(Number(b.spatial?.positionY || 0) - Number(sceneBounds?.centerY || 0))
        - Math.abs(Number(a.spatial?.positionY || 0) - Number(sceneBounds?.centerY || 0));
      if (yCompare !== 0) return yCompare;
      return normText(a.targetId).localeCompare(normText(b.targetId));
    });
  }
  const preferredOrder = ["bottom_left", "bottom_right", "top_left", "top_right"];
  return spatiallyDiversifyRows(preferredOrder.flatMap((key) => buckets.get(key) || []))
    .slice(0, Math.max(0, Number(limit) || 0))
    .map(({ displayRow, ...row }) => row);
}

function isDisplayElementAggregateTarget(targetId = "", { displayIndex = new Map(), groupIds = [], groupsById = {} } = {}) {
  const id = normText(targetId);
  const row = displayIndex.get(id.toLowerCase());
  const type = normText(row?.type || row?.displayAs || row?.kind).toLowerCase();
  if (type === "model_group" || type === "model group" || type === "modelgroup" || type === "group") return true;
  if (type === "model" || type === "submodel") return false;
  return looksLikeAggregateTarget(id, groupIds, groupsById);
}

function concreteTargetsForPattern(displayElements = [], pattern = null) {
  if (!pattern) return [];
  const displayIndex = displayElementById(displayElements);
  return displayElementIds(displayElements)
    .filter((id) => pattern.test(id))
    .filter((id) => {
      const row = displayIndex.get(id.toLowerCase());
      const type = normText(row?.type || row?.displayAs || row?.kind).toLowerCase();
      if (type) return type === "model" || type === "submodel";
      return !looksLikeAggregateTarget(id);
    });
}

function inferConcreteTargetsForScopeTarget(targetId = "", { displayElements = [], groupGraph = {} } = {}) {
  const id = normText(targetId);
  if (!id) return [];
  const group = groupGraph[id];
  const groupMembers = group
    ? [...(group.flattened?.size ? group.flattened : group.direct)]
    : [];
  if (groupMembers.length) return uniqueNormTexts(groupMembers).slice(0, 8);
  const lower = id.toLowerCase();
  if (lower === "snowflakes" || lower.startsWith("snowflakes")) return concreteTargetsForPattern(displayElements, /snowflake/i).slice(0, 8);
  if (lower === "candycanes") return concreteTargetsForPattern(displayElements, /^candycane-/i).slice(0, 8);
  if (lower === "minicanes") return concreteTargetsForPattern(displayElements, /^minicane-/i).slice(0, 8);
  if (lower === "floods house") return concreteTargetsForPattern(displayElements, /^flood_house-/i).slice(0, 8);
  if (lower === "floods trees") return concreteTargetsForPattern(displayElements, /^flood_tree-/i).slice(0, 8);
  if (lower === "floods") return concreteTargetsForPattern(displayElements, /^flood_/i).slice(0, 8);
  if (lower === "borders") return concreteTargetsForPattern(displayElements, /^border-/i).slice(0, 8);
  if (lower === "presents") return concreteTargetsForPattern(displayElements, /^present-/i).slice(0, 8);
  if (lower === "eaves") return concreteTargetsForPattern(displayElements, /gutter|eave/i).slice(0, 8);
  return [];
}

function targetDiversityKey(targetId = "") {
  const lower = normText(targetId).toLowerCase();
  if (/allmodels/.test(lower)) return "whole_display";
  if (/fronthouse/.test(lower)) return "front_house";
  if (/frontprops/.test(lower)) return "front_props";
  if (/outline/.test(lower)) return "outlines";
  if (/snowflake/.test(lower)) return "snowflakes";
  if (/candycane/.test(lower)) return "candycanes";
  if (/minicane/.test(lower)) return "minicanes";
  if (/flood_house/.test(lower)) return "floods_house";
  if (/flood_tree/.test(lower)) return "floods_trees";
  if (/^flood/.test(lower)) return "floods";
  if (/present/.test(lower)) return "presents";
  if (/border/.test(lower)) return "borders";
  if (/gutter|eave|garland/.test(lower)) return "eaves";
  if (/northpole/.test(lower)) return "north_pole";
  return lower.replace(/[-_ ]?\d+$/i, "") || lower;
}

function diversifyRowsByKey(rows = [], keyForRow = (row) => normText(row?.targetId)) {
  const buckets = new Map();
  for (const row of normArray(rows)) {
    const key = normText(keyForRow(row)) || "target";
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(row);
  }
  const out = [];
  for (let round = 0; out.length < rows.length; round += 1) {
    let added = false;
    for (const bucket of buckets.values()) {
      if (bucket[round]) {
        out.push(bucket[round]);
        added = true;
      }
    }
    if (!added) break;
  }
  return out;
}

function diversifyTargetIds(targetIds = []) {
  return diversifyRowsByKey(
    uniqueNormTexts(targetIds).map((targetId) => ({ targetId })),
    (row) => targetDiversityKey(row?.targetId)
  ).map((row) => row.targetId);
}

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, number));
}

function fullDisplayBucketForSection(index, totalSections) {
  const total = Math.max(1, Number(totalSections) || 1);
  const ratio = total <= 1 ? 0 : index / Math.max(1, total - 1);
  if (ratio <= 0.12) return "opening";
  if (ratio <= 0.38) return "early_body";
  if (ratio <= 0.66) return "middle";
  if (ratio <= 0.88) return "late_body";
  return "ending";
}

function referenceEffectsForBucket(referencePatterns = null, bucket = "") {
  const bucketRows = referencePatterns?.bucketEffectPatterns && typeof referencePatterns.bucketEffectPatterns === "object"
    ? referencePatterns.bucketEffectPatterns[bucket]
    : [];
  return normArray(bucketRows)
    .map((row) => normText(row?.name || row))
    .filter(Boolean);
}

function buildReferenceGuidedFullDisplayScale({ sectionRows = [], targetIds = [], expandedTargetIds = [], sequenceSettings = {}, visualPlanningContext = null } = {}) {
  const durationMs = Number(sequenceSettings?.durationMs);
  const sectionDurationMs = normArray(sectionRows).reduce((sum, row) => {
    const start = Number(row?.startMs);
    const end = Number(row?.endMs);
    return Number.isFinite(start) && Number.isFinite(end) && end > start ? sum + (end - start) : sum;
  }, 0);
  const effectiveDurationMs = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : sectionDurationMs;
  const durationMinutes = Math.max(0.25, effectiveDurationMs / 60000);
  const referencePatterns = visualPlanningContext?.referenceSequencePatterns || null;
  const density = referencePatterns?.densityPerMinute && typeof referencePatterns.densityPerMinute === "object"
    ? referencePatterns.densityPerMinute
    : {};
  const referenceP25 = Number(density.p25);
  const referenceMedian = Number(density.median);
  const baselineDensity = Number.isFinite(referenceP25) && referenceP25 > 0
    ? referenceP25
    : (Number.isFinite(referenceMedian) && referenceMedian > 0 ? referenceMedian * 0.45 : 24);
  const boundedDensity = clampNumber(baselineDensity * 0.48, 18, 64);
  const targetTotalPlacements = Math.round(clampNumber(durationMinutes * boundedDensity, 24, 260));
  const sectionCount = Math.max(1, normArray(sectionRows).length);
  const targetCount = Math.max(1, uniqueNormTexts(targetIds).length);
  const expandedTargetCount = Math.max(targetCount, uniqueNormTexts(expandedTargetIds).length);
  const referenceActiveTargets = Number(referencePatterns?.averageActiveTargets);
  const activeTargetGoal = Math.round(clampNumber(
    Number.isFinite(referenceActiveTargets) && referenceActiveTargets > 0 ? referenceActiveTargets * 0.8 : Math.max(targetCount, expandedTargetCount * 0.65),
    Math.min(expandedTargetCount, 12),
    expandedTargetCount
  ));
  const referenceLayeredTargets = Number(referencePatterns?.averageLayeredTargets);
  const layeredTargetGoal = Math.round(clampNumber(
    Number.isFinite(referenceLayeredTargets) && referenceLayeredTargets > 0 ? referenceLayeredTargets * 0.55 : Math.ceil(activeTargetGoal * 0.25),
    Math.min(activeTargetGoal, 2),
    activeTargetGoal
  ));
  const placementsPerSection = Math.max(4, Math.ceil(targetTotalPlacements / sectionCount));
  const targetsPerWindow = Math.min(activeTargetGoal, Math.max(6, Math.min(12, Math.ceil(activeTargetGoal * 0.28))));
  const windowsPerSection = Math.max(1, Math.ceil(placementsPerSection / targetsPerWindow));
  return {
    durationMinutes,
    boundedDensity,
    targetTotalPlacements,
    activeTargetGoal,
    layeredTargetGoal,
    placementsPerSection,
    targetsPerWindow,
    windowsPerSection,
    referenceDensityBasis: {
      p25: Number.isFinite(referenceP25) ? referenceP25 : 0,
      median: Number.isFinite(referenceMedian) ? referenceMedian : 0
    }
  };
}

function buildFullDisplayTargetSequence({ targetBands = {}, scale = {}, displayElements = [], groupIds = [], groupsById = {} } = {}) {
  const groupGraph = normalizeGroupGraph(groupsById, groupIds);
  const displayIndex = displayElementById(displayElements);
  const sceneBounds = computeDisplaySceneBounds(displayElements);
  const decorateSpatial = (row = {}) => ({
    ...row,
    spatial: spatialInfoForTarget(row?.targetId, { displayIndex, sceneBounds })
  });
  const targetGranularityFor = (targetId = "") => (
    isDisplayElementAggregateTarget(targetId, { displayIndex, groupIds, groupsById }) ? "group" : "target"
  );
  const memberLimit = Math.max(3, Math.min(12, Math.ceil((Number(scale.activeTargetGoal) || 24) / Math.max(1, uniqueNormTexts(targetBands.all).length))));
  const memberRowsForTargets = (targetIds = [], targetRole = "") => normArray(targetIds).flatMap((targetId, targetIndex) => {
    const members = inferConcreteTargetsForScopeTarget(targetId, { displayElements, groupGraph });
    return members.slice(0, memberLimit).map((memberId, memberIndex) => ({
      targetId: memberId,
      targetRole,
      layerable: false,
      sourceAggregateTargetId: targetId,
      targetGranularity: "member",
      memberOrder: (targetIndex * 10) + memberIndex
    }));
  });
  const roleRows = [
    ...normArray(targetBands.foundation).map((targetId) => ({ targetId, targetRole: "foundation", layerable: true, targetGranularity: targetGranularityFor(targetId) })),
    ...memberRowsForTargets(targetBands.foundation, "foundation"),
    ...normArray(targetBands.motion).map((targetId) => ({ targetId, targetRole: "motion", layerable: true, targetGranularity: targetGranularityFor(targetId) })),
    ...memberRowsForTargets(targetBands.motion, "motion"),
    ...normArray(targetBands.accent).map((targetId) => ({ targetId, targetRole: "accent", layerable: true, targetGranularity: targetGranularityFor(targetId) })),
    ...memberRowsForTargets(targetBands.accent, "accent"),
    ...normArray(targetBands.all).map((targetId) => ({ targetId, targetRole: "support", layerable: false, targetGranularity: targetGranularityFor(targetId) })),
    ...memberRowsForTargets(targetBands.all, "support")
  ];
  const seen = new Set();
  const rows = [];
  for (const row of roleRows) {
    const targetId = normText(row.targetId);
    const key = targetId.toLowerCase();
    if (!targetId || seen.has(key)) continue;
    seen.add(key);
    rows.push(decorateSpatial({ ...row, targetId }));
  }
  const limit = Math.max(1, Number(scale.activeTargetGoal) || rows.length);
  const coverageRows = buildSpatialCoverageTargetRows({
    displayElements,
    displayIndex,
    sceneBounds,
    existingIds: seen,
    limit: Math.max(8, Math.ceil(limit * 0.45))
  });
  for (const row of coverageRows) {
    const targetId = normText(row.targetId);
    const key = targetId.toLowerCase();
    if (!targetId || seen.has(key)) continue;
    seen.add(key);
    rows.push(row);
  }
  const aggregateRows = rows.filter((row) => row.targetGranularity === "group");
  const directTargetRows = spatiallyDiversifyRows(diversifyRowsByKey(
    rows.filter((row) => row.targetGranularity === "target"),
    (row) => targetDiversityKey(row?.targetId)
  ));
  const concreteRows = rows.filter((row) => row.targetGranularity === "member");
  const diverseConcreteRows = spatiallyDiversifyRows(diversifyRowsByKey(concreteRows, (row) => row.sourceAggregateTargetId || targetDiversityKey(row?.targetId)));
  const mixedIds = uniqueNormTexts([
    ...spatiallyDiversifyRows(aggregateRows).slice(0, Math.min(8, Math.max(3, Math.ceil(limit * 0.18)))).map((row) => row.targetId),
    ...directTargetRows.slice(0, Math.max(12, Math.ceil(limit * 0.34))).map((row) => row.targetId),
    ...diverseConcreteRows.slice(0, Math.max(18, Math.floor(limit * 0.56))).map((row) => row.targetId),
    ...coverageRows.map((row) => row.targetId),
    ...rows.map((row) => row.targetId)
  ]).slice(0, Math.max(limit, Math.min(rows.length, limit + 12)));
  return mixedIds.map((targetId) => rows.find((row) => row.targetId === targetId)).filter(Boolean);
}

function buildPaletteIntentForPlacement({ visualPlanningContext = null, row = {}, placementIndex = 0 } = {}) {
  const paletteRows = normArray(visualPlanningContext?.paletteRows)
    .map((paletteRow) => ({
      name: normText(paletteRow?.name),
      hex: normText(paletteRow?.hex),
      role: normText(paletteRow?.role)
    }))
    .filter((paletteRow) => /^#[0-9a-f]{6}$/i.test(paletteRow.hex));
  if (!paletteRows.length) return null;
  const canonicalPaletteRows = [];
  const forward = paletteRows.slice(0, 8);
  const reverse = forward.slice().reverse();
  for (let cycle = 0; canonicalPaletteRows.length < 8; cycle += 1) {
    const source = cycle % 2 === 0 ? forward : reverse;
    for (const paletteRow of source) {
      if (canonicalPaletteRows.length >= 8) break;
      canonicalPaletteRows.push({
        ...paletteRow,
        role: paletteRow.role || paletteRow.name || (cycle % 2 === 0 ? "forward palette color" : "reverse palette color")
      });
    }
  }
  const role = normText(row?.compositionRole || row?.role).toLowerCase();
  const desiredCount = role === "accent" || role === "focal" ? 3 : (role === "background" ? 2 : 4);
  const colorCount = Math.min(canonicalPaletteRows.length, desiredCount);
  const offset = Math.abs(Number(placementIndex) || 0) % canonicalPaletteRows.length;
  const activePaletteIndexes = [];
  for (let index = 0; index < colorCount; index += 1) {
    activePaletteIndexes.push(((offset + index) % canonicalPaletteRows.length) + 1);
  }
  return {
    colors: activePaletteIndexes.map((index) => canonicalPaletteRows[index - 1]?.hex).filter(Boolean),
    paletteColors: canonicalPaletteRows.map((paletteRow) => paletteRow.hex),
    activePaletteIndexes,
    colorRoles: activePaletteIndexes.map((index) => canonicalPaletteRows[index - 1]?.role || canonicalPaletteRows[index - 1]?.name).filter(Boolean),
    brightness: role === "accent" || role === "focal" || Number(row?.layerIndex || 0) > 0 ? "medium_high" : "medium",
    contrast: role === "accent" || role === "focal" ? "high" : "medium",
    saturation: "medium",
    source: "sequencing_design_handoff_palette"
  };
}

function progressionIntentForBucket(bucket = "") {
  const key = normText(bucket);
  if (key === "opening") return "establish_theme";
  if (key === "early_body") return "develop_motion";
  if (key === "middle") return "lift_or_contrast";
  if (key === "late_body") return "sustain_peak";
  if (key === "ending") return "resolve";
  return "hold";
}

function expectedBalanceForBucket(bucket = "", densityTarget = "") {
  const density = normText(densityTarget).toLowerCase();
  if (bucket === "opening" || bucket === "ending" || density === "sparse") {
    return {
      spatialBreadth: "moderate",
      leftRightBalance: "balanced",
      topBottomBalance: "balanced",
      negativeSpace: "intentional"
    };
  }
  if (bucket === "middle" || bucket === "late_body" || density === "dense" || density === "very_dense") {
    return {
      spatialBreadth: "broad",
      leftRightBalance: "balanced",
      topBottomBalance: "balanced",
      negativeSpace: "minimal"
    };
  }
  return {
    spatialBreadth: "moderate_broad",
    leftRightBalance: "balanced",
    topBottomBalance: "balanced",
    negativeSpace: "some"
  };
}

function choosePlacementRole(targetRole = "", index = 0) {
  const role = normText(targetRole) || "support";
  const cycles = {
    foundation: ["foundation", "texture", "support"],
    motion: ["motion", "feature", "rhythm"],
    accent: ["accent", "rhythm", "outline"],
    support: ["support", "texture", "foundation"]
  };
  const rows = cycles[role] || cycles.support;
  return rows[Math.abs(Number(index) || 0) % rows.length] || role;
}

function compositionRoleForPlacement(role = "", targetRole = "", layerIndex = 0) {
  if (Number(layerIndex) > 0) return "layer_stack";
  const text = [role, targetRole].map((row) => normText(row)).join(" ");
  if (/\b(feature|motion)\b/.test(text)) return "focal";
  if (/\b(accent|rhythm|outline)\b/.test(text)) return "accent";
  if (/\b(foundation|texture)\b/.test(text)) return "background";
  return "support";
}

function layerCompositionIntentForPlacement({ compositionLayerPass = "", compositionRole = "", layerIndex = 0, targetGranularity = "" } = {}) {
  if (Number(layerIndex) > 0) return "two_layer_stack";
  const pass = normText(compositionLayerPass);
  const role = normText(compositionRole);
  const granularity = normText(targetGranularity);
  if (pass === "foundation" || role === "background") return "foundation";
  if (granularity === "group" && (role === "focal" || pass === "focal")) return "foundation_plus_model_focus";
  if (role === "focal" || pass === "focal") return "model_focus";
  if (pass === "detail") return "three_layer_stack";
  return "composition_stack";
}

function layerCompositionFamilyForPlacement({ layerIndex = 0, sourceAggregateTargetId = "", targetGranularity = "" } = {}) {
  if (Number(layerIndex) > 0) return "same_target_layer_stack";
  if (normText(sourceAggregateTargetId) || normText(targetGranularity) === "member") return "group_model_interplay";
  return "group_model_interplay";
}

function targetScopeForPlacement(targetRow = {}) {
  const granularity = normText(targetRow?.targetGranularity);
  if (granularity === "group") return "group";
  if (granularity === "member") return "model";
  return "model";
}

function displayElementForTarget(targetId = "", displayElements = []) {
  const id = normText(targetId);
  return normArray(displayElements).find((row) => normText(row?.id || row?.name) === id) || {};
}

function roughModelTypeForDisplayElement(row = {}) {
  const text = normText(row?.displayAs || row?.displayType || row?.type).toLowerCase();
  if (/arch/.test(text)) return "arch";
  if (/spinner/.test(text)) return "spinner";
  if (/star/.test(text)) return "star";
  if (/matrix/.test(text)) return "matrix";
  if (/tree/.test(text)) return "tree";
  if (/cane/.test(text)) return "cane";
  if (/icicle/.test(text)) return "icicles";
  if (/line/.test(text)) return "single_line";
  return "";
}

function layerCompositionGuidanceForPlacement({
  row = {},
  targetRow = {},
  displayElements = [],
  paletteIntent = null
} = {}) {
  const targetDisplay = displayElementForTarget(targetRow?.targetId, displayElements);
  const geometryProfile = normText(
    targetDisplay?.geometryProfile
    || targetDisplay?.trainingGeometryProfile
    || targetDisplay?.modelGeometryProfile
    || targetDisplay?.metadata?.geometryProfile
  );
  const targetScope = targetScopeForPlacement(targetRow);
  const compositionIntent = layerCompositionIntentForPlacement({
    compositionLayerPass: row.compositionLayerPass,
    compositionRole: row.compositionRole,
    layerIndex: row.layerIndex,
    targetGranularity: targetRow.targetGranularity
  });
  const family = layerCompositionFamilyForPlacement({
    layerIndex: row.layerIndex,
    sourceAggregateTargetId: row.sourceAggregateTargetId,
    targetGranularity: targetRow.targetGranularity
  });
  const activePaletteCount = normArray(paletteIntent?.activePaletteIndexes).length;
  const paletteProfile = activePaletteCount > 1 ? "rgb_primary" : "mono_white";
  const desiredOutcomeTags = uniqueNormTexts([
    "scene_spread_increased",
    paletteProfile === "rgb_primary" ? "multicolor_increased" : "",
    Number(row.layerIndex) > 0 ? "active_models_added" : "coverage_added"
  ]);
  return recommendLayerCompositionPriors({
    compositionIntent,
    family,
    paletteProfile,
    targetScopes: [targetScope],
    modelTypes: [roughModelTypeForDisplayElement(targetDisplay)].filter(Boolean),
    geometryProfiles: [geometryProfile].filter(Boolean),
    effectNames: [row.effectName],
    layerIndexes: [row.layerIndex],
    desiredOutcomeTags,
    includeStaged: true,
    limit: 3
  });
}

const FULL_DISPLAY_LAYER_PASSES = [
  {
    name: "foundation",
    order: 0,
    purpose: "establish base color, glow, and broad display coverage",
    targetRoles: ["foundation", "support"],
    roleCycle: ["foundation", "texture", "support"],
    share: 0.32
  },
  {
    name: "structure",
    order: 1,
    purpose: "add readable musical shape, rhythm, and display structure",
    targetRoles: ["foundation", "support"],
    roleCycle: ["rhythm", "outline", "support"],
    share: 0.26
  },
  {
    name: "focal",
    order: 2,
    purpose: "place the viewer's primary attention on lead props or lead groups",
    targetRoles: ["motion"],
    roleCycle: ["feature", "motion", "rhythm"],
    share: 0.27
  },
  {
    name: "detail",
    order: 3,
    purpose: "add accents, punctuation, sparkle, and short detail over the base read",
    targetRoles: ["accent", "motion"],
    roleCycle: ["accent", "rhythm", "outline"],
    share: 0.15
  }
];

function rowsForLayerPass(targetSequence = [], layerPass = {}) {
  const roles = new Set(normArray(layerPass.targetRoles).map((row) => normText(row)));
  const matched = normArray(targetSequence).filter((row) => roles.has(normText(row?.targetRole)));
  return matched.length ? matched : normArray(targetSequence);
}

function targetRowsForLayerPassWindow({
  targetSequence = [],
  layerPass = {},
  count = 1,
  offset = 0
} = {}) {
  const candidates = rowsForLayerPass(targetSequence, layerPass);
  if (!candidates.length) return [];
  const out = [];
  const wanted = Math.max(0, Number(count) || 0);
  for (let index = 0; index < wanted; index += 1) {
    out.push(candidates[(Math.abs(Number(offset) || 0) + index) % candidates.length]);
  }
  return out;
}

function roleForLayerPass(layerPass = {}, ordinal = 0) {
  const cycle = normArray(layerPass.roleCycle);
  return cycle[Math.abs(Number(ordinal) || 0) % Math.max(1, cycle.length)] || normText(layerPass.name) || "support";
}

function shouldUsePhysicalOverlayLayer({ layerPass = {}, targetRow = {}, layeredTargetIds = new Set(), sectionIndex = 0, windowIndex = 0, targetOrdinal = 0, layerCadence = 3 } = {}) {
  const passName = normText(layerPass?.name);
  if (passName === "foundation" || passName === "structure") return false;
  const targetId = normText(targetRow?.targetId);
  const targetIsLayerable = targetRow?.layerable !== false;
  if (!targetIsLayerable) return false;
  if (layeredTargetIds.has(targetId)) return true;
  return ((Number(sectionIndex) + Number(windowIndex) + Number(targetOrdinal)) % Math.max(1, Number(layerCadence) || 1)) === 0;
}

function layerPassSummary(rowsForSection = []) {
  return FULL_DISPLAY_LAYER_PASSES.map((layerPass) => {
    const rows = normArray(rowsForSection).filter((row) => normText(row?.compositionLayerPass) === layerPass.name);
    return {
      name: layerPass.name,
      order: layerPass.order,
      purpose: layerPass.purpose,
      placementCount: rows.length,
      targets: uniqueNormTexts(rows.map((row) => row.targetId)).slice(0, 10),
      effects: uniqueNormTexts(rows.map((row) => row.effectName)).slice(0, 10)
    };
  }).filter((row) => row.placementCount > 0);
}

function sectionIntensityMultiplier({ sectionDirective = null, sectionPlan = null, sectionBucket = "" } = {}) {
  const text = [
    normText(sectionDirective?.energyTarget),
    normText(sectionDirective?.densityTarget),
    normText(sectionDirective?.sectionPurpose),
    normText(sectionDirective?.transitionIntent),
    normText(sectionPlan?.energy),
    normText(sectionPlan?.density),
    normText(sectionPlan?.intentSummary)
  ].join(" ").toLowerCase();
  let multiplier = 1;
  if (/\b(sparse|minimal|quiet|rest|negative space|low)\b/.test(text)) multiplier -= 0.25;
  if (/\b(medium|moderate|steady)\b/.test(text)) multiplier += 0.05;
  if (/\b(dense|high|lift|build|chorus|big|full|wide)\b/.test(text)) multiplier += 0.25;
  if (/\b(very dense|peak|finale|climax|maximum)\b/.test(text)) multiplier += 0.2;
  if (sectionBucket === "opening" || sectionBucket === "ending") multiplier -= 0.1;
  if (sectionBucket === "middle" || sectionBucket === "late_body") multiplier += 0.1;
  return clampNumber(multiplier, 0.65, 1.55);
}

function splitSectionIntoContiguousWindows(sectionRow = {}, count = 1) {
  const start = Number(sectionRow?.startMs);
  const end = Number(sectionRow?.endMs);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
  const windowCount = Math.max(1, Number(count) || 1);
  const duration = end - start;
  const windows = [];
  for (let index = 0; index < windowCount; index += 1) {
    const windowStart = index === 0 ? start : Math.round(start + ((duration * index) / windowCount));
    const windowEnd = index === windowCount - 1 ? end : Math.round(start + ((duration * (index + 1)) / windowCount));
    if (windowEnd > windowStart) windows.push({ startMs: windowStart, endMs: windowEnd });
  }
  return windows;
}

function inferFullDisplaySequencePass({ scope = {}, strategySectionPlans = [] } = {}) {
  if (normArray(scope?.executionStrategy?.effectPlacements).length) return false;
  const targetCount = normArray(scope?.targetIds).length;
  if (targetCount < 5) return false;
  const passScope = normText(scope?.executionStrategy?.passScope);
  if (passScope === "whole_sequence" || passScope === "multi_section") return true;
  const text = [
    normText(scope?.goal),
    ...normArray(strategySectionPlans).map((row) => normText(row?.intentSummary))
  ].join(" ").toLowerCase();
  return targetCount >= 5 && /\b(full|whole|complete|display|yard|song|sequence)\b/.test(text);
}

function buildAnalysisSectionRowsForFullPass({ analysisHandoff = {}, scope = {}, sequenceSettings = {} } = {}) {
  const rows = normArray(analysisHandoff?.structure?.sections)
    .map((row, index) => ({
      section: normText(typeof row === "string" ? row : row?.label || row?.name) || `Section ${index + 1}`,
      startMs: Number(row?.startMs),
      endMs: Number(row?.endMs)
    }))
    .filter((row) => row.section && Number.isFinite(row.startMs) && Number.isFinite(row.endMs) && row.endMs > row.startMs);
  if (rows.length) return rows.slice(0, 12);
  const durationMs = Number(sequenceSettings?.durationMs);
  if (Number.isFinite(durationMs) && durationMs > 1) {
    return [{ section: normArray(scope?.sectionNames)[0] || "Full Sequence", startMs: 0, endMs: durationMs - 1 }];
  }
  return [];
}

function emptyFullDisplayPlan() {
  return {
    compositionPlan: null,
    effectPlacements: []
  };
}

export function buildFullDisplayPlan({
  scope = {},
  analysisHandoff = {},
  sequenceSettings = {},
  displayElements = [],
  groupIds = [],
  groupsById = {},
  availableEffects = null,
  metadataAssignmentIndex = new Map(),
  visualPlanningContext = null,
  sequencerRevisionBrief = null,
  buildParameterPriorGuidance = () => ({}),
  buildSharedSettingPriorGuidance = () => ({})
} = {}) {
  const strategySectionPlans = normArray(scope?.executionStrategy?.sectionPlans);
  if (!inferFullDisplaySequencePass({ scope, strategySectionPlans })) return emptyFullDisplayPlan();
  const sectionRows = buildAnalysisSectionRowsForFullPass({ analysisHandoff, scope, sequenceSettings });
  if (!sectionRows.length) return emptyFullDisplayPlan();
  const fullDisplayTargetIds = resolveFullDisplayTargetScope({
    targetIds: scope?.targetIds,
    displayElements
  });
  const targetBands = partitionFullDisplayTargets(fullDisplayTargetIds, { metadataAssignmentIndex });
  if (!targetBands.all.length) return emptyFullDisplayPlan();
  const groupGraph = normalizeGroupGraph(groupsById, groupIds);
  const expandedFullDisplayTargetIds = uniqueNormTexts([
    ...fullDisplayTargetIds,
    ...fullDisplayTargetIds.flatMap((targetId) => inferConcreteTargetsForScopeTarget(targetId, { displayElements, groupGraph }))
  ]);
  const defaultSectionPlan = strategySectionPlans[0] || {};
  const sectionDirectiveIndex = buildSectionDirectiveIndex(scope?.sequencingDesignHandoff);
  const placements = [];
  const compositionSections = [];
  const seenPlacementKeys = new Set();
  const maxSections = Math.min(sectionRows.length, 12);
  const plannedSections = sectionRows.slice(0, maxSections);
  const scale = buildReferenceGuidedFullDisplayScale({
    sectionRows: plannedSections,
    targetIds: fullDisplayTargetIds,
    expandedTargetIds: expandedFullDisplayTargetIds,
    sequenceSettings,
    visualPlanningContext
  });
  const targetSequence = buildFullDisplayTargetSequence({ targetBands, scale, displayElements, groupIds, groupsById });
  const layeredTargetIds = new Set(targetSequence.filter((row) => row.layerable).slice(0, scale.layeredTargetGoal).map((row) => row.targetId));
  const chooseEffectForRole = (roles = {}, role = "", bucketEffects = [], rankedCandidates = [], offset = 0) => {
    const rankedSet = new Set(normArray(rankedCandidates).map((row) => normText(row)).filter(Boolean));
    const availableBucketEffects = normArray(bucketEffects)
      .map((row) => normText(row))
      .filter((effectName) => effectName && rankedSet.has(effectName));
    const preferred = {
      foundation: roles.foundation,
      motion: roles.motion,
      rhythm: roles.rhythm,
      texture: roles.texture,
      accent: roles.accent,
      support: normArray(rankedCandidates)[3] || roles.foundation || roles.texture,
      outline: normArray(rankedCandidates)[4] || roles.rhythm || roles.motion,
      feature: normArray(rankedCandidates)[5] || roles.accent || roles.motion
    };
    const rolePreferred = normText(preferred[role] || roles.foundation || roles.motion || roles.rhythm || roles.accent || roles.texture);
    if (offset % 2 === 0 && rolePreferred) return rolePreferred;
    return normText(availableBucketEffects[offset % Math.max(1, availableBucketEffects.length)] || rolePreferred);
  };
  const firstAvailableEffect = (effectNames = []) => normArray(effectNames)
    .map((effectName) => normText(effectName))
    .find((effectName) => effectName && (!availableEffects || !availableEffects.size || availableEffects.has(effectName)))
    || "";
  const chooseEffectForPlacement = ({ roles = {}, role = "", bucketEffects = [], rankedCandidates = [], offset = 0, targetRow = {} } = {}) => {
    const targetId = normText(targetRow?.targetId).toLowerCase();
    const granularity = normText(targetRow?.targetGranularity);
    const broadAggregate = granularity === "group" && /allmodels|fronthouse|frontprops/.test(targetId);
    if (broadAggregate && /foundation|support|texture/.test(normText(role))) {
      return firstAvailableEffect(["Color Wash", "On", "Shimmer", roles.foundation, roles.texture]) || normText(roles.foundation || roles.texture);
    }
    return chooseEffectForRole(roles, role, bucketEffects, rankedCandidates, offset);
  };
  const configuredBehaviorForPlacement = ({ recommendations = [], effectName = "", targetRow = {} } = {}) => {
    const targetId = normText(targetRow?.targetId);
    const rows = normArray(recommendations)
      .filter((row) => normText(row?.effectName) === normText(effectName));
    if (!rows.length) return null;
    const targetDisplayRow = displayElements.find((row) => normText(row?.id || row?.name) === targetId) || {};
    const targetGeometry = normText(
      targetDisplayRow?.geometryProfile
      || targetDisplayRow?.trainingGeometryProfile
      || targetDisplayRow?.modelGeometryProfile
      || targetDisplayRow?.metadata?.geometryProfile
    );
    return rows.find((row) => targetGeometry && normText(row?.geometryProfile) === targetGeometry)
      || rows.find((row) => row?.exactGeometryMatch || row?.modelTypeMatch)
      || rows[0];
  };
  const configuredBehaviorChoiceForPlacement = ({
    portfolio = {},
    role = "",
    targetRow = {},
    sectionBucket = "",
    sectionDirective = null,
    intentSummary = "",
    fallbackEffectName = "",
    effectAvoidances = [],
    offset = 0
  } = {}) => {
    const targetId = normText(targetRow?.targetId);
    const candidateEffects = filterAvailableTrainingEffects(
      uniqueNormTexts([
        ...normArray(portfolio?.rankedCandidates),
        ...Object.values(portfolio?.roles || {}),
        fallbackEffectName,
        ...normArray(getStage1TrainedEffectBundle()?.selectorReadyEffects)
      ]),
      availableEffects,
      effectAvoidances
    ).filter((effectName) => effectName !== "On" || /foundation|background/.test(normText(role).toLowerCase()));
    const desiredBehaviorHints = behaviorHintsForPlacementNeed({
      role,
      targetRole: targetRow?.targetRole,
      sectionBucket,
      sectionDirective
    });
    const placementRecommendations = recommendConfiguredBehaviorCapabilities({
      summary: [
        intentSummary,
        normText(role),
        normText(targetRow?.targetRole),
        normText(sectionBucket),
        normText(targetId)
      ].filter(Boolean).join(" | "),
      preferredVisualFamilies: portfolio?.visualFamilies || [],
      desiredBehaviorHints,
      effectNames: candidateEffects,
      targetIds: [targetId],
      displayElements,
      paletteMode: "",
      limit: 12
    });
    let recommendations = normArray(placementRecommendations?.recommendations);
    const uniqueRecommendedEffectCount = uniqueNormTexts(recommendations.map((row) => row?.effectName)).length;
    if (uniqueRecommendedEffectCount < Math.min(4, candidateEffects.length)) {
      const broadRecommendations = recommendConfiguredBehaviorCapabilities({
        summary: [
          intentSummary,
          normText(role),
          normText(targetRow?.targetRole),
          normText(sectionBucket),
          "cross geometry behavior fallback"
        ].filter(Boolean).join(" | "),
        preferredVisualFamilies: portfolio?.visualFamilies || [],
        desiredBehaviorHints,
        effectNames: candidateEffects,
        targetIds: [],
        displayElements: [],
        paletteMode: "",
        limit: 200
      });
      recommendations = [
        ...recommendations,
        ...normArray(broadRecommendations?.recommendations)
      ];
    }
    const uniqueRecommendations = [];
    const seenEffects = new Set();
    for (const row of recommendations) {
      const effectName = normText(row?.effectName);
      if (!effectName || seenEffects.has(effectName)) continue;
      seenEffects.add(effectName);
      uniqueRecommendations.push(row);
    }
    const fallbackConfigured = configuredBehaviorForPlacement({
      recommendations: [
        ...recommendations,
        ...normArray(portfolio?.configuredBehaviorRecommendations)
      ],
      effectName: fallbackEffectName,
      targetRow
    });
    const nonGenericRecommendations = uniqueRecommendations.filter((row) => normText(row?.effectName) && normText(row?.effectName) !== "On");
    const selected = nonGenericRecommendations.length
      ? nonGenericRecommendations[Math.abs(Number(offset || 0)) % nonGenericRecommendations.length]
      : uniqueRecommendations[0]
      || fallbackConfigured
      || null;
    if (!selected) {
      return {
        effectName: fallbackEffectName,
        configuredBehaviorRecommendation: null,
        desiredBehaviorHints,
        selectionSource: "fallback_role_effect_no_configured_behavior"
      };
    }
    return {
      effectName: normText(selected.effectName) || fallbackEffectName,
      configuredBehaviorRecommendation: selected,
      desiredBehaviorHints,
      selectionSource: "placement_configured_behavior_capability"
    };
  };
  for (let index = 0; index < maxSections; index += 1) {
    const sectionRow = plannedSections[index];
    const sectionBucket = fullDisplayBucketForSection(index, maxSections);
    const bucketEffects = referenceEffectsForBucket(visualPlanningContext?.referenceSequencePatterns, sectionBucket);
    const matchingPlan = strategySectionPlans.find((row) => normText(row?.section) === sectionRow.section) || defaultSectionPlan;
    const sectionDirective = sectionDirectiveIndex.get(sectionRow.section) || null;
    const sectionTargets = uniqueNormTexts([
      ...normArray(matchingPlan?.targetIds),
      ...targetSequence.map((row) => row.targetId),
      ...targetBands.all
    ]);
    const effectAvoidances = collectEffectAvoidancesForTargets(sectionTargets, metadataAssignmentIndex);
    const visualHintBehaviorText = collectDefinedVisualHintBehaviorTextForTargets(sectionTargets, metadataAssignmentIndex);
    const translationLayer = resolveTranslationLayer({
      translationIntent: scope?.executionStrategy?.translationIntent,
      section: sectionRow.section,
      targetIds: sectionTargets,
      availableEffects
    });
    const intentSummary = [
      normText(matchingPlan?.intentSummary || scope.goal),
      visualPlanningContext?.summaryText,
      normText(sectionDirective?.sectionPurpose),
      normText(sectionDirective?.motionTarget),
      normText(sectionDirective?.densityTarget)
    ].filter(Boolean).join(" | ");
    const portfolio = buildDeterministicEffectPortfolio({
      section: sectionRow.section,
      summary: intentSummary,
      energy: sectionDirective?.energyTarget || matchingPlan?.energy,
      density: sectionDirective?.densityTarget || matchingPlan?.density,
      targetIds: sectionTargets,
      displayElements,
      sectionDirective,
      availableEffects,
      effectAvoidances,
      visualHintBehaviorText: [
        ...visualHintBehaviorText,
        ...normArray(translationLayer?.behaviorTexts)
      ],
      translationVisualFamilies: normArray(translationLayer?.preferredVisualFamilies),
      visualPlanningContext: {
        ...visualPlanningContext,
        referenceEffects: uniqueNormTexts([
          ...bucketEffects,
          ...normArray(visualPlanningContext?.referenceEffects)
        ])
      }
    });
    const roles = portfolio.roles || {};
    const sectionIntensity = sectionIntensityMultiplier({
      sectionDirective,
      sectionPlan: matchingPlan,
      sectionBucket
    });
    const sectionPlacementGoal = Math.max(3, Math.round(scale.placementsPerSection * sectionIntensity));
    const sectionWindowCount = Math.max(1, Math.round(scale.windowsPerSection * clampNumber(sectionIntensity, 0.8, 1.4)));
    const layerCadence = sectionIntensity >= 1.25 ? 2 : (sectionIntensity <= 0.8 ? 4 : 3);
    const sectionWindows = splitSectionIntoContiguousWindows(sectionRow, sectionWindowCount);
    const rowsForSection = [];
    const sectionTargetOffset = index * Math.max(1, scale.targetsPerWindow - 1);
    for (let windowIndex = 0; windowIndex < sectionWindows.length; windowIndex += 1) {
      const window = sectionWindows[windowIndex];
      const remainingBeforeWindow = Math.max(0, sectionPlacementGoal - rowsForSection.length);
      const remainingWindows = Math.max(1, sectionWindows.length - windowIndex);
      const windowGoal = Math.max(1, Math.ceil(remainingBeforeWindow / remainingWindows));
      for (const layerPass of FULL_DISPLAY_LAYER_PASSES) {
        if (rowsForSection.length >= sectionPlacementGoal) break;
        const remaining = Math.max(0, sectionPlacementGoal - rowsForSection.length);
        const passTargetCount = Math.min(
          remaining,
          Math.max(1, Math.round(windowGoal * Number(layerPass.share || 0.25)))
        );
        const passTargets = targetRowsForLayerPassWindow({
          targetSequence,
          layerPass,
          count: passTargetCount,
          offset: sectionTargetOffset + (windowIndex * scale.targetsPerWindow) + (layerPass.order * 3)
        });
        for (let targetOrdinal = 0; targetOrdinal < passTargets.length; targetOrdinal += 1) {
          if (rowsForSection.length >= sectionPlacementGoal) break;
          const targetRow = passTargets[targetOrdinal];
          const role = roleForLayerPass(layerPass, index + windowIndex + targetOrdinal);
          const useOverlayLayer = shouldUsePhysicalOverlayLayer({
            layerPass,
            targetRow,
            layeredTargetIds,
            sectionIndex: index,
            windowIndex,
            targetOrdinal,
            layerCadence
          });
          const layerIndex = useOverlayLayer ? 1 : 0;
          const fallbackEffectName = chooseEffectForPlacement({
            roles,
            role,
            bucketEffects,
            rankedCandidates: portfolio.rankedCandidates,
            offset: targetOrdinal + windowIndex + layerPass.order,
            targetRow
          });
          const behaviorChoice = configuredBehaviorChoiceForPlacement({
            portfolio,
            role,
            targetRow,
            sectionBucket,
            sectionDirective,
            intentSummary,
            fallbackEffectName,
            effectAvoidances,
            offset: index + windowIndex + targetOrdinal + layerPass.order
          });
          const effectName = behaviorChoice.effectName;
          const configuredBehaviorRecommendation = behaviorChoice.configuredBehaviorRecommendation;
          const placementKey = [
            normText(targetRow.targetId),
            Number(layerIndex || 0),
            normText(effectName),
            Number(window.startMs || 0),
            Number(window.endMs || 0)
          ].join("|");
          if (seenPlacementKeys.has(placementKey)) continue;
          seenPlacementKeys.add(placementKey);
          rowsForSection.push({
            role,
            targetRole: normText(targetRow.targetRole) || "support",
            compositionRole: compositionRoleForPlacement(role, targetRow.targetRole, layerIndex),
            compositionLayerPass: layerPass.name,
            compositionLayerOrder: layerPass.order,
            compositionLayerPurpose: layerPass.purpose,
            targetId: targetRow.targetId,
            targetSpatial: targetRow.spatial || null,
            spatialCoverageFiller: targetRow.spatialCoverageFiller === true,
            sourceAggregateTargetId: normText(targetRow.sourceAggregateTargetId),
            targetGranularity: normText(targetRow.targetGranularity),
            effectName,
            configuredBehaviorRecommendation,
            configuredBehaviorDesiredHints: behaviorChoice.desiredBehaviorHints,
            configuredBehaviorSelectionSource: behaviorChoice.selectionSource,
            layerIndex,
            blendRole: useOverlayLayer ? `${layerPass.name}_overlay` : layerPass.name,
            window,
            sectionBucket
          });
        }
      }
    }
    const layerPasses = layerPassSummary(rowsForSection);
    compositionSections.push({
      section: sectionRow.section,
      startMs: sectionRow.startMs,
      endMs: sectionRow.endMs,
      sectionBucket,
      purpose: normText(sectionDirective?.sectionPurpose),
      energyTarget: normText(sectionDirective?.energyTarget || matchingPlan?.energy),
      densityTarget: normText(sectionDirective?.densityTarget || matchingPlan?.density),
      densityMultiplier: sectionIntensity,
      placementGoal: sectionPlacementGoal,
      layerCadence,
      focalRegion: uniqueNormTexts(rowsForSection.filter((row) => row.compositionRole === "focal").map((row) => row.targetId)).slice(0, 6),
      supportRegion: uniqueNormTexts(rowsForSection.filter((row) => row.compositionRole === "support").map((row) => row.targetId)).slice(0, 8),
      accentRegion: uniqueNormTexts(rowsForSection.filter((row) => row.compositionRole === "accent").map((row) => row.targetId)).slice(0, 8),
      backgroundRegion: uniqueNormTexts(rowsForSection.filter((row) => row.compositionRole === "background").map((row) => row.targetId)).slice(0, 8),
      restIntent: expectedBalanceForBucket(sectionBucket, sectionDirective?.densityTarget || matchingPlan?.density).negativeSpace,
      expectedBalance: expectedBalanceForBucket(sectionBucket, sectionDirective?.densityTarget || matchingPlan?.density),
      progressionIntent: progressionIntentForBucket(sectionBucket),
      transitionFromPrevious: index === 0 ? "start" : `${progressionIntentForBucket(fullDisplayBucketForSection(index - 1, maxSections))}_to_${progressionIntentForBucket(sectionBucket)}`,
      layerStackTargets: uniqueNormTexts(rowsForSection.filter((row) => Number(row.layerIndex) > 0).map((row) => row.targetId)).slice(0, 8),
      layerBuildOrder: FULL_DISPLAY_LAYER_PASSES.map((row) => row.name),
      layerPasses,
      plannedEffectFamilies: uniqueNormTexts(portfolio.visualFamilies).slice(0, 8),
      plannedEffects: uniqueNormTexts(rowsForSection.map((row) => row.effectName)).slice(0, 10),
      placementCount: rowsForSection.length
    });
    for (const row of rowsForSection) {
      const targetId = normText(row.targetId);
      const effectName = normText(row.effectName);
      if (!targetId || !effectName) continue;
      const paletteIntent = buildPaletteIntentForPlacement({
        visualPlanningContext,
        row,
        placementIndex: placements.length
      });
      const layerCompositionGuidance = layerCompositionGuidanceForPlacement({
        row: {
          ...row,
          effectName,
          compositionRole: row.compositionRole
        },
        targetRow: row,
        displayElements,
        paletteIntent
      });
      placements.push({
        placementId: `full-display.${index + 1}.${placements.length + 1}.${row.role}`,
        sourceSectionLabel: sectionRow.section,
        section: sectionRow.section,
        designId: normText(matchingPlan?.designId),
        designRevision: Number.isInteger(Number(matchingPlan?.designRevision)) ? Number(matchingPlan.designRevision) : 0,
        designAuthor: normText(matchingPlan?.designAuthor) || "sequence_agent",
        targetId,
        sourceAggregateTargetId: normText(row.sourceAggregateTargetId),
        targetGranularity: normText(row.targetGranularity),
        targetSpatial: row.targetSpatial || null,
        spatialCoverageFiller: row.spatialCoverageFiller === true,
        layerIndex: Number(row.layerIndex || 0),
        effectName,
        targetRole: row.targetRole,
        compositionRole: row.compositionRole,
        startMs: row.window.startMs,
        endMs: row.window.endMs,
        timingContext: {
          trackName: normText(scope?.executionStrategy?.sectionTimingTrackName || scope?.executionStrategy?.timingTrackName) || "XD: Song Structure",
          anchorLabel: sectionRow.section,
          alignmentMode: row.window.startMs === sectionRow.startMs ? "section_start" : "adjacent_effect_or_section_window"
        },
        settingsIntent: {
          role: row.role,
          targetRole: row.targetRole,
          compositionRole: row.compositionRole,
          compositionLayerPass: row.compositionLayerPass,
          compositionLayerOrder: row.compositionLayerOrder,
          compositionLayerPurpose: row.compositionLayerPurpose,
          sectionBucket: row.sectionBucket,
          deterministicEffectSelection: portfolio.selectionPolicy,
          rankedEffectCandidates: portfolio.rankedCandidates,
          configuredBehaviorRecordId: normText(row.configuredBehaviorRecommendation?.recordId),
          configuredBehaviorSelectionSource: normText(row.configuredBehaviorSelectionSource),
          configuredBehaviorDesiredHints: normArray(row.configuredBehaviorDesiredHints),
          configuredBehaviorSignals: row.configuredBehaviorRecommendation?.behaviorSignals || {},
          targetSpatial: row.targetSpatial || null,
          spatialCoverageFiller: row.spatialCoverageFiller === true,
          visualFamilies: portfolio.visualFamilies,
          layerCompositionPriorIds: normArray(layerCompositionGuidance?.recommendations).map((prior) => normText(prior?.priorId)).filter(Boolean),
          layerCompositionGuidanceMode: normText(layerCompositionGuidance?.retrievalPolicy),
          referenceGuidedScale: {
            densityPerMinute: scale.boundedDensity,
            targetTotalPlacements: scale.targetTotalPlacements,
            activeTargetGoal: scale.activeTargetGoal,
            layeredTargetGoal: scale.layeredTargetGoal,
            sectionDensityMultiplier: sectionIntensity,
            sectionPlacementGoal,
            layerCadence,
            referenceDensityBasis: scale.referenceDensityBasis
          }
        },
        layerIntent: {
          blendRole: row.blendRole,
          compositionLayerPass: row.compositionLayerPass,
          buildOrder: row.compositionLayerOrder,
          dependsOnPriorLayers: Number(row.compositionLayerOrder) > 0,
          mixAmount: row.layerIndex > 0 ? "medium" : "default"
        },
        paletteIntent,
        renderIntent: {
          bufferStyle: row.role === "foundation" ? "per_model" : "inherit"
        },
        constraints: {
          selectionPolicy: "metadata_training_ranked_no_random",
          sectionScoped: true
        },
        parameterPriorGuidance: buildParameterPriorGuidance({
          effectName,
          targetIds: [targetId],
          displayElements,
          intentSummary,
          sequencerRevisionBrief,
          configuredBehaviorRecommendation: row.configuredBehaviorRecommendation
        }),
        sharedSettingPriorGuidance: buildSharedSettingPriorGuidance({
          sequencerRevisionBrief,
          intentSummary
        }),
        layerCompositionGuidance
      });
    }
  }
  return {
    compositionPlan: {
      artifactType: "composition_plan_v1",
      artifactVersion: "1.0",
      source: {
        sequencingDesignHandoffRef: normText(scope?.sequencingDesignHandoff?.artifactId),
        referencePatternArtifactId: normText(visualPlanningContext?.referenceSequencePatterns?.artifactId),
        selectionPolicy: "training_metadata_ranked_no_random",
        targetScopePolicy: "selected_semantic_tags_plus_broad_display_groups"
      },
      scale: {
        densityPerMinute: scale.boundedDensity,
        targetTotalPlacements: scale.targetTotalPlacements,
        activeTargetGoal: scale.activeTargetGoal,
        layeredTargetGoal: scale.layeredTargetGoal,
        referenceDensityBasis: scale.referenceDensityBasis
      },
      targetRoles: {
        foundation: normArray(targetBands.foundation),
        motion: normArray(targetBands.motion),
        accent: normArray(targetBands.accent),
        activeTargets: targetSequence.map((row) => row.targetId),
        concreteTargets: targetSequence.filter((row) => row.targetGranularity === "member").map((row) => row.targetId),
        layeredTargets: [...layeredTargetIds]
      },
      sections: compositionSections,
      totals: {
        sectionCount: compositionSections.length,
        placementCount: placements.length,
        distinctEffectCount: uniqueNormTexts(placements.map((row) => row.effectName)).length,
        activeTargetCount: uniqueNormTexts(placements.map((row) => row.targetId)).length,
        layeredTargetCount: uniqueNormTexts(placements.filter((row) => Number(row.layerIndex) > 0).map((row) => row.targetId)).length
      },
      progression: {
        sectionIntents: compositionSections.map((row) => ({
          section: row.section,
          sectionBucket: row.sectionBucket,
          progressionIntent: row.progressionIntent,
          transitionFromPrevious: row.transitionFromPrevious
        }))
      },
      balance: {
        expectedSpatialBreadths: uniqueNormTexts(compositionSections.map((row) => row.expectedBalance?.spatialBreadth)),
        expectedNegativeSpace: uniqueNormTexts(compositionSections.map((row) => row.restIntent)),
        leftRight: "balanced",
        topBottom: "balanced"
      }
    },
    effectPlacements: placements
  };
}

export function buildFullDisplayEffectPlacements(options = {}) {
  return buildFullDisplayPlan(options).effectPlacements;
}
