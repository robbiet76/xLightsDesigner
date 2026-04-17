function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function unique(values = []) {
  return [...new Set(arr(values).map((row) => str(row)).filter(Boolean))];
}

function norm(value = "") {
  return str(value).toLowerCase();
}

function asSet(values = []) {
  return new Set(unique(values).map((row) => norm(row)));
}

function buildBehaviorPhrases(target = {}) {
  const phrases = new Set();
  const summary = str(target?.behaviorSummary);
  const motion = str(target?.motion?.primaryMotion);
  const texture = str(target?.texture?.primaryTexture);
  const energy = str(target?.energy?.energyLevel);
  const coverage = str(target?.coverage?.coverageLevel);
  const hierarchy = str(target?.hierarchy?.role);
  const entry = str(target?.transitions?.entryCharacter);

  if (summary) phrases.add(summary);
  if (motion) phrases.add(motion);
  if (texture) phrases.add(texture);
  if (energy) phrases.add(energy);
  if (coverage) phrases.add(coverage);
  if (hierarchy) phrases.add(hierarchy);
  if (entry) phrases.add(entry);
  if (motion && texture) phrases.add(`${motion} ${texture}`);
  if (energy && motion) phrases.add(`${energy} ${motion}`);
  if (coverage && texture) phrases.add(`${coverage} ${texture}`);
  if (hierarchy && motion) phrases.add(`${hierarchy} ${motion}`);
  return [...phrases];
}

function targetMatchesScope(target = {}, { section = "", targetIds = [] } = {}) {
  const appliesTo = norm(target?.appliesTo);
  const targetId = str(target?.targetId);
  const targetSection = str(target?.section);
  if (appliesTo === "section") {
    return !section || !targetSection || norm(section) === norm(targetSection);
  }
  if (appliesTo === "target") {
    return targetIds.includes(targetId);
  }
  return true;
}

function splitPreferredFamilies(preferredFamilies = [], availableEffects = null) {
  const available = availableEffects instanceof Set
    ? new Set([...availableEffects].map((row) => norm(row)))
    : null;
  const effectHints = [];
  const visualFamilies = [];
  for (const value of unique(preferredFamilies)) {
    if (available && available.has(norm(value))) {
      effectHints.push(value);
    } else {
      visualFamilies.push(value);
    }
  }
  return { effectHints: unique(effectHints), visualFamilies: unique(visualFamilies) };
}

export function resolveTranslationLayer({
  translationIntent = null,
  section = "",
  targetIds = [],
  availableEffects = null
} = {}) {
  if (!translationIntent || typeof translationIntent !== "object" || Array.isArray(translationIntent)) {
    return {
      behaviorTexts: [],
      preferredVisualFamilies: [],
      preferredEffectHints: []
    };
  }

  const targetScope = unique(targetIds);
  const behaviorTargets = arr(translationIntent?.behaviorTargets)
    .filter((row) => row && typeof row === "object")
    .filter((row) => targetMatchesScope(row, { section, targetIds: targetScope }));

  const behaviorTexts = unique(behaviorTargets.map((row) => row?.behaviorSummary));
  const inferredVisualFamilies = unique(behaviorTargets.flatMap((row) => buildBehaviorPhrases(row)));
  const preferredFamilies = arr(translationIntent?.realizationGuidance?.preferredFamilies);
  const split = splitPreferredFamilies(preferredFamilies, availableEffects);

  return {
    behaviorTexts,
    preferredVisualFamilies: unique([
      ...split.visualFamilies,
      ...inferredVisualFamilies
    ]),
    preferredEffectHints: split.effectHints
  };
}

