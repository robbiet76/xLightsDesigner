import test from "node:test";
import assert from "node:assert/strict";

import {
  getFunctionDefinitionForCommand,
  getRequiredCapabilitiesForCommands
} from "../../../agent/sequence-agent/sequence-function-catalog.js";

test("function catalog resolves known command", () => {
  const def = getFunctionDefinitionForCommand("timing.insertMarks");
  assert.equal(def?.category, "timing");
  assert.deepEqual(def?.requiredCapabilities, ["timing.insertMarks"]);
});

test("function catalog falls back unknown command to self-capability", () => {
  const required = getRequiredCapabilitiesForCommands([
    { cmd: "custom.command", params: {} }
  ]);
  assert.deepEqual(required, ["custom.command"]);
});
