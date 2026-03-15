import test from "node:test";
import assert from "node:assert/strict";

import { executeDesignerProposalOrchestration } from "../../../agent/designer-dialog/designer-dialog-orchestrator.js";
import { buildDesignSceneContext } from "../../../agent/designer-dialog/design-scene-context.js";
import { validateAgentHandoff } from "../../../agent/handoff-contracts.js";

function makeSceneFixture({ swapDepth = false } = {}) {
  const foregroundZ = swapDepth ? 9 : 0;
  const backgroundZ = swapDepth ? 0 : 9;
  const sceneGraph = {
    modelsById: {
      "Border-01": {
        id: "Border-01",
        name: "Border-01",
        type: "Line",
        nodes: [{ coords: { world: { x: 1, y: 1, z: foregroundZ } } }]
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
        nodes: [
          { coords: { world: { x: 6, y: 3, z: 2 } } },
          { coords: { world: { x: 6, y: 3, z: 2 } } }
        ]
      },
      PorchTree: {
        id: "PorchTree",
        name: "PorchTree",
        type: "Tree",
        nodes: [{ coords: { world: { x: 2, y: 7, z: backgroundZ } } }]
      },
      NorthPoleMatrix: {
        id: "NorthPoleMatrix",
        name: "NorthPoleMatrix",
        type: "Matrix",
        nodes: [{ coords: { world: { x: 11, y: 7, z: backgroundZ } } }]
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
    metadataAssignments: [
      { targetId: "Snowman", tags: ["character", "focal"] },
      { targetId: "Border-01", tags: ["support"] },
      { targetId: "NorthPoleMatrix", tags: ["lyric"] },
      { targetId: "SpiralTrees", tags: ["rhythm"] }
    ],
    musicDesignContext: {
      artifactType: "music_design_context_v1",
      sectionArc: [
        { label: "Intro", energy: "low", density: "sparse" },
        { label: "Chorus 1", energy: "high", density: "dense" }
      ],
      designCues: {
        revealMoments: ["Chorus 1"],
        holdMoments: ["Intro"],
        lyricFocusMoments: []
      }
    },
    designSceneContext: buildDesignSceneContext({
      sceneGraph,
      revision: swapDepth ? "scene-swapped" : "scene-primary"
    })
  };
}

function runScenePrompt(input = {}) {
  const fixture = makeSceneFixture(input.fixtureOptions || {});
  return executeDesignerProposalOrchestration({
    requestId: input.id,
    sequenceRevision: "rev-stage2",
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

function assertValidSceneAwareResult(result, promptText) {
  assert.equal(result.ok, true);
  assert.deepEqual(validateAgentHandoff("intent_handoff_v1", result.intentHandoff), []);
  assert.equal(result.intentHandoff.goal, promptText);
  assert.ok(result.proposalLines.length > 0);
}

test("stage2 character focal prompt keeps real named targets in scope", () => {
  const promptText = "Make the Snowman the focal point in each chorus while Border-01 stays supporting.";
  const result = runScenePrompt({
    id: "stage2-character-focal",
    promptText,
    selectedSections: ["Chorus 1"]
  });

  assertValidSceneAwareResult(result, promptText);
  assert.deepEqual(result.intentHandoff.scope.sections, ["Chorus 1"]);
  assert.deepEqual([...result.intentHandoff.scope.targetIds].sort(), ["Border-01", "Snowman"]);
  assert.ok(result.proposalLines.some((line) => /Snowman/.test(line)));
  assert.ok(result.proposalLines.every((line) => !/MegaTree|Roofline|Arches|Matrix\b/.test(line)));
});

test("stage2 foreground background prompt uses real spatial-zone targets", () => {
  const promptText = "Keep the foreground calmer while the background opens up in Chorus 1.";
  const result = runScenePrompt({
    id: "stage2-foreground-background",
    promptText,
    selectedSections: ["Chorus 1"]
  });

  assertValidSceneAwareResult(result, promptText);
  assert.deepEqual(result.intentHandoff.scope.sections, ["Chorus 1"]);
  assert.ok(result.proposalLines.some((line) => /Border-01.*foreground calmer|Border-01.*nearer layer/i.test(line)));
  assert.ok(result.proposalLines.some((line) => /NorthPoleMatrix|PorchTree/.test(line)));
  assert.ok(result.proposalLines.some((line) => /background open up|add depth behind the focal layer/i.test(line)));
});

test("stage2 left right prompt uses actual left and right zone targets", () => {
  const promptText = "Use the left side more gently than the right side during the intro.";
  const result = runScenePrompt({
    id: "stage2-left-right",
    promptText,
    selectedSections: ["Intro"]
  });

  assertValidSceneAwareResult(result, promptText);
  assert.deepEqual(result.intentHandoff.scope.sections, ["Intro"]);
  assert.ok(result.proposalLines.some((line) => /Border-01.*left side|PorchTree.*left side/i.test(line)));
  assert.ok(result.proposalLines.some((line) => /NorthPoleMatrix.*right side/i.test(line)));
});

test("stage2 scene-aware output changes when the scene depth context changes", () => {
  const promptText = "Keep the foreground calmer while the background opens up in Chorus 1.";
  const primary = runScenePrompt({
    id: "stage2-scene-primary",
    promptText,
    selectedSections: ["Chorus 1"]
  });
  const swapped = runScenePrompt({
    id: "stage2-scene-swapped",
    promptText,
    selectedSections: ["Chorus 1"],
    fixtureOptions: { swapDepth: true }
  });

  assertValidSceneAwareResult(primary, promptText);
  assertValidSceneAwareResult(swapped, promptText);
  assert.notDeepEqual(primary.proposalLines, swapped.proposalLines);
});
