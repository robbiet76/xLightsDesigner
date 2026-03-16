import test from "node:test";
import assert from "node:assert/strict";

import { buildReviewDashboardState } from "../../../app-ui/page-state/review-dashboard-state.js";

function buildHelpers(overrides = {}) {
  return {
    getSelectedSections: () => ["Chorus 1"],
    hasAllSectionsSelected: () => false,
    getSectionName: (line = "") => String(line).split("/")[0].trim(),
    selectedProposedLinesForApply: () => [],
    summarizeImpactForLines: (lines = []) => ({
      targetCount: lines.length ? 1 : 0,
      sectionWindows: lines.length ? ["Chorus 1"] : []
    }),
    buildDesignerPlanCommands: (lines = []) => lines.map((line, idx) => ({ id: idx + 1, line })),
    applyReadyForApprovalGate: () => false,
    applyDisabledReason: () => "Apply is not currently allowed.",
    buildCurrentReviewSnapshotSummary: () => ({
      designSummary: { title: "Current design", goals: ["Warm focal chorus"] },
      sequenceSummary: { proposalLines: ["Chorus 1 / Snowman / add Color Wash"] },
      applySummary: { status: "pending" }
    }),
    ...overrides
  };
}

test("review dashboard state reports idle when no draft exists", () => {
  const dashboard = buildReviewDashboardState({
    state: {
      proposed: [],
      ui: { proposedSelection: [], applyApprovalChecked: false },
      flags: {}
    },
    helpers: buildHelpers()
  });

  assert.equal(dashboard.page, "review");
  assert.equal(dashboard.status, "idle");
  assert.equal(dashboard.readiness.ok, false);
  assert.match(dashboard.validationIssues[0].code, /no_pending_review_changes/);
});

test("review dashboard state reports blocked when draft exists but approval gate is not ready", () => {
  const dashboard = buildReviewDashboardState({
    state: {
      proposed: ["Chorus 1 / Snowman / add Color Wash"],
      ui: { proposedSelection: [0], applyApprovalChecked: false },
      flags: { applyInProgress: false, proposalStale: false }
    },
    helpers: buildHelpers({
      applyReadyForApprovalGate: () => false,
      applyDisabledReason: () => "Connect to xLights to apply."
    })
  });

  assert.equal(dashboard.status, "blocked");
  assert.equal(dashboard.readiness.ok, false);
  assert.match(dashboard.validationIssues.map((issue) => issue.code).join(","), /apply_not_ready/);
  assert.equal(dashboard.data.apply.canApplyAll, false);
});

test("review dashboard state reports ready when apply gate and approval are satisfied", () => {
  const dashboard = buildReviewDashboardState({
    state: {
      proposed: ["Chorus 1 / Snowman / add Color Wash"],
      ui: { proposedSelection: [0], applyApprovalChecked: true },
      flags: { applyInProgress: false, proposalStale: false },
      lastApplyBackupPath: "/tmp/backup.xsq"
    },
    helpers: buildHelpers({
      applyReadyForApprovalGate: () => true,
      applyDisabledReason: () => ""
    })
  });

  assert.equal(dashboard.status, "ready");
  assert.equal(dashboard.readiness.ok, true);
  assert.equal(dashboard.data.apply.canApplyAll, true);
  assert.equal(dashboard.data.backupReady, true);
});

test("review dashboard state carries last applied snapshot when loaded", () => {
  const state = {
    proposed: ["Chorus 1 / Snowman / add Color Wash"],
    ui: {
      proposedSelection: [],
      applyApprovalChecked: false,
      reviewHistorySnapshot: {
        historyEntryId: "history-123",
        creativeBrief: { summary: "Applied design" },
        proposalBundle: { proposalLines: ["Applied line"] },
        applyResult: { status: "completed" },
        analysisArtifact: { trackIdentity: { title: "Song" } },
        designSceneContext: { layoutMode: "2d" },
        musicDesignContext: { sectionArc: ["Intro", "Chorus 1"] }
      }
    },
    applyHistory: [
      {
        historyEntryId: "history-123",
        artifactRefs: { analysisArtifactId: "analysis-1" }
      }
    ],
    flags: { applyInProgress: false, proposalStale: false }
  };

  const dashboard = buildReviewDashboardState({
    state,
    helpers: buildHelpers()
  });

  assert.ok(dashboard.data.lastAppliedSnapshot);
  assert.equal(dashboard.data.lastAppliedSnapshot.brief.summary, "Applied design");
  assert.equal(dashboard.data.lastAppliedSnapshot.proposalLines[0], "Applied line");
});
