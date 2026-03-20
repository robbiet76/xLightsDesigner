import { buildArtifactId } from "../shared/artifact-ids.js";

function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function summarizeChecks(checks = []) {
  const rows = arr(checks);
  return {
    total: rows.length,
    passed: rows.filter((row) => row?.ok === true).length,
    failed: rows.filter((row) => row?.ok === false).length
  };
}

function compactFailures(checks = [], limit = 8) {
  return arr(checks)
    .filter((row) => row?.ok === false)
    .map((row) => ({
      kind: str(row?.kind),
      target: str(row?.target),
      detail: str(row?.detail)
    }))
    .filter((row) => row.kind || row.target || row.detail)
    .slice(0, limit);
}

export function buildPracticalSequenceValidation({
  planHandoff = null,
  applyResult = null,
  verification = null
} = {}) {
  const meta = planHandoff?.metadata && typeof planHandoff.metadata === "object" ? planHandoff.metadata : {};
  const designContext = verification?.designContext && typeof verification.designContext === "object"
    ? verification.designContext
    : {};
  const designAlignment = verification?.designAlignment && typeof verification.designAlignment === "object"
    ? verification.designAlignment
    : {};
  const readbackChecks = summarizeChecks(verification?.checks);
  const designChecks = summarizeChecks(verification?.designChecks);

  const artifact = {
    artifactType: "practical_sequence_validation_v1",
    artifactVersion: "1.0",
    createdAt: new Date().toISOString(),
    planId: str(planHandoff?.planId),
    applyResultId: str(applyResult?.artifactId),
    status: str(applyResult?.status || "unknown"),
    overallOk: Boolean(
      verification?.revisionAdvanced === true &&
      verification?.expectedMutationsPresent === true &&
      designChecks.failed === 0
    ),
    designSummary: str(designContext?.designSummary || meta?.sequencingDesignHandoffSummary),
    sectionDirectiveCount: Number(designContext?.sectionDirectiveCount || meta?.sequencingSectionDirectiveCount || 0),
    trainingKnowledge: meta?.trainingKnowledge && typeof meta.trainingKnowledge === "object"
      ? meta.trainingKnowledge
      : (designContext?.trainingKnowledge && typeof designContext.trainingKnowledge === "object" ? designContext.trainingKnowledge : {}),
    summary: {
      revisionAdvanced: verification?.revisionAdvanced === true,
      expectedMutationsPresent: verification?.expectedMutationsPresent === true,
      readbackChecks,
      designChecks
    },
    designAlignment: {
      primaryFocusTargetIds: arr(designAlignment?.primaryFocusTargetIds),
      coveredPrimaryFocusTargetIds: arr(designAlignment?.coveredPrimaryFocusTargetIds),
      uncoveredPrimaryFocusTargetIds: arr(designAlignment?.uncoveredPrimaryFocusTargetIds),
      preferredVisualFamilies: arr(designAlignment?.preferredVisualFamilies),
      preferredEffectHints: arr(designAlignment?.preferredEffectHints),
      observedTargets: arr(designAlignment?.observedTargets),
      observedEffectNames: arr(designAlignment?.observedEffectNames),
      roleCoverage: arr(designAlignment?.roleCoverage)
    },
    failures: {
      readback: compactFailures(verification?.checks),
      design: compactFailures(verification?.designChecks)
    }
  };

  artifact.artifactId = buildArtifactId(artifact.artifactType, artifact);
  return artifact;
}
