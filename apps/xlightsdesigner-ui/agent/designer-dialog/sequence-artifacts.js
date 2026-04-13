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

function inferGoalLevel(sections = []) {
  return arr(sections).length > 1 ? "macro" : "section";
}

function pickPrimaryTargets(handoff = null) {
  const focusPlan = isPlainObject(handoff?.focusPlan) ? handoff.focusPlan : {};
  return uniqueStrings(focusPlan.primaryTargets || focusPlan.primaryTargetIds);
}

function pickSecondaryTargets(handoff = null) {
  const focusPlan = isPlainObject(handoff?.focusPlan) ? handoff.focusPlan : {};
  return uniqueStrings(focusPlan.secondaryTargets || focusPlan.secondaryTargetIds);
}

export function buildSequenceArtisticGoalFromDesignHandoff({
  sequencingDesignHandoff = null,
  proposalBundle = null
} = {}) {
  const handoff = isPlainObject(sequencingDesignHandoff) ? sequencingDesignHandoff : null;
  if (!handoff) return null;

  const sections = uniqueStrings(handoff?.scope?.sections);
  const sectionDirectives = arr(handoff?.sectionDirectives);
  const firstDirective = isPlainObject(sectionDirectives[0]) ? sectionDirectives[0] : {};
  const primaryTargets = pickPrimaryTargets(handoff);
  const secondaryTargets = pickSecondaryTargets(handoff);
  const mustPreserve = uniqueStrings([
    handoff?.focusPlan?.balanceRule,
    handoff?.designSummary
  ]);
  const mustImprove = uniqueStrings([
    str(firstDirective?.notes) ? `Strengthen ${str(firstDirective.notes)}` : "",
    sections.length > 1 ? "Keep section-to-section contrast readable." : ""
  ]);
  const comparisonQuestion = str(firstDirective?.notes)
    ? `Does the rendered result read as ${str(firstDirective.notes)}?`
    : (sections.length > 1
        ? "Does the rendered result preserve the intended section hierarchy and contrast?"
        : "Does the rendered result preserve the intended lead/support hierarchy?");

  return {
    artifactType: "sequence_artistic_goal_v1",
    artifactVersion: 1,
    scope: {
      goalLevel: inferGoalLevel(sections),
      sections
    },
    artisticIntent: {
      emotionalTone: str(proposalBundle?.summary || handoff?.goal || "designer_defined"),
      visualTone: str(handoff?.designSummary || proposalBundle?.summary || "designer_defined"),
      leadTarget: primaryTargets[0] || "",
      supportTargets: secondaryTargets,
      focusHierarchy: str(handoff?.focusPlan?.balanceRule || "Preserve a readable lead/support/accent hierarchy."),
      sectionArc: str(firstDirective?.notes || handoff?.designSummary),
      motionCharacter: str(firstDirective?.motionTarget || "steady_motion"),
      densityCharacter: str(firstDirective?.densityTarget || "moderate")
    },
    evaluationLens: {
      mustPreserve,
      mustImprove,
      comparisonQuestions: [comparisonQuestion]
    },
    antiGoals: uniqueStrings(handoff?.avoidances),
    traceability: {
      designSummary: str(handoff?.designSummary),
      proposalSummary: str(proposalBundle?.summary)
    }
  };
}

export function buildSequenceRevisionObjectiveFromArtifacts({
  sequenceArtisticGoal = null,
  sequencingDesignHandoff = null
} = {}) {
  const artisticGoal = isPlainObject(sequenceArtisticGoal) ? sequenceArtisticGoal : null;
  const handoff = isPlainObject(sequencingDesignHandoff) ? sequencingDesignHandoff : null;
  if (!artisticGoal || !handoff) return null;

  const sections = uniqueStrings(handoff?.scope?.sections);
  const primaryTargets = pickPrimaryTargets(handoff);
  const secondaryTargets = pickSecondaryTargets(handoff);
  const firstDirective = isPlainObject(arr(handoff?.sectionDirectives)[0]) ? arr(handoff.sectionDirectives)[0] : {};
  const sectionScope = sections.length ? sections.join(", ") : "the current scope";
  const leadTarget = primaryTargets[0] || "the lead target";
  const supportClause = secondaryTargets.length
    ? ` while keeping ${secondaryTargets.slice(0, 4).join(", ")} in a support role`
    : "";

  return {
    artifactType: "sequence_revision_objective_v1",
    artifactVersion: 1,
    scope: {
      nextOwner: "sequencer",
      sections
    },
    ladderLevel: str(artisticGoal?.scope?.goalLevel || inferGoalLevel(sections)),
    designerDirection: {
      artisticCorrection: str(artisticGoal?.evaluationLens?.comparisonQuestions?.[0] || handoff?.designSummary),
      mustPreserve: uniqueStrings(artisticGoal?.evaluationLens?.mustPreserve),
      mustAvoid: uniqueStrings(handoff?.avoidances),
      evaluationPrompt: str(artisticGoal?.evaluationLens?.comparisonQuestions?.[0] || "")
    },
    sequencerDirection: {
      executionObjective: `Translate the current design handoff into a bounded ${sections.length > 1 ? "multi-section" : "section"} pass for ${sectionScope} with ${leadTarget} leading${supportClause}.`,
      allowedMoves: uniqueStrings([
        str(firstDirective?.motionTarget),
        str(firstDirective?.densityTarget)
      ]),
      blockedMoves: uniqueStrings(handoff?.avoidances),
      revisionBatchShape: `${str(artisticGoal?.scope?.goalLevel || inferGoalLevel(sections))}_pass`
    },
    successChecks: uniqueStrings([
      str(artisticGoal?.evaluationLens?.comparisonQuestions?.[0]),
      primaryTargets.length ? `${leadTarget} remains the dominant visual lead.` : "",
      secondaryTargets.length ? "Support targets stay in a secondary role." : ""
    ])
  };
}

