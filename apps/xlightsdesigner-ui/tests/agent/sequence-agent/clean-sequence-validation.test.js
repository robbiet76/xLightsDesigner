import test from "node:test";
import assert from "node:assert/strict";

import { validateDirectSequencePromptState } from "../../../agent/sequence-agent/clean-sequence-validation.js";
import { buildXLightsSequenceState, buildXLightsTimingState } from "../../../agent/xlights-state/live-sequence-state.js";
import { buildXLightsEffectOccupancyState } from "../../../agent/xlights-state/live-effect-occupancy-state.js";

test("clean-sequence validation passes when page-state and xlights state align", () => {
  const result = validateDirectSequencePromptState({
    expected: {
      sequenceName: "Validation-Clean-Phase1.xsq",
      target: "Snowman",
      section: "Chorus 1",
      effectName: "Color Wash"
    },
    pageStates: {
      project: {
        contract: "project_dashboard_state_v1",
        data: { sequenceContext: { activeSequence: "Validation-Clean-Phase1.xsq" } }
      },
      sequence: {
        contract: "sequence_dashboard_state_v1",
        data: {
          rows: [{ target: "Snowman", section: "Chorus 1", summary: "add Color Wash with warm amber glow" }],
          timingDependency: { needsTiming: true, ready: true }
        }
      },
      review: {
        contract: "review_dashboard_state_v1",
        data: { rows: [{ idx: 0, line: "Chorus 1 / Snowman / add Color Wash" }] }
      }
    },
    xlightsSequenceState: buildXLightsSequenceState({
      openSequence: { file: "/show/Validation-Clean-Phase1.xsq" },
      revision: "rev-1",
      timingState: buildXLightsTimingState({ tracks: [{ name: "XD: Song Structure", markCount: 8 }] })
    }),
    xlightsEffectOccupancyState: buildXLightsEffectOccupancyState({
      queries: [{ modelName: "Snowman", layerIndex: 0, startMs: 0, endMs: 1000, effectName: "Color Wash" }],
      effectsByQuery: {
        "Snowman|0|0|1000|Color Wash": [{ modelName: "Snowman", layerIndex: 0, startMs: 0, endMs: 1000, effectName: "Color Wash" }]
      }
    }),
    handoffs: {
      planHandoff: {
        metadata: {
          trainingKnowledge: {
            artifactType: "sequencer_stage1_training_bundle",
            artifactVersion: "1.0"
          },
          sequencingDesignHandoff: {
            designSummary: "Snowman chorus focus",
            scope: { sections: ["Chorus 1"] },
            focusPlan: { primaryTargetIds: ["Snowman"] },
            sectionDirectives: [
              { sectionName: "Chorus 1", preferredVisualFamilies: ["static_fill"] }
            ]
          }
        }
      }
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.issues.length, 0);
  assert.equal(result.designContext.designSummary, "Snowman chorus focus");
  assert.equal(result.designContext.trainingKnowledge.artifactType, "sequencer_stage1_training_bundle");
});

test("clean-sequence validation treats draft-stage timing planning as sufficient before apply", () => {
  const result = validateDirectSequencePromptState({
    expected: {
      sequenceName: "Validation-Clean-Phase1.xsq",
      target: "Snowman",
      section: "Chorus 1",
      effectName: "Color Wash"
    },
    pageStates: {
      project: {
        contract: "project_dashboard_state_v1",
        data: { sequenceContext: { activeSequence: "Validation-Clean-Phase1" } }
      },
      sequence: {
        contract: "sequence_dashboard_state_v1",
        data: {
          rows: [{ target: "Snowman", section: "Chorus 1", summary: "apply Color Wash effect for the requested duration using the current target timing" }],
          timingDependency: { needsTiming: true, ready: true, planned: true }
        }
      },
      review: {
        contract: "review_dashboard_state_v1",
        data: { rows: [{ idx: 0, line: "Chorus 1 / Snowman / apply Color Wash effect for the requested duration using the current target timing" }] }
      }
    },
    xlightsSequenceState: buildXLightsSequenceState({
      openSequence: { file: "/show/Validation-Clean-Phase1.xsq" },
      revision: "rev-1",
      timingState: buildXLightsTimingState({ tracks: [{ name: "New Timing", markCount: 8 }] })
    }),
    xlightsEffectOccupancyState: buildXLightsEffectOccupancyState({
      queries: [{ modelName: "Snowman", layerIndex: 0, startMs: 0, endMs: 1000, effectName: "Color Wash" }],
      effectsByQuery: { "Snowman|0|0|1000|Color Wash": [] }
    })
  });

  assert.equal(result.ok, true);
  assert.equal(result.issues.length, 0);
});

test("clean-sequence validation surfaces missing timing track during draft validation", () => {
  const result = validateDirectSequencePromptState({
    expected: {
      sequenceName: "Validation-Clean-Phase1.xsq",
      target: "Snowman",
      section: "Chorus 1",
      effectName: "Color Wash"
    },
    pageStates: {
      project: {
        contract: "project_dashboard_state_v1",
        data: { sequenceContext: { activeSequence: "Validation-Clean-Phase1.xsq" } }
      },
      sequence: {
        contract: "sequence_dashboard_state_v1",
        data: {
          rows: [{ target: "Snowman", section: "Chorus 1", summary: "add Color Wash" }],
          timingDependency: { needsTiming: true, ready: false }
        }
      },
      review: {
        contract: "review_dashboard_state_v1",
        data: { rows: [{ idx: 0, line: "Chorus 1 / Snowman / add Color Wash" }] }
      }
    },
    xlightsSequenceState: buildXLightsSequenceState({
      openSequence: { file: "/show/Validation-Clean-Phase1.xsq" },
      revision: "rev-1",
      timingState: buildXLightsTimingState({ tracks: [{ name: "Beats", markCount: 8 }] })
    }),
    xlightsEffectOccupancyState: buildXLightsEffectOccupancyState({
      queries: [{ modelName: "Snowman", layerIndex: 0, startMs: 0, endMs: 1000, effectName: "Color Wash" }],
      effectsByQuery: { "Snowman|0|0|1000|Color Wash": [] }
    })
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.issues.map((issue) => issue.code), ["missing_required_timing_track"]);
});

test("clean-sequence validation flags expected target outside primary focus set", () => {
  const result = validateDirectSequencePromptState({
    expected: {
      sequenceName: "Validation-Clean-Phase1.xsq",
      target: "Snowman",
      section: "Chorus 1",
      effectName: "Color Wash"
    },
    pageStates: {
      project: {
        contract: "project_dashboard_state_v1",
        data: { sequenceContext: { activeSequence: "Validation-Clean-Phase1.xsq" } }
      },
      sequence: {
        contract: "sequence_dashboard_state_v1",
        data: {
          rows: [{ target: "Snowman", section: "Chorus 1", summary: "add Color Wash" }],
          timingDependency: { needsTiming: false, ready: true }
        }
      },
      review: {
        contract: "review_dashboard_state_v1",
        data: { rows: [{ idx: 0, line: "Chorus 1 / Snowman / add Color Wash" }] }
      }
    },
    handoffs: {
      planHandoff: {
        metadata: {
          sequencingDesignHandoff: {
            designSummary: "Tree-led chorus",
            scope: { sections: ["Chorus 1"] },
            focusPlan: { primaryTargetIds: ["MegaTree"] },
            sectionDirectives: [
              { sectionName: "Chorus 1", preferredVisualFamilies: ["spiral_flow"] }
            ]
          }
        }
      }
    }
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.issues.map((issue) => issue.code), ["target_not_in_primary_focus"]);
});
