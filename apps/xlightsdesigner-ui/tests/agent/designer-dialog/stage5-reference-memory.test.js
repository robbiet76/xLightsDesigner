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
      { id: "NorthPoleMatrix", name: "NorthPoleMatrix", type: "Matrix" },
      { id: "PorchTree", name: "PorchTree", type: "Tree" }
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
      focalCandidates: ["Snowman", "NorthPoleMatrix", "PorchTree"],
      coverageDomains: {
        broad: ["AllModels", "Border-01", "SpiralTrees"],
        detail: ["Snowman", "NorthPoleMatrix", "PorchTree"]
      }
    },
    musicDesignContext: {
      artifactType: "music_design_context_v1",
      sectionArc: [
        { label: "Intro", energy: "low", density: "sparse" },
        { label: "Verse 1", energy: "medium", density: "moderate" },
        { label: "Bridge", energy: "low", density: "sparse" },
        { label: "Final Chorus", energy: "high", density: "dense" }
      ],
      designCues: {
        revealMoments: ["Bridge->Final Chorus"],
        holdMoments: ["Intro", "Bridge"],
        lyricFocusMoments: ["Verse 1"]
      }
    }
  };
}

function runPrompt({ id, promptText, selectedSections = [] }) {
  const fixture = makeFixture();
  return executeDesignerProposalOrchestration({
    requestId: id,
    sequenceRevision: "rev-stage5",
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
  assert.ok(result.creativeBrief);
}

test("stage5 nostalgic memory prompt becomes concrete nostalgic design framing", () => {
  const promptText = "I want this to feel like Christmas Eve when I was a kid: warm, quiet, and full of anticipation.";
  const result = runPrompt({
    id: "stage5-nostalgic-memory",
    promptText
  });

  assertValidResult(result, promptText);
  assert.deepEqual(result.guidedQuestions, []);
  assert.match(result.creativeBrief.summary, /Christmas Eve|warm|anticipation/i);
  assert.match(result.creativeBrief.narrativeCues, /nostalg|warm|quiet|anticipation/i);
  assert.ok(result.creativeBrief.hypotheses.some((line) => /nostalg|warm|anticipation|quiet/i.test(line)));
  assert.ok(result.proposalLines.some((line) => /warm|gentle|restrained|wonder/i.test(line)));
});

test("stage5 inspiration prompt translates reference into usable design cues", () => {
  const promptText = "I want this to feel like a classic department store holiday window: elegant, glowing, and a little theatrical.";
  const result = runPrompt({
    id: "stage5-inspiration-reference",
    promptText
  });

  assertValidResult(result, promptText);
  assert.deepEqual(result.guidedQuestions, []);
  assert.match(result.creativeBrief.narrativeCues, /elegant|glowing|theatrical/i);
  assert.ok(result.creativeBrief.hypotheses.some((line) => /elegant|glow|theatrical/i.test(line)));
  assert.ok(result.proposalLines.some((line) => /elegant|glow|theatrical|cinematic/i.test(line)));
});

test("stage5 emotional indirect prompt becomes hold and release language", () => {
  const promptText = "The bridge should feel like everything pauses for a breath before the final chorus opens up.";
  const result = runPrompt({
    id: "stage5-emotional-indirect",
    promptText,
    selectedSections: ["Bridge", "Final Chorus"]
  });

  assertValidResult(result, promptText);
  assert.deepEqual(result.guidedQuestions, []);
  assert.deepEqual(result.intentHandoff.scope.sections, ["Bridge", "Final Chorus"]);
  assert.match(result.creativeBrief.narrativeCues, /breath|pause|opens up|hold|release/i);
  assert.ok(result.proposalLines.some((line) => /Bridge.*restrained|Bridge.*hold/i.test(line)));
  assert.ok(result.proposalLines.some((line) => /Final Chorus.*payoff|Final Chorus.*lift|Final Chorus.*impact/i.test(line)));
});
