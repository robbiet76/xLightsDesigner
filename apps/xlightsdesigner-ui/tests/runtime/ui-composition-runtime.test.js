import test from "node:test";
import assert from "node:assert/strict";

import { buildBuildLabel, createUiCompositionRuntime } from "../../runtime/ui-composition-runtime.js";

test("buildBuildLabel formats version and build time", () => {
  const label = buildBuildLabel({
    state: {
      health: {
        desktopAppVersion: "1.2.3",
        desktopBuildTime: "2026-04-05T12:34:00Z"
      }
    }
  });
  assert.match(label, /Build: v1\.2\.3/);
});

test("ui composition runtime builds page states and diagnostics panel", () => {
  const runtime = createUiCompositionRuntime({
    state: {
      ui: {
        diagnosticsOpen: true,
        diagnosticsFilter: "all"
      },
      diagnostics: [
        { level: "warning", ts: "2026-04-05T12:00:00Z", text: "warn", details: "detail" }
      ],
      applyHistory: [
        { status: "ok", createdAt: "2026-04-05T12:00:00Z", commandCount: 2, summary: "applied" }
      ],
      sceneGraph: {},
      metadata: { preferencesByTargetId: {} },
      health: {}
    },
    getValidHandoff: () => null,
    buildNormalizedTargetMetadataRecords: () => [],
    buildEffectiveMetadataAssignments: () => [],
    buildPageStates: ({ state, handoffs, helpers }) => ({
      ok: true,
      stateSeen: Boolean(state),
      helpersSeen: Boolean(helpers),
      handoffsSeen: Boolean(handoffs)
    }),
    buildScreenContent: ({ state, pageStates, helpers }) => `screen:${Boolean(state)}:${Boolean(pageStates)}:${Boolean(helpers)}`,
    helpers: {
      basenameOfPath: () => "",
      getSelectedSections: () => [],
      hasAllSectionsSelected: () => true,
      getSectionName: () => "",
      selectedProposedLinesForApply: () => [],
      summarizeImpactForLines: () => "",
      buildDesignerPlanCommands: () => [],
      applyReadyForApprovalGate: () => true,
      applyDisabledReason: () => "",
      buildCurrentReviewSnapshotSummary: () => "",
      getMetadataTagRecords: () => [],
      buildMetadataTargets: () => [],
      matchesMetadataFilterValue: () => false,
      normalizeMetadataSelectionIds: () => [],
      normalizeMetadataSelectedTags: () => [],
      getAgentApplyRolloutMode: () => "full",
      getManualLockedXdTracks: () => [],
      getTeamChatIdentities: () => [],
      getDiagnosticsCounts: () => ({ total: 1, warning: 1, actionRequired: 0 }),
      getAnalysisServiceHeaderBadgeText: () => "",
      escapeHtml: (value) => String(value || ""),
      referenceFormatSummaryText: () => "",
      sequenceEligibilityFormatSummaryText: () => "",
      formatBytes: () => "",
      referenceMediaMaxFileBytes: 0,
      referenceMediaMaxItems: 0,
      getSections: () => [],
      sanitizeProposedSelection: () => [],
      getProposedPayloadPreviewText: () => "",
      renderProposedLineHtml: () => "",
      applyPlanReadinessReason: () => "",
      applyEnabled: () => true,
      getMetadataOrphans: () => [],
      ensureVersionSnapshots: () => [],
      versionById: () => null
    }
  });

  const pageStates = runtime.getPageStates();
  const screen = runtime.screenContent(pageStates);
  const diagnostics = runtime.diagnosticsPanel();

  assert.equal(pageStates.ok, true);
  assert.equal(screen, "screen:true:true:true");
  assert.match(diagnostics, /Diagnostics/);
  assert.match(diagnostics, /Recent Applies/);
});
