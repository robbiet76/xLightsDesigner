import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

test("training record generators emit canonical record indexes", () => {
  const root = mkdtempSync(join(tmpdir(), "training-records-"));
  const behaviorDir = join(root, "behavior");
  const parameterDir = join(root, "parameter");
  const sharedDir = join(root, "shared");
  const interactionDir = join(root, "interaction");
  execFileSync("node", [resolve("scripts/sequencer-render-training/tooling/build-behavior-capability-records.mjs"), behaviorDir], { cwd: resolve("."), stdio: "pipe" });
  execFileSync("node", [resolve("scripts/sequencer-render-training/tooling/build-parameter-semantics-records.mjs"), parameterDir], { cwd: resolve("."), stdio: "pipe" });
  execFileSync("node", [resolve("scripts/sequencer-render-training/tooling/build-shared-setting-semantics-records.mjs"), sharedDir], { cwd: resolve("."), stdio: "pipe" });
  execFileSync("node", [resolve("scripts/sequencer-render-training/tooling/build-parameter-interaction-semantics-records.mjs"), interactionDir], { cwd: resolve("."), stdio: "pipe" });
  const behaviorIndex = JSON.parse(readFileSync(join(behaviorDir, "index.json"), "utf8"));
  const parameterIndex = JSON.parse(readFileSync(join(parameterDir, "index.json"), "utf8"));
  const sharedIndex = JSON.parse(readFileSync(join(sharedDir, "index.json"), "utf8"));
  const interactionIndex = JSON.parse(readFileSync(join(interactionDir, "index.json"), "utf8"));
  assert.equal(behaviorIndex.artifactType, "behavior_capability_record_index_v1");
  assert.equal(parameterIndex.artifactType, "parameter_semantics_record_index_v1");
  assert.equal(sharedIndex.artifactType, "shared_setting_semantics_record_index_v1");
  assert.equal(interactionIndex.artifactType, "parameter_interaction_semantics_record_index_v1");
  assert.ok(behaviorIndex.recordCount > 0);
  assert.ok(parameterIndex.recordCount > 0);
  assert.ok(sharedIndex.recordCount > 0);
  assert.ok(interactionIndex.recordCount > 0);
});

test("behavior record generator can emit a packed catalog consumed by the bundle exporter", () => {
  const root = mkdtempSync(join(tmpdir(), "training-record-packs-"));
  const packPath = join(root, "behavior-capability-records.records.jsonl");
  const bundlePath = join(root, "behavior-capability-records-bundle.js");

  execFileSync("node", [resolve("scripts/sequencer-render-training/tooling/build-behavior-capability-records.mjs"), packPath], { cwd: resolve("."), stdio: "pipe" });
  execFileSync("node", [resolve("scripts/sequencer-render-training/tooling/export-behavior-capability-records-bundle.mjs"), packPath, bundlePath], { cwd: resolve("."), stdio: "pipe" });

  assert.equal(existsSync(packPath), true);
  assert.equal(readFileSync(packPath, "utf8").trim().split("\n").length > 0, true);
  const bundle = readFileSync(bundlePath, "utf8");
  assert.equal(bundle.includes("BEHAVIOR_CAPABILITY_RECORDS_BUNDLE"), true);
  assert.equal(bundle.includes("behavior_capability_record_index_v1"), true);
});
