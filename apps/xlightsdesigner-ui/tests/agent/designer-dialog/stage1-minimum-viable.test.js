import test from "node:test";
import assert from "node:assert/strict";

import { executeDesignerProposalOrchestration } from "../../../agent/designer-dialog/designer-dialog-orchestrator.js";
import { validateAgentHandoff } from "../../../agent/handoff-contracts.js";

function makeStage1Fixture() {
  return {
    models: [
      { id: "Border-01", name: "Border-01", type: "Line" },
      { id: "Outlines", name: "Outlines", type: "Line" },
      { id: "CandyCanes", name: "CandyCanes", type: "Line" },
      { id: "SpiralTrees", name: "SpiralTrees", type: "Tree" },
      { id: "Snowflakes", name: "Snowflakes", type: "Prop" },
      { id: "PorchTree", name: "PorchTree", type: "Tree" },
      { id: "Snowman", name: "Snowman", type: "Prop" },
      { id: "NorthPoleMatrix", name: "NorthPoleMatrix", type: "Matrix" }
    ],
    submodels: [
      { id: "Border-01/Left", name: "Left", parentId: "Border-01" },
      { id: "Border-01/Right", name: "Right", parentId: "Border-01" },
      { id: "Snowman/Snowman Hat Beads", name: "Snowman Hat Beads", parentId: "Snowman" },
      { id: "Snowman/Face1-Eyes", name: "Face1-Eyes", parentId: "Snowman" }
    ],
    metadataAssignments: [
      { targetId: "Snowman", tags: ["character", "focal"] },
      { targetId: "Border-01", tags: ["support"] },
      { targetId: "NorthPoleMatrix", tags: ["lyric"] },
      { targetId: "SpiralTrees", tags: ["rhythm"] }
    ],
    designSceneContext: {
      artifactType: "design_scene_context_v1",
      metadata: { layoutMode: "2d" },
      focalCandidates: ["Snowman", "NorthPoleMatrix", "PorchTree"],
      coverageDomains: {
        broad: ["AllModels", "Border-01", "Outlines", "CandyCanes", "SpiralTrees"],
        detail: ["Border-01/Left", "Snowman/Snowman Hat Beads", "Snowman/Face1-Eyes"]
      }
    },
    musicDesignContext: {
      artifactType: "music_design_context_v1",
      sectionArc: [
        { label: "Intro", energy: "low", density: "sparse" },
        { label: "Verse 1", energy: "low", density: "medium" },
        { label: "Chorus 1", energy: "high", density: "dense" }
      ],
      designCues: {
        revealMoments: ["Chorus 1"],
        holdMoments: ["Intro"],
        lyricFocusMoments: ["Verse 1"]
      }
    }
  };
}

function runStage1Prompt({ id, promptText, selectedSections = [], selectedTargetIds = [] }) {
  const fixture = makeStage1Fixture();
  return executeDesignerProposalOrchestration({
    requestId: id,
    sequenceRevision: "rev-stage1",
    promptText,
    goals: promptText,
    selectedSections,
    selectedTargetIds,
    models: fixture.models,
    submodels: fixture.submodels,
    metadataAssignments: fixture.metadataAssignments,
    designSceneContext: fixture.designSceneContext,
    musicDesignContext: fixture.musicDesignContext
  });
}

function assertCanonicalStage1Result(result, { promptText, expectedSections = [], expectedTargetIds = [] } = {}) {
  assert.equal(result.ok, true);
  assert.ok(result.creativeBrief);
  assert.ok(result.proposalBundle);
  assert.ok(result.intentHandoff);
  assert.deepEqual(validateAgentHandoff("intent_handoff_v1", result.intentHandoff), []);
  assert.equal(result.intentHandoff.goal, promptText);
  assert.equal(result.intentHandoff.approvalPolicy.requiresExplicitApprove, true);
  assert.equal(result.intentHandoff.constraints.preserveTimingTracks, true);
  assert.equal(result.intentHandoff.constraints.allowGlobalRewrite, false);
  assert.ok(result.proposalLines.length > 0);
  assert.ok(typeof result.summary === "string" && result.summary.length > 0);

  if (expectedSections.length) {
    assert.deepEqual(result.intentHandoff.scope.sections, expectedSections);
  }
  if (expectedTargetIds.length) {
    assert.deepEqual(result.intentHandoff.scope.targetIds, expectedTargetIds);
    assert.deepEqual(result.intentHandoff.directorPreferences.focusElements, expectedTargetIds);
  }
}

