import { buildTimingTrackStatusRows, summarizeTimingTrackStatuses } from "../../runtime/timing-track-status.js";
import { buildSequenceSession, explainSequenceSessionBlockers } from "../../runtime/sequence-session.js";

function str(value = "") {
  return String(value || "").trim();
}

function norm(value = "") {
  return str(value).toLowerCase();
}

function buildDesignDisplay(designId = "", designRevision = 0) {
  const raw = str(designId);
  const revision = Number.isInteger(Number(designRevision)) ? Number(designRevision) : 0;
  const desMatch = raw.match(/^DES-(\d+)$/i);
  if (desMatch) {
    return {
      designNumber: Number(desMatch[1]),
      designRevision: revision,
      designLabel: `D${Number(desMatch[1])}.${revision}`
    };
  }
  const dMatch = raw.match(/^D(\d+)$/i);
  if (dMatch) {
    return {
      designNumber: Number(dMatch[1]),
      designRevision: revision,
      designLabel: `D${Number(dMatch[1])}.${revision}`
    };
  }
  return {
    designNumber: 0,
    designRevision: revision,
    designLabel: raw || ""
  };
}

function compareDesignEntries(a = {}, b = {}) {
  const aNumber = Number.isFinite(Number(a.designNumber)) ? Number(a.designNumber) : Number.MAX_SAFE_INTEGER;
  const bNumber = Number.isFinite(Number(b.designNumber)) ? Number(b.designNumber) : Number.MAX_SAFE_INTEGER;
  if (aNumber !== bNumber) return aNumber - bNumber;
  const aRevision = Number.isFinite(Number(a.designRevision)) ? Number(a.designRevision) : 0;
  const bRevision = Number.isFinite(Number(b.designRevision)) ? Number(b.designRevision) : 0;
  if (aRevision !== bRevision) return bRevision - aRevision;
  return str(a.designId).localeCompare(str(b.designId));
}

function parseTranslatedTarget(line = "") {
  const parts = String(line || "").split("/").map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return "";
  if (parts.length >= 3) return parts[1];
  if (parts.length === 2) return parts[0];
  return "";
}

function getSectionNameFromLine(line = "") {
  const parts = String(line || "").split("/").map((part) => part.trim()).filter(Boolean);
  return parts.length ? parts[0] : "";
}

function inferTargetLevel(target = "", sceneGraph = null) {
  const id = str(target);
  if (!id) return "Model";
  if (id === "AllModels" || id === "Global" || /^all/i.test(id)) return "Group";
  if (sceneGraph?.submodelsById && sceneGraph.submodelsById[id]) return "Submodel";
  if (sceneGraph?.groupsById && sceneGraph.groupsById[id]) return "Group";
  if (sceneGraph?.modelsById && sceneGraph.modelsById[id]) return "Model";
  if (/[\\/]/.test(id)) return "Submodel";
  return "Model";
}

function summarizeSequenceGridRow(line = "") {
  const raw = String(line || "").trim();
  const parts = raw.split("/").map((part) => part.trim()).filter(Boolean);
  const section = parts[0] || "General";
  const target = parts[1] || "Unresolved";
  const summary = parts.slice(2).join(" / ").trim() || raw || "Pending translation detail";
  const lowerSummary = summary.toLowerCase();
  const lowerTarget = target.toLowerCase();
  const timing =
    /chorus|verse|intro|bridge|pre-chorus|post-chorus|outro|hook/.test(section.toLowerCase())
      ? "XD: Song Structure"
      : "XD: Sequencer Plan";
  const level =
    lowerTarget === "allmodels" || lowerTarget === "global"
      ? "Group"
      : /\/|submodel|segment|face|hat|eyes|left|right|top|bottom/.test(target)
        ? "Submodel"
        : "Model";
  const effects =
    (lowerSummary.match(/\b(add|apply|layer|wash|twinkle|sparkle|pulse|glow|wipe|fade|shimmer|color wash)\b/g) || []).length || 1;
  return {
    timing,
    section,
    target,
    level,
    summary,
    effects
  };
}

