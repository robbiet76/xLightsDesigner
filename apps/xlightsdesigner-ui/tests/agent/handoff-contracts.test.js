import test from "node:test";
import assert from "node:assert/strict";

import { AGENT_HANDOFF_CONTRACTS, validateAgentHandoff } from "../../agent/handoff-contracts.js";

test("handoff contracts list is stable", () => {
  assert.deepEqual(AGENT_HANDOFF_CONTRACTS, [
    "analysis_handoff_v1",
    "intent_handoff_v1",
    "plan_handoff_v1"
  ]);
});

test("analysis handoff requires structure sections", () => {
  const errors = validateAgentHandoff("analysis_handoff_v1", {
    trackIdentity: {},
    timing: {},
    structure: {},
    lyrics: {},
    chords: {},
    briefSeed: {},
    evidence: {}
  });
  assert.ok(errors.some((e) => /structure\.sections is required/i.test(e)));
});

test("intent handoff validates mode enum", () => {
  const errors = validateAgentHandoff("intent_handoff_v1", {
    goal: "test",
    mode: "invalid-mode",
    scope: {},
    constraints: {},
    directorPreferences: {},
    approvalPolicy: {}
  });
  assert.ok(errors.some((e) => /mode must be create\|revise\|polish\|analyze/i.test(e)));
});

test("plan handoff requires validationReady true and commands", () => {
  const errors = validateAgentHandoff("plan_handoff_v1", {
    planId: "x",
    summary: "y",
    estimatedImpact: 1,
    warnings: [],
    commands: [],
    baseRevision: "rev",
    validationReady: false
  });
  assert.ok(errors.some((e) => /commands is required/i.test(e)));
  assert.ok(errors.some((e) => /validationReady must be true/i.test(e)));
});
