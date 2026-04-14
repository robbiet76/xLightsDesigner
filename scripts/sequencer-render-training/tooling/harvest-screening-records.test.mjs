import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

test("harvest-screening-records keeps distinct geometry variants", () => {
  const root = mkdtempSync(join(tmpdir(), "harvest-screening-"));
  const sourceA = join(root, "run-a", "sample-a");
  const sourceB = join(root, "run-b", "sample-b");
  const outDir = join(root, "out");
  mkdirSync(sourceA, { recursive: true });
  mkdirSync(sourceB, { recursive: true });

  const baseRecord = {
    recordVersion: "1.0",
    sampleId: "marquee-speed-1-rgb_primary-generated-v1",
    effectName: "Marquee",
    observations: { labels: [] },
    features: {}
  };

  writeFileSync(
    join(sourceA, "marquee-speed-1-rgb_primary-generated-v1.record.json"),
    `${JSON.stringify({
      ...baseRecord,
      fixture: { modelName: "ArchGroup", geometryProfile: "arch_grouped" }
    })}\n`,
    "utf8"
  );
  writeFileSync(
    join(sourceB, "marquee-speed-1-rgb_primary-generated-v1.record.json"),
    `${JSON.stringify({
      ...baseRecord,
      fixture: { modelName: "SingleLineHorizontal", geometryProfile: "single_line_horizontal" }
    })}\n`,
    "utf8"
  );

  execFileSync("node", [
    resolve("scripts/sequencer-render-training/tooling/harvest-screening-records.mjs"),
    "--source",
    join(root, "run-a"),
    "--out-dir",
    outDir
  ], { cwd: resolve("."), stdio: "pipe" });
  execFileSync("node", [
    resolve("scripts/sequencer-render-training/tooling/harvest-screening-records.mjs"),
    "--source",
    join(root, "run-b"),
    "--out-dir",
    outDir
  ], { cwd: resolve("."), stdio: "pipe" });

  const files = readdirSync(outDir).sort();
  assert.equal(files.length, 2);
  assert.ok(files.some((name) => name.includes("archgroup-arch-grouped")));
  assert.ok(files.some((name) => name.includes("singlelinehorizontal-single-line-horizontal")));
});
