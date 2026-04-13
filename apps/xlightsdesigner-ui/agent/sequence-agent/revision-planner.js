function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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

  const targetScope = arr(designHandoff?.scope?.targetIds);
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
    artisticGoalSummary: str(designerDirection.artisticCorrection || artisticGoal?.evaluationLens?.comparisonQuestions?.[0]),
    executionObjective: str(sequencerDirection.executionObjective),
    leadTarget: str(artisticIntent.leadTarget),
    supportTargets: arr(artisticIntent.supportTargets),
    sectionArc: str(artisticIntent.sectionArc),
    motionCharacter: str(artisticIntent.motionCharacter),
    densityCharacter: str(artisticIntent.densityCharacter),
    targetScope,
    sectionScope,
    blockedMoves: arr(sequencerDirection.blockedMoves),
    successChecks: arr(objective?.successChecks),
    summary: summaryParts.join(" "),
  };
}
