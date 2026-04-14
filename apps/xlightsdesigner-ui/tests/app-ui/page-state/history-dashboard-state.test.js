import test from "node:test";
import assert from "node:assert/strict";

import { buildHistoryDashboardState } from "../../../app-ui/page-state/history-dashboard-state.js";

test("history dashboard reports empty state when no applies exist", () => {
  const dashboard = buildHistoryDashboardState({
    state: {
      applyHistory: [],
      ui: {}
    }
  });

  assert.equal(dashboard.page, "history");
  assert.equal(dashboard.status, "idle");
  assert.equal(dashboard.readiness.ok, false);
  assert.match(dashboard.validationIssues[0].code, /no_applied_history/);
});

test("history dashboard summarizes selected applied revision", () => {
  const dashboard = buildHistoryDashboardState({
    state: {
      applyHistory: [
        {
          historyEntryId: "history-1",
          summary: "Applied chorus focal lift",
          status: "completed",
          commandCount: 4,
          impactCount: 2,
          createdAt: "2026-03-16T13:00:00.000Z",
          xlightsRevisionBefore: "rev-11",
          xlightsRevisionAfter: "rev-12",
          sequencePath: "/shows/holiday/Validation-Clean-Phase1.xsq"
        }
      ],
      ui: {
        selectedHistoryEntry: "history-1",
        selectedHistorySnapshot: {
          historyEntryId: "history-1",
          creativeBrief: { summary: "Warm focal chorus", goals: ["Keep Snowman leading"] },
          proposalBundle: { proposalLines: ["Chorus 1 / Snowman / warm focal lift"] },
          applyResult: { status: "completed", commandCount: 4, impactCount: 2 },
          planHandoff: { metadata: { priorPassMemory: { unresolvedSignals: ["lead_mismatch"] } } },
          analysisArtifact: { trackIdentity: { title: "Song" } },
          designSceneContext: { layoutMode: "2d" },
          musicDesignContext: { summary: "Intro hold, chorus reveal." },
          renderObservation: { artifactType: "render_observation_v1", macro: { leadModel: "Snowman" } },
          renderCritiqueContext: { artifactType: "sequence_render_critique_context_v1", comparison: { leadMatchesPrimaryFocus: true } },
          sequenceArtisticGoal: { artifactType: "sequence_artistic_goal_v1", scope: { goalLevel: "section" } },
          sequenceRevisionObjective: { artifactType: "sequence_revision_objective_v1", ladderLevel: "section" }
        }
      }
    }
  });

  assert.equal(dashboard.status, "active");
  assert.equal(dashboard.data.rows.length, 1);
  assert.equal(dashboard.data.selected.summary, "Applied chorus focal lift");
  assert.equal(dashboard.data.selected.designSummary, "Warm focal chorus");
  assert.equal(dashboard.data.selected.audioTitle, "Song");
  assert.equal(dashboard.data.selected.renderObservation.macro.leadModel, "Snowman");
  assert.deepEqual(dashboard.data.selected.planHandoff.metadata.priorPassMemory.unresolvedSignals, ["lead_mismatch"]);
  assert.equal(dashboard.data.selected.renderCritiqueContext.comparison.leadMatchesPrimaryFocus, true);
  assert.equal(dashboard.data.selected.sequenceArtisticGoal.scope.goalLevel, "section");
  assert.equal(dashboard.data.selected.sequenceRevisionObjective.ladderLevel, "section");
});
