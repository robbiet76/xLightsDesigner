import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import {
  buildOpenAIVisualImageConfig,
  buildVisualImageFileFromOpenAIResult,
  buildVisualInspirationImagePrompt,
  editOpenAIVisualImage
} from "../../../../apps/xlightsdesigner-ui/agent/designer-dialog/openai-visual-image-provider.js";
import {
  buildDefaultVisualMediaAssetPlans,
  buildVisualDesignAssetPack,
  buildVisualDesignImageEditRevision,
  validateVisualDesignAssetPack
} from "../../../../apps/xlightsdesigner-ui/agent/designer-dialog/visual-design-assets.js";
import {
  readVisualDesignAssetPack,
  writeVisualDesignAssetPack
} from "../../../../apps/xlightsdesigner-ui/storage/visual-design-asset-store.mjs";
import {
  runVisualDesignAssetPackGeneration
} from "../../../../scripts/designer/native/generate-visual-design-asset-pack.mjs";

function makeProjectFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-native-visual-pack-"));
  const projectDir = path.join(root, "projects", "Demo");
  fs.mkdirSync(projectDir, { recursive: true });
  const projectFilePath = path.join(projectDir, "Demo.xdproj");
  fs.writeFileSync(projectFilePath, JSON.stringify({ projectName: "Demo" }), "utf8");
  return { root, projectDir, projectFilePath };
}

