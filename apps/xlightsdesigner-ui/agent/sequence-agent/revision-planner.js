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

function inferRequestedScope(designHandoff = null) {
  const sections = uniqueStrings(designHandoff?.scope?.sections);
  const targetIds = uniqueStrings(designHandoff?.scope?.targetIds);
  const allowGlobalRewrite = Boolean(designHandoff?.constraints?.allowGlobalRewrite);
  if (allowGlobalRewrite || (!sections.length && !targetIds.length)) {
    return {
      mode: "whole_sequence",
      reviewStartLevel: "macro",
      sectionScopeKind: sections.length ? "timing_track_windows" : "full_sequence"
    };
  }
  if (sections.length && targetIds.length) {
    return {
      mode: "section_target_refinement",
      reviewStartLevel: "section",
      sectionScopeKind: "timing_track_windows"
    };
  }
  if (sections.length) {
    return {
      mode: "section_selection",
      reviewStartLevel: "section",
      sectionScopeKind: "timing_track_windows"
    };
  }
  return {
    mode: "target_refinement",
    reviewStartLevel: targetIds.length === 1 ? "model" : "group",
    sectionScopeKind: "full_sequence"
  };
}

export function buildSequencerRevisionBrief({
  sequenceArtisticGoal = null,
  sequenceRevisionObjective = null,
  sequencingDesignHandoff = null
} = {}) {
  const objective = isPlainObject(sequenceRevisionObjective) ? sequenceRevisionObjective : null;
  const artisticGoal = isPlainObject(sequenceArtisticGoal) ? sequenceArtisticGoal : null;
  const designHandoff = isPlainObject(sequencingDesignHandoff) ? sequencingDesignHandoff : null;
  if (!objective && !artisticGoal && !designHandoff) return null;

  const ladderLevel = str(objective?.ladderLevel || artisticGoal?.scope?.goalLevel || "unknown");
  const designerDirection = isPlainObject(objective?.designerDirection) ? objective.designerDirection : {};
  const sequencerDirection = isPlainObject(objective?.sequencerDirection) ? objective.sequencerDirection : {};
  const artisticIntent = isPlainObject(artisticGoal?.artisticIntent) ? artisticGoal.artisticIntent : {};
  const scope = isPlainObject(objective?.scope) ? objective.scope : {};
  const requestedScope = isPlainObject(scope?.requestedScope) ? scope.requestedScope : inferRequestedScope(designHandoff);

  const targetScope = [...new Set([
    ...arr(sequencerDirection?.focusTargets),
    ...arr(scope?.revisionTargets),
    ...arr(designHandoff?.scope?.targetIds)
  ].map((row) => str(row)).filter(Boolean))];
  const sectionScope = arr(designHandoff?.scope?.sections);

  const summaryParts = [
    str(designerDirection.artisticCorrection),
    str(sequencerDirection.executionObjective)
  ].filter(Boolean);

  return {
    artifactType: "sequencer_revision_brief_v1",
    artifactVersion: 1,
    ladderLevel,
    nextOwner: str(scope.nextOwner || "shared"),
    requestScopeMode: str(requestedScope.mode),
    reviewStartLevel: str(scope.reviewStartLevel || requestedScope.reviewStartLevel),
    sectionScopeKind: str(requestedScope.sectionScopeKind),
    artisticGoalSummary: str(designerDirection.artisticCorrection || artisticGoal?.evaluationLens?.comparisonQuestions?.[0]),
    executionObjective: str(sequencerDirection.executionObjective),
    leadTarget: str(artisticIntent.leadTarget),
    supportTargets: arr(artisticIntent.supportTargets),
    sectionArc: str(artisticIntent.sectionArc),
    motionCharacter: str(artisticIntent.motionCharacter),
    densityCharacter: str(artisticIntent.densityCharacter),
    targetScope,
    revisionRoles: arr(scope?.revisionRoles),
    revisionTargets: arr(scope?.revisionTargets),
    focusTargets: arr(sequencerDirection?.focusTargets),
    sectionScope,
    blockedMoves: arr(sequencerDirection.blockedMoves),
    successChecks: arr(objective?.successChecks),
    summary: summaryParts.join(" "),
  };
}
