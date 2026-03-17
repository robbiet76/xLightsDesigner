import test from "node:test";
import assert from "node:assert/strict";

import { buildSequenceAgentPlan } from "../../../agent/sequence-agent/sequence-agent.js";
import { SEQUENCE_AGENT_CONTRACT_VERSION, SEQUENCE_AGENT_ROLE } from "../../../agent/sequence-agent/sequence-agent-contracts.js";
import { buildEffectDefinitionCatalog } from "../../../agent/sequence-agent/effect-definition-catalog.js";

function sampleAnalysis() {
  return {
    trackIdentity: { title: "Track A", artist: "Artist A" },
    structure: { sections: ["Intro", "Verse 1", "Chorus 1"] },
    briefSeed: { tone: "upbeat" }
  };
}

function sampleIntent() {
  return {
    goal: "Increase chorus energy on focal props",
    mode: "revise",
    scope: {
      targetIds: ["MegaTree", "Roofline"],
      tagNames: ["focal"],
      sections: ["Chorus 1"]
    }
  };
}

function sampleCatalog() {
  return buildEffectDefinitionCatalog([
    { effectName: "Bars", params: [] },
    { effectName: "Shimmer", params: [] },
    { effectName: "On", params: [] }
  ]);
}

function sampleGroups() {
  return {
    AllModels: {
      renderPolicy: {
        layout: "minimalGrid",
        defaultBufferStyle: "Default",
        category: "default"
      },
      members: {
        direct: [
          { id: "Frontline", name: "Frontline", isGroup: true },
          { id: "MegaTree", name: "MegaTree" },
          { id: "Roofline", name: "Roofline" }
        ],
        flattenedAll: [
          { id: "Frontline", name: "Frontline", isGroup: true },
          { id: "MegaTree", name: "MegaTree" },
          { id: "Roofline", name: "Roofline" }
        ]
      }
    },
    Frontline: {
      renderPolicy: {
        layout: "horizontal",
        defaultBufferStyle: "Horizontal Per Model",
        category: "per_model",
        availableBufferStyles: ["Default", "Horizontal Per Model", "Per Model Vertical Per Strand"]
      },
      members: {
        direct: [
          { id: "MegaTree", name: "MegaTree" },
          { id: "Roofline", name: "Roofline" }
        ],
        flattenedAll: [
          { id: "MegaTree", name: "MegaTree" },
          { id: "Roofline", name: "Roofline" }
        ]
      }
    },
    FrontlineDefault: {
      renderPolicy: {
        layout: "minimalGrid",
        defaultBufferStyle: "Default",
        category: "default"
      },
      members: {
        direct: [
          { id: "MegaTree", name: "MegaTree" },
          { id: "Roofline", name: "Roofline" }
        ],
        flattenedAll: [
          { id: "MegaTree", name: "MegaTree" },
          { id: "Roofline", name: "Roofline" }
        ]
      }
    },
    NestedFrontline: {
      renderPolicy: {
        layout: "Overlay - Centered",
        defaultBufferStyle: "Overlay - Centered",
        category: "overlay",
        availableBufferStyles: ["Overlay - Centered", "Overlay - Scaled", "Default"]
      },
      members: {
        direct: [
          { id: "Frontline", name: "Frontline", isGroup: true },
          { id: "WindowLeft", name: "WindowLeft" }
        ],
        flattenedAll: [
          { id: "MegaTree", name: "MegaTree" },
          { id: "Roofline", name: "Roofline" },
          { id: "WindowLeft", name: "WindowLeft" }
        ]
      }
    },
    PixelSpokes: {
      renderPolicy: {
        layout: "Per Model Vertical Per Strand",
        defaultBufferStyle: "Per Model Vertical Per Strand",
        category: "per_model_strand",
        availableBufferStyles: ["Per Model Vertical Per Strand", "Per Model Horizontal Per Strand", "Default"]
      },
      members: {
        direct: [
          { id: "Spoke1", name: "Spoke1" },
          { id: "Spoke2", name: "Spoke2" }
        ],
        flattenedAll: [
          { id: "Spoke1", name: "Spoke1" },
          { id: "Spoke2", name: "Spoke2" }
        ]
      }
    },
    StyleOnlyOverlay: {
      renderPolicy: {
        layout: "Overlay - Scaled",
        defaultBufferStyle: "Overlay - Scaled",
        category: "default",
        availableBufferStyles: ["Overlay - Centered", "Overlay - Scaled", "Default"]
      },
      members: {
        direct: [
          { id: "WindowA", name: "WindowA" },
          { id: "WindowB", name: "WindowB" }
        ],
        flattenedAll: [
          { id: "WindowA", name: "WindowA" },
          { id: "WindowB", name: "WindowB" }
        ]
      }
    }
  };
}

