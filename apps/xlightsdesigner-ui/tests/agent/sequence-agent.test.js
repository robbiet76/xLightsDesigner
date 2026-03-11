import test from "node:test";
import assert from "node:assert/strict";

import { buildSequenceAgentPlan } from "../../agent/sequence-agent.js";
import { SEQUENCE_AGENT_CONTRACT_VERSION, SEQUENCE_AGENT_ROLE } from "../../agent/sequence-agent-contracts.js";

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
