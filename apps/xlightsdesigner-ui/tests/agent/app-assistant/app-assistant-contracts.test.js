import test from "node:test";
import assert from "node:assert/strict";

import {
  APP_ASSISTANT_ROLE,
  APP_ASSISTANT_CONTRACT_VERSION,
  buildAppAssistantInput,
  buildAppAssistantResult,
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
    routeDecision: "setup_help"
  });
  assert.deepEqual(validateAppAssistantResult(result), []);
});
