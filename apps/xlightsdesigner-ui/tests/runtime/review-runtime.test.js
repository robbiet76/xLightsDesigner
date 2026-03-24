
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

test("executeApplyCore preserves XD song structure timing writes during live apply", async () => {
  let appliedCommands = null;
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
    proposed: ["Intro / Snowman / add Color Wash"]
  };
  const result = await executeApplyCore({
    state,
    sourceLines: ["Intro / Snowman / add Color Wash"],
    applyLabel: "proposal",
    orchestrationRun: { id: "run-2" },
    intentHandoffRecord: {},
    intentHandoff: {},
    planHandoff: {},
    deps: {
      currentSequencePathForSidecar: () => "/show/Test.xsq",
      getDesktopBackupBridge: () => null,
      getValidHandoff: (kind) => kind === "analysis_handoff_v1"
        ? { structure: { sections: [{ label: "Intro", startMs: 0, endMs: 1000 }] } }
        : {},
      buildSequenceAgentInput: () => ({ ok: true }),
      currentLayoutMode: () => "sequencer",
      getSelectedSections: () => [],
      normalizeMetadataSelectionIds: (v = []) => v,
      normalizeMetadataSelectedTags: (v = []) => v,
      getSequenceTimingOwnershipRows: () => [],
      getManualLockedXdTracks: () => [],
      validateSequenceAgentContractGate: (_kind, payload) => ({ ok: true, stage: "", report: { errors: [], payload } }),
      filteredProposed: () => ["Intro / Snowman / add Color Wash"],
      arraysEqualOrdered: () => true,
      validateCommandGraph: () => ({ ok: true, nodeCount: 0, errors: [] }),
      buildSequenceAgentPlan: () => ({
        commands: [
          { id: "song-create", cmd: "timing.createTrack", params: { trackName: "XD: Song Structure", replaceIfExists: true } },
          { id: "song-insert", cmd: "timing.insertMarks", params: { trackName: "XD: Song Structure", marks: [{ startMs: 0, endMs: 1000, label: "Intro" }] } },
          { id: "effect-1", cmd: "effects.create", params: { modelName: "Snowman", layerIndex: 0, effectName: "Color Wash", startMs: 0, endMs: 1000 } }
        ],
        warnings: []
      }),
      emitSequenceAgentStageTelemetry: () => {},
      evaluateSequencePlanCapabilities: () => ({ ok: true, skipped: false, requiredCapabilities: [] }),
      isXdTimingTrack: () => true,
      timingMarksSignature: () => "sig",
      buildGlobalXdTrackPolicyKey: () => "key",
      validateAndApplyPlan: async ({ commands }) => {
        appliedCommands = commands;
        return { ok: true, executedCount: commands.length, currentRevision: "rev-1", nextRevision: "rev-2" };
      },
      verifyAppliedPlanReadback: async () => ({ checks: [], expectedMutationsPresent: true, revisionAdvanced: true, lockedTracksUnchanged: true }),
      buildSequenceAgentApplyResult: () => ({ verification: { revisionAdvanced: true, expectedMutationsPresent: true, lockedTracksUnchanged: true } }),
      classifyOrchestrationFailureReason: () => "",
      getSequenceTimingTrackPoliciesState: () => ({}),
      getSequenceTimingGeneratedSignaturesState: () => ({}),
      setSequenceTimingTrackPoliciesState: () => {},
      setSequenceTimingGeneratedSignaturesState: () => {},
      applyAcceptedProposalToDirectorProfile: () => ({}),
      buildApplyHistoryEntry: () => ({}),
      buildChatArtifactCard: () => ({}),
      getTeamChatSpeakerLabel: () => "Patch",
      buildEffectiveMetadataAssignments: () => []
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

  assert.equal(result.blocked, false);
  assert.ok(Array.isArray(appliedCommands));
  assert.equal(appliedCommands.some((row) => row.cmd === "timing.createTrack" && row.params?.trackName === "XD: Song Structure"), true);
  assert.equal(appliedCommands.some((row) => row.cmd === "timing.insertMarks" && row.params?.trackName === "XD: Song Structure"), true);
});
