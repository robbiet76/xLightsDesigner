import test from "node:test";
import assert from "node:assert/strict";

import { createApplyReadinessRuntime } from "../../runtime/apply-readiness-runtime.js";

function buildState() {
  return {
    draftBaseRevision: "rev-1",
    agentPlan: null,
    flags: {
      hasDraftProposal: true,
      xlightsCompatible: true,
      proposalStale: false,
      applyInProgress: false
    },
    ui: {
      applyApprovalChecked: false
    },
    safety: {
      applyConfirmMode: "large-only",
      largeChangeThreshold: 20
    }
  };
}

test("apply readiness blocks when intent handoff is missing", () => {
  const state = buildState();
  const runtime = createApplyReadinessRuntime({
    state,
    getValidHandoff: (contract) => (contract === "plan_handoff_v1" ? { baseRevision: "rev-1", commands: [] } : null)
  });

  const gate = runtime.evaluateApplyHandoffGate();
  assert.equal(gate.ok, false);
  assert.equal(gate.reason, "missing-intent-handoff");
});

test("apply readiness reports blocking timing review rows from required XD tracks", () => {
  const state = buildState();
  const runtime = createApplyReadinessRuntime({
    state,
    getValidHandoff: (contract) => {
      if (contract === "intent_handoff_v1") return { ok: true };
      if (contract === "plan_handoff_v1") {
        return {
          baseRevision: "rev-1",
          commands: [
            { cmd: "timing.replaceMarks", params: { trackName: "XD: Song Structure" } },
            { cmd: "timing.insertMarks", params: { trackName: "Other Track" } }
          ]
        };
      }
      return null;
    },
    buildTimingTrackStatusRows: () => [
      { trackName: "XD: Song Structure", status: "stale" },
      { trackName: "XD: Phrase Cues", status: "unchanged" }
    ],
    getSequenceTimingTrackProvenanceState: () => ({}),
    getSequenceTimingGeneratedSignaturesState: () => ({}),
    getSequenceTimingTrackPoliciesState: () => ({}),
    isXdTimingTrack: (name) => String(name).startsWith("XD:")
  });

  const rows = runtime.getBlockingTimingReviewRows();
  assert.deepEqual(rows, [{ trackName: "XD: Song Structure", status: "stale" }]);
});

test("apply readiness computes disabled reason from readiness and approval state", () => {
  const state = buildState();
  const runtime = createApplyReadinessRuntime({
    state,
    getValidHandoff: (contract) => {
      if (contract === "intent_handoff_v1") return { ok: true };
      if (contract === "plan_handoff_v1") return { baseRevision: "rev-1", commands: [] };
      return null;
    },
    buildTimingTrackStatusRows: () => [],
    getSequenceTimingTrackProvenanceState: () => ({}),
    getSequenceTimingGeneratedSignaturesState: () => ({}),
    getSequenceTimingTrackPoliciesState: () => ({}),
    buildSequenceSession: () => ({
      xlightsConnected: true,
      planOnlyMode: false,
      effectiveSequenceLoaded: true,
      effectiveSequenceAllowed: true
    }),
    getAgentApplyRolloutMode: () => "full",
    estimateImpactCount: () => 5,
    filteredProposed: () => ["line1"]
  });

  assert.equal(runtime.applyReadyForApprovalGate(), true);
  assert.equal(runtime.applyDisabledReason(), "Review the plan and check approval before apply.");
  assert.equal(runtime.applyEnabled(), false);
});
