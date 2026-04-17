import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

test("extract-sequence-critique incorporates progression weaknesses and refs", () => {
  const root = mkdtempSync(join(tmpdir(), "sequence-critique-progression-"));
  const observation = join(root, "render-observation.json");
  const progression = join(root, "progression-observation.json");
  const out = join(root, "sequence-critique.json");

  writeFileSync(observation, JSON.stringify({
    macro: {
      activeModelNames: ["Arch", "Tree"],
      activeFamilyTotals: { Wave: 1, Twinkle: 1 },
      meanSceneSpreadRatio: 0.02,
      densityBucketSeries: ["medium", "medium", "medium"],
      centroidMotionMean: 0.25,
      leadModel: "Tree",
      leadModelShare: 0.79
    }
  }));

  writeFileSync(progression, JSON.stringify({
    artifactType: "progression_observation_v1",
    artifactVersion: 1,
    handoff: {
      handoffClarity: "high"
    },
    development: {
      developmentStrength: "low",
      stagnationRisk: "high"
    },
    repetition: {
      stalenessRisk: "high"
    },
    energyArc: {
      arcCoherence: "low"
    }
  }));

  execFileSync("python3", [
    "scripts/sequencer-render-training/tooling/extract-sequence-critique.py",
    "--observation",
    observation,
    "--progression-observation",
    progression,
    "--out",
    out
  ], { cwd: process.cwd(), stdio: "pipe" });

  const critique = JSON.parse(readFileSync(out, "utf8"));
  assert.equal(critique.artifactType, "sequence_critique_v1");
  assert.equal(critique.source.progressionObservationRef, progression);
  assert.ok(critique.designerSummary.strengths.some((line) => line.includes("temporal handoff reads cleanly")));
  assert.ok(critique.designerSummary.weaknesses.some((line) => line.includes("stagnating")));
  assert.ok(critique.designerSummary.weaknesses.some((line) => line.includes("stale")));
  assert.ok(critique.sequencerSummary.weaknesses.some((line) => line.includes("not evolving enough")));
  assert.ok(critique.nextMoves.some((move) => move.level === "progression"));
});
