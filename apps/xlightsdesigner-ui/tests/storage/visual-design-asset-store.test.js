import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { buildVisualDesignAssetPack } from "../../agent/designer-dialog/visual-design-assets.js";
import {
  readVisualDesignAssetPack,
  writeVisualDesignAssetPack
} from "../../storage/visual-design-asset-store.mjs";

function makeProjectFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-visual-assets-"));
  const projectDir = path.join(root, "projects", "Demo");
  fs.mkdirSync(projectDir, { recursive: true });
  const projectFilePath = path.join(projectDir, "Demo.xdproj");
  fs.writeFileSync(projectFilePath, JSON.stringify({ projectName: "Demo" }), "utf8");
  return { root, projectDir, projectFilePath };
}

test("visual design asset store writes manifest and files under project app folder", () => {
  const { projectDir, projectFilePath } = makeProjectFixture();
  const pack = buildVisualDesignAssetPack({
    sequenceId: "seq-1",
    themeSummary: "icy blue with gold accents",
    inspirationPrompt: "Create an icy blue and gold holiday collage.",
    palette: [{ name: "ice blue", hex: "#8fd8ff", role: "base" }],
    displayAsset: { relativePath: "inspiration-board.png" },
    sequenceAssets: [
      {
        assetId: "asset-001",
        kind: "image",
        relativePath: "images/texture.webp",
        mimeType: "image/webp"
      }
    ]
  });

  const out = writeVisualDesignAssetPack({
    projectFilePath,
    assetPack: pack,
    files: [
      { relativePath: "inspiration-board.png", content: "fixture-image" },
      { relativePath: "images/texture.webp", content: Buffer.from("fixture-texture") }
    ]
  });

  assert.equal(out.ok, true);
  assert.equal(out.assetDir, path.join(projectDir, "artifacts", "visual-design", "seq-1"));
  assert.equal(fs.existsSync(path.join(out.assetDir, "visual-design-manifest.json")), true);
  assert.equal(fs.existsSync(path.join(out.assetDir, "inspiration-board.png")), true);
  assert.equal(fs.existsSync(path.join(out.assetDir, "images", "texture.webp")), true);

  const read = readVisualDesignAssetPack({ projectFilePath, sequenceId: "seq-1" });
  assert.equal(read.ok, true);
  assert.equal(read.assetPack.artifactId, pack.artifactId);
});

test("visual design asset store rejects paths outside asset folder", () => {
  const { projectFilePath } = makeProjectFixture();
  const pack = buildVisualDesignAssetPack({
    sequenceId: "seq-1",
    themeSummary: "safe fixture",
    inspirationPrompt: "Create a safe fixture.",
    palette: [{ name: "white", hex: "#ffffff", role: "base" }],
    displayAsset: { relativePath: "inspiration-board.png" }
  });

  const out = writeVisualDesignAssetPack({
    projectFilePath,
    assetPack: pack,
    files: [{ relativePath: "../escape.png", content: "bad" }]
  });

  assert.equal(out.ok, false);
  assert.equal(out.code, "INVALID_RELATIVE_PATH");
});
