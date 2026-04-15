import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

test("build-effect-setting-interaction-coverage-report reports interaction manifests and missing coverage", () => {
  const root = mkdtempSync(join(tmpdir(), "interaction-coverage-"));
  const automationPlanPath = join(root, "automation-plan.json");
  const outFile = join(root, "interaction-coverage.json");
  execFileSync("node", [resolve("scripts/sequencer-render-training/tooling/build-unified-training-set.mjs")], {
    cwd: resolve("."),
    stdio: "pipe"
  });
  execFileSync("node", [resolve("scripts/sequencer-render-training/tooling/build-effect-settings-coverage-report.mjs")], {
    cwd: resolve("."),
    stdio: "pipe"
  });
  execFileSync("node", [resolve("scripts/sequencer-render-training/tooling/build-effect-training-automation-plan.mjs"), automationPlanPath], {
    cwd: resolve("."),
    stdio: "pipe"
  });
  execFileSync("node", [resolve("scripts/sequencer-render-training/tooling/build-effect-setting-interaction-coverage-report.mjs"), automationPlanPath, outFile], {
    cwd: resolve("."),
    stdio: "pipe"
  });
  const report = JSON.parse(readFileSync(outFile, "utf8"));
  assert.equal(report.artifactType, "effect_setting_interaction_coverage_report_v1");
  assert.ok(report.summary.totalInteractionManifestCount >= 5);
  assert.ok(report.effects.some((row) => row.effectName === "Shockwave" && row.hasInteractionCoverage));
  assert.ok(report.effects.some((row) => row.effectName === "Twinkle" && row.hasInteractionCoverage));
  assert.ok(report.summary.missingInteractionCoverageCount >= 1);
});
