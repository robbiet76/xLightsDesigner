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
        "Wrong prose line / Wrong target / wrong summary"
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
      commands: [
        { cmd: "timing.createTrack", params: { trackName: "XD: Song Structure" } },
        { cmd: "timing.insertMarks", params: { trackName: "XD: Song Structure", marks: [{ startMs: 0, endMs: 1000, label: "Chorus 1" }] } },
        {
          designId: "DES-001",
          cmd: "effects.create",
          anchor: { trackName: "XD: Song Structure", markLabel: "Chorus 1", startMs: 0, endMs: 1000 },
          params: {
            modelName: "Snowman",
            effectName: "Color Wash",
            startMs: 0,
            endMs: 1000,
            layerIndex: 0
          }
        }
      ]
    }
  });

  assert.equal(dashboard.status, "ready");
  assert.equal(dashboard.readiness.ok, true);
  assert.equal(dashboard.data.rows.length, 1);
  assert.equal(dashboard.data.rows[0].section, "Chorus 1");
  assert.equal(dashboard.data.rows[0].target, "Snowman");
  assert.equal(dashboard.data.rows[0].designId, "DES-001");
  assert.equal(dashboard.data.rows[0].designLabel, "D1.0");
  assert.equal(dashboard.data.rows[0].timing, "XD: Song Structure");
  assert.equal(dashboard.data.rows[0].summary, "Color Wash");
  assert.equal(dashboard.data.commandCount, 3);
});

test("sequence dashboard aggregates multiple effects on the same target into one row", () => {
  const dashboard = buildSequenceDashboardState({
    state: {
      activeSequence: "Validation-Clean-Phase1.xsq",
      proposed: [
        "Wrong prose line / Wrong target / wrong summary"
      ],
      agentPlan: {
        summary: "Stacked technical sequencing draft.",
        warnings: []
      },
      creative: {},
      timingTracks: [{ name: "XD: Song Structure" }]
    },
    intentHandoff: {
      artifactId: "intent-aggregate",
      scope: {
        sections: ["Chorus 1"],
        targetIds: ["Snowman"]
      }
    },
    planHandoff: {
      artifactId: "plan-aggregate",
      commands: [
        { cmd: "timing.createTrack", params: { trackName: "XD: Song Structure" } },
        { cmd: "timing.insertMarks", params: { trackName: "XD: Song Structure", marks: [{ startMs: 0, endMs: 1000, label: "Chorus 1" }] } },
        {
          designId: "DES-001",
          cmd: "effects.create",
          anchor: { trackName: "XD: Song Structure", markLabel: "Chorus 1", startMs: 0, endMs: 1000 },
          params: {
            modelName: "Snowman",
            effectName: "Color Wash",
            startMs: 0,
            endMs: 1000,
            layerIndex: 0
          }
        },
        {
          designId: "DES-001",
          cmd: "effects.create",
          anchor: { trackName: "XD: Song Structure", markLabel: "Chorus 1", startMs: 0, endMs: 1000 },
          params: {
            modelName: "Snowman",
            effectName: "Shimmer",
            startMs: 0,
            endMs: 1000,
            layerIndex: 1
          }
        }
      ]
    }
  });

  assert.equal(dashboard.data.rows.length, 1);
  assert.equal(dashboard.data.rows[0].section, "Chorus 1");
  assert.equal(dashboard.data.rows[0].target, "Snowman");
  assert.equal(dashboard.data.rows[0].designId, "DES-001");
  assert.equal(dashboard.data.rows[0].designLabel, "D1.0");
  assert.equal(dashboard.data.rows[0].summary, "Color Wash, Shimmer");
  assert.equal(dashboard.data.rows[0].effects, 2);
});