function getPlanCommands(planHandoff = null, state = {}) {
  if (Array.isArray(planHandoff?.commands)) return planHandoff.commands;
  if (Array.isArray(state?.agentPlan?.handoff?.commands)) return state.agentPlan.handoff.commands;
  return [];
}

function buildTimingMarkLookup(commands = []) {
  const lookup = new Map();
  for (const command of Array.isArray(commands) ? commands : []) {
    const cmd = str(command?.cmd);
    if (cmd !== "timing.insertMarks" && cmd !== "timing.replaceMarks") continue;
    const params = command?.params && typeof command.params === "object" ? command.params : {};
    const trackName = str(params.trackName);
    if (!trackName) continue;
    const marks = Array.isArray(params.marks) ? params.marks : [];
    for (const mark of marks) {
      const label = str(mark?.label);
      const startMs = Number(mark?.startMs);
      const endMs = Number(mark?.endMs);
      if (!label || !Number.isFinite(startMs) || !Number.isFinite(endMs)) continue;
      lookup.set(`${trackName}|${startMs}|${endMs}`, label);
    }
  }
  return lookup;
}

function summarizeEffectRow(command = null, timingMarks = new Map(), sceneGraph = null) {
  const params = command?.params && typeof command.params === "object" ? command.params : {};
  const anchor = command?.anchor && typeof command.anchor === "object" ? command.anchor : {};
  const intent = command?.intent && typeof command.intent === "object" ? command.intent : {};
  const effectName = str(params.effectName || "Unknown Effect");
  const target = str(params.modelName || "Unresolved");
  const designId = str(command?.designId || intent?.designId);
  const designAuthor = str(command?.designAuthor || intent?.designAuthor);
  const timing = str(anchor.trackName || "XD: Sequencer Plan");
  const startMs = Number(params.startMs);
  const endMs = Number(params.endMs);
  const anchorSection = str(anchor.markLabel);
  const section =
    anchorSection ||
    timingMarks.get(`${timing}|${startMs}|${endMs}`) ||
    "General";
  const palette = str(typeof params.palette === "string" ? params.palette : "");
  const settings = str(typeof params.settings === "string" ? params.settings : "");
  const detail = [palette, settings].filter(Boolean).join(" / ");
  return {
    designId,
    ...buildDesignDisplay(designId, command?.designRevision || intent?.designRevision),
    designAuthor,
    timing,
    section,
    target,
    level: inferTargetLevel(target, sceneGraph),
    summary: detail ? `${effectName} / ${detail}` : effectName,
    effects: 1,
    sourceLine: ""
  };
}

function summarizeAggregatedEffectSummaries(summaries = []) {
  const unique = [...new Set((Array.isArray(summaries) ? summaries : []).map((value) => str(value)).filter(Boolean))];
  if (!unique.length) return "Pending effect detail";
  if (unique.length === 1) return unique[0];
  if (unique.length === 2) return `${unique[0]}, ${unique[1]}`;
  return `${unique[0]}, ${unique[1]} +${unique.length - 2} more`;
}

function buildAggregatedEffectRows(commands = [], timingMarks = new Map(), sceneGraph = null) {
  const buckets = new Map();
  for (const command of Array.isArray(commands) ? commands : []) {
    const row = summarizeEffectRow(command, timingMarks, sceneGraph);
    const key = [row.designId, row.timing, row.section, row.target, row.level].join("|");
    if (!buckets.has(key)) {
      buckets.set(key, {
        designId: row.designId,
        designNumber: row.designNumber,
        designRevision: row.designRevision,
        designLabel: row.designLabel,
        designAuthor: row.designAuthor,
        timing: row.timing,
        section: row.section,
        target: row.target,
        level: row.level,
        summaryParts: [],
        effects: 0,
        sourceLine: ""
      });
    }
    const bucket = buckets.get(key);
    bucket.summaryParts.push(row.summary);
    bucket.effects += 1;
  }
  return [...buckets.values()].map((bucket) => ({
    designId: bucket.designId,
    designNumber: bucket.designNumber,
    designRevision: bucket.designRevision,
    designLabel: bucket.designLabel,
    designAuthor: bucket.designAuthor,
    timing: bucket.timing,
    section: bucket.section,
    target: bucket.target,
    level: bucket.level,
    summary: summarizeAggregatedEffectSummaries(bucket.summaryParts),
    effects: bucket.effects,
    sourceLine: bucket.sourceLine
  }));
}

