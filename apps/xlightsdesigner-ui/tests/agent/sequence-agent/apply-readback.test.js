import test from "node:test";
import assert from "node:assert/strict";

import { verifyAppliedPlanReadback } from "../../../agent/sequence-agent/apply-readback.js";

function sampleSubmodels() {
  return {
    "MegaTree/Star": {
      id: "MegaTree/Star",
      parentId: "MegaTree",
      membership: { nodeChannels: [1, 2, 3] }
    },
    "MegaTree/TopHalf": {
      id: "MegaTree/TopHalf",
      parentId: "MegaTree",
      membership: { nodeChannels: [3, 4, 5] }
    },
    "Roofline/Left": {
      id: "Roofline/Left",
      parentId: "Roofline",
      membership: { nodeChannels: [21, 22, 23] }
    },
    "Roofline/Right": {
      id: "Roofline/Right",
      parentId: "Roofline",
      membership: { nodeChannels: [31, 32, 33] }
    }
  };
}

test("apply readback verifies timing, display order, and distributed effects", async () => {
  const plan = [
    {
      cmd: "timing.insertMarks",
      params: {
        trackName: "XD: Sequencer Plan",
        marks: [
          { startMs: 0, endMs: 1000, label: "Chorus 1" }
        ]
      }
    },
    {
      cmd: "sequencer.setDisplayElementOrder",
      params: {
        orderedIds: ["Lyrics", "XD: Sequencer Plan", "AllModels", "Frontline", "MegaTree"]
      }
    },
    {
      cmd: "effects.create",
      params: {
        modelName: "MegaTree",
        layerIndex: 0,
        effectName: "Bars",
        startMs: 0,
        endMs: 333
      }
    },
    {
      cmd: "effects.create",
      params: {
        modelName: "Roofline",
        layerIndex: 0,
        effectName: "Bars",
        startMs: 333,
        endMs: 666
      }
    },
    {
      cmd: "effects.create",
      params: {
        modelName: "WindowLeft",
        layerIndex: 0,
        effectName: "Bars",
        startMs: 666,
        endMs: 1000
      }
    }
  ];

  const verification = await verifyAppliedPlanReadback(plan, {
    endpoint: "http://127.0.0.1:49914/xlDoAutomation",
    getTimingMarks: async () => ({
      data: {
        marks: [{ startMs: 0, endMs: 1000, label: "Chorus 1" }]
      }
    }),
    getDisplayElementOrder: async () => ({
      data: {
        elements: [
          { id: "Lyrics" },
          { id: "XD: Sequencer Plan" },
          { id: "AllModels" },
          { id: "Frontline" },
          { id: "MegaTree" }
        ]
      }
    }),
    listEffects: async (_endpoint, { modelName, layerIndex, startMs, endMs }) => ({
      data: {
        effects: [{ modelName, layerIndex, startMs, endMs, effectName: "Bars" }]
      }
    })
  });

  assert.equal(verification.expectedMutationsPresent, true);
  assert.equal(verification.checks.length, 5);
  assert.equal(verification.checks.every((row) => row.ok), true);
});

test("apply readback flags mismatched distributed effect windows", async () => {
  const plan = [
    {
      cmd: "effects.create",
      params: {
        modelName: "MegaTree",
        layerIndex: 0,
        effectName: "Bars",
        startMs: 0,
        endMs: 500
      }
    },
    {
      cmd: "effects.create",
      params: {
        modelName: "Roofline",
        layerIndex: 0,
        effectName: "Bars",
        startMs: 500,
        endMs: 1000
      }
    }
  ];

  const verification = await verifyAppliedPlanReadback(plan, {
    endpoint: "http://127.0.0.1:49914/xlDoAutomation",
    listEffects: async (_endpoint, { modelName }) => ({
      data: {
        effects: modelName === "MegaTree"
          ? [{ modelName, layerIndex: 0, startMs: 0, endMs: 500, effectName: "Bars" }]
          : [{ modelName, layerIndex: 0, startMs: 0, endMs: 500, effectName: "Bars" }]
      }
    })
  });

  assert.equal(verification.expectedMutationsPresent, false);
  assert.deepEqual(
    verification.checks.map((row) => [row.target, row.ok]),
    [
      ["MegaTree@0", true],
      ["Roofline@0", false]
    ]
  );
});

