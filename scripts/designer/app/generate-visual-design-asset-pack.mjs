#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildOpenAIVisualImageConfig,
  buildVisualImageFileFromOpenAIResult,
  buildVisualInspirationImagePrompt,
  editOpenAIVisualImage,
  generateOpenAIVisualImage
} from "../../../apps/xlightsdesigner-ui/agent/designer-dialog/openai-visual-image-provider.js";
import {
  derivePaletteFromImageFile
} from "../../../apps/xlightsdesigner-ui/agent/designer-dialog/image-derived-palette.js";
import {
  buildPaletteCoordinationValidation,
  buildDefaultVisualMediaAssetPlans,
  buildVisualDesignAssetPack,
  buildVisualDesignImageEditRevision,
  validateVisualDesignAssetPack
} from "../../../apps/xlightsdesigner-ui/agent/designer-dialog/visual-design-assets.js";
import {
  readVisualDesignAssetPack,
  writeVisualDesignAssetPack
} from "../../../apps/xlightsdesigner-ui/storage/visual-design-asset-store.mjs";

const DEFAULT_DEPS = {
  buildOpenAIVisualImageConfig,
  buildVisualInspirationImagePrompt,
  buildPaletteCoordinationValidation,
  derivePaletteFromImageFile,
  generateOpenAIVisualImage,
  editOpenAIVisualImage,
  buildVisualImageFileFromOpenAIResult,
  buildDefaultVisualMediaAssetPlans,
  buildVisualDesignAssetPack,
  buildVisualDesignImageEditRevision,
  validateVisualDesignAssetPack,
  readVisualDesignAssetPack,
  writeVisualDesignAssetPack
};

function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readJson(filePath = "") {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function parseArgs(argv = []) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = str(argv[i]);
    if (token === "--payload") out.payloadPath = path.resolve(str(argv[++i] || ""));
    else if (token === "--payload-json") out.payloadJson = str(argv[++i] || "");
    else if (token === "--project-file") out.projectFilePath = path.resolve(str(argv[++i] || ""));
    else if (token === "--sequence-id") out.sequenceId = str(argv[++i] || "");
    else if (token === "--intent") out.intentText = str(argv[++i] || "");
    else if (token === "--theme") out.themeSummary = str(argv[++i] || "");
    else if (token === "--revision-request") out.revisionRequest = str(argv[++i] || "");
    else if (token === "--model") out.model = str(argv[++i] || "");
    else if (token === "--size") out.size = str(argv[++i] || "");
    else if (token === "--quality") out.quality = str(argv[++i] || "");
    else if (token === "--format") out.outputFormat = str(argv[++i] || "");
    else if (token === "--base-url") out.baseUrl = str(argv[++i] || "");
    else throw new Error(`Unknown argument: ${token}`);
  }
  return out;
}

function mergePayloadArgs(args = {}) {
  const filePayload = args.payloadPath ? readJson(args.payloadPath) : {};
  const inlinePayload = args.payloadJson ? JSON.parse(args.payloadJson) : {};
  return {
    ...filePayload,
    ...inlinePayload,
    projectFilePath: str(args.projectFilePath || inlinePayload.projectFilePath || filePayload.projectFilePath),
    sequenceId: str(args.sequenceId || inlinePayload.sequenceId || filePayload.sequenceId),
    intentText: str(args.intentText || inlinePayload.intentText || filePayload.intentText),
    themeSummary: str(args.themeSummary || inlinePayload.themeSummary || filePayload.themeSummary),
    revisionRequest: str(args.revisionRequest || inlinePayload.revisionRequest || filePayload.revisionRequest),
    visualImageConfig: {
      ...(isPlainObject(filePayload.visualImageConfig) ? filePayload.visualImageConfig : {}),
      ...(isPlainObject(inlinePayload.visualImageConfig) ? inlinePayload.visualImageConfig : {}),
      model: str(args.model || inlinePayload.visualImageConfig?.model || filePayload.visualImageConfig?.model),
      size: str(args.size || inlinePayload.visualImageConfig?.size || filePayload.visualImageConfig?.size),
      quality: str(args.quality || inlinePayload.visualImageConfig?.quality || filePayload.visualImageConfig?.quality),
      outputFormat: str(args.outputFormat || inlinePayload.visualImageConfig?.outputFormat || filePayload.visualImageConfig?.outputFormat),
      baseUrl: str(args.baseUrl || inlinePayload.visualImageConfig?.baseUrl || filePayload.visualImageConfig?.baseUrl)
    }
  };
}