function buildTimingOnlyRows(commands = []) {
  const rows = [];
  for (const command of Array.isArray(commands) ? commands : []) {
    const cmd = str(command?.cmd);
    if (cmd !== "timing.insertMarks" && cmd !== "timing.replaceMarks") continue;
    const params = command?.params && typeof command.params === "object" ? command.params : {};
    const timing = str(params.trackName || "XD: Sequencer Plan");
    const marks = Array.isArray(params.marks) ? params.marks : [];
    for (const mark of marks) {
      rows.push({
        designId: "",
        designNumber: 0,
        designRevision: 0,
        designLabel: "",
        designAuthor: "",
        timing,
        section: str(mark?.label || "Unnamed Mark"),
        target: "Timing Track",
        level: "Track",
        summary: cmd === "timing.replaceMarks" ? "Replace timing mark" : "Add timing mark",
        effects: 0,
        sourceLine: ""
      });
    }
  }
  return rows;
}

function buildDashboardRows({
  state = {},
  proposalLines = [],
  planCommands = []
} = {}) {
  const supersededConcepts = Array.isArray(state.creative?.supersededConcepts) ? state.creative.supersededConcepts : [];
  const supersededByDesignId = new Map();
  for (const row of supersededConcepts) {
    const designId = str(row?.designId);
    if (!designId) continue;
    if (!supersededByDesignId.has(designId)) supersededByDesignId.set(designId, []);
    supersededByDesignId.get(designId).push(row);
  }
  const effectCommands = (Array.isArray(planCommands) ? planCommands : []).filter((command) => str(command?.cmd) === "effects.create");
  if (effectCommands.length) {
    const timingMarks = buildTimingMarkLookup(planCommands);
    return buildAggregatedEffectRows(effectCommands, timingMarks, state?.sceneGraph || null)
      .sort(compareDesignEntries)
      .map((row, idx) => {
      return {
        index: idx + 1,
        revisionState: "current",
        supersededRevisionCount: (supersededByDesignId.get(str(row.designId || "")) || []).length,
        ...row
      };
    });
  }

  const timingRows = buildTimingOnlyRows(planCommands);
  if (timingRows.length) {
    return timingRows.sort(compareDesignEntries).map((row, idx) => ({
      index: idx + 1,
      revisionState: "current",
      supersededRevisionCount: (supersededByDesignId.get(str(row.designId || "")) || []).length,
      ...row
    }));
  }

  return (Array.isArray(proposalLines) ? proposalLines : []).map((line, idx) => {
    const row = summarizeSequenceGridRow(line);
    return {
      index: idx + 1,
      designId: str(row.designId || ""),
      ...buildDesignDisplay(row.designId || "", row.designRevision || 0),
      designAuthor: str(row.designAuthor || ""),
      revisionState: "current",
      supersededRevisionCount: (supersededByDesignId.get(str(row.designId || "")) || []).length,
      timing: str(row.timing || "XD: Sequencer Plan"),
      section: str(row.section || getSectionNameFromLine(line) || "General"),
      target: str(row.target || parseTranslatedTarget(line) || "Unresolved"),
      level: str(row.level || "Model"),
      summary: str(row.summary || "Pending translation detail"),
      effects: Number.isFinite(Number(row.effects)) ? Number(row.effects) : 0,
      sourceLine: str(line)
    };
  }).sort(compareDesignEntries);
}

function getTimingTrackNames(tracks = []) {
  return (Array.isArray(tracks) ? tracks : [])
    .map((t) => (typeof t === "string" ? t : t?.name || ""))
    .map((name) => str(name))
    .filter(Boolean);
}

function isXdTimingTrack(name) {
  return /^xd:/i.test(str(name));
}

function hasPlannedStructureTrack(commands = []) {
  return (Array.isArray(commands) ? commands : []).some((command) => {
    const cmd = str(command?.cmd);
    const trackName = str(command?.params?.trackName);
    if (cmd !== "timing.createTrack" && cmd !== "timing.insertMarks" && cmd !== "timing.replaceMarks") return false;
    return /^xd:/i.test(trackName) && /song structure|section|structure/i.test(trackName);
  });
}

