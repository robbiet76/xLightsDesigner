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

export function validateDirectSequencePromptState({
  expected = {},
  pageStates = {},
  xlightsSequenceState = null,
  xlightsEffectOccupancyState = null
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
    }
  };
}
