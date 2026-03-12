import test from "node:test";
import assert from "node:assert/strict";

import { buildDesignerPlanCommands } from "../../agent/command-builders.js";
import { buildEffectDefinitionCatalog } from "../../agent/effect-definition-catalog.js";

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
        direct: [{ id: "MegaTree", name: "MegaTree" }],
        flattenedAll: [{ id: "MegaTree", name: "MegaTree" }]
      }
    }
  };
}

test("command builders emit canonical command graph templates with dependencies", () => {
  const commands = buildDesignerPlanCommands([
    "Chorus 1 / MegaTree / increase pulse contrast and fade bars accents"
  ], {
    trackName: "XD: Sequencer Plan",
    effectCatalog: sampleCatalog()
  });

  assert.equal(commands[0].id, "timing.track.create");
  assert.equal(commands[1].id, "timing.marks.insert");
  assert.deepEqual(commands[1].dependsOn, ["timing.track.create"]);
  assert.equal(commands[2].cmd, "effects.create");
  assert.deepEqual(commands[2].dependsOn, ["timing.marks.insert"]);
  assert.equal(commands[2].params.effectName, "Bars");
  assert.equal(commands[2].params.settings.T_CHOICE_In_Transition_Type, "Fade");
  assert.equal(commands[2].params.settings.C_SLIDER_Contrast, 35);
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
