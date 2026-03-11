import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSequenceAgentInput,
  buildSequenceAgentApplyResult,
  validateSequenceAgentContractGate,
  classifyOrchestrationFailureReason
} from "../../agent/sequence-agent-runtime.js";

test("sequence agent input gate blocks invalid input payload", () => {
  const input = buildSequenceAgentInput({
    requestId: "",
    endpoint: "",
    sequenceRevision: "",
    intentHandoff: null
  });
  const gate = validateSequenceAgentContractGate("input", input, "orch-1");
  assert.equal(gate.ok, false);
  assert.equal(gate.report.stage, "input_contract");
  assert.ok(gate.report.errors.length > 0);
});

test("sequence agent plan gate blocks invalid output payload", () => {
  const gate = validateSequenceAgentContractGate(
    "plan",
    {
      agentRole: "sequence_agent",
      contractVersion: "1.0",
      planId: "p1",
      summary: "test",
      baseRevision: "rev-1",
      validationReady: false,
      warnings: [],
      commands: [],
      metadata: { degradedMode: true }
    },
    "orch-2"
  );
  assert.equal(gate.ok, false);
  assert.equal(gate.report.stage, "plan_contract");
  assert.ok(gate.report.errors.some((e) => /validationReady must be true/i.test(e)));
});

test("sequence agent apply gate blocks invalid apply result payload", () => {
  const result = buildSequenceAgentApplyResult({
    planId: "plan-1",
    status: "bad",
    failureReason: "not-a-reason"
  });
  const gate = validateSequenceAgentContractGate("apply", result, "orch-3");
  assert.equal(gate.ok, false);
  assert.equal(gate.report.stage, "apply_contract");
});

test("classifyOrchestrationFailureReason maps known stages", () => {
  assert.equal(classifyOrchestrationFailureReason("revision"), "revision");
  assert.equal(classifyOrchestrationFailureReason("validate_apply"), "validate");
  assert.equal(classifyOrchestrationFailureReason("xd_lock_gate"), "lock");
  assert.equal(classifyOrchestrationFailureReason("some-other-stage"), "unknown");
});
