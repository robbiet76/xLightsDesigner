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
    endpoint: "http://127.0.0.1:49915/xlightsdesigner/api",
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

test("apply readback accepts display-order wrappers that return string ids", async () => {
  const verification = await verifyAppliedPlanReadback([
    {
      cmd: "sequencer.setDisplayElementOrder",
      params: {
        orderedIds: ["Lyrics", "AllModels", "MegaTree"]
      }
    }
  ], {
    endpoint: "http://127.0.0.1:49915/xlightsdesigner/api",
    getDisplayElementOrder: async () => ({
      data: {
        elements: ["Lyrics", "AllModels", "MegaTree"]
      }
    })
  });

  assert.equal(verification.expectedMutationsPresent, true);
  assert.deepEqual(
    verification.checks.map((row) => [row.kind, row.ok]),
    [["display-order", true]]
  );
});

test("apply readback verifies final layer placement after update reorder and compact", async () => {
  const plan = [
    {
      cmd: "effects.create",
      params: {
        modelName: "Star",
        layerIndex: 0,
        effectName: "Color Wash",
        startMs: 0,
        endMs: 4000
      }
    },
    {
      cmd: "effects.update",
      params: {
        modelName: "Star",
        layerIndex: 0,
        startMs: 0,
        endMs: 4000,
        effectName: "Color Wash",
        newLayerIndex: 1,
        newStartMs: 0,
        newEndMs: 4500
      }
    },
    {
      cmd: "effects.reorderLayer",
      params: {
        modelName: "Star",
        fromLayerIndex: 1,
        toLayerIndex: 0
      }
    },
    {
      cmd: "effects.compactLayers",
      params: {
        modelName: "Star"
      }
    }
  ];

  const verification = await verifyAppliedPlanReadback(plan, {
    endpoint: "http://127.0.0.1:49915/xlightsdesigner/api",
    listEffects: async (_endpoint, { modelName, layerIndex, startMs, endMs }) => ({
      data: {
        effects: modelName === "Star" && layerIndex === 0 && startMs === 0 && endMs === 4500
          ? [{ modelName, layerIndex, startMs, endMs, effectName: "Color Wash" }]
          : []
      }
    })
  });

  assert.equal(verification.expectedMutationsPresent, true);
  assert.deepEqual(
    verification.checks.map((row) => [row.kind, row.target, row.ok]),
    [["effect", "Star@0", true]]
  );
});

test("apply readback verifies moved effect names after layer reorder", async () => {
  const plan = [
    {
      cmd: "effects.reorderLayer",
      params: {
        modelName: "Star",
        fromLayerIndex: 1,
        toLayerIndex: 0
      },
      intent: {
        existingSequencePolicy: {
          emittedLayerReorderCommand: true,
          movedEffects: [{ effectName: "Shimmer", startMs: 0, endMs: 120000 }],
          movedEffectNames: ["Shimmer"]
        }
      }
    }
  ];

  const verification = await verifyAppliedPlanReadback(plan, {
    endpoint: "http://127.0.0.1:49915/xlightsdesigner/api",
    listEffects: async (_endpoint, { modelName, layerIndex, startMs, endMs }) => ({
      data: {
        effects: modelName === "Star" && layerIndex === 0 && startMs === 0 && endMs === 120000
          ? [{ modelName, layerIndex, startMs, endMs, effectName: "Shimmer" }]
          : []
      }
    })
  });

  assert.equal(verification.expectedMutationsPresent, true);
  assert.deepEqual(
    verification.checks.map((row) => [row.kind, row.target, row.ok]),
    [["effect-layer-reorder", "Star@0", true]]
  );
});

test("apply readback verifies deleted effects are absent from final state", async () => {
  const plan = [
    {
      cmd: "effects.create",
      params: {
        modelName: "Star",
        layerIndex: 0,
        effectName: "Bars",
        startMs: 0,
        endMs: 1000
      }
    },
    {
      cmd: "effects.delete",
      params: {
        modelName: "Star",
        layerIndex: 0,
        effectName: "Bars",
        startMs: 0,
        endMs: 1000
      }
    }
  ];

  const verification = await verifyAppliedPlanReadback(plan, {
    endpoint: "http://127.0.0.1:49915/xlightsdesigner/api",
    listEffects: async () => ({
      data: {
        effects: []
      }
    })
  });

  assert.equal(verification.expectedMutationsPresent, true);
  assert.deepEqual(
    verification.checks.map((row) => [row.kind, row.target, row.ok]),
    [["effect-delete", "Star@0", true]]
  );
});