function firstNonEmptyArray(...values) {
  for (const value of values) {
    const rows = arr(value).filter(Boolean);
    if (rows.length) return rows;
  }
  return [];
}

const DEFAULT_VISUAL_PALETTE = [
  { name: "ice blue", hex: "#8fd8ff", role: "cool base" },
  { name: "warm gold", hex: "#ffd36a", role: "impact accent" },
  { name: "cranberry red", hex: "#c8324a", role: "holiday accent" },
  { name: "pine green", hex: "#1f7a4a", role: "support" }
];

function normalizePaletteRows(rows = []) {
  const seen = new Set();
  return arr(rows)
    .map((row) => ({
      name: str(row?.name),
      hex: str(row?.hex),
      role: str(row?.role)
    }))
    .filter((row) => row.name || row.hex || row.role)
    .filter((row) => {
      const key = `${row.name}|${row.hex}|${row.role}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
}

function inferPalette(payload = {}) {
  const palette = firstNonEmptyArray(
    payload.palette,
    payload.creativeBrief?.visualInspiration?.palette,
    payload.creativeBrief?.palette,
    payload.proposalBundle?.palette,
    DEFAULT_VISUAL_PALETTE
  );
  return normalizePaletteRows(palette);
}

function deriveImagePalette({ deps = DEFAULT_DEPS, imageFile = null } = {}) {
  if (typeof deps.derivePaletteFromImageFile === "function") {
    const imagePalette = normalizePaletteRows(deps.derivePaletteFromImageFile({
      content: imageFile?.file?.content,
      mimeType: imageFile?.displayAsset?.mimeType || imageFile?.file?.mimeType || "image/png",
      maxColors: 8
    }));
    if (imagePalette.length) return imagePalette;
  }
  return [];
}

function inferMotifs(payload = {}) {
  return firstNonEmptyArray(
    payload.motifs,
    payload.creativeBrief?.visualInspiration?.motifs,
    payload.proposalBundle?.motifs,
    ["musical motion", "themed texture", "section contrast"]
  ).map((row) => str(row)).filter(Boolean);
}

function inferAvoidances(payload = {}) {
  return firstNonEmptyArray(
    payload.avoidances,
    payload.creativeBrief?.avoidances,
    ["literal xLights layout", "physical house preview", "sequencer UI"]
  ).map((row) => str(row)).filter(Boolean);
}

function inferSections(payload = {}) {
  return firstNonEmptyArray(
    payload.sections,
    payload.selectedSections,
    payload.creativeBrief?.sections,
    payload.proposalBundle?.scope?.sections,
    payload.sequencingDesignHandoff?.scope?.sections
  ).map((row) => str(row)).filter(Boolean);
}

function inferThemeSummary(payload = {}) {
  return str(
    payload.themeSummary ||
    payload.creativeBrief?.visualInspiration?.themeSummary ||
    payload.creativeBrief?.summary ||
    payload.proposalBundle?.summary ||
    payload.intentText ||
    "custom visual inspiration for the active xLights sequence"
  );
}

function inferTrackIdentity(payload = {}) {
  const analysisIdentity = payload.analysisHandoff?.trackIdentity;
  const directIdentity = payload.trackIdentity;
  const source = isPlainObject(directIdentity) ? directIdentity : (isPlainObject(analysisIdentity) ? analysisIdentity : {});
  return {
    title: str(source.title || payload.title || "Active sequence"),
    artist: str(source.artist || payload.artist || ""),
    contentFingerprint: str(source.contentFingerprint || source.fingerprint || "")
  };
}

function requireGenerationEnabled(config = {}) {
  if (config.enabled !== true) {
    throw new Error("Live visual image generation is disabled. Set XLD_ENABLE_LIVE_VISUAL_IMAGE_GENERATION=1 or pass an enabled provider config.");
  }
  if (!str(process.env.OPENAI_API_KEY)) {
    throw new Error("OPENAI_API_KEY is required for visual image generation.");
  }
}

function currentRevision(assetPack = {}) {
  const currentId = str(assetPack?.displayAsset?.currentRevisionId);
  const revisions = arr(assetPack?.imageRevisions);
  return revisions.find((row) => str(row?.revisionId) === currentId) || revisions.at(-1) || null;
}

function readCurrentRevisionImage({ readResult = null } = {}) {
  const assetPack = readResult?.assetPack;
  const revision = currentRevision(assetPack);
  const relativePath = str(revision?.relativePath || assetPack?.displayAsset?.relativePath);
  if (!relativePath) throw new Error("Existing visual asset pack has no current image revision path.");
  const imagePath = path.join(readResult.assetDir, path.normalize(relativePath));
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Current visual inspiration image not found: ${imagePath}`);
  }
  return {
    revision,
    relativePath,
    imagePath,
    image: fs.readFileSync(imagePath)
  };
}

