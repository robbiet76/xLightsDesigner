
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
    proposed: ["Intro / Snowman / add Color Wash"],
    sequenceAgentRuntime: {
      timingTrackPolicies: {},
      timingGeneratedSignatures: {},
      timingTrackProvenance: {}
    }
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
      verifyAppliedPlanReadback: async () => ({
        checks: [{
          kind: "timing",
          target: "XD: Song Structure",
          ok: true,
          detail: "mark signature matched",
          expectedMarks: [{ startMs: 0, endMs: 1000, label: "Intro" }],
          actualMarks: [{ startMs: 0, endMs: 1000, label: "Intro" }]
        }],
        expectedMutationsPresent: true,
        revisionAdvanced: true,
        lockedTracksUnchanged: true
      }),
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
  assert.ok(state.sequenceAgentRuntime.timingTrackProvenance.key);
  assert.equal(state.sequenceAgentRuntime.timingTrackProvenance.key.trackName, "XD: Song Structure");
  assert.equal(state.sequenceAgentRuntime.timingTrackProvenance.key.coverageMode, "complete");
});

test("executeApplyCore refreshes artistic goal and revision objective from practical validation", async () => {
  const state = {
    endpoint: "http://127.0.0.1:49914/xlDoAutomation",
    draftBaseRevision: "rev-1",
    revision: "rev-1",
    sequenceSettings: { durationMs: 60000 },
    displayElements: [],
    sceneGraph: { groupsById: {}, submodelsById: {} },
    ui: { metadataSelectionIds: [], metadataSelectedTags: [] },
    health: { capabilityCommands: [] },
    creative: {
      sequencingDesignHandoff: {
        artifactType: "sequencing_design_handoff_v2",
        designSummary: "MegaTree leads while roofline supports the chorus lift.",
        scope: { sections: ["Chorus 1"], targetIds: ["MegaTree", "Roofline"] },
        sectionDirectives: [
          {
            sectionName: "Chorus 1",
            motionTarget: "expanding_motion",
            densityTarget: "moderate",
            notes: "a clear chorus lift with readable focal hierarchy"
          }
        ],
        focusPlan: {
          primaryTargets: ["MegaTree"],
          secondaryTargets: ["Roofline"],
          balanceRule: "Preserve a readable lead/support/accent hierarchy across the scoped sections."
        },
        avoidances: ["no_full_yard_noise_wall"]
      },
      sequenceArtisticGoal: {
        artifactType: "sequence_artistic_goal_v1",
        scope: { goalLevel: "section" },
        artisticIntent: {
          leadTarget: "MegaTree",
          supportTargets: ["Roofline"]
        },
        evaluationLens: {
          mustPreserve: ["Preserve a readable lead/support/accent hierarchy across the scoped sections."],
          mustImprove: [],
          comparisonQuestions: ["Does the rendered result preserve the intended lead/support hierarchy?"]
        }
      },
      sequenceRevisionObjective: {
        artifactType: "sequence_revision_objective_v1",
        scope: { nextOwner: "sequencer" },
        ladderLevel: "section",
        designerDirection: {
          artisticCorrection: "Does the rendered result preserve the intended lead/support hierarchy?"
        },
        sequencerDirection: {
          executionObjective: "Translate the current design handoff into a bounded section pass."
        }
      },
      proposalBundle: {},
      intentHandoff: {}
    },
    flags: {},
    proposed: ["Chorus 1 / MegaTree / add Color Wash"],
    sequenceAgentRuntime: {
      timingTrackPolicies: {},
      timingGeneratedSignatures: {},
      timingTrackProvenance: {}
    }
  };

  await executeApplyCore({
    state,
    sourceLines: ["Chorus 1 / MegaTree / add Color Wash"],
    applyLabel: "proposal",
    orchestrationRun: { id: "run-refresh" },
    intentHandoffRecord: {},
    intentHandoff: { sequencingDesignHandoff: state.creative.sequencingDesignHandoff },
    planHandoff: {
      planId: "plan-refresh",
      metadata: {
        sequencingDesignHandoff: state.creative.sequencingDesignHandoff,
        sequencingDesignHandoffSummary: state.creative.sequencingDesignHandoff.designSummary,
        sequencingSectionDirectiveCount: 1,
        sequenceSettings: { durationMs: 60000 },
        scope: { sections: ["Chorus 1"], targetIds: ["MegaTree", "Roofline"] }
      },
      commands: []
    },
    deps: {
      currentSequencePathForSidecar: () => "/show/Test.xsq",
      getDesktopBackupBridge: () => null,
      getValidHandoff: (kind) => kind === "analysis_handoff_v1"
        ? { structure: { sections: [{ label: "Chorus 1", startMs: 0, endMs: 1000 }] } }
        : {},
      buildSequenceAgentInput: () => ({ ok: true }),
      currentLayoutMode: () => "sequencer",
      getSelectedSections: () => ["Chorus 1"],
      normalizeMetadataSelectionIds: (v = []) => v,
      normalizeMetadataSelectedTags: (v = []) => v,
      getSequenceTimingOwnershipRows: () => [],
      getManualLockedXdTracks: () => [],
      validateSequenceAgentContractGate: (_kind, payload) => ({ ok: true, stage: "", report: { errors: [], payload } }),
      filteredProposed: () => ["Chorus 1 / MegaTree / add Color Wash"],
      arraysEqualOrdered: () => true,
      validateCommandGraph: () => ({ ok: true, nodeCount: 0, errors: [] }),
      buildSequenceAgentPlan: () => ({
        commands: [
          { id: "song-create", cmd: "timing.createTrack", params: { trackName: "XD: Song Structure", replaceIfExists: true } },
          { id: "song-insert", cmd: "timing.insertMarks", params: { trackName: "XD: Song Structure", marks: [{ startMs: 0, endMs: 1000, label: "Chorus 1" }] } },
          { id: "effect-1", cmd: "effects.create", params: { modelName: "MegaTree", layerIndex: 0, effectName: "Color Wash", startMs: 0, endMs: 1000 } }
        ],
        warnings: []
      }),
      emitSequenceAgentStageTelemetry: () => {},
      evaluateSequencePlanCapabilities: () => ({ ok: true, skipped: false, requiredCapabilities: [] }),
      isXdTimingTrack: () => true,
      timingMarksSignature: () => "sig",
      buildGlobalXdTrackPolicyKey: () => "key",
      validateAndApplyPlan: async ({ commands }) => ({ ok: true, executedCount: commands.length, currentRevision: "rev-1", nextRevision: "rev-2" }),
      verifyAppliedPlanReadback: async () => ({
        checks: [{
          kind: "timing",
          target: "XD: Song Structure",
          ok: true,
          detail: "mark signature matched",
          expectedMarks: [{ startMs: 0, endMs: 1000, label: "Chorus 1" }],
          actualMarks: [{ startMs: 0, endMs: 1000, label: "Chorus 1" }]
        }],
        expectedMutationsPresent: true,
        revisionAdvanced: true,
        lockedTracksUnchanged: true
      }),
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

  assert.equal(state.creative.sequenceArtisticGoal.artifactType, "sequence_artistic_goal_v1");
  assert.match(state.creative.sequenceArtisticGoal.evaluationLens.comparisonQuestions[0], /timeline coverage too low|active target breadth too low|section placement density too low|multi-layer usage too low/i);
  assert.equal(state.creative.sequenceRevisionObjective.artifactType, "sequence_revision_objective_v1");
  assert.equal(state.creative.sequenceRevisionObjective.scope.nextOwner, "shared");
  assert.match(state.creative.sequenceRevisionObjective.sequencerDirection.executionObjective, /Revise the next pass to resolve/i);
});

test("executeApplyCore prefers collected post-apply render observation when available", async () => {
  const state = {
    endpoint: "http://127.0.0.1:49915/xlightsdesigner/api",
    draftBaseRevision: "rev-1",
    revision: "rev-1",
    sequenceSettings: { durationMs: 60000 },
    displayElements: [],
    sceneGraph: { groupsById: {}, submodelsById: {} },
    ui: { metadataSelectionIds: [], metadataSelectedTags: [] },
    health: { capabilityCommands: [] },
    creative: {
      sequencingDesignHandoff: {
        artifactType: "sequencing_design_handoff_v2",
        designSummary: "MegaTree leads while roofline supports.",
        focusPlan: { primaryTargets: ["MegaTree"], secondaryTargets: ["Roofline"] },
        sectionDirectives: []
      },
      sequenceArtisticGoal: {
        artifactType: "sequence_artistic_goal_v1",
        evaluationLens: { comparisonQuestions: ["Does the rendered result preserve the intended lead/support hierarchy?"] }
      },
      sequenceRevisionObjective: {
        artifactType: "sequence_revision_objective_v1",
        sequencerDirection: { executionObjective: "Translate the handoff." }
      },
      proposalBundle: {},
      intentHandoff: {}
    },
    flags: {},
    proposed: ["Chorus 1 / MegaTree / add Color Wash"],
    sequenceAgentRuntime: {
      timingTrackPolicies: {},
      timingGeneratedSignatures: {},
      timingTrackProvenance: {}
    }
  };

  await executeApplyCore({
    state,
    sourceLines: ["Chorus 1 / MegaTree / add Color Wash"],
    applyLabel: "proposal",
    orchestrationRun: { id: "run-render-refresh" },
    intentHandoffRecord: {},
    intentHandoff: { sequencingDesignHandoff: state.creative.sequencingDesignHandoff },
    planHandoff: { planId: "plan-render" },
    deps: {
      currentSequencePathForSidecar: () => "/show/Test.xsq",
      getDesktopBackupBridge: () => null,
      getValidHandoff: () => null,
      buildSequenceAgentInput: () => ({ ok: true }),
      currentLayoutMode: () => "2d",
      getSelectedSections: () => [],
      normalizeMetadataSelectionIds: (v = []) => v,
      normalizeMetadataSelectedTags: (v = []) => v,
      getSequenceTimingOwnershipRows: () => [],
      getManualLockedXdTracks: () => [],
      validateSequenceAgentContractGate: (_kind, payload) => ({ ok: true, stage: "", report: { errors: [], payload } }),
      arraysEqualOrdered: () => true,
      validateCommandGraph: () => ({ ok: true, nodeCount: 1, errors: [] }),
      buildSequenceAgentPlan: () => ({
        commands: [{ id: "effect-1", cmd: "effects.create", params: { modelName: "MegaTree", effectName: "Color Wash", startMs: 0, endMs: 1000 } }],
        warnings: []
      }),
      emitSequenceAgentStageTelemetry: () => {},
      evaluateSequencePlanCapabilities: () => ({ ok: true, skipped: false, requiredCapabilities: [] }),
      isXdTimingTrack: () => false,
      timingMarksSignature: () => "",
      buildGlobalXdTrackPolicyKey: () => "",
      validateAndApplyPlan: async () => ({ ok: true, executedCount: 1, currentRevision: "rev-1", nextRevision: "rev-2" }),
      verifyAppliedPlanReadback: async () => ({
        checks: [],
        expectedMutationsPresent: true,
        revisionAdvanced: true,
        lockedTracksUnchanged: true
      }),
      collectPostApplyRenderObservation: async () => ({
        artifactType: "render_observation_v1",
        artifactId: "render-1",
        macro: {
          activeModelNames: ["MegaTree"],
          activeFamilyTotals: { Tree: 1 },
          leadModel: "MegaTree",
          leadModelShare: 1,
          meanSceneSpreadRatio: 0.005,
          maxActiveModelRatio: 0.2
        }
      }),
      buildCurrentDesignSceneContext: () => ({
        artifactType: "design_scene_context_v1",
        artifactId: "scene-1",
        focalCandidates: ["MegaTree"],
        coverageDomains: { broad: [], detail: [] }
      }),
      buildCurrentMusicDesignContext: () => ({
        artifactId: "music-1",
        sectionArc: [
          { label: "Chorus 1", energy: "medium", density: "moderate" }
        ]
      }),
      buildCurrentRenderObservation: () => null,
      buildSequenceAgentApplyResult: ({ practicalValidation }) => ({ practicalValidation, verification: { revisionAdvanced: true, expectedMutationsPresent: true, lockedTracksUnchanged: true } }),
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

  assert.equal(state.sequenceAgentRuntime.renderObservation?.artifactId, "render-1");
  assert.equal(state.sequenceAgentRuntime.renderCritiqueContext?.comparison?.leadMatchesPrimaryFocus, true);
  assert.equal(state.sequenceAgentRuntime.renderCritiqueContext?.source?.renderObservationArtifactId, "render-1");
  assert.equal(state.sequenceAgentRuntime.revisionFeedback?.artifactType, "revision_feedback_v1");
  assert.equal(typeof state.sequenceAgentRuntime.revisionFeedback?.status, "string");
  assert.ok(Array.isArray(state.sequenceAgentRuntime.revisionFeedback?.rejectionReasons));
});

test("executeApplyCore prefers render critique refresh when render observation is available", async () => {
  const state = {
    endpoint: "http://127.0.0.1:49914/xlDoAutomation",
    draftBaseRevision: "rev-1",
    revision: "rev-1",
    sequenceSettings: { durationMs: 60000 },
    displayElements: [],
    sceneGraph: { groupsById: {}, submodelsById: {} },
    ui: { metadataSelectionIds: [], metadataSelectedTags: [] },
    health: { capabilityCommands: [] },
    creative: {
      sequencingDesignHandoff: {
        artifactType: "sequencing_design_handoff_v2",
        designSummary: "MegaTree leads while roofline supports the chorus lift.",
        scope: { sections: ["Chorus 1"], targetIds: ["MegaTree", "Roofline"] },
        sectionDirectives: [
          {
            sectionName: "Chorus 1",
            motionTarget: "expanding_motion",
            densityTarget: "moderate",
            notes: "a clear chorus lift with readable focal hierarchy"
          }
        ],
        focusPlan: {
          primaryTargets: ["MegaTree"],
          secondaryTargets: ["Roofline"],
          balanceRule: "Preserve a readable lead/support/accent hierarchy across the scoped sections."
        },
        avoidances: ["no_full_yard_noise_wall"]
      },
      sequenceArtisticGoal: {
        artifactType: "sequence_artistic_goal_v1",
        scope: { goalLevel: "section" },
        artisticIntent: {
          leadTarget: "MegaTree",
          supportTargets: ["Roofline"]
        },
        evaluationLens: {
          mustPreserve: ["Preserve a readable lead/support/accent hierarchy across the scoped sections."],
          mustImprove: [],
          comparisonQuestions: ["Does the rendered result preserve the intended lead/support hierarchy?"]
        }
      },
      sequenceRevisionObjective: {
        artifactType: "sequence_revision_objective_v1",
        scope: { nextOwner: "sequencer" },
        ladderLevel: "section",
        designerDirection: {
          artisticCorrection: "Does the rendered result preserve the intended lead/support hierarchy?"
        },
        sequencerDirection: {
          executionObjective: "Translate the current design handoff into a bounded section pass."
        }
      }
    },
    flags: {},
    proposed: ["Chorus 1 / MegaTree / add Color Wash"],
    sequenceAgentRuntime: {
      timingTrackPolicies: {},
      timingGeneratedSignatures: {},
      timingTrackProvenance: {},
      renderObservation: {
        artifactId: "obs-1",
        macro: {
          activeModelNames: ["Roofline"],
          activeFamilyTotals: { Line: 2 },
          leadModel: "Roofline",
          leadModelShare: 0.9,
          meanSceneSpreadRatio: 0.008,
          maxActiveModelRatio: 0.08
        }
      }
    }
  };

  await executeApplyCore({
    state,
    sourceLines: ["Chorus 1 / MegaTree / add Color Wash"],
    applyLabel: "proposal",
    orchestrationRun: { id: "run-render-refresh" },
    intentHandoffRecord: {},
    intentHandoff: { sequencingDesignHandoff: state.creative.sequencingDesignHandoff },
    planHandoff: {
      planId: "plan-render-refresh",
      metadata: {
        sequencingDesignHandoff: state.creative.sequencingDesignHandoff,
        sequencingDesignHandoffSummary: state.creative.sequencingDesignHandoff.designSummary,
        sequencingSectionDirectiveCount: 1,
        sequenceSettings: { durationMs: 60000 },
        scope: { sections: ["Chorus 1"], targetIds: ["MegaTree", "Roofline"] }
      },
      commands: []
    },
    deps: {
      currentSequencePathForSidecar: () => "/show/Test.xsq",
      getDesktopBackupBridge: () => null,
      getValidHandoff: (kind) => kind === "analysis_handoff_v1"
        ? { structure: { sections: [{ label: "Chorus 1", startMs: 0, endMs: 1000 }] } }
        : {},
      buildSequenceAgentInput: () => ({ ok: true }),
      currentLayoutMode: () => "sequencer",
      getSelectedSections: () => ["Chorus 1"],
      normalizeMetadataSelectionIds: (v = []) => v,
      normalizeMetadataSelectedTags: (v = []) => v,
      getSequenceTimingOwnershipRows: () => [],
      getManualLockedXdTracks: () => [],
      validateSequenceAgentContractGate: (_kind, payload) => ({ ok: true, stage: "", report: { errors: [], payload } }),
      filteredProposed: () => ["Chorus 1 / MegaTree / add Color Wash"],
      arraysEqualOrdered: () => true,
      validateCommandGraph: () => ({ ok: true, nodeCount: 0, errors: [] }),
      buildSequenceAgentPlan: () => ({
        commands: [
          { id: "effect-1", cmd: "effects.create", params: { modelName: "MegaTree", layerIndex: 0, effectName: "Color Wash", startMs: 0, endMs: 1000 } }
        ],
        warnings: []
      }),
      emitSequenceAgentStageTelemetry: () => {},
      evaluateSequencePlanCapabilities: () => ({ ok: true, skipped: false, requiredCapabilities: [] }),
      isXdTimingTrack: () => false,
      timingMarksSignature: () => "",
      buildGlobalXdTrackPolicyKey: () => "",
      validateAndApplyPlan: async ({ commands }) => ({ ok: true, executedCount: commands.length, currentRevision: "rev-1", nextRevision: "rev-2" }),
      verifyAppliedPlanReadback: async () => ({
        checks: [],
        expectedMutationsPresent: true,
        revisionAdvanced: true,
        lockedTracksUnchanged: true
      }),
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
      buildEffectiveMetadataAssignments: () => [],
      buildCurrentDesignSceneContext: () => ({
        artifactId: "scene-1",
        focalCandidates: ["MegaTree", "ArchSingle"],
        coverageDomains: {
          broad: ["AllModels"],
          detail: ["MegaTree/Star"]
        }
      }),
      buildCurrentMusicDesignContext: () => ({
        artifactId: "music-1",
        sectionArc: [
          { label: "Chorus 1", energy: "high", density: "dense" }
        ]
      })
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

  assert.equal(state.sequenceAgentRuntime.renderCritiqueContext.artifactType, "sequence_render_critique_context_v1");
  assert.equal(state.sequenceAgentRuntime.renderCritiqueContext.comparison.leadMatchesPrimaryFocus, false);
  assert.equal(state.sequenceAgentRuntime.renderCritiqueContext.comparison.musicalLiftExpected, true);
  assert.equal(state.sequenceAgentRuntime.revisionFeedback.artifactType, "revision_feedback_v1");
  assert.equal(state.sequenceAgentRuntime.revisionFeedback.status, "revise_required");
  assert.ok(state.sequenceAgentRuntime.revisionFeedback.rejectionReasons.some((row) => /Rendered lead does not match the intended primary focus/i.test(String(row))));
  assert.match(state.creative.sequenceArtisticGoal.evaluationLens.comparisonQuestions[0], /Rendered lead does not match the intended primary focus/i);
  assert.match(state.creative.sequenceRevisionObjective.sequencerDirection.executionObjective, /rendered composition problem/i);
});
