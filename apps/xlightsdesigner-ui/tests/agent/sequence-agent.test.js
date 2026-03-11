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
