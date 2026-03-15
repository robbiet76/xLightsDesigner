import test from "node:test";
import assert from "node:assert/strict";

import { executeDesignerProposalOrchestration } from "../../../agent/designer-dialog/designer-dialog-orchestrator.js";
import { buildDesignSceneContext } from "../../../agent/designer-dialog/design-scene-context.js";
import { validateAgentHandoff } from "../../../agent/handoff-contracts.js";

function makeFixture({ delayedReveal = false } = {}) {
  const sceneGraph = {
    modelsById: {
      "Border-01": {
        id: "Border-01",
        name: "Border-01",
        type: "Line",
        nodes: [{ coords: { world: { x: 1, y: 1, z: 0 } } }]
      },
      SpiralTrees: {
        id: "SpiralTrees",
        name: "SpiralTrees",
        type: "Tree",
        nodes: [{ coords: { world: { x: 5, y: 4, z: 5 } } }]
      },
      Snowman: {
        id: "Snowman",
        name: "Snowman",
        type: "Prop",
        nodes: [{ coords: { world: { x: 6, y: 3, z: 2 } } }]
      },
      NorthPoleMatrix: {
        id: "NorthPoleMatrix",
        name: "NorthPoleMatrix",
        type: "Matrix",
        nodes: [{ coords: { world: { x: 11, y: 7, z: 9 } } }]
      }
    },
    groupsById: {
      AllModels: {
        id: "AllModels",
        members: { flattened: ["Border-01", "SpiralTrees", "Snowman", "NorthPoleMatrix"] }
      }
    },
    submodelsById: {},
    stats: {
      layoutMode: "2d",
      modelCount: 4,
      groupCount: 1,
      submodelCount: 0
    }
  };

  const sectionArc = delayedReveal
    ? [
        { label: "Intro", energy: "low", density: "sparse" },
        { label: "Verse 1", energy: "medium", density: "moderate" },
        { label: "Chorus 1", energy: "medium", density: "moderate" },
        { label: "Bridge", energy: "low", density: "sparse" },
        { label: "Final Chorus", energy: "high", density: "dense" }
      ]
    : [
        { label: "Intro", energy: "low", density: "sparse" },
        { label: "Verse 1", energy: "medium", density: "moderate" },
        { label: "Chorus 1", energy: "high", density: "dense" }
      ];

  const revealMoments = delayedReveal ? ["Bridge->Final Chorus"] : ["Verse 1->Chorus 1"];
  const lyricFocusMoments = ["Verse 1"];
  const holdMoments = delayedReveal ? ["Intro", "Bridge"] : ["Intro"];

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
    designSceneContext: buildDesignSceneContext({
      sceneGraph,
      revision: delayedReveal ? "scene-stage3-delayed" : "scene-stage3-primary"
    }),
    musicDesignContext: {
      artifactType: "music_design_context_v1",
      sectionArc,
      designCues: {
        revealMoments,
        holdMoments,
        lyricFocusMoments
      }
    }
  };
}

function runMusicPrompt(input = {}) {
  const fixture = makeFixture(input.fixtureOptions || {});
  return executeDesignerProposalOrchestration({
    requestId: input.id,
    sequenceRevision: "rev-stage3",
    promptText: input.promptText,
    goals: input.promptText,
    selectedSections: input.selectedSections || [],
    selectedTargetIds: input.selectedTargetIds || [],
    models: fixture.models,
    submodels: fixture.submodels,
    metadataAssignments: fixture.metadataAssignments,
    designSceneContext: fixture.designSceneContext,
    musicDesignContext: fixture.musicDesignContext
  });
}

function assertValidMusicAwareResult(result, promptText) {
  assert.equal(result.ok, true);
  assert.deepEqual(validateAgentHandoff("intent_handoff_v1", result.intentHandoff), []);
  assert.equal(result.intentHandoff.goal, promptText);
  assert.ok(result.proposalLines.length > 0);
}

test("stage3 intro restraint and chorus reveal uses music structure cues", () => {
  const promptText = "Keep the intro calm, then let Chorus 1 open up with a stronger reveal.";
  const result = runMusicPrompt({
    id: "stage3-intro-chorus-reveal",
    promptText,
    selectedSections: ["Intro", "Chorus 1"]
  });

  assertValidMusicAwareResult(result, promptText);
  assert.deepEqual(result.intentHandoff.scope.sections, ["Intro", "Chorus 1"]);
  assert.ok(result.proposalLines.some((line) => /Intro.*calmer hold section|Intro.*restrained/i.test(line)));
  assert.ok(result.proposalLines.some((line) => /Chorus 1.*stronger visual payoff|Chorus 1.*impact section/i.test(line)));
});

test("stage3 verse lyric emphasis and chorus lift uses lyric-focus and high-energy sections", () => {
  const promptText = "Use Verse 1 for lyric emphasis, then let Chorus 1 carry the bigger lift.";
  const result = runMusicPrompt({
    id: "stage3-verse-lyric-chorus-lift",
    promptText,
    selectedSections: ["Verse 1", "Chorus 1"]
  });

  assertValidMusicAwareResult(result, promptText);
  assert.deepEqual(result.intentHandoff.scope.sections, ["Verse 1", "Chorus 1"]);
  assert.ok(result.proposalLines.some((line) => /Verse 1.*lyric/i.test(line)));
  assert.ok(result.proposalLines.some((line) => /Chorus 1.*lift|Chorus 1.*visual payoff|Chorus 1.*impact section/i.test(line)));
});

test("stage3 music-aware output changes when reveal structure changes", () => {
  const promptText = "Give Chorus 1 a stronger payoff after the opening sections hold back.";
  const primary = runMusicPrompt({
    id: "stage3-reveal-primary",
    promptText,
    selectedSections: ["Intro", "Verse 1", "Chorus 1"]
  });
  const delayed = runMusicPrompt({
    id: "stage3-reveal-delayed",
    promptText,
    selectedSections: ["Intro", "Verse 1", "Chorus 1"],
    fixtureOptions: { delayedReveal: true }
  });

  assertValidMusicAwareResult(primary, promptText);
  assertValidMusicAwareResult(delayed, promptText);
  assert.notDeepEqual(primary.proposalLines, delayed.proposalLines);
});
