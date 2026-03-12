import test from "node:test";
import assert from "node:assert/strict";

import { buildSequenceAgentPlan } from "../../agent/sequence-agent.js";
import { SEQUENCE_AGENT_CONTRACT_VERSION, SEQUENCE_AGENT_ROLE } from "../../agent/sequence-agent-contracts.js";
import { buildEffectDefinitionCatalog } from "../../agent/effect-definition-catalog.js";

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
    baseRevision: "rev-55"
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
  assert.equal(out.commands[0].params.trackName, "XD: Sequencer Plan");
  assert.equal(out.metadata.mode, "revise");
  assert.equal(out.metadata.degradedMode, false);
  assert.deepEqual(out.metadata.scope.sections, ["Chorus 1"]);
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
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create", "sequencer.setDisplayElementOrder"]
  });

  const reorder = out.commands.find((row) => row.cmd === "sequencer.setDisplayElementOrder");
  assert.ok(reorder);
  assert.deepEqual(
    reorder.params.orderedIds,
    ["Lyrics", "XD: Sequencer Plan", "AllModels", "MegaTree", "Roofline"]
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
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create", "sequencer.setDisplayElementOrder"]
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
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create", "sequencer.setDisplayElementOrder"]
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
    ["Beats", "XD: Sequencer Plan", "AllModels", "Frontline", "MegaTree"]
  );
  assert.equal(out.metadata.groupGraphCount, 3);
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
    sourceLines: ["Chorus 1 / Frontline / bars stagger members with brighter accents"],
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
    sourceLines: ["Chorus 1 / Frontline / bars mirror members and stagger members"],
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
      "Chorus 1 / Frontline / bars stagger members",
      "Chorus 1 / Frontline / bars stagger members"
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
