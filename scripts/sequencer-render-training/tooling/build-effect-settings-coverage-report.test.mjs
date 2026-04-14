import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

test("build-effect-settings-coverage-report emits non-exhaustive coverage summary", () => {
  const root = mkdtempSync(join(tmpdir(), "settings-coverage-"));
  const outFile = join(root, "coverage.json");
  execFileSync("node", [
    resolve("scripts/sequencer-render-training/tooling/build-unified-training-set.mjs")
  ], {
    cwd: resolve("."),
    stdio: "pipe"
  });
  execFileSync("node", [
    resolve("scripts/sequencer-render-training/tooling/build-effect-settings-coverage-report.mjs"),
    outFile
  ], {
    cwd: resolve("."),
    stdio: "pipe"
  });
  const report = JSON.parse(readFileSync(outFile, "utf8"));
  assert.equal(report.artifactType, "effect_settings_coverage_report_v1");
  assert.equal(report.summary.exhaustiveSettingCoverage, false);
  assert.ok(report.summary.effectCount >= 10);
  assert.ok(report.effects.some((row) => row.effectName === "Bars" && row.coverageStatus === "screened_parameter_subset"));
});
