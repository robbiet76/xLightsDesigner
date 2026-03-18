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

  const meteors = getEffectIntentCapability("Meteors");
  assert.equal(meteors.family, "particle_motion");
  assert.ok(meteors.supportedSettingsIntent.includes("direction"));
  assert.ok(meteors.supportedSettingsIntent.includes("thickness"));

  const spirals = getEffectIntentCapability("Spirals");
  assert.equal(spirals.family, "motion_texture");
  assert.ok(spirals.supportedSettingsIntent.includes("thickness"));

  const vuMeter = getEffectIntentCapability("VU Meter");
  assert.equal(vuMeter.family, "audio_reactive");
  assert.ok(vuMeter.supportedSettingsIntent.includes("density"));

  const singleStrand = getEffectIntentCapability("SingleStrand");
  assert.equal(singleStrand.family, "strand_pattern");
  assert.ok(singleStrand.supportedSettingsIntent.includes("direction"));
  assert.ok(singleStrand.supportedSettingsIntent.includes("thickness"));

  const listed = listEffectIntentCapabilities().map((row) => row.effectName);
  assert.ok(listed.includes("Color Wash"));
  assert.ok(listed.includes("Shimmer"));
  assert.ok(listed.includes("Bars"));
  assert.ok(listed.includes("On"));
  assert.ok(listed.includes("Butterfly"));
  assert.ok(listed.includes("Circles"));
  assert.ok(listed.includes("Curtain"));
  assert.ok(listed.includes("Fan"));
  assert.ok(listed.includes("Fire"));
  assert.ok(listed.includes("Morph"));
  assert.ok(listed.includes("Meteors"));
  assert.ok(listed.includes("Pinwheel"));
  assert.ok(listed.includes("SingleStrand"));
  assert.ok(listed.includes("Snowflakes"));
  assert.ok(listed.includes("Spirals"));
  assert.ok(listed.includes("VU Meter"));
});
