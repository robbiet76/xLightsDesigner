import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

test("build-effect-parameter-screening-plan skips already screened parameters and keeps remaining rows", () => {
  const root = mkdtempSync(join(tmpdir(), "effect-parameter-plan-"));
  const outFile = join(root, "screening-plan.json");
  execFileSync("bash", [resolve("scripts/sequencer-render-training/runners/run-effect-training-automation-cycle.sh")], {
    cwd: resolve("."),
    stdio: "pipe"
  });
  execFileSync("node", [resolve("scripts/sequencer-render-training/tooling/build-effect-parameter-screening-plan.mjs"), outFile], {
    cwd: resolve("."),
    stdio: "pipe"
  });
  const plan = JSON.parse(readFileSync(outFile, "utf8"));
  assert.equal(plan.artifactType, "effect_parameter_screening_plan_v1");
  assert.ok(plan.summary.manifestCount > 0);
  assert.ok(plan.rows.some((row) => row.effectName === "Shockwave"));
  assert.ok(plan.rows.some((row) => row.effectName === "Shockwave" && row.parameterName !== "centerX" && row.parameterName !== "centerY"));
  assert.ok(!plan.rows.some((row) => row.effectName === "Shockwave" && row.parameterName === "centerX"));
  assert.ok(!plan.rows.some((row) => row.effectName === "Twinkle" && row.parameterName === "count"));
});