test("apply readback verifies submodel-targeted effect did not broaden to parent", async () => {
  const plan = [
    {
      cmd: "effects.create",
      params: {
        modelName: "MegaTree/Star",
        layerIndex: 0,
        effectName: "Bars",
        startMs: 0,
        endMs: 500
      }
    }
  ];

  const verification = await verifyAppliedPlanReadback(plan, {
    endpoint: "http://127.0.0.1:49914/xlDoAutomation",
    submodelsById: sampleSubmodels(),
    listEffects: async (_endpoint, { modelName, layerIndex, startMs, endMs }) => ({
      data: {
        effects: modelName === "MegaTree/Star"
          ? [{ modelName, layerIndex, startMs, endMs, effectName: "Bars" }]
          : []
      }
    })
  });

  assert.equal(verification.expectedMutationsPresent, true);
  assert.deepEqual(
    verification.checks.map((row) => [row.kind, row.target, row.ok]),
    [
      ["effect", "MegaTree/Star@0", true],
      ["submodel-precision", "MegaTree/Star->MegaTree@0", true],
      ["submodel-sibling-precision", "MegaTree/Star->MegaTree/TopHalf@0", true]
    ]
  );
});

test("apply readback flags submodel-targeted effect that broadened to parent", async () => {
  const plan = [
    {
      cmd: "effects.create",
      params: {
        modelName: "MegaTree/Star",
        layerIndex: 0,
        effectName: "Bars",
        startMs: 0,
        endMs: 500
      }
    }
  ];

  const verification = await verifyAppliedPlanReadback(plan, {
    endpoint: "http://127.0.0.1:49914/xlDoAutomation",
    submodelsById: sampleSubmodels(),
    listEffects: async (_endpoint, { modelName, layerIndex, startMs, endMs }) => ({
      data: {
        effects: [{ modelName, layerIndex, startMs, endMs, effectName: "Bars" }]
      }
    })
  });

  assert.equal(verification.expectedMutationsPresent, false);
  assert.deepEqual(
    verification.checks.map((row) => [row.kind, row.target, row.ok]),
    [
      ["effect", "MegaTree/Star@0", true],
      ["submodel-precision", "MegaTree/Star->MegaTree@0", false],
      ["submodel-sibling-precision", "MegaTree/Star->MegaTree/TopHalf@0", false]
    ]
  );
});

test("apply readback does not flag explicit parent-plus-submodel writes as broadening", async () => {
  const plan = [
    {
      cmd: "effects.create",
      params: {
        modelName: "MegaTree",
        layerIndex: 0,
        effectName: "Bars",
        startMs: 0,
        endMs: 500
      }
    },
    {
      cmd: "effects.create",
      params: {
        modelName: "MegaTree/Star",
        layerIndex: 0,
        effectName: "Bars",
        startMs: 0,
        endMs: 500
      }
    }
  ];

  const verification = await verifyAppliedPlanReadback(plan, {
    endpoint: "http://127.0.0.1:49914/xlDoAutomation",
    submodelsById: sampleSubmodels(),
    listEffects: async (_endpoint, { modelName, layerIndex, startMs, endMs }) => ({
      data: {
        effects: [{ modelName, layerIndex, startMs, endMs, effectName: "Bars" }]
      }
    })
  });

  assert.equal(verification.expectedMutationsPresent, true);
  assert.deepEqual(
    verification.checks.map((row) => [row.kind, row.target, row.ok]),
    [
      ["effect", "MegaTree@0", true],
      ["effect", "MegaTree/Star@0", true]
    ]
  );
});

test("apply readback flags submodel-targeted effect that broadened to overlapping sibling", async () => {
  const plan = [
    {
      cmd: "effects.create",
      params: {
        modelName: "MegaTree/Star",
        layerIndex: 0,
        effectName: "Bars",
        startMs: 0,
        endMs: 500
      }
    }
  ];

  const verification = await verifyAppliedPlanReadback(plan, {
    endpoint: "http://127.0.0.1:49914/xlDoAutomation",
    submodelsById: sampleSubmodels(),
    listEffects: async (_endpoint, { modelName, layerIndex, startMs, endMs }) => ({
      data: {
        effects: modelName === "MegaTree/Star" || modelName === "MegaTree/TopHalf"
          ? [{ modelName, layerIndex, startMs, endMs, effectName: "Bars" }]
          : []
      }
    })
  });

  assert.equal(verification.expectedMutationsPresent, false);
  assert.deepEqual(
    verification.checks.map((row) => [row.kind, row.target, row.ok]),
    [
      ["effect", "MegaTree/Star@0", true],
      ["submodel-precision", "MegaTree/Star->MegaTree@0", true],
      ["submodel-sibling-precision", "MegaTree/Star->MegaTree/TopHalf@0", false]
    ]
  );
});
