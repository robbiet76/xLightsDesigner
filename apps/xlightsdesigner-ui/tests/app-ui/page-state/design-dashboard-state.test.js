import test from "node:test";
import assert from "node:assert/strict";

import { buildDesignDashboardState } from "../../../app-ui/page-state/design-dashboard-state.js";

test("design dashboard state reports idle when no design state exists", () => {
  const dashboard = buildDesignDashboardState({
    state: {
      creative: {},
      inspiration: {},
      applyHistory: [],
      ui: {}
    }
  });

  assert.equal(dashboard.page, "design");
  assert.equal(dashboard.status, "idle");
  assert.equal(dashboard.readiness.ok, false);
  assert.match(dashboard.validationIssues[0].code, /no_design_state/);
});

test("design dashboard state summarizes active designer state", () => {
  const dashboard = buildDesignDashboardState({
    state: {
      creative: {
        runtime: {
          source: "cloud_normalized",
          status: "ok",
          summary: "Warm welcoming kickoff with a focal chorus reveal.",
          assistantMessage: "I’m keeping the early sections calm and letting the chorus open up."
        },
        brief: {
          artifactId: "brief-123",
          summary: "Warm, welcoming, and a little magical.",
          goalsSummary: "Keep the early read gentle, then open the chorus with warmth and wonder.",
          sections: ["Intro", "Chorus 1"],
          hypotheses: ["Snowman should feel like a lead anchor."]
        },
        proposalBundle: {
          artifactId: "proposal-123",
          proposalLines: ["Chorus 1 / Snowman / warm focal lift"],
          executionPlan: {
            passScope: "whole_sequence",
            sectionCount: 1,
            targetCount: 1,
            sectionPlans: [
              {
                designId: "DES-001",
                section: "Chorus 1",
                intentSummary: "Warm focal lift on Snowman with a supporting glow.",
                targetIds: ["Snowman"]
              }
            ],
            effectPlacements: [
              {
                designId: "DES-001",
                effectName: "Color Wash",
                layerIndex: 0,
                paletteIntent: { colors: ["#ffcc88", "#fff3d1"] }
              },
              {
                designId: "DES-001",
                effectName: "Shimmer",
                layerIndex: 1,
                paletteIntent: { colors: ["#ffcc88"] }
              }
            ]
          },
          assumptions: ["Use the current track structure as the working timing guide."],
          guidedQuestions: [],
          traceability: {
            designSceneSignals: {
              focalCandidates: ["Snowman"],
              broadCoverageDomains: ["SpiralTrees"]
            },
            musicDesignSignals: {
              revealMoments: ["Chorus 1"],
              holdMoments: ["Intro"]
            }
          }
        },
        references: [{ name: "Reference-1.jpg" }]
      },
      inspiration: {
        paletteSwatches: ["#ffcc88", "#fff3d1"]
      },
      applyHistory: [],
      ui: {}
    }
  });

  assert.equal(dashboard.status, "active");
  assert.equal(dashboard.readiness.ok, true);
  assert.equal(dashboard.data.sourceLabel, "Cloud Designer");
  assert.equal(dashboard.data.focus.focal[0], "Snowman");
  assert.equal(dashboard.data.musicCues.reveals[0], "Chorus 1");
  assert.equal(dashboard.data.references.count, 1);
  assert.equal(dashboard.data.palette.count, 2);
  assert.equal(dashboard.data.executionPlan.designConceptCount, 1);
  assert.equal(dashboard.data.executionPlan.effectPlacementCount, 2);
  assert.equal(dashboard.data.executionPlan.conceptRows[0].designId, "DES-001");
  assert.equal(dashboard.data.executionPlan.conceptRows[0].designLabel, "D1.0");
  assert.equal(dashboard.data.executionPlan.conceptRows[0].anchor, "Chorus 1");
  assert.equal(dashboard.data.executionPlan.conceptRows[0].placementCount, 2);
  assert.deepEqual(dashboard.data.executionPlan.conceptRows[0].palette.colors, ["#ffcc88", "#fff3d1"]);
});

