import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

test("build-unified-training-set aggregates harvested outcome records", () => {
  const root = mkdtempSync(join(tmpdir(), "unified-training-"));
  const recordsDir = join(root, "records");
  const outFile = join(root, "training-set.json");
  mkdirSync(recordsDir, { recursive: true });
  writeFileSync(join(recordsDir, "bars-outcome.json"), JSON.stringify({
    artifactType: "effect_family_outcome_record_v1",
    storageClass: "general_training",
    effectName: "Bars",
    requestScope: { mode: "section_target_refinement" },
    revisionRoles: ["strengthen_lead"],
    resolvedSignals: ["lead_mismatch"],
    persistedSignals: [],
    newSignals: [],
    outcome: { status: "improved", improved: true }
  }, null, 2));

  execFileSync("node", [
    resolve("scripts/sequencer-render-training/tooling/build-unified-training-set.mjs"),
    outFile,
    recordsDir
  ], {
    cwd: resolve("."),
    stdio: "pipe"
  });

  const artifact = JSON.parse(readFileSync(outFile, "utf8"));
  const bars = artifact.effects.find((row) => row.effectName === "Bars");
  assert.equal(artifact.sources.liveLearning.status, "framework_with_outcome_records");
  assert.equal(bars.liveOutcomeLearning.status, "populated");
  assert.equal(bars.liveOutcomeLearning.outcomeRecordCount, 1);
  assert.equal(bars.liveOutcomeLearning.roleOutcomeMemory.strengthen_lead.sampleCount, 1);
  assert.equal(bars.liveOutcomeLearning.roleOutcomeMemory.strengthen_lead.successfulUses, 1);
  assert.deepEqual(bars.liveOutcomeLearning.roleOutcomeMemory.strengthen_lead.favoredScopes, ["section_target_refinement"]);
  assert.deepEqual(bars.liveOutcomeLearning.roleOutcomeMemory.strengthen_lead.favoredSignals, ["lead_mismatch"]);
});