function sampleSubmodels() {
  return {
    "MegaTree/Star": {
      id: "MegaTree/Star",
      parentId: "MegaTree",
      renderPolicy: { submodelType: "ranges", bufferStyle: "Default", availableBufferStyles: ["Default", "Keep XY"] },
      membership: { nodeChannels: [1, 2, 3] }
    },
    "MegaTree/TopHalf": {
      id: "MegaTree/TopHalf",
      parentId: "MegaTree",
      renderPolicy: { submodelType: "ranges", bufferStyle: "Default", availableBufferStyles: ["Default", "Keep XY"] },
      membership: { nodeChannels: [3, 4, 5] }
    },
    "MegaTree/KeepXY": {
      id: "MegaTree/KeepXY",
      parentId: "MegaTree",
      renderPolicy: { submodelType: "ranges", bufferStyle: "Keep XY", availableBufferStyles: ["Default", "Keep XY", "Stacked Strands"] },
      membership: { nodeChannels: [6, 7, 8] }
    },
    "MegaTree/SubBuffer": {
      id: "MegaTree/SubBuffer",
      parentId: "MegaTree",
      renderPolicy: { submodelType: "subbuffer", bufferStyle: "Default", availableBufferStyles: ["Default"] },
      membership: { nodeChannels: [9, 10, 11] }
    },
    "Roofline/Left": {
      id: "Roofline/Left",
      parentId: "Roofline",
      renderPolicy: { submodelType: "ranges", bufferStyle: "Default", availableBufferStyles: ["Default"] },
      membership: { nodeChannels: [21, 22, 23] }
    },
    "Roofline/Right": {
      id: "Roofline/Right",
      parentId: "Roofline",
      renderPolicy: { submodelType: "ranges", bufferStyle: "Default", availableBufferStyles: ["Default"] },
      membership: { nodeChannels: [31, 32, 33] }
    }
  };
}

test("sequence_agent requires intent handoff", () => {
  assert.throws(
    () => buildSequenceAgentPlan({ analysisHandoff: sampleAnalysis(), intentHandoff: null }),
    /intent_handoff_v1 is required/i
  );
});

test("sequence_agent builds validated command plan from handoffs", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: sampleIntent(),
    sourceLines: [
      "Chorus 1 / MegaTree / increase pulse contrast and faster motion",
      "Chorus 1 / Roofline / mirror rhythm with delayed accents"
    ],
    baseRevision: "rev-55",
    effectCatalog: sampleCatalog()
  });

  assert.equal(typeof out.planId, "string");
  assert.equal(out.agentRole, SEQUENCE_AGENT_ROLE);
  assert.equal(out.contractVersion, SEQUENCE_AGENT_CONTRACT_VERSION);
  assert.equal(out.validationReady, true);
  assert.equal(out.baseRevision, "rev-55");
  assert.equal(Array.isArray(out.commands), true);
  assert.ok(out.commands.length > 0);
  assert.equal(out.commands[0].cmd, "timing.createTrack");
  assert.equal(out.commands[1].cmd, "timing.insertMarks");
  assert.equal(out.commands[0].params.trackName, "XD: Song Structure");
  assert.equal(out.metadata.mode, "revise");
  assert.equal(out.metadata.degradedMode, false);
  assert.deepEqual(out.metadata.scope.sections, ["Chorus 1"]);
  assert.equal(out.commands.some((row) => row.cmd === "effects.alignToTiming"), true);
});

test("sequence_agent uses analyzed section windows for scoped effect timing", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: {
      trackIdentity: { title: "Track A", artist: "Artist A" },
      structure: {
        sections: [
          { label: "Intro", startMs: 0, endMs: 10000 },
          { label: "Verse 1", startMs: 10000, endMs: 44000 },
          { label: "Chorus 1", startMs: 44000, endMs: 62000 }
        ]
      }
    },
    intentHandoff: {
      goal: "Add a Color Wash effect on Snowman during Chorus 1.",
      mode: "revise",
      scope: {
        targetIds: ["Snowman"],
        tagNames: [],
        sections: ["Chorus 1"]
      }
    },
    sourceLines: ["Chorus 1 / Snowman / apply Color Wash effect for the requested duration using the current target timing"],
    effectCatalog: buildEffectDefinitionCatalog([{ effectName: "Color Wash", params: [] }])
  });

  const markInsert = out.commands.find((row) => row.cmd === "timing.insertMarks");
  const trackCreate = out.commands.find((row) => row.cmd === "timing.createTrack");
  const effectCreate = out.commands.find((row) => row.cmd === "effects.create");

  assert.equal(trackCreate.params.trackName, "XD: Song Structure");
  assert.deepEqual(markInsert.params.marks, [
    { startMs: 0, endMs: 10000, label: "Intro" },
    { startMs: 10000, endMs: 44000, label: "Verse 1" },
    { startMs: 44000, endMs: 62000, label: "Chorus 1" }
  ]);
  assert.equal(markInsert.params.trackName, "XD: Song Structure");
  assert.equal(effectCreate.params.startMs, 44000);
  assert.equal(effectCreate.params.endMs, 62000);
  assert.equal(effectCreate.anchor.markLabel, "Chorus 1");
});

