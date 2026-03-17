import test from "node:test";
import assert from "node:assert/strict";

import { buildDesignSceneContext } from "../../../agent/designer-dialog/design-scene-context.js";

test("buildDesignSceneContext derives spatial zones and focal candidates", () => {
  const context = buildDesignSceneContext({
    sceneGraph: {
      modelsById: {
        LeftTree: {
          id: "LeftTree",
          name: "LeftTree",
          nodes: [{ coords: { world: { x: 0, y: 0, z: 0 } } }]
        },
        CenterTree: {
          id: "CenterTree",
          name: "CenterTree",
          nodes: [
            { coords: { world: { x: 5, y: 5, z: 1 } } },
            { coords: { world: { x: 5, y: 5, z: 1 } } }
          ]
        },
        RightTree: {
          id: "RightTree",
          name: "RightTree",
          nodes: [{ coords: { world: { x: 10, y: 10, z: 2 } } }]
        }
      },
      groupsById: {
        AllModels: {
          id: "AllModels",
          members: { flattened: ["LeftTree", "CenterTree", "RightTree"] }
        }
      },
      submodelsById: {
        "CenterTree/Star": { id: "CenterTree/Star" }
      },
      stats: {
        layoutMode: "2d",
        modelCount: 3,
        groupCount: 1,
        submodelCount: 1
      }
    },
    revision: "layout-rev-1"
  });

  assert.equal(context.artifactType, "design_scene_context_v1");
  assert.equal(context.layoutRevision, "layout-rev-1");
  assert.ok(context.spatialZones.left.includes("LeftTree"));
  assert.ok(context.spatialZones.center.includes("CenterTree"));
  assert.ok(context.spatialZones.right.includes("RightTree"));
  assert.ok(context.focalCandidates.includes("CenterTree"));
  assert.ok(context.coverageDomains.broad.includes("AllModels"));
  assert.ok(context.coverageDomains.detail.includes("CenterTree/Star"));
  assert.equal(context.impactMetrics.totalNodeCount, 4);
  assert.ok(context.impactMetrics.impactByTarget.CenterTree.nodeShare > context.impactMetrics.impactByTarget.LeftTree.nodeShare);
  assert.ok(context.impactMetrics.rankedTargets[0].id === "CenterTree");
});
