import test from "node:test";
import assert from "node:assert/strict";

import { buildLayeringProofPlan } from "../../../agent/sequence-agent/layering-proof-plan.js";

test("buildLayeringProofPlan emits proof requirements for supported layering groups", () => {
  const out = buildLayeringProofPlan({
    groupSet: {
      groups: [
        {
          groupId: "same_target_layer_stack:p1|p2",
          taxonomy: "same_target_layer_stack",
          targetId: "MegaTree",
          parentTargetId: "MegaTree",
          overlapType: "same_target",
          placements: [
            { placementId: "p1", targetId: "MegaTree", layerIndex: 0, effectName: "Color Wash", startMs: 1000, endMs: 2000 },
            { placementId: "p2", targetId: "MegaTree", layerIndex: 1, effectName: "Strobe", startMs: 1200, endMs: 1800 }
          ]
        },
        {
          groupId: "same_target_transition:p3|p4",
          taxonomy: "same_target_transition",
          targetId: "Arch",
          parentTargetId: "Arch",
          overlapType: "same_target_transition",
          placements: [
            { placementId: "p3", targetId: "Arch", layerIndex: 0, effectName: "Wave", startMs: 3000, endMs: 3500 },
            { placementId: "p4", targetId: "Arch", layerIndex: 0, effectName: "Wave", startMs: 3500, endMs: 4100 }
          ]
        }
      ],
      unresolved: []
    }
  });

  assert.equal(out.proofs.length, 2);
  assert.equal(out.proofs[0].scope.scopeLevel, "same_target_window");
  assert.deepEqual(out.proofs[0].renderPasses, ["composite_window", "isolated_element_windows"]);
  assert.equal(out.proofs[1].scope.scopeLevel, "same_target_transition");
  assert.equal(out.proofs[1].critiqueEnabled, true);
});

test("buildLayeringProofPlan marks unresolved groups as blocked", () => {
  const out = buildLayeringProofPlan({
    groupSet: {
      groups: [],
      unresolved: [
        {
          groupId: "sibling_submodel_overlap:p1|p2",
          taxonomy: "sibling_submodel_overlap",
          unresolvedReason: "effectPlacements provide shared parent ancestry but not enough physical ownership detail to prove sibling overlap.",
          placements: [
            { placementId: "p1", targetId: "MegaTree/Left" },
            { placementId: "p2", targetId: "MegaTree/Right" }
          ]
        }
      ]
    }
  });

  assert.equal(out.proofs.length, 0);
  assert.equal(out.blocked.length, 1);
  assert.equal(out.blocked[0].blocked, true);
  assert.match(out.blocked[0].unresolvedReason, /not enough physical ownership detail/i);
});