test("sequence dashboard keeps separate rows for different design ids on the same target and section", () => {
  const dashboard = buildSequenceDashboardState({
    state: {
      activeSequence: "Validation-Clean-Phase1.xsq",
      proposed: [],
      agentPlan: {
        summary: "Concept-linked sequencing draft.",
        warnings: []
      },
      creative: {},
      timingTracks: [{ name: "XD: Song Structure" }]
    },
    intentHandoff: {
      artifactId: "intent-design-split",
      scope: {
        sections: ["Chorus 1"],
        targetIds: ["Snowman"]
      }
    },
    planHandoff: {
      artifactId: "plan-design-split",
      commands: [
        { cmd: "timing.createTrack", params: { trackName: "XD: Song Structure" } },
        { cmd: "timing.insertMarks", params: { trackName: "XD: Song Structure", marks: [{ startMs: 0, endMs: 1000, label: "Chorus 1" }] } },
        {
          designId: "DES-001",
          cmd: "effects.create",
          anchor: { trackName: "XD: Song Structure", markLabel: "Chorus 1", startMs: 0, endMs: 500 },
          params: {
            modelName: "Snowman",
            effectName: "Color Wash",
            startMs: 0,
            endMs: 500,
            layerIndex: 0
          }
        },
        {
          designId: "DES-002",
          cmd: "effects.create",
          anchor: { trackName: "XD: Song Structure", markLabel: "Chorus 1", startMs: 500, endMs: 1000 },
          params: {
            modelName: "Snowman",
            effectName: "Shimmer",
            startMs: 500,
            endMs: 1000,
            layerIndex: 1
          }
        }
      ]
    }
  });

  assert.equal(dashboard.data.rows.length, 2);
  assert.deepEqual(dashboard.data.rows.map((row) => row.designId), ["DES-001", "DES-002"]);
  assert.deepEqual(dashboard.data.rows.map((row) => row.designLabel), ["D1.0", "D2.0"]);
});

test("sequence dashboard counts duplicate same-type placements as separate effects", () => {
  const dashboard = buildSequenceDashboardState({
    state: {
      activeSequence: "Validation-Clean-Phase1.xsq",
      proposed: [],
      agentPlan: {
        summary: "Stacked duplicate placements.",
        warnings: []
      },
      creative: {},
      timingTracks: [{ name: "XD: Song Structure" }]
    },
    intentHandoff: {
      artifactId: "intent-duplicate-count",
      scope: {
        sections: ["Chorus 1"],
        targetIds: ["Snowman"]
      }
    },
    planHandoff: {
      artifactId: "plan-duplicate-count",
      commands: [
        { cmd: "timing.createTrack", params: { trackName: "XD: Song Structure" } },
        { cmd: "timing.insertMarks", params: { trackName: "XD: Song Structure", marks: [{ startMs: 0, endMs: 1000, label: "Chorus 1" }] } },
        {
          cmd: "effects.create",
          anchor: { trackName: "XD: Song Structure", markLabel: "Chorus 1", startMs: 0, endMs: 1000 },
          params: {
            modelName: "Snowman",
            effectName: "Color Wash",
            startMs: 0,
            endMs: 1000,
            layerIndex: 0
          }
        },
        {
          cmd: "effects.create",
          anchor: { trackName: "XD: Song Structure", markLabel: "Chorus 1", startMs: 250, endMs: 750 },
          params: {
            modelName: "Snowman",
            effectName: "Color Wash",
            startMs: 250,
            endMs: 750,
            layerIndex: 1
          }
        },
        {
          cmd: "effects.create",
          anchor: { trackName: "XD: Song Structure", markLabel: "Chorus 1", startMs: 0, endMs: 1000 },
          params: {
            modelName: "Snowman",
            effectName: "Shimmer",
            startMs: 0,
            endMs: 1000,
            layerIndex: 2
          }
        }
      ]
    }
  });

  assert.equal(dashboard.data.rows.length, 1);
  assert.equal(dashboard.data.rows[0].section, "Chorus 1");
  assert.equal(dashboard.data.rows[0].target, "Snowman");
  assert.equal(dashboard.data.rows[0].summary, "Color Wash, Shimmer");
  assert.equal(dashboard.data.rows[0].effects, 3);
});

