function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeSequenceName(value = "") {
  return str(value).replace(/\\/g, "/").split("/").pop().replace(/\.xsq$/i, "").toLowerCase();
}

function countByType(elements = []) {
  const counts = { model: 0, group: 0, submodel: 0, timing: 0, other: 0 };
  for (const row of arr(elements)) {
    const type = str(row?.type || "").toLowerCase();
    if (type === "model") counts.model += 1;
    else if (type === "group") counts.group += 1;
    else if (type === "submodel") counts.submodel += 1;
    else if (type === "timing") counts.timing += 1;
    else counts.other += 1;
  }
  return counts;
}

function normalizeTrack(track = {}, marks = null) {
  const name = str(typeof track === "string" ? track : track?.name);
  const source = str(track?.source || track?.provider || track?.type || "manual");
  const normalizedMarks = marks == null
    ? null
    : arr(marks).map((mark) => ({
        startMs: Number(mark?.startMs || 0),
        endMs: Number(mark?.endMs || 0),
        label: str(mark?.label || "")
      }));
  return {
    name,
    source,
    isXdTrack: /^xd:/i.test(name),
    markCount: normalizedMarks == null ? Number(track?.markCount || 0) : normalizedMarks.length,
    marks: normalizedMarks
  };
}

export function buildXLightsTimingState({ tracks = [], marksByTrack = {}, includeMarks = false } = {}) {
  const normalizedTracks = arr(tracks)
    .map((track) => normalizeTrack(track, includeMarks ? marksByTrack[str(track?.name || track)] || [] : null))
    .filter((track) => track.name);
  const names = normalizedTracks.map((track) => track.name);
  const xdTrackNames = normalizedTracks.filter((track) => track.isXdTrack).map((track) => track.name);
  return {
    contract: "xlights_timing_state_v1",
    version: "1.0",
    summary: normalizedTracks.length
      ? `${normalizedTracks.length} timing track${normalizedTracks.length === 1 ? "" : "s"} available.`
      : "No timing tracks are available.",
    trackCount: normalizedTracks.length,
    xdTrackCount: xdTrackNames.length,
    trackNames: names,
    xdTrackNames,
    tracks: normalizedTracks
  };
}

export function buildXLightsSequenceState({
  endpoint = "",
  openSequence = null,
  revision = "unknown",
  sequenceSettings = null,
  models = [],
  submodels = [],
  displayElements = [],
  timingState = null
} = {}) {
  const sequence = openSequence && typeof openSequence === "object" ? openSequence : null;
  const settings = sequenceSettings && typeof sequenceSettings === "object" ? sequenceSettings : {};
  const openPath = str(sequence?.file || sequence?.path || sequence?.sequenceFile || "");
  const displayCounts = countByType(displayElements);
  const resolvedTimingState = timingState && typeof timingState === "object"
    ? timingState
    : buildXLightsTimingState({ tracks: [] });

  return {
    contract: "xlights_sequence_state_v1",
    version: "1.0",
    endpoint: str(endpoint),
    sequence: {
      isOpen: Boolean(sequence),
      file: openPath,
      name: openPath ? openPath.split(/[\\/]/).pop() : "",
      revision: str(revision || "unknown"),
      mediaFile: str(sequence?.mediaFile || settings?.mediaFile || ""),
      frameRate: Number(settings?.frameRate || 0) || null,
      lengthMs: Number(settings?.lengthMs || 0) || null
    },
    layout: {
      modelCount: arr(models).length,
      submodelCount: arr(submodels).length,
      displayElementCount: arr(displayElements).length,
      displayElementTypeCounts: displayCounts
    },
    timing: resolvedTimingState,
    readiness: {
      ok: Boolean(sequence),
      level: sequence ? "ready" : "blocked",
      reasons: sequence ? [] : ["no_open_sequence"]
    },
    summary: sequence
      ? `Open sequence ${openPath.split(/[\\/]/).pop() || openPath} at revision ${str(revision || "unknown")}.`
      : "No open xLights sequence."
  };
}

