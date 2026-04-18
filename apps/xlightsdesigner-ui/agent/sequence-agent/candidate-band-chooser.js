function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function hashSeed(seed = "") {
  const text = str(seed);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

export function chooseCandidateFromSelection({
  realizationCandidates = null,
  candidateSelection = null
} = {}) {
  const candidates = arr(realizationCandidates?.candidates);
  const candidateById = new Map(candidates.map((row) => [str(row?.candidateId), row]));
  const eligibleIds = arr(candidateSelection?.selectedBand?.candidateIds).map((row) => str(row)).filter(Boolean);
  const mode = str(candidateSelection?.policy?.mode || "deterministic_preview");
  const seed = str(candidateSelection?.selectionContext?.seed);
  const baseCandidateId = candidateById.has("candidate-base") ? "candidate-base" : "";

  let chosenId = str(candidateSelection?.primaryCandidateId);
  if (mode === "deterministic_preview" && baseCandidateId) {
    chosenId = baseCandidateId;
  } else if (mode === "bounded_exploration" && eligibleIds.length > 1 && seed) {
    chosenId = eligibleIds[hashSeed(seed) % eligibleIds.length];
  }

  const chosenCandidate = candidateById.get(chosenId) || candidateById.get(str(candidateSelection?.primaryCandidateId)) || candidates[0] || null;
  if (!chosenCandidate) {
    return {
      chosenCandidateId: "",
      chosenCandidate: null,
      selectionMode: mode,
      selectedFromBand: false
    };
  }

  return {
    chosenCandidateId: str(chosenCandidate.candidateId),
    chosenCandidate,
    selectionMode: mode,
    selectedFromBand: eligibleIds.includes(str(chosenCandidate.candidateId))
  };
}

export function projectChosenCandidateToEffectStrategy({
  baseEffectStrategy = null,
  chosenCandidate = null
} = {}) {
  const chosenSeeds = arr(chosenCandidate?.seedRecommendations).filter((row) => row && typeof row === "object");
  if (!chosenSeeds.length) return baseEffectStrategy;
  return {
    ...(baseEffectStrategy && typeof baseEffectStrategy === "object" ? baseEffectStrategy : {}),
    seedRecommendations: chosenSeeds,
    executionSeedLines: chosenSeeds.map((row) => str(row?.executionLine)).filter(Boolean),
    selectedCandidateId: str(chosenCandidate?.candidateId),
    selectedCandidateSummary: str(chosenCandidate?.summary)
  };
}
