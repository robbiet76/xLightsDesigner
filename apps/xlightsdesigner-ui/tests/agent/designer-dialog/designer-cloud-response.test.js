import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeDesignerCloudResponse,
  validateDesignerCloudResponse
} from "../../../agent/designer-dialog/designer-cloud-response.js";

test("validateDesignerCloudResponse accepts canonical cloud payload", () => {
  const errors = validateDesignerCloudResponse({
    responseType: "designer_cloud_response_v1",
    responseVersion: "1.0",
    assistantMessage: "I want to start broad and then refine the focal tree.",
    summary: "Broad first pass with a restrained intro and bigger chorus.",
    guidedQuestions: ["Do you want warmer whites or amber?"],
    assumptions: ["Start from a broad base pass before detail refinement."],
    brief: {
      summary: "Broad nostalgic first pass."
    },
    proposal: {
      summary: "Broad nostalgic first pass.",
      proposalLines: ["Chorus / AllModels / establish broad base coverage before detail refinement"]
    }
  });

  assert.deepEqual(errors, []);
});

test("normalizeDesignerCloudResponse maps cloud output into canonical designer result", () => {
  const result = normalizeDesignerCloudResponse({
    requestId: "req-cloud-1",
    cloudResponse: {
      responseType: "designer_cloud_response_v1",
      responseVersion: "1.0",
      assistantMessage: "I want to begin with a calm intro and save the payoff for the chorus.",
      summary: "Calm intro with broader chorus payoff.",
      guidedQuestions: ["Should the chorus spread to the whole yard?"],
      assumptions: ["Keep the intro restrained."],
      brief: {
        summary: "Calm intro with broader chorus payoff.",
        sections: ["Intro", "Chorus"],
        moodEnergyArc: "Intro: low -> Chorus: high",
        narrativeCues: "Preserve restraint through the intro and reveal into the chorus.",
        visualCues: "Start broad, then refine the megatree.",
        hypotheses: ["Use broad coverage first, then refine the focal tree."]
      },
      proposal: {
        proposalId: "proposal-cloud-1",
        summary: "Calm intro with broader chorus payoff.",
        baseRevision: "rev-9",
        proposalLines: [
          "Intro / AllModels / keep the pass restrained and readable to preserve space",
          "Chorus / MegaTree / preserve focal clarity as the lead visual anchor"
        ]
      }
    },
    fallback: {
      creativeBrief: {
        goalsSummary: "Preserve readability.",
        inspirationSummary: "Warm neighborhood memory.",
        sections: ["Intro", "Chorus"],
        moodEnergyArc: "Intro: low -> Chorus: high",
        narrativeCues: "Reveal the chorus cleanly.",
        visualCues: "Use broad coverage first.",
        hypotheses: ["Preserve focal clarity."]
      },
      proposalBundle: {
        scope: { sections: ["Intro", "Chorus"], targetIds: [], tagNames: [], summary: "sections: Intro, Chorus" },
        constraints: { changeTolerance: "moderate", preserveTimingTracks: true, preserveDisplayOrder: true, allowGlobalRewrite: false },
        lifecycle: { status: "fresh", stale: false, baseRevision: "rev-9", currentRevision: "rev-9", rebasedFrom: null, staleReason: "", updatedAt: new Date().toISOString() },
        riskNotes: [],
        impact: { estimatedImpact: 16, resolvedTargetCount: 0, assumptionCount: 1 },
        traceability: {}
      },
      warnings: []
    }
  });

  assert.equal(result.agentRole, "designer_dialog");
  assert.equal(result.status, "ok");
  assert.equal(result.creativeBrief.briefType, "creative_brief_v1");
  assert.equal(result.proposalBundle.bundleType, "proposal_bundle_v1");
  assert.equal(result.proposalBundle.proposalId, "proposal-cloud-1");
  assert.equal(result.proposalBundle.summary, "Calm intro with broader chorus payoff.");
  assert.deepEqual(result.proposalBundle.guidedQuestions, ["Should the chorus spread to the whole yard?"]);
  assert.deepEqual(result.proposalBundle.assumptions, ["Keep the intro restrained."]);
});