function normalizeQuery(query = {}) {
  return {
    modelName: str(query?.modelName),
    layerIndex: Number.isFinite(Number(query?.layerIndex)) ? Number(query.layerIndex) : null,
    startMs: Number.isFinite(Number(query?.startMs)) ? Number(query.startMs) : null,
    endMs: Number.isFinite(Number(query?.endMs)) ? Number(query.endMs) : null,
    effectName: str(query?.effectName)
  };
}

function queryKey(query = {}) {
  return [
    str(query?.modelName),
    query?.layerIndex == null ? "*" : String(query.layerIndex),
    query?.startMs == null ? "*" : String(query.startMs),
    query?.endMs == null ? "*" : String(query.endMs),
    str(query?.effectName || "*")
  ].join("|");
}

function normalizeEffect(effect = {}) {
  return {
    modelName: str(effect?.modelName),
    layerIndex: Number.isFinite(Number(effect?.layerIndex)) ? Number(effect.layerIndex) : null,
    effectName: str(effect?.effectName),
    startMs: Number.isFinite(Number(effect?.startMs)) ? Number(effect.startMs) : null,
    endMs: Number.isFinite(Number(effect?.endMs)) ? Number(effect.endMs) : null
  };
}

function matchesEffect(query, effect) {
  if (query.modelName && query.modelName !== effect.modelName) return false;
  if (query.layerIndex != null && query.layerIndex !== effect.layerIndex) return false;
  if (query.effectName && query.effectName !== effect.effectName) return false;
  if (query.startMs != null && query.startMs !== effect.startMs) return false;
  if (query.endMs != null && query.endMs !== effect.endMs) return false;
  return true;
}

