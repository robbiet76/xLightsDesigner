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
