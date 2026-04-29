import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function node(nodeId, x, y, brightness, rgb) {
  return {
    nodeId,
    stringIndex: 0,
    screen: { x, y, z: 0 },
    brightness,
    rgb
  };
}

function model(activeNodes) {
  return {
    modelName: "Matrix",
    displayAs: "Matrix",
    activeNodeCount: activeNodes.length,
    activeNodeRatio: activeNodes.length / 4,
    averageNodeBrightness: activeNodes.reduce((total, row) => total + row.brightness, 0) / activeNodes.length,
    activeBounds: {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 3, y: 0, z: 0 }
    },
    activeCentroid: { x: 1.5, y: 0, z: 0 },
    activeNodes
  };
}

test("extract-render-observation captures texture, persistence, and ramp metrics", () => {
  const root = mkdtempSync(join(tmpdir(), "extract-render-observation-"));
  const geometryPath = join(root, "geometry.json");
  const windowPath = join(root, "preview-window.json");
  const outPath = join(root, "render-observation.json");

  writeFileSync(geometryPath, JSON.stringify({
    scene: {
      models: [{
        modelName: "Matrix",
        bounds: {
          min: { x: 0, y: 0, z: 0 },
          max: { x: 3, y: 1, z: 0 }
        }
      }]
    }
  }, null, 2));

  writeFileSync(windowPath, JSON.stringify({
    geometryReference: {
      artifactPath: geometryPath,
      modelCount: 1
    },
    source: {},
    frames: [
      {
        frameOffset: 0,
        frameTimeMs: 0,
        activeModelCount: 1,
        activeNodeCount: 4,
        models: [model([
          node(1, 0, 0, 255, { r: 255, g: 0, b: 0 }),
          node(2, 1, 0, 0, { r: 0, g: 0, b: 0 }),
          node(3, 2, 0, 255, { r: 0, g: 255, b: 0 }),
          node(4, 3, 0, 0, { r: 0, g: 0, b: 0 })
        ])]
      },
      {
        frameOffset: 1,
        frameTimeMs: 50,
        activeModelCount: 1,
        activeNodeCount: 4,
        models: [model([
          node(1, 0, 0, 96, { r: 96, g: 0, b: 0 }),
          node(2, 1, 0, 96, { r: 96, g: 0, b: 0 }),
          node(3, 2, 0, 96, { r: 96, g: 0, b: 0 }),
          node(4, 3, 0, 96, { r: 96, g: 0, b: 0 })
        ])]
      },
      {
        frameOffset: 2,
        frameTimeMs: 100,
        activeModelCount: 1,
        activeNodeCount: 4,
        models: [model([
          node(1, 0, 0, 64, { r: 0, g: 64, b: 0 }),
          node(2, 1, 0, 64, { r: 0, g: 64, b: 0 }),
          node(3, 2, 0, 64, { r: 0, g: 64, b: 0 }),
          node(4, 3, 0, 64, { r: 0, g: 64, b: 0 })
        ])]
      }
    ]
  }, null, 2));

  execFileSync("python3", [
    "scripts/sequencer-render-training/tooling/extract-render-observation.py",
    "--window",
    windowPath,
    "--out",
    outPath
  ], { cwd: process.cwd(), stdio: "pipe" });

  const result = JSON.parse(readFileSync(outPath, "utf8"));
  assert.equal(result.artifactType, "render_observation_v1");
  assert.equal(result.frames.length, 3);
  assert.ok(result.frames[0].texture.meanEdgeSoftness < result.frames[1].texture.meanEdgeSoftness);
  assert.equal(result.frames[0].modelTexture[0].activeNodeRatio, 1);
  assert.ok(result.macro.meanModelBrightnessStddev > 0);
  assert.ok(result.macro.meanAdjacentColorDelta > 0);
  assert.equal(result.macro.activeNodeRetentionMean, 1);
  assert.ok(result.macro.colorSequenceChangeMean > 0);
  assert.ok(result.macro.colorSequenceChangeMax >= result.macro.colorSequenceChangeMean);
  assert.ok(result.macro.openingToMiddleBrightnessDelta < 0);
  assert.ok(result.macro.middleToClosingBrightnessDelta < 0);
});
