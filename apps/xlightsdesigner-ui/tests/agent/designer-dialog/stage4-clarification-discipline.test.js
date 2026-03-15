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
      { targetId: "SpiralTrees", tags: ["rhythm"] }
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

function runPrompt({ id, promptText, selectedSections = [] }) {
  const fixture = makeFixture();
  return executeDesignerProposalOrchestration({
    requestId: id,
    sequenceRevision: "rev-stage4",
    promptText,
    goals: promptText,
    selectedSections,
    models: fixture.models,
    submodels: fixture.submodels,
    metadataAssignments: fixture.metadataAssignments,
    designSceneContext: fixture.designSceneContext,
    musicDesignContext: fixture.musicDesignContext
  });
}

function assertValidResult(result, promptText) {
  assert.equal(result.ok, true);
  assert.deepEqual(validateAgentHandoff("intent_handoff_v1", result.intentHandoff), []);
  assert.equal(result.intentHandoff.goal, promptText);
  assert.ok(result.proposalLines.length > 0);
}

test("stage4 broad usable prompt proceeds without clarification", () => {
  const promptText = "Make this feel warmer and more cinematic.";
  const result = runPrompt({
    id: "stage4-broad-usable",
    promptText
  });

  assertValidResult(result, promptText);
  assert.deepEqual(result.guidedQuestions, []);
  assert.ok(result.proposalBundle.assumptions.length > 0);
});

test("stage4 ambiguous but salvageable prompt asks at most one focused clarification", () => {
  const promptText = "Make this much more exciting.";
  const result = runPrompt({
    id: "stage4-ambiguous-salvageable",
    promptText
  });

  assertValidResult(result, promptText);
  assert.ok(result.guidedQuestions.length <= 1);
  if (result.guidedQuestions.length === 1) {
    assert.match(result.guidedQuestions[0], /section|focal/i);
  }
});

test("stage4 empty kickoff fails cleanly into clarification mode", () => {
  const result = runPrompt({
    id: "stage4-empty-kickoff",
    promptText: ""
  });

  assert.equal(result.ok, false);
  assert.match(result.summary, /clarification|failed/i);
  assert.ok(result.diagnostics);
});

test("stage4 explicit scoped refinement proceeds without clarification", () => {
  const promptText = "Tighten Chorus 1 so it feels cleaner without losing impact.";
  const result = runPrompt({
    id: "stage4-explicit-refinement",
    promptText,
    selectedSections: ["Chorus 1"]
  });

  assertValidResult(result, promptText);
  assert.deepEqual(result.guidedQuestions, []);
  assert.deepEqual(result.intentHandoff.scope.sections, ["Chorus 1"]);
  assert.ok(result.proposalLines.some((line) => /Chorus 1/i.test(line)));
});