export async function runVisualDesignAssetPackRevision(options = {}, deps = DEFAULT_DEPS) {
  const projectFilePath = path.resolve(str(options.projectFilePath));
  if (!projectFilePath || !fs.existsSync(projectFilePath)) {
    throw new Error(`Project file not found: ${projectFilePath || "(missing)"}`);
  }
  const sequenceId = str(options.sequenceId || options.sequencePath || options.mediaPath || "active-sequence");
  const revisionRequest = str(options.revisionRequest || options.userRequest || options.intentText);
  if (!revisionRequest) throw new Error("revisionRequest is required for visual inspiration revision.");
  const visualImageConfig = deps.buildOpenAIVisualImageConfig({
    ...(isPlainObject(options.visualImageConfig) ? options.visualImageConfig : {}),
    enabled: options.visualImageConfig?.enabled
  });
  if (deps === DEFAULT_DEPS) requireGenerationEnabled(visualImageConfig);

  const readResult = deps.readVisualDesignAssetPack({ projectFilePath, sequenceId });
  if (!readResult?.ok) {
    throw new Error(readResult?.error || `No existing visual design asset pack found for sequence: ${sequenceId}`);
  }
  const assetPack = readResult.assetPack;
  const current = readCurrentRevisionImage({ readResult });
  const designerPalette = inferPalette({ ...options, palette: options.palette || assetPack?.palette?.colors || assetPack?.creativeIntent?.palette });
  const motifs = inferMotifs({ ...options, motifs: options.motifs || assetPack?.creativeIntent?.motifs });
  const avoidances = inferAvoidances({ ...options, avoidances: options.avoidances || assetPack?.creativeIntent?.avoidances });
  const themeSummary = inferThemeSummary({ ...options, themeSummary: options.themeSummary || assetPack?.creativeIntent?.themeSummary });
  const prompt = deps.buildVisualInspirationImagePrompt({
    themeSummary,
    basePrompt: str(options.prompt || assetPack?.creativeIntent?.inspirationPrompt || themeSummary),
    palette: designerPalette,
    motifs,
    avoidances,
    includePaletteInImage: Boolean(options.includePaletteInImage),
    revisionRequest
  });
  const edited = await deps.editOpenAIVisualImage({
    apiKey: str(options.apiKey || process.env.OPENAI_API_KEY),
    baseUrl: visualImageConfig.baseUrl,
    model: visualImageConfig.model,
    size: visualImageConfig.size,
    quality: visualImageConfig.quality,
    outputFormat: visualImageConfig.outputFormat,
    prompt,
    image: current.image,
    imageFilename: path.basename(current.relativePath) || "input.png",
    imageMimeType: str(assetPack?.displayAsset?.mimeType || "image/png"),
    fetchImpl: options.fetchImpl
  });
  if (!edited?.ok) {
    throw new Error(`Visual image edit failed: ${str(edited?.error || edited?.code || "unknown error")}`);
  }

  const nextIndex = arr(assetPack.imageRevisions).length + 1;
  const nextRevisionId = `board-r${String(nextIndex).padStart(3, "0")}`;
  const relativePath = str(options.relativePath || `revisions/${nextRevisionId}.png`);
  const imageFile = deps.buildVisualImageFileFromOpenAIResult({ result: edited, relativePath });
  if (!imageFile?.ok) throw new Error(imageFile?.error || "Edited image could not be converted to a project file.");
  const imagePalette = deriveImagePalette({ deps, imageFile });
  const paletteValidation = typeof deps.buildPaletteCoordinationValidation === "function"
    ? deps.buildPaletteCoordinationValidation({ designerPalette, imagePalette })
    : {};
  const nextPack = deps.buildVisualDesignImageEditRevision({
    assetPack,
    userRequest: revisionRequest,
    prompt,
    relativePath,
    model: edited.model || visualImageConfig.model,
    displayAsset: imageFile.displayAsset,
    palette: designerPalette,
    paletteDisplay: {
      imageColors: imagePalette,
      lightingColors: designerPalette,
      validation: paletteValidation
    },
    paletteChangeSummary: str(options.paletteChangeSummary || "Designer palette preserved; image palette sampled for validation only."),
    changeSummary: str(options.changeSummary || "Revised inspiration board from Designer conversation.")
  });
  const errors = deps.validateVisualDesignAssetPack(nextPack);
  if (errors.length) throw new Error(`Revised visual asset pack is invalid: ${errors.join("; ")}`);
  const writeResult = deps.writeVisualDesignAssetPack({
    projectFilePath,
    assetPack: nextPack,
    files: [imageFile.file]
  });
  if (!writeResult?.ok) {
    throw new Error(writeResult?.error || arr(writeResult?.errors).join("; ") || writeResult?.code || "Visual asset pack revision write failed.");
  }
  return {
    ok: true,
    mode: "edit",
    projectFilePath,
    assetPack: nextPack,
    artifactId: nextPack.artifactId,
    assetDir: writeResult.assetDir,
    manifestPath: writeResult.manifestPath,
    writtenFiles: writeResult.writtenFiles,
    currentRevisionId: nextPack.displayAsset.currentRevisionId,
    parentRevisionId: str(current.revision?.revisionId),
    model: edited.model || visualImageConfig.model,
    size: visualImageConfig.size,
    quality: visualImageConfig.quality,
    outputFormat: visualImageConfig.outputFormat
  };
}

