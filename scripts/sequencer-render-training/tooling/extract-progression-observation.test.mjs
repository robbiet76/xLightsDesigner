import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

test("extract-progression-observation derives section-slice progression from one observation", () => {
  const root = mkdtempSync(join(tmpdir(), "extract-progression-section-"));
  const observation = join(root, "render-observation.json");
  const out = join(root, "progression-observation.json");

  writeFileSync(observation, JSON.stringify({
    macro: {
      energyVariation: 0.55,
      burstFrameRatio: 0.4,
      holdFrameRatio: 0.15
    },
    section: {
      slices: [
        { label: "opening", leadModel: "Tree", leadModelShare: 0.72, dominantDensityBucket: "sparse", meanSceneSpreadRatio: 0.01, meanActiveNodeCount: 40, meanActiveModelCount: 1, activeFamilyTotals: { Twinkle: 1 } },
        { label: "middle", leadModel: "Tree", leadModelShare: 0.84, dominantDensityBucket: "moderate", meanSceneSpreadRatio: 0.018, meanActiveNodeCount: 64, meanActiveModelCount: 2, activeFamilyTotals: { Twinkle: 1, Wave: 1 } },
        { label: "closing", leadModel: "Tree", leadModelShare: 0.66, dominantDensityBucket: "moderate", meanSceneSpreadRatio: 0.013, meanActiveNodeCount: 52, meanActiveModelCount: 2, activeFamilyTotals: { Wave: 1 } }
      ],
      contrast: {
        spreadRange: 0.008,
        nodeCountRange: 24,
        densityVaries: true
      }
    }
  }));

  execFileSync("python3", [
    "scripts/sequencer-render-training/tooling/extract-progression-observation.py",
    "--observation",
    observation,
    "--out",
    out
  ], { cwd: process.cwd(), stdio: "pipe" });

  const result = JSON.parse(readFileSync(out, "utf8"));
  assert.equal(result.artifactType, "progression_observation_v1");
  assert.equal(result.scope.scopeLevel, "section_window");
  assert.equal(result.windowRefs.length, 3);
  assert.equal(result.handoff.handoffClarity, "medium");
  assert.equal(result.development.developmentStrength, "high");
  assert.equal(result.repetition.stalenessRisk, "medium");
  assert.equal(result.energyArc.energyShapeClarity, "low");
});

test("extract-progression-observation derives adjacent-window progression from ordered observations", () => {
  const root = mkdtempSync(join(tmpdir(), "extract-progression-ordered-"));
  const obsA = join(root, "a.render-observation.json");
  const obsB = join(root, "b.render-observation.json");
  const out = join(root, "progression-observation.json");

  writeFileSync(obsA, JSON.stringify({
    macro: {
      leadModel: "Arch",
      leadModelShare: 0.78,
      densityBucketSeries: ["sparse", "sparse"],
      meanSceneSpreadRatio: 0.012,
      maxActiveNodeCount: 48,
      maxActiveModelCount: 1,
      activeFamilyTotals: { Wave: 2 },
      temporalRead: "modulated",
      dominantColorRole: "blue"
    }
  }));
  writeFileSync(obsB, JSON.stringify({
    macro: {
      leadModel: "Arch",
      leadModelShare: 0.81,
      densityBucketSeries: ["moderate", "moderate"],
      meanSceneSpreadRatio: 0.019,
      maxActiveNodeCount: 78,
      maxActiveModelCount: 2,
      activeFamilyTotals: { Wave: 1, Twinkle: 1 },
      temporalRead: "evolving",
      dominantColorRole: "blue"
    }
  }));

  execFileSync("python3", [
    "scripts/sequencer-render-training/tooling/extract-progression-observation.py",
    "--observation",
    obsA,
    "--observation",
    obsB,
    "--out",
    out
  ], { cwd: process.cwd(), stdio: "pipe" });

  const result = JSON.parse(readFileSync(out, "utf8"));
  assert.equal(result.scope.scopeLevel, "target_transition");
  assert.equal(result.windowRefs.length, 2);
  assert.equal(result.handoff.continuityAdequacy, "high");
  assert.equal(result.development.developmentStrength, "low");
  assert.equal(result.repetition.paletteReuseLevel, "medium");
});