function inferTimingDependency({ sections = [], timingTracks = [], planCommands = [] } = {}) {
  const names = getTimingTrackNames(timingTracks);
  const xdNames = names.filter((name) => isXdTimingTrack(name));
  const sectionScoped = (Array.isArray(sections) ? sections : []).filter(Boolean);
  const needsTiming = sectionScoped.length > 0;
  const hasXdStructureTrack = xdNames.some((name) => /song sections|section|structure/i.test(name));
  const plannedStructureTrack = hasPlannedStructureTrack(planCommands);
  const ready = !needsTiming || hasXdStructureTrack || plannedStructureTrack;
  return {
    needsTiming,
    ready,
    planned: plannedStructureTrack,
    availableTrackNames: names,
    xdTrackNames: xdNames,
    summary: ready
      ? (needsTiming
          ? (hasXdStructureTrack
              ? "Required timing context is available for the current section scope."
              : "Required timing context is planned for the current section scope.")
          : "No timing dependency is required for the current draft.")
      : "Required timing context is missing for the current section scope.",
    missingReason: !ready ? "missing_required_timing_track" : ""
  };
}

function getRequiredXdTrackNames(planCommands = []) {
  const names = new Set();
  for (const command of Array.isArray(planCommands) ? planCommands : []) {
    const cmd = str(command?.cmd);
    const params = command?.params && typeof command.params === "object" ? command.params : {};
    const anchor = command?.anchor && typeof command.anchor === "object" ? command.anchor : {};
    const candidateNames = [];
    if (cmd === "timing.createTrack" || cmd === "timing.insertMarks" || cmd === "timing.replaceMarks") {
      candidateNames.push(str(params.trackName));
    }
    if (str(anchor.trackName)) {
      candidateNames.push(str(anchor.trackName));
    }
    for (const name of candidateNames) {
      if (isXdTimingTrack(name)) names.add(name);
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

function buildTimingReviewGuardrail({ planCommands = [], timingTrackStatus = [] } = {}) {
  const requiredTrackNames = getRequiredXdTrackNames(planCommands);
  const rows = Array.isArray(timingTrackStatus) ? timingTrackStatus : [];
  const blockingRows = requiredTrackNames
    .map((trackName) => rows.find((row) => norm(row?.trackName) === norm(trackName)))
    .filter((row) => row && (row.status === "user_edited" || row.status === "stale"));
  const ready = blockingRows.length === 0;
  return {
    ready,
    requiredTrackNames,
    blockingRows: blockingRows.map((row) => ({
      policyKey: str(row.policyKey),
      trackName: str(row.trackName),
      status: str(row.status)
    })),
    summary: ready
      ? ""
      : `Accept timing review for ${blockingRows.map((row) => str(row.trackName)).filter(Boolean).join(", ")} before sequencing apply.`
  };
}

export function buildSequenceDashboardState({
  state = {},
  intentHandoff = null,
  planHandoff = null
} = {}) {
  const proposalLines = Array.isArray(state.proposed) ? state.proposed : [];
  const planCommands = getPlanCommands(planHandoff, state);
  const plan = state.agentPlan && typeof state.agentPlan === "object" ? state.agentPlan : {};
  const intent = intentHandoff && typeof intentHandoff === "object"
    ? intentHandoff
    : (state.creative?.intentHandoff && typeof state.creative.intentHandoff === "object" ? state.creative.intentHandoff : null);
  const sectionScope = Array.isArray(intent?.scope?.sections) ? intent.scope.sections.filter(Boolean) : [];
  const selectedTargets = Array.isArray(intent?.scope?.targetIds) ? intent.scope.targetIds.filter(Boolean) : [];
  const translationSource = plan?.source === "cloud_normalized"
    ? "Cloud-Normalized Plan"
    : planHandoff?.artifactId
      ? "Canonical Plan"
      : "Pending";
  const commandCount = planCommands.length;
  const warningList = Array.isArray(plan?.warnings) ? plan.warnings.filter(Boolean) : [];
  const timingDependency = inferTimingDependency({
    sections: sectionScope,
    timingTracks: Array.isArray(state.timingTracks) ? state.timingTracks : [],
    planCommands
  });
  const timingTrackStatus = buildTimingTrackStatusRows({
    timingTrackProvenance: state.sequenceAgentRuntime?.timingTrackProvenance,
    timingGeneratedSignatures: state.sequenceAgentRuntime?.timingGeneratedSignatures,
    timingTrackPolicies: state.sequenceAgentRuntime?.timingTrackPolicies
  });
  const timingReview = summarizeTimingTrackStatuses(timingTrackStatus);
  const timingReviewGuardrail = buildTimingReviewGuardrail({
    planCommands,
    timingTrackStatus
  });
  const sequenceSession = buildSequenceSession({ state });
  const sessionBlockers = explainSequenceSessionBlockers(sequenceSession);
  const dashboardSequenceBlocked = Boolean(
    sequenceSession.xlightsConnected &&
    !sequenceSession.planOnlyMode &&
    (!sequenceSession.effectiveSequenceLoaded || !sequenceSession.effectiveSequenceAllowed)
  );
  const allRows = buildDashboardRows({
    state,
    proposalLines,
    planCommands
  });
  const activeDesignFilterId = str(state.ui?.sequenceDesignFilterId || "");
  const rows = activeDesignFilterId
    ? allRows.filter((row) => str(row.designId) === activeDesignFilterId)
    : allRows;
  const activeDesignFilter = activeDesignFilterId
    ? (allRows.find((row) => str(row.designId) === activeDesignFilterId) || null)
    : null;

  let status = "idle";
  let readinessLevel = "idle";
  if (!proposalLines.length) {
    status = "idle";
    readinessLevel = "blocked";
  } else if (dashboardSequenceBlocked || !timingDependency.ready || !timingReviewGuardrail.ready) {
    status = "partial";
    readinessLevel = "partial";
  } else {
    status = "ready";
    readinessLevel = "ready";
  }

  const validationIssues = [];
  if (!proposalLines.length) {
    validationIssues.push({
      code: "no_sequence_draft",
      severity: "info",
      message: "No translated sequence changes are available yet."
    });
  }
  if (dashboardSequenceBlocked) {
    validationIssues.push({
      code: sessionBlockers.primaryCode || "sequence_session_blocked",
      severity: "warning",
      message: sessionBlockers.message || "Sequence session is not ready for generation."
    });
  }
  if (!timingDependency.ready) {
    validationIssues.push({
      code: timingDependency.missingReason || "missing_required_timing_track",
      severity: "warning",
      message: timingDependency.summary
    });
  }
  if (!timingReviewGuardrail.ready) {
    validationIssues.push({
      code: "timing_review_required",
      severity: "warning",
      message: timingReviewGuardrail.summary
    });
  }

  return {
    contract: "sequence_dashboard_state_v1",
    version: "1.0",
    page: "sequence",
    title: "Sequence",
    summary: str(plan.summary || "Live technical translation of the current design conversation."),
    status,
    readiness: {
      ok: proposalLines.length > 0 && !dashboardSequenceBlocked && timingDependency.ready && timingReviewGuardrail.ready,
      level: readinessLevel,
      reasons: validationIssues.map((issue) => issue.code)
    },
    warnings: warningList,
    validationIssues,
    refs: {
      intentHandoffId: str(intent?.artifactId || null),
      planHandoffId: str(planHandoff?.artifactId || null),
      activeSequence: str(state.activeSequence || null)
    },
    data: {
      translationSource,
      activeDesignFilter: activeDesignFilter
        ? {
            designId: activeDesignFilter.designId,
            designLabel: activeDesignFilter.designLabel,
            designRevision: activeDesignFilter.designRevision
          }
        : null,
      changeLineCount: proposalLines.length,
      commandCount,
      warningCount: warningList.length,
      targetCount: selectedTargets.length,
      sectionCount: sectionScope.length,
      rows,
      timingTrackStatus,
      timingReview,
      timingReviewGuardrail,
      sequenceSession,
      dashboardSequenceBlocked,
      scope: {
        sections: sectionScope,
        targetIds: selectedTargets
      },
      timingDependency
    }
  };
}
