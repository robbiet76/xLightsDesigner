import test from "node:test";
import assert from "node:assert/strict";

import {
  addRevisionFeedbackToProposalLines,
  createProposalGenerationRuntime
} from "../../runtime/proposal-generation-runtime.js";

function buildState() {
  return {
    endpoint: "http://127.0.0.1:49915/xlightsdesigner/api",
    revision: "rev-1",
    draftBaseRevision: "rev-1",
    proposed: [],
    agentPlan: null,
    creative: {},
    health: {},
    flags: {
      xlightsConnected: false,
      planOnlyMode: false,
      activeSequenceLoaded: false,
      hasDraftProposal: false,
      proposalStale: false
    },
    ui: {
      agentThinking: false,
      metadataSelectionIds: [],
      metadataSelectedTags: []
    }
  };
}

test("proposal generation blocks when sequence session is not ready", async () => {
  const state = buildState();
  const statuses = [];
  let rendered = 0;

  const runtime = createProposalGenerationRuntime({
    state,
    setStatus: (level, text) => statuses.push({ level, text }),
    render: () => { rendered += 1; },
    buildSequenceSession: () => ({
      canGenerateSequence: false,
      planOnlyMode: false,
      xlightsConnected: false
    }),
    explainSequenceSessionBlockers: () => ({
      message: "Open a sequence or enter plan-only mode."
    })
  });

  await runtime.generateProposal("add sparkle");

  assert.deepEqual(statuses, [
    {
      level: "action-required",
      text: "Open a sequence or enter plan-only mode."
    }
  ]);
  assert.equal(rendered, 1);
  assert.equal(state.flags.hasDraftProposal, false);
});

test("sequence-agent proposal generation blocks on unresolved timing review", async () => {
  const state = buildState();
  const diagnostics = [];
  const messages = [];
  const statuses = [];
  let rendered = 0;

  const runtime = createProposalGenerationRuntime({
    state,
    pushDiagnostic: (level, message) => diagnostics.push({ level, message }),
    addStructuredChatMessage: (kind, text, meta) => messages.push({ kind, text, meta }),
    setStatusWithDiagnostics: (level, text) => statuses.push({ level, text }),
    render: () => { rendered += 1; },
    buildSequenceSession: () => ({
      canGenerateSequence: true,
      planOnlyMode: false,
      xlightsConnected: true
    }),
    getBlockingTimingReviewRows: () => [
      { trackName: "XD: Song Structure" },
      { trackName: "XD: Phrase Cues" }
    ]
  });

  await runtime.generateProposal("sequence it", { requestedRole: "sequence_agent" });

  assert.equal(diagnostics.length, 1);
  assert.match(diagnostics[0].message, /accept timing review/i);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].meta.roleId, "sequence_agent");
  assert.match(messages[0].text, /XD: Song Structure, XD: Phrase Cues/);
  assert.deepEqual(statuses, [
    {
      level: "warning",
      text: "Sequence proposal blocked: accept timing review for XD: Song Structure, XD: Phrase Cues before generating sequencing changes."
    }
  ]);
  assert.equal(rendered, 1);
  assert.equal(state.ui.agentThinking, false);
});