export async function runVisualDesignAssetPackGeneration(options = {}, deps = DEFAULT_DEPS) {
  if (str(options.revisionRequest)) {
    return runVisualDesignAssetPackRevision(options, deps);
  }
  const projectFilePath = path.resolve(str(options.projectFilePath));
  if (!projectFilePath || !fs.existsSync(projectFilePath)) {
    throw new Error(`Project file not found: ${projectFilePath || "(missing)"}`);
  }
  const sequenceId = str(options.sequenceId || options.sequencePath || options.mediaPath || "active-sequence");
  const designerPalette = inferPalette(options);
  const motifs = inferMotifs(options);
  const avoidances = inferAvoidances(options);
  const sections = inferSections(options);
  const themeSummary = inferThemeSummary(options);
  const visualImageConfig = deps.buildOpenAIVisualImageConfig({
    ...(isPlainObject(options.visualImageConfig) ? options.visualImageConfig : {}),
    enabled: options.visualImageConfig?.enabled
  });
  if (deps === DEFAULT_DEPS) requireGenerationEnabled(visualImageConfig);

  const prompt = deps.buildVisualInspirationImagePrompt({
    themeSummary,
    basePrompt: str(options.prompt || options.intentText || themeSummary),
    palette: designerPalette,
    motifs,
    avoidances,
    includePaletteInImage: Boolean(options.includePaletteInImage)
  });
  const generated = await deps.generateOpenAIVisualImage({
    apiKey: str(options.apiKey || process.env.OPENAI_API_KEY),
    baseUrl: visualImageConfig.baseUrl,
    model: visualImageConfig.model,
    size: visualImageConfig.size,
    quality: visualImageConfig.quality,
    outputFormat: visualImageConfig.outputFormat,
    prompt,
    fetchImpl: options.fetchImpl
  });
  if (!generated?.ok) {
    throw new Error(`Visual image generation failed: ${str(generated?.error || generated?.code || "unknown error")}`);
  }
  const imageFile = deps.buildVisualImageFileFromOpenAIResult({
    result: generated,
    relativePath: "inspiration-board.png"
  });
  if (!imageFile?.ok) throw new Error(imageFile?.error || "Generated image could not be converted to a project file.");
  const imagePalette = deriveImagePalette({ deps, imageFile });
  const paletteValidation = typeof deps.buildPaletteCoordinationValidation === "function"
    ? deps.buildPaletteCoordinationValidation({ designerPalette, imagePalette })
    : {};

  const assetPack = deps.buildVisualDesignAssetPack({
    sequenceId,
    trackIdentity: inferTrackIdentity(options),
    themeSummary,
    inspirationPrompt: prompt,
    palette: designerPalette,
    paletteDisplay: {
      imageColors: imagePalette,
      lightingColors: designerPalette,
      validation: paletteValidation
    },
    motifs,
    avoidances,
    mediaAssetPlans: deps.buildDefaultVisualMediaAssetPlans({
      themeSummary,
      palette: designerPalette,
      motifs,
      sections
    }),
    displayAsset: {
      ...imageFile.displayAsset,
      currentRevisionId: "board-r001"
    },
    imageRevisions: [
      {
        revisionId: "board-r001",
        parentRevisionId: "",
        mode: "generate",
        relativePath: imageFile.file.relativePath,
        promptRef: "prompt-001",
        source: { provider: "openai", model: generated.model || visualImageConfig.model, promptRef: "prompt-001" },
        userRequest: str(options.intentText),
        changeSummary: "Initial inspiration board generated from Designer intent.",
        paletteLocked: true
      }
    ],
    prompts: [
      {
        promptId: "prompt-001",
        model: generated.model || visualImageConfig.model,
        purpose: "inspiration_board",
        operation: "generate",
        prompt
      }
    ]
  });
  const errors = deps.validateVisualDesignAssetPack(assetPack);
  if (errors.length) throw new Error(`Generated visual asset pack is invalid: ${errors.join("; ")}`);

  const writeResult = deps.writeVisualDesignAssetPack({
    projectFilePath,
    assetPack,
    files: [imageFile.file]
  });
  if (!writeResult?.ok) {
    throw new Error(writeResult?.error || arr(writeResult?.errors).join("; ") || writeResult?.code || "Visual asset pack write failed.");
  }
  return {
    ok: true,
    projectFilePath,
    assetPack,
    artifactId: assetPack.artifactId,
    assetDir: writeResult.assetDir,
    manifestPath: writeResult.manifestPath,
    writtenFiles: writeResult.writtenFiles,
    model: generated.model || visualImageConfig.model,
    size: visualImageConfig.size,
    quality: visualImageConfig.quality,
    outputFormat: visualImageConfig.outputFormat
  };
}

export async function main(argv = process.argv.slice(2), deps = DEFAULT_DEPS) {
  return runVisualDesignAssetPackGeneration(mergePayloadArgs(parseArgs(argv)), deps);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    const result = await main();
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${String(error?.stack || error?.message || error)}\n`);
    process.exit(1);
  }
}