test("sequence_agent enables model blending when layered group refinement needs it", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: {
      goal: "Refine a broad group bed with focal prop detail",
      mode: "revise",
      scope: {
        targetIds: ["Frontline", "MegaTree"],
        tagNames: [],
        sections: ["Chorus 1"]
      }
    },
    sourceLines: [
      "Chorus 1 / Frontline / bars",
      "Chorus 1 / MegaTree / shimmer"
    ],
    baseRevision: "rev-57",
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "sequence.setSettings", "effects.create", "effects.alignToTiming"],
    effectCatalog: sampleCatalog(),
    sequenceSettings: { supportsModelBlending: false },
    groupIds: ["Frontline"],
    groupsById: sampleGroups()
  });

  const settingsCommand = out.commands.find((row) => row.cmd === "sequence.setSettings");
  assert.ok(settingsCommand);
  assert.equal(settingsCommand.params.supportsModelBlending, true);
});

test("sequence_agent falls back cleanly when effects.alignToTiming capability is unavailable", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: sampleIntent(),
    sourceLines: ["Chorus 1 / MegaTree / pulse"],
    baseRevision: "rev-56",
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create"],
    effectCatalog: sampleCatalog()
  });

  assert.equal(out.validationReady, true);
  assert.equal(out.commands.some((row) => row.cmd === "effects.alignToTiming"), false);
  assert.ok(out.warnings.some((row) => /effects\.alignToTiming capability unavailable/i.test(String(row))));
});

test("sequence_agent emits reduced-confidence warning when analysis is missing", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: null,
    intentHandoff: sampleIntent(),
    sourceLines: []
  });
  assert.ok(out.warnings.some((w) => /reduced-confidence/i.test(String(w))));
  assert.equal(out.validationReady, true);
  assert.equal(out.metadata.degradedMode, true);
  assert.ok(out.executionLines.length > 0);
});

test("sequence_agent planning stages run in deterministic order", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: sampleIntent(),
    sourceLines: ["Chorus 1 / MegaTree / pulse"]
  });
  assert.deepEqual(
    out.stageTelemetry.map((row) => row.stage),
    ["scope_resolution", "timing_asset_decision", "effect_strategy", "command_graph_synthesis"]
  );
  assert.equal(out.stageTelemetry.every((row) => row.status === "ok"), true);
});

test("sequence_agent produces deterministic stage outputs for same input", () => {
  const a = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: sampleIntent(),
    sourceLines: ["Chorus 1 / MegaTree / pulse", "Chorus 1 / Roofline / mirror"]
  });
  const b = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: sampleIntent(),
    sourceLines: ["Chorus 1 / MegaTree / pulse", "Chorus 1 / Roofline / mirror"]
  });
  assert.deepEqual(a.executionLines, b.executionLines);
  assert.deepEqual(a.metadata.stageOrder, b.metadata.stageOrder);
  assert.deepEqual(
    a.stageTelemetry.map((row) => ({ stage: row.stage, status: row.status })),
    b.stageTelemetry.map((row) => ({ stage: row.stage, status: row.status }))
  );
});

test("sequence_agent stage failure is classified and surfaced", () => {
  assert.throws(
    () =>
      buildSequenceAgentPlan({
        analysisHandoff: sampleAnalysis(),
        intentHandoff: sampleIntent(),
        sourceLines: [],
        stageOverrides: {
          effect_strategy: () => {
            throw new Error("forced-effect-failure");
          }
        }
      }),
    (err) => {
      assert.equal(err.stage, "effect_strategy");
      assert.equal(err.failureCategory, "strategy");
      assert.ok(Array.isArray(err.stageTelemetry));
      assert.equal(err.stageTelemetry.some((row) => row.stage === "effect_strategy" && row.status === "error"), true);
      return true;
    }
  );
});

test("sequence_agent blocks plan synthesis when required capabilities are missing", () => {
  assert.throws(
    () =>
      buildSequenceAgentPlan({
        analysisHandoff: sampleAnalysis(),
        intentHandoff: sampleIntent(),
        sourceLines: ["Chorus 1 / MegaTree / pulse"],
        capabilityCommands: ["timing.createTrack"]
      }),
    (err) => {
      assert.equal(err.stage, "command_graph_synthesis");
      assert.equal(err.failureCategory, "capability");
      assert.match(String(err.message || ""), /Unsupported command capabilities/i);
      return true;
    }
  );
});

test("sequence_agent annotates layout mode and warns for 2d operation mode", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: sampleIntent(),
    sourceLines: ["Chorus 1 / MegaTree / pulse"],
    layoutMode: "2d"
  });
  assert.equal(out.metadata.layoutMode, "2d");
  assert.ok(out.warnings.some((w) => /layout mode is 2d/i.test(String(w))));
});

test("sequence_agent keeps 3d mode without 2d warning", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: sampleIntent(),
    sourceLines: ["Chorus 1 / MegaTree / pulse"],
    layoutMode: "3d"
  });
  assert.equal(out.metadata.layoutMode, "3d");
  assert.equal(out.warnings.some((w) => /layout mode is 2d/i.test(String(w))), false);
});

