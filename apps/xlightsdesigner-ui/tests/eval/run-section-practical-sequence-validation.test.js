import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

test("section practical sequence validation suite passes", () => {
  const output = execFileSync(
    "node",
    ["apps/xlightsdesigner-ui/eval/run-section-practical-sequence-validation.mjs"],
    {
      cwd: process.cwd(),
      encoding: "utf8"
    }
  );
  const result = JSON.parse(output);
  assert.equal(result.contract, "section_practical_sequence_validation_run_v1");
  assert.equal(result.ok, true);
  assert.ok(result.scenarioCount >= 4);
});
