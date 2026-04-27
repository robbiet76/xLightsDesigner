import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDefaultVisualMediaAssetPlans,
  buildVisualDesignImageEditRevision,
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
    ],
    mediaAssetPlans: buildDefaultVisualMediaAssetPlans({
      themeSummary: "icy choral tension with gold release",
      palette: [
        { name: "ice blue", hex: "#8fd8ff", role: "cool base" },
        { name: "warm gold", hex: "#ffd36a", role: "impact highlight" }
      ],
      motifs: ["ice shards", "bell shimmer"],
      sections: ["Intro", "Chorus"]
    })
  });

  assert.equal(pack.artifactType, "visual_design_asset_pack_v1");
  assert.equal(Number(pack.artifactVersion), 1);
  assert.equal(pack.displayAsset.relativePath, "inspiration-board.png");
  assert.equal(pack.palette.required, true);
  assert.deepEqual(pack.palette.colors, pack.creativeIntent.palette);
  assert.equal(pack.displayAsset.currentRevisionId, "board-r001");
  assert.equal(pack.imageRevisions[0].mode, "generate");
  assert.equal(pack.imageRevisions[0].paletteLocked, true);
  assert.equal(pack.imageRevisions[0].source.model, "gpt-image-2");
  assert.equal(pack.mediaAssetPlans.length, 3);
  assert.equal(pack.mediaAssetPlans[0].status, "planned");
  assert.equal(pack.mediaAssetPlans[2].kind, "video");
  assert.equal(pack.mediaAssetPlans[2].status, "deferred");
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
  assert.equal(refs.currentRevisionId, "board-r001");
  assert.deepEqual(refs.palette, [{ name: "candle gold", hex: "#ffc45c", role: "warm highlight" }]);
  assert.equal(refs.paletteCoordinationRule, "Image colors must reflect or coordinate with the approved palette.");
  assert.equal(refs.mediaAssetPlanCount, 0);
  assert.equal("imageData" in refs, false);
});

test("visual design image edit revisions preserve lineage and palette coordination", () => {
  const first = buildVisualDesignAssetPack({
    sequenceId: "seq-1",
    themeSummary: "warm nostalgic holiday",
    inspirationPrompt: "Create a warm nostalgic holiday collage.",
    palette: [{ name: "candle gold", hex: "#ffc45c", role: "warm highlight" }],
    motifs: ["window glow"],
    displayAsset: { relativePath: "inspiration-board.png" }
  });

  const edited = buildVisualDesignImageEditRevision({
    assetPack: first,
    userRequest: "Make the window glow softer but keep the same palette.",
    prompt: "Edit the existing board to soften the window glow. Preserve the candle gold palette.",
    changeSummary: "Softened the window glow while preserving palette."
  });

  assert.deepEqual(validateVisualDesignAssetPack(edited), []);
  assert.equal(edited.imageRevisions.length, 2);
  assert.equal(edited.imageRevisions[1].mode, "edit");
  assert.equal(edited.imageRevisions[1].parentRevisionId, "board-r001");
  assert.equal(edited.imageRevisions[1].revisionId, "board-r002");
  assert.equal(edited.imageRevisions[1].paletteLocked, true);
  assert.equal(edited.imageRevisions[1].source.provider, "openai");
  assert.equal(edited.imageRevisions[1].source.model, "gpt-image-2");
  assert.equal(edited.displayAsset.currentRevisionId, "board-r002");
  assert.equal(edited.displayAsset.relativePath, "revisions/board-r002.png");
  assert.deepEqual(edited.palette.colors, first.palette.colors);
  assert.equal(edited.prompts[1].operation, "edit");
  assert.equal(edited.prompts[1].inputRevisionId, "board-r001");
});

test("visual design image edit revisions can intentionally update palette", () => {
  const first = buildVisualDesignAssetPack({
    sequenceId: "seq-1",
    themeSummary: "cool winter",
    inspirationPrompt: "Create a cool winter collage.",
    palette: [{ name: "ice blue", hex: "#8fd8ff", role: "base" }],
    displayAsset: { relativePath: "inspiration-board.png" }
  });

  const edited = buildVisualDesignImageEditRevision({
    assetPack: first,
    userRequest: "Add a little warmer gold to the palette.",
    palette: [
      { name: "ice blue", hex: "#8fd8ff", role: "base" },
      { name: "warm gold", hex: "#ffd36a", role: "accent" }
    ],
    paletteChangeSummary: "Added warm gold accent."
  });

  assert.deepEqual(validateVisualDesignAssetPack(edited), []);
  assert.equal(edited.imageRevisions[1].paletteLocked, false);
  assert.equal(edited.imageRevisions[1].paletteChangeSummary, "Added warm gold accent.");
  assert.equal(edited.palette.colors.length, 2);
});
