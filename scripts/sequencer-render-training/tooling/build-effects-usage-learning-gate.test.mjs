import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

test("effects usage learning gate blocks flat runs without behavior rules", () => {
  const root = mkdtempSync(join(tmpdir(), "effects-learning-gate-"));
  const runRoot = join(root, "run");
  const existingDir = join(root, "existing");
  const outPath = join(root, "gate.json");
  const trainingSetPath = join(root, "training-set.json");
  mkdirSync(join(runRoot, "pack", "sample"), { recursive: true });
  mkdirSync(existingDir, { recursive: true });

  writeFileSync(join(runRoot, "pack", "run-summary.json"), JSON.stringify({
    passedSamples: 1,
    failedSamples: 0
  }, null, 2));
  writeFileSync(join(runRoot, "pack", "sample", "new-sample.record.json"), JSON.stringify({
    recordVersion: "1.0",
    sampleId: "new-sample",
    effectName: "Color Wash",
    observations: {
      labels: ["decoded_fseq", "blank_sampled_frame"]
    }
  }, null, 2));
  writeFileSync(trainingSetPath, JSON.stringify({
    effects: [
      {
        effectName: "Color Wash",
        parameterLearning: {
          derivedPriors: {
            priors: [
              {
                parameterName: "cycles",
                behaviorDimensions: {
                  behaviorRules: []
                }
              }
            ]
          }
        }
      }
    ]
  }, null, 2));

  execFileSync("node", [
    resolve("scripts/sequencer-render-training/tooling/build-effects-usage-learning-gate.mjs"),
    "--run-root", runRoot,
    "--training-set", trainingSetPath,
    "--existing-records-dir", existingDir,
    "--out", outPath
  ], { cwd: resolve("."), stdio: "pipe" });

  const report = JSON.parse(readFileSync(outPath, "utf8"));
  assert.equal(report.summary.promotionReady, false);
  assert.equal(report.summary.recordCount, 1);
  assert.equal(report.summary.blankRecordCount, 1);
  assert.equal(report.summary.behaviorRuleCount, 0);
  assert.equal(report.byPalette[0].paletteMode, "default");
  assert.equal(report.byPalette[0].behaviorRuleCount, 0);
  assert.equal(report.blockers.includes("no_generalized_behavior_rules"), true);
});

test("effects usage learning gate allows runs with new nonblank behavior rules", () => {
  const root = mkdtempSync(join(tmpdir(), "effects-learning-gate-ready-"));
  const runRoot = join(root, "run");
  const existingDir = join(root, "existing");
  const outPath = join(root, "gate.json");
  const trainingSetPath = join(root, "training-set.json");
  mkdirSync(join(runRoot, "pack", "sample"), { recursive: true });
  mkdirSync(existingDir, { recursive: true });

  writeFileSync(join(runRoot, "pack", "run-summary.json"), JSON.stringify({
    passedSamples: 1,
    failedSamples: 0
  }, null, 2));
  writeFileSync(join(runRoot, "pack", "sample", "new-sample.record.json"), JSON.stringify({
    recordVersion: "1.0",
    sampleId: "new-sample",
    effectName: "Marquee",
    trainingContext: {
      screeningPaletteMode: "rgb_primary"
    },
    observations: {
      labels: ["decoded_fseq", "forward_motion"]
    }
  }, null, 2));
  writeFileSync(trainingSetPath, JSON.stringify({
    effects: [
      {
        effectName: "Marquee",
        parameterLearning: {
          derivedPriors: {
            priors: [
              {
                parameterName: "speed",
                paletteMode: "rgb_primary",
                behaviorDimensions: {
                  behaviorRules: [
                    { dimension: "motion", direction: "increases", magnitude: 0.08, summary: "speed increases motion" }
                  ]
                }
              }
            ]
          }
        }
      }
    ]
  }, null, 2));

  execFileSync("node", [
    resolve("scripts/sequencer-render-training/tooling/build-effects-usage-learning-gate.mjs"),
    "--run-root", runRoot,
    "--training-set", trainingSetPath,
    "--existing-records-dir", existingDir,
    "--out", outPath
  ], { cwd: resolve("."), stdio: "pipe" });

  const report = JSON.parse(readFileSync(outPath, "utf8"));
  assert.equal(report.summary.promotionReady, true);
  assert.equal(report.summary.behaviorRuleCount, 1);
  assert.equal(report.summary.newSampleIdCount, 1);
  assert.deepEqual(report.summary.requiredPaletteModes, ["rgb_primary"]);
  assert.equal(report.byPalette[0].paletteMode, "rgb_primary");
  assert.equal(report.byPalette[0].behaviorRuleCount, 1);
  assert.deepEqual(report.blockers, []);
});

