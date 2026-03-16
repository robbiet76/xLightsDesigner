import test from "node:test";
import assert from "node:assert/strict";

import {
  buildXLightsEffectOccupancyState,
  readXLightsEffectOccupancyState
} from "../../../agent/xlights-state/live-effect-occupancy-state.js";

test("effect occupancy state summarizes matched queries", () => {
  const state = buildXLightsEffectOccupancyState({
    queries: [{ modelName: "Snowman", layerIndex: 0, startMs: 1000, endMs: 2000, effectName: "Color Wash" }],
    effectsByQuery: {
      "Snowman|0|1000|2000|Color Wash": [
        { modelName: "Snowman", layerIndex: 0, startMs: 1000, endMs: 2000, effectName: "Color Wash" }
      ]
    }
  });

  assert.equal(state.contract, "xlights_effect_occupancy_state_v1");
  assert.equal(state.queryCount, 1);
  assert.equal(state.matchedCount, 1);
  assert.equal(state.rows[0].ok, true);
});

test("effect occupancy reader queries xlights listEffects", async () => {
  const state = await readXLightsEffectOccupancyState("http://127.0.0.1:49914/xlDoAutomation", [
    { modelName: "Snowman", layerIndex: 0, startMs: 1000, endMs: 2000, effectName: "Color Wash" }
  ], {
    listEffects: async () => ({
      data: {
        effects: [
          { modelName: "Snowman", layerIndex: 0, startMs: 1000, endMs: 2000, effectName: "Color Wash" }
        ]
      }
    })
  });

  assert.equal(state.rows[0].matched[0].effectName, "Color Wash");
});