test("sequence_agent maps mixed model/effect scenarios to validated templates", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: sampleIntent(),
    sourceLines: [
      "Chorus 1 / MegaTree / shimmer fade",
      "Chorus 1 / MegaTree / additive bars with brighter accents",
      "Chorus 1 / Roofline / hold steady glow"
    ],
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create"]
  });

  const effectCommands = out.commands.filter((row) => row.cmd === "effects.create");
  assert.equal(out.validationReady, true);
  assert.equal(effectCommands.length, 3);
  assert.deepEqual(
    effectCommands.map((row) => [row.params.modelName, row.params.layerIndex, row.params.effectName]),
    [
      ["MegaTree", 0, "Shimmer"],
      ["MegaTree", 1, "Bars"],
      ["Roofline", 0, "On"]
    ]
  );
  assert.deepEqual(out.commands[1].dependsOn, ["timing.track.create"]);
  assert.deepEqual(effectCommands[0].dependsOn, ["timing.marks.insert"]);
});

test("sequence_agent continues XD timing writes even when prior manual ownership exists", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: sampleIntent(),
    sourceLines: ["Chorus 1 / MegaTree / shimmer fade"],
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create"],
    timingOwnership: [{ sourceTrack: "XD: Sequencer Plan", manual: true, trackName: "Sequencer Plan" }]
  });

  assert.equal(out.commands.some((row) => row.cmd === "timing.createTrack"), true);
  assert.equal(out.commands.some((row) => row.cmd === "timing.insertMarks"), true);
  assert.equal(out.commands.some((row) => row.cmd === "effects.create"), true);
  assert.equal(out.warnings.some((w) => /user-owned\/manual/i.test(String(w))), false);
});

test("sequence_agent supports partial-scope apply planning", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: {
      goal: "Partial scope chorus touch-up",
      mode: "revise",
      scope: {
        targetIds: ["MegaTree"],
        tagNames: [],
        sections: ["Chorus 1"]
      }
    },
    sourceLines: ["Chorus 1 / MegaTree / shimmer fade"],
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create"]
  });

  assert.equal(out.validationReady, true);
  assert.ok(out.commands.length > 0);
  assert.deepEqual(out.metadata.scope.sections, ["Chorus 1"]);
  assert.deepEqual(out.metadata.scope.targetIds, ["MegaTree"]);
});

test("sequence_agent remains timing-name agnostic when existing track names vary", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: {
      trackIdentity: { title: "Track A", artist: "Artist A" },
      structure: { sections: ["Zydeco Christmas 2014: Main Grid", "Note Onsets", "Beats"] },
      briefSeed: { tone: "upbeat" }
    },
    intentHandoff: {
      goal: "Revise focal accents without assuming canonical timing names",
      mode: "revise",
      scope: {
        targetIds: ["MegaTree"],
        tagNames: [],
        sections: ["Zydeco Christmas 2014: Main Grid"]
      }
    },
    sourceLines: ["Zydeco Christmas 2014: Main Grid / MegaTree / shimmer fade"],
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create"],
    timingOwnership: [
      { sourceTrack: "Backup", manual: false, trackName: "Backup" },
      { sourceTrack: "Note Onsets", manual: false, trackName: "Note Onsets" },
      { sourceTrack: "60000ms Metronome", manual: false, trackName: "60000ms Metronome" }
    ]
  });

  assert.equal(out.validationReady, true);
  assert.equal(out.commands.some((row) => row.cmd === "timing.createTrack"), true);
  assert.deepEqual(out.metadata.scope.sections, ["Zydeco Christmas 2014: Main Grid"]);
  assert.equal(out.warnings.some((w) => /beats track name/i.test(String(w))), false);
  assert.equal(out.warnings.some((w) => /lyrics track name/i.test(String(w))), false);
});

test("sequence_agent supports dense submodel-heavy targeting", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: {
      trackIdentity: { title: "Track A", artist: "Artist A" },
      structure: { sections: ["Chorus 1"] },
      briefSeed: { tone: "upbeat" }
    },
    intentHandoff: {
      goal: "Drive face and hat submodels independently during chorus",
      mode: "revise",
      scope: {
        targetIds: ["Snowman Hat Beads", "Face1-Eyes", "Face2-Nose", "Face3-Mouth"],
        tagNames: [],
        sections: ["Chorus 1"]
      }
    },
    sourceLines: ["Chorus 1 / Whole Show / shimmer fade"],
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create"]
  });

  const effectCommands = out.commands.filter((row) => row.cmd === "effects.create");
  assert.equal(out.validationReady, true);
  assert.deepEqual(out.metadata.scope.targetIds, ["Snowman Hat Beads", "Face1-Eyes", "Face2-Nose", "Face3-Mouth"]);
  assert.deepEqual(
    effectCommands.map((row) => row.params.modelName),
    ["Snowman Hat Beads", "Face1-Eyes", "Face2-Nose", "Face3-Mouth"]
  );
});

test("sequence_agent collapses same-line parent and submodel overlap to the parent target", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: {
      goal: "Apply broad parent-level coverage without duplicating child overlap",
      mode: "revise",
      scope: {
        targetIds: ["MegaTree", "MegaTree/Star", "Roofline/Left"],
        tagNames: [],
        sections: ["Chorus 1"]
      }
    },
    sourceLines: ["Chorus 1 / Whole Show / bars"],
    submodelsById: sampleSubmodels(),
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create"]
  });

  const effectCommands = out.commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(effectCommands.map((row) => row.params.modelName), ["MegaTree", "Roofline/Left"]);
});

