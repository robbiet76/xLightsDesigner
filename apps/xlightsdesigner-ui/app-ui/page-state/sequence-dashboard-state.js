function str(value = "") {
  return String(value || "").trim();
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

function getTimingTrackNames(tracks = []) {
  return (Array.isArray(tracks) ? tracks : [])
    .map((t) => (typeof t === "string" ? t : t?.name || ""))
    .map((name) => str(name))
    .filter(Boolean);
}

function isXdTimingTrack(name) {
  return /^xd:/i.test(str(name));
}

function inferTimingDependency({ sections = [], timingTracks = [] } = {}) {
  const names = getTimingTrackNames(timingTracks);
  const xdNames = names.filter((name) => isXdTimingTrack(name));
  const sectionScoped = (Array.isArray(sections) ? sections : []).filter(Boolean);
  const needsTiming = sectionScoped.length > 0;
  const hasXdStructureTrack = xdNames.some((name) => /song sections|section|structure/i.test(name));
  const ready = !needsTiming || hasXdStructureTrack;
  return {
    needsTiming,
    ready,
    availableTrackNames: names,
    xdTrackNames: xdNames,
    summary: ready
      ? (needsTiming ? "Required timing context is available for the current section scope." : "No timing dependency is required for the current draft.")
      : "Required timing context is missing for the current section scope.",
    missingReason: !ready ? "missing_required_timing_track" : ""
  };
}

export function buildSequenceDashboardState({
  state = {},
  intentHandoff = null,
  planHandoff = null
} = {}) {
  const proposalLines = Array.isArray(state.proposed) ? state.proposed : [];
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
  const commandCount = Array.isArray(planHandoff?.commands) ? planHandoff.commands.length : 0;
  const warningList = Array.isArray(plan?.warnings) ? plan.warnings.filter(Boolean) : [];
  const timingDependency = inferTimingDependency({
    sections: sectionScope,
    timingTracks: Array.isArray(state.timingTracks) ? state.timingTracks : []
  });
  const rows = proposalLines.map((line, idx) => {
    const row = summarizeSequenceGridRow(line);
    return {
      index: idx + 1,
      timing: str(row.timing || "XD: Sequencer Plan"),
      section: str(row.section || getSectionNameFromLine(line) || "General"),
      target: str(row.target || parseTranslatedTarget(line) || "Unresolved"),
      level: str(row.level || "Model"),
      summary: str(row.summary || "Pending translation detail"),
      effects: Number.isFinite(Number(row.effects)) ? Number(row.effects) : 0,
      sourceLine: str(line)
    };
  });

  let status = "idle";
  let readinessLevel = "idle";
  if (!proposalLines.length) {
    status = "idle";
    readinessLevel = "blocked";
  } else if (!timingDependency.ready) {
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
  if (!timingDependency.ready) {
    validationIssues.push({
      code: timingDependency.missingReason || "missing_required_timing_track",
      severity: "warning",
      message: timingDependency.summary
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
      ok: proposalLines.length > 0 && timingDependency.ready,
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
      changeLineCount: proposalLines.length,
      commandCount,
      warningCount: warningList.length,
      targetCount: selectedTargets.length,
      sectionCount: sectionScope.length,
      rows,
      scope: {
        sections: sectionScope,
        targetIds: selectedTargets
      },
      timingDependency
    }
  };
}
