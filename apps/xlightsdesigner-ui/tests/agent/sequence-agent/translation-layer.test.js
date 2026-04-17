import test from "node:test";
import assert from "node:assert/strict";

import { resolveTranslationLayer } from "../../../agent/sequence-agent/translation-layer.js";

test("translation layer separates preferred effect hints from visual-family phrases", () => {
  const out = resolveTranslationLayer({
    translationIntent: {
      realizationGuidance: {
        preferredFamilies: ["Shimmer", "restrained shimmer texture"]
      },
      behaviorTargets: [
        {
          appliesTo: "section",
          section: "Bridge",
          behaviorSummary: "restrained shimmer texture with quiet support",
          motion: { primaryMotion: "shimmer" },
          texture: { primaryTexture: "sparkling" },
          energy: { energyLevel: "restrained" },
          coverage: { coverageLevel: "focused" },
          hierarchy: { role: "support" },
          transitions: { entryCharacter: "gentle" }
        }
      ]
    },
    section: "Bridge",
    targetIds: ["Spinner"],
    availableEffects: new Set(["Shimmer", "Color Wash", "On"])
  });

  assert.deepEqual(out.preferredEffectHints, ["Shimmer"]);
  assert.match(out.preferredVisualFamilies.join(" | "), /restrained shimmer texture/i);
  assert.match(out.preferredVisualFamilies.join(" | "), /shimmer sparkling/i);
  assert.match(out.behaviorTexts.join(" | "), /quiet support/i);
});

test("translation layer filters target behavior by section and target scope", () => {
  const out = resolveTranslationLayer({
    translationIntent: {
      behaviorTargets: [
        {
          appliesTo: "section",
          section: "Verse 1",
          behaviorSummary: "soft drift",
          motion: { primaryMotion: "drift" },
          texture: { primaryTexture: "smooth" }
        },
        {
          appliesTo: "target",
          targetId: "MegaTree",
          behaviorSummary: "lead radial spin",
          motion: { primaryMotion: "spin" },
          texture: { primaryTexture: "banded" },
          hierarchy: { role: "lead" }
        },
        {
          appliesTo: "target",
          targetId: "Roofline",
          behaviorSummary: "background hold",
          motion: { primaryMotion: "hold" },
          texture: { primaryTexture: "solid" }
        }
      ]
    },
    section: "Verse 1",
    targetIds: ["MegaTree"]
  });

  assert.match(out.behaviorTexts.join(" | "), /soft drift/i);
  assert.match(out.behaviorTexts.join(" | "), /lead radial spin/i);
  assert.doesNotMatch(out.behaviorTexts.join(" | "), /background hold/i);
  assert.match(out.preferredVisualFamilies.join(" | "), /lead spin/i);
});