test("sequence_agent preserves explicit parent then submodel refinement on separate lines", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: {
      goal: "Lay broad model coverage then refine a child submodel",
      mode: "revise",
      scope: {
        targetIds: ["MegaTree", "MegaTree/Star"],
        tagNames: [],
        sections: ["Chorus 1"]
      }
    },
    sourceLines: [
      "Chorus 1 / MegaTree / bars",
      "Chorus 1 / MegaTree/Star / shimmer fade"
    ],
    submodelsById: sampleSubmodels(),
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create"]
  });

  const effectCommands = out.commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(
    effectCommands.map((row) => [row.params.modelName, row.params.effectName]),
    [
      ["MegaTree", "Bars"],
      ["MegaTree/Star", "Shimmer"]
    ]
  );
});

test("sequence_agent preserves submodel precision when same-line submodel uses non-default buffer style", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: {
      goal: "Keep precision when the submodel uses a materially different local buffer style",
      mode: "revise",
      scope: {
        targetIds: ["MegaTree", "MegaTree/KeepXY", "Roofline/Left"],
        tagNames: [],
        sections: ["Chorus 1"]
      }
    },
    sourceLines: ["Chorus 1 / Whole Show / bars"],
    submodelsById: sampleSubmodels(),
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create"]
  });

  const effectCommands = out.commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(effectCommands.map((row) => row.params.modelName), ["MegaTree/KeepXY", "Roofline/Left"]);
  assert.ok(
    out.warnings.some((row) => /Preserving submodel target MegaTree\/KeepXY/.test(String(row))),
    "expected submodel precision preservation warning"
  );
});

test("sequence_agent preserves submodel precision when same-line submodel uses subbuffer semantics", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: {
      goal: "Keep precision when the submodel uses subbuffer semantics",
      mode: "revise",
      scope: {
        targetIds: ["MegaTree", "MegaTree/SubBuffer", "Roofline/Left"],
        tagNames: [],
        sections: ["Chorus 1"]
      }
    },
    sourceLines: ["Chorus 1 / Whole Show / bars"],
    submodelsById: sampleSubmodels(),
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create"]
  });

  const effectCommands = out.commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(effectCommands.map((row) => row.params.modelName), ["MegaTree/SubBuffer", "Roofline/Left"]);
  assert.ok(
    out.warnings.some((row) => /Preserving submodel target MegaTree\/SubBuffer/.test(String(row))),
    "expected submodel precision preservation warning"
  );
});

test("sequence_agent collapses same-line overlapping sibling submodels to first explicit target", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: {
      goal: "Avoid duplicate broad writes across overlapping sibling submodels",
      mode: "revise",
      scope: {
        targetIds: ["MegaTree/Star", "MegaTree/TopHalf", "Roofline/Left"],
        tagNames: [],
        sections: ["Chorus 1"]
      }
    },
    sourceLines: ["Chorus 1 / Whole Show / bars"],
    submodelsById: sampleSubmodels(),
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create"]
  });

  const effectCommands = out.commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(effectCommands.map((row) => row.params.modelName), ["MegaTree/Star", "Roofline/Left"]);
});

test("sequence_agent preserves non-overlapping sibling submodels on same line", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: {
      goal: "Keep non-overlapping sibling submodels available as concurrent precision targets",
      mode: "revise",
      scope: {
        targetIds: ["Roofline/Left", "Roofline/Right"],
        tagNames: [],
        sections: ["Chorus 1"]
      }
    },
    sourceLines: ["Chorus 1 / Whole Show / bars"],
    submodelsById: sampleSubmodels(),
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create"]
  });

  const effectCommands = out.commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(effectCommands.map((row) => row.params.modelName), ["Roofline/Left", "Roofline/Right"]);
});

test("sequence_agent preserves group-first then specific-target ordering", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: {
      trackIdentity: { title: "Track A", artist: "Artist A" },
      structure: { sections: ["Chorus 1"] },
      briefSeed: { tone: "upbeat" }
    },
    intentHandoff: {
      goal: "Lay broad coverage on the group and refine focal props below it",
      mode: "revise",
      scope: {
        targetIds: ["AllModels", "MegaTree", "Roofline"],
        tagNames: [],
        sections: ["Chorus 1"]
      }
    },
    sourceLines: [
      "Chorus 1 / Whole Show / bars",
      "Chorus 1 / MegaTree / shimmer fade",
      "Chorus 1 / Roofline / hold steady glow"
    ],
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create"]
  });

  const effectCommands = out.commands.filter((row) => row.cmd === "effects.create");
  assert.equal(out.validationReady, true);
  assert.deepEqual(out.metadata.scope.targetIds, ["AllModels", "MegaTree", "Roofline"]);
  assert.deepEqual(
    effectCommands.map((row) => [row.params.modelName, row.params.effectName]),
    [
      ["AllModels", "Bars"],
      ["MegaTree", "Shimmer"],
      ["Roofline", "On"]
    ]
  );
});