test("sequence-agent automation proposal honors explicit selected metadata tags", async () => {
  const state = buildState();
  state.flags.planOnlyMode = true;
  state.health.capabilityCommands = [];
  state.sequenceSettings = {};
  state.displayElements = [{ id: "MegaTree", name: "MegaTree", type: "model" }];
  state.models = [{ id: "MegaTree", name: "MegaTree", type: "Model" }];
  state.submodels = [];
  state.sceneGraph = { groupsById: {}, submodelsById: {} };
  state.ui.metadataSelectedTags = [];
  let directInput = null;
  let sequenceInput = null;
  let planInput = null;
  let readbackInput = null;
  let persisted = false;
  let rendered = false;

  const runtime = createProposalGenerationRuntime({
    state,
    buildSequenceSession: () => ({
      canGenerateSequence: true,
      planOnlyMode: true,
      xlightsConnected: false
    }),
    beginOrchestrationRun: () => ({ id: "orch-test" }),
    executeDirectSequenceRequestOrchestration: (input) => {
      directInput = input;
      return {
        ok: true,
        proposalLines: ["Chorus 1 / MegaTree / preserve this tagged focal element as the clearest lead read"],
        guidedQuestions: [],
        proposalBundle: {
          bundleType: "proposal_bundle_v1",
          scope: {
            sections: ["Chorus 1"],
            targetIds: ["MegaTree"],
            tagNames: ["lead"]
          },
          executionPlan: {
            sectionPlans: [
              {
                section: "Chorus 1",
                targetIds: ["MegaTree"],
                effectHints: []
              }
            ]
          },
          lifecycle: { status: "draft" }
        },
        intentHandoff: {
          artifactType: "intent_handoff_v1",
          goal: "Make the chorus read through the lead display element.",
          mode: "revise",
          scope: {
            sections: ["Chorus 1"],
            targetIds: ["MegaTree"],
            tagNames: ["lead"]
          },
          executionStrategy: {
            sectionPlans: [
              {
                section: "Chorus 1",
                targetIds: ["MegaTree"],
                effectHints: []
              }
            ]
          }
        }
      };
    },
    buildEffectiveMetadataAssignments: () => [
      {
        targetId: "MegaTree",
        tags: ["lead", "centerpiece"],
        semanticHints: ["centerpiece"],
        effectAvoidances: ["Bars"],
        rolePreference: "lead"
      }
    ],
    applyDesignerDraftSuccessState: (targetState, payload) => {
      targetState.creative.proposalBundle = payload.proposalBundle;
    },
    hydrateIntentHandoffExecutionStrategy: (intent) => intent,
    setAgentHandoff: () => ({ ok: true, errors: [] }),
    buildSequenceAgentInput: (input) => {
      sequenceInput = input;
      return { ...input, ok: true };
    },
    buildCurrentSequenceContextFromReadback: async (input) => {
      readbackInput = input;
      return {
        artifactType: "current_sequence_context_v1",
        artifactId: "current_sequence_context_v1-runtime",
        summary: { timingTrackCount: 1, effectCount: 2 }
      };
    },
    validateSequenceAgentContractGate: () => ({ ok: true, report: {} }),
    buildSequenceAgentPlan: (input) => {
      planInput = input;
      return {
      agentRole: "sequence_agent",
      contractVersion: "1.0",
      planId: "plan-1",
      summary: "Sequence plan",
      estimatedImpact: 1,
      warnings: [],
      commands: [],
      baseRevision: "rev-1",
      validationReady: true,
      executionLines: ["Chorus 1 / MegaTree / apply Color Wash effect"],
      metadata: {
        scope: {
          sections: ["Chorus 1"],
          targetIds: ["MegaTree"],
          tagNames: ["lead"]
        },
        metadataAssignments: [
          {
            targetId: "MegaTree",
            tags: ["lead", "centerpiece"],
            semanticHints: ["centerpiece"],
            effectAvoidances: ["Bars"],
            rolePreference: "lead"
          }
        ]
      }
      };
    },
    buildArtifactId: (type) => `${type}-test`,
    validateCommandGraph: () => ({ ok: true, nodeCount: 0, errors: [] }),
    normalizeMetadataSelectedTags: (values) => values,
    normalizeMetadataSelectionIds: (values) => values,
    persist: () => { persisted = true; },
    render: () => { rendered = true; }
  });

  await runtime.generateProposal("Make the chorus read through the lead display element.", {
    requestedRole: "sequence_agent",
    selectedSections: ["Chorus 1"],
    selectedTagNames: ["lead"]
  });

  assert.deepEqual(directInput.selectedTagNames, ["lead"]);
  assert.deepEqual(directInput.metadataAssignments[0].tags, ["lead", "centerpiece"]);
  assert.deepEqual(sequenceInput.planningScope.tagNames, ["lead"]);
  assert.equal(sequenceInput.currentSequenceContext.artifactId, "current_sequence_context_v1-runtime");
  assert.equal(planInput.currentSequenceContext.artifactId, "current_sequence_context_v1-runtime");
  assert.deepEqual(readbackInput.selectedSections, ["Chorus 1"]);
  assert.deepEqual(readbackInput.selectedTargets, []);
  assert.deepEqual(readbackInput.selectedTags, ["lead"]);
  assert.deepEqual(state.agentPlan.handoff.metadata.scope.tagNames, ["lead"]);
  assert.deepEqual(state.agentPlan.handoff.metadata.metadataAssignments[0].targetId, "MegaTree");
  assert.equal(persisted, true);
  assert.equal(rendered, true);
});