export function buildXLightsEffectOccupancyState({ queries = [], effectsByQuery = {} } = {}) {
  const normalizedQueries = arr(queries).map(normalizeQuery).filter((query) => query.modelName);
  const rows = normalizedQueries.map((query) => {
    const key = queryKey(query);
    const effects = arr(effectsByQuery[key]).map(normalizeEffect);
    const matched = effects.filter((effect) => matchesEffect(query, effect));
    return {
      query,
      queryKey: key,
      effectCount: effects.length,
      matchedCount: matched.length,
      matched,
      ok: matched.length > 0
    };
  });
  return {
    contract: "xlights_effect_occupancy_state_v1",
    version: "1.0",
    summary: rows.length
      ? `${rows.filter((row) => row.ok).length}/${rows.length} occupancy quer${rows.length === 1 ? "y" : "ies"} matched.`
      : "No effect occupancy queries were requested.",
    queryCount: rows.length,
    matchedCount: rows.filter((row) => row.ok).length,
    rows
  };
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

  if (section && sequence?.data?.timingDependency?.needsTiming === true && !sequence?.data?.timingDependency?.ready) {
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

export function validateDesignConceptState({
  expected = {},
  pageStates = {},
  xlightsSequenceState = null,
  xlightsEffectOccupancyState = null
} = {}) {
  const design = pageStates?.design || {};
  const review = pageStates?.review || {};
  const sequence = pageStates?.sequence || {};
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

  const designLabel = str(expected.designLabel);
  const anchor = str(expected.anchor || expected.section);
  const expectedTargets = arr(expected.targets).map((row) => str(row)).filter(Boolean).sort();
  const expectedFamilies = arr(expected.effectFamilies).map((row) => str(row)).filter(Boolean).sort();

  const conceptRows = arr(design?.data?.executionPlan?.conceptRows);
  const matchingDesignRows = conceptRows.filter((row) => !designLabel || str(row?.designLabel) === designLabel);
  if (!matchingDesignRows.length) {
    issues.push({ code: "missing_design_concept", message: "Design dashboard has no matching concept row." });
  }
  const designRow = matchingDesignRows[0] || null;
  if (designRow && anchor && str(designRow?.anchor) !== anchor) {
    issues.push({ code: "wrong_design_anchor", message: `Design concept anchor mismatch: expected ${anchor}.` });
  }
  if (designRow && expectedTargets.length) {
    const actualFocus = arr(designRow?.focus).map((row) => str(row)).filter(Boolean).sort();
    if (JSON.stringify(actualFocus) !== JSON.stringify(expectedTargets)) {
      issues.push({ code: "wrong_design_targets", message: `Design concept targets mismatch: expected ${expectedTargets.join(", ")}.` });
    }
  }
  if (designRow && expectedFamilies.length) {
    const actualFamilies = arr(designRow?.effectFamilies).map((row) => str(row)).filter(Boolean).sort();
    if (JSON.stringify(actualFamilies) !== JSON.stringify(expectedFamilies)) {
      issues.push({ code: "wrong_design_effect_families", message: `Design concept effect families mismatch: expected ${expectedFamilies.join(", ")}.` });
    }
  }

  const reviewRows = arr(review?.data?.rows);
  const matchingReviewRows = reviewRows.filter((row) => !designLabel || str(row?.designLabel) === designLabel);
  if (!matchingReviewRows.length) {
    issues.push({ code: "missing_review_group", message: "Review dashboard has no matching design concept row." });
  }

  const sequenceRows = arr(sequence?.data?.rows);
  const matchingSequenceRows = sequenceRows.filter((row) => !designLabel || str(row?.designLabel) === designLabel);
  if (!matchingSequenceRows.length) {
    issues.push({ code: "missing_sequence_rows", message: "Sequence dashboard has no matching concept rows." });
  }
  if (matchingSequenceRows.length && expectedTargets.length) {
    const actualTargets = [...new Set(matchingSequenceRows.map((row) => str(row?.target)).filter(Boolean))].sort();
    if (JSON.stringify(actualTargets) !== JSON.stringify(expectedTargets)) {
      issues.push({ code: "wrong_sequence_targets", message: `Sequence concept targets mismatch: expected ${expectedTargets.join(", ")}.` });
    }
  }
  if (matchingSequenceRows.length && expectedFamilies.length) {
    const seenFamilies = [...new Set(
      matchingSequenceRows.flatMap((row) => str(row?.summary).split(",").map((part) => str(part))).filter(Boolean)
    )].sort();
    if (!expectedFamilies.every((family) => seenFamilies.some((value) => value.toLowerCase().includes(family.toLowerCase())))) {
      issues.push({ code: "wrong_sequence_effect_families", message: `Sequence concept rows do not reflect expected families ${expectedFamilies.join(", ")}.` });
    }
  }

  if (requireAppliedState && xlightsSequenceState && !xlightsSequenceState.sequence?.isOpen) {
    issues.push({ code: "no_open_sequence", message: "xLights reports no open sequence." });
  }
  if (requireAppliedState && xlightsEffectOccupancyState) {
    const matchedCount = Number(xlightsEffectOccupancyState?.matchedCount || 0);
    if (matchedCount <= 0) {
      issues.push({ code: "concept_effects_not_present_in_xlights", message: "xLights effect occupancy did not confirm any expected concept effects." });
    }
  }

  return {
    contract: "design_concept_validation_state_v1",
    version: "1.0",
    ok: issues.length === 0,
    summary: issues.length === 0
      ? "Design concept validation checks passed."
      : `${issues.length} design concept validation issue${issues.length === 1 ? "" : "s"} detected.`,
    issues,
    refs: {
      designDashboard: design?.contract || null,
      reviewDashboard: review?.contract || null,
      sequenceDashboard: sequence?.contract || null,
      xlightsSequenceState: xlightsSequenceState?.contract || null,
      xlightsEffectOccupancyState: xlightsEffectOccupancyState?.contract || null
    }
  };
}
