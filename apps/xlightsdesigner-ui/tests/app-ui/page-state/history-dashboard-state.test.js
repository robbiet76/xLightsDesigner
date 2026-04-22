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
          snapshotSummary: {
            sequenceSummary: {
              passOutcome: {
                status: "revise_required",
                hasRetryPressure: true
              }
            }
          },
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
          planHandoff: {
            metadata: {
              priorPassMemory: { unresolvedSignals: ["lead_mismatch"] },
              intentEnvelope: {
                artifactType: "intent_envelope_v1",
                attention: { profile: "concentrated" },
                temporal: { profile: "steady" },
                spatial: { footprint: "moderate" },
                texture: { profile: "soft" }
              },
              revisionFeedback: {
                artifactType: "revision_feedback_v1",
                artifactId: "feedback-1",
                status: "revise_required",
                rejectionReasons: ["lead_mismatch"],
                nextDirection: {
                  executionObjective: "Restore Snowman as the clear focal element."
                }
              }
            }
          },
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
  assert.equal(dashboard.data.rows[0].passOutcomeStatus, "revise_required");
  assert.equal(dashboard.data.rows[0].hasRetryPressure, true);
  assert.equal(dashboard.data.selected.designSummary, "Warm focal chorus");
  assert.equal(dashboard.data.selected.passOutcomeStatus, "revise_required");
  assert.equal(dashboard.data.selected.hasRetryPressure, true);
  assert.equal(dashboard.data.selected.audioTitle, "Song");
  assert.equal(dashboard.data.selected.renderObservation.macro.leadModel, "Snowman");
  assert.deepEqual(dashboard.data.selected.planHandoff.metadata.priorPassMemory.unresolvedSignals, ["lead_mismatch"]);
  assert.equal(dashboard.data.selected.generativeSummary.feedback.artifactType, "revision_feedback_v1");
  assert.equal(dashboard.data.selected.generativeSummary.feedback.status, "revise_required");
  assert.deepEqual(dashboard.data.selected.generativeSummary.feedback.rejectionReasons, ["lead_mismatch"]);
  assert.equal(dashboard.data.selected.generativeSummary.feedback.executionObjective, "Restore Snowman as the clear focal element.");
  assert.equal(dashboard.data.selected.renderCritiqueContext.comparison.leadMatchesPrimaryFocus, true);
  assert.equal(dashboard.data.selected.sequenceArtisticGoal.scope.goalLevel, "section");
  assert.equal(dashboard.data.selected.sequenceRevisionObjective.ladderLevel, "section");
});
