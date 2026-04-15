import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

test("build-sequencer-training-reset-report blocks clean regeneration when interaction-aware generators are missing", () => {
  const root = mkdtempSync(join(tmpdir(), "reset-report-"));
  const settingsCoverage = join(root, "settings-coverage.json");
  const automationPlan = join(root, "automation-plan.json");
  const screeningPlan = join(root, "screening-plan.json");
  const interactionCoverage = join(root, "interaction-coverage.json");
  const behaviorDir = join(root, "behavior");
  const parameterDir = join(root, "parameter");
  const sharedDir = join(root, "shared");
  const interactionDir = join(root, "interaction-records");
  const outFile = join(root, "reset-report.json");

  execFileSync("node", [resolve("scripts/sequencer-render-training/tooling/build-unified-training-set.mjs")], { cwd: resolve("."), stdio: "pipe" });
  execFileSync("node", [resolve("scripts/sequencer-render-training/tooling/build-effect-settings-coverage-report.mjs"), settingsCoverage], { cwd: resolve("."), stdio: "pipe" });
  execFileSync("node", [resolve("scripts/sequencer-render-training/tooling/build-effect-training-automation-plan.mjs"), automationPlan], { cwd: resolve("."), stdio: "pipe" });
  execFileSync("node", [resolve("scripts/sequencer-render-training/tooling/build-effect-parameter-screening-plan.mjs"), screeningPlan], { cwd: resolve("."), stdio: "pipe" });
  execFileSync("node", [resolve("scripts/sequencer-render-training/tooling/build-effect-setting-interaction-coverage-report.mjs"), automationPlan, interactionCoverage], { cwd: resolve("."), stdio: "pipe" });
  execFileSync("node", [resolve("scripts/sequencer-render-training/tooling/build-behavior-capability-records.mjs"), behaviorDir], { cwd: resolve("."), stdio: "pipe" });
  execFileSync("node", [resolve("scripts/sequencer-render-training/tooling/build-parameter-semantics-records.mjs"), parameterDir], { cwd: resolve("."), stdio: "pipe" });
  execFileSync("node", [resolve("scripts/sequencer-render-training/tooling/build-shared-setting-semantics-records.mjs"), sharedDir], { cwd: resolve("."), stdio: "pipe" });
  execFileSync("node", [resolve("scripts/sequencer-render-training/tooling/build-parameter-interaction-semantics-records.mjs"), interactionDir], { cwd: resolve("."), stdio: "pipe" });
  execFileSync("node", [
    resolve("scripts/sequencer-render-training/tooling/build-sequencer-training-reset-report.mjs"),
    "--settings-coverage", settingsCoverage,
    "--automation-plan", automationPlan,
    "--screening-plan", screeningPlan,
    "--interaction-coverage", interactionCoverage,
    "--behavior-record-dir", behaviorDir,
    "--parameter-record-dir", parameterDir,
    "--shared-record-dir", sharedDir,
    "--interaction-record-dir", interactionDir,
    "--output", outFile
  ], { cwd: resolve("."), stdio: "pipe" });

  const report = JSON.parse(readFileSync(outFile, "utf8"));
  assert.equal(report.artifactType, "sequencer_training_reset_report_v1");
  assert.equal(report.summary.cleanRegenerationAllowed, false);
  assert.ok(report.blockers.includes("interaction_coverage_incomplete"));
  assert.equal(report.summary.behaviorRecordCount > 0, true);
});
