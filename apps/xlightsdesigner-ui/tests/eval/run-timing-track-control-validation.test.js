import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

test("timing track control validation suite passes", () => {
  const output = execFileSync(
    "node",
    ["apps/xlightsdesigner-ui/eval/run-timing-track-control-validation.mjs"],
    {
      cwd: process.cwd(),
      encoding: "utf8"
    }
  );
  const result = JSON.parse(output);
  assert.equal(result.contract, "timing_track_control_validation_run_v1");
  assert.equal(result.ok, true);
  assert.equal(result.scenarioCount, 4);
});
