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
  const normalizeOptionalNumber = (value) => {
    if (value == null || value === "") return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  };
  return {
    modelName: str(query?.modelName),
    layerIndex: normalizeOptionalNumber(query?.layerIndex),
    startMs: normalizeOptionalNumber(query?.startMs),
    endMs: normalizeOptionalNumber(query?.endMs),
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

function modelNamesMatch(queryName = "", effectName = "") {
  const left = str(queryName);
  const right = str(effectName);
  if (!left || !right) return left === right;
  if (left === right) return true;
  const leftLeaf = left.split("/").pop();
  const rightLeaf = right.split("/").pop();
  return leftLeaf === rightLeaf;
}

function matchesEffect(query, effect) {
  if (query.modelName && !modelNamesMatch(query.modelName, effect.modelName)) return false;
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

export function validateWholeSequenceApplyState({
  expected = {},
  pageStates = {},
  xlightsSequenceState = null,
  xlightsEffectOccupancyState = null,
  effectPlacementCount = 0
} = {}) {
  const design = pageStates?.design || {};
  const review = pageStates?.review || {};
  const sequence = pageStates?.sequence || {};
  const project = pageStates?.project || {};
  const issues = [];

  const expectedSequenceName = str(expected.sequenceName);
  if (
    expectedSequenceName &&
    normalizeSequenceName(project?.data?.sequenceContext?.activeSequence) !== normalizeSequenceName(expectedSequenceName)
  ) {
    issues.push({ code: "wrong_active_sequence", message: `Active sequence mismatch: expected ${expectedSequenceName}.` });
  }

  const conceptRows = arr(design?.data?.executionPlan?.conceptRows);
  const reviewRows = arr(review?.data?.rows);
  const sequenceRows = arr(sequence?.data?.rows);
  const minConceptCount = Math.max(1, Number(expected?.minConceptCount || 1));
  const minPlacementCount = Math.max(1, Number(expected?.minPlacementCount || 1));

  if (conceptRows.length < minConceptCount) {
    issues.push({ code: "insufficient_design_concepts", message: `Expected at least ${minConceptCount} design concepts.` });
  }
  if (reviewRows.length < minConceptCount) {
    issues.push({ code: "insufficient_review_groups", message: `Expected at least ${minConceptCount} review groups.` });
  }
  if (!sequenceRows.length) {
    issues.push({ code: "missing_sequence_rows", message: "Sequence dashboard has no translated rows." });
  }
  if (Number(effectPlacementCount || 0) < minPlacementCount) {
    issues.push({ code: "insufficient_effect_placements", message: `Expected at least ${minPlacementCount} effect placements.` });
  }

  if (xlightsSequenceState && !xlightsSequenceState.sequence?.isOpen) {
    issues.push({ code: "no_open_sequence", message: "xLights reports no open sequence." });
  }

  if (xlightsEffectOccupancyState) {
    const queryCount = Number(xlightsEffectOccupancyState?.queryCount || 0);
    const matchedCount = Number(xlightsEffectOccupancyState?.matchedCount || 0);
    if (queryCount <= 0) {
      issues.push({ code: "missing_occupancy_queries", message: "No xLights occupancy queries were generated for the whole-sequence validation." });
    } else if (matchedCount < queryCount) {
      issues.push({ code: "whole_sequence_effects_not_fully_present_in_xlights", message: `xLights matched ${matchedCount}/${queryCount} expected placements.` });
    }
  }

  return {
    contract: "whole_sequence_apply_validation_state_v1",
    version: "1.0",
    ok: issues.length === 0,
    summary: issues.length === 0
      ? "Whole-sequence apply validation checks passed."
      : `${issues.length} whole-sequence apply validation issue${issues.length === 1 ? "" : "s"} detected.`,
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

function liveProposalMetrics({ diagnose = null, pageStates = {} } = {}) {
  const design = pageStates?.design || {};
  const sequence = pageStates?.sequence || {};
  const conceptRows = arr(design?.data?.executionPlan?.conceptRows);
  const executionPlanSections = arr(diagnose?.executionPlanSections);
  const intentSectionPlans = arr(diagnose?.intentSectionPlans);
  const sequenceRows = arr(sequence?.data?.rows);
  const proposalScope = diagnose?.proposalScope || {};
  const executionPlanSummary = diagnose?.executionPlanSummary || {};
  const preferredSectionPlans = executionPlanSections.length ? executionPlanSections : intentSectionPlans;
  const scopedSections = arr(proposalScope?.sections).length
    ? arr(proposalScope.sections)
    : (preferredSectionPlans.length
        ? preferredSectionPlans.map((row) => row?.section)
        : conceptRows.map((row) => row?.anchor));
  const primarySections = arr(executionPlanSummary?.primarySections).length
    ? arr(executionPlanSummary.primarySections)
    : (preferredSectionPlans.length
        ? preferredSectionPlans.map((row) => row?.section)
        : conceptRows.map((row) => row?.anchor));
  const distinctFamilies = new Set();
  const familyUsageCounts = new Map();
  const timingTrackNames = new Set();
  const anchorBases = new Set();
  const sectionFamilyMap = new Map();
  function normalizeSectionRole(sectionName = "") {
    const lower = str(sectionName).toLowerCase();
    if (!lower) return "";
    if (/(^|[^a-z])final chorus([^a-z]|$)/.test(lower)) return "chorus";
    if (/(^|[^a-z])chorus([^a-z]|$)/.test(lower)) return "chorus";
    if (/(^|[^a-z])pre-?chorus([^a-z]|$)/.test(lower)) return "prechorus";
    if (/(^|[^a-z])post-?chorus([^a-z]|$)/.test(lower)) return "postchorus";
    if (/(^|[^a-z])verse([^a-z]|$)/.test(lower)) return "verse";
    if (/(^|[^a-z])bridge([^a-z]|$)/.test(lower)) return "bridge";
    if (/(^|[^a-z])intro([^a-z]|$)/.test(lower)) return "intro";
    if (/(^|[^a-z])outro([^a-z]|$)/.test(lower)) return "outro";
    if (/(^|[^a-z])tag([^a-z]|$)/.test(lower)) return "tag";
    if (/(^|[^a-z])solo([^a-z]|$)/.test(lower)) return "solo";
    return "";
  }
  function sectionOrdinal(sectionName = "") {
    const lower = str(sectionName).toLowerCase();
    if (!lower) return 0;
    if (/final chorus/.test(lower)) return 999;
    const match = lower.match(/\b(\d+)\b/);
    return match ? Number(match[1] || 0) : 0;
  }
  function familySimilarity(left = new Set(), right = new Set()) {
    const union = new Set([...left, ...right]);
    if (!union.size) return 0;
    const intersection = [...left].filter((family) => right.has(family)).length;
    return Number((intersection / union.size).toFixed(3));
  }
  function addFamilyUsage(sectionName = "", familyName = "") {
    const family = str(familyName);
    if (!family) return;
    familyUsageCounts.set(family, Number(familyUsageCounts.get(family) || 0) + 1);
    const sectionKey = str(sectionName);
    if (!sectionKey) return;
    if (!sectionFamilyMap.has(sectionKey)) {
      sectionFamilyMap.set(sectionKey, new Set());
    }
    sectionFamilyMap.get(sectionKey).add(family);
  }
  if (preferredSectionPlans.length) {
    for (const row of preferredSectionPlans) {
      const sectionName = str(row?.section);
      for (const family of arr(row?.effectHints)) {
        const effectFamily = str(family);
        if (!effectFamily) continue;
        distinctFamilies.add(effectFamily);
        addFamilyUsage(sectionName, effectFamily);
      }
    }
  }
  for (const row of arr(diagnose?.rawPlan)) {
    if (str(row?.cmd) !== "effects.create") continue;
    const effectName = str(row?.params?.effectName);
    if (effectName) {
      distinctFamilies.add(effectName);
      if (!preferredSectionPlans.length) {
        addFamilyUsage(str(row?.anchor?.section || row?.anchor?.sectionName || ""), effectName);
      }
    }
    const trackName = str(row?.anchor?.trackName);
    const basis = str(row?.anchor?.basis);
    if (trackName) timingTrackNames.add(trackName);
    if (basis) anchorBases.add(basis);
  }
  if (!distinctFamilies.size) {
    for (const row of sequenceRows) {
      for (const part of str(row?.summary).split(",")) {
        const family = str(part.replace(/\+\d+\s+more$/i, ""));
        if (family) {
          distinctFamilies.add(family);
          addFamilyUsage(str(row?.section), family);
        }
      }
    }
  }
  if (!sectionFamilyMap.size) {
    for (const row of conceptRows) {
      for (const family of arr(row?.effectFamilies)) {
        addFamilyUsage(str(row?.anchor), family);
      }
    }
  }
  const usageRows = [...familyUsageCounts.entries()]
    .map(([family, count]) => ({ family, count: Number(count || 0) }))
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return left.family.localeCompare(right.family);
    });
  const totalFamilyAssignments = usageRows.reduce((sum, row) => sum + Number(row.count || 0), 0);
  const dominantFamily = usageRows[0]?.family || "";
  const dominantFamilyCount = Number(usageRows[0]?.count || 0);
  const dominantFamilyShare = totalFamilyAssignments > 0
    ? Number((dominantFamilyCount / totalFamilyAssignments).toFixed(3))
    : 0;
  const sectionKeys = [...sectionFamilyMap.keys()].filter(Boolean);
  let sectionContrastTotal = 0;
  let sectionContrastPairs = 0;
  for (let idx = 1; idx < sectionKeys.length; idx += 1) {
    const prevSet = sectionFamilyMap.get(sectionKeys[idx - 1]) || new Set();
    const nextSet = sectionFamilyMap.get(sectionKeys[idx]) || new Set();
    const union = new Set([...prevSet, ...nextSet]);
    const intersectionSize = [...prevSet].filter((family) => nextSet.has(family)).length;
    const contrast = union.size > 0 ? 1 - (intersectionSize / union.size) : 0;
    sectionContrastTotal += contrast;
    sectionContrastPairs += 1;
  }
  const sectionContrastScore = sectionContrastPairs > 0
    ? Number((sectionContrastTotal / sectionContrastPairs).toFixed(3))
    : 0;
  const uniqueSectionSignatures = new Set(
    sectionKeys.map((key) => [...(sectionFamilyMap.get(key) || new Set())].sort().join("|")).filter(Boolean)
  ).size;
  const sectionSignatureUniqueness = sectionKeys.length > 0
    ? Number((uniqueSectionSignatures / sectionKeys.length).toFixed(3))
    : 0;
  const sectionRoleGroups = new Map();
  for (const key of sectionKeys) {
    const role = normalizeSectionRole(key);
    if (!role) continue;
    if (!sectionRoleGroups.has(role)) sectionRoleGroups.set(role, []);
    sectionRoleGroups.get(role).push({
      section: key,
      ordinal: sectionOrdinal(key),
      families: new Set([...(sectionFamilyMap.get(key) || new Set())])
    });
  }
  const sectionRoleRows = [];
  let repeatedRoleSimilarityTotal = 0;
  let repeatedRoleSimilarityPairs = 0;
  let chorusProgressionScore = 0;
  for (const [role, rows] of sectionRoleGroups.entries()) {
    const ordered = rows.slice().sort((left, right) => left.ordinal - right.ordinal || left.section.localeCompare(right.section));
    let similarityTotal = 0;
    let similarityPairs = 0;
    let progressionTotal = 0;
    let progressionPairs = 0;
    for (let idx = 1; idx < ordered.length; idx += 1) {
      const prev = ordered[idx - 1];
      const next = ordered[idx];
      const similarity = familySimilarity(prev.families, next.families);
      similarityTotal += similarity;
      similarityPairs += 1;
      if (role === "chorus") {
        const prevSize = prev.families.size;
        const nextSize = next.families.size;
        if (nextSize > prevSize) progressionTotal += 1;
        else if (nextSize === prevSize) progressionTotal += 0.5;
        progressionPairs += 1;
      }
    }
    const averageSimilarity = similarityPairs > 0 ? Number((similarityTotal / similarityPairs).toFixed(3)) : null;
    const progression = progressionPairs > 0 ? Number((progressionTotal / progressionPairs).toFixed(3)) : null;
    sectionRoleRows.push({
      role,
      sectionCount: ordered.length,
      averageSimilarity,
      progression,
      sections: ordered.map((row) => row.section)
    });
    if (similarityPairs > 0) {
      repeatedRoleSimilarityTotal += similarityTotal / similarityPairs;
      repeatedRoleSimilarityPairs += 1;
    }
    if (role === "chorus" && progression != null) {
      chorusProgressionScore = progression;
    }
  }
  const repeatedRoleSimilarityScore = repeatedRoleSimilarityPairs > 0
    ? Number((repeatedRoleSimilarityTotal / repeatedRoleSimilarityPairs).toFixed(3))
    : 0;
  const flattenedFocusTargets = [...new Set(
    conceptRows.flatMap((row) => arr(row?.focus)).map((row) => str(row)).filter(Boolean)
  )].sort();
  return {
    activeSequence: str(diagnose?.activeSequence || pageStates?.project?.data?.sequenceContext?.activeSequence),
    sectionScope: arr(scopedSections).map((row) => str(row)).filter(Boolean),
    targetScope: arr(proposalScope?.targetIds || flattenedFocusTargets).map((row) => str(row)).filter(Boolean).sort(),
    effectPlacementCount: Number(executionPlanSummary?.effectPlacementCount || sequenceRows.reduce((sum, row) => sum + Number(row?.effects || 0), 0) || 0),
    sectionCount: arr(primarySections).filter(Boolean).length,
    designConceptCount: preferredSectionPlans.length || conceptRows.length,
    sequenceRowCount: sequenceRows.length,
    distinctFamilyCount: distinctFamilies.size,
    distinctFamilies: [...distinctFamilies].sort(),
    familyUsage: usageRows,
    dominantFamily,
    dominantFamilyCount,
    dominantFamilyShare,
    sectionContrastScore,
    sectionSignatureUniqueness,
    sectionRoleCoherence: sectionRoleRows.sort((left, right) => left.role.localeCompare(right.role)),
    repeatedRoleSimilarityScore,
    chorusProgressionScore,
    focusTargets: flattenedFocusTargets,
    timingTrackNames: [...timingTrackNames].sort(),
    anchorBases: [...anchorBases].sort()
  };
}

function comparativeLiveScore(metrics = {}) {
  let score = 0;
  score += Number(metrics.effectPlacementCount || 0) * 0.2;
  score += Number(metrics.distinctFamilyCount || 0) * 0.8;
  score += Number(metrics.designConceptCount || 0) * 0.5;
  score += Number(metrics.sectionCount || 0) * 0.35;
  score += Number(metrics.sequenceRowCount || 0) * 0.1;
  score += Number(metrics.sectionContrastScore || 0) * 1.5;
  score += Number(metrics.sectionSignatureUniqueness || 0) * 1.0;
  score += Number(metrics.repeatedRoleSimilarityScore || 0) * 1.2;
  score += Number(metrics.chorusProgressionScore || 0) * 0.9;
  score -= Number(metrics.dominantFamilyShare || 0) * 1.2;
  return Number(score.toFixed(2));
}

function sortedNormalizedList(values = []) {
  return arr(values).map((row) => str(row)).filter(Boolean).sort();
}

function countIntersection(left = [], right = []) {
  const rightSet = new Set(sortedNormalizedList(right));
  return sortedNormalizedList(left).filter((row) => rightSet.has(row)).length;
}

function comparativeLiveScopeAdjustment(metrics = {}, expected = {}) {
  const expectedSections = sortedNormalizedList(expected?.sections);
  const expectedTargets = sortedNormalizedList(expected?.targets);
  const scopeSections = sortedNormalizedList(metrics.sectionScope);
  const scopeTargets = sortedNormalizedList(metrics.targetScope);
  const focusTargets = sortedNormalizedList(metrics.focusTargets);
  let adjustment = 0;

  if (expectedSections.length) {
    adjustment += JSON.stringify(scopeSections) === JSON.stringify(expectedSections) ? 0.6 : -0.8;
  }

  if (expectedTargets.length) {
    const scopeMatchCount = countIntersection(scopeTargets, expectedTargets);
    const focusMatchCount = countIntersection(focusTargets, expectedTargets);
    const scopeCoverage = scopeMatchCount / expectedTargets.length;
    const focusCoverage = focusMatchCount / expectedTargets.length;

    adjustment += scopeCoverage * 2.0;
    adjustment += focusCoverage * 1.2;

    if (JSON.stringify(scopeTargets) === JSON.stringify(expectedTargets)) {
      adjustment += 1.6;
    }
    if (JSON.stringify(focusTargets) === JSON.stringify(expectedTargets)) {
      adjustment += 1.0;
    }

    if (scopeTargets.length && scopeMatchCount === 0) {
      adjustment -= 2.4;
    }
    if (focusTargets.length && focusMatchCount === 0) {
      adjustment -= 1.8;
    }
    if (scopeTargets.length > expectedTargets.length) {
      adjustment -= Math.min(2.4, (scopeTargets.length - expectedTargets.length) * 0.5);
    }
    if (focusTargets.length > expectedTargets.length) {
      adjustment -= Math.min(2.0, (focusTargets.length - expectedTargets.length) * 0.2);
    }
    if (!scopeTargets.length) {
      adjustment -= 2.0;
    }
  }

  return Number(adjustment.toFixed(2));
}

function comparativeLivePromptAdjustment(metrics = {}, goalText = "") {
  const lowerGoal = str(goalText).toLowerCase();
  let adjustment = 0;
  const familyCount = Number(metrics.distinctFamilyCount || 0);
  const placementCount = Number(metrics.effectPlacementCount || 0);
  const sequenceRowCount = Number(metrics.sequenceRowCount || 0);
  const sectionCount = Number(metrics.sectionCount || 0);
  const designConceptCount = Number(metrics.designConceptCount || 0);
  const targetScopeCount = sortedNormalizedList(metrics.targetScope).length;
  const focusTargetCount = sortedNormalizedList(metrics.focusTargets).length;
  const timingTrackNames = sortedNormalizedList(metrics.timingTrackNames);
  const anchorBases = sortedNormalizedList(metrics.anchorBases);
  const sectionContrastScore = Number(metrics.sectionContrastScore || 0);
  const sectionSignatureUniqueness = Number(metrics.sectionSignatureUniqueness || 0);
  const dominantFamilyShare = Number(metrics.dominantFamilyShare || 0);
  const repeatedRoleSimilarityScore = Number(metrics.repeatedRoleSimilarityScore || 0);
  const chorusProgressionScore = Number(metrics.chorusProgressionScore || 0);

  if (/stage-lighting|stage lighting|cue stack|key-vs-fill|key light|fill|restrained washes|restrained wash/.test(lowerGoal)) {
    if (familyCount >= 4 && familyCount <= 6) adjustment += 1.8;
    if (familyCount >= 7) adjustment -= 1.4;
    if (placementCount > 44) adjustment -= 1.0;
    if (focusTargetCount >= 10) adjustment -= 1.2;
    if (sequenceRowCount > 30) adjustment -= 0.8;
    if (designConceptCount === sectionCount && designConceptCount >= 8) adjustment += 0.5;
  }

  if (/uniform effect language|uniform|even look|visually even|same emphasis|share the same emphasis|minimal hierarchy|simple and uniform/.test(lowerGoal)) {
    if (familyCount <= 3) adjustment += 1.0;
    if (familyCount >= 5) adjustment -= 3.0;
    if (placementCount > 36) adjustment -= 1.0;
    if (focusTargetCount >= 12) adjustment -= 1.4;
    if (sequenceRowCount > 28) adjustment -= 0.8;
  }

  if (/perimeter|frame|framing|negative space|centerpiece/.test(lowerGoal)
    && !/visually even|same emphasis|share the same emphasis|even look|minimal hierarchy/.test(lowerGoal)) {
    const focusTargetCount = sortedNormalizedList(metrics.focusTargets).length;
    if (focusTargetCount > 0 && focusTargetCount <= 6) adjustment += 1.6;
    if (focusTargetCount >= 12) adjustment -= 1.2;
    if (placementCount >= 16 && placementCount <= 32) adjustment += 0.8;
  }

  if (/beat grid|beat-driven|pulse lands on the beat|anchored to the beat/.test(lowerGoal)) {
    if (timingTrackNames.includes("XD: Beat Grid") || anchorBases.includes("beat_window")) {
      adjustment += 1.1;
    } else {
      adjustment -= 1.1;
    }
  }

  if (/phrase cue|phrase release|hold the breath|before the phrase release/.test(lowerGoal)) {
    if (anchorBases.includes("phrase_window")) {
      adjustment += 0.9;
    }
  }

  if (/full song|whole song|full show/.test(lowerGoal) && !/chorus 1|bridge|verse 1|verse 2|pre-chorus|post-chorus|middle 8|tag|drop/.test(lowerGoal)) {
    if (targetScopeCount === 0) adjustment += 0.9;
    if (targetScopeCount > 0 && targetScopeCount <= 2) adjustment -= 1.8;
  }

  if (/restrained glowing base|smoother texture transitions|selective sparkle|render feels polished/.test(lowerGoal)) {
    if (familyCount <= 6) adjustment += 1.2;
    if (familyCount >= 7) adjustment -= 1.2;
    if (placementCount <= 42) adjustment += 1.0;
    if (placementCount >= 50) adjustment -= 1.6;
    if (focusTargetCount <= 16) adjustment += 1.2;
    if (focusTargetCount >= 18) adjustment -= 1.4;
    if (sequenceRowCount <= 34) adjustment += 0.8;
    if (sequenceRowCount >= 36) adjustment -= 1.0;
    if (sectionCount <= 8) adjustment += 1.0;
    if (sectionCount >= 12) adjustment -= 1.2;
    if (designConceptCount <= 8) adjustment += 1.0;
    if (designConceptCount >= 12) adjustment -= 1.4;
    if (targetScopeCount > 0 && targetScopeCount <= 2) adjustment -= 1.4;
    if (dominantFamilyShare <= 0.45) adjustment += 0.8;
    if (dominantFamilyShare >= 0.7) adjustment -= 0.9;
  }

  if (/changing textures aggressively|busier sparkle|harder texture swaps|less restraint in the base look|busy texture/.test(lowerGoal)) {
    if (familyCount >= 7) adjustment -= 2.2;
    if (placementCount >= 44) adjustment -= 1.8;
    if (focusTargetCount >= 18) adjustment -= 2.0;
    if (sequenceRowCount >= 30) adjustment -= 1.4;
    if (sectionCount >= 12) adjustment -= 1.4;
    if (designConceptCount >= 12) adjustment -= 1.6;
  }

  if (/smooth connected transitions|broader cinematic motion|flowing rise|connected motion/.test(lowerGoal)) {
    if (sectionContrastScore >= 0.3 && sectionContrastScore <= 0.85) adjustment += 1.1;
    if (sectionContrastScore < 0.15) adjustment -= 1.0;
    if (sectionContrastScore > 0.9) adjustment -= 0.9;
    if (sectionSignatureUniqueness >= 0.5) adjustment += 0.7;
    if (sectionSignatureUniqueness > 0.9) adjustment -= 0.7;
    if (dominantFamilyShare >= 0.7) adjustment -= 0.8;
    if (familyCount > 7) adjustment -= 1.1;
    if (repeatedRoleSimilarityScore >= 0.2) adjustment += 0.6;
    if (repeatedRoleSimilarityScore < 0.15) adjustment -= 1.2;
    if (chorusProgressionScore >= 0.5) adjustment += 0.7;
  }

  if (/choppier|staccato|punchy pulse changes|sharper accents|less connected motion/.test(lowerGoal)) {
    if (sectionContrastScore >= 0.45) adjustment += 0.6;
    if (sectionSignatureUniqueness >= 0.55) adjustment += 0.4;
  }

  if (/common visual language|family resemblance|feel related|recognizable common/.test(lowerGoal) && /chorus/.test(lowerGoal)) {
    if (repeatedRoleSimilarityScore >= 0.85) adjustment += 1.8;
    else if (repeatedRoleSimilarityScore >= 0.6) adjustment += 1.0;
    if (repeatedRoleSimilarityScore < 0.3) adjustment -= 2.0;
    if (chorusProgressionScore >= 0.5) adjustment += 0.9;
    if (sectionSignatureUniqueness <= 0.5) adjustment += 0.6;
    if (sectionSignatureUniqueness > 0.75) adjustment -= 1.1;
    if (familyCount <= 3) adjustment += 0.9;
    if (familyCount > 4) adjustment -= 1.2;
    if (dominantFamilyShare >= 0.4 && dominantFamilyShare <= 0.75) adjustment += 0.5;
  }

  if (/(separate unrelated|no family resemblance|no build pattern|do not need to share)/.test(lowerGoal) && /chorus/.test(lowerGoal)) {
    if (repeatedRoleSimilarityScore >= 0.6) adjustment -= 1.6;
    if (sectionSignatureUniqueness <= 0.5) adjustment -= 0.8;
    if (sectionSignatureUniqueness >= 0.9) adjustment -= 0.9;
    if (familyCount >= 5) adjustment -= 1.1;
    if (chorusProgressionScore >= 0.5) adjustment -= 0.8;
  }

  if (/shared supporting visual language|same narrative world|share a supporting identity/.test(lowerGoal)) {
    if (repeatedRoleSimilarityScore >= 0.6) adjustment += 1.1;
    if (familyCount <= 3) adjustment += 0.9;
    if (familyCount > 3) adjustment -= 1.1;
  }

  if (/each verse feel unrelated|no need for verse 1 and verse 2 to share|no need to share a supporting identity|unrelated to the other sections/.test(lowerGoal)) {
    if (repeatedRoleSimilarityScore >= 0.6) adjustment -= 1.5;
    if (familyCount <= 3) adjustment -= 0.8;
    if (sectionSignatureUniqueness <= 0.5) adjustment -= 0.8;
  }

  if (/finale punch|flowing rise into the final chorus|final chorus/.test(lowerGoal)) {
    if (chorusProgressionScore >= 0.5) adjustment += 0.8;
    if (chorusProgressionScore === 0) adjustment -= 0.8;
  }

  if (/whole song|full song|full show/.test(lowerGoal) && /chorus|verse|bridge|outro|intro/.test(lowerGoal)) {
    if (repeatedRoleSimilarityScore >= 0.18) adjustment += 0.5;
  }

  return Number(adjustment.toFixed(2));
}

export function validateComparativeLiveDesignState({
  expected = {},
  strong = {},
  weak = {}
} = {}) {
  const strongMetrics = liveProposalMetrics(strong);
  const weakMetrics = liveProposalMetrics(weak);
  const issues = [];
  const normalizedExpected = {
    ...expected,
    sections: arr(expected?.sections).length ? expected.sections : [str(expected?.section || expected?.expectedStrong?.section)].filter(Boolean),
    targets: arr(expected?.targets).length ? expected.targets : arr(expected?.expectedStrong?.targets)
  };
  const expectedSections = arr(normalizedExpected?.sections).map((row) => str(row)).filter(Boolean).sort();
  const expectedTargets = arr(normalizedExpected?.targets).map((row) => str(row)).filter(Boolean).sort();
  const strongScore = Number((
    comparativeLiveScore(strongMetrics)
    + comparativeLiveScopeAdjustment(strongMetrics, normalizedExpected)
    + comparativeLivePromptAdjustment(strongMetrics, strong?.diagnose?.intentHandoffSummary?.goal)
  ).toFixed(2));
  const weakScore = Number((
    comparativeLiveScore(weakMetrics)
    + comparativeLiveScopeAdjustment(weakMetrics, normalizedExpected)
    + comparativeLivePromptAdjustment(weakMetrics, weak?.diagnose?.intentHandoffSummary?.goal)
  ).toFixed(2));

  if (!strongMetrics.effectPlacementCount) {
    issues.push({ code: "strong_prompt_no_proposal", message: "Strong prompt did not produce effect placements." });
  }
  if (!weakMetrics.effectPlacementCount) {
    issues.push({ code: "weak_prompt_no_proposal", message: "Weak prompt did not produce effect placements." });
  }
  if (str(strong?.diagnose?.error)) {
    issues.push({ code: "strong_prompt_diagnose_failed", message: `Strong prompt diagnostics failed: ${str(strong.diagnose.error)}` });
  }
  if (str(weak?.diagnose?.error)) {
    issues.push({ code: "weak_prompt_diagnose_failed", message: `Weak prompt diagnostics failed: ${str(weak.diagnose.error)}` });
  }
  if (expectedSections.length && JSON.stringify(strongMetrics.sectionScope.sort()) !== JSON.stringify(expectedSections)) {
    issues.push({ code: "strong_scope_sections_mismatch", message: `Strong prompt sections mismatch: expected ${expectedSections.join(", ")}.` });
  }
  if (expectedTargets.length && JSON.stringify(strongMetrics.targetScope) !== JSON.stringify(expectedTargets)) {
    issues.push({ code: "strong_scope_targets_mismatch", message: `Strong prompt targets mismatch: expected ${expectedTargets.join(", ")}.` });
  }
  if (normalizedExpected?.minStrongDistinctFamilyLead != null) {
    const margin = strongMetrics.distinctFamilyCount - weakMetrics.distinctFamilyCount;
    if (margin < Number(normalizedExpected.minStrongDistinctFamilyLead)) {
      issues.push({ code: "strong_family_lead_too_small", message: `Strong prompt family lead ${margin} is below expected minimum ${normalizedExpected.minStrongDistinctFamilyLead}.` });
    }
  }
  if (normalizedExpected?.minStrongPlacementLead != null) {
    const margin = strongMetrics.effectPlacementCount - weakMetrics.effectPlacementCount;
    if (margin < Number(normalizedExpected.minStrongPlacementLead)) {
      issues.push({ code: "strong_placement_lead_too_small", message: `Strong prompt placement lead ${margin} is below expected minimum ${normalizedExpected.minStrongPlacementLead}.` });
    }
  }
  if (normalizedExpected?.requireStrongPreferred !== false && strongScore <= weakScore) {
    issues.push({ code: "strong_prompt_not_preferred", message: `Strong live score ${strongScore} did not exceed weak score ${weakScore}.` });
  }

  return {
    contract: "comparative_live_design_validation_state_v1",
    version: "1.0",
    ok: issues.length === 0,
    summary: issues.length === 0
      ? "Comparative live design validation checks passed."
      : `${issues.length} comparative live validation issue${issues.length === 1 ? "" : "s"} detected.`,
    issues,
    metrics: {
      strong: strongMetrics,
      weak: weakMetrics,
      strongScore,
      weakScore
    }
  };
}
