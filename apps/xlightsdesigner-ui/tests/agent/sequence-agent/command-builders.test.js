import test from "node:test";
import assert from "node:assert/strict";

import { buildDesignerPlanCommands } from "../../../agent/sequence-agent/command-builders.js";
import { buildEffectDefinitionCatalog } from "../../../agent/sequence-agent/effect-definition-catalog.js";

function sampleCatalog() {
  return buildEffectDefinitionCatalog([
    { effectName: "Bars", params: [] },
    { effectName: "Shimmer", params: [] },
    { effectName: "On", params: [] },
    { effectName: "Color Wash", params: [] }
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

test("command builders emit canonical command graph templates with dependencies", () => {
  const commands = buildDesignerPlanCommands([
    "Chorus 1 / MegaTree / increase pulse contrast and fade bars accents"
  ], {
    trackName: "XD: Sequencer Plan",
    effectCatalog: sampleCatalog(),
    enableEffectTimingAlignment: true
  });

  assert.equal(commands[0].id, "timing.track.create");
  assert.equal(commands[1].id, "timing.marks.insert");
  assert.deepEqual(commands[1].dependsOn, ["timing.track.create"]);
  assert.equal(commands[2].cmd, "effects.create");
  assert.deepEqual(commands[2].dependsOn, ["timing.marks.insert"]);
  assert.equal(commands[2].params.effectName, "Bars");
  assert.equal(commands[2].params.settings.T_CHOICE_In_Transition_Type, "Fade");
  assert.equal(commands[2].params.settings.C_SLIDER_Contrast, 35);
  assert.equal(commands[3].cmd, "effects.alignToTiming");
  assert.deepEqual(commands[3].dependsOn, ["effect.1"]);
  assert.equal(commands[3].params.timingTrackName, "XD: Sequencer Plan");
  assert.equal(commands[3].params.mode, "nearest");
});

test("command builders preserve direct imperative effect timing and color", () => {
  const commands = buildDesignerPlanCommands([
    "General / Border-01 / apply On effect in green for 30000 ms starting at 0 ms"
  ], {
    trackName: "XD: Sequencer Plan",
    effectCatalog: sampleCatalog(),
    enableEffectTimingAlignment: true
  });

  const marks = commands.find((row) => row.cmd === "timing.insertMarks");
  assert.equal(marks.params.marks.length, 1);
  assert.equal(marks.params.marks[0].startMs, 0);
  assert.equal(marks.params.marks[0].endMs, 30000);

  const effect = commands.find((row) => row.cmd === "effects.create");
  assert.equal(effect.params.modelName, "Border-01");
  assert.equal(effect.params.effectName, "On");
  assert.equal(effect.params.startMs, 0);
  assert.equal(effect.params.endMs, 30000);
  assert.equal(effect.params.palette.C_BUTTON_Palette1, "#00ff00");
  assert.equal(effect.params.palette.C_CHECKBOX_Palette1, "1");

  const align = commands.find((row) => row.cmd === "effects.alignToTiming");
  assert.equal(align.params.startMs, 0);
  assert.equal(align.params.endMs, 30000);
});

test("command builders apply contextual visual palette when line has no explicit color", () => {
  const commands = buildDesignerPlanCommands([
    "Chorus 1 / MegaTree / apply Shimmer effect with soft sparkle texture"
  ], {
    trackName: "XD: Sequencer Plan",
    effectCatalog: sampleCatalog(),
    enableEffectTimingAlignment: true,
    paletteContext: [
      { name: "candle gold", hex: "#ffc45c", role: "warm highlight" },
      { name: "pine green", hex: "#1f7a4d", role: "support base" }
    ]
  });

  const effect = commands.find((row) => row.cmd === "effects.create");
  assert.equal(effect.params.palette.C_BUTTON_Palette1, "#ffc45c");
  assert.equal(effect.params.palette.C_CHECKBOX_Palette1, "1");
  assert.equal(effect.params.palette.C_BUTTON_Palette2, "#1f7a4d");
  assert.equal(effect.params.palette.C_CHECKBOX_Palette2, "1");
});

test("command builders parse direct Color Wash request with explicit minute range", () => {
  const commands = buildDesignerPlanCommands([
    "General / Border-01 / add a Color Wash effect from 1 minute to the 2 minute mark"
  ], {
    effectCatalog: sampleCatalog(),
    enableEffectTimingAlignment: true
  });

  const marks = commands.find((row) => row.cmd === "timing.insertMarks");
  assert.equal(marks.params.marks.length, 1);
  assert.equal(marks.params.marks[0].startMs, 60000);
  assert.equal(marks.params.marks[0].endMs, 120000);

  const effect = commands.find((row) => row.cmd === "effects.create");
  assert.equal(effect.params.modelName, "Border-01");
  assert.equal(effect.params.effectName, "Color Wash");
  assert.equal(effect.params.startMs, 60000);
  assert.equal(effect.params.endMs, 120000);
  assert.deepEqual(effect.params.palette, {});

  const align = commands.find((row) => row.cmd === "effects.alignToTiming");
  assert.equal(align.params.startMs, 60000);
  assert.equal(align.params.endMs, 120000);
});

test("command builders use the full analyzed section set for XD Song Structure timing marks", () => {
  const commands = buildDesignerPlanCommands([
    "Chorus 1 / Snowman / add a Color Wash effect"
  ], {
    trackName: "XD: Song Structure",
    effectCatalog: sampleCatalog(),
    sectionWindowsByName: new Map([
      ["Intro", { startMs: 0, endMs: 8000 }],
      ["Verse 1", { startMs: 8000, endMs: 26000 }],
      ["Chorus 1", { startMs: 44000, endMs: 62000 }]
    ]),
    enableEffectTimingAlignment: true
  });

  const marks = commands.find((row) => row.cmd === "timing.insertMarks");
  assert.deepEqual(marks.params.marks, [
    { startMs: 0, endMs: 8000, label: "Intro" },
    { startMs: 8000, endMs: 26000, label: "Verse 1" },
    { startMs: 26000, endMs: 44000, label: "" },
    { startMs: 44000, endMs: 62000, label: "Chorus 1" }
  ]);
});

test("command builders can skip explicit timing re-alignment commands when capability is unavailable", () => {
  const commands = buildDesignerPlanCommands([
    "Chorus 1 / MegaTree / bars"
  ], {
    trackName: "XD: Sequencer Plan",
    effectCatalog: sampleCatalog(),
    enableEffectTimingAlignment: false
  });

  assert.equal(commands.some((row) => row.cmd === "effects.alignToTiming"), false);
  const effectCommand = commands.find((row) => row.cmd === "effects.create");
  assert.equal(effectCommand?.anchor?.trackName, "XD: Sequencer Plan");
});

test("command builders create layered mixed-model effects deterministically", () => {
  const commands = buildDesignerPlanCommands([
    "Chorus 1 / MegaTree / shimmer fade",
    "Chorus 1 / MegaTree / additive bars with brighter accents",
    "Chorus 1 / Roofline / hold steady glow"
  ], {
    effectCatalog: sampleCatalog()
  });

  const effectCommands = commands.filter((row) => row.cmd === "effects.create");
  assert.equal(effectCommands.length, 3);
  assert.deepEqual(
    effectCommands.map((row) => [row.params.modelName, row.params.layerIndex, row.params.effectName]),
    [
      ["MegaTree", 0, "Shimmer"],
      ["MegaTree", 1, "Bars"],
      ["Roofline", 0, "On"]
    ]
  );
  assert.equal(effectCommands[1].params.settings.T_CHOICE_LayerMethod, "Additive");
  assert.equal(effectCommands[1].params.settings.C_SLIDER_Brightness, 125);
});

test("command builders honor explicit target ids when proposal lines omit model names", () => {
  const commands = buildDesignerPlanCommands([
    "Bridge / Whole Show / shimmer fade with high contrast"
  ], {
    targetIds: ["MegaTree", "Roofline"],
    effectCatalog: sampleCatalog()
  });

  const effectCommands = commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(
    effectCommands.map((row) => row.params.modelName),
    ["MegaTree", "Roofline"]
  );
});

test("command builders prefer non-default group render targets when breadth is otherwise comparable", () => {
  const commands = buildDesignerPlanCommands([
    "Chorus 1 / Whole Show / bars"
  ], {
    targetIds: ["FrontlineDefault", "Frontline"],
    groupIds: ["FrontlineDefault", "Frontline"],
    groupsById: sampleGroups(),
    effectCatalog: sampleCatalog()
  });

  const effectCommands = commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(effectCommands.map((row) => row.params.modelName), ["Frontline"]);
});

test("command builders request model blending when broad group coverage is refined by specific targets", () => {
  const commands = buildDesignerPlanCommands([
    "Chorus 1 / Frontline / bars",
    "Chorus 1 / MegaTree / shimmer"
  ], {
    groupIds: ["Frontline"],
    groupsById: sampleGroups(),
    sequenceSettings: { supportsModelBlending: false },
    effectCatalog: sampleCatalog()
  });

  const settingsCommand = commands.find((row) => row.cmd === "sequence.setSettings");
  assert.ok(settingsCommand);
  assert.equal(settingsCommand.params.supportsModelBlending, true);
  const effectCommands = commands.filter((row) => row.cmd === "effects.create");
  assert.ok(effectCommands.every((row) => row.dependsOn.includes("sequence.settings.update")));
});

test("command builders do not emit sequence blending update when blending is already enabled", () => {
  const commands = buildDesignerPlanCommands([
    "Chorus 1 / Frontline / bars",
    "Chorus 1 / MegaTree / shimmer"
  ], {
    groupIds: ["Frontline"],
    groupsById: sampleGroups(),
    sequenceSettings: { supportsModelBlending: true },
    effectCatalog: sampleCatalog()
  });

  assert.equal(commands.some((row) => row.cmd === "sequence.setSettings"), false);
});

test("command builders stay style-neutral when source lines do not request shared settings", () => {
  const commands = buildDesignerPlanCommands([
    "Verse 1 / MegaTree / bars"
  ], {
    effectCatalog: sampleCatalog()
  });

  const effectCommand = commands.find((row) => row.cmd === "effects.create");
  assert.ok(effectCommand);
  assert.equal(effectCommand.params.effectName, "Bars");
  assert.deepEqual(effectCommand.params.settings, {});
});

test("command builders preserve explicit dense submodel targets", () => {
  const commands = buildDesignerPlanCommands([
    "Chorus 1 / Whole Show / shimmer fade"
  ], {
    targetIds: ["Snowman Hat Beads", "Face1-Eyes", "Face2-Nose", "Face3-Mouth"],
    effectCatalog: sampleCatalog()
  });

  const effectCommands = commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(
    effectCommands.map((row) => row.params.modelName),
    ["Snowman Hat Beads", "Face1-Eyes", "Face2-Nose", "Face3-Mouth"]
  );
  assert.equal(new Set(effectCommands.map((row) => row.params.modelName)).size, 4);
});

test("command builders collapse same-line parent and submodel overlap to the parent target", () => {
  const commands = buildDesignerPlanCommands([
    "Chorus 1 / Whole Show / bars"
  ], {
    targetIds: ["MegaTree", "MegaTree/Star", "Roofline/Left"],
    submodelsById: sampleSubmodels(),
    effectCatalog: sampleCatalog()
  });

  const effectCommands = commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(effectCommands.map((row) => row.params.modelName), ["MegaTree", "Roofline/Left"]);
});

test("command builders preserve explicit parent then submodel refinement on separate lines", () => {
  const commands = buildDesignerPlanCommands([
    "Chorus 1 / MegaTree / bars",
    "Chorus 1 / MegaTree/Star / shimmer fade"
  ], {
    submodelsById: sampleSubmodels(),
    effectCatalog: sampleCatalog()
  });

  const effectCommands = commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(
    effectCommands.map((row) => [row.params.modelName, row.params.effectName]),
    [
      ["MegaTree", "Bars"],
      ["MegaTree/Star", "Shimmer"]
    ]
  );
});

test("command builders preserve submodel precision when same-line submodel uses non-default buffer style", () => {
  const commands = buildDesignerPlanCommands([
    "Chorus 1 / Whole Show / bars"
  ], {
    targetIds: ["MegaTree", "MegaTree/KeepXY", "Roofline/Left"],
    submodelsById: sampleSubmodels(),
    effectCatalog: sampleCatalog()
  });

  const effectCommands = commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(effectCommands.map((row) => row.params.modelName), ["MegaTree/KeepXY", "Roofline/Left"]);
});

test("command builders preserve submodel precision when same-line submodel uses subbuffer semantics", () => {
  const commands = buildDesignerPlanCommands([
    "Chorus 1 / Whole Show / bars"
  ], {
    targetIds: ["MegaTree", "MegaTree/SubBuffer", "Roofline/Left"],
    submodelsById: sampleSubmodels(),
    effectCatalog: sampleCatalog()
  });

  const effectCommands = commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(effectCommands.map((row) => row.params.modelName), ["MegaTree/SubBuffer", "Roofline/Left"]);
});

test("command builders preserve sibling submodels when parent target is absent", () => {
  const commands = buildDesignerPlanCommands([
    "Chorus 1 / Whole Show / shimmer fade"
  ], {
    targetIds: ["Roofline/Left", "Roofline/Right"],
    submodelsById: sampleSubmodels(),
    effectCatalog: sampleCatalog()
  });

  const effectCommands = commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(effectCommands.map((row) => row.params.modelName), ["Roofline/Left", "Roofline/Right"]);
});

test("command builders collapse same-line overlapping sibling submodels to first explicit target", () => {
  const commands = buildDesignerPlanCommands([
    "Chorus 1 / Whole Show / bars"
  ], {
    targetIds: ["MegaTree/Star", "MegaTree/TopHalf", "Roofline/Left"],
    submodelsById: sampleSubmodels(),
    effectCatalog: sampleCatalog()
  });

  const effectCommands = commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(effectCommands.map((row) => row.params.modelName), ["MegaTree/Star", "Roofline/Left"]);
});

test("command builders preserve non-overlapping sibling submodels on same line", () => {
  const commands = buildDesignerPlanCommands([
    "Chorus 1 / Whole Show / bars"
  ], {
    targetIds: ["Roofline/Left", "Roofline/Right"],
    submodelsById: sampleSubmodels(),
    effectCatalog: sampleCatalog()
  });

  const effectCommands = commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(effectCommands.map((row) => row.params.modelName), ["Roofline/Left", "Roofline/Right"]);
});

test("command builders preserve explicit group-first then specific target ordering", () => {
  const commands = buildDesignerPlanCommands([
    "Chorus 1 / Whole Show / bars",
    "Chorus 1 / MegaTree / shimmer fade",
    "Chorus 1 / Roofline / hold steady glow"
  ], {
    targetIds: ["AllModels", "MegaTree", "Roofline"],
    effectCatalog: sampleCatalog()
  });

  const effectCommands = commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(
    effectCommands.map((row) => [row.params.modelName, row.params.effectName]),
    [
      ["AllModels", "Bars"],
      ["MegaTree", "Shimmer"],
      ["Roofline", "On"]
    ]
  );
});

test("command builders emit explicit display-element reorder command when current order is available", () => {
  const commands = buildDesignerPlanCommands([
    "Chorus 1 / Whole Show / bars",
    "Chorus 1 / MegaTree / shimmer fade"
  ], {
    targetIds: ["AllModels", "MegaTree"],
    displayElements: [
      { id: "Lyrics", type: "timing" },
      { id: "Roofline", type: "model" },
      { id: "MegaTree", type: "model" },
      { id: "AllModels", type: "model" }
    ],
    effectCatalog: sampleCatalog()
  });

  const reorder = commands.find((row) => row.cmd === "sequencer.setDisplayElementOrder");
  assert.ok(reorder);
  assert.deepEqual(
    reorder.params.orderedIds,
    ["Lyrics", "XD:ProposedPlan", "AllModels", "MegaTree", "Roofline"]
  );

  const effectCommands = commands.filter((row) => row.cmd === "effects.create");
  assert.equal(effectCommands.every((row) => row.dependsOn.includes("display.order.apply")), true);
});

test("command builders treat xlights-known group ids as aggregate targets even without aggregate naming", () => {
  const commands = buildDesignerPlanCommands([
    "Chorus 1 / Whole Show / bars",
    "Chorus 1 / MegaTree / shimmer fade"
  ], {
    targetIds: ["Frontline", "MegaTree"],
    groupIds: ["Frontline"],
    groupsById: {
      Frontline: {
        members: {
          direct: [{ id: "MegaTree", name: "MegaTree" }],
          flattenedAll: [{ id: "MegaTree", name: "MegaTree" }]
        }
      }
    },
    displayElements: [
      { id: "Beats", type: "timing" },
      { id: "MegaTree", type: "model" },
      { id: "Frontline", type: "model" }
    ],
    effectCatalog: sampleCatalog()
  });

  const effectCommands = commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(
    effectCommands.map((row) => [row.params.modelName, row.params.effectName]),
    [
      ["Frontline", "Bars"],
      ["MegaTree", "Shimmer"]
    ]
  );

  const reorder = commands.find((row) => row.cmd === "sequencer.setDisplayElementOrder");
  assert.ok(reorder);
  assert.deepEqual(
    reorder.params.orderedIds,
    ["Beats", "XD:ProposedPlan", "Frontline", "MegaTree"]
  );
});

test("command builders prefer the broadest explicit group target for generic-scope lines", () => {
  const commands = buildDesignerPlanCommands([
    "Chorus 1 / Whole Show / bars",
    "Chorus 1 / MegaTree / shimmer fade"
  ], {
    targetIds: ["Frontline", "AllModels", "MegaTree"],
    groupIds: ["Frontline", "AllModels"],
    groupsById: sampleGroups(),
    displayElements: [
      { id: "Beats", type: "timing" },
      { id: "MegaTree", type: "model" },
      { id: "Frontline", type: "model" },
      { id: "AllModels", type: "model" }
    ],
    effectCatalog: sampleCatalog()
  });

  const effectCommands = commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(
    effectCommands.map((row) => [row.params.modelName, row.params.effectName]),
    [
      ["AllModels", "Bars"],
      ["MegaTree", "Shimmer"]
    ]
  );

  const reorder = commands.find((row) => row.cmd === "sequencer.setDisplayElementOrder");
  assert.ok(reorder);
  assert.deepEqual(
    reorder.params.orderedIds,
    ["Beats", "XD:ProposedPlan", "AllModels", "Frontline", "MegaTree"]
  );
});

test("command builders preserve explicit group targets by default", () => {
  const commands = buildDesignerPlanCommands([
    "Chorus 1 / Frontline / bars"
  ], {
    targetIds: ["Frontline", "MegaTree"],
    groupIds: ["Frontline"],
    groupsById: sampleGroups(),
    effectCatalog: sampleCatalog()
  });

  const effectCommands = commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(
    effectCommands.map((row) => row.params.modelName),
    ["Frontline"]
  );
  assert.deepEqual(
    effectCommands.map((row) => row.anchor),
    [{
      kind: "timing_track",
      trackName: "XD:ProposedPlan",
      markLabel: "Chorus 1",
      startMs: 0,
      endMs: 1000,
      basis: "section_window"
    }]
  );
});

test("command builders expand direct group members when request explicitly asks for distribution", () => {
  const commands = buildDesignerPlanCommands([
    "Chorus 1 / Frontline / bars per member stagger members with brighter accents"
  ], {
    targetIds: ["Frontline", "MegaTree"],
    groupIds: ["Frontline"],
    groupsById: sampleGroups(),
    effectCatalog: sampleCatalog()
  });

  const effectCommands = commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(
    effectCommands.map((row) => [row.params.modelName, row.params.startMs, row.params.endMs]),
    [
      ["MegaTree", 0, 500],
      ["Roofline", 500, 1000]
    ]
  );
  assert.deepEqual(
    effectCommands.map((row) => row.anchor),
    [
      {
        kind: "timing_track",
        trackName: "XD:ProposedPlan",
        markLabel: "Chorus 1",
        startMs: 0,
        endMs: 500,
        basis: "section_slice"
      },
      {
        kind: "timing_track",
        trackName: "XD:ProposedPlan",
        markLabel: "Chorus 1",
        startMs: 500,
        endMs: 1000,
        basis: "section_slice"
      }
    ]
  );
});

test("command builders preserve non-default group render targets for soft distribution phrases", () => {
  const commands = buildDesignerPlanCommands([
    "Chorus 1 / Frontline / bars stagger members"
  ], {
    targetIds: ["Frontline"],
    groupIds: ["Frontline"],
    groupsById: sampleGroups(),
    effectCatalog: sampleCatalog()
  });

  const effectCommands = commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(
    effectCommands.map((row) => row.params.modelName),
    ["Frontline"]
  );
});

test("command builders only expand non-default group render targets with explicit member override", () => {
  const commands = buildDesignerPlanCommands([
    "Chorus 1 / Frontline / bars per member stagger members"
  ], {
    targetIds: ["Frontline"],
    groupIds: ["Frontline"],
    groupsById: sampleGroups(),
    effectCatalog: sampleCatalog()
  });

  const effectCommands = commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(
    effectCommands.map((row) => [row.params.modelName, row.params.startMs, row.params.endMs]),
    [
      ["MegaTree", 0, 500],
      ["Roofline", 500, 1000]
    ]
  );
  assert.deepEqual(
    effectCommands.map((row) => [row.params.sourceGroupId, row.params.sourceGroupRenderPolicy, row.params.sourceGroupBufferStyle]),
    [
      ["Frontline", "per_model", "Horizontal Per Model"],
      ["Frontline", "per_model", "Horizontal Per Model"]
    ]
  );
});

test("command builders preserve high-risk overlay group render targets without force override", () => {
  const commands = buildDesignerPlanCommands([
    "Chorus 1 / NestedFrontline / bars per member stagger members"
  ], {
    targetIds: ["NestedFrontline"],
    groupIds: ["NestedFrontline", "Frontline"],
    groupsById: sampleGroups(),
    effectCatalog: sampleCatalog()
  });

  const effectCommands = commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(effectCommands.map((row) => row.params.modelName), ["NestedFrontline"]);
});

test("command builders infer high-risk policy from buffer-style metadata even when category is default", () => {
  const commands = buildDesignerPlanCommands([
    "Chorus 1 / StyleOnlyOverlay / bars per member stagger members"
  ], {
    targetIds: ["StyleOnlyOverlay"],
    groupIds: ["StyleOnlyOverlay"],
    groupsById: sampleGroups(),
    effectCatalog: sampleCatalog()
  });

  const effectCommands = commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(effectCommands.map((row) => row.params.modelName), ["StyleOnlyOverlay"]);
});

test("command builders only expand high-risk overlay group render targets with force override", () => {
  const commands = buildDesignerPlanCommands([
    "Chorus 1 / NestedFrontline / bars force member expansion flatten members and stagger members"
  ], {
    targetIds: ["NestedFrontline"],
    groupIds: ["NestedFrontline", "Frontline"],
    groupsById: sampleGroups(),
    effectCatalog: sampleCatalog()
  });

  const effectCommands = commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(
    effectCommands.map((row) => [row.params.modelName, row.params.startMs, row.params.endMs]),
    [
      ["MegaTree", 0, 333],
      ["Roofline", 333, 666],
      ["WindowLeft", 666, 1000]
    ]
  );
  assert.equal(effectCommands.every((row) => row.params.sourceGroupRenderPolicy === "overlay"), true);
});

test("command builders preserve high-risk per-model-strand group render targets without force override", () => {
  const commands = buildDesignerPlanCommands([
    "Chorus 1 / PixelSpokes / bars per member stagger members"
  ], {
    targetIds: ["PixelSpokes"],
    groupIds: ["PixelSpokes"],
    groupsById: sampleGroups(),
    effectCatalog: sampleCatalog()
  });

  const effectCommands = commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(effectCommands.map((row) => row.params.modelName), ["PixelSpokes"]);
});

test("command builders only expand high-risk per-model-strand group render targets with force override", () => {
  const commands = buildDesignerPlanCommands([
    "Chorus 1 / PixelSpokes / bars force member expansion direct members and stagger members"
  ], {
    targetIds: ["PixelSpokes"],
    groupIds: ["PixelSpokes"],
    groupsById: sampleGroups(),
    effectCatalog: sampleCatalog()
  });

  const effectCommands = commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(
    effectCommands.map((row) => [row.params.modelName, row.params.startMs, row.params.endMs]),
    [
      ["Spoke1", 0, 500],
      ["Spoke2", 500, 1000]
    ]
  );
});

test("command builders reverse direct group member order when mirror distribution is requested", () => {
  const commands = buildDesignerPlanCommands([
    "Chorus 1 / Frontline / bars per member mirror members and stagger members"
  ], {
    targetIds: ["Frontline"],
    groupIds: ["Frontline"],
    groupsById: sampleGroups(),
    effectCatalog: sampleCatalog()
  });

  const effectCommands = commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(
    effectCommands.map((row) => [row.params.modelName, row.params.startMs, row.params.endMs]),
    [
      ["Roofline", 0, 500],
      ["MegaTree", 500, 1000]
    ]
  );
});

test("command builders can expand flattened members for nested groups when explicitly requested", () => {
  const commands = buildDesignerPlanCommands([
    "Chorus 1 / NestedFrontline / bars flatten members and stagger members"
  ], {
    targetIds: ["NestedFrontline"],
    groupIds: ["NestedFrontline", "Frontline"],
    groupsById: sampleGroups(),
    effectCatalog: sampleCatalog()
  });

  const effectCommands = commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(
    effectCommands.map((row) => [row.params.modelName, row.params.startMs, row.params.endMs]),
    [
      ["MegaTree", 0, 333],
      ["Roofline", 333, 666],
      ["WindowLeft", 666, 1000]
    ]
  );
});

test("command builders alternate distributed member order across repeated lines", () => {
  const commands = buildDesignerPlanCommands([
    "Chorus 1 / Frontline / bars per member stagger members",
    "Chorus 1 / Frontline / bars per member stagger members"
  ], {
    targetIds: ["Frontline"],
    groupIds: ["Frontline"],
    groupsById: sampleGroups(),
    effectCatalog: sampleCatalog()
  });

  const effectCommands = commands.filter((row) => row.cmd === "effects.create");
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

test("command builders rotate fanout member order across repeated lines", () => {
  const commands = buildDesignerPlanCommands([
    "Chorus 1 / NestedFrontline / bars fan out members flatten members and stagger members",
    "Chorus 1 / NestedFrontline / bars fan out members flatten members and stagger members",
    "Chorus 1 / NestedFrontline / bars fan out members flatten members and stagger members"
  ], {
    targetIds: ["NestedFrontline"],
    groupIds: ["NestedFrontline", "Frontline"],
    groupsById: sampleGroups(),
    effectCatalog: sampleCatalog()
  });

  const effectCommands = commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(
    effectCommands.map((row) => row.params.modelName),
    [
      "MegaTree", "Roofline", "WindowLeft",
      "Roofline", "WindowLeft", "MegaTree",
      "WindowLeft", "MegaTree", "Roofline"
    ]
  );
});

test("command builders clamp final XD song structure mark to duration minus one", () => {
  const commands = buildDesignerPlanCommands([
    "Intro / MegaTree / color wash",
    "Verse 1 / Roofline / shimmer"
  ], {
    trackName: "XD: Song Structure",
    sequenceSettings: { durationMs: 2000 },
    sectionWindowsByName: new Map([
      ["Intro", { startMs: 0, endMs: 1000 }],
      ["Verse 1", { startMs: 1000, endMs: 2000 }]
    ]),
    targetIds: ["MegaTree", "Roofline"],
    effectCatalog: sampleCatalog()
  });

  const timingInsert = commands.find((row) => row.cmd === "timing.insertMarks");
  assert.deepEqual(timingInsert.params.marks, [
    { startMs: 0, endMs: 1000, label: "Intro" },
    { startMs: 1000, endMs: 1999, label: "Verse 1" }
  ]);
});

test("command builders fill XD song structure gaps with unlabeled segments", () => {
  const commands = buildDesignerPlanCommands([
    "Intro / MegaTree / color wash",
    "Chorus 1 / Roofline / shimmer"
  ], {
    trackName: "XD: Song Structure",
    sequenceSettings: { durationMs: 3000 },
    sectionWindowsByName: new Map([
      ["Intro", { startMs: 0, endMs: 1000 }],
      ["Chorus 1", { startMs: 2000, endMs: 3000 }]
    ]),
    targetIds: ["MegaTree", "Roofline"],
    effectCatalog: sampleCatalog()
  });

  const timingInsert = commands.find((row) => row.cmd === "timing.insertMarks");
  assert.deepEqual(timingInsert.params.marks, [
    { startMs: 0, endMs: 1000, label: "Intro" },
    { startMs: 1000, endMs: 2000, label: "" },
    { startMs: 2000, endMs: 2999, label: "Chorus 1" }
  ]);
});
