import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDefaultVisualMediaAssetPlans,
  buildPaletteCoordinationValidation,
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
          model: "gpt-image-1.5",
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
  assert.equal(pack.imageRevisions[0].source.model, "gpt-image-1.5");
  assert.equal(pack.mediaAssetPlans.length, 3);
  assert.equal(pack.mediaAssetPlans[0].status, "planned");
  assert.equal(pack.mediaAssetPlans[2].kind, "video");
  assert.equal(pack.mediaAssetPlans[2].status, "deferred");
  assert.deepEqual(validateVisualDesignAssetPack(pack), []);
});

test("visual design asset pack palette is capped at xLights eight-color limit", () => {
  const palette = Array.from({ length: 10 }, (_, index) => ({
    name: `color ${index + 1}`,
    hex: `#${String(index + 1).padStart(6, "0")}`,
    role: `slot ${index + 1}`
  }));

  const pack = buildVisualDesignAssetPack({
    sequenceId: "seq-eight-colors",
    themeSummary: "full xLights palette",
    inspirationPrompt: "Create an inspiration board with a broad palette.",
    palette,
    displayAsset: { relativePath: "inspiration-board.png" }
  });

  assert.equal(pack.palette.colors.length, 8);
  assert.equal(pack.creativeIntent.palette.length, 8);
  assert.deepEqual(validateVisualDesignAssetPack(pack), []);
});

test("visual design asset pack keeps designer palette canonical and image colors diagnostic", () => {
  const imageColors = [
    { name: "deep black", hex: "#0f0c0c", role: "shadow" },
    { name: "warm amber", hex: "#b4510a", role: "accent" },
    { name: "winter blue", hex: "#256eb1", role: "accent" }
  ];
  const lightingColors = [
    { name: "electric cyan", hex: "#00d7ff", role: "designer accent" },
    { name: "hot magenta", hex: "#ff2bd6", role: "designer accent" }
  ];

  const pack = buildVisualDesignAssetPack({
    sequenceId: "seq-lighting-palette",
    themeSummary: "generated image with practical RGB palette",
    inspirationPrompt: "Create a custom inspiration board.",
    palette: lightingColors,
    paletteDisplay: { imageColors, lightingColors },
    displayAsset: { relativePath: "inspiration-board.png" }
  });

  assert.deepEqual(pack.palette.colors, lightingColors);
  assert.deepEqual(pack.palette.imageColors, imageColors);
  assert.deepEqual(pack.palette.lightingColors, lightingColors);
  assert.deepEqual(pack.creativeIntent.palette, lightingColors);
  assert.deepEqual(pack.creativeIntent.imagePalette, imageColors);
  assert.deepEqual(pack.creativeIntent.lightingPalette, lightingColors);
  assert.deepEqual(validateVisualDesignAssetPack(pack), []);
});

test("palette coordination validation warns without changing Designer palette", () => {
  const designerPalette = [
    { name: "electric cyan", hex: "#00d7ff", role: "cool accent" },
    { name: "hot magenta", hex: "#ff2bd6", role: "impact accent" },
    { name: "lime green", hex: "#7cff2b", role: "energy accent" }
  ];
  const imagePalette = [
    { name: "midnight blue", hex: "#071433", role: "dominant" },
    { name: "deep blue", hex: "#142c66", role: "support" }
  ];

  const validation = buildPaletteCoordinationValidation({ designerPalette, imagePalette });
  const pack = buildVisualDesignAssetPack({
    sequenceId: "seq-palette-validation",
    themeSummary: "palette validation",
    inspirationPrompt: "Create a custom board.",
    palette: designerPalette,
    paletteDisplay: { imageColors: imagePalette, lightingColors: designerPalette, validation },
    displayAsset: { relativePath: "inspiration-board.png" }
  });

  assert.equal(pack.palette.validation.status, "warn");
  assert.equal(pack.palette.validation.requiredColorCount, 2);
  assert.equal(pack.palette.validation.matches.length, 3);
  assert.deepEqual(pack.palette.colors, designerPalette);
  assert.match(pack.palette.validation.recommendation, /Revise the image/i);
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
  assert.equal(refs.paletteCoordinationRule, "Designer palette is canonical for sequencing; image colors are diagnostic validation context.");
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
  assert.equal(edited.imageRevisions[1].source.model, "gpt-image-1.5");
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
