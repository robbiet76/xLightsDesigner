function cleanText(value) {
  return String(value || "").trim();
}

function normalizeName(value = "") {
  return String(value || "").trim().toLowerCase();
}

function uniqueStrings(values = []) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const text = cleanText(value);
    const key = normalizeName(text);
    if (!text || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

function hasAnyText(value = "", patterns = []) {
  const lower = String(value || "").toLowerCase();
  return patterns.some((pattern) => pattern.test(lower));
}

function hasNegatedGlobalRewrite(text = "") {
  return hasAnyText(text, [
    /\b(do not|don't|dont|avoid|instead of)\s+(?:rewrite|rework|redo|change)\s+(?:the\s+)?(?:whole show|whole sequence|entire sequence|full show)\b/,
    /\bdo not rewrite the whole show\b/,
    /\bnot a whole[- ]show rewrite\b/,
    /\bdo not rewrite the whole sequence\b/
  ]);
}

function escapeRegex(value = "") {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildTagPatterns(tag = "") {
  const key = normalizeName(tag);
  if (!key) return [];
  const variants = [key];
  if (key === "support") variants.push("supporting", "supportive", "fill", "fill light");
  if (key === "character") variants.push("characters");
  if (key === "lyric") variants.push("lyrics", "lyrical");
  if (key === "rhythm") variants.push("rhythmic", "pulse");
  if (key === "focal") variants.push("focus", "focused", "key light", "key-light");
  if (key === "perimeter") variants.push("border props", "perimeter props", "edges");
  if (key === "centerpiece") variants.push("centerpiece props", "center props", "center");
  return uniqueStrings(variants).map((value) => normalizeName(value));
}

function inferMode(text = "") {
  const lower = String(text || "").toLowerCase();
  if (!lower) return "revise";
  if (/(analyz|audit|diagnos|review)/.test(lower)) return "analyze";
  if (/(polish|tighten|clean up|clean-up|refine)/.test(lower)) return "polish";
  if (/(create|build from scratch|new sequence|start from nothing)/.test(lower)) return "create";
  return "revise";
}

function extractTempoIntent(text) {
  const lower = String(text || "").toLowerCase();
  if (/(faster|higher energy|more energy|punchy|intense|bigger|lift|build)/.test(lower)) return "increase";
  if (/(slower|calm|softer|lower energy|reduce energy|pull back|gentler)/.test(lower)) return "decrease";
  return "hold";
}

function extractMotionIntent(text) {
  const lower = String(text || "").toLowerCase();
  if (/(smooth|gentle|calm|float|slow|glide|cinematic)/.test(lower)) return "smooth";
  if (/(punch|sharp|staccato|impact|hit|burst|snappy)/.test(lower)) return "punchy";
  return "balanced";
}

function extractStyleDirection(text = "", brief = {}) {
  const lower = String(text || "").toLowerCase();
  if (/(cinematic|film|epic|sweeping)/.test(lower)) return "cinematic";
  if (/(punchy|sharp|impact|aggressive|big)/.test(lower)) return "punchy";
  if (/(smooth|gentle|soft|flowing|glide)/.test(lower)) return "smooth";
  if (/(playful|fun|whimsical)/.test(lower)) return "playful";
  if (/(dramatic|theatrical|intense)/.test(lower)) return "dramatic";
  return cleanText(brief?.mood || brief?.styleDirection || "");
}

function extractColorDirection(text = "", brief = {}) {
  const lower = String(text || "").toLowerCase();
  if (/(warm|amber|gold|golden|red)/.test(lower)) return "warm";
  if (/(cool|icy|blue|white|silver)/.test(lower)) return "cool";
  if (/(holiday|christmas|festive)/.test(lower)) return "holiday";
  if (/(rainbow|multicolor|multicolou?r|colorful|colourful)/.test(lower)) return "custom";
  return cleanText(brief?.paletteIntent || brief?.colorDirection || "");
}

function extractChangeTolerance(text = "", mode = "revise") {
  const lower = String(text || "").toLowerCase();
  if (/(minimal|subtle|small change|slight|keep most)/.test(lower)) return "minimal";
  if (/(aggressive|major|big rewrite|rework|overhaul|completely)/.test(lower)) return "aggressive";
  if (mode === "polish") return "minimal";
  if (mode === "create") return "aggressive";
  return "moderate";
}

function extractEffectOverrides(text) {
  const lower = String(text || "").toLowerCase();
  const known = ["on", "off", "twinkle", "bars", "pinwheel", "butterfly", "spirals", "meteors", "color wash", "colorwash", "shimmer"];
  return known.filter((name) => {
    if (name === "on") {
      return /\b(on effect|apply on(?: effect)?|make (?:it )?on|set (?:it )?on|put (?:an? )?on effect|use on(?: effect)?)\b/i.test(lower);
    }
    if (name === "off") {
      return /\b(off effect|apply off(?: effect)?|make (?:it )?off|set (?:it )?off|put (?:an? )?off effect|use off(?: effect)?)\b/i.test(lower);
    }
    if (name.includes(" ")) {
      return lower.includes(name);
    }
    return new RegExp(`\\b${name.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\b`, "i").test(lower);
  });
}

function extractExplicitColor(text = "") {
  const lower = String(text || "").toLowerCase();
  const known = ["red", "green", "blue", "white", "amber", "gold", "yellow", "purple", "pink", "orange", "cyan"];
  return known.find((name) => new RegExp(`\\b${name}\\b`, "i").test(lower)) || "";
}

function extractDurationMs(text = "") {
  const lower = String(text || "").toLowerCase();
  const secondMatch = lower.match(/\b(\d+(?:\.\d+)?)\s*(second|seconds|sec|secs)\b/);
  if (secondMatch) return Math.round(Number(secondMatch[1]) * 1000);
  const minuteMatch = lower.match(/\b(\d+(?:\.\d+)?)\s*(minute|minutes|min|mins)\b/);
  if (minuteMatch) return Math.round(Number(minuteMatch[1]) * 60000);
  return null;
}

function extractStartHint(text = "") {
  const lower = String(text || "").toLowerCase();
  if (/(at the beginning|from the beginning|start of the track|at the start|from the start)/.test(lower)) {
    return "track_start";
  }
  return "";
}

function extractSafetyConstraints(text = "") {
  const lower = String(text || "").toLowerCase();
  const out = [];
  if (/(avoid strobe|no strobe|without strobe|avoid rapid strobe)/.test(lower)) out.push("avoid_rapid_strobe");
  if (/(avoid clutter|cleaner|less busy|reduce noise)/.test(lower)) out.push("preserve_readability");
  return out;
}

function collectKnownMetadataTags(metadataAssignments = []) {
  const tags = [];
  for (const assignment of metadataAssignments || []) {
    for (const tag of Array.isArray(assignment?.tags) ? assignment.tags : []) {
      tags.push(tag);
    }
  }
  return uniqueStrings(tags);
}

function collectPromptInferredTags(text = "", metadataAssignments = []) {
  const lower = normalizeName(text);
  const matches = [];
  const knownTags = collectKnownMetadataTags(metadataAssignments);

  for (const tag of knownTags) {
    const key = normalizeName(tag);
    if (!key) continue;
    const variants = buildTagPatterns(tag);
    const patterns = variants.flatMap((variant) => ([
      new RegExp(`\\b${escapeRegex(variant)}\\b`, "i"),
      new RegExp(`\\b${escapeRegex(variant)}\\s+(?:prop|props|model|models|element|elements|items?)\\b`, "i")
    ]));
    let index = Number.POSITIVE_INFINITY;
    for (const pattern of patterns) {
      const match = lower.match(pattern);
      if (!match || typeof match.index !== "number") continue;
      index = Math.min(index, match.index);
    }
    if (Number.isFinite(index)) {
      matches.push({ tag, index });
    }
  }

  return matches
    .sort((a, b) => a.index - b.index || normalizeName(a.tag).localeCompare(normalizeName(b.tag)))
    .map((row) => row.tag);
}

function inferSectionsFromPrompt(text = "", availableSectionNames = []) {
  const goal = cleanText(text).toLowerCase();
  if (!goal) return [];
  const available = uniqueStrings(availableSectionNames).filter(Boolean);
  const matched = [];
  for (const label of available) {
    const escaped = escapeRegex(label.toLowerCase());
    if (new RegExp(`\\b${escaped}\\b`, "i").test(goal)) {
      matched.push(label);
    }
  }
  return uniqueStrings(matched);
}

function inferFocusHierarchy({ targetIds = [], tags = [], brief = {} } = {}) {
  if (targetIds.length) return "explicit_targets";
  if (tags.some((tag) => /focal|hero|lead/i.test(tag))) return "focal_first";
  if (cleanText(brief?.focusDirection)) return cleanText(brief.focusDirection);
  return "balanced_full_yard";
}

function buildFieldSources({
  goal = "",
  sections = [],
  targetIds = [],
  tags = [],
  styleDirection = "",
  colorDirection = "",
  changeTolerance = "",
  focusHierarchy = "",
  safetyConstraints = []
} = {}) {
  return {
    goal: goal ? "explicit" : "missing",
    sections: sections.length ? "explicit" : "missing",
    targetIds: targetIds.length ? "explicit" : "missing",
    tags: tags.length ? "explicit" : "missing",
    styleDirection: styleDirection ? "inferred" : "missing",
    colorDirection: colorDirection ? "inferred" : "missing",
    changeTolerance: changeTolerance ? "inferred" : "missing",
    focusHierarchy: focusHierarchy ? "inferred" : "missing",
    safetyConstraints: safetyConstraints.length ? "explicit_or_inferred" : "missing"
  };
}

function buildAssumptions({
  fieldSources = {},
  sections = [],
  targetIds = [],
  tags = [],
  focusHierarchy = "",
  styleDirection = "",
  colorDirection = "",
  changeTolerance = ""
} = {}) {
  const assumptions = [];
  if (!sections.length) {
    assumptions.push("Use the current dominant musical section as the initial proposal anchor unless the user narrows scope.");
  }
  if (!targetIds.length && !tags.length && focusHierarchy === "balanced_full_yard") {
    assumptions.push("Start with a balanced full-yard pass before introducing focal overrides.");
  }
  if (fieldSources.styleDirection === "inferred" && styleDirection) {
    assumptions.push(`Assume a ${styleDirection} style direction unless the director overrides it.`);
  }
  if (fieldSources.colorDirection === "inferred" && colorDirection) {
    assumptions.push(`Assume a ${colorDirection} palette direction unless the director requests a different color story.`);
  }
  if (fieldSources.changeTolerance === "inferred" && changeTolerance) {
    assumptions.push(`Assume ${changeTolerance} change tolerance for this pass.`);
  }
  return assumptions;
}

export function normalizeIntent({
  promptText = "",
  selectedSections = [],
  availableSectionNames = [],
  creativeBrief = null,
  selectedTagNames = [],
  selectedTargetIds = [],
  directorPreferences = null,
  metadataAssignments = []
} = {}) {
  const goal = cleanText(promptText);
  const globalScopeRequested =
    !hasNegatedGlobalRewrite(goal) &&
    hasAnyText(goal, [/(whole show|whole sequence|entire sequence|full rewrite|global rewrite|across the song|throughout the song)/]);
  const explicitSections = Array.isArray(selectedSections)
    ? selectedSections.filter((row) => {
        const text = cleanText(row);
        return Boolean(text) && text.toLowerCase() !== "all";
      })
    : [];
  const inferredSections = globalScopeRequested ? [] : inferSectionsFromPrompt(goal, availableSectionNames);
  const sections = uniqueStrings([...explicitSections, ...inferredSections]);
  const selectedTags = Array.isArray(selectedTagNames) ? selectedTagNames.filter(Boolean) : [];
  const inferredTags = collectPromptInferredTags(goal, metadataAssignments);
  const tags = uniqueStrings([...selectedTags, ...inferredTags]);
  const targetIds = Array.isArray(selectedTargetIds) ? selectedTargetIds.filter(Boolean) : [];
  const brief = creativeBrief && typeof creativeBrief === "object" ? creativeBrief : {};
  const preferences = directorPreferences && typeof directorPreferences === "object" ? directorPreferences : {};
  const mode = inferMode(goal);
  const tempoIntent = extractTempoIntent(goal);
  const motionIntent = extractMotionIntent(goal);
  const styleDirection = extractStyleDirection(goal, brief) || cleanText(preferences.styleDirection || "");
  const colorDirection = extractColorDirection(goal, brief) || cleanText(preferences.colorDirection || "");
  const changeTolerance = extractChangeTolerance(goal, mode);
  const focusHierarchy = inferFocusHierarchy({ targetIds, tags, brief });
  const effectOverrides = extractEffectOverrides(goal);
  const explicitColor = extractExplicitColor(goal);
  const durationMs = extractDurationMs(goal);
  const startHint = extractStartHint(goal);
  const safetyConstraints = extractSafetyConstraints(goal);
  const preserveTimingTracks = !hasAnyText(goal, [/(rebuild timing|replace timing|rewrite timing)/]);
  const preservationConstraints = {
    preserveTimingTracks,
    preserveDisplayOrder: true,
    allowGlobalRewrite:
      !hasNegatedGlobalRewrite(goal) &&
      (mode === "create" || hasAnyText(goal, [/(whole show|entire sequence|full rewrite|global rewrite)/])),
    keepSuccessfulMoments: !hasAnyText(goal, [/(replace everything|completely different|start over)/])
  };
  const fieldSources = buildFieldSources({
    goal,
    sections,
    targetIds,
    tags,
    styleDirection,
    colorDirection,
    changeTolerance,
    focusHierarchy,
    safetyConstraints
  });
  const assumptions = buildAssumptions({
    fieldSources,
    sections,
    targetIds,
    tags,
    focusHierarchy,
    styleDirection,
    colorDirection,
    changeTolerance
  });

  return {
    goal,
    mode,
    sections,
    tags,
    targetIds,
    tempoIntent,
    motionIntent,
    styleDirection,
    colorDirection,
    focusHierarchy,
    changeTolerance,
    effectOverrides,
    explicitColor,
    durationMs,
    startHint,
    safetyConstraints,
    preservationConstraints,
    preserveTimingTracks,
    assumptions,
    fieldSources,
    directorPreferences: preferences,
    creativeBrief: brief
  };
}
