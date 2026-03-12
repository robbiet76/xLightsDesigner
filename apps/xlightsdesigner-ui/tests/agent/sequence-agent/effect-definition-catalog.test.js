import test from "node:test";
import assert from "node:assert/strict";

import { buildEffectDefinitionCatalog, emptyEffectDefinitionCatalog } from "../../../agent/sequence-agent/effect-definition-catalog.js";

test("buildEffectDefinitionCatalog normalizes definitions and params", () => {
  const out = buildEffectDefinitionCatalog([
    {
      effectName: "Bars",
      effectId: 7,
      category: "General",
      supportsPartialTimeInterval: true,
      params: [
        { name: "E_SLIDER_Bars", type: "int", min: 0, max: 100, default: 50 },
        { name: "E_CHOICE_Mode", type: "enum", enumValues: ["A", "B"], default: "A" }
      ]
    }
  ]);
  assert.equal(out.loaded, true);
  assert.equal(out.definitionCount, 1);
  assert.equal(out.byName.Bars.effectId, 7);
  assert.equal(out.byName.Bars.category, "general");
  assert.equal(out.byName.Bars.paramIndex.E_SLIDER_Bars.type, "int");
  assert.deepEqual(out.byName.Bars.paramIndex.E_CHOICE_Mode.enumValues, ["A", "B"]);
});

test("emptyEffectDefinitionCatalog returns unloaded baseline shape", () => {
  const out = emptyEffectDefinitionCatalog("not supported");
  assert.equal(out.loaded, false);
  assert.equal(out.definitionCount, 0);
  assert.equal(out.error, "not supported");
});
