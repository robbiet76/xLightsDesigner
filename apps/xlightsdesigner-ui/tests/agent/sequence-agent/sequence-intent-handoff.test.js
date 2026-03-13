import test from "node:test";
import assert from "node:assert/strict";

import { validateAgentHandoff } from "../../../agent/handoff-contracts.js";
import { buildCanonicalSequenceIntentHandoff } from "../../../agent/sequence-agent/sequence-intent-handoff.js";

test("canonical sequence intent handoff validates for direct technical requests", () => {
  const handoff = buildCanonicalSequenceIntentHandoff({
    normalizedIntent: {
      goal: "Put a green On effect on Border-01 for 30 seconds from the start",
      mode: "revise",
      targetIds: ["Border-01"],
      sections: ["General"],
      tags: [],
      tempoIntent: "hold",
      colorDirection: "warm",
      changeTolerance: "minimal",
      preserveTimingTracks: true
    },
    intentText: "Put a green On effect on Border-01 for 30 seconds from the start",
    elevatedRiskConfirmed: false
  });

  assert.equal(handoff.artifactType, "intent_handoff_v1");
  assert.equal(typeof handoff.artifactId, "string");
  assert.equal(typeof handoff.createdAt, "string");
  assert.equal(handoff.goal, "Put a green On effect on Border-01 for 30 seconds from the start");
  assert.equal(handoff.mode, "revise");
  assert.deepEqual(handoff.scope.targetIds, ["Border-01"]);
  assert.equal(handoff.approvalPolicy.requiresExplicitApprove, true);
  assert.deepEqual(validateAgentHandoff("intent_handoff_v1", handoff), []);
});

test("canonical sequence intent handoff prefers resolved writable targets when provided", () => {
  const handoff = buildCanonicalSequenceIntentHandoff({
    normalizedIntent: {
      goal: "Put a green On effect on Border-01 for 30 seconds from the start",
      mode: "revise",
      targetIds: ["Outlines"],
      sections: ["General"],
      tags: []
    },
    intentText: "Put a green On effect on Border-01 for 30 seconds from the start",
    resolvedTargetIds: ["Border-01"]
  });

  assert.deepEqual(handoff.scope.targetIds, ["Border-01"]);
});
