import test from "node:test";
import assert from "node:assert/strict";

import {
  SEQUENCE_AGENT_ROLE,
  SEQUENCE_AGENT_CONTRACT_VERSION,
  validateSequenceAgentInput,
  validateSequenceAgentPlanOutput,
  validateSequenceAgentApplyResult
} from "../../../agent/sequence-agent/sequence-agent-contracts.js";

function sampleInput(overrides = {}) {
  return {
    agentRole: SEQUENCE_AGENT_ROLE,
    contractVersion: SEQUENCE_AGENT_CONTRACT_VERSION,
    requestId: "req-1",
    context: {
      sequenceRevision: "rev-1",
      endpoint: "http://127.0.0.1:49914/xlDoAutomation",
      sequenceSettings: {
        supportsModelBlending: true
      },
      displayElements: [],
      groupIds: [],
      groupsById: {},
      submodelsById: {}
    },
    intentHandoff: {
      goal: "Build high-energy chorus"
    },
    analysisHandoff: null,
    planningScope: {
      sections: ["Chorus 1"]
    },
    safety: {
      manualXdLocks: [],
      timingOwnership: [],
      allowTimingWrites: true
    },
    ...overrides
  };
}

function samplePlan(overrides = {}) {
  return {
    agentRole: SEQUENCE_AGENT_ROLE,
    contractVersion: SEQUENCE_AGENT_CONTRACT_VERSION,
    planId: "plan-1",
    summary: "revise plan for chorus",
    baseRevision: "rev-1",
    validationReady: true,
    warnings: [],
    commands: [{ cmd: "timing.createTrack", params: { trackName: "XD: Sequencer Plan" } }],
    metadata: {
      mode: "revise",
      scope: {
        sections: ["Chorus 1"]
      },
      degradedMode: false
    },
    ...overrides
  };
}

function sampleApplyResult(overrides = {}) {
  return {
    agentRole: SEQUENCE_AGENT_ROLE,
    contractVersion: SEQUENCE_AGENT_CONTRACT_VERSION,
    planId: "plan-1",
    status: "applied",
    failureReason: null,
    currentRevision: "rev-1",
    nextRevision: "rev-2",
    verification: {
      revisionAdvanced: true
    },
    ...overrides
  };
}

test("sequence_agent input contract accepts degraded mode", () => {
  const errors = validateSequenceAgentInput(sampleInput({ analysisHandoff: null }));
  assert.deepEqual(errors, []);
});

test("sequence_agent input contract rejects missing required fields", () => {
  const errors = validateSequenceAgentInput(sampleInput({ requestId: "", safety: {} }));
  assert.ok(errors.some((e) => /requestId is required/i.test(e)));
  assert.ok(errors.some((e) => /safety.manualXdLocks is required/i.test(e)));
  assert.ok(errors.some((e) => /safety.timingOwnership is required/i.test(e)));
  assert.ok(errors.some((e) => /safety.allowTimingWrites is required/i.test(e)));
});

test("sequence_agent plan output contract requires metadata.degradedMode", () => {
  const errors = validateSequenceAgentPlanOutput(
    samplePlan({ metadata: { mode: "revise", scope: {} } })
  );
  assert.ok(errors.some((e) => /metadata.degradedMode is required/i.test(e)));
});

test("sequence_agent plan output contract accepts valid payload", () => {
  const errors = validateSequenceAgentPlanOutput(samplePlan());
  assert.deepEqual(errors, []);
});

test("sequence_agent apply result contract enforces status/failure reason enum", () => {
  const errors = validateSequenceAgentApplyResult(
    sampleApplyResult({ status: "oops", failureReason: "bad-value" })
  );
  assert.ok(errors.some((e) => /status must be applied\|blocked\|failed/i.test(e)));
  assert.ok(errors.some((e) => /failureReason must be/i.test(e)));
});

test("sequence_agent apply result contract accepts valid payload", () => {
  const errors = validateSequenceAgentApplyResult(sampleApplyResult());
  assert.deepEqual(errors, []);
});
