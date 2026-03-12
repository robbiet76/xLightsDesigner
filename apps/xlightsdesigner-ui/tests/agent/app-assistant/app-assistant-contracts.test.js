import test from "node:test";
import assert from "node:assert/strict";

import {
  APP_ASSISTANT_ROLE,
  APP_ASSISTANT_CONTRACT_VERSION,
  DEFAULT_TEAM_CHAT_IDENTITIES,
  buildAppAssistantInput,
  buildAppAssistantResult,
  buildTeamChatIdentities,
  validateAppAssistantInput,
  validateAppAssistantResult
} from "../../../agent/app-assistant/app-assistant-contracts.js";

test("app assistant input contract accepts canonical payload", () => {
  const input = buildAppAssistantInput({
    userMessage: "Help me set up this project",
    messages: [{ role: "user", content: "hello" }],
    context: { route: "project" }
  });
  assert.equal(input.agentRole, APP_ASSISTANT_ROLE);
  assert.equal(input.contractVersion, APP_ASSISTANT_CONTRACT_VERSION);
  assert.deepEqual(validateAppAssistantInput(input), []);
});

test("app assistant result contract accepts canonical payload", () => {
  const result = buildAppAssistantResult({
    assistantMessage: "Start by setting the show folder.",
    routeDecision: "setup_help",
    handledBy: "app_assistant",
    identities: DEFAULT_TEAM_CHAT_IDENTITIES
  });
  assert.deepEqual(validateAppAssistantResult(result), []);
});

test("team chat identities normalize defaults and nicknames", () => {
  const identities = buildTeamChatIdentities({
    sequence_agent: { nickname: "Patch" }
  });
  assert.equal(identities.sequence_agent.displayName, "Sequencer");
  assert.equal(identities.sequence_agent.nickname, "Patch");
  assert.equal(identities.designer_dialog.displayName, "Designer");
});
