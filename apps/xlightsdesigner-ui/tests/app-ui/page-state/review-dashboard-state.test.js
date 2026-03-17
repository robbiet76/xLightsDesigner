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
      creative: {
        proposalBundle: {
          executionPlan: {
            sectionPlans: [
              {
                designId: "DES-001",
                designAuthor: "designer",
                section: "Chorus 1",
                intentSummary: "Warm focal chorus change.",
                targetIds: ["Snowman"]
              }
            ]
          }
        }
      },
      agentPlan: {
        handoff: {
          commands: [
            { cmd: "effects.create", designId: "DES-001", params: { effectName: "Color Wash" }, intent: { designId: "DES-001", designAuthor: "designer" } }
          ]
        }
      },
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
  assert.equal(dashboard.data.rows.length, 1);
  assert.equal(dashboard.data.rows[0].designId, "DES-001");
  assert.equal(dashboard.data.rows[0].designLabel, "D1.0");
  assert.equal(dashboard.data.rows[0].designAuthor, "designer");
  assert.equal(dashboard.data.rows[0].effectCount, 1);
});

test("review dashboard state reports ready when apply gate and approval are satisfied", () => {
  const dashboard = buildReviewDashboardState({
    state: {
      proposed: ["Chorus 1 / Snowman / add Color Wash"],
      creative: {
        proposalBundle: {
          executionPlan: {
            sectionPlans: [
              {
                designId: "DES-001",
                designAuthor: "designer",
                section: "Chorus 1",
                intentSummary: "Warm focal chorus change.",
                targetIds: ["Snowman"]
              }
            ]
          }
        }
      },
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
  assert.equal(dashboard.data.counts.designGroups, 1);
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

test("review dashboard state falls back to intent handoff execution strategy for grouped rows", () => {
  const dashboard = buildReviewDashboardState({
    state: {
      proposed: [
        "Chorus 1 / Snowman / warm focal lift"
      ],
      creative: {
        intentHandoff: {
          executionStrategy: {
            sectionPlans: [
              {
                designId: "DES-001",
                designAuthor: "user",
                section: "Chorus 1",
                intentSummary: "User-directed chorus change.",
                targetIds: ["Snowman"]
              }
            ]
          }
        }
      },
      agentPlan: {
        handoff: {
          commands: [
            { cmd: "effects.create", designId: "DES-001", params: { effectName: "Color Wash" }, intent: { designId: "DES-001", designAuthor: "user" } }
          ]
        }
      },
      ui: { proposedSelection: [0], applyApprovalChecked: false },
      flags: { applyInProgress: false, proposalStale: false }
    },
    helpers: buildHelpers()
  });

  assert.equal(dashboard.data.rows.length, 1);
  assert.equal(dashboard.data.rows[0].designId, "DES-001");
  assert.equal(dashboard.data.rows[0].designLabel, "D1.0");
  assert.equal(dashboard.data.rows[0].designAuthor, "user");
  assert.equal(dashboard.data.rows[0].effectCount, 1);
});

test("review dashboard sorts grouped rows numerically and exposes superseded revision counts", () => {
  const dashboard = buildReviewDashboardState({
    state: {
      proposed: [
        "Bridge / Tree / bars accent",
        "Chorus 1 / Snowman / warm focal lift"
      ],
      creative: {
        supersededConcepts: [
          { designId: "DES-002", designRevision: 0 }
        ],
        proposalBundle: {
          executionPlan: {
            sectionPlans: [
              { designId: "DES-010", designRevision: 0, designAuthor: "designer", section: "Bridge", intentSummary: "Bridge concept.", targetIds: ["Tree"] },
              { designId: "DES-002", designRevision: 1, designAuthor: "designer", section: "Chorus 1", intentSummary: "Chorus concept.", targetIds: ["Snowman"] }
            ]
          }
        }
      },
      agentPlan: {
        handoff: {
          commands: [
            { cmd: "effects.create", designId: "DES-010", params: { effectName: "Bars" }, intent: { designId: "DES-010", designAuthor: "designer" } },
            { cmd: "effects.create", designId: "DES-002", params: { effectName: "Color Wash" }, intent: { designId: "DES-002", designAuthor: "designer" } }
          ]
        }
      },
      ui: { proposedSelection: [0, 1], applyApprovalChecked: false },
      flags: { applyInProgress: false, proposalStale: false }
    },
    helpers: buildHelpers({
      hasAllSectionsSelected: () => true
    })
  });

  assert.deepEqual(dashboard.data.rows.map((row) => row.designLabel), ["D2.1", "D10.0"]);
  assert.equal(dashboard.data.rows[0].supersededRevisionCount, 1);
  assert.equal(dashboard.data.rows[0].revisionState, "current");
  assert.equal(dashboard.data.rows[0].previousRevision.designLabel, "D2.0");
  assert.equal(dashboard.data.rows[0].previousRevision.summary, "Previous revision");
});

test("review dashboard compares current concept to prior superseded revision details", () => {
  const dashboard = buildReviewDashboardState({
    state: {
      proposed: ["Chorus 1 / Snowman / revised chorus concept"],
      creative: {
        supersededConcepts: [
          {
            designId: "DES-001",
            designRevision: 0,
            summary: "Original chorus concept.",
            sections: ["Chorus 1"],
            targetIds: ["Snowman", "Star"],
            placementCount: 3
          }
        ],
        proposalBundle: {
          executionPlan: {
            sectionPlans: [
              {
                designId: "DES-001",
                designRevision: 1,
                designAuthor: "designer",
                section: "Chorus 1",
                intentSummary: "Revised chorus concept.",
                targetIds: ["Snowman"]
              }
            ]
          }
        }
      },
      agentPlan: {
        handoff: {
          commands: [
            { cmd: "effects.create", designId: "DES-001", params: { effectName: "Color Wash" }, intent: { designId: "DES-001", designAuthor: "designer" } }
          ]
        }
      },
      ui: { proposedSelection: [0], applyApprovalChecked: false },
      flags: { applyInProgress: false, proposalStale: false }
    },
    helpers: buildHelpers()
  });

  assert.equal(dashboard.data.rows[0].designLabel, "D1.1");
  assert.equal(dashboard.data.rows[0].previousRevision.designLabel, "D1.0");
  assert.equal(dashboard.data.rows[0].previousRevision.summary, "Original chorus concept.");
  assert.equal(dashboard.data.rows[0].previousRevision.anchor, "Chorus 1");
  assert.equal(dashboard.data.rows[0].previousRevision.targetSummary, "Snowman, Star");
  assert.equal(dashboard.data.rows[0].previousRevision.effectCount, 3);
});
