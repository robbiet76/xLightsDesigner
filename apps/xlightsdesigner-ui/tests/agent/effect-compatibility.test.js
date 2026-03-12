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
    },
    {
      effectName: "Pictures",
      params: [
        { name: "E_TEXTCTRL_Pictures_Filename", type: "file", required: true }
      ]
    },
    {
      effectName: "Video",
      params: [
        { name: "E_FILEPICKERCTRL_Video_Filename", type: "file", required: true }
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

test("effect compatibility accepts common corpus-backed buffer settings", () => {
  const out = evaluateEffectCommandCompatibility({
    commands: [{
      cmd: "effects.create",
      params: {
        effectName: "Bars",
        settings: {
          B_CHOICE_BufferStyle: "Per Preview",
          B_CHOICE_BufferTransform: "Flip Horizontal",
          B_CHOICE_PerPreviewCamera: "2D",
          B_CUSTOM_SubBuffer: "0.00x50.00x100.00x100.00x0.00x0.00",
          B_SLIDER_ZoomQuality: 2,
          B_VALUECURVE_Rotation: "Active=TRUE|Id=ID_VALUECURVE_Rotation|Type=Ramp|Min=0.00|Max=100.00|P2=100.00|RV=TRUE|"
        }
      }
    }],
    effectCatalog: sampleCatalog()
  });
  assert.equal(out.ok, true);
  assert.equal(out.warnings.length, 0);
});

test("effect compatibility accepts rare but documented transitions and layer methods", () => {
  const out = evaluateEffectCommandCompatibility({
    commands: [{
      cmd: "effects.create",
      params: {
        effectName: "Bars",
        settings: {
          T_CHOICE_LayerMethod: "Additive",
          T_CHOICE_In_Transition_Type: "Doorway",
          T_CHOICE_Out_Transition_Type: "Slide Bars"
        }
      }
    }],
    effectCatalog: sampleCatalog()
  });
  assert.equal(out.ok, true);
  assert.equal(out.warnings.length, 0);
});

test("effect compatibility warns when expanding from non-default group render targets", () => {
  const out = evaluateEffectCommandCompatibility({
    commands: [{
      cmd: "effects.create",
      params: {
        effectName: "Bars",
        sourceGroupId: "Frontline",
        sourceGroupRenderPolicy: "per_model",
        sourceGroupBufferStyle: "Horizontal Per Model",
        settings: {}
      }
    }],
    effectCatalog: sampleCatalog()
  });
  assert.equal(out.ok, true);
  assert.ok(out.warnings.some((w) => /Expanded member-level effect from non-default group render target Frontline \(Horizontal Per Model\)/i.test(String(w))));
});

test("effect compatibility warns more strongly when expanding from high-risk group render targets", () => {
  const out = evaluateEffectCommandCompatibility({
    commands: [{
      cmd: "effects.create",
      params: {
        effectName: "Bars",
        sourceGroupId: "NestedFrontline",
        sourceGroupRenderPolicy: "overlay",
        sourceGroupBufferStyle: "Overlay - Centered",
        settings: {}
      }
    }],
    effectCatalog: sampleCatalog()
  });
  assert.equal(out.ok, true);
  assert.ok(out.warnings.some((w) => /high-risk group render target NestedFrontline \(Overlay - Centered\)/i.test(String(w))));
});

test("effect compatibility accepts designer-provided picture file paths", () => {
  const out = evaluateEffectCommandCompatibility({
    commands: [{
      cmd: "effects.create",
      params: {
        effectName: "Pictures",
        settings: {
          E_TEXTCTRL_Pictures_Filename: "/Users/robterry/Documents/Lights/assets/snowflake.png"
        }
      }
    }],
    effectCatalog: sampleCatalog()
  });
  assert.equal(out.ok, true);
  assert.equal(out.warnings.length, 0);
});

test("effect compatibility accepts designer-provided video file paths", () => {
  const out = evaluateEffectCommandCompatibility({
    commands: [{
      cmd: "effects.create",
      params: {
        effectName: "Video",
        settings: {
          E_FILEPICKERCTRL_Video_Filename: "/Users/robterry/Documents/Lights/assets/intro.mp4"
        }
      }
    }],
    effectCatalog: sampleCatalog()
  });
  assert.equal(out.ok, true);
  assert.equal(out.warnings.length, 0);
});
