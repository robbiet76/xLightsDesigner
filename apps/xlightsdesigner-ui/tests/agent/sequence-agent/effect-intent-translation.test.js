import test from "node:test";
import assert from "node:assert/strict";

import { translatePlacementIntentToXlights } from "../../../agent/sequence-agent/effect-intent-translation.js";
import { buildEffectDefinitionCatalog } from "../../../agent/sequence-agent/effect-definition-catalog.js";

function sampleCatalog() {
  return buildEffectDefinitionCatalog([
    {
      effectName: "Bars",
      params: [
        { name: "E_SPEED", type: "int", min: 0, max: 10 },
        { name: "E_THICKNESS", type: "int", min: 0, max: 100 },
        { name: "E_DIRECTION", type: "enum", enumValues: ["Forward", "Reverse"] }
      ]
    },
    {
      effectName: "Shimmer",
      params: [
        { name: "E_SPEED", type: "int", min: 0, max: 10 },
        { name: "E_DENSITY", type: "int", min: 0, max: 10 }
      ]
    }
  ]);
}

test("effect intent translation maps palette, layer, render, and shared settings intent", () => {
  const out = translatePlacementIntentToXlights({
    placement: {
      effectName: "Bars",
      settingsIntent: {
        intensity: "high",
        motion: "rhythmic",
        speed: "medium_fast",
        thickness: "medium",
        direction: "forward"
      },
      paletteIntent: {
        colors: ["amber", "gold"],
        brightness: "medium_high",
        contrast: "high"
      },
      layerIntent: {
        blendRole: "rhythmic_overlay",
        mixAmount: "high"
      },
      renderIntent: {
        bufferStyle: "overlay"
      }
    },
    effectCatalog: sampleCatalog()
  });

  assert.equal(out.settings.C_SLIDER_Brightness, 150);
  assert.equal(out.settings.T_CHOICE_In_Transition_Type, "Slide Bars");
  assert.equal(out.settings.T_CHOICE_Out_Transition_Type, "Slide Bars");
  assert.equal(out.settings.T_CHOICE_LayerMethod, "Additive");
  assert.equal(out.settings.T_SLIDER_EffectLayerMix, 80);
  assert.equal(out.settings.B_CHOICE_BufferStyle, "Overlay - Scaled");
  assert.equal(out.settings.E_SPEED, 7);
  assert.equal(out.settings.E_THICKNESS, 50);
  assert.equal(out.settings.E_DIRECTION, "Forward");
  assert.equal(out.palette.C_BUTTON_Palette1, "#ffbf69");
  assert.equal(out.palette.C_BUTTON_Palette2, "#ffd700");
  assert.equal(out.palette.C_CHECKBOX_Palette1, "1");
  assert.equal(out.palette.C_SLIDER_Contrast, 35);
});

test("effect intent translation normalizes overlay_scaled render intent to xLights buffer style", () => {
  const out = translatePlacementIntentToXlights({
    placement: {
      effectName: "Bars",
      renderIntent: {
        bufferStyle: "overlay_scaled"
      }
    },
    effectCatalog: sampleCatalog()
  });

  assert.equal(out.settings.B_CHOICE_BufferStyle, "Overlay - Scaled");
});

test("effect intent translation preserves explicit raw settings and palette overrides", () => {
  const out = translatePlacementIntentToXlights({
    placement: {
      effectName: "Shimmer",
      settingsIntent: {
        intensity: "medium_high",
        speed: "fast",
        density: "dense"
      },
      paletteIntent: {
        colors: ["warm gold"]
      },
      settings: {
        C_SLIDER_Brightness: 111,
        E_SPEED: 3
      },
      palette: {
        C_BUTTON_Palette1: "#123456"
      }
    },
    effectCatalog: sampleCatalog()
  });

  assert.equal(out.settings.C_SLIDER_Brightness, 111);
  assert.equal(out.settings.E_SPEED, 3);
  assert.equal(out.settings.E_DENSITY, 8);
  assert.equal(out.palette.C_BUTTON_Palette1, "#123456");
});

test("effect intent translation does not map Bars thickness onto bar count controls", () => {
  const catalog = buildEffectDefinitionCatalog([
    {
      effectName: "Bars",
      params: [
        { name: "E_SLIDER_Bars_BarCount", type: "int", min: 0, max: 5 },
        { name: "E_CHOICE_Bars_Direction", type: "enum", enumValues: ["Forward", "Reverse"] }
      ]
    }
  ]);

  const out = translatePlacementIntentToXlights({
    placement: {
      effectName: "Bars",
      settingsIntent: {
        thickness: "thin",
        direction: "forward"
      }
    },
    effectCatalog: catalog
  });

  assert.equal(out.settings.E_CHOICE_Bars_Direction, "Forward");
  assert.equal(Object.prototype.hasOwnProperty.call(out.settings, "E_SLIDER_Bars_BarCount"), false);
});

test("effect intent translation skips enum settings when the requested direction is not in the effect schema", () => {
  const catalog = buildEffectDefinitionCatalog([
    {
      effectName: "Pinwheel",
      params: [
        { name: "E_CHOICE_Pinwheel_Style", type: "enum", enumValues: ["New Render Method", "Old Render Method"] }
      ]
    }
  ]);

  const out = translatePlacementIntentToXlights({
    placement: {
      effectName: "Pinwheel",
      settingsIntent: {
        direction: "forward"
      }
    },
    effectCatalog: catalog
  });

  assert.equal(Object.prototype.hasOwnProperty.call(out.settings, "E_CHOICE_Pinwheel_Style"), false);
});

test("effect intent translation keeps On effect payload minimal for live apply", () => {
  const out = translatePlacementIntentToXlights({
    placement: {
      effectName: "On",
      settingsIntent: {
        intensity: "medium",
        motion: "wash"
      },
      paletteIntent: {
        colors: ["gold", "white"],
        brightness: "medium_high",
        contrast: "high"
      }
    },
    effectCatalog: sampleCatalog()
  });

  assert.deepEqual(out.settings, {});
  assert.deepEqual(out.palette, {});
});
