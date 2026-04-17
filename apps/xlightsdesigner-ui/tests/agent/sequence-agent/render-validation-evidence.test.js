import test from "node:test";
import assert from "node:assert/strict";

import { buildRenderValidationEvidence } from "../../../agent/sequence-agent/render-validation-evidence.js";

test("buildRenderValidationEvidence preserves prior derived refs and refreshes live artifact refs", () => {
  const out = buildRenderValidationEvidence({
    priorEvidence: {
      compositionObservationRef: "composition_observation_v1-1",
      layeringObservationRef: "layering_observation_v1-1",
      progressionObservationRef: "progression_observation_v1-1",
      sequenceCritiqueRef: "sequence_critique_v1-1",
      scopeLevel: "section_window",
      sectionNames: ["Verse 1"],
      targetIds: ["MegaTree"]
    },
    renderObservation: {
      artifactId: "render_observation_v1-2"
    },
    renderCritiqueContext: {
      artifactId: "sequence_render_critique_context_v1-2"
    },
    sectionNames: ["Chorus 1"],
    targetIds: ["Roofline"]
  });

  assert.deepEqual(out, {
    renderObservationRef: "render_observation_v1-2",
    compositionObservationRef: "composition_observation_v1-1",
    layeringObservationRef: "layering_observation_v1-1",
    progressionObservationRef: "progression_observation_v1-1",
    sequenceCritiqueRef: "sequence_critique_v1-1",
    renderCritiqueContextRef: "sequence_render_critique_context_v1-2",
    scopeLevel: "section_window",
    sectionNames: ["Chorus 1"],
    targetIds: ["Roofline"]
  });
});
