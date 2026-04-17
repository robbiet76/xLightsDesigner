import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

test("build-layering-group-evidence derives handoff and ownership observation refs", () => {
  const root = mkdtempSync(join(tmpdir(), "layering-group-evidence-"));
  const obsA = join(root, "a.render-observation.json");
  const obsB = join(root, "b.render-observation.json");
  const winA = join(root, "a.preview-window.json");
  const winB = join(root, "b.preview-window.json");

  writeFileSync(obsA, JSON.stringify({ macro: { dominantColorRole: "red", coverageRead: "partial", temporalRead: "modulated" }, analysis: { patternFamily: "family_a" } }));
  writeFileSync(obsB, JSON.stringify({ macro: { dominantColorRole: "red", coverageRead: "partial", temporalRead: "modulated" }, analysis: { patternFamily: "family_b" } }));
  writeFileSync(winA, JSON.stringify({ artifactType: "preview_scene_window_v1" }));
  writeFileSync(winB, JSON.stringify({ artifactType: "preview_scene_window_v1" }));

  const groupSet = join(root, "group-set.json");
  writeFileSync(groupSet, JSON.stringify({
    artifactType: "layering_placement_group_set_v1",
    artifactVersion: 1,
    groups: [
      {
        groupId: "same_target_transition:p1|p2",
        taxonomy: "same_target_transition",
        targetId: "Arch",
        parentTargetId: "Arch",
        overlapType: "same_target_transition",
        placements: [
          { placementId: "p1", targetId: "Arch", startMs: 1000, endMs: 1500 },
          { placementId: "p2", targetId: "Arch", startMs: 1500, endMs: 2000 }
        ]
      },
      {
        groupId: "parent_submodel_overlap:p3|p4",
        taxonomy: "parent_submodel_overlap",
        targetId: "MegaTree",
        parentTargetId: "MegaTree",
        overlapType: "parent_submodel",
        placements: [
          { placementId: "p3", targetId: "MegaTree", startMs: 1000, endMs: 2000 },
          { placementId: "p4", targetId: "MegaTree/Spokes", startMs: 1100, endMs: 1900 }
        ]
      }
    ]
  }, null, 2));

  const placementEvidence = join(root, "placement-evidence.json");
  writeFileSync(placementEvidence, JSON.stringify({
    artifactType: "layering_placement_evidence_v1",
    artifactVersion: 1,
    placements: [
      { placementId: "p1", renderObservationRef: obsA, previewSceneWindowRef: winA },
      { placementId: "p2", renderObservationRef: obsB, previewSceneWindowRef: winB },
      { placementId: "p3", renderObservationRef: obsA, previewSceneWindowRef: winA },
      { placementId: "p4", renderObservationRef: obsB, previewSceneWindowRef: winB }
    ]
  }, null, 2));

  const outDir = join(root, "out");
  execFileSync("python3", [
    "scripts/sequencer-render-training/tooling/build-layering-group-evidence.py",
    "--group-set",
    groupSet,
    "--placement-evidence",
    placementEvidence,
    "--out",
    outDir
  ], { cwd: process.cwd(), stdio: "pipe" });

  const out = JSON.parse(readFileSync(join(outDir, "layering-group-evidence.json"), "utf8"));
  assert.equal(out.groups.length, 2);
  const handoff = out.groups.find((row) => row.groupId === "same_target_transition:p1|p2");
  const ownership = out.groups.find((row) => row.groupId === "parent_submodel_overlap:p3|p4");
  assert.match(handoff.handoffObservationRef, /handoff-observation\.json$/);
  assert.match(ownership.ownershipObservationRef, /ownership-observation\.json$/);
});