test("native visual design asset generation writes board image and manifest", async () => {
  const { projectDir, projectFilePath } = makeProjectFixture();
  let providerInput = null;
  const result = await runVisualDesignAssetPackGeneration({
    projectFilePath,
    sequenceId: "seq-visual",
    intentText: "Create a visual inspiration board for the chorus.",
    creativeBrief: {
      summary: "Icy choral tension with gold release."
    },
    palette: [
      { name: "ice blue", hex: "#8fd8ff", role: "base" },
      { name: "warm gold", hex: "#ffd36a", role: "accent" }
    ],
    motifs: ["bell shimmer"],
    visualImageConfig: { enabled: true, model: "gpt-image-1.5", size: "1536x1024", quality: "medium", outputFormat: "png" }
  }, {
    buildOpenAIVisualImageConfig,
    buildVisualInspirationImagePrompt,
    buildVisualImageFileFromOpenAIResult,
    buildDefaultVisualMediaAssetPlans,
    buildVisualDesignAssetPack,
    buildVisualDesignImageEditRevision,
    validateVisualDesignAssetPack,
    readVisualDesignAssetPack,
    writeVisualDesignAssetPack,
    editOpenAIVisualImage,
    generateOpenAIVisualImage: async (input) => {
      providerInput = input;
      return {
        ok: true,
        image: Buffer.from("generated-image"),
        mimeType: "image/png",
        width: 1536,
        height: 1024,
        model: input.model,
        outputFormat: "png"
      };
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.assetPack.sequenceId, "seq-visual");
  assert.equal(result.assetPack.displayAsset.relativePath, "inspiration-board.png");
  assert.equal(result.assetPack.displayAsset.width, 1536);
  assert.equal(result.assetPack.imageRevisions[0].source.model, "gpt-image-1.5");
  assert.equal(result.assetPack.mediaAssetPlans.length, 3);
  assert.equal(result.assetPack.mediaAssetPlans[0].status, "planned");
  assert.equal(result.assetPack.mediaAssetPlans[2].kind, "video");
  assert.match(providerInput.prompt, /Palette: ice blue #8fd8ff/);
  assert.match(providerInput.prompt, /Do not depict the literal xLights display/);
  assert.equal(fs.existsSync(path.join(projectDir, "artifacts", "visual-design", "seq-visual", "visual-design-manifest.json")), true);
  assert.equal(fs.readFileSync(path.join(projectDir, "artifacts", "visual-design", "seq-visual", "inspiration-board.png"), "utf8"), "generated-image");
});

test("native visual design asset revision edits current board and appends lineage", async () => {
  const { projectDir, projectFilePath } = makeProjectFixture();
  const first = buildVisualDesignAssetPack({
    sequenceId: "seq-visual",
    themeSummary: "warm candlelit chorus",
    inspirationPrompt: "Create a warm candlelit board.",
    palette: [{ name: "candle gold", hex: "#ffc45c", role: "warm highlight" }],
    motifs: ["window glow"],
    displayAsset: { relativePath: "inspiration-board.png", currentRevisionId: "board-r001" }
  });
  const writeFirst = writeVisualDesignAssetPack({
    projectFilePath,
    assetPack: first,
    files: [{ relativePath: "inspiration-board.png", content: Buffer.from("original-board") }]
  });
  assert.equal(writeFirst.ok, true);

  let editInput = null;
  const result = await runVisualDesignAssetPackGeneration({
    projectFilePath,
    sequenceId: "seq-visual",
    revisionRequest: "Make the candle glow softer while preserving the palette.",
    visualImageConfig: { enabled: true, model: "gpt-image-1.5", size: "1536x1024", quality: "medium", outputFormat: "png" }
  }, {
    buildOpenAIVisualImageConfig,
    buildVisualInspirationImagePrompt,
    buildVisualImageFileFromOpenAIResult,
    buildDefaultVisualMediaAssetPlans,
    buildVisualDesignAssetPack,
    buildVisualDesignImageEditRevision,
    validateVisualDesignAssetPack,
    readVisualDesignAssetPack,
    writeVisualDesignAssetPack,
    generateOpenAIVisualImage: async () => {
      throw new Error("generation should not run for revisions");
    },
    editOpenAIVisualImage: async (input) => {
      editInput = input;
      return {
        ok: true,
        mode: "edit",
        image: Buffer.from("edited-board"),
        mimeType: "image/png",
        width: 1536,
        height: 1024,
        model: input.model,
        outputFormat: "png"
      };
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.mode, "edit");
  assert.equal(result.currentRevisionId, "board-r002");
  assert.equal(result.parentRevisionId, "board-r001");
  assert.equal(editInput.image.toString("utf8"), "original-board");
  assert.match(editInput.prompt, /Requested revision: Make the candle glow softer/);
  assert.match(editInput.prompt, /Palette: candle gold #ffc45c/);

  const manifestPath = path.join(projectDir, "artifacts", "visual-design", "seq-visual", "visual-design-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  assert.equal(manifest.displayAsset.currentRevisionId, "board-r002");
  assert.equal(manifest.displayAsset.relativePath, "revisions/board-r002.png");
  assert.equal(manifest.imageRevisions[1].mode, "edit");
  assert.equal(manifest.imageRevisions[1].parentRevisionId, "board-r001");
  assert.equal(fs.readFileSync(path.join(projectDir, "artifacts", "visual-design", "seq-visual", "revisions", "board-r002.png"), "utf8"), "edited-board");
});

test("native visual design asset generation rejects missing project file", async () => {
  await assert.rejects(
    () => runVisualDesignAssetPackGeneration({
      projectFilePath: "/tmp/xld-missing-project-file.xdproj",
      intentText: "Create a visual inspiration board.",
      visualImageConfig: { enabled: true }
    }, {
      buildOpenAIVisualImageConfig,
      buildVisualInspirationImagePrompt,
      buildVisualImageFileFromOpenAIResult,
      buildDefaultVisualMediaAssetPlans,
      buildVisualDesignAssetPack,
      validateVisualDesignAssetPack,
      writeVisualDesignAssetPack,
      generateOpenAIVisualImage: async () => ({ ok: true })
    }),
    /Project file not found/
  );
});

test("native visual design asset generation uses richer default palette up to xLights limit", async () => {
  const { projectFilePath } = makeProjectFixture();
  let providerInput = null;
  const result = await runVisualDesignAssetPackGeneration({
    projectFilePath,
    sequenceId: "seq-default-palette",
    intentText: "Create a holiday road trip visual inspiration board.",
    visualImageConfig: { enabled: true, model: "gpt-image-1.5", size: "1536x1024", quality: "medium", outputFormat: "png" }
  }, {
    buildOpenAIVisualImageConfig,
    buildVisualInspirationImagePrompt,
    buildVisualImageFileFromOpenAIResult,
    buildDefaultVisualMediaAssetPlans,
    buildVisualDesignAssetPack,
    buildVisualDesignImageEditRevision,
    validateVisualDesignAssetPack,
    readVisualDesignAssetPack,
    writeVisualDesignAssetPack,
    editOpenAIVisualImage,
    generateOpenAIVisualImage: async (input) => {
      providerInput = input;
      return {
        ok: true,
        image: Buffer.from("generated-image"),
        mimeType: "image/png",
        width: 1536,
        height: 1024,
        model: input.model,
        outputFormat: "png"
      };
    }
  });

  assert.equal(result.assetPack.palette.colors.length, 4);
  assert.equal(result.assetPack.palette.colors.length <= 8, true);
  assert.deepEqual(result.assetPack.palette.colors.map((row) => row.hex), ["#8fd8ff", "#ffd36a", "#c8324a", "#1f7a4a"]);
  assert.match(providerInput.prompt, /cranberry red #c8324a/);
  assert.match(providerInput.prompt, /pine green #1f7a4a/);
});

test("native visual design asset generation stores palette derived from generated image", async () => {
  const { projectFilePath } = makeProjectFixture();
  const derivedPalette = [
    { name: "image color 1", hex: "#224466", role: "dominant" },
    { name: "image color 2", hex: "#ddaa33", role: "support" },
    { name: "image color 3", hex: "#8a2030", role: "support" }
  ];
  const result = await runVisualDesignAssetPackGeneration({
    projectFilePath,
    sequenceId: "seq-derived-palette",
    intentText: "Create a holiday road trip visual inspiration board.",
    palette: [
      { name: "fallback blue", hex: "#8fd8ff", role: "fallback" },
      { name: "fallback gold", hex: "#ffd36a", role: "fallback" }
    ],
    visualImageConfig: { enabled: true, model: "gpt-image-1.5", size: "1536x1024", quality: "medium", outputFormat: "png" }
  }, {
    buildOpenAIVisualImageConfig,
    buildVisualInspirationImagePrompt,
    buildVisualImageFileFromOpenAIResult,
    buildDefaultVisualMediaAssetPlans,
    buildVisualDesignAssetPack,
    buildVisualDesignImageEditRevision,
    validateVisualDesignAssetPack,
    readVisualDesignAssetPack,
    writeVisualDesignAssetPack,
    editOpenAIVisualImage,
    derivePaletteFromImageFile: () => derivedPalette,
    generateOpenAIVisualImage: async (input) => ({
      ok: true,
      image: Buffer.from("generated-image"),
      mimeType: "image/png",
      width: 1536,
      height: 1024,
      model: input.model,
      outputFormat: "png"
    })
  });

  assert.deepEqual(result.assetPack.palette.colors, derivedPalette);
  assert.deepEqual(result.assetPack.creativeIntent.palette, derivedPalette);
  assert.deepEqual(result.assetPack.mediaAssetPlans[0].paletteRoles, ["dominant", "support"]);
  assert.deepEqual(result.assetPack.mediaAssetPlans[2].paletteRoles, ["dominant", "support"]);
});