test("sequence_agent emits explicit display-element ordering plan for group-first sequencing", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: {
      trackIdentity: { title: "Track A", artist: "Artist A" },
      structure: { sections: ["Chorus 1"] },
      briefSeed: { tone: "upbeat" }
    },
    intentHandoff: {
      goal: "Keep broad group coverage above focused props in display order",
      mode: "revise",
      scope: {
        targetIds: ["AllModels", "MegaTree", "Roofline"],
        tagNames: [],
        sections: ["Chorus 1"]
      }
    },
    sourceLines: [
      "Chorus 1 / Whole Show / bars",
      "Chorus 1 / MegaTree / shimmer fade",
      "Chorus 1 / Roofline / hold steady glow"
    ],
    displayElements: [
      { id: "Lyrics", type: "timing" },
      { id: "Roofline", type: "model" },
      { id: "MegaTree", type: "model" },
      { id: "AllModels", type: "model" }
    ],
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "sequence.setSettings", "effects.create", "sequencer.setDisplayElementOrder"]
  });

  const reorder = out.commands.find((row) => row.cmd === "sequencer.setDisplayElementOrder");
  assert.ok(reorder);
  assert.deepEqual(
    reorder.params.orderedIds,
    ["Lyrics", "XD: Song Structure", "AllModels", "MegaTree", "Roofline"]
  );
  assert.equal(out.metadata.displayElementCount, 4);
});

test("sequence_agent uses explicit xlights group ids for group-first planning", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: {
      trackIdentity: { title: "Track A", artist: "Artist A" },
      structure: { sections: ["Chorus 1"] },
      briefSeed: { tone: "upbeat" }
    },
    intentHandoff: {
      goal: "Keep frontline group coverage above focal props",
      mode: "revise",
      scope: {
        targetIds: ["Frontline", "MegaTree"],
        tagNames: [],
        sections: ["Chorus 1"]
      }
    },
    sourceLines: [
      "Chorus 1 / Whole Show / bars",
      "Chorus 1 / MegaTree / shimmer fade"
    ],
    displayElements: [
      { id: "Beats", type: "timing" },
      { id: "MegaTree", type: "model" },
      { id: "Frontline", type: "model" }
    ],
    groupIds: ["Frontline"],
    groupsById: {
      Frontline: {
        members: {
          direct: [{ id: "MegaTree", name: "MegaTree" }],
          flattenedAll: [{ id: "MegaTree", name: "MegaTree" }]
        }
      }
    },
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "sequence.setSettings", "effects.create", "sequencer.setDisplayElementOrder"]
  });

  const effectCommands = out.commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(
    effectCommands.map((row) => [row.params.modelName, row.params.effectName]),
    [
      ["Frontline", "Bars"],
      ["MegaTree", "Shimmer"]
    ]
  );
  assert.equal(out.metadata.groupCount, 1);
});

test("sequence_agent prefers the broadest explicit group target when nested groups are in scope", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: {
      goal: "Start with broad all-model coverage, then refine inside nested groups",
      mode: "revise",
      scope: {
        targetIds: ["Frontline", "AllModels", "MegaTree"],
        tagNames: [],
        sections: ["Chorus 1"]
      }
    },
    sourceLines: [
      "Chorus 1 / Whole Show / bars",
      "Chorus 1 / MegaTree / shimmer fade"
    ],
    displayElements: [
      { id: "Beats", type: "timing" },
      { id: "MegaTree", type: "model" },
      { id: "Frontline", type: "model" },
      { id: "AllModels", type: "model" }
    ],
    groupIds: ["Frontline", "AllModels"],
    groupsById: sampleGroups(),
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "sequence.setSettings", "effects.create", "sequencer.setDisplayElementOrder"]
  });

  const effectCommands = out.commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(
    effectCommands.map((row) => [row.params.modelName, row.params.effectName]),
    [
      ["AllModels", "Bars"],
      ["MegaTree", "Shimmer"]
    ]
  );

  const reorder = out.commands.find((row) => row.cmd === "sequencer.setDisplayElementOrder");
  assert.ok(reorder);
  assert.deepEqual(
    reorder.params.orderedIds,
    ["Beats", "XD: Song Structure", "AllModels", "Frontline", "MegaTree"]
  );
  assert.equal(out.metadata.groupGraphCount, 6);
});

test("sequence_agent prefers non-default group render targets when explicit scope is otherwise comparable", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: {
      goal: "Use the stronger group render target for broad coverage",
      mode: "revise",
      scope: {
        targetIds: ["FrontlineDefault", "Frontline"],
        tagNames: [],
        sections: ["Chorus 1"]
      }
    },
    sourceLines: ["Chorus 1 / Whole Show / bars"],
    groupIds: ["FrontlineDefault", "Frontline"],
    groupsById: sampleGroups(),
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create"]
  });

  const effectCommands = out.commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(effectCommands.map((row) => row.params.modelName), ["Frontline"]);
});

