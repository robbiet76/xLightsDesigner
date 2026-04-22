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

export function buildRevisionRetryPressureV1({
  priorPassMemory = null,
  candidateSelection = null,
  revisionDelta = null
} = {}) {
  const retrySignals = uniqueStrings(priorPassMemory?.retryPressureSignals);
  const oscillatingCandidateIds = arr(candidateSelection?.scoredCandidates)
    .filter((row) => str(row?.oscillationRisk) === "high")
    .map((row) => str(row?.candidateId))
    .filter(Boolean)
    .slice(0, 8);

  return finalizeArtifact({
    artifactType: "revision_retry_pressure_v1",
    artifactVersion: "1.0",
    source: {
      priorPassMemoryRef: str(priorPassMemory?.artifactId),
      candidateSelectionRef: str(candidateSelection?.artifactId),
      revisionDeltaRef: str(revisionDelta?.artifactId)
    },
    signals: retrySignals,
    oscillation: {
      candidateIds: oscillatingCandidateIds,
      detected: Boolean(oscillatingCandidateIds.length)
    },
    notes: [
      "revision_retry_pressure_v1 records structural retry pressure only.",
      "Signals describe ineffective retry patterns, not artistic correctness."
    ]
  });
}
