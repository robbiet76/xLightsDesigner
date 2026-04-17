import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

test("build-layering-render-proof accepts derived handoff observation without handoff window", () => {
  const root = mkdtempSync(join(tmpdir(), "layering-render-proof-"));
  const proofPlan = join(root, "proof-plan.json");
  writeFileSync(proofPlan, JSON.stringify({
    artifactType: "layering_proof_plan_v1",
    artifactVersion: 1,
    proofs: [
      {
        groupId: "same_target_transition:p1|p2",
        taxonomy: "same_target_transition",
        scope: { scopeLevel: "same_target_transition", targetId: "Arch", parentTargetId: "Arch", overlapType: "same_target_transition" },
        placementRefs: [
          { placementId: "p1", targetId: "Arch", layerIndex: 0, effectName: "Wave", startMs: 1000, endMs: 1500 },
          { placementId: "p2", targetId: "Arch", layerIndex: 0, effectName: "Wave", startMs: 1500, endMs: 2000 }
        ],
        critiqueEnabled: true
      }
    ],
    blocked: []
  }, null, 2));

  const handoffObs = join(root, "handoff-observation.json");
  writeFileSync(handoffObs, JSON.stringify({ artifactType: "handoff_observation_v1", artifactVersion: 1 }));

  const placementEvidence = join(root, "placement-evidence.json");
  writeFileSync(placementEvidence, JSON.stringify({
    placements: [
      { placementId: "p1", previewSceneWindowRef: "/tmp/a.preview-window.json" },
      { placementId: "p2", previewSceneWindowRef: "/tmp/b.preview-window.json" }
    ],
    groups: [
      { groupId: "same_target_transition:p1|p2", handoffObservationRef: handoffObs }
    ],
    blocked: []
  }, null, 2));

  const outDir = join(root, "out");
  execFileSync("python3", [
    "scripts/sequencer-render-training/tooling/build-layering-render-proof.py",
    "--proof-plan",
    proofPlan,
    "--placement-evidence",
    placementEvidence,
    "--out",
    outDir
  ], { cwd: process.cwd(), stdio: "pipe" });

  const out = JSON.parse(readFileSync(join(outDir, "layering-render-proof-bundle.json"), "utf8"));
  assert.equal(out.proofs.length, 1);
  assert.equal(out.blocked.length, 0);
  assert.equal(out.proofs[0].blocked, false);
  assert.match(out.proofs[0].handoffObservationRef, /handoff-observation\.json$/);
});