test("sequence dashboard counts ten same-row placements correctly", () => {
  const start = 78230;
  const end = 97120;
  const span = end - start;
  const slot = Math.floor(span / 10);
  const effectNames = ["Color Wash", "Shimmer", "Bars", "Butterfly", "Meteors", "Pinwheel", "Spirals", "Wave", "Candle", "Morph"];

  const dashboard = buildSequenceDashboardState({
    state: {
      activeSequence: "Validation-Clean-Phase1.xsq",
      proposed: [],
      agentPlan: {
        summary: "Ten effects in one target/section/layer.",
        warnings: []
      },
      creative: {},
      timingTracks: [{ name: "XD: Song Structure" }]
    },
    intentHandoff: {
      artifactId: "intent-ten-count",
      scope: {
        sections: ["Chorus 1"],
        targetIds: ["Snowman"]
      }
    },
    planHandoff: {
      artifactId: "plan-ten-count",
      commands: [
        { cmd: "timing.createTrack", params: { trackName: "XD: Song Structure" } },
        { cmd: "timing.insertMarks", params: { trackName: "XD: Song Structure", marks: [{ startMs: start, endMs: end, label: "Chorus 1" }] } },
        ...effectNames.map((effectName, i) => ({
          cmd: "effects.create",
          anchor: {
            trackName: "XD: Song Structure",
            markLabel: "Chorus 1",
            startMs: start + (i * slot),
            endMs: i === effectNames.length - 1 ? end : start + ((i + 1) * slot)
          },
          params: {
            modelName: "Snowman",
            effectName,
            startMs: start + (i * slot),
            endMs: i === effectNames.length - 1 ? end : start + ((i + 1) * slot),
            layerIndex: 0
          }
        }))
      ]
    }
  });

  assert.equal(dashboard.data.rows.length, 1);
  assert.equal(dashboard.data.rows[0].section, "Chorus 1");
  assert.equal(dashboard.data.rows[0].target, "Snowman");
  assert.equal(dashboard.data.rows[0].summary, "Color Wash, Shimmer +8 more");
  assert.equal(dashboard.data.rows[0].effects, 10);
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

test("sequence dashboard state treats planned structure timing track as ready for draft validation", () => {
  const dashboard = buildSequenceDashboardState({
    state: {
      proposed: [
        "Chorus 1 / Snowman / apply Color Wash effect for the requested duration using the current target timing"
      ],
      agentPlan: {
        summary: "Draft exists and plans a structure track.",
        warnings: []
      },
      creative: {},
      timingTracks: [{ name: "New Timing" }]
    },
    intentHandoff: {
      scope: {
        sections: ["Chorus 1"],
        targetIds: ["Snowman"]
      }
    },
    planHandoff: {
      commands: [
        { cmd: "timing.createTrack", params: { trackName: "XD: Song Structure" } },
        { cmd: "timing.insertMarks", params: { trackName: "XD: Song Structure", marks: [{ startMs: 1, endMs: 2, label: "Chorus 1" }] } }
      ]
    }
  });

  assert.equal(dashboard.status, "ready");
  assert.equal(dashboard.readiness.ok, true);
  assert.equal(dashboard.data.timingDependency.ready, true);
  assert.equal(dashboard.data.timingDependency.planned, true);
});

test("sequence dashboard rows come from structured effect commands for broad whole-sequence plans", () => {
  const dashboard = buildSequenceDashboardState({
    state: {
      activeSequence: "WholePass.xsq",
      proposed: [
        "Section 1 / General / keep the pass restrained with warm cinematic color and glow control",
        "Section 2 / General / build stronger visual payoff with warm cinematic color and glow control"
      ],
      agentPlan: {
        summary: "Broad cinematic pass.",
        warnings: []
      },
      creative: {},
      timingTracks: [{ name: "XD: Song Structure" }],
      sceneGraph: {
        groupsById: { AllModels: { id: "AllModels" } },
        modelsById: { Snowman: { id: "Snowman" } }
      }
    },
    intentHandoff: {
      scope: {
        sections: ["Section 1", "Section 2"],
        targetIds: ["AllModels", "Snowman"]
      }
    },
    planHandoff: {
      artifactId: "plan-whole-pass",
      commands: [
        { cmd: "timing.createTrack", params: { trackName: "XD: Song Structure" } },
        {
          cmd: "timing.insertMarks",
          params: {
            trackName: "XD: Song Structure",
            marks: [
              { startMs: 0, endMs: 10000, label: "Section 1" },
              { startMs: 10000, endMs: 20000, label: "Section 2" }
            ]
          }
        },
        {
          cmd: "effects.create",
          anchor: { trackName: "XD: Song Structure", markLabel: "Section 1", startMs: 0, endMs: 10000 },
          params: {
            modelName: "AllModels",
            effectName: "Color Wash",
            startMs: 0,
            endMs: 10000,
            layerIndex: 0
          }
        },
        {
          cmd: "effects.create",
          anchor: { trackName: "XD: Song Structure", markLabel: "Section 2", startMs: 10000, endMs: 20000 },
          params: {
            modelName: "Snowman",
            effectName: "Shimmer",
            startMs: 10000,
            endMs: 20000,
            layerIndex: 0
          }
        }
      ]
    }
  });

  assert.equal(dashboard.data.rows.length, 2);
  assert.deepEqual(
    dashboard.data.rows.map((row) => ({
      section: row.section,
      target: row.target,
      level: row.level,
      summary: row.summary,
      timing: row.timing
    })),
    [
      {
        section: "Section 1",
        target: "AllModels",
        level: "Group",
        summary: "Color Wash",
        timing: "XD: Song Structure"
      },
      {
        section: "Section 2",
        target: "Snowman",
        level: "Model",
        summary: "Shimmer",
        timing: "XD: Song Structure"
      }
    ]
  );
});

test("sequence dashboard timing-only rows do not mis-map prose into target columns", () => {
  const dashboard = buildSequenceDashboardState({
    state: {
      activeSequence: "WholePass.xsq",
      proposed: [
        "Anchor design changes to brief goal: Create warmth with amber/gold/red palette"
      ],
      agentPlan: {
        summary: "Timing-only broad draft.",
        warnings: []
      },
      creative: {},
      timingTracks: [{ name: "XD: Song Structure" }]
    },
    intentHandoff: {
      scope: {
        sections: ["Section 1", "Section 2"],
        targetIds: []
      }
    },
    planHandoff: {
      artifactId: "plan-timing-only",
      commands: [
        { cmd: "timing.createTrack", params: { trackName: "XD: Song Structure" } },
        {
          cmd: "timing.insertMarks",
          params: {
            trackName: "XD: Song Structure",
            marks: [
              { startMs: 0, endMs: 10000, label: "Section 1" },
              { startMs: 10000, endMs: 20000, label: "Section 2" }
            ]
          }
        }
      ]
    }
  });

  assert.equal(dashboard.data.rows.length, 2);
  assert.deepEqual(
    dashboard.data.rows.map((row) => ({
      section: row.section,
      target: row.target,
      level: row.level,
      summary: row.summary,
      timing: row.timing,
      effects: row.effects
    })),
    [
      {
        section: "Section 1",
        target: "Timing Track",
        level: "Track",
        summary: "Add timing mark",
        timing: "XD: Song Structure",
        effects: 0
      },
      {
        section: "Section 2",
        target: "Timing Track",
        level: "Track",
        summary: "Add timing mark",
        timing: "XD: Song Structure",
        effects: 0
      }
    ]
  );
});
