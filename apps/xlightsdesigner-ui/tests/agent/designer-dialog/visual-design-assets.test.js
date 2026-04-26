import test from "node:test";
import assert from "node:assert/strict";

import {
  buildVisualDesignAssetPack,
  buildVisualInspirationRefs,
  validateVisualDesignAssetPack
} from "../../../agent/designer-dialog/visual-design-assets.js";

test("visual design asset pack builder creates valid compact manifest", () => {
  const pack = buildVisualDesignAssetPack({
    sequenceId: "CarolOfTheBells",
    trackIdentity: {
      title: "Carol of the Bells",
      artist: "Traditional",
      contentFingerprint: "fingerprint-1"
    },
    themeSummary: "icy choral tension with gold release",
    inspirationPrompt: "Create a collage mood board for icy choral holiday tension with gold release.",
    palette: [
      { name: "ice blue", hex: "#8fd8ff", role: "cool base" },
      { name: "warm gold", hex: "#ffd36a", role: "impact highlight" }
    ],
    motifs: ["ice shards", "bell shimmer"],
    avoidances: ["do not depict the literal xLights layout"],
    displayAsset: {
      relativePath: "inspiration-board.png",
      width: 1536,
      height: 1024
    },
    sequenceAssets: [
      {
        assetId: "asset-001",
        kind: "image",
        relativePath: "images/ice-shimmer.webp",
        mimeType: "image/webp",
        intendedUse: "picture_effect_texture",
        recommendedSections: ["Intro"],
        paletteRoles: ["cool base"],
        motionUse: "static_or_slow_pan",
        source: {
          provider: "openai",
          model: "gpt-image-2",
          promptRef: "prompt-001"
        }
      }
    ]
  });

  assert.equal(pack.artifactType, "visual_design_asset_pack_v1");
  assert.equal(Number(pack.artifactVersion), 1);
  assert.equal(pack.displayAsset.relativePath, "inspiration-board.png");
  assert.deepEqual(validateVisualDesignAssetPack(pack), []);
});

test("visual inspiration refs keep handoff compact", () => {
  const pack = buildVisualDesignAssetPack({
    sequenceId: "seq-1",
    themeSummary: "warm nostalgic holiday",
    inspirationPrompt: "Create a warm nostalgic holiday collage.",
    palette: [{ name: "candle gold", hex: "#ffc45c", role: "warm highlight" }],
    motifs: ["window glow"],
    displayAsset: { relativePath: "inspiration-board.png" }
  });

  const refs = buildVisualInspirationRefs(pack);

  assert.equal(refs.artifactId, pack.artifactId);
  assert.equal(refs.displayAssetRef, "inspiration-board.png");
  assert.deepEqual(refs.palette, [{ name: "candle gold", hex: "#ffc45c", role: "warm highlight" }]);
  assert.equal("imageData" in refs, false);
});
