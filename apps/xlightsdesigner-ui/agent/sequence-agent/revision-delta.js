import { finalizeArtifact } from "../shared/artifact-ids.js";

function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueStrings(values = []) {
  return [...new Set(arr(values).map((row) => str(row)).filter(Boolean))];
}

function differenceStrings(nextValues = [], previousValues = []) {
  const previous = new Set(uniqueStrings(previousValues));
  return uniqueStrings(nextValues).filter((value) => !previous.has(value));
}

export function buildRevisionDeltaV1({
  priorPassMemory = null,
  effectStrategy = null,
  chosenCandidate = null
} = {}) {
  const chosenSeedRecommendations = arr(chosenCandidate?.seedRecommendations).filter((row) => row && typeof row === "object");
  const fallbackSeedRecommendations = arr(effectStrategy?.seedRecommendations).filter((row) => row && typeof row === "object");
  const activeSeedRecommendations = chosenSeedRecommendations.length ? chosenSeedRecommendations : fallbackSeedRecommendations;

  const currentEffectNames = uniqueStrings(activeSeedRecommendations.map((row) => row?.effectName));
  const currentTargetIds = uniqueStrings(activeSeedRecommendations.flatMap((row) => arr(row?.targetIds)));
  const previousEffectNames = uniqueStrings(priorPassMemory?.previousEffectNames);
  const previousTargetIds = uniqueStrings(priorPassMemory?.previousTargetIds);

  return finalizeArtifact({
    artifactType: "revision_delta_v1",
    artifactVersion: "1.0",
    source: {
      priorPassMemoryRef: str(priorPassMemory?.artifactId),
      selectedCandidateId: str(effectStrategy?.selectedCandidateId || chosenCandidate?.candidateId)
    },
    current: {
      effectNames: currentEffectNames,
      targetIds: currentTargetIds
    },
    previous: {
      effectNames: previousEffectNames,
      targetIds: previousTargetIds
    },
    introduced: {
      effectNames: differenceStrings(currentEffectNames, previousEffectNames),
      targetIds: differenceStrings(currentTargetIds, previousTargetIds)
    },
    notes: [
      "revision_delta_v1 records neutral pass-to-pass change, not artistic judgment.",
      "Introduced items are present in the current chosen pass and absent from the previous pass memory."
    ]
  });
}