test("apply readback carries design and training context with alignment checks", async () => {
  const plan = [
    {
      cmd: "effects.create",
      params: {
        modelName: "TreeRound",
        layerIndex: 0,
        effectName: "Spirals",
        startMs: 0,
        endMs: 1000
      }
    }
  ];

  const verification = await verifyAppliedPlanReadback(plan, {
    endpoint: "http://127.0.0.1:49915/xlightsdesigner/api",
    planMetadata: {
      sequencingDesignHandoffSummary: "Big tree chorus",
      sequencingSectionDirectiveCount: 1,
      trainingKnowledge: {
        artifactType: "sequencer_stage1_training_bundle",
        artifactVersion: "1.0"
      },
      sequencingDesignHandoff: {
        designSummary: "Big tree chorus",
        focusPlan: {
          primaryTargetIds: ["TreeRound"]
        },
        propRoleAssignments: [
          { role: "lead", targetIds: ["TreeRound"] }
        ],
        sectionDirectives: [
          {
            sectionName: "Chorus",
            preferredVisualFamilies: ["spiral_flow"]
          }
        ]
      }
    },
    listEffects: async (_endpoint, { modelName, layerIndex, startMs, endMs }) => ({
      data: {
        effects: [{ modelName, layerIndex, startMs, endMs, effectName: "Spirals" }]
      }
    })
  });

  assert.equal(verification.expectedMutationsPresent, true);
  assert.equal(verification.designContext.designSummary, "Big tree chorus");
  assert.equal(verification.designContext.trainingKnowledge.artifactType, "sequencer_stage1_training_bundle");
  assert.deepEqual(verification.designAlignment.coveredPrimaryFocusTargetIds, ["TreeRound"]);
  assert.deepEqual(
    verification.designChecks.map((row) => [row.kind, row.ok]),
    [
      ["design-focus", true],
      ["design-role", true]
    ]
  );
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
    endpoint: "http://127.0.0.1:49915/xlightsdesigner/api",
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

test("apply readback verifies preservation moved a new effect without overwriting the original layer", async () => {
  const plan = [
    {
      cmd: "effects.create",
      params: {
        modelName: "Snowman",
        layerIndex: 1,
        effectName: "Color Wash",
        startMs: 1000,
        endMs: 2000
      },
      intent: {
        existingSequencePolicy: {
          replacementAuthorized: false,
          preserveExistingUnlessScoped: true,
          overlapCount: 1,
          originalLayerIndex: 0,
          plannedLayerIndex: 1,
          overlappingEffectNames: ["On"]
        }
      }
    }
  ];

  const verification = await verifyAppliedPlanReadback(plan, {
    endpoint: "http://127.0.0.1:49915/xlightsdesigner/api",
    listEffects: async (_endpoint, { modelName, layerIndex, startMs, endMs }) => ({
      data: {
        effects: layerIndex === 1
          ? [{ modelName, layerIndex, startMs, endMs, effectName: "Color Wash" }]
          : [{ modelName, layerIndex, startMs, endMs, effectName: "On" }]
      }
    })
  });

  assert.equal(verification.expectedMutationsPresent, true);
  assert.deepEqual(
    verification.checks.map((row) => [row.kind, row.target, row.ok]),
    [
      ["effect", "Snowman@1", true],
      ["effect-preservation", "Snowman@0->1", true]
    ]
  );
});

test("apply readback flags preservation when the original layer was overwritten", async () => {
  const plan = [
    {
      cmd: "effects.create",
      params: {
        modelName: "Snowman",
        layerIndex: 1,
        effectName: "Color Wash",
        startMs: 1000,
        endMs: 2000
      },
      intent: {
        existingSequencePolicy: {
          replacementAuthorized: false,
          preserveExistingUnlessScoped: true,
          overlapCount: 1,
          originalLayerIndex: 0,
          plannedLayerIndex: 1,
          overlappingEffectNames: ["On"]
        }
      }
    }
  ];

  const verification = await verifyAppliedPlanReadback(plan, {
    endpoint: "http://127.0.0.1:49915/xlightsdesigner/api",
    listEffects: async (_endpoint, { modelName, layerIndex, startMs, endMs }) => ({
      data: {
        effects: layerIndex === 1
          ? [{ modelName, layerIndex, startMs, endMs, effectName: "Color Wash" }]
          : []
      }
    })
  });

  assert.equal(verification.expectedMutationsPresent, false);
  assert.deepEqual(
    verification.checks.map((row) => [row.kind, row.target, row.ok]),
    [
      ["effect", "Snowman@1", true],
      ["effect-preservation", "Snowman@0->1", false]
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
    endpoint: "http://127.0.0.1:49915/xlightsdesigner/api",
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
    endpoint: "http://127.0.0.1:49915/xlightsdesigner/api",
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
    endpoint: "http://127.0.0.1:49915/xlightsdesigner/api",
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
    endpoint: "http://127.0.0.1:49915/xlightsdesigner/api",
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
