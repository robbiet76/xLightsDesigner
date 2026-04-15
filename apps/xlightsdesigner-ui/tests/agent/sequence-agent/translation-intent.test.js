import test from "node:test";
import assert from "node:assert/strict";

import { buildTranslationIntentV1 } from "../../../agent/sequence-agent/translation-intent.js";

function firstBehavior(promptText) {
  return buildTranslationIntentV1({
    promptText,
    sections: ["Test"],
    targetIds: ["Target"]
  }).behaviorTargets[0];
}

test("translation intent ignores negative segmented fill cues for spiral motion", () => {
  const behavior = firstBehavior(
    "Design a single Chorus 1 concept for SpiralTrees. Keep SpiralTrees as the lead read and use flowing spiral motion rather than a generic segmented fill. Do not rewrite the whole show."
  );
  assert.equal(behavior.motion.primaryMotion, "drift");
  assert.equal(behavior.texture.primaryTexture, "banded");
  assert.equal(behavior.coverage.coverageLevel, "focused");
});

test("translation intent ignores negative segmented chase cues for restrained shimmer texture", () => {
  const behavior = firstBehavior(
    "For Verse 1, keep Snowman gently animated with a restrained shimmer texture instead of a strong fill or segmented chase. Do not broaden beyond Snowman."
  );
  assert.equal(behavior.motion.primaryMotion, "shimmer");
  assert.equal(behavior.texture.primaryTexture, "sparkling");
  assert.equal(behavior.energy.energyLevel, "restrained");
});

test("translation intent keeps solid hold restrained despite negative sparkle and bars clauses", () => {
  const behavior = firstBehavior(
    "For the Outro, keep Snowman on a solid steady hold with minimal movement. Use an On effect rather than sparkle, bars, or ring motion."
  );
  assert.equal(behavior.motion.primaryMotion, "hold");
  assert.equal(behavior.texture.primaryTexture, "solid");
  assert.equal(behavior.energy.energyLevel, "restrained");
});

test("translation intent keeps banded texture for pinwheel and shockwave prompts despite avoided soft texture clauses", () => {
  const pinwheel = firstBehavior(
    "In the Final Chorus, make Star read as a clear radial spin with pinwheel-style motion. Avoid soft texture and avoid a diffuse ring burst."
  );
  assert.equal(pinwheel.motion.primaryMotion, "spin");
  assert.equal(pinwheel.texture.primaryTexture, "banded");

  const shockwave = firstBehavior(
    "For Chorus 2, use Star as a centered shockwave ring burst with radial expansion. Do not turn it into a soft twinkle texture or pinwheel spin."
  );
  assert.equal(shockwave.motion.primaryMotion, "burst");
  assert.equal(shockwave.texture.primaryTexture, "banded");
});
