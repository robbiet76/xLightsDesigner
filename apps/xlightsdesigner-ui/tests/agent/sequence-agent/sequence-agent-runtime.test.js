import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSequenceAgentInput,
  buildSequenceAgentApplyResult,
  validateSequenceAgentContractGate,
  classifyOrchestrationFailureReason
} from "../../../agent/sequence-agent/sequence-agent-runtime.js";

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

test("sequence agent apply result preserves practical validation payload", () => {
  const result = buildSequenceAgentApplyResult({
    planId: "plan-2",
    status: "applied",
    failureReason: null,
    verification: { revisionAdvanced: true, expectedMutationsPresent: true },
    practicalValidation: {
      artifactType: "practical_sequence_validation_v1",
      overallOk: true
    }
  });
  assert.equal(result.practicalValidation.artifactType, "practical_sequence_validation_v1");
  assert.equal(result.practicalValidation.overallOk, true);
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
        sequenceSettings: {},
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
  assert.ok(gate.report.errors.some((e) => String(e).includes("context.layoutMode must be 2d|3d")));
});

test("sequence agent input gate requires context.sequenceSettings", () => {
  const gate = validateSequenceAgentContractGate(
    "input",
    {
      agentRole: "sequence_agent",
      contractVersion: "1.0",
      requestId: "req-sequence-settings",
      context: {
        sequenceRevision: "rev-1",
        endpoint: "http://127.0.0.1:49914/xlDoAutomation",
        layoutMode: "2d",
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
    "orch-sequence-settings"
  );
  assert.equal(gate.ok, false);
  assert.ok(gate.report.errors.some((e) => String(e).includes("context.sequenceSettings is required")));
});

test("sequence agent input derives xlightsLayout group memberships from scene graph", () => {
  const input = buildSequenceAgentInput({
    requestId: "req-layout",
    endpoint: "http://127.0.0.1:49914/xlDoAutomation",
    sequenceRevision: "rev-1",
    sequenceSettings: {},
    layoutMode: "2d",
    displayElements: [
      { id: "Wreath-01", name: "Wreath-01" },
      { id: "Wreathes", name: "Wreathes" }
    ],
    groupIds: ["Wreathes"],
    groupsById: {
      Wreathes: {
        id: "Wreathes",
        members: {
          direct: [{ id: "Wreath-01" }],
          active: [{ id: "Wreath-01" }],
          flattened: [{ id: "Wreath-01" }],
          flattenedAll: [{ id: "Wreath-01" }]
        }
      }
    },
    submodelsById: {},
    intentHandoff: { role: "designer_dialog" },
    safety: {
      timingOwnership: [],
      manualXdLocks: [],
      allowTimingWrites: true
    }
  });
  assert.deepEqual(input.context.xlightsLayout.groupMemberships, [
    {
      groupName: "Wreathes",
      directMembers: ["Wreath-01"],
      activeMembers: ["Wreath-01"],
      flattenedMembers: ["Wreath-01"],
      flattenedAllMembers: ["Wreath-01"]
    }
  ]);
  assert.ok(input.context.xlightsLayout.allTargetNames.includes("Wreath-01"));
  assert.ok(input.context.xlightsLayout.allTargetNames.includes("Wreathes"));
});

test("sequence agent input preserves artistic goal and revision objective artifacts", () => {
  const input = buildSequenceAgentInput({
    requestId: "req-artistic",
    endpoint: "http://127.0.0.1:49914/xlDoAutomation",
    sequenceRevision: "rev-1",
    sequenceSettings: {},
    displayElements: [],
    groupIds: [],
    groupsById: {},
    submodelsById: {},
    intentHandoff: { role: "designer_dialog" },
    sequenceArtisticGoal: {
      artifactType: "sequence_artistic_goal_v1",
      ladderLevel: "section"
    },
    sequenceRevisionObjective: {
      artifactType: "sequence_revision_objective_v1",
      ladderLevel: "section"
    },
    safety: {
      timingOwnership: [],
      manualXdLocks: [],
      allowTimingWrites: true
    }
  });

  assert.equal(input.sequenceArtisticGoal.artifactType, "sequence_artistic_goal_v1");
  assert.equal(input.sequenceRevisionObjective.artifactType, "sequence_revision_objective_v1");
});

test("sequence agent input preserves render validation evidence", () => {
  const input = buildSequenceAgentInput({
    requestId: "req-validation",
    endpoint: "http://127.0.0.1:49914/xlDoAutomation",
    sequenceRevision: "rev-1",
    sequenceSettings: {},
    displayElements: [],
    groupIds: [],
    groupsById: {},
    submodelsById: {},
    intentHandoff: { role: "designer_dialog" },
    renderValidationEvidence: {
      renderObservationRef: "/tmp/render-observation.json",
      progressionObservationRef: "/tmp/progression-observation.json"
    },
    safety: {
      timingOwnership: [],
      manualXdLocks: [],
      allowTimingWrites: true
    }
  });

  assert.equal(input.renderValidationEvidence.renderObservationRef, "/tmp/render-observation.json");
  assert.equal(input.renderValidationEvidence.progressionObservationRef, "/tmp/progression-observation.json");
});

test("sequence agent input preserves revision retry pressure artifact", () => {
  const input = buildSequenceAgentInput({
    requestId: "req-retry-pressure",
    endpoint: "http://127.0.0.1:49914/xlDoAutomation",
    sequenceRevision: "rev-1",
    sequenceSettings: {},
    layoutMode: "2d",
    displayElements: [],
    groupIds: [],
    groupsById: {},
    submodelsById: {},
    intentHandoff: { artifactType: "intent_handoff_v1" },
    safety: {
      timingOwnership: [],
      manualXdLocks: [],
      allowTimingWrites: true
    },
    revisionRetryPressure: {
      artifactType: "revision_retry_pressure_v1",
      signals: ["low_change_retry"]
    }
  });

  assert.equal(input.revisionRetryPressure.artifactType, "revision_retry_pressure_v1");
  assert.deepEqual(input.revisionRetryPressure.signals, ["low_change_retry"]);
});

test("sequence agent input preserves revision feedback artifact", () => {
  const input = buildSequenceAgentInput({
    requestId: "req-revision-feedback",
    endpoint: "http://127.0.0.1:49914/xlDoAutomation",
    sequenceRevision: "rev-1",
    sequenceSettings: {},
    layoutMode: "2d",
    displayElements: [],
    groupIds: [],
    groupsById: {},
    submodelsById: {},
    intentHandoff: { artifactType: "intent_handoff_v1" },
    safety: {
      timingOwnership: [],
      manualXdLocks: [],
      allowTimingWrites: true
    },
    revisionFeedback: {
      artifactType: "revision_feedback_v1",
      rejectionReasons: ["Rendered lead does not match the intended primary focus."]
    }
  });

  assert.equal(input.revisionFeedback.artifactType, "revision_feedback_v1");
  assert.deepEqual(input.revisionFeedback.rejectionReasons, ["Rendered lead does not match the intended primary focus."]);
});

test("sequence agent input preserves candidate selection context", () => {
  const input = buildSequenceAgentInput({
    requestId: "req-selection",
    endpoint: "http://127.0.0.1:49914",
    sequenceRevision: "rev-selection",
    sequenceSettings: { durationMs: 30000 },
    intentHandoff: { artifactType: "intent_handoff_v1" },
    candidateSelectionContext: {
      phase: "review",
      seed: "review::req-selection::rev-selection",
      explorationEnabled: true,
      unresolvedSignals: ["weak_contrast"]
    }
  });

  assert.equal(input.candidateSelectionContext.phase, "review");
  assert.equal(input.candidateSelectionContext.seed, "review::req-selection::rev-selection");
  assert.equal(input.candidateSelectionContext.explorationEnabled, true);
  assert.deepEqual(input.candidateSelectionContext.retryPressureSignals || [], []);
});
