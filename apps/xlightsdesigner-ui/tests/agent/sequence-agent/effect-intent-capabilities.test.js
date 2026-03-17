import test from "node:test";
import assert from "node:assert/strict";

import { getEffectIntentCapability, listEffectIntentCapabilities } from "../../../agent/sequence-agent/effect-intent-capabilities.js";

test("effect intent capabilities expose the supported high-value effect families", () => {
  const bars = getEffectIntentCapability("Bars");
  assert.equal(bars.family, "rhythmic");
  assert.ok(bars.supportedSettingsIntent.includes("direction"));
  assert.ok(bars.supportedSettingsIntent.includes("thickness"));

  const shimmer = getEffectIntentCapability("Shimmer");
  assert.equal(shimmer.family, "sparkle");
  assert.ok(shimmer.supportedSettingsIntent.includes("density"));

  const colorWash = getEffectIntentCapability("Color Wash");
  assert.equal(colorWash.family, "wash");
  assert.ok(colorWash.supportedPaletteIntent.includes("brightness"));

  const listed = listEffectIntentCapabilities().map((row) => row.effectName);
  assert.ok(listed.includes("Color Wash"));
  assert.ok(listed.includes("Shimmer"));
  assert.ok(listed.includes("Bars"));
  assert.ok(listed.includes("On"));
});