test("stage1 warm kickoff produces a valid handoff against real show models", () => {
  const promptText = "I want this sequence to feel warm, welcoming, and a little magical.";
  const result = runStage1Prompt({
    id: "stage1-warm-kickoff",
    promptText
  });

  assertCanonicalStage1Result(result, { promptText });
  assert.equal(result.intentHandoff.mode, "revise");
  assert.equal(result.intentHandoff.directorPreferences.colorDirection, "warm");
  assert.ok(result.proposalLines.some((line) => /Snowman|NorthPoleMatrix|PorchTree/.test(line)));
  assert.ok(result.proposalLines.some((line) => /warm welcoming base|little wonder/i.test(line)));
  assert.ok(result.proposalLines.every((line) => !/^Anchor design changes to brief goal:/i.test(line)));
  assert.ok(result.proposalLines.every((line) => !/^Use visual direction cues:/i.test(line)));
  assert.ok(result.guidedQuestions.length <= 1);
  assert.deepEqual(result.intentHandoff.scope.targetIds, []);
  assert.deepEqual(result.intentHandoff.directorPreferences.focusElements, []);
});

test("stage1 quiet intro stronger chorus preserves targeted section scope", () => {
  const promptText = "Keep the intro calm, then let the first chorus feel like it opens up.";
  const result = runStage1Prompt({
    id: "stage1-quiet-intro-open-chorus",
    promptText,
    selectedSections: ["Intro", "Chorus 1"]
  });

  assertCanonicalStage1Result(result, {
    promptText,
    expectedSections: ["Intro", "Chorus 1"]
  });
  assert.deepEqual(result.intentHandoff.scope.targetIds, []);
  assert.ok(result.proposalLines.some((line) => /Intro \/ General \/ keep the pass restrained/i.test(line)));
  assert.ok(result.proposalLines.some((line) => /Chorus 1 \/ General \/ build stronger visual payoff/i.test(line)));
});

test("stage1 bigger but not messy keeps explicit real targets in the handoff", () => {
  const promptText = "Make the chorus feel bigger, but don't let it get messy.";
  const selectedTargetIds = ["Snowman", "Border-01", "SpiralTrees"];
  const result = runStage1Prompt({
    id: "stage1-big-not-chaotic",
    promptText,
    selectedSections: ["Chorus 1"],
    selectedTargetIds
  });

  assertCanonicalStage1Result(result, {
    promptText,
    expectedSections: ["Chorus 1"],
    expectedTargetIds: selectedTargetIds
  });
  assert.equal(result.guidedQuestions.length, 0);
  assert.ok(result.proposalLines.some((line) => /focal clarity|visual payoff|contrast/i.test(line)));
});

test("stage1 focused clarification stays disciplined and still emits a valid handoff", () => {
  const promptText = "Make this much more exciting.";
  const result = runStage1Prompt({
    id: "stage1-focused-clarification",
    promptText
  });

  assertCanonicalStage1Result(result, { promptText });
  assert.ok(result.guidedQuestions.length <= 1);
  assert.deepEqual(result.intentHandoff.scope.targetIds, []);
  if (result.guidedQuestions.length === 1) {
    assert.match(result.guidedQuestions[0], /section/i);
  }
});

test("stage1 simple refinement keeps narrow target scope in the handoff", () => {
  const promptText = "This is close, but I want it a little cleaner and more focused.";
  const result = runStage1Prompt({
    id: "stage1-simple-refinement",
    promptText,
    selectedSections: ["Chorus 1"],
    selectedTargetIds: ["Snowman"]
  });

  assertCanonicalStage1Result(result, {
    promptText,
    expectedSections: ["Chorus 1"],
    expectedTargetIds: ["Snowman"]
  });
  assert.equal(result.intentHandoff.mode, "revise");
  assert.ok(result.proposalLines.some((line) => /Snowman/.test(line)));
  assert.ok(result.proposalLines.some((line) => /simplify the pass|tighten the focal read/i.test(line)));
  assert.ok(result.proposalLines.every((line) => !/shape a reveal around/i.test(line)));
  assert.ok(result.proposalLines.every((line) => !/balance focal effects and ambient beds/i.test(line)));
  assert.ok(result.proposalLines.every((line) => !/preserve groove and improve clarity/i.test(line)));
  assert.ok(result.proposalLines.every((line) => !/align palette and texture choices to brief visual cues/i.test(line)));
});
