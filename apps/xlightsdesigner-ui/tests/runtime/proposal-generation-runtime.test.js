import test from "node:test";
import assert from "node:assert/strict";

import { createProposalGenerationRuntime } from "../../runtime/proposal-generation-runtime.js";

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
      return { ok: true };
    },
    validateSequenceAgentContractGate: () => ({ ok: true, report: {} }),
    buildSequenceAgentPlan: () => ({
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
    }),
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
  assert.deepEqual(state.agentPlan.handoff.metadata.scope.tagNames, ["lead"]);
  assert.deepEqual(state.agentPlan.handoff.metadata.metadataAssignments[0].targetId, "MegaTree");
  assert.equal(persisted, true);
  assert.equal(rendered, true);
});
