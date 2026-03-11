import test from "node:test";
import assert from "node:assert/strict";

import { validateTrainingAgentRegistry } from "../../agent/agent-registry-validator.js";

function validPayload() {
  return {
    registry: {
      agents: [
        { id: "audio_analyst", path: "agents/audio_analyst.agent.json", status: "active" },
        { id: "designer_dialog", path: "agents/designer_dialog.agent.json", status: "active" },
        { id: "sequence_agent", path: "agents/sequence_agent.agent.json", status: "active" }
      ]
    },
    profiles: [
      {
        id: "audio_analyst",
        profile: { id: "audio_analyst", handoff: { to: ["designer_dialog", "sequence_agent"] } }
      },
      {
        id: "designer_dialog",
        profile: { id: "designer_dialog", handoff: { to: ["sequence_agent"] } }
      },
      {
        id: "sequence_agent",
        profile: {
          id: "sequence_agent",
          inputs: ["analysis_handoff_v1", "intent_handoff_v1"],
          outputs: ["plan_handoff_v1"],
          handoff: { to: ["orchestrator"] }
        }
      }
    ]
  };
}

test("registry validator passes for canonical role graph", () => {
  const out = validateTrainingAgentRegistry(validPayload());
  assert.equal(out.ok, true);
  assert.deepEqual(out.errors, []);
});

test("registry validator fails when sequence_agent is missing", () => {
  const payload = validPayload();
  payload.registry.agents = payload.registry.agents.filter((r) => r.id !== "sequence_agent");
  payload.profiles = payload.profiles.filter((r) => r.id !== "sequence_agent");
  const out = validateTrainingAgentRegistry(payload);
  assert.equal(out.ok, false);
  assert.ok(out.errors.some((e) => /required role missing.*sequence_agent/i.test(e)));
  assert.ok(out.errors.some((e) => /required profile missing.*sequence_agent/i.test(e)));
});

test("registry validator fails profile id mismatch and missing handoff contracts", () => {
  const payload = validPayload();
  payload.profiles[2].profile.id = "wrong_id";
  payload.profiles[2].profile.inputs = ["intent_handoff_v1"];
  payload.profiles[2].profile.outputs = [];
  const out = validateTrainingAgentRegistry(payload);
  assert.equal(out.ok, false);
  assert.ok(out.errors.some((e) => /profile id mismatch/i.test(e)));
  assert.ok(out.errors.some((e) => /missing analysis_handoff_v1/i.test(e)));
  assert.ok(out.errors.some((e) => /missing plan_handoff_v1/i.test(e)));
});