test("sequence_agent preserves explicit group targets unless per-member distribution is requested", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: {
      goal: "Keep the frontline group as a single render target",
      mode: "revise",
      scope: {
        targetIds: ["Frontline"],
        tagNames: [],
        sections: ["Chorus 1"]
      }
    },
    sourceLines: ["Chorus 1 / Frontline / bars"],
    groupIds: ["Frontline"],
    groupsById: sampleGroups(),
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create"]
  });

  const effectCommands = out.commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(effectCommands.map((row) => row.params.modelName), ["Frontline"]);
});

test("sequence_agent expands direct group members when per-member distribution is explicitly requested", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: {
      goal: "Distribute the frontline group across its member props",
      mode: "revise",
      scope: {
        targetIds: ["Frontline"],
        tagNames: [],
        sections: ["Chorus 1"]
      }
    },
    sourceLines: ["Chorus 1 / Frontline / bars per member stagger members with brighter accents"],
    groupIds: ["Frontline"],
    groupsById: sampleGroups(),
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create"]
  });

  const effectCommands = out.commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(
    effectCommands.map((row) => [row.params.modelName, row.params.startMs, row.params.endMs]),
    [
      ["MegaTree", 0, 500],
      ["Roofline", 500, 1000]
    ]
  );
});

test("sequence_agent preserves non-default group render targets for soft distribution phrases and warns", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: {
      goal: "Keep the frontline render semantics intact unless expansion is explicit",
      mode: "revise",
      scope: {
        targetIds: ["Frontline"],
        tagNames: [],
        sections: ["Chorus 1"]
      }
    },
    sourceLines: ["Chorus 1 / Frontline / bars stagger members"],
    groupIds: ["Frontline"],
    groupsById: sampleGroups(),
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create"]
  });

  const effectCommands = out.commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(effectCommands.map((row) => row.params.modelName), ["Frontline"]);
  assert.equal(
    out.warnings.some((w) => /Preserving group render target Frontline \(Horizontal Per Model\)/i.test(String(w))),
    true
  );
});

test("sequence_agent only expands non-default group render targets with explicit member override", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: {
      goal: "Distribute the frontline group across member props explicitly",
      mode: "revise",
      scope: {
        targetIds: ["Frontline"],
        tagNames: [],
        sections: ["Chorus 1"]
      }
    },
    sourceLines: ["Chorus 1 / Frontline / bars per member stagger members"],
    groupIds: ["Frontline"],
    groupsById: sampleGroups(),
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create"]
  });

  const effectCommands = out.commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(
    effectCommands.map((row) => [row.params.modelName, row.params.startMs, row.params.endMs]),
    [
      ["MegaTree", 0, 500],
      ["Roofline", 500, 1000]
    ]
  );
  assert.equal(out.warnings.some((w) => /explicit member override required/i.test(String(w))), false);
});

test("sequence_agent preserves high-risk overlay group render targets without force override and warns", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: {
      goal: "Keep overlay group render semantics intact unless expansion is forced",
      mode: "revise",
      scope: {
        targetIds: ["NestedFrontline"],
        tagNames: [],
        sections: ["Chorus 1"]
      }
    },
    sourceLines: ["Chorus 1 / NestedFrontline / bars per member stagger members"],
    groupIds: ["NestedFrontline", "Frontline"],
    groupsById: sampleGroups(),
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create"]
  });

  const effectCommands = out.commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(effectCommands.map((row) => row.params.modelName), ["NestedFrontline"]);
  assert.equal(
    out.warnings.some((w) => /Preserving high-risk group render target NestedFrontline \(Overlay - Centered\)/i.test(String(w))),
    true
  );
});

test("sequence_agent infers high-risk policy from buffer-style metadata even when category is default", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: {
      goal: "Keep overlay semantics inferred from buffer style intact unless expansion is forced",
      mode: "revise",
      scope: {
        targetIds: ["StyleOnlyOverlay"],
        tagNames: [],
        sections: ["Chorus 1"]
      }
    },
    sourceLines: ["Chorus 1 / StyleOnlyOverlay / bars per member stagger members"],
    groupIds: ["StyleOnlyOverlay"],
    groupsById: sampleGroups(),
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create"]
  });

  const effectCommands = out.commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(effectCommands.map((row) => row.params.modelName), ["StyleOnlyOverlay"]);
  assert.equal(
    out.warnings.some((w) => /Preserving high-risk group render target StyleOnlyOverlay \(Overlay - Scaled\)/i.test(String(w))),
    true
  );
});

test("sequence_agent only expands high-risk overlay group render targets with force override", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: {
      goal: "Distribute across all nested members only when explicitly forced",
      mode: "revise",
      scope: {
        targetIds: ["NestedFrontline"],
        tagNames: [],
        sections: ["Chorus 1"]
      }
    },
    sourceLines: ["Chorus 1 / NestedFrontline / bars force member expansion flatten members and stagger members"],
    groupIds: ["NestedFrontline", "Frontline"],
    groupsById: sampleGroups(),
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create"]
  });

  const effectCommands = out.commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(
    effectCommands.map((row) => [row.params.modelName, row.params.startMs, row.params.endMs]),
    [
      ["MegaTree", 0, 333],
      ["Roofline", 333, 666],
      ["WindowLeft", 666, 1000]
    ]
  );
  assert.equal(out.warnings.some((w) => /force member override required/i.test(String(w))), false);
});

