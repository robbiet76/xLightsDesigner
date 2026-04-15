import test from "node:test";
import assert from "node:assert/strict";

import { buildSequencingDesignHandoffV2 } from "../../../agent/sequence-agent/sequence-design-handoff.js";

test("sequencing design handoff derives semantic directives from prompt intent, not realization hints", () => {
  const artifact = buildSequencingDesignHandoffV2({
    requestId: "req-1",
    baseRevision: "rev-1",
    normalizedIntent: {
      goal: "Keep the bridge soft, restrained, and texture-led with a gentle handoff rather than a bold ring or spin."
    },
    proposalBundle: {
      artifactId: "proposal-1",
      summary: "Bridge texture pass",
      scope: { targetIds: ["Spinners"] }
    },
    executionStrategy: {
      sectionPlans: [
        {
          section: "Bridge",
          energy: "medium",
          density: "moderate",
          intentSummary: "Keep the bridge soft, restrained, and texture-led with a gentle handoff rather than a bold ring or spin.",
          effectHints: ["Shockwave", "Pinwheel"],
          targetIds: ["Spinners"]
        }
      ]
    }
  });

  assert.equal(artifact.sectionDirectives.length, 1);
  assert.equal(artifact.sectionDirectives[0].motionTarget, "restrained_motion");
  assert.deepEqual(artifact.sectionDirectives[0].preferredVisualFamilies, ["soft_texture"]);
});

