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
  assert.equal(classifyOrchestrationFailureReason("capability_gate"), "capability");
  assert.equal(classifyOrchestrationFailureReason("runtime", "transactions.begin returned no transactionId"), "runtime");
  assert.equal(classifyOrchestrationFailureReason("some-other-stage"), "unknown");
});

test("classifyOrchestrationFailureReason uses verification failures when present", () => {
  assert.equal(
    classifyOrchestrationFailureReason("validate_apply", "", {
      revisionAdvanced: false,
      expectedMutationsPresent: true
    }),
    "revision"
  );
  assert.equal(
    classifyOrchestrationFailureReason("validate_apply", "", {
      revisionAdvanced: true,
      expectedMutationsPresent: false
    }),
    "validate"
  );
});

test("classifyOrchestrationFailureReason uses error detail for blocked cases", () => {
  assert.equal(
    classifyOrchestrationFailureReason("graph", "Duplicate write command for timing.createTrack"),
    "validate"
  );
  assert.equal(
    classifyOrchestrationFailureReason("revision", "Revision mismatch. expected=rev-1 current=rev-2"),
    "revision"
  );
  assert.equal(
    classifyOrchestrationFailureReason("exception", "Apply blocked by capability gate: unsupported command"),
    "capability"
  );
});

test("sequence agent input gate validates context.layoutMode when provided", () => {
  const gate = validateSequenceAgentContractGate(
    "input",
    {
      agentRole: "sequence_agent",
      contractVersion: "1.0",
      requestId: "req-1",
      context: {
        sequenceRevision: "rev-1",
        endpoint: "http://127.0.0.1:49914/xlDoAutomation",
        layoutMode: "invalid",
        displayElements: [],
        groupIds: [],
        groupsById: {},
        submodelsById: {}
      },
      intentHandoff: { role: "designer_dialog" },
      safety: {
        timingOwnership: [],
        manualXdLocks: [],
        allowTimingWrites: true
      }
    },
    "orch-layout-mode"
  );
  assert.equal(gate.ok, false);
  assert.ok(gate.report.errors.some((e) => /context\\.layoutMode must be 2d\\|3d/i.test(String(e))));
});
