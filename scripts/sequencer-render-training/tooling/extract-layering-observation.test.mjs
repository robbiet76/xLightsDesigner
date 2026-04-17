import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

test("extract-layering-observation derives compact same-structure layering evidence", () => {
  const root = mkdtempSync(join(tmpdir(), "extract-layering-observation-"));

  const isolatedA = join(root, "isolated-a.render-observation.json");
  const isolatedB = join(root, "isolated-b.render-observation.json");
  const composite = join(root, "composite.render-observation.json");
  const handoff = join(root, "handoff-observation.json");
  const ownership = join(root, "ownership-observation.json");
  const proof = join(root, "layering-render-proof.json");
  const out = join(root, "layering-observation.json");

  writeFileSync(isolatedA, JSON.stringify({
    macro: {
      temporalRead: "bursting",
      coverageRead: "partial",
      dominantColorRole: "red",
      meanColorSpread: 0.2,
      multicolorFrameRatio: 0.1,
      pulsePeakCount: 4,
      burstFrameRatio: 0.55,
      holdFrameRatio: 0.1
    },
    analysis: {
      patternFamily: "wave_motion"
    }
  }));

  writeFileSync(isolatedB, JSON.stringify({
    macro: {
      temporalRead: "holding",
      coverageRead: "full",
      dominantColorRole: "blue",
      meanColorSpread: 0.15,
      multicolorFrameRatio: 0.05,
      pulsePeakCount: 1,
      burstFrameRatio: 0.05,
      holdFrameRatio: 0.7
    },
    analysis: {
      patternFamily: "fill_hold"
    }
  }));

  writeFileSync(composite, JSON.stringify({
    macro: {
      temporalRead: "modulated",
      coverageRead: "full",
      dominantColorRole: "red",
      meanColorSpread: 0.18,
      multicolorFrameRatio: 0.08
    },
    analysis: {
      patternFamily: "wave_motion"
    }
  }));

  writeFileSync(handoff, JSON.stringify({
    artifactType: "handoff_observation_v1",
    artifactVersion: 1,
    signals: {
      temporalReadStable: false,
      patternFamilyChanged: true,
      dominantColorStable: false
    }
  }));

  writeFileSync(ownership, JSON.stringify({
    artifactType: "ownership_observation_v1",
    artifactVersion: 1,
    signals: {
      parentDominant: true,
      childDistinct: true
    }
  }));

  writeFileSync(proof, JSON.stringify({
    artifactType: "layering_render_proof_v1",
    artifactVersion: 1,
    scope: {
      scopeLevel: "parent_submodel_window",
      targetId: "MegaTree",
      parentTargetId: "MegaTree",
      overlapType: "parent_submodel"
    },
    placementRefs: [
      {
        placementId: "p1",
        targetId: "MegaTree",
        layerIndex: 0,
        effectName: "Wave"
      },
      {
        placementId: "p2",
        targetId: "MegaTree/Spokes",
        layerIndex: 1,
        effectName: "Color Wash"
      }
    ],
    isolatedElementRefs: [
      {
        placementId: "p1",
        renderObservationRef: isolatedA
      },
      {
        placementId: "p2",
        renderObservationRef: isolatedB
      }
    ],
    compositeObservationRef: composite,
    handoffObservationRef: handoff,
    ownershipObservationRef: ownership
  }, null, 2));

  execFileSync("python3", [
    "scripts/sequencer-render-training/tooling/extract-layering-observation.py",
    "--proof",
    proof,
    "--out",
    out
  ], { cwd: process.cwd(), stdio: "pipe" });

  const result = JSON.parse(readFileSync(out, "utf8"));
  assert.equal(result.artifactType, "layering_observation_v1");
  assert.equal(result.scope.scopeLevel, "parent_submodel_window");
  assert.equal(result.elementRefs.length, 2);
  assert.equal(result.elementRefs[0].roleHint, "lead");
  assert.equal(result.elementRefs[1].roleHint, "support");
  assert.equal(result.separation.identityClarity, "high");
  assert.equal(result.masking.maskingRisk, "medium");
  assert.equal(result.cadence.phaseClashRisk, "medium");
  assert.equal(result.color.paletteConflict, "medium");
  assert.ok(result.notes.some((note) => note.includes("handoff_observation_v1")));
  assert.ok(result.notes.some((note) => note.includes("ownership_observation_v1")));
  assert.equal(result.source.renderObservationRefs.length, 2);
});
