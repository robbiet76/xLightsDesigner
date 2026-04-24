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

function revisionRolesForPriorSignals(priorPassMemory = null) {
  const signals = new Set(uniqueStrings(priorPassMemory?.unresolvedSignals));
  return uniqueStrings([
    signals.has("lead_mismatch") ? "strengthen_lead" : "",
    signals.has("over_coverage") ? "reduce_competing_support" : "",
    signals.has("under_coverage") ? "widen_support" : "",
    signals.has("weak_section_contrast") ? "increase_section_contrast" : "",
    signals.has("flat_development") ? "add_section_development" : ""
  ]);
}

function targetHintsForPriorSignals({ priorPassMemory = null, artisticIntent = {} } = {}) {
  const signals = new Set(uniqueStrings(priorPassMemory?.unresolvedSignals));
  const previousRevisionTargets = uniqueStrings(priorPassMemory?.previousRevisionTargets);
  const previousLeadModel = str(priorPassMemory?.previousLeadModel);
  const previousTargetIds = uniqueStrings(priorPassMemory?.previousTargetIds);
  const supportTargets = uniqueStrings(artisticIntent?.supportTargets);
  const observedLeadTargets = uniqueStrings([...previousRevisionTargets, previousLeadModel]);
  const priorTargets = uniqueStrings([...previousRevisionTargets, ...previousTargetIds]);
  return {
    focusTargets: signals.has("lead_mismatch") ? observedLeadTargets : [],
    revisionTargets: uniqueStrings([
      ...(signals.has("weak_section_contrast") || signals.has("flat_development") || signals.has("over_coverage") ? priorTargets : []),
      ...(signals.has("under_coverage") ? (supportTargets.length ? supportTargets : priorTargets) : [])
    ])
  };
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
  sequencingDesignHandoff = null,
  priorPassMemory = null,
  revisionRetryPressure = null,
  revisionFeedback = null
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
  const feedback = isPlainObject(revisionFeedback) ? revisionFeedback : null;
  const feedbackDirection = isPlainObject(feedback?.nextDirection) ? feedback.nextDirection : {};
  const changeBias = isPlainObject(feedbackDirection?.changeBias) ? feedbackDirection.changeBias : null;
  const requestedScope = isPlainObject(scope?.requestedScope) ? scope.requestedScope : inferRequestedScope(designHandoff);
  const priorTargetHints = targetHintsForPriorSignals({ priorPassMemory, artisticIntent });

  const targetScope = [...new Set([
    ...arr(feedbackDirection?.targetIds),
    ...arr(sequencerDirection?.focusTargets),
    ...arr(scope?.revisionTargets),
    ...arr(priorTargetHints?.focusTargets),
    ...arr(priorTargetHints?.revisionTargets),
    ...arr(designHandoff?.scope?.targetIds)
  ].map((row) => str(row)).filter(Boolean))];
  const sectionScope = arr(designHandoff?.scope?.sections);

  const retryPressureSignals = uniqueStrings(
    arr(revisionRetryPressure?.signals).length
      ? revisionRetryPressure.signals
      : priorPassMemory?.retryPressureSignals
  );

  const summaryParts = [
    str(feedbackDirection.artisticCorrection || designerDirection.artisticCorrection),
    str(feedbackDirection.executionObjective || sequencerDirection.executionObjective),
    arr(priorPassMemory?.unresolvedSignals).length
      ? `Carry forward unresolved prior-pass signals: ${arr(priorPassMemory.unresolvedSignals).join(", ")}.`
      : ""
    ,
    retryPressureSignals.length
      ? `Retry pressure: ${retryPressureSignals.join(", ")}.`
      : ""
    ,
    arr(feedback?.rejectionReasons).length
      ? `Revision feedback: ${arr(feedback.rejectionReasons).join(", ")}.`
      : ""
  ].filter(Boolean);

  return {
    artifactType: "sequencer_revision_brief_v1",
    artifactVersion: 1,
    ladderLevel,
    nextOwner: str(scope.nextOwner || "shared"),
    requestScopeMode: str(requestedScope.mode),
    reviewStartLevel: str(scope.reviewStartLevel || requestedScope.reviewStartLevel),
    sectionScopeKind: str(requestedScope.sectionScopeKind),
    artisticGoalSummary: str(feedbackDirection.artisticCorrection || designerDirection.artisticCorrection || artisticGoal?.evaluationLens?.comparisonQuestions?.[0]),
    executionObjective: str(feedbackDirection.executionObjective || sequencerDirection.executionObjective),
    leadTarget: str(artisticIntent.leadTarget),
    supportTargets: arr(artisticIntent.supportTargets),
    sectionArc: str(artisticIntent.sectionArc),
    motionCharacter: str(artisticIntent.motionCharacter),
    densityCharacter: str(artisticIntent.densityCharacter),
    targetScope,
    revisionRoles: uniqueStrings([
      ...arr(feedbackDirection?.revisionRoles),
      ...arr(scope?.revisionRoles),
      ...revisionRolesForPriorSignals(priorPassMemory)
    ]),
    revisionTargets: uniqueStrings([
      ...arr(feedbackDirection?.targetIds),
      ...arr(scope?.revisionTargets),
      ...arr(priorTargetHints?.revisionTargets)
    ]),
    focusTargets: uniqueStrings([
      ...arr(feedbackDirection?.targetIds),
      ...arr(sequencerDirection?.focusTargets),
      ...arr(priorTargetHints?.focusTargets)
    ]),
    sectionScope,
    blockedMoves: arr(sequencerDirection.blockedMoves),
    successChecks: uniqueStrings([
      ...arr(feedbackDirection?.successChecks),
      ...arr(objective?.successChecks)
    ]),
    changeBias,
    priorPassMemory: isPlainObject(priorPassMemory) ? priorPassMemory : null,
    revisionRetryPressure: isPlainObject(revisionRetryPressure) ? revisionRetryPressure : null,
    revisionFeedback: feedback,
    retryPressureSignals,
    summary: summaryParts.join(" "),
  };
}
