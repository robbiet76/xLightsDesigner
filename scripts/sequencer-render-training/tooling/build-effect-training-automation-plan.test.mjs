import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

test("build-effect-training-automation-plan classifies runnable and blocked effects", () => {
  const root = mkdtempSync(join(tmpdir(), "effect-training-plan-"));
  const outFile = join(root, "plan.json");
  execFileSync("node", [resolve("scripts/sequencer-render-training/tooling/build-unified-training-set.mjs")], {
    cwd: resolve("."),
    stdio: "pipe"
  });
  execFileSync("node", [resolve("scripts/sequencer-render-training/tooling/build-effect-settings-coverage-report.mjs")], {
    cwd: resolve("."),
    stdio: "pipe"
  });
  execFileSync("node", [resolve("scripts/sequencer-render-training/tooling/build-effect-training-automation-plan.mjs"), outFile], {
    cwd: resolve("."),
    stdio: "pipe"
  });
  const plan = JSON.parse(readFileSync(outFile, "utf8"));
  assert.equal(plan.artifactType, "effect_training_automation_plan_v1");
  assert.ok(plan.summary.runnableLaterCount >= 2);
  assert.ok(plan.effects.some((row) => row.effectName === "Shockwave" && row.readiness === "ready_for_expansion"));
  assert.ok(plan.effects.some((row) => row.effectName === "Twinkle" && (row.readiness === "ready_for_expansion" || row.readiness === "screened_current_registry")));
  assert.ok(plan.effects.some((row) => row.effectName === "Butterfly" && row.readiness === "needs_registry"));
});