test("proposal generation annotates next proposal lines with preservation correction feedback", async () => {
  const state = buildState();
  state.flags.planOnlyMode = true;
  state.health.capabilityCommands = [];
  state.sequenceSettings = {};
  state.displayElements = [{ id: "MegaTree", name: "MegaTree", type: "model" }];
  state.models = [{ id: "MegaTree", name: "MegaTree", type: "Model" }];
  state.submodels = [];
  state.sceneGraph = { groupsById: {}, submodelsById: {} };
  state.sequenceAgentRuntime = {
    revisionFeedback: {
      artifactType: "revision_feedback_v1",
      status: "revise_required",
      rejectionReasons: ["original layer 0 missing preserved effects"],
      nextDirection: {
        revisionRoles: ["preserve_existing_effects"],
        changeBias: {
          preservation: {
            mismatch: true,
            existingEffects: "preserve_unless_explicit_replace"
          }
        }
      }
    }
  };

  const runtime = createProposalGenerationRuntime({
    state,
    buildSequenceSession: () => ({
      canGenerateSequence: true,
      planOnlyMode: true,
      xlightsConnected: false
    }),
    beginOrchestrationRun: () => ({ id: "orch-preserve" }),
    executeDirectSequenceRequestOrchestration: () => ({
      ok: true,
      proposalLines: ["Chorus 1 / MegaTree / add Color Wash"],
      guidedQuestions: [],
      proposalBundle: {
        bundleType: "proposal_bundle_v1",
        scope: { sections: ["Chorus 1"], targetIds: ["MegaTree"], tagNames: ["lead"] },
        lifecycle: { status: "draft" }
      },
      intentHandoff: {
        artifactType: "intent_handoff_v1",
        goal: "Correct preservation issue.",
        mode: "revise",
        scope: { sections: ["Chorus 1"], targetIds: ["MegaTree"], tagNames: ["lead"] }
      }
    }),
    applyDesignerDraftSuccessState: (targetState, payload) => {
      targetState.creative.proposalBundle = payload.proposalBundle;
    },
    hydrateIntentHandoffExecutionStrategy: (intent) => intent,
    setAgentHandoff: () => ({ ok: true, errors: [] }),
    buildSequenceAgentInput: (input) => ({ ...input, ok: true }),
    buildCurrentSequenceContextFromReadback: async () => ({
      artifactType: "current_sequence_context_v1",
      artifactId: "current_sequence_context_v1-preserve",
      summary: { timingTrackCount: 1, effectCount: 1 }
    }),
    validateSequenceAgentContractGate: () => ({ ok: true, report: {} }),
    buildSequenceAgentPlan: () => ({
      agentRole: "sequence_agent",
      contractVersion: "1.0",
      planId: "plan-preserve",
      summary: "Sequence plan",
      estimatedImpact: 1,
      warnings: [],
      commands: [],
      baseRevision: "rev-1",
      validationReady: true,
      executionLines: ["Chorus 1 / MegaTree / add Color Wash"],
      metadata: { scope: { sections: ["Chorus 1"], targetIds: ["MegaTree"], tagNames: ["lead"] } }
    }),
    buildArtifactId: (type) => `${type}-preserve`,
    validateCommandGraph: () => ({ ok: true, nodeCount: 0, errors: [] }),
    mergeCreativeBriefIntoProposal: (lines) => lines,
    normalizeMetadataSelectedTags: (values) => values,
    normalizeMetadataSelectionIds: (values) => values
  });

  await runtime.generateProposal("Correct preservation issue.", {
    requestedRole: "sequence_agent",
    selectedSections: ["Chorus 1"],
    selectedTagNames: ["lead"]
  });

  assert.match(state.proposed[0], /preserve existing overlapping effects on their original layers/i);
  assert.match(state.proposed[0], /open layers unless replacement is explicitly authorized/i);
  assert.match(state.agentPlan.executionLines[0], /preserve existing overlapping effects/i);
});

