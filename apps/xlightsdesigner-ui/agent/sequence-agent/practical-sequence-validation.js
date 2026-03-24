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

function buildMetadataAssignmentIndex(metadataAssignments = []) {
  const out = new Map();
  for (const assignment of arr(metadataAssignments)) {
    const targetId = str(assignment?.targetId);
    if (!targetId) continue;
    out.set(targetId, assignment);
  }
  return out;
}

function summarizeObservedTargetMetadata(observedTargets = [], metadataAssignments = []) {
  const targetIds = Array.from(new Set(arr(observedTargets).map((row) => str(row)).filter(Boolean)));
  const assignmentIndex = buildMetadataAssignmentIndex(metadataAssignments);
  const missingMetadataTargetIds = [];
  const roleOnlyTargetIds = [];
  const definedVisualHintTargetIds = [];
  const pendingVisualHintTargetIds = [];
  const pendingOnlyVisualHintTargetIds = [];

  for (const targetId of targetIds) {
    const assignment = assignmentIndex.get(targetId);
    if (!assignment) {
      missingMetadataTargetIds.push(targetId);
      continue;
    }

    const rolePreference = str(assignment?.rolePreference);
    const semanticHints = arr(assignment?.semanticHints).map((row) => str(row)).filter(Boolean);
    const effectAvoidances = arr(assignment?.effectAvoidances).map((row) => str(row)).filter(Boolean);
    const visualHintDefinitions = arr(assignment?.visualHintDefinitions).filter((row) => row && typeof row === "object");
    const definedDefinitions = visualHintDefinitions.filter((row) => str(row?.status).toLowerCase() === "defined");
    const pendingDefinitions = visualHintDefinitions.filter((row) => str(row?.status).toLowerCase() === "pending_definition");

    if (definedDefinitions.length) definedVisualHintTargetIds.push(targetId);
    if (pendingDefinitions.length) pendingVisualHintTargetIds.push(targetId);
    if (pendingDefinitions.length && !definedDefinitions.length) pendingOnlyVisualHintTargetIds.push(targetId);
    if (rolePreference && !semanticHints.length && !effectAvoidances.length && !visualHintDefinitions.length) {
      roleOnlyTargetIds.push(targetId);
    }
  }

  return {
    observedTargetCount: targetIds.length,
    missingMetadataTargetIds,
    roleOnlyTargetIds,
    definedVisualHintTargetIds,
    pendingVisualHintTargetIds,
    pendingOnlyVisualHintTargetIds,
    counts: {
      missingMetadata: missingMetadataTargetIds.length,
      roleOnly: roleOnlyTargetIds.length,
      definedVisualHints: definedVisualHintTargetIds.length,
      pendingVisualHints: pendingVisualHintTargetIds.length,
      pendingOnlyVisualHints: pendingOnlyVisualHintTargetIds.length
    }
  };
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
  const metadataAssignments = arr(meta?.metadataAssignments);
  const readbackChecks = summarizeChecks(verification?.checks);
  const designChecks = summarizeChecks(verification?.designChecks);
  const metadataCoverage = summarizeObservedTargetMetadata(designAlignment?.observedTargets, metadataAssignments);

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
      designChecks,
      metadataCoverage: metadataCoverage.counts
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
    metadataCoverage,
    failures: {
      readback: compactFailures(verification?.checks),
      design: compactFailures(verification?.designChecks),
      metadata: [
        ...metadataCoverage.missingMetadataTargetIds.map((targetId) => ({
          kind: "missing_metadata",
          target: targetId,
          detail: "Observed target has no metadata assignment."
        })),
        ...metadataCoverage.pendingOnlyVisualHintTargetIds.map((targetId) => ({
          kind: "pending_visual_hint_definition",
          target: targetId,
          detail: "Observed target relies on visual hints that are still pending definition."
        }))
      ]
    }
  };

  artifact.artifactId = buildArtifactId(artifact.artifactType, artifact);
  return artifact;
}
