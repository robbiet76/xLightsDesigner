import test from "node:test";
import assert from "node:assert/strict";

import { collectXLightsRuntimeSnapshot } from "../../runtime/xlights-runtime.js";

test("collectXLightsRuntimeSnapshot aggregates live sequence state and capabilities", async () => {
  const snapshot = await collectXLightsRuntimeSnapshot("http://127.0.0.1:49914/xlDoAutomation", {
    readSequenceState: async () => ({
      contract: "xlights_sequence_state_v1",
      summary: "Open sequence Test.xsq at revision rev-3.",
      sequence: { isOpen: true, name: "Test.xsq", revision: "rev-3" }
    }),
    ping: async () => ({ data: { commands: ["sequence.getOpen", "timing.getTracks"] } }),
    getVersion: async () => ({ data: { version: "2026.10" } })
  });

  assert.equal(snapshot.contract, "xlights_runtime_snapshot_v1");
  assert.equal(snapshot.sequenceState.sequence.name, "Test.xsq");
  assert.equal(snapshot.capabilities.commandCount, 2);
  assert.equal(snapshot.capabilities.rawVersion, "2026.10");
});
