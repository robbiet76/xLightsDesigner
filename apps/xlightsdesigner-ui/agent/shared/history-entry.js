import { buildArtifactId } from "./artifact-ids.js";

function ensureString(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

export function buildArtifactRefs({
  analysisArtifact = null,
  designSceneContext = null,
  musicDesignContext = null,
  directorProfile = null,
  creativeBrief = null,
  proposalBundle = null,
  intentHandoff = null,
  planHandoff = null,
  applyResult = null,
  renderObservation = null,
  renderCritiqueContext = null,
  sequenceArtisticGoal = null,
  sequenceRevisionObjective = null
} = {}) {
  const revisionDelta = planHandoff?.metadata?.revisionDelta && typeof planHandoff.metadata.revisionDelta === "object"
    ? planHandoff.metadata.revisionDelta
    : null;
  return {
    analysisArtifactId: ensureString(analysisArtifact?.artifactId, null),
    sceneContextId: ensureString(designSceneContext?.artifactId, null),
    musicContextId: ensureString(musicDesignContext?.artifactId, null),
    directorProfileId: ensureString(directorProfile?.artifactId, null),
    briefId: ensureString(creativeBrief?.artifactId, null),
    proposalId: ensureString(proposalBundle?.artifactId, null),
    intentHandoffId: ensureString(intentHandoff?.artifactId, null),
    planId: ensureString(planHandoff?.artifactId, null),
    applyResultId: ensureString(applyResult?.artifactId, null),
    renderObservationId: ensureString(renderObservation?.artifactId, null),
    renderCritiqueContextId: ensureString(renderCritiqueContext?.artifactId, null),
    sequenceArtisticGoalId: ensureString(sequenceArtisticGoal?.artifactId, null),
    sequenceRevisionObjectiveId: ensureString(sequenceRevisionObjective?.artifactId, null),
    revisionDeltaId: ensureString(revisionDelta?.artifactId, null)
  };
}

function compactList(items, maxItems = 5) {
  return ensureArray(items)
    .filter((item) => typeof item === "string" && item.trim())
    .slice(0, maxItems);
}

export function buildHistorySnapshotSummary({
  proposalBundle = null,
  creativeBrief = null,
  planHandoff = null,
  applyResult = null
} = {}) {
  const proposalLines = compactList(proposalBundle?.proposalLines, 6);
  const goals = compactList(creativeBrief?.goals, 4);
  const assumptions = compactList(proposalBundle?.assumptions, 4);
  const warnings = compactList(planHandoff?.warnings, 6);
  const targets = compactList(planHandoff?.targetIds, 8);
  const selectedSections = compactList(planHandoff?.selectedSections, 8);
  const revisionDelta = planHandoff?.metadata?.revisionDelta && typeof planHandoff.metadata.revisionDelta === "object"
    ? planHandoff.metadata.revisionDelta
    : null;
  const priorPassMemory = planHandoff?.metadata?.priorPassMemory && typeof planHandoff.metadata.priorPassMemory === "object"
    ? planHandoff.metadata.priorPassMemory
    : null;
  const candidateSelection = planHandoff?.metadata?.candidateSelection && typeof planHandoff.metadata.candidateSelection === "object"
    ? planHandoff.metadata.candidateSelection
    : null;
  const requestScopeSummary = {
    mode: ensureString(planHandoff?.metadata?.requestScopeMode, null),
    reviewStartLevel: ensureString(planHandoff?.metadata?.reviewStartLevel, null),
    sectionScopeKind: ensureString(planHandoff?.metadata?.sectionScopeKind, null)
  };
  return {
    designSummary: {
      title: ensureString(creativeBrief?.title, "Design snapshot"),
      goals,
      assumptions
    },
    sequenceSummary: {
      proposalLines,
      targets,
      sections: selectedSections,
      warnings,
      requestScope: requestScopeSummary,
      retryPressure: {
        signals: compactList(priorPassMemory?.retryPressureSignals, 6),
        oscillatingCandidates: ensureArray(candidateSelection?.scoredCandidates)
          .filter((row) => ensureString(row?.oscillationRisk) === "high")
          .map((row) => ensureString(row?.candidateId, ""))
          .filter(Boolean)
          .slice(0, 6)
      },
      revisionDelta: revisionDelta
        ? {
            currentEffects: compactList(revisionDelta?.current?.effectNames, 6),
            currentTargets: compactList(revisionDelta?.current?.targetIds, 6),
            introducedEffects: compactList(revisionDelta?.introduced?.effectNames, 6),
            introducedTargets: compactList(revisionDelta?.introduced?.targetIds, 6)
          }
        : null
    },
    applySummary: {
      status: ensureString(applyResult?.status, "pending"),
      failureReason: ensureString(applyResult?.failureReason, null),
      commandCount: Number.isFinite(planHandoff?.graph?.nodeCount)
        ? planHandoff.graph.nodeCount
        : ensureArray(planHandoff?.commands).length,
      impactCount: Number.isFinite(planHandoff?.impactCount)
        ? planHandoff.impactCount
        : proposalLines.length
    },
    verificationSummary: applyResult?.verification
      ? {
          ok: applyResult.verification.ok !== false,
          checked: compactList(applyResult.verification.checked, 8),
          failures: compactList(applyResult.verification.failures, 8)
        }
      : null,
    practicalValidationSummary: applyResult?.practicalValidation
      ? {
          overallOk: applyResult.practicalValidation.overallOk === true,
          designSummary: ensureString(applyResult.practicalValidation.designSummary, null),
          artifactType: ensureString(applyResult.practicalValidation.artifactType, null),
          trainingArtifactVersion: ensureString(applyResult.practicalValidation?.trainingKnowledge?.artifactVersion, null),
          readbackFailed: Number(applyResult.practicalValidation?.summary?.readbackChecks?.failed || 0),
          designFailed: Number(applyResult.practicalValidation?.summary?.designChecks?.failed || 0)
        }
      : null
  };
}

export function buildHistoryEntry({
  projectId = null,
  projectKey = null,
  sequencePath = null,
  xlightsRevisionBefore = null,
  xlightsRevisionAfter = null,
  status = "pending",
  summary = "",
  artifactRefs = {},
  snapshotSummary = {},
  applyStage = null,
  commandCount = 0,
  impactCount = 0,
  verification = null,
  createdAt = new Date().toISOString()
} = {}) {
  const normalized = {
    artifactType: "history_entry_v1",
    artifactVersion: "1.0",
    createdAt,
    projectId: ensureString(projectId, null),
    projectKey: ensureString(projectKey, null),
    sequencePath: ensureString(sequencePath, null),
    xlightsRevisionBefore: ensureString(xlightsRevisionBefore, null),
    xlightsRevisionAfter: ensureString(xlightsRevisionAfter, null),
    status: ensureString(status, "pending"),
    summary: ensureString(summary, ""),
    artifactRefs: {
      analysisArtifactId: ensureString(artifactRefs?.analysisArtifactId, null),
      sceneContextId: ensureString(artifactRefs?.sceneContextId, null),
      musicContextId: ensureString(artifactRefs?.musicContextId, null),
      directorProfileId: ensureString(artifactRefs?.directorProfileId, null),
      briefId: ensureString(artifactRefs?.briefId, null),
      proposalId: ensureString(artifactRefs?.proposalId, null),
      intentHandoffId: ensureString(artifactRefs?.intentHandoffId, null),
      planId: ensureString(artifactRefs?.planId, null),
      applyResultId: ensureString(artifactRefs?.applyResultId, null),
      renderObservationId: ensureString(artifactRefs?.renderObservationId, null),
      renderCritiqueContextId: ensureString(artifactRefs?.renderCritiqueContextId, null),
      sequenceArtisticGoalId: ensureString(artifactRefs?.sequenceArtisticGoalId, null),
      sequenceRevisionObjectiveId: ensureString(artifactRefs?.sequenceRevisionObjectiveId, null),
      revisionDeltaId: ensureString(artifactRefs?.revisionDeltaId, null)
    },
    snapshotSummary: snapshotSummary && typeof snapshotSummary === "object" ? snapshotSummary : {},
    applyStage: ensureString(applyStage, null),
    commandCount: Number.isFinite(commandCount) ? commandCount : 0,
    impactCount: Number.isFinite(impactCount) ? impactCount : 0,
    verification: verification && typeof verification === "object" ? verification : null
  };
  return {
    ...normalized,
    historyEntryId: buildArtifactId(normalized.artifactType, normalized)
  };
}
