import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

test("extract-sequence-critique incorporates layering weaknesses and refs", () => {
  const root = mkdtempSync(join(tmpdir(), "sequence-critique-layering-"));
  const observation = join(root, "render-observation.json");
  const layering = join(root, "layering-observation.json");
  const out = join(root, "sequence-critique.json");

  writeFileSync(observation, JSON.stringify({
    macro: {
      activeModelNames: ["MegaTree"],
      activeFamilyTotals: { wave_motion: 1, fill_hold: 1 },
      meanSceneSpreadRatio: 0.02,
      densityBucketSeries: ["medium", "medium", "medium"],
      centroidMotionMean: 0.3,
      leadModel: "MegaTree",
      leadModelShare: 0.82
    }
  }));

  writeFileSync(layering, JSON.stringify({
    artifactType: "layering_observation_v1",
    artifactVersion: 1,
    separation: {
      identityClarity: "high"
    },
    masking: {
      maskingRisk: "high",
      supportObscuration: "high"
    },
    cadence: {
      phaseClashRisk: "high"
    },
    color: {
      paletteConflict: "high"
    }
  }));

  execFileSync("python3", [
    "scripts/sequencer-render-training/tooling/extract-sequence-critique.py",
    "--observation",
    observation,
    "--layering-observation",
    layering,
    "--out",
    out
  ], { cwd: process.cwd(), stdio: "pipe" });

  const critique = JSON.parse(readFileSync(out, "utf8"));
  assert.equal(critique.artifactType, "sequence_critique_v1");
  assert.equal(critique.source.layeringObservationRef, layering);
  assert.ok(critique.designerSummary.strengths.some((line) => line.includes("Same-structure layers remain visually distinct")));
  assert.ok(critique.designerSummary.weaknesses.some((line) => line.includes("Layering on the same structure is masking")));
  assert.ok(critique.sequencerSummary.weaknesses.some((line) => line.includes("Same-target layering is obscuring")));
  assert.ok(critique.nextMoves.some((move) => move.level === "layering"));
});