function collectValidationFailures(practicalValidation = null) {
  const validation = isPlainObject(practicalValidation) ? practicalValidation : null;
  if (!validation) return [];
  const failures = validation.failures && typeof validation.failures === "object" ? validation.failures : {};
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

export function refreshSequenceArtisticGoalFromPracticalValidation({
  priorArtisticGoal = null,
  sequencingDesignHandoff = null,
  practicalValidation = null
} = {}) {
  const base = isPlainObject(priorArtisticGoal)
    ? structuredClone(priorArtisticGoal)
    : buildSequenceArtisticGoalFromDesignHandoff({ sequencingDesignHandoff });
  if (!base) return null;

  const failures = collectValidationFailures(practicalValidation);
  if (!failures.length) return base;
  const primaryFailure = failures[0];
  const comparisonQuestion = primaryFailure.detail
    ? `Does the next pass resolve this problem: ${primaryFailure.detail}`
    : "Does the next pass resolve the highest-priority observed validation failure?";

  base.evaluationLens = {
    ...(isPlainObject(base.evaluationLens) ? base.evaluationLens : {}),
    mustImprove: uniqueStrings([
      ...arr(base?.evaluationLens?.mustImprove),
      ...failures.map((row) => row.detail)
    ]),
    comparisonQuestions: [comparisonQuestion]
  };
  base.traceability = {
    ...(isPlainObject(base.traceability) ? base.traceability : {}),
    practicalValidationStatus: str(practicalValidation?.status),
    practicalValidationOverallOk: Boolean(practicalValidation?.overallOk),
    practicalValidationFailureCount: failures.length
  };
  return base;
}

export function refreshSequenceRevisionObjectiveFromPracticalValidation({
  priorRevisionObjective = null,
  sequenceArtisticGoal = null,
  sequencingDesignHandoff = null,
  practicalValidation = null
} = {}) {
  const base = isPlainObject(priorRevisionObjective)
    ? structuredClone(priorRevisionObjective)
    : buildSequenceRevisionObjectiveFromArtifacts({
        sequenceArtisticGoal,
        sequencingDesignHandoff
      });
  if (!base) return null;

  const failures = collectValidationFailures(practicalValidation);
  if (!failures.length) return base;
  const primaryFailure = failures[0];
  const failureText = str(primaryFailure.detail || primaryFailure.kind || "highest-priority validation failure");
  const currentPrompt = str(sequenceArtisticGoal?.evaluationLens?.comparisonQuestions?.[0]);

  base.scope = {
    ...(isPlainObject(base.scope) ? base.scope : {}),
    nextOwner: "shared"
  };
  base.designerDirection = {
    ...(isPlainObject(base.designerDirection) ? base.designerDirection : {}),
    artisticCorrection: currentPrompt || `Resolve: ${failureText}`,
    mustAvoid: uniqueStrings([
      ...arr(base?.designerDirection?.mustAvoid),
      ...failures.map((row) => row.detail)
    ]),
    evaluationPrompt: currentPrompt || `Resolve: ${failureText}`
  };
  base.sequencerDirection = {
    ...(isPlainObject(base.sequencerDirection) ? base.sequencerDirection : {}),
    executionObjective: `Revise the next pass to resolve: ${failureText}`,
    blockedMoves: uniqueStrings([
      ...arr(base?.sequencerDirection?.blockedMoves),
      ...failures.map((row) => row.kind)
    ]),
    revisionBatchShape: `${str(base?.ladderLevel || "section")}_pass`
  };
  base.successChecks = uniqueStrings([
    ...arr(base?.successChecks),
    currentPrompt || "",
    `Validation failure addressed: ${failureText}`
  ]);
  return base;
}
