import test from "node:test";
import assert from "node:assert/strict";

import { evaluateSequencePlanCapabilities } from "../../agent/sequence-capability-gate.js";

test("capability gate blocks unsupported timing command", () => {
  const out = evaluateSequencePlanCapabilities({
    commands: [{ cmd: "timing.replaceMarks", params: { trackName: "XD: Test" } }],
    capabilityCommands: ["timing.createTrack", "timing.insertMarks"]
  });
  assert.equal(out.ok, false);
  assert.equal(out.skipped, false);
  assert.ok(out.errors.some((e) => /Unsupported command capabilities/i.test(e)));
  assert.ok(out.missingCapabilities.includes("timing.replaceMarks"));
});

test("capability gate passes when required capabilities are available", () => {
  const out = evaluateSequencePlanCapabilities({
    commands: [
      { cmd: "timing.createTrack", params: { trackName: "XD: Test" } },
      { cmd: "timing.insertMarks", params: { trackName: "XD: Test", marks: [] } }
    ],
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "system.executePlan"]
  });
  assert.equal(out.ok, true);
  assert.equal(out.missingCapabilities.length, 0);
});

test("capability gate skips when capability list is unavailable", () => {
  const out = evaluateSequencePlanCapabilities({
    commands: [{ cmd: "timing.createTrack", params: { trackName: "XD: Test" } }],
    capabilityCommands: []
  });
  assert.equal(out.ok, true);
  assert.equal(out.skipped, true);
  assert.ok(out.warnings.length > 0);
});
