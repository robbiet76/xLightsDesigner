import test from "node:test";
import assert from "node:assert/strict";

import {
  recommendTrainedEffectsForVisualFamilies
} from "../../../agent/sequence-agent/trained-effect-knowledge.js";

test("trained effect knowledge prefers stage1 pattern evidence over static family fallback", () => {
  const out = recommendTrainedEffectsForVisualFamilies({
    preferredVisualFamilies: ["soft_texture"],
    targetIds: ["Spinners"],
    displayElements: [
      { id: "Spinners", name: "Spinners", displayAs: "Spinner" }
    ],
    limit: 3
  });

  assert.ok(out.length >= 1);
  assert.ok(out.some((row) => Array.isArray(row?.reasons) && row.reasons.some((reason) => /^pattern:|^intent:/.test(String(reason)))));
  assert.equal(out[0].reasons.includes("preferred_visual_family_fallback"), false);
});

test("trained effect knowledge does not invent static family recommendations when stage1 evidence does not match", () => {
  const out = recommendTrainedEffectsForVisualFamilies({
    preferredVisualFamilies: ["unsupported_family_token"],
    targetIds: ["Star"],
    displayElements: [
      { id: "Star", name: "Star", displayAs: "Star" }
    ],
    limit: 2
  });

  assert.deepEqual(out, []);
});
