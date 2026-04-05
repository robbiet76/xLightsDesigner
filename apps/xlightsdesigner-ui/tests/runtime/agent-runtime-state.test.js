import test from "node:test";
import assert from "node:assert/strict";

import { createAgentRuntimeState } from "../../runtime/agent-runtime-state.js";

function buildState() {
  return {
    revision: "rev-1",
    draftBaseRevision: "rev-0",
    audioPathInput: "/show/media/song.mp3",
    health: {},
    ui: {
      metadataSelectionIds: ["Tree"],
      metadataSelectedTags: ["focal"]
    }
  };
}

function buildAgentRuntime() {
  return {
    loaded: true,
    error: "",
    registryVersion: "1.0",
    registryValid: true,
    registryErrors: [],
    activeRole: "",
    handoffs: {
      analysis_handoff_v1: null,
      intent_handoff_v1: null,
      plan_handoff_v1: null
    }
  };
}

test("agent runtime state tracks handoffs and health", () => {
  const diagnostics = [];
  const state = buildState();
  const agentRuntime = buildAgentRuntime();
  const runtime = createAgentRuntimeState({
    state,
    agentRuntime,
    handoffContracts: ["analysis_handoff_v1", "intent_handoff_v1", "plan_handoff_v1"],
    validateAgentHandoff: () => [],
    pushDiagnostic: (level, message) => diagnostics.push({ level, message }),
    getSelectedSections: () => ["Verse 1"],
    normalizeMetadataSelectionIds: (values) => values,
    normalizeMetadataSelectedTags: (values) => values
  });

  runtime.setAgentActiveRole("audio_analyst");
  const result = runtime.setAgentHandoff("analysis_handoff_v1", { ok: true }, "audio_analyst");

  assert.equal(result.ok, true);
  assert.equal(agentRuntime.activeRole, "audio_analyst");
  assert.equal(state.health.agentHandoffsReady, "1/3");
  assert.deepEqual(runtime.getValidHandoff("analysis_handoff_v1"), { ok: true });
  assert.ok(diagnostics.some((row) => row.message.includes("Agent handoff ready")));
});

test("agent runtime invalidates plan handoff when analysis context changes", () => {
  const state = buildState();
  const agentRuntime = buildAgentRuntime();
  const runtime = createAgentRuntimeState({
    state,
    agentRuntime,
    handoffContracts: ["analysis_handoff_v1", "intent_handoff_v1", "plan_handoff_v1"],
    validateAgentHandoff: () => [],
    pushDiagnostic: () => {},
    getSelectedSections: () => ["Verse 1"],
    normalizeMetadataSelectionIds: (values) => values,
    normalizeMetadataSelectedTags: (values) => values
  });

  runtime.setAgentHandoff("analysis_handoff_v1", { analysis: true }, "audio_analyst");
  runtime.setAgentHandoff("plan_handoff_v1", { plan: true }, "sequence_agent");
  state.audioPathInput = "/show/media/other.mp3";

  runtime.reconcileHandoffsAgainstCurrentContext({ reasonPrefix: "test drift" });

  assert.equal(runtime.getValidHandoff("analysis_handoff_v1"), null);
  assert.equal(runtime.getValidHandoff("plan_handoff_v1"), null);
});

test("agent runtime orchestration run updates summary health", () => {
  const state = buildState();
  const agentRuntime = buildAgentRuntime();
  const diagnostics = [];
  const runtime = createAgentRuntimeState({
    state,
    agentRuntime,
    handoffContracts: ["analysis_handoff_v1", "intent_handoff_v1", "plan_handoff_v1"],
    pushDiagnostic: (level, message) => diagnostics.push({ level, message })
  });

  const run = runtime.beginOrchestrationRun({ trigger: "generate", role: "sequence_agent" });
  runtime.markOrchestrationStage(run, "sequencer_plan", "ok", "built");
  runtime.endOrchestrationRun(run, { status: "ok", summary: "proposal generated" });

  assert.equal(state.health.orchestrationLastRunId, run.id);
  assert.equal(state.health.orchestrationLastStatus, "ok");
  assert.match(state.health.orchestrationLastSummary, /proposal generated/);
  assert.ok(diagnostics.some((row) => row.message.includes("Orchestration run ended")));
});
