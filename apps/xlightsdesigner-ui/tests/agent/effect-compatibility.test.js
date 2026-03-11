import test from "node:test";
import assert from "node:assert/strict";

import { evaluateEffectCommandCompatibility } from "../../agent/effect-compatibility.js";
import { buildEffectDefinitionCatalog } from "../../agent/effect-definition-catalog.js";

function sampleCatalog() {
  return buildEffectDefinitionCatalog([
    {
      effectName: "Bars",
      params: [
        { name: "E_SPEED", type: "int", min: 0, max: 10 },
        { name: "E_MODE", type: "enum", enumValues: ["A", "B"] }
      ]
    }
  ]);
}

test("effect compatibility skips when catalog unavailable", () => {
  const out = evaluateEffectCommandCompatibility({
    commands: [{ cmd: "effects.create", params: { effectName: "Bars" } }],
    effectCatalog: null
  });
  assert.equal(out.ok, true);
  assert.equal(out.skipped, true);
});

test("effect compatibility rejects unknown effect names", () => {
  const out = evaluateEffectCommandCompatibility({
    commands: [{ cmd: "effects.create", params: { effectName: "Nope" } }],
    effectCatalog: sampleCatalog()
  });
  assert.equal(out.ok, false);
  assert.ok(out.errors.some((e) => /unknown effectname/i.test(String(e))));
});

test("effect compatibility emits warnings for out-of-schema settings", () => {
  const out = evaluateEffectCommandCompatibility({
    commands: [{
      cmd: "effects.create",
      params: {
        effectName: "Bars",
        settings: {
          E_SPEED: 42,
          E_MODE: "Z",
          E_UNKNOWN: true
        }
      }
    }],
    effectCatalog: sampleCatalog()
  });
  assert.equal(out.ok, true);
  assert.ok(out.warnings.some((w) => /above max/i.test(String(w))));
  assert.ok(out.warnings.some((w) => /enum value out of range/i.test(String(w))));
  assert.ok(out.warnings.some((w) => /unknown settings key/i.test(String(w))));
});

test("effect compatibility accepts shared xlights timing and blend settings", () => {
  const out = evaluateEffectCommandCompatibility({
    commands: [{
      cmd: "effects.create",
      params: {
        effectName: "Bars",
        settings: {
          T_CHOICE_LayerMethod: "Additive",
          T_SLIDER_EffectLayerMix: 80,
          T_CHOICE_In_Transition_Type: "Fade",
          T_SLIDER_In_Transition_Adjust: 50,
          T_CHECKBOX_Out_Transition_Reverse: true,
          C_SLIDER_Brightness: 125
        }
      }
    }],
    effectCatalog: sampleCatalog()
  });
  assert.equal(out.ok, true);
  assert.equal(out.warnings.length, 0);
});
