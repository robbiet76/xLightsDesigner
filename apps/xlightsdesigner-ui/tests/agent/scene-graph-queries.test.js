import test from "node:test";
import assert from "node:assert/strict";

import {
  classifyDepthBands,
  collectSpatialNodes,
  computeSceneBounds,
  inferLayoutMode,
  findNearestNodes,
  findNodesInAxisAlignedRegion
} from "../../agent/scene-graph-queries.js";

function sampleSceneGraph() {
  return {
    modelsById: {
      A: { id: "A", transform: { position: { x: 0, y: 0, z: 0 } } },
      B: { id: "B", transform: { position: { x: 10, y: 0, z: 2 } } },
      C: { id: "C", transform: { position: { x: 0, y: 12, z: 9 } } }
    },
    groupsById: {
      G1: { id: "G1", transform: { position: { x: 4, y: 4, z: 4 } } }
    },
    submodelsById: {}
  };
}

test("collectSpatialNodes returns model/group spatial nodes", () => {
  const nodes = collectSpatialNodes(sampleSceneGraph());
  assert.equal(nodes.length, 4);
  assert.ok(nodes.some((n) => n.id === "A"));
  assert.ok(nodes.some((n) => n.id === "G1"));
});

test("computeSceneBounds calculates min/max/center/size", () => {
  const bounds = computeSceneBounds(collectSpatialNodes(sampleSceneGraph()));
  assert.equal(bounds.hasBounds, true);
  assert.deepEqual(bounds.min, { x: 0, y: 0, z: 0 });
  assert.deepEqual(bounds.max, { x: 10, y: 12, z: 9 });
  assert.deepEqual(bounds.center, { x: 5, y: 6, z: 4.5 });
});

test("findNodesInAxisAlignedRegion filters nodes by xyz box", () => {
  const rows = findNodesInAxisAlignedRegion(sampleSceneGraph(), {
    min: { x: 0, y: 0, z: 0 },
    max: { x: 5, y: 5, z: 5 }
  });
  const ids = rows.map((r) => r.id).sort();
  assert.deepEqual(ids, ["A", "G1"]);
});

test("findNearestNodes returns nearest by euclidean distance", () => {
  const rows = findNearestNodes(sampleSceneGraph(), "A", { limit: 2 });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].id, "G1");
  assert.equal(rows[1].id, "B");
});

test("classifyDepthBands splits front/mid/rear on z axis", () => {
  const bands = classifyDepthBands(sampleSceneGraph());
  assert.ok(bands.front.length > 0);
  assert.ok(bands.rear.length > 0);
  assert.equal(bands.axis, "z");
});

test("inferLayoutMode uses default camera type when available", () => {
  const mode = inferLayoutMode({
    cameras: [
      { name: "Layout2D", type: "2D", isDefault: false },
      { name: "Layout3D", type: "3D", isDefault: true }
    ]
  });
  assert.equal(mode, "3d");
});

test("inferLayoutMode falls back to 2d when camera types conflict without default", () => {
  const mode = inferLayoutMode({
    cameras: [
      { name: "Layout2D", type: "2D", isDefault: false },
      { name: "Layout3D", type: "3D", isDefault: false }
    ]
  });
  assert.equal(mode, "2d");
});
