import test from "node:test";
import assert from "node:assert/strict";

import {
  buildRenderSamplingPlan,
  buildRenderObservationFromSamples,
  inferRenderSamplingDetail
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
  assert.equal(observation.source.samplingDetail, "");
  assert.equal(observation.source.sampledModelCount, 2);
  assert.deepEqual(observation.macro.activeModelNames, ["MegaTree", "Roofline"]);
  assert.equal(observation.macro.leadModel, "MegaTree");
  assert.equal(observation.macro.activeFamilyTotals.Tree, 2);
  assert.equal(observation.macro.activeFamilyTotals.Line, 1);
  assert.equal(observation.macro.maxActiveModelCount, 2);
  assert.equal(observation.macro.maxActiveModelRatio, 1);
  assert.equal(observation.macro.temporalRead, "evolving");
  assert.equal(observation.macro.distinctLeadModelCount, 1);
});

test("buildRenderObservationFromSamples marks stable sampled windows as flat", () => {
  const plan = buildRenderSamplingPlan({
    modelsById: {
      MegaTree: { id: "MegaTree", name: "MegaTree", typeCategory: "Tree", startChannel: 1, endChannel: 3, transform: { position: { x: 0, y: 0 } } }
    }
  });
  const frame = Buffer.from([255, 128, 0]).toString("base64");
  const observation = buildRenderObservationFromSamples({
    samplingPlan: plan,
    sampleResponse: {
      data: {
        sequencePath: "/show/Test.xsq",
        revisionToken: "rev-2",
        fseqPath: "/show/Test.fseq",
        sampleEncoding: "base64_packed_channel_ranges_v1",
        startMs: 0,
        endMs: 100,
        samples: [
          { frameIndex: 0, frameTimeMs: 0, dataBase64: frame },
          { frameIndex: 1, frameTimeMs: 50, dataBase64: frame },
          { frameIndex: 2, frameTimeMs: 100, dataBase64: frame }
        ]
      }
    }
  });

  assert.equal(observation.macro.temporalRead, "flat");
  assert.equal(observation.macro.energyVariation, 0);
  assert.equal(observation.macro.activeModelVariation, 0);
  assert.equal(observation.macro.distinctLeadModelCount, 1);
});

test("buildRenderObservationFromSamples preserves separate sampled windows", () => {
  const plan = buildRenderSamplingPlan({
    modelsById: {
      MegaTree: { id: "MegaTree", name: "MegaTree", typeCategory: "Tree", startChannel: 1, endChannel: 3, transform: { position: { x: 0, y: 0 } } },
      Roofline: { id: "Roofline", name: "Roofline", typeCategory: "Line", startChannel: 4, endChannel: 6, transform: { position: { x: 10, y: 0 } } }
    }
  });
  const treeOnly = Buffer.from([255, 0, 0, 0, 0, 0]).toString("base64");
  const roofOnly = Buffer.from([0, 0, 0, 255, 255, 255]).toString("base64");
  const observation = buildRenderObservationFromSamples({
    samplingPlan: plan,
    sampleResponses: [
      {
        label: "Verse",
        reviewLevel: "section",
        sampleDetail: "section",
        sourceWindow: { startMs: 900, endMs: 1600 },
        data: {
          sequencePath: "/show/Test.xsq",
          revisionToken: "rev-3",
          fseqPath: "/show/Test.fseq",
          sampleEncoding: "base64_packed_channel_ranges_v1",
          startMs: 1000,
          endMs: 1500,
          samples: [
            { frameIndex: 40, frameTimeMs: 1000, dataBase64: treeOnly },
            { frameIndex: 60, frameTimeMs: 1500, dataBase64: treeOnly }
          ]
        }
      },
      {
        label: "Chorus",
        reviewLevel: "section",
        sampleDetail: "drilldown",
        sourceWindow: { startMs: 1900, endMs: 2600 },
        data: {
          sequencePath: "/show/Test.xsq",
          revisionToken: "rev-3",
          fseqPath: "/show/Test.fseq",
          sampleEncoding: "base64_packed_channel_ranges_v1",
          startMs: 2000,
          endMs: 2500,
          samples: [
            { frameIndex: 80, frameTimeMs: 2000, dataBase64: roofOnly },
            { frameIndex: 100, frameTimeMs: 2500, dataBase64: roofOnly }
          ]
        }
      }
    ]
  });

  assert.equal(observation.source.windowCount, 2);
  assert.equal(observation.source.samplingDetail, "mixed");
  assert.deepEqual(observation.source.windows, [
    { label: "Verse", startMs: 1000, endMs: 1500, reviewLevel: "section", sampleDetail: "section", sourceStartMs: 900, sourceEndMs: 1600 },
    { label: "Chorus", startMs: 2000, endMs: 2500, reviewLevel: "section", sampleDetail: "drilldown", sourceStartMs: 1900, sourceEndMs: 2600 }
  ]);
  assert.equal(observation.windows.length, 2);
  assert.equal(observation.windows[0].label, "Verse");
  assert.deepEqual(observation.windows[0].activeModelNames, ["MegaTree"]);
  assert.equal(observation.windows[1].label, "Chorus");
  assert.deepEqual(observation.windows[1].activeModelNames, ["Roofline"]);
  assert.equal(observation.macro.frameCount, 4);
  assert.equal(observation.macro.temporalRead, "evolving");
  assert.equal(observation.macro.distinctLeadModelCount, 2);
});

test("inferRenderSamplingDetail escalates repeated unstable section critique to drilldown", () => {
  const out = inferRenderSamplingDetail({
    sequenceArtisticGoal: { scope: { goalLevel: "section" } },
    sequenceRevisionObjective: { ladderLevel: "section" },
    priorRenderObservation: {
      source: {
        samplingDetail: "section"
      }
    },
    priorRenderCritiqueContext: {
      observed: { temporalRead: "flat" },
      comparison: {
        adjacentWindowComparisons: [
          { windowsReadSimilarly: true }
        ]
      }
    }
  });

  assert.equal(out, "drilldown");
});

test("inferRenderSamplingDetail keeps macro sampling sparse without prior instability", () => {
  const out = inferRenderSamplingDetail({
    sequenceArtisticGoal: { scope: { goalLevel: "macro" } },
    sequenceRevisionObjective: { ladderLevel: "macro" },
    priorRenderObservation: {
      source: {
        samplingDetail: "macro"
      }
    },
    priorRenderCritiqueContext: {
      observed: { temporalRead: "evolving" },
      comparison: {
        adjacentWindowComparisons: []
      }
    }
  });

  assert.equal(out, "macro");
});
