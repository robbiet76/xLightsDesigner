import { buildGenerativeSummaryFromMetadata } from "./review-dashboard-state.js";

function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function formatShortDate(value = "") {
  const raw = str(value);
  if (!raw) return "Unknown time";
  const date = new Date(raw);
  return Number.isNaN(date.getTime())
    ? raw
    : date.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatLongDate(value = "") {
  const raw = str(value);
  if (!raw) return "unknown";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : date.toLocaleString();
}

function buildProcessSummary({
  generativeSummary = null,
  passOutcomeStatus = "",
  hasRetryPressure = false,
  revisionObjective = null
} = {}) {
  const focus = str(generativeSummary?.intent?.attentionProfile || "unconstrained");
  const timing = str(generativeSummary?.intent?.temporalProfile || "unconstrained");
  const nextMove = str(
    generativeSummary?.feedback?.executionObjective
    || revisionObjective?.sequencerDirection?.executionObjective
    || ""
  );
  const changeSummary = [
    arr(generativeSummary?.delta?.introducedEffectNames).length
      ? `new effects ${arr(generativeSummary.delta.introducedEffectNames).slice(0, 3).join(", ")}`
      : "",
    arr(generativeSummary?.delta?.introducedTargetIds).length
      ? `new targets ${arr(generativeSummary.delta.introducedTargetIds).slice(0, 3).join(", ")}`
      : ""
  ].filter(Boolean).join(" / ");
  if (!focus && !timing && !nextMove && !changeSummary && !passOutcomeStatus) return null;
  return {
    status: str(passOutcomeStatus || generativeSummary?.feedback?.status || "unknown"),
    focus,
    timing,
    nextMove,
    changeSummary,
    hasRetryPressure: Boolean(hasRetryPressure),
    rejectionReasons: arr(generativeSummary?.feedback?.rejectionReasons).slice(0, 3)
  };
}

export function buildHistoryDashboardState({
  state = {}
} = {}) {
  const applyHistory = arr(state.applyHistory).filter((entry) => entry && typeof entry === "object");
  const selectedId = str(state.ui?.selectedHistoryEntry);
  const selected = applyHistory.find((entry) => str(entry?.historyEntryId) === selectedId) || applyHistory[0] || null;
  const selectedSnapshot =
    state.ui?.selectedHistorySnapshot &&
    typeof state.ui.selectedHistorySnapshot === "object" &&
    state.ui.selectedHistorySnapshot.historyEntryId === str(selected?.historyEntryId)
      ? state.ui.selectedHistorySnapshot
      : null;

  return {
    contract: "history_dashboard_state_v1",
    version: "1.0",
    page: "history",
    title: "History",
    summary: applyHistory.length
      ? "Applied revisions are available for audit."
      : "No applied snapshots yet.",
    status: applyHistory.length ? "active" : "idle",
    readiness: {
      ok: applyHistory.length > 0,
      level: applyHistory.length ? "ready" : "idle",
      reasons: applyHistory.length ? [] : ["no_applied_history"]
    },
    warnings: [],
    validationIssues: applyHistory.length
      ? []
      : [{ code: "no_applied_history", severity: "info", message: "History is populated only after an approved apply." }],
    refs: {
      selectedHistoryEntryId: str(selected?.historyEntryId || null)
    },
    data: {
      rows: applyHistory.map((entry) => ({
        historyEntryId: str(entry.historyEntryId),
        summary: str(entry.summary || "Unnamed apply snapshot"),
        status: str(entry.status || "unknown"),
        applyStage: str(entry.applyStage || ""),
        passOutcomeStatus: str(entry.snapshotSummary?.sequenceSummary?.passOutcome?.status || ""),
        hasRetryPressure: Boolean(entry.snapshotSummary?.sequenceSummary?.passOutcome?.hasRetryPressure),
        createdLabel: formatShortDate(entry.createdAt),
        active: str(entry.historyEntryId) === str(selected?.historyEntryId)
      })),
      selected: selected
        ? {
            generativeSummary: buildGenerativeSummaryFromMetadata(selectedSnapshot?.planHandoff?.metadata || null),
            summary: str(selected.summary || "Select an applied revision"),
            status: str(selected.status || "unknown"),
            commandCount: Number(selected.commandCount || 0),
            impactCount: Number(selected.impactCount || 0),
            createdLabel: formatShortDate(selected.createdAt),
            revisionBefore: str(selected.xlightsRevisionBefore || "unknown"),
            revisionAfter: str(selected.xlightsRevisionAfter || "unknown"),
            sequencePath: str(selected.sequencePath || "unknown"),
            createdAtLabel: formatLongDate(selected.createdAt),
            designSummary: str(selectedSnapshot?.creativeBrief?.summary || selected.snapshotSummary?.designSummary?.title || "No applied design summary."),
            designGoals: arr(selectedSnapshot?.creativeBrief?.goals).length
              ? arr(selectedSnapshot.creativeBrief.goals).slice(0, 4)
              : arr(selected.snapshotSummary?.designSummary?.goals).slice(0, 4),
            proposalLines: arr(selectedSnapshot?.proposalBundle?.proposalLines).length
              ? arr(selectedSnapshot.proposalBundle.proposalLines).slice(0, 4)
              : arr(selected.snapshotSummary?.sequenceSummary?.proposalLines).slice(0, 4),
            applyStatus: str(selectedSnapshot?.applyResult?.status || selected.snapshotSummary?.applySummary?.status || selected.status || "unknown"),
            passOutcomeStatus: str(selectedSnapshot?.planHandoff?.metadata?.revisionFeedback?.status || selected.snapshotSummary?.sequenceSummary?.passOutcome?.status || ""),
            hasRetryPressure: Boolean(selected.snapshotSummary?.sequenceSummary?.passOutcome?.hasRetryPressure),
            applyCommandCount: Number(selectedSnapshot?.applyResult?.commandCount || selected.snapshotSummary?.applySummary?.commandCount || selected.commandCount || 0),
            applyImpactCount: Number(selectedSnapshot?.applyResult?.impactCount || selected.snapshotSummary?.applySummary?.impactCount || selected.impactCount || 0),
            audioTitle: str(selectedSnapshot?.analysisArtifact?.trackIdentity?.title || "Unknown audio"),
            layoutMode: str(selectedSnapshot?.designSceneContext?.layoutMode || "unknown"),
            musicSummary: str(selectedSnapshot?.musicDesignContext?.summary || "No applied music context summary."),
            brief: selectedSnapshot?.creativeBrief || null,
            applyResult: selectedSnapshot?.applyResult || null,
            planHandoff: selectedSnapshot?.planHandoff || null,
            analysisArtifact: selectedSnapshot?.analysisArtifact || null,
            sceneContext: selectedSnapshot?.designSceneContext || null,
            musicContext: selectedSnapshot?.musicDesignContext || null,
            renderObservation: selectedSnapshot?.renderObservation || null,
            renderCritiqueContext: selectedSnapshot?.renderCritiqueContext || null,
            sequenceArtisticGoal: selectedSnapshot?.sequenceArtisticGoal || null,
            sequenceRevisionObjective: selectedSnapshot?.sequenceRevisionObjective || null,
            processSummary: buildProcessSummary({
              generativeSummary: buildGenerativeSummaryFromMetadata(selectedSnapshot?.planHandoff?.metadata || null),
              passOutcomeStatus: str(selectedSnapshot?.planHandoff?.metadata?.revisionFeedback?.status || selected.snapshotSummary?.sequenceSummary?.passOutcome?.status || ""),
              hasRetryPressure: Boolean(selected.snapshotSummary?.sequenceSummary?.passOutcome?.hasRetryPressure),
              revisionObjective: selectedSnapshot?.sequenceRevisionObjective || null
            }),
            artifactRefs: selected?.artifactRefs || null
          }
        : null
    }
  };
}
