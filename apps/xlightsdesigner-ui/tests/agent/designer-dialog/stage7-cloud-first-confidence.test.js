import test from "node:test";
import assert from "node:assert/strict";

import { executeDesignerProposalOrchestration } from "../../../agent/designer-dialog/designer-dialog-orchestrator.js";
import { validateAgentHandoff } from "../../../agent/handoff-contracts.js";

function makeFixture() {
  return {
    models: [
      { id: "Border-01", name: "Border-01", type: "Line" },
      { id: "SpiralTrees", name: "SpiralTrees", type: "Tree" },
      { id: "Snowman", name: "Snowman", type: "Prop" },
      { id: "NorthPoleMatrix", name: "NorthPoleMatrix", type: "Matrix" }
    ],
    submodels: [],
    metadataAssignments: [
      { targetId: "Snowman", tags: ["character", "focal"] },
      { targetId: "NorthPoleMatrix", tags: ["lyric"] },
      { targetId: "SpiralTrees", tags: ["rhythm"] },
      { targetId: "Border-01", tags: ["support"] }
    ],
    designSceneContext: {
      artifactType: "design_scene_context_v1",
      metadata: { layoutMode: "2d" },
      focalCandidates: ["Snowman", "NorthPoleMatrix"],
      coverageDomains: {
        broad: ["AllModels", "Border-01", "SpiralTrees"],
        detail: ["Snowman", "NorthPoleMatrix"]
      }
    },
    musicDesignContext: {
      artifactType: "music_design_context_v1",
      sectionArc: [
        { label: "Intro", energy: "low", density: "sparse" },
        { label: "Verse 1", energy: "medium", density: "moderate" },
        { label: "Chorus 1", energy: "high", density: "dense" }
      ],
      designCues: {
        revealMoments: ["Verse 1->Chorus 1"],
        holdMoments: ["Intro"],
        lyricFocusMoments: ["Verse 1"]
      }
    }
  };
}

function runPrompt({ id, promptText, selectedSections = [], cloudResponse = null }) {
  const fixture = makeFixture();
  return executeDesignerProposalOrchestration({
    requestId: id,
    sequenceRevision: "rev-stage7",
    promptText,
    goals: promptText,
    selectedSections,
    models: fixture.models,
    submodels: fixture.submodels,
    metadataAssignments: fixture.metadataAssignments,
    designSceneContext: fixture.designSceneContext,
    musicDesignContext: fixture.musicDesignContext,
    cloudResponse
  });
}

test("stage7 cloud-normalized path can provide richer reference-driven language without changing handoff scope", () => {
  const promptText = "I want this to feel like a classic department store holiday window: elegant, glowing, and a little theatrical.";
  const local = runPrompt({
    id: "stage7-local-reference",
    promptText
  });
  const cloud = runPrompt({
    id: "stage7-cloud-reference",
    promptText,
    cloudResponse: {
      responseType: "designer_cloud_response_v1",
      responseVersion: "1.0",
      assistantMessage: "I want to treat this like an elegant holiday window: composed, glowing, and intentionally theatrical without tipping into clutter.",
      summary: "Elegant glowing holiday-window framing with controlled theatrical lift.",
      assumptions: ["Start from a composed glowing base before letting the theatrical lift appear at impact sections."],
      brief: {
        summary: "Elegant glowing holiday-window framing with controlled theatrical lift.",
        goalsSummary: "Translate the holiday-window reference into a composed, glowing, theatrical sequence.",
        narrativeCues: "Keep the image elegant and glowing first, then let the theatrical lift arrive in a controlled way.",
        visualCues: "Favor composed framing, clean glow, and deliberate reveal instead of busy motion.",
        hypotheses: ["Use elegant glow and composed framing as the primary design language rather than generic expansion."]
      },
      proposal: {
        proposalId: "proposal-stage7-reference",
        summary: "Elegant glowing holiday-window framing with controlled theatrical lift.",
        proposalLines: [
          "General / General / keep the picture elegant and glowing with a composed theatrical frame instead of busy motion",
          "Chorus 1 / General / let the theatrical lift arrive through cleaner contrast instead of clutter"
        ]
      }
    }
  });

  assert.equal(local.ok, true);
  assert.equal(cloud.ok, true);
  assert.equal(cloud.source, "cloud_normalized");
  assert.deepEqual(validateAgentHandoff("intent_handoff_v1", cloud.intentHandoff), []);
  assert.deepEqual(cloud.intentHandoff.scope.sections, local.intentHandoff.scope.sections);
  assert.deepEqual(cloud.intentHandoff.scope.targetIds, local.intentHandoff.scope.targetIds);
  assert.equal(cloud.intentHandoff.goal, local.intentHandoff.goal);
  assert.notEqual(cloud.creativeBrief.summary, local.creativeBrief.summary);
  assert.match(cloud.creativeBrief.summary, /elegant|glowing|theatrical/i);
});

test("stage7 cloud-normalized path preserves explicit section scope and approval policy", () => {
  const promptText = "The bridge should feel like everything pauses for a breath before the final chorus opens up.";
  const result = runPrompt({
    id: "stage7-cloud-scope-stability",
    promptText,
    selectedSections: ["Bridge", "Final Chorus"],
    cloudResponse: {
      responseType: "designer_cloud_response_v1",
      responseVersion: "1.0",
      assistantMessage: "I want to let the bridge suspend like a held breath before the final chorus opens fully.",
      summary: "Held-breath bridge into a fuller final-chorus release.",
      brief: {
        summary: "Held-breath bridge into a fuller final-chorus release.",
        sections: ["Bridge", "Final Chorus"],
        narrativeCues: "Treat the bridge as a suspended breath, then let the final chorus release cleanly.",
        hypotheses: ["Use a clear hold-and-release shape so the chorus opening feels earned."]
      },
      proposal: {
        proposalId: "proposal-stage7-scope",
        summary: "Held-breath bridge into a fuller final-chorus release.",
        proposalLines: [
          "Bridge / General / hold the phrase in a suspended breath before the release",
          "Final Chorus / General / open the final release with cleaner payoff and broader lift"
        ]
      }
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.source, "cloud_normalized");
  assert.deepEqual(validateAgentHandoff("intent_handoff_v1", result.intentHandoff), []);
  assert.deepEqual(result.intentHandoff.scope.sections, ["Bridge", "Final Chorus"]);
  assert.equal(result.intentHandoff.approvalPolicy.requiresExplicitApprove, true);
});

test("stage7 partial cloud payload normalizes safely using local fallback structure", () => {
  const promptText = "Make the chorus warmer and cleaner.";
  const result = runPrompt({
    id: "stage7-cloud-partial",
    promptText,
    selectedSections: ["Chorus 1"],
    cloudResponse: {
      responseType: "designer_cloud_response_v1",
      responseVersion: "1.0",
      assistantMessage: "I want the chorus to feel warmer without losing clarity.",
      summary: "Warmer cleaner chorus pass."
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.source, "cloud_normalized");
  assert.deepEqual(validateAgentHandoff("intent_handoff_v1", result.intentHandoff), []);
  assert.deepEqual(result.intentHandoff.scope.sections, ["Chorus 1"]);
  assert.ok(result.proposalBundle.proposalLines.length > 0);
  assert.ok(result.creativeBrief.summary.length > 0);
});