test("effects usage learning gate requires rules for each observed palette mode", () => {
  const root = mkdtempSync(join(tmpdir(), "effects-learning-gate-palettes-"));
  const runRoot = join(root, "run");
  const existingDir = join(root, "existing");
  const outPath = join(root, "gate.json");
  const trainingSetPath = join(root, "training-set.json");
  mkdirSync(join(runRoot, "pack", "a"), { recursive: true });
  mkdirSync(join(runRoot, "pack", "b"), { recursive: true });
  mkdirSync(existingDir, { recursive: true });

  writeFileSync(join(runRoot, "pack", "run-summary.json"), JSON.stringify({
    passedSamples: 2,
    failedSamples: 0
  }, null, 2));
  for (const [dir, sampleId, paletteMode] of [
    ["a", "mono-sample", "mono_white"],
    ["b", "rgb-sample", "rgb_primary"]
  ]) {
    writeFileSync(join(runRoot, "pack", dir, `${sampleId}.record.json`), JSON.stringify({
      recordVersion: "1.0",
      sampleId,
      effectName: "Bars",
      trainingContext: { screeningPaletteMode: paletteMode },
      observations: { labels: ["decoded_fseq"] }
    }, null, 2));
  }
  writeFileSync(trainingSetPath, JSON.stringify({
    effects: [
      {
        effectName: "Bars",
        parameterLearning: {
          derivedPriors: {
            priors: [
              {
                parameterName: "cycles",
                paletteMode: "mono_white",
                behaviorDimensions: {
                  behaviorRules: [
                    { dimension: "motion", direction: "increases", magnitude: 0.04, summary: "cycles increases motion" }
                  ]
                }
              },
              {
                parameterName: "cycles",
                paletteMode: "rgb_primary",
                behaviorDimensions: {
                  behaviorRules: []
                }
              }
            ]
          }
        }
      }
    ]
  }, null, 2));

  execFileSync("node", [
    resolve("scripts/sequencer-render-training/tooling/build-effects-usage-learning-gate.mjs"),
    "--run-root", runRoot,
    "--training-set", trainingSetPath,
    "--existing-records-dir", existingDir,
    "--out", outPath
  ], { cwd: resolve("."), stdio: "pipe" });

  const report = JSON.parse(readFileSync(outPath, "utf8"));
  assert.equal(report.summary.promotionReady, false);
  assert.deepEqual(report.summary.requiredPaletteModes, ["mono_white", "rgb_primary"]);
  assert.equal(report.byPalette.find((row) => row.paletteMode === "mono_white").behaviorRuleCount, 1);
  assert.equal(report.byPalette.find((row) => row.paletteMode === "mono_white").representativeClass, "single_color_representative");
  assert.equal(report.byPalette.find((row) => row.paletteMode === "rgb_primary").behaviorRuleCount, 0);
  assert.equal(report.byPalette.find((row) => row.paletteMode === "rgb_primary").representativeClass, "multi_color_representative");
  assert.equal(report.blockers.includes("palette_rgb_primary_has_no_generalized_behavior_rules"), true);
});
