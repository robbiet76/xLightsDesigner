function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeSequenceName(value = "") {
  return str(value).replace(/\\/g, "/").split("/").pop().replace(/\.xsq$/i, "").toLowerCase();
}

function includesInsensitive(value = "", fragment = "") {
  return str(value).toLowerCase().includes(str(fragment).toLowerCase());
}

function hasSongStructureTrack(timing = {}) {
  return arr(timing?.trackNames || timing?.xdTrackNames || []).some((name) => /song structure|section/i.test(str(name)));
}

function pickSequencingDesignHandoff(handoffs = {}, sequencingDesignHandoff = null) {
  if (sequencingDesignHandoff && typeof sequencingDesignHandoff === "object" && !Array.isArray(sequencingDesignHandoff)) {
    return sequencingDesignHandoff;
  }
  if (handoffs?.planHandoff?.metadata?.sequencingDesignHandoff && typeof handoffs.planHandoff.metadata.sequencingDesignHandoff === "object") {
    return handoffs.planHandoff.metadata.sequencingDesignHandoff;
  }
  if (handoffs?.intentHandoff?.sequencingDesignHandoff && typeof handoffs.intentHandoff.sequencingDesignHandoff === "object") {
    return handoffs.intentHandoff.sequencingDesignHandoff;
  }
  return null;
}

function buildValidationDesignContext(handoffs = {}, sequencingDesignHandoff = null) {
  const designHandoff = pickSequencingDesignHandoff(handoffs, sequencingDesignHandoff);
  const trainingKnowledge = handoffs?.planHandoff?.metadata?.trainingKnowledge && typeof handoffs.planHandoff.metadata.trainingKnowledge === "object"
    ? handoffs.planHandoff.metadata.trainingKnowledge
    : {};
  const focusPlan = designHandoff?.focusPlan && typeof designHandoff.focusPlan === "object" ? designHandoff.focusPlan : {};
  const sectionName = str(designHandoff?.scope?.sections?.[0]);
  const matchingDirective = arr(designHandoff?.sectionDirectives).find((row) => str(row?.sectionName) === sectionName) || null;
  return {
    designSummary: str(designHandoff?.designSummary),
    sectionDirectiveCount: arr(designHandoff?.sectionDirectives).length,
    primaryFocusTargetIds: arr(focusPlan?.primaryTargetIds).map((row) => str(row)).filter(Boolean),
    preferredVisualFamilies: arr(matchingDirective?.preferredVisualFamilies).map((row) => str(row)).filter(Boolean),
    trainingKnowledge
  };
}

export function validateDirectSequencePromptState({
  expected = {},
  pageStates = {},
  xlightsSequenceState = null,
  xlightsEffectOccupancyState = null,
  handoffs = {},
  sequencingDesignHandoff = null
} = {}) {
  const sequence = pageStates?.sequence || {};
  const review = pageStates?.review || {};
  const project = pageStates?.project || {};
  const issues = [];
  const requireAppliedState = expected?.applied === true;

  const expectedSequenceName = str(expected.sequenceName);
  if (
    expectedSequenceName &&
    normalizeSequenceName(project?.data?.sequenceContext?.activeSequence) !== normalizeSequenceName(expectedSequenceName)
  ) {
    issues.push({ code: "wrong_active_sequence", message: `Active sequence mismatch: expected ${expectedSequenceName}.` });
  }

  const rows = arr(sequence?.data?.rows);
  if (!rows.length) {
    issues.push({ code: "no_sequence_rows", message: "Sequence dashboard has no draft rows." });
  }

  const target = str(expected.target);
  const section = str(expected.section);
  const effectName = str(expected.effectName);
  const matchingRows = rows.filter((row) => {
    if (target && str(row?.target) !== target) return false;
    if (section && str(row?.section) !== section) return false;
    if (effectName && !includesInsensitive(row?.summary, effectName)) return false;
    return true;
  });
  if (!matchingRows.length) {
    issues.push({ code: "missing_expected_sequence_row", message: "No sequence row matches the expected target/section/effect." });
  }

  const unexpectedRows = rows.filter((row) => {
    if (target && str(row?.target) !== target) return true;
    return false;
  });
  if (target && unexpectedRows.length) {
    issues.push({ code: "scope_overexpanded", message: `Unexpected sequence targets present: ${unexpectedRows.map((row) => row.target).join(", ")}.` });
  }

  const reviewRows = arr(review?.data?.rows);
  if (!reviewRows.length) {
    issues.push({ code: "no_review_rows", message: "Review dashboard has no pending rows." });
  }

  const designContext = buildValidationDesignContext(handoffs, sequencingDesignHandoff);
  if (target && designContext.primaryFocusTargetIds.length && !designContext.primaryFocusTargetIds.includes(target)) {
    issues.push({
      code: "target_not_in_primary_focus",
      message: `Expected target ${target} is outside the primary focus set (${designContext.primaryFocusTargetIds.join(", ")}).`
    });
  }

  if (section && str(sequence?.data?.timingDependency?.needsTiming) === "true" && !sequence?.data?.timingDependency?.ready) {
    issues.push({ code: "missing_required_timing_track", message: "Sequence dashboard reports missing timing dependency." });
  }

  if (requireAppliedState && xlightsSequenceState && section) {
    if (!xlightsSequenceState.sequence?.isOpen) {
      issues.push({ code: "no_open_sequence", message: "xLights reports no open sequence." });
    }
    if (!hasSongStructureTrack(xlightsSequenceState.timing)) {
      issues.push({ code: "missing_timing_track_in_xlights", message: "xLights live state does not show a Song Structure timing track." });
    }
  }

  if (requireAppliedState && xlightsEffectOccupancyState && effectName) {
    const matchedCount = Number(xlightsEffectOccupancyState?.matchedCount || 0);
    if (matchedCount <= 0) {
      issues.push({ code: "effect_not_present_in_xlights", message: "xLights effect occupancy did not confirm the expected effect." });
    }
  }

  return {
    contract: "clean_sequence_validation_state_v1",
    version: "1.0",
    ok: issues.length === 0,
    summary: issues.length === 0
      ? "Clean-sequence validation checks passed."
      : `${issues.length} clean-sequence validation issue${issues.length === 1 ? "" : "s"} detected.`,
    issues,
    refs: {
      sequenceDashboard: sequence?.contract || null,
      reviewDashboard: review?.contract || null,
      xlightsSequenceState: xlightsSequenceState?.contract || null,
      xlightsEffectOccupancyState: xlightsEffectOccupancyState?.contract || null
    },
    designContext
  };
}
