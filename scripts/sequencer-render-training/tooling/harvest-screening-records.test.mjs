import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
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
  assert.ok(files.some((name) => name.includes("marquee-arch-grouped")));
  assert.ok(files.some((name) => name.includes("marquee-single-line-horizontal")));
  assert.ok(!files.some((name) => name.includes("archgroup")));
  assert.ok(!files.some((name) => name.includes("singlelinehorizontal")));
});

test("harvest-screening-records removes user-specific model identity and local instance fields", () => {
  const root = mkdtempSync(join(tmpdir(), "harvest-screening-sanitize-"));
  const source = join(root, "run", "sample");
  const outDir = join(root, "out");
  mkdirSync(source, { recursive: true });

  writeFileSync(
    join(source, "bars-cycles-2-mono_white-generated-v1.record.json"),
    `${JSON.stringify({
      recordVersion: "1.0",
      sampleId: "bars-cycles-2-mono_white-generated-v1",
      effectName: "Bars",
      fixture: {
        modelName: "George",
        geometryProfile: "arch_grouped",
        sequencePath: "/tmp/local/sequence.xsq",
        workingSequencePath: "/tmp/local/working.xsq"
      },
      artifact: { path: "/tmp/local/render.gif" },
      features: {
        artifactPath: "/tmp/local/render.gif",
        analyzedArtifactPath: "/tmp/local/analyzed.gif"
      },
      modelMetadata: {
        modelName: "George",
        startChannel: 100,
        startChannelZero: 99,
        endChannel: 249,
        structuralSettings: {
          X2: "195.0",
          Y2: "0.0",
          Z2: "0.0",
          CustomModel: "1,2,3",
          ModelChain: ">George",
          parm1: "3"
        }
      }
    })}\n`,
    "utf8"
  );

  execFileSync("node", [
    resolve("scripts/sequencer-render-training/tooling/harvest-screening-records.mjs"),
    "--source",
    join(root, "run"),
    "--out-dir",
    outDir
  ], { cwd: resolve("."), stdio: "pipe" });

  const files = readdirSync(outDir).sort();
  assert.equal(files.length, 1);
  const harvested = JSON.parse(readFileSync(join(outDir, files[0]), "utf8"));
  assert.equal("modelName" in (harvested.fixture || {}), false);
  assert.equal("sequencePath" in (harvested.fixture || {}), false);
  assert.equal("workingSequencePath" in (harvested.fixture || {}), false);
  assert.equal("path" in (harvested.artifact || {}), false);
  assert.equal("artifactPath" in (harvested.features || {}), false);
  assert.equal("analyzedArtifactPath" in (harvested.features || {}), false);
  assert.equal("modelName" in (harvested.modelMetadata || {}), false);
  assert.equal("startChannel" in (harvested.modelMetadata || {}), false);
  assert.equal("startChannelZero" in (harvested.modelMetadata || {}), false);
  assert.equal("endChannel" in (harvested.modelMetadata || {}), false);
  assert.equal("X2" in (harvested.modelMetadata?.structuralSettings || {}), false);
  assert.equal("Y2" in (harvested.modelMetadata?.structuralSettings || {}), false);
  assert.equal("Z2" in (harvested.modelMetadata?.structuralSettings || {}), false);
  assert.equal("CustomModel" in (harvested.modelMetadata?.structuralSettings || {}), false);
  assert.equal("ModelChain" in (harvested.modelMetadata?.structuralSettings || {}), false);
  assert.equal(harvested.modelMetadata?.structuralSettings?.parm1, "3");
});
