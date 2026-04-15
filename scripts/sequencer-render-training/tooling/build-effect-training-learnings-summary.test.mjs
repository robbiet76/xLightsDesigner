import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

test("build-effect-training-learnings-summary emits a markdown summary from per-effect dossiers", () => {
  const root = mkdtempSync(join(tmpdir(), "effect-learning-summary-"));
  const dossiers = join(root, "dossiers");
  const summary = join(root, "summary.md");
  execFileSync("node", [resolve("scripts/sequencer-render-training/tooling/build-effect-training-dossiers.mjs"), dossiers], {
    cwd: resolve("."),
    stdio: "pipe"
  });
  execFileSync("node", [resolve("scripts/sequencer-render-training/tooling/build-effect-training-learnings-summary.mjs"), dossiers, summary], {
    cwd: resolve("."),
    stdio: "pipe"
  });
  const text = readFileSync(summary, "utf8");
  assert.ok(text.includes("# Effect Training Learnings Summary"));
  assert.ok(text.includes("## Shockwave"));
  assert.ok(text.includes("## On"));
});
