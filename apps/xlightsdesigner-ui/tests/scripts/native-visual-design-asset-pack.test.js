import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import {
  buildOpenAIVisualImageConfig,
  buildVisualImageFileFromOpenAIResult,
  buildVisualInspirationImagePrompt
} from "../../../../apps/xlightsdesigner-ui/agent/designer-dialog/openai-visual-image-provider.js";
import {
  buildVisualDesignAssetPack,
  validateVisualDesignAssetPack
} from "../../../../apps/xlightsdesigner-ui/agent/designer-dialog/visual-design-assets.js";
import {
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
    visualImageConfig: { enabled: true, model: "gpt-image-2", size: "1536x1024", quality: "medium", outputFormat: "png" }
  }, {
    buildOpenAIVisualImageConfig,
    buildVisualInspirationImagePrompt,
    buildVisualImageFileFromOpenAIResult,
    buildVisualDesignAssetPack,
    validateVisualDesignAssetPack,
    writeVisualDesignAssetPack,
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
  assert.equal(result.assetPack.imageRevisions[0].source.model, "gpt-image-2");
  assert.match(providerInput.prompt, /Palette: ice blue #8fd8ff/);
  assert.match(providerInput.prompt, /Do not depict the literal xLights display/);
  assert.equal(fs.existsSync(path.join(projectDir, "artifacts", "visual-design", "seq-visual", "visual-design-manifest.json")), true);
  assert.equal(fs.readFileSync(path.join(projectDir, "artifacts", "visual-design", "seq-visual", "inspiration-board.png"), "utf8"), "generated-image");
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
      buildVisualDesignAssetPack,
      validateVisualDesignAssetPack,
      writeVisualDesignAssetPack,
      generateOpenAIVisualImage: async () => ({ ok: true })
    }),
    /Project file not found/
  );
});
