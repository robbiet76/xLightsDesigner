import test from "node:test";
import assert from "node:assert/strict";

import {
  inferLegacyEffectCandidates,
  resolveSummaryFallbackEffect,
  chooseSafeFallbackChain
} from "../../../agent/shared/effect-semantics-registry.js";

test("resolveSummaryFallbackEffect keeps only narrow fallback behavior classes", () => {
  assert.equal(resolveSummaryFallbackEffect("soft shimmer sparkle texture"), "Shimmer");
  assert.equal(resolveSummaryFallbackEffect("clean rhythmic pulse with bars-like motion"), "Bars");
  assert.equal(resolveSummaryFallbackEffect("solid steady hold with minimal movement"), "On");
});

test("resolveSummaryFallbackEffect does not encode cinematic or section-doctrine fallback", () => {
  assert.equal(resolveSummaryFallbackEffect("warm cinematic chorus payoff with glow"), "Color Wash");
  assert.equal(resolveSummaryFallbackEffect("dense bridge with tension"), "Color Wash");
});

test("chooseSafeFallbackChain no longer exposes retired doctrine-specific chains", () => {
  assert.deepEqual(chooseSafeFallbackChain("sparklyTexture"), ["Shimmer", "Twinkle"]);
  assert.deepEqual(chooseSafeFallbackChain("cinematicWarmHigh"), []);
  assert.deepEqual(chooseSafeFallbackChain("denseBridge"), []);
});

test("inferLegacyEffectCandidates only honors explicit effect aliases", () => {
  assert.deepEqual(inferLegacyEffectCandidates("apply shimmer to the tree"), ["Shimmer"]);
  assert.deepEqual(inferLegacyEffectCandidates("soft sparkle texture with restrained motion"), []);
  assert.deepEqual(inferLegacyEffectCandidates("directional chase across the line"), []);
});
