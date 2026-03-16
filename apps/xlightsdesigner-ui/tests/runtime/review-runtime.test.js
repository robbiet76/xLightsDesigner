
import test from "node:test";
import assert from "node:assert/strict";

import { executeApplyCore } from "../../runtime/review-runtime.js";

test("executeApplyCore blocks invalid sequence-agent input contract", async () => {
  const state = {
    endpoint: "http://127.0.0.1:49914/xlDoAutomation",
    draftBaseRevision: "rev-1",
    revision: "rev-1",
    sequenceSettings: {},
    displayElements: [],
    sceneGraph: { groupsById: {}, submodelsById: {} },
    ui: { metadataSelectionIds: [], metadataSelectedTags: [] },
    health: { capabilityCommands: [] },
    creative: {},
    flags: {},
    proposed: []
  };
  const result = await executeApplyCore({
    state,
    sourceLines: ["Chorus 1 / Snowman / add Color Wash"],
    orchestrationRun: { id: "run-1" },
    intentHandoffRecord: null,
    intentHandoff: {},
    planHandoff: {},
    deps: {
      currentSequencePathForSidecar: () => "/show/Test.xsq",
      getDesktopBackupBridge: () => null,
      getValidHandoff: () => null,
      buildSequenceAgentInput: () => ({ invalid: true }),
      currentLayoutMode: () => "sequencer",
      getSelectedSections: () => ["Chorus 1"],
      normalizeMetadataSelectionIds: (v = []) => v,
      normalizeMetadataSelectedTags: (v = []) => v,
      getSequenceTimingOwnershipRows: () => [],
      getManualLockedXdTracks: () => [],
      validateSequenceAgentContractGate: () => ({ ok: false, stage: "input_contract", report: { errors: ["missing field"] } }),
      filteredProposed: () => [],
      arraysEqualOrdered: () => false,
      validateCommandGraph: () => ({ ok: true, nodeCount: 0, errors: [] }),
      buildSequenceAgentPlan: () => ({ commands: [] }),
      emitSequenceAgentStageTelemetry: () => {},
      evaluateSequencePlanCapabilities: () => ({ ok: true, skipped: false, requiredCapabilities: [] }),
      isXdTimingTrack: () => false,
      timingMarksSignature: () => "",
      buildGlobalXdTrackPolicyKey: () => "",
      validateAndApplyPlan: async () => ({ ok: true }),
      verifyAppliedPlanReadback: async () => ({ checks: [], expectedMutationsPresent: true, revisionAdvanced: true }),
      buildSequenceAgentApplyResult: () => ({}),
      classifyOrchestrationFailureReason: () => "",
      getSequenceTimingTrackPoliciesState: () => ({}),
      getSequenceTimingGeneratedSignaturesState: () => ({}),
      setSequenceTimingTrackPoliciesState: () => {},
      setSequenceTimingGeneratedSignaturesState: () => {},
      applyAcceptedProposalToDirectorProfile: () => ({}),
      buildApplyHistoryEntry: () => ({}),
      buildChatArtifactCard: () => ({}),
      getTeamChatSpeakerLabel: () => "Patch"
    },
    callbacks: {
      pushSequenceAgentContractDiagnostic: () => {},
      markOrchestrationStage: () => {},
      endOrchestrationRun: () => {},
      pushDiagnostic: () => {},
      upsertJob: () => {},
      bumpVersion: () => {},
      setStatusWithDiagnostics: () => {},
      addStructuredChatMessage: () => {}
    }
  });

  assert.equal(result.blocked, true);
  assert.match(result.message, /input contract invalid/i);
});