test("proposal generation reconstructs preservation correction from prior practical validation snapshot", async () => {
  const state = buildState();
  state.flags.planOnlyMode = true;
  state.health.capabilityCommands = [];
  state.sequenceSettings = {};
  state.displayElements = [{ id: "Star", name: "Star", type: "model" }];
  state.models = [{ id: "Star", name: "Star", type: "Model" }];
  state.submodels = [];
  state.sceneGraph = { groupsById: {}, submodelsById: {} };
  state.ui.reviewHistorySnapshot = {
    applyResult: {
      artifactId: "apply-preserve-failed",
      practicalValidation: {
        artifactId: "practical-preserve-failed",
        artifactType: "practical_sequence_validation_v1",
        overallOk: false,
        failures: {
          readback: [
            {
              kind: "effect-preservation",
              target: "Star@0->1",
              detail: "original layer 0 missing preserved effects"
            }
          ]
        }
      }
    },
    planHandoff: {
      metadata: {}
    }
  };
  let sequenceInput = null;
  let planInput = null;

  const runtime = createProposalGenerationRuntime({
    state,
    buildSequenceSession: () => ({
      canGenerateSequence: true,
      planOnlyMode: true,
      xlightsConnected: false
    }),
    beginOrchestrationRun: () => ({ id: "orch-snapshot-preserve" }),
    executeDirectSequenceRequestOrchestration: () => ({
      ok: true,
      proposalLines: ["General / Star / apply Color Wash"],
      guidedQuestions: [],
      proposalBundle: {
        bundleType: "proposal_bundle_v1",
        scope: { sections: [], targetIds: ["Star"], tagNames: ["lead"] },
        lifecycle: { status: "draft" }
      },
      intentHandoff: {
        artifactType: "intent_handoff_v1",
        goal: "Try the preservation correction again.",
        mode: "revise",
        scope: { sections: [], targetIds: ["Star"], tagNames: ["lead"] }
      }
    }),
    applyDesignerDraftSuccessState: (targetState, payload) => {
      targetState.creative.proposalBundle = payload.proposalBundle;
    },
    hydrateIntentHandoffExecutionStrategy: (intent) => intent,
    setAgentHandoff: () => ({ ok: true, errors: [] }),
    buildSequenceAgentInput: (input) => {
      sequenceInput = input;
      return { ...input, ok: true };
    },
    buildCurrentSequenceContextFromReadback: async () => ({
      artifactType: "current_sequence_context_v1",
      artifactId: "current_sequence_context_v1-snapshot-preserve",
      summary: { timingTrackCount: 1, effectCount: 1 }
    }),
    validateSequenceAgentContractGate: () => ({ ok: true, report: {} }),
    buildSequenceAgentPlan: (input) => {
      planInput = input;
      return {
        agentRole: "sequence_agent",
        contractVersion: "1.0",
        planId: "plan-snapshot-preserve",
        summary: "Sequence plan",
        estimatedImpact: 1,
        warnings: [],
        commands: [],
        baseRevision: "rev-1",
        validationReady: true,
        executionLines: ["General / Star / apply Color Wash"],
        metadata: { scope: { sections: [], targetIds: ["Star"], tagNames: ["lead"] } }
      };
    },
    buildArtifactId: (type) => `${type}-snapshot-preserve`,
    validateCommandGraph: () => ({ ok: true, nodeCount: 0, errors: [] }),
    mergeCreativeBriefIntoProposal: (lines) => lines,
    normalizeMetadataSelectedTags: (values) => values,
    normalizeMetadataSelectionIds: (values) => values
  });

  await runtime.generateProposal("Try the preservation correction again.", {
    requestedRole: "sequence_agent",
    selectedTagNames: ["lead"]
  });

  assert.equal(sequenceInput.revisionFeedback.source.practicalValidationRef, "practical-preserve-failed");
  assert.deepEqual(sequenceInput.revisionFeedback.nextDirection.revisionRoles, ["preserve_existing_effects"]);
  assert.equal(planInput.revisionFeedback.nextDirection.changeBias.preservation.existingEffects, "preserve_unless_explicit_replace");
  assert.match(state.proposed[0], /preserve existing overlapping effects on their original layers/i);
  assert.match(state.agentPlan.executionLines[0], /open layers unless replacement is explicitly authorized/i);
});

test("addRevisionFeedbackToProposalLines is idempotent for preservation notes", () => {
  const out = addRevisionFeedbackToProposalLines(
    ["Chorus / Star / add Color Wash"],
    {
      rejectionReasons: ["original layer 0 missing preserved effects"],
      nextDirection: {
        revisionRoles: ["preserve_existing_effects"],
        changeBias: {
          preservation: { mismatch: true }
        }
      }
    }
  );
  const second = addRevisionFeedbackToProposalLines(out, {
    nextDirection: { revisionRoles: ["preserve_existing_effects"] }
  });

  assert.equal(out.length, 1);
  assert.match(out[0], /preserve existing overlapping effects/);
  assert.deepEqual(second, out);
});