test("design dashboard state reports needs input when designer has open questions", () => {
  const dashboard = buildDesignDashboardState({
    state: {
      creative: {
        runtime: {
          source: "local_runtime",
          status: "ok",
          summary: "Need one decision before refining."
        },
        proposalBundle: {
          guidedQuestions: ["Which chorus should lead the first big reveal?"]
        }
      },
      inspiration: {},
      applyHistory: [],
      ui: {}
    }
  });

  assert.equal(dashboard.status, "needs_input");
  assert.equal(dashboard.readiness.level, "partial");
  assert.match(dashboard.validationIssues[0].code, /designer_needs_input/);
});

test("design dashboard state carries last applied snapshot when available", () => {
  const dashboard = buildDesignDashboardState({
    state: {
      creative: {},
      inspiration: {},
      applyHistory: [{ historyEntryId: "history-1", summary: "Applied design" }],
      ui: {
        reviewHistorySnapshot: {
          historyEntryId: "history-1",
          creativeBrief: { summary: "Applied brief" },
          proposalBundle: { proposalLines: ["Applied proposal line"] },
          analysisArtifact: { trackIdentity: { title: "Song" } },
          designSceneContext: { layoutMode: "2d" }
        }
      }
    }
  });

  assert.ok(dashboard.data.lastAppliedSnapshot);
  assert.equal(dashboard.data.lastAppliedSnapshot.briefSummary, "Applied brief");
  assert.equal(dashboard.data.lastAppliedSnapshot.proposalLines[0], "Applied proposal line");
  assert.equal(dashboard.data.lastAppliedSnapshot.audioTitle, "Song");
});

test("design dashboard state falls back to intent handoff execution strategy when proposal bundle lacks one", () => {
  const dashboard = buildDesignDashboardState({
    state: {
      creative: {
        intentHandoff: {
          executionStrategy: {
            passScope: "whole_sequence",
            sectionCount: 1,
            targetCount: 1,
            sectionPlans: [
              {
                designId: "DES-001",
                designAuthor: "designer",
                section: "Chorus 1",
                intentSummary: "Warm focal chorus concept.",
                targetIds: ["Snowman"]
              }
            ],
            effectPlacements: [
              {
                designId: "DES-001",
                effectName: "Color Wash",
                layerIndex: 0,
                paletteIntent: { colors: ["#ffcc88"] }
              }
            ]
          }
        },
        proposalBundle: {
          artifactId: "proposal-456",
          proposalLines: ["Chorus 1 / Snowman / warm focal lift"]
        }
      },
      inspiration: {},
      applyHistory: [],
      ui: {}
    }
  });

  assert.equal(dashboard.data.executionPlan.designConceptCount, 1);
  assert.equal(dashboard.data.executionPlan.conceptRows[0].designId, "DES-001");
  assert.equal(dashboard.data.executionPlan.conceptRows[0].designLabel, "D1.0");
});

test("design dashboard sorts concepts numerically and reports superseded revision counts", () => {
  const dashboard = buildDesignDashboardState({
    state: {
      creative: {
        supersededConcepts: [
          { designId: "DES-002", designRevision: 0 }
        ],
        proposalBundle: {
          executionPlan: {
            sectionPlans: [
              { designId: "DES-010", designRevision: 0, designAuthor: "designer", section: "Bridge", intentSummary: "Bridge concept.", targetIds: ["Tree"] },
              { designId: "DES-002", designRevision: 1, designAuthor: "designer", section: "Chorus 1", intentSummary: "Chorus concept.", targetIds: ["Snowman"] }
            ],
            effectPlacements: [
              { designId: "DES-010", effectName: "Bars", layerIndex: 0, paletteIntent: { colors: ["#ffffff"] } },
              { designId: "DES-002", effectName: "Color Wash", layerIndex: 0, paletteIntent: { colors: ["#ffcc88"] } }
            ]
          }
        }
      },
      inspiration: {},
      applyHistory: [],
      ui: {}
    }
  });

  assert.deepEqual(dashboard.data.executionPlan.conceptRows.map((row) => row.designLabel), ["D2.1", "D10.0"]);
  assert.equal(dashboard.data.executionPlan.conceptRows[0].supersededRevisionCount, 1);
  assert.equal(dashboard.data.executionPlan.conceptRows[0].revisionState, "current");
  assert.equal(dashboard.data.executionPlan.supersededConceptCount, 1);
});
