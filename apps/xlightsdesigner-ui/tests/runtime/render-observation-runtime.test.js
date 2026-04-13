import test from "node:test";
import assert from "node:assert/strict";

import {
  buildRenderSamplingPlan,
  buildRenderObservationFromSamples
} from "../../runtime/render-observation-runtime.js";

test("buildRenderSamplingPlan derives ordered model channel ranges from scene graph", () => {
  const plan = buildRenderSamplingPlan({
    modelsById: {
      B: { id: "B", name: "B", typeCategory: "Tree", startChannel: 10, endChannel: 15, transform: { position: { x: 5, y: 5 } } },
      A: { id: "A", name: "A", typeCategory: "Line", startChannel: 1, endChannel: 3, transform: { position: { x: 0, y: 0 } } }
    }
  });
  assert.equal(plan.modelCount, 2);
  assert.deepEqual(plan.channelRanges, [
    { startChannel: 1, channelCount: 3 },
    { startChannel: 10, channelCount: 6 }
  ]);
});

test("buildRenderSamplingPlan narrows to matched target models when scope targets are present", () => {
  const plan = buildRenderSamplingPlan({
    modelsById: {
      MegaTree: { id: "MegaTree", name: "MegaTree", typeCategory: "Tree", startChannel: 1, endChannel: 3, transform: { position: { x: 0, y: 0 } } },
      Roofline: { id: "Roofline", name: "Roofline", typeCategory: "Line", startChannel: 4, endChannel: 6, transform: { position: { x: 10, y: 0 } } }
    }
  }, {
    targetIds: ["MegaTree"]
  });

  assert.equal(plan.modelCount, 1);
  assert.equal(plan.availableModelCount, 2);
  assert.equal(plan.targetMatchedModelCount, 1);
  assert.equal(plan.samplingMode, "targeted");
  assert.deepEqual(plan.channelRanges, [
    { startChannel: 1, channelCount: 3 }
  ]);
});

test("buildRenderObservationFromSamples produces model-level macro observation from sparse bytes", () => {
  const plan = buildRenderSamplingPlan({
    modelsById: {
      MegaTree: { id: "MegaTree", name: "MegaTree", typeCategory: "Tree", startChannel: 1, endChannel: 3, transform: { position: { x: 0, y: 0 } } },
      Roofline: { id: "Roofline", name: "Roofline", typeCategory: "Line", startChannel: 4, endChannel: 6, transform: { position: { x: 10, y: 0 } } }
    }
  });
  const frame0 = Buffer.from([255, 0, 0, 0, 0, 0]).toString("base64");
  const frame1 = Buffer.from([255, 255, 255, 64, 64, 64]).toString("base64");
  const observation = buildRenderObservationFromSamples({
    samplingPlan: plan,
    sampleResponse: {
      data: {
        sequencePath: "/show/Test.xsq",
        revisionToken: "rev-1",
        fseqPath: "/show/Test.fseq",
        sampleEncoding: "base64_packed_channel_ranges_v1",
        startMs: 0,
        endMs: 50,
        samples: [
          { frameIndex: 0, frameTimeMs: 0, dataBase64: frame0 },
          { frameIndex: 1, frameTimeMs: 50, dataBase64: frame1 }
        ]
      }
    }
  });

  assert.equal(observation.artifactType, "render_observation_v1");
  assert.equal(observation.source.startMs, 0);
  assert.equal(observation.source.endMs, 50);
  assert.equal(observation.source.samplingMode, "full");
  assert.equal(observation.source.sampledModelCount, 2);
  assert.deepEqual(observation.macro.activeModelNames, ["MegaTree", "Roofline"]);
  assert.equal(observation.macro.leadModel, "MegaTree");
  assert.equal(observation.macro.activeFamilyTotals.Tree, 2);
  assert.equal(observation.macro.activeFamilyTotals.Line, 1);
  assert.equal(observation.macro.maxActiveModelCount, 2);
  assert.equal(observation.macro.maxActiveModelRatio, 1);
});
