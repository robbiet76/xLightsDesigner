import { buildPageStates as buildPageStatesFromModules } from "../app-ui/page-state/index.js";
import { buildScreenContent as buildScreenContentFromModules } from "../app-ui/screens.js";

function str(value = "") {
  return String(value || "").trim();
}

export function buildBuildLabel({ state = {} } = {}) {
  const buildVersion = str(state?.health?.desktopAppVersion);
  const buildTimeIso = str(state?.health?.desktopBuildTime);
  const buildTimeLabel = buildTimeIso
    ? new Date(buildTimeIso).toLocaleString([], { year: "2-digit", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "";
  return buildVersion
    ? `Build: v${buildVersion}${buildTimeLabel ? ` @ ${buildTimeLabel}` : ""}`
    : "Build: unknown";
}

export function createUiCompositionRuntime({
  state,
  getValidHandoff,
  buildNormalizedTargetMetadataRecords,
  buildEffectiveMetadataAssignments,
  buildPageStates = buildPageStatesFromModules,
  buildScreenContent = buildScreenContentFromModules,
  helpers = {}
} = {}) {
  function buildPageStateHelpers() {
    return {
      basenameOfPath: helpers.basenameOfPath,
      getSelectedSections: helpers.getSelectedSections,
      hasAllSectionsSelected: helpers.hasAllSectionsSelected,
      getSectionName: helpers.getSectionName,
      selectedProposedLinesForApply: helpers.selectedProposedLinesForApply,
      summarizeImpactForLines: helpers.summarizeImpactForLines,
      buildDesignerPlanCommands: helpers.buildDesignerPlanCommands,
      applyReadyForApprovalGate: helpers.applyReadyForApprovalGate,
      applyDisabledReason: helpers.applyDisabledReason,
      buildCurrentReviewSnapshotSummary: helpers.buildCurrentReviewSnapshotSummary,
      getMetadataTagRecords: helpers.getMetadataTagRecords,
      buildMetadataTargets: helpers.buildMetadataTargets,
      buildNormalizedTargetMetadataRecords: () => buildNormalizedTargetMetadataRecords({
        sceneGraph: state.sceneGraph || {},
        metadataAssignments: buildEffectiveMetadataAssignments(),
        metadataPreferencesByTargetId: state.metadata?.preferencesByTargetId || {}
      }),
      matchesMetadataFilterValue: helpers.matchesMetadataFilterValue,
      normalizeMetadataSelectionIds: helpers.normalizeMetadataSelectionIds,
      normalizeMetadataSelectedTags: helpers.normalizeMetadataSelectedTags,
      getAgentApplyRolloutMode: helpers.getAgentApplyRolloutMode,
      getManualLockedXdTracks: helpers.getManualLockedXdTracks,
      getTeamChatIdentities: helpers.getTeamChatIdentities,
      getDiagnosticsCounts: helpers.getDiagnosticsCounts,
      buildLabel: buildBuildLabel({ state })
    };
  }

  function getPageStates() {
    return buildPageStates({
      state,
      handoffs: {
        analysisHandoff: getValidHandoff("analysis_handoff_v1"),
        intentHandoff: getValidHandoff("intent_handoff_v1"),
        planHandoff: getValidHandoff("plan_handoff_v1")
      },
      helpers: buildPageStateHelpers()
    });
  }

  function screenContent(pageStates = getPageStates()) {
    return buildScreenContent({
      state,
      pageStates,
      helpers: {
        basenameOfPath: helpers.basenameOfPath,
        getAnalysisServiceHeaderBadgeText: helpers.getAnalysisServiceHeaderBadgeText,
        getValidHandoff,
        escapeHtml: helpers.escapeHtml,
        referenceFormatSummaryText: helpers.referenceFormatSummaryText,
        sequenceEligibilityFormatSummaryText: helpers.sequenceEligibilityFormatSummaryText,
        formatBytes: helpers.formatBytes,
        referenceMediaMaxFileBytes: helpers.referenceMediaMaxFileBytes,
        referenceMediaMaxItems: helpers.referenceMediaMaxItems,
        getSections: helpers.getSections,
        getSelectedSections: helpers.getSelectedSections,
        hasAllSectionsSelected: helpers.hasAllSectionsSelected,
        buildDesignerPlanCommands: helpers.buildDesignerPlanCommands,
        sanitizeProposedSelection: helpers.sanitizeProposedSelection,
        selectedProposedLinesForApply: helpers.selectedProposedLinesForApply,
        summarizeImpactForLines: helpers.summarizeImpactForLines,
        getProposedPayloadPreviewText: helpers.getProposedPayloadPreviewText,
        getSectionName: helpers.getSectionName,
        renderProposedLineHtml: helpers.renderProposedLineHtml,
        applyDisabledReason: helpers.applyDisabledReason,
        applyPlanReadinessReason: helpers.applyPlanReadinessReason,
        applyReadyForApprovalGate: helpers.applyReadyForApprovalGate,
        applyEnabled: helpers.applyEnabled,
        buildCurrentReviewSnapshotSummary: helpers.buildCurrentReviewSnapshotSummary,
        getMetadataOrphans: helpers.getMetadataOrphans,
        getMetadataTagRecords: helpers.getMetadataTagRecords,
        buildMetadataTargets: helpers.buildMetadataTargets,
        matchesMetadataFilterValue: helpers.matchesMetadataFilterValue,
        normalizeMetadataSelectionIds: helpers.normalizeMetadataSelectionIds,
        normalizeMetadataSelectedTags: helpers.normalizeMetadataSelectedTags,
        ensureVersionSnapshots: helpers.ensureVersionSnapshots,
        versionById: helpers.versionById,
        getAgentApplyRolloutMode: helpers.getAgentApplyRolloutMode,
        getManualLockedXdTracks: helpers.getManualLockedXdTracks,
        getTeamChatIdentities: helpers.getTeamChatIdentities
      }
    });
  }

  function diagnosticsPanel() {
    if (!state.ui?.diagnosticsOpen) return "";
    const rows = state.diagnostics || [];
    const filter = state.ui.diagnosticsFilter;
    const filteredRows = filter === "all" ? rows : rows.filter((d) => d.level === filter);
    const counts = helpers.getDiagnosticsCounts();
    const applyHistory = Array.isArray(state.applyHistory) ? state.applyHistory.slice(0, 12) : [];
    return `
    <section class="card diagnostics-panel">
      <div class="row" style="justify-content:space-between;">
        <h3>Diagnostics</h3>
        <div class="row">
          <button data-diag-filter="all" class="${filter === "all" ? "active-chip" : ""}">All (${counts.total})</button>
          <button data-diag-filter="warning" class="${filter === "warning" ? "active-chip" : ""}">Warnings (${counts.warning})</button>
          <button data-diag-filter="action-required" class="${filter === "action-required" ? "active-chip" : ""}">Action Required (${counts.actionRequired})</button>
          <button id="export-diagnostics">Export</button>
          <button id="clear-diagnostics">Clear</button>
          <button id="close-diagnostics">Close</button>
        </div>
      </div>
      ${
        filteredRows.length
          ? `
        <ul class="list">
          ${filteredRows
            .map(
              (d) => `
            <li>
              <strong>[${d.level}]</strong> ${new Date(d.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })} - ${d.text}
              ${d.details ? `<pre class="diag-details">${helpers.escapeHtml(d.details)}</pre>` : ""}
            </li>
          `
            )
            .join("")}
        </ul>
      `
          : "<p class=\"banner\">No diagnostics for current filter.</p>"
      }
      <div style="margin-top:10px;">
        <h4 style="margin:0 0 6px;">Recent Applies</h4>
        ${
          applyHistory.length
            ? `
          <ul class="list">
            ${applyHistory
              .map((entry) => {
                const ts = entry?.createdAt
                  ? new Date(entry.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
                  : "--:--:--";
                const status = str(entry?.status || "unknown");
                const count = Number(entry?.commandCount || 0);
                const summary = str(entry?.summary);
                return `
                <li>
                  <strong>[${status}]</strong> ${ts} - ${count} command${count === 1 ? "" : "s"}
                  ${entry?.applyStage ? ` (${helpers.escapeHtml(str(entry.applyStage))})` : ""}
                  ${summary ? `<div class="banner">${helpers.escapeHtml(summary)}</div>` : ""}
                </li>
              `;
              })
              .join("")}
          </ul>
        `
            : '<p class="banner">No apply history yet.</p>'
        }
      </div>
    </section>
  `;
  }

  return {
    buildPageStateHelpers,
    getPageStates,
    screenContent,
    diagnosticsPanel
  };
}
