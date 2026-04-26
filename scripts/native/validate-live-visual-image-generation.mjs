#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  buildOpenAIVisualImageConfig,
  buildVisualImageFileFromOpenAIResult,
  buildVisualInspirationImagePrompt,
  editOpenAIVisualImage,
  generateOpenAIVisualImage
} from "../../apps/xlightsdesigner-ui/agent/designer-dialog/openai-visual-image-provider.js";
import {
  buildVisualDesignAssetPack,
  buildVisualDesignImageEditRevision
} from "../../apps/xlightsdesigner-ui/agent/designer-dialog/visual-design-assets.js";
import {
  writeVisualDesignAssetPack
} from "../../apps/xlightsdesigner-ui/storage/visual-design-asset-store.mjs";

function str(value = "") {
  return String(value || "").trim();
}

function parseArgs(argv = []) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = String(argv[i] || "");
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = String(argv[i + 1] || "");
    if (!next || next.startsWith("--")) {
      out[key] = "1";
      continue;
    }
    out[key] = next;
    i += 1;
  }
  return out;
}

function ensureProjectFile(projectFilePath = "") {
  const explicit = str(projectFilePath);
  if (explicit) {
    if (!fs.existsSync(explicit)) throw new Error(`Project file not found: ${explicit}`);
    return path.resolve(explicit);
  }
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-live-visual-image-"));
  const projectDir = path.join(root, "projects", "LiveVisualImageValidation");
  fs.mkdirSync(projectDir, { recursive: true });
  const file = path.join(projectDir, "LiveVisualImageValidation.xdproj");
  fs.writeFileSync(file, JSON.stringify({ projectName: "Live Visual Image Validation" }, null, 2), "utf8");
  return file;
}

function requireLiveEnabled() {
  if (process.env.XLD_ENABLE_LIVE_VISUAL_IMAGE_GENERATION !== "1") {
    throw new Error("Live visual image generation is disabled. Set XLD_ENABLE_LIVE_VISUAL_IMAGE_GENERATION=1 to run this cost-incurring validation.");
  }
  if (!str(process.env.OPENAI_API_KEY)) {
    throw new Error("OPENAI_API_KEY is required for live visual image generation validation.");
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  requireLiveEnabled();

  const projectFilePath = ensureProjectFile(args["project-file"]);
  const sequenceId = str(args["sequence-id"] || "live-visual-image-validation");
  const palette = [
    { name: "ice blue", hex: "#8fd8ff", role: "cool base" },
    { name: "warm gold", hex: "#ffd36a", role: "impact accent" }
  ];
  const themeSummary = str(args.theme || "icy choral holiday tension with a warm gold release");
  const basePrompt = str(args.prompt || "Create a custom original visual inspiration collage for an xLights sequence. It should feel cinematic, musical, icy, and celebratory.");
  const editPrompt = str(args["edit-prompt"] || "Edit the existing board to make the warm gold accent feel more hopeful while preserving the same palette and overall icy holiday theme.");
  const config = buildOpenAIVisualImageConfig({
    enabled: true,
    model: args.model,
    baseUrl: args["base-url"],
    size: args.size,
    quality: args.quality,
    outputFormat: args.format
  });

  const prompt = buildVisualInspirationImagePrompt({
    themeSummary,
    basePrompt,
    palette,
    motifs: ["bell shimmer", "snow sparkle", "soft stage light"],
    avoidances: ["literal xLights layout", "physical house preview", "sequencer UI"]
  });

  const generated = await generateOpenAIVisualImage({
    apiKey: process.env.OPENAI_API_KEY,
    baseUrl: config.baseUrl,
    model: config.model,
    size: config.size,
    quality: config.quality,
    outputFormat: config.outputFormat,
    prompt
  });
  if (!generated.ok) throw new Error(`Initial image generation failed: ${generated.error || generated.code}`);

  const generatedFile = buildVisualImageFileFromOpenAIResult({
    result: generated,
    relativePath: "inspiration-board.png"
  });
  if (!generatedFile.ok) throw new Error(generatedFile.error);

  const initialPack = buildVisualDesignAssetPack({
    sequenceId,
    trackIdentity: { title: "Live Visual Image Validation", artist: "xLightsDesigner" },
    themeSummary,
    inspirationPrompt: prompt,
    palette,
    motifs: ["bell shimmer", "snow sparkle", "soft stage light"],
    avoidances: ["literal xLights layout", "physical house preview", "sequencer UI"],
    displayAsset: {
      ...generatedFile.displayAsset,
      currentRevisionId: "board-r001"
    },
    imageRevisions: [
      {
        revisionId: "board-r001",
        parentRevisionId: "",
        mode: "generate",
        relativePath: "inspiration-board.png",
        promptRef: "prompt-001",
        source: { provider: "openai", model: generated.model, promptRef: "prompt-001" },
        changeSummary: "Initial live inspiration board.",
        paletteLocked: true
      }
    ],
    prompts: [{ promptId: "prompt-001", model: generated.model, purpose: "inspiration_board", operation: "generate", prompt }]
  });

  const edited = await editOpenAIVisualImage({
    apiKey: process.env.OPENAI_API_KEY,
    baseUrl: config.baseUrl,
    model: config.model,
    size: config.size,
    quality: config.quality,
    outputFormat: config.outputFormat,
    prompt: editPrompt,
    image: generated.image,
    imageFilename: "inspiration-board.png",
    imageMimeType: generated.mimeType
  });
  if (!edited.ok) throw new Error(`Image edit failed: ${edited.error || edited.code}`);

  const editedFile = buildVisualImageFileFromOpenAIResult({
    result: edited,
    relativePath: "revisions/board-r002.png"
  });
  if (!editedFile.ok) throw new Error(editedFile.error);

  const editedPack = buildVisualDesignImageEditRevision({
    assetPack: initialPack,
    userRequest: editPrompt,
    prompt: editPrompt,
    relativePath: "revisions/board-r002.png",
    changeSummary: "Live edit preserved palette and adjusted gold accent."
  });

  const out = writeVisualDesignAssetPack({
    projectFilePath,
    assetPack: {
      ...editedPack,
      displayAsset: {
        ...editedPack.displayAsset,
        mimeType: edited.mimeType,
        width: edited.width,
        height: edited.height
      }
    },
    files: [
      generatedFile.file,
      editedFile.file
    ]
  });
  if (!out.ok) throw new Error(out.error || (out.errors || []).join("; ") || out.code);

  const summary = {
    ok: true,
    projectFilePath,
    manifestPath: out.manifestPath,
    assetDir: out.assetDir,
    model: config.model,
    size: config.size,
    quality: config.quality,
    outputFormat: config.outputFormat,
    revisions: ["board-r001", "board-r002"]
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${String(error?.stack || error?.message || error)}\n`);
  process.exit(1);
});
