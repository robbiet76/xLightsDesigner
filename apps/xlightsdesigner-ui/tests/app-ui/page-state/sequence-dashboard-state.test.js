import test from "node:test";
import assert from "node:assert/strict";

import { buildSequenceDashboardState } from "../../../app-ui/page-state/sequence-dashboard-state.js";

test("sequence dashboard state reports blocked when no draft exists", () => {
  const dashboard = buildSequenceDashboardState({
    state: {
      proposed: [],
      agentPlan: null,
      creative: {},
      timingTracks: []
    },
    intentHandoff: null,
    planHandoff: null
  });

  assert.equal(dashboard.page, "sequence");
  assert.equal(dashboard.status, "idle");
  assert.equal(dashboard.readiness.ok, false);
  assert.match(dashboard.validationIssues[0].code, /no_sequence_draft/);
});

test("sequence dashboard state exposes direct technical draft rows", () => {
  const dashboard = buildSequenceDashboardState({
    state: {
      activeSequence: "Validation-Clean-Phase1.xsq",
      proposed: [
        "Chorus 1 / Snowman / add Color Wash with warm amber glow"
      ],
      agentPlan: {
        summary: "Single direct sequencing draft.",
        warnings: []
      },
      creative: {},
      timingTracks: [{ name: "XD: Song Structure" }]
    },
    intentHandoff: {
      artifactId: "intent-123",
      scope: {
        sections: ["Chorus 1"],
        targetIds: ["Snowman"]
      }
    },
    planHandoff: {
      artifactId: "plan-123",
      commands: [{ type: "addEffect" }]
    }
  });

  assert.equal(dashboard.status, "ready");
  assert.equal(dashboard.readiness.ok, true);
  assert.equal(dashboard.data.rows.length, 1);
  assert.equal(dashboard.data.rows[0].section, "Chorus 1");
  assert.equal(dashboard.data.rows[0].target, "Snowman");
  assert.equal(dashboard.data.rows[0].timing, "XD: Song Structure");
  assert.equal(dashboard.data.commandCount, 1);
});

test("sequence dashboard state surfaces missing timing dependency", () => {
  const dashboard = buildSequenceDashboardState({
    state: {
      proposed: [
        "Chorus 1 / Snowman / add Color Wash with warm amber glow"
      ],
      agentPlan: {
        summary: "Draft exists but timing is not ready.",
        warnings: ["No section timing track found."]
      },
      creative: {},
      timingTracks: [{ name: "Beat Track" }]
    },
    intentHandoff: {
      scope: {
        sections: ["Chorus 1"],
        targetIds: ["Snowman"]
      }
    },
    planHandoff: {
      commands: [{ type: "addEffect" }]
    }
  });

  assert.equal(dashboard.status, "partial");
  assert.equal(dashboard.readiness.ok, false);
  assert.equal(dashboard.data.timingDependency.ready, false);
  assert.match(dashboard.validationIssues[0].code, /missing_required_timing_track/);
});
