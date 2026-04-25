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

function validationFailuresFromSnapshot(snapshot = null) {
  const validation = isPlainObject(snapshot?.applyResult?.practicalValidation)
    ? snapshot.applyResult.practicalValidation
    : null;
  if (!validation) return [];
  const failures = isPlainObject(validation.failures) ? validation.failures : {};
  return [
    ...arr(failures.quality),
    ...arr(failures.design),
    ...arr(failures.timing),
    ...arr(failures.readback),
    ...arr(failures.metadata)
  ]
    .map((row) => ({
      kind: str(row?.kind),
      target: str(row?.target),
      detail: str(row?.detail)
    }))
    .filter((row) => row.kind || row.target || row.detail);
}

function isPreservationFailure(row = {}) {
  return (
    str(row?.kind) === "effect-preservation" ||
    /\b(original layer|preserved effects|preservation|overwrite existing|existing effects)\b/i.test(str(row?.detail))
  );
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

export function resolveRevisionFeedbackFromPracticalValidationSnapshot(snapshot = null) {
  const failures = validationFailuresFromSnapshot(snapshot);
  if (!failures.length) return null;
  const preservationFailures = failures.filter((row) => isPreservationFailure(row));
  const rejectionReasons = uniqueStrings(failures.map((row) => row.detail || row.kind));
  const primaryFailure = str(rejectionReasons[0] || "validation failure");
  const preservationObjective = preservationFailures.length
    ? `Revise the next pass to preserve existing effects: ${primaryFailure}. Place new overlapping effects on open layers unless replacement is explicitly authorized.`
    : "";
  return finalizeArtifact({
    artifactType: "revision_feedback_v1",
    artifactVersion: 1,
    status: "revise_required",
    source: {
      practicalValidationRef: str(snapshot?.applyResult?.practicalValidation?.artifactId),
      applyResultRef: str(snapshot?.applyResult?.artifactId)
    },
    rejectionReasons,
    retryPressure: {
      signals: [],
      oscillatingCandidateIds: []
    },
    nextDirection: {
      artisticCorrection: primaryFailure ? `Resolve: ${primaryFailure}` : "",
      executionObjective: preservationObjective || `Revise the next pass to resolve: ${primaryFailure}`,
      revisionRoles: preservationFailures.length ? ["preserve_existing_effects"] : [],
      targetIds: uniqueStrings(failures.map((row) => row.target)),
      successChecks: preservationFailures.length
        ? ["Existing sequence effects remain present on their original layers unless replacement is explicitly authorized."]
        : [],
      changeBias: preservationFailures.length
        ? {
            preservation: {
              mismatch: true,
              existingEffects: "preserve_unless_explicit_replace"
            }
          }
        : null
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
    const resolved =
      resolveRevisionFeedbackFromPlanMetadata(planMetadataFromSnapshot(snapshot)) ||
      resolveRevisionFeedbackFromPracticalValidationSnapshot(snapshot);
    if (resolved) return resolved;
  }
  return null;
}
