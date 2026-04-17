import test from "node:test";
import assert from "node:assert/strict";

import { buildLayeringPlacementGroups } from "../../../agent/sequence-agent/layering-groups.js";

test("buildLayeringPlacementGroups detects same-target stacked overlaps", () => {
  const out = buildLayeringPlacementGroups({
    effectPlacements: [
      {
        placementId: "p1",
        targetId: "MegaTree",
        layerIndex: 0,
        effectName: "Color Wash",
        startMs: 1000,
        endMs: 2000
      },
      {
        placementId: "p2",
        targetId: "MegaTree",
        layerIndex: 1,
        effectName: "Strobe",
        startMs: 1200,
        endMs: 1800
      }
    ]
  });

  assert.equal(out.groups.length, 1);
  assert.equal(out.groups[0].taxonomy, "same_target_layer_stack");
  assert.equal(out.groups[0].targetId, "MegaTree");
  assert.equal(out.groups[0].evidenceReady, true);
});

test("buildLayeringPlacementGroups detects same-target transitions without overlap", () => {
  const out = buildLayeringPlacementGroups({
    effectPlacements: [
      {
        placementId: "p1",
        targetId: "Arch",
        layerIndex: 0,
        effectName: "Wave",
        startMs: 1000,
        endMs: 1500
      },
      {
        placementId: "p2",
        targetId: "Arch",
        layerIndex: 0,
        effectName: "Wave",
        startMs: 1500,
        endMs: 2000
      }
    ]
  });

  assert.equal(out.groups.length, 1);
  assert.equal(out.groups[0].taxonomy, "same_target_transition");
});

test("buildLayeringPlacementGroups detects parent/submodel overlap using target ancestry", () => {
  const out = buildLayeringPlacementGroups({
    effectPlacements: [
      {
        placementId: "p1",
        targetId: "MegaTree",
        layerIndex: 0,
        effectName: "Butterfly",
        startMs: 1000,
        endMs: 2000
      },
      {
        placementId: "p2",
        targetId: "MegaTree/Spokes",
        layerIndex: 0,
        effectName: "Strobe",
        startMs: 1100,
        endMs: 1900
      }
    ],
    submodelsById: {
      "MegaTree/Spokes": { id: "MegaTree/Spokes", parentId: "MegaTree" }
    }
  });

  assert.equal(out.groups.length, 1);
  assert.equal(out.groups[0].taxonomy, "parent_submodel_overlap");
  assert.equal(out.groups[0].parentTargetId, "MegaTree");
});

test("buildLayeringPlacementGroups marks sibling submodel overlap unresolved", () => {
  const out = buildLayeringPlacementGroups({
    effectPlacements: [
      {
        placementId: "p1",
        targetId: "MegaTree/Left",
        layerIndex: 0,
        effectName: "Wave",
        startMs: 1000,
        endMs: 2000
      },
      {
        placementId: "p2",
        targetId: "MegaTree/Right",
        layerIndex: 0,
        effectName: "Wave",
        startMs: 1000,
        endMs: 2000
      }
    ],
    submodelsById: {
      "MegaTree/Left": { id: "MegaTree/Left", parentId: "MegaTree" },
      "MegaTree/Right": { id: "MegaTree/Right", parentId: "MegaTree" }
    }
  });

  assert.equal(out.groups.length, 0);
  assert.equal(out.unresolved.length, 1);
  assert.equal(out.unresolved[0].taxonomy, "sibling_submodel_overlap");
  assert.match(out.unresolved[0].unresolvedReason, /not enough physical ownership detail/i);
});

