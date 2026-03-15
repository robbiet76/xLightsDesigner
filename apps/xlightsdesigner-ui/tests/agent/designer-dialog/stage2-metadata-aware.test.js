import test from "node:test";
import assert from "node:assert/strict";

import { executeDesignerProposalOrchestration } from "../../../agent/designer-dialog/designer-dialog-orchestrator.js";
import { buildDesignSceneContext } from "../../../agent/designer-dialog/design-scene-context.js";
import { validateAgentHandoff } from "../../../agent/handoff-contracts.js";

function makeSceneFixture({ lyricTargetId = "NorthPoleMatrix" } = {}) {
  const metadataAssignments = [
    { targetId: "Snowman", tags: ["character", "focal"] },
    { targetId: "Border-01", tags: ["support"] },
    { targetId: lyricTargetId, tags: ["lyric"] },
    { targetId: "SpiralTrees", tags: ["rhythm"] }
  ];

  const sceneGraph = {
    modelsById: {
      "Border-01": {
        id: "Border-01",
        name: "Border-01",
        type: "Line",
        nodes: [{ coords: { world: { x: 1, y: 1, z: 0 } } }]
      },
      Outlines: {
        id: "Outlines",
        name: "Outlines",
        type: "Line",
        nodes: [{ coords: { world: { x: 3, y: 3, z: 4 } } }]
      },
      CandyCanes: {
        id: "CandyCanes",
        name: "CandyCanes",
        type: "Line",
        nodes: [{ coords: { world: { x: 2, y: 2, z: 3 } } }]
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
      PorchTree: {
        id: "PorchTree",
        name: "PorchTree",
        type: "Tree",
        nodes: [{ coords: { world: { x: 2, y: 7, z: 9 } } }]
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
        members: {
          flattened: ["Border-01", "Outlines", "CandyCanes", "SpiralTrees", "Snowman", "PorchTree", "NorthPoleMatrix"]
        }
      }
    },
    submodelsById: {
      "Border-01/Left": { id: "Border-01/Left", parentId: "Border-01" },
      "Border-01/Right": { id: "Border-01/Right", parentId: "Border-01" },
      "Snowman/Snowman Hat Beads": { id: "Snowman/Snowman Hat Beads", parentId: "Snowman" },
      "Snowman/Face1-Eyes": { id: "Snowman/Face1-Eyes", parentId: "Snowman" }
    },
    stats: {
      layoutMode: "2d",
      modelCount: 7,
      groupCount: 1,
      submodelCount: 4
    }
  };

  return {
    models: [
      { id: "Border-01", name: "Border-01", type: "Line" },
      { id: "Outlines", name: "Outlines", type: "Line" },
      { id: "CandyCanes", name: "CandyCanes", type: "Line" },
      { id: "SpiralTrees", name: "SpiralTrees", type: "Tree" },
      { id: "Snowman", name: "Snowman", type: "Prop" },
      { id: "PorchTree", name: "PorchTree", type: "Tree" },
      { id: "NorthPoleMatrix", name: "NorthPoleMatrix", type: "Matrix" }
    ],
    submodels: [
      { id: "Border-01/Left", name: "Left", parentId: "Border-01" },
      { id: "Border-01/Right", name: "Right", parentId: "Border-01" },
      { id: "Snowman/Snowman Hat Beads", name: "Snowman Hat Beads", parentId: "Snowman" },
      { id: "Snowman/Face1-Eyes", name: "Face1-Eyes", parentId: "Snowman" }
    ],
    metadataAssignments,
    musicDesignContext: {
      artifactType: "music_design_context_v1",
      sectionArc: [
        { label: "Verse 1", energy: "medium", density: "balanced" },
        { label: "Chorus 1", energy: "high", density: "dense" }
      ],
      designCues: {
        revealMoments: ["Chorus 1"],
        holdMoments: [],
        lyricFocusMoments: ["Verse 1"]
      }
    },
    designSceneContext: buildDesignSceneContext({
      sceneGraph,
      revision: `scene-metadata-${lyricTargetId}`
    })
  };
}

function runMetadataPrompt(input = {}) {
  const fixture = makeSceneFixture(input.fixtureOptions || {});
  return executeDesignerProposalOrchestration({
    requestId: input.id,
    sequenceRevision: "rev-stage2-metadata",
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

function assertValidMetadataAwareResult(result, promptText) {
  assert.equal(result.ok, true);
  assert.deepEqual(validateAgentHandoff("intent_handoff_v1", result.intentHandoff), []);
  assert.equal(result.intentHandoff.goal, promptText);
  assert.ok(result.proposalLines.length > 0);
}

test("stage2 metadata prompt uses character and support tags against real tagged props", () => {
  const promptText = "Keep the character props leading the chorus while support props stay subtle.";
  const result = runMetadataPrompt({
    id: "stage2-metadata-character-support",
    promptText,
    selectedSections: ["Chorus 1"]
  });

  assertValidMetadataAwareResult(result, promptText);
  assert.deepEqual(result.intentHandoff.scope.sections, ["Chorus 1"]);
  assert.deepEqual(result.intentHandoff.scope.tagNames, ["character", "support"]);
  assert.ok(result.intentHandoff.scope.targetIds.includes("Snowman"));
  assert.ok(result.intentHandoff.scope.targetIds.includes("Border-01"));
  assert.ok(result.proposalLines.some((line) => /Snowman/i.test(line)));
  assert.ok(result.proposalLines.some((line) => /Border-01/i.test(line)));
  assert.ok(result.proposalLines.some((line) => /character props|support props/i.test(line)));
});

test("stage2 metadata prompt uses lyric and rhythm tags against real tagged props", () => {
  const promptText = "Use the lyric props for verse emphasis and let the rhythm props carry the lift in Chorus 1.";
  const result = runMetadataPrompt({
    id: "stage2-metadata-lyric-rhythm",
    promptText,
    selectedSections: ["Verse 1", "Chorus 1"]
  });

  assertValidMetadataAwareResult(result, promptText);
  assert.deepEqual(result.intentHandoff.scope.sections, ["Verse 1", "Chorus 1"]);
  assert.deepEqual(result.intentHandoff.scope.tagNames, ["lyric", "rhythm"]);
  assert.ok(result.intentHandoff.scope.targetIds.includes("NorthPoleMatrix"));
  assert.ok(result.intentHandoff.scope.targetIds.includes("SpiralTrees"));
  assert.ok(result.proposalLines.some((line) => /NorthPoleMatrix/i.test(line)));
  assert.ok(result.proposalLines.some((line) => /SpiralTrees/i.test(line)));
});

test("stage2 metadata-aware output changes when metadata assignments change", () => {
  const promptText = "Use the lyric props for verse emphasis.";
  const primary = runMetadataPrompt({
    id: "stage2-metadata-primary",
    promptText,
    selectedSections: ["Verse 1"]
  });
  const reassigned = runMetadataPrompt({
    id: "stage2-metadata-reassigned",
    promptText,
    selectedSections: ["Verse 1"],
    fixtureOptions: { lyricTargetId: "Snowman" }
  });

  assertValidMetadataAwareResult(primary, promptText);
  assertValidMetadataAwareResult(reassigned, promptText);
  assert.notDeepEqual(primary.proposalLines, reassigned.proposalLines);
  assert.notDeepEqual(primary.intentHandoff.scope.targetIds, reassigned.intentHandoff.scope.targetIds);
});
