import { finalizeArtifact } from "../agent/shared/artifact-ids.js";

function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function uniqueStrings(values = []) {
  return [...new Set(arr(values).map((row) => str(row)).filter(Boolean))];
}

function planMetadataFromSnapshot(snapshot = null) {
  return isPlainObject(snapshot?.planHandoff?.metadata) ? snapshot.planHandoff.metadata : {};
}

export function resolveRevisionRetryPressureFromPlanMetadata(metadata = null) {
  if (!isPlainObject(metadata)) return null;
  if (isPlainObject(metadata.revisionRetryPressure)) return metadata.revisionRetryPressure;
  const summary = isPlainObject(metadata.generativeSummary) ? metadata.generativeSummary : null;
  if (!summary) return null;
  const signals = uniqueStrings(summary?.retry?.signals || summary?.choice?.retryPressureSignals);
  const candidateIds = uniqueStrings(summary?.retry?.oscillatingCandidateIds);
  if (!signals.length && !candidateIds.length) return null;
  return finalizeArtifact({
    artifactType: "revision_retry_pressure_v1",
    artifactVersion: 1,
    source: {
      candidateSelectionRef: str(summary?.refs?.candidateSelectionRef),
      revisionDeltaRef: str(summary?.refs?.revisionDeltaRef)
    },
    signals,
    oscillation: {
      candidateIds,
      detected: Boolean(candidateIds.length)
    },
    notes: [
      "Recovered from compact plan_generative_summary_v1.",
      "Use expanded revision_retry_pressure_v1 when available."
    ]
  });
}

export function resolveRevisionFeedbackFromPlanMetadata(metadata = null) {
  if (!isPlainObject(metadata)) return null;
  if (isPlainObject(metadata.revisionFeedback)) return metadata.revisionFeedback;
  const summary = isPlainObject(metadata.generativeSummary) ? metadata.generativeSummary : null;
  if (!summary) return null;
  const status = str(summary?.feedback?.status);
  const rejectionReasons = uniqueStrings(summary?.feedback?.rejectionReasons);
  const retryPressure = resolveRevisionRetryPressureFromPlanMetadata(metadata);
  const executionObjective = str(summary?.feedback?.executionObjective);
  const artisticCorrection = str(summary?.feedback?.artisticCorrection);
  if (!status && !rejectionReasons.length && !executionObjective && !artisticCorrection && !retryPressure) return null;
  return finalizeArtifact({
    artifactType: "revision_feedback_v1",
    artifactVersion: 1,
    status: status || (rejectionReasons.length || arr(retryPressure?.signals).length ? "revise_required" : "stable"),
    source: {
      sequenceArtisticGoalRef: str(summary?.refs?.sequenceArtisticGoalRef),
      sequenceRevisionObjectiveRef: str(summary?.refs?.sequenceRevisionObjectiveRef),
      revisionRetryPressureRef: str(retryPressure?.artifactId || summary?.refs?.revisionRetryPressureRef)
    },
    rejectionReasons,
    retryPressure: {
      signals: uniqueStrings(retryPressure?.signals),
      oscillatingCandidateIds: uniqueStrings(retryPressure?.oscillation?.candidateIds)
    },
    nextDirection: {
      artisticCorrection,
      executionObjective,
      revisionRoles: [],
      targetIds: [],
      successChecks: [],
      changeBias: null
    }
  });
}

export function resolveRevisionRetryPressureFromSnapshots(...snapshots) {
  for (const snapshot of snapshots) {
    const resolved = resolveRevisionRetryPressureFromPlanMetadata(planMetadataFromSnapshot(snapshot));
    if (resolved) return resolved;
  }
  return null;
}

export function resolveRevisionFeedbackFromSnapshots(...snapshots) {
  for (const snapshot of snapshots) {
    const resolved = resolveRevisionFeedbackFromPlanMetadata(planMetadataFromSnapshot(snapshot));
    if (resolved) return resolved;
  }
  return null;
}