test("sequence_agent preserves high-risk per-model-strand group render targets without force override and warns", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: {
      goal: "Keep per-model-strand render semantics intact unless expansion is forced",
      mode: "revise",
      scope: {
        targetIds: ["PixelSpokes"],
        tagNames: [],
        sections: ["Chorus 1"]
      }
    },
    sourceLines: ["Chorus 1 / PixelSpokes / bars per member stagger members"],
    groupIds: ["PixelSpokes"],
    groupsById: sampleGroups(),
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create"]
  });

  const effectCommands = out.commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(effectCommands.map((row) => row.params.modelName), ["PixelSpokes"]);
  assert.equal(
    out.warnings.some((w) => /Preserving high-risk group render target PixelSpokes \(Per Model Vertical Per Strand\)/i.test(String(w))),
    true
  );
});

test("sequence_agent only expands high-risk per-model-strand group render targets with force override", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: {
      goal: "Distribute across direct members only when explicitly forced",
      mode: "revise",
      scope: {
        targetIds: ["PixelSpokes"],
        tagNames: [],
        sections: ["Chorus 1"]
      }
    },
    sourceLines: ["Chorus 1 / PixelSpokes / bars force member expansion direct members and stagger members"],
    groupIds: ["PixelSpokes"],
    groupsById: sampleGroups(),
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create"]
  });

  const effectCommands = out.commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(
    effectCommands.map((row) => [row.params.modelName, row.params.startMs, row.params.endMs]),
    [
      ["Spoke1", 0, 500],
      ["Spoke2", 500, 1000]
    ]
  );
  assert.equal(out.warnings.some((w) => /force member override required/i.test(String(w))), false);
});

test("sequence_agent mirrors direct group member order when explicitly requested", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: {
      goal: "Reverse the frontline member order while distributing accents",
      mode: "revise",
      scope: {
        targetIds: ["Frontline"],
        tagNames: [],
        sections: ["Chorus 1"]
      }
    },
    sourceLines: ["Chorus 1 / Frontline / bars per member mirror members and stagger members"],
    groupIds: ["Frontline"],
    groupsById: sampleGroups(),
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create"]
  });

  const effectCommands = out.commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(
    effectCommands.map((row) => [row.params.modelName, row.params.startMs, row.params.endMs]),
    [
      ["Roofline", 0, 500],
      ["MegaTree", 500, 1000]
    ]
  );
});

test("sequence_agent expands flattened nested-group members when explicitly requested", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: {
      goal: "Distribute across all nested members of the grouped frontage",
      mode: "revise",
      scope: {
        targetIds: ["NestedFrontline"],
        tagNames: [],
        sections: ["Chorus 1"]
      }
    },
    sourceLines: ["Chorus 1 / NestedFrontline / bars flatten members and stagger members"],
    groupIds: ["NestedFrontline", "Frontline"],
    groupsById: sampleGroups(),
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create"]
  });

  const effectCommands = out.commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(
    effectCommands.map((row) => [row.params.modelName, row.params.startMs, row.params.endMs]),
    [
      ["MegaTree", 0, 333],
      ["Roofline", 333, 666],
      ["WindowLeft", 666, 1000]
    ]
  );
});

test("sequence_agent alternates distributed member order across repeated lines", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: {
      goal: "Repeat distributed member accents without replaying identical order",
      mode: "revise",
      scope: {
        targetIds: ["Frontline"],
        tagNames: [],
        sections: ["Chorus 1", "Chorus 2"]
      }
    },
    sourceLines: [
      "Chorus 1 / Frontline / bars per member stagger members",
      "Chorus 1 / Frontline / bars per member stagger members"
    ],
    groupIds: ["Frontline"],
    groupsById: sampleGroups(),
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create"]
  });

  const effectCommands = out.commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(
    effectCommands.map((row) => [row.params.modelName, row.params.startMs, row.params.endMs]),
    [
      ["MegaTree", 0, 500],
      ["Roofline", 500, 1000],
      ["Roofline", 0, 500],
      ["MegaTree", 500, 1000]
    ]
  );
});

test("sequence_agent rotates fanout member order across repeated lines", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: {
      goal: "Fan out a nested group across repeated lines without repeating member order",
      mode: "revise",
      scope: {
        targetIds: ["NestedFrontline"],
        tagNames: [],
        sections: ["Chorus 1"]
      }
    },
    sourceLines: [
      "Chorus 1 / NestedFrontline / bars fan out members flatten members and stagger members",
      "Chorus 1 / NestedFrontline / bars fan out members flatten members and stagger members",
      "Chorus 1 / NestedFrontline / bars fan out members flatten members and stagger members"
    ],
    groupIds: ["NestedFrontline", "Frontline"],
    groupsById: sampleGroups(),
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create"]
  });

  const effectCommands = out.commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(
    effectCommands.map((row) => row.params.modelName),
    [
      "MegaTree", "Roofline", "WindowLeft",
      "Roofline", "WindowLeft", "MegaTree",
      "WindowLeft", "MegaTree", "Roofline"
    ]
  );
});
