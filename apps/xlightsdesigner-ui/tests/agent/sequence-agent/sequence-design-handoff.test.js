import test from "node:test";
import assert from "node:assert/strict";

import { buildSequencingDesignHandoffV2 } from "../../../agent/sequence-agent/sequence-design-handoff.js";
import { buildVisualDesignAssetPack } from "../../../agent/designer-dialog/visual-design-assets.js";

test("sequencing design handoff derives semantic directives from prompt intent, not realization hints", () => {
  const artifact = buildSequencingDesignHandoffV2({
    requestId: "req-1",
    baseRevision: "rev-1",
    normalizedIntent: {
      goal: "Keep the bridge soft, restrained, and texture-led with a gentle handoff rather than a bold ring or spin."
    },
    proposalBundle: {
      artifactId: "proposal-1",
      summary: "Bridge texture pass",
      scope: { targetIds: ["Spinners"] }
    },
    executionStrategy: {
      sectionPlans: [
        {
          section: "Bridge",
          energy: "medium",
          density: "moderate",
          intentSummary: "Keep the bridge soft, restrained, and texture-led with a gentle handoff rather than a bold ring or spin.",
          effectHints: ["Shockwave", "Pinwheel"],
          targetIds: ["Spinners"]
        }
      ]
    }
  });

  assert.equal(artifact.sectionDirectives.length, 1);
  assert.equal(artifact.sectionDirectives[0].motionTarget, "restrained_motion");
  assert.deepEqual(artifact.sectionDirectives[0].preferredVisualFamilies, ["soft_texture"]);
});

test("sequencing design handoff carries compact visual asset references", () => {
  const visualPack = buildVisualDesignAssetPack({
    sequenceId: "seq-1",
    themeSummary: "warm nostalgic glow",
    inspirationPrompt: "Create a warm nostalgic holiday collage.",
    palette: [{ name: "candle gold", hex: "#ffc45c", role: "warm highlight" }],
    motifs: ["window glow", "soft garland"],
    displayAsset: { relativePath: "inspiration-board.png" },
    sequenceAssets: [
      {
        assetId: "asset-001",
        kind: "image",
        relativePath: "images/window-glow.webp",
        mimeType: "image/webp",
        intendedUse: "picture_effect_texture",
        recommendedSections: ["Intro"],
        paletteRoles: ["warm highlight"],
        motionUse: "static_or_slow_pan"
      }
    ]
  });

  const artifact = buildSequencingDesignHandoffV2({
    requestId: "req-1",
    baseRevision: "rev-1",
    normalizedIntent: {
      goal: "Make the intro feel warm and nostalgic."
    },
    proposalBundle: {
      artifactId: "proposal-1",
      summary: "Warm intro",
      scope: { targetIds: ["House"] }
    },
    executionStrategy: {
      sectionPlans: [
        {
          section: "Intro",
          energy: "low",
          density: "sparse",
          intentSummary: "Warm nostalgic intro.",
          targetIds: ["House"]
        }
      ]
    },
    visualDesignAssetPack: visualPack
  });

  assert.equal(artifact.visualAssetPackRef, visualPack.artifactId);
  assert.deepEqual(artifact.paletteRoles, visualPack.creativeIntent.palette);
  assert.deepEqual(artifact.motifDirectives, ["window glow", "soft garland"]);
  assert.deepEqual(artifact.mediaAssetDirectives, [
    {
      assetId: "asset-001",
      kind: "image",
      intendedUse: "picture_effect_texture",
      recommendedSections: ["Intro"],
      paletteRoles: ["warm highlight"],
      motionUse: "static_or_slow_pan"
    }
  ]);
  assert.equal("imageData" in artifact, false);
});
