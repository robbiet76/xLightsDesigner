import { finalizeArtifact } from "../shared/artifact-ids.js";

export const VISUAL_DESIGN_ASSET_PACK_CONTRACT = "visual_design_asset_pack_v1";
export const VISUAL_DESIGN_ASSET_PACK_VERSION = 1;

const ASSET_KINDS = new Set(["image", "video", "thumbnail", "spritesheet"]);
const DISPLAY_ASSET_KINDS = new Set(["inspiration_board"]);
const PROVIDERS = new Set(["openai", "local_fixture", "user_supplied", "unknown"]);

function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function uniqueStrings(values = []) {
  return [...new Set(arr(values).map((row) => str(row)).filter(Boolean))];
}

function normalizePalette(rows = []) {
  return arr(rows)
    .map((row) => ({
      name: str(row?.name),
      hex: str(row?.hex),
      role: str(row?.role)
    }))
    .filter((row) => row.name || row.hex || row.role);
}

function normalizeTrackIdentity(trackIdentity = {}) {
  const obj = isPlainObject(trackIdentity) ? trackIdentity : {};
  return {
    title: str(obj.title),
    artist: str(obj.artist),
    contentFingerprint: str(obj.contentFingerprint)
  };
}

function normalizeDisplayAsset(displayAsset = {}) {
  const obj = isPlainObject(displayAsset) ? displayAsset : {};
  return {
    kind: str(obj.kind || "inspiration_board"),
    relativePath: str(obj.relativePath || "inspiration-board.png"),
    mimeType: str(obj.mimeType || "image/png"),
    width: Number.isFinite(Number(obj.width)) ? Number(obj.width) : null,
    height: Number.isFinite(Number(obj.height)) ? Number(obj.height) : null
  };
}

function normalizeSource(source = {}) {
  const obj = isPlainObject(source) ? source : {};
  const provider = str(obj.provider || "unknown").toLowerCase();
  return {
    provider: PROVIDERS.has(provider) ? provider : "unknown",
    model: str(obj.model),
    promptRef: str(obj.promptRef)
  };
}

function normalizeSequenceAssets(rows = []) {
  return arr(rows)
    .map((row, idx) => {
      const kind = str(row?.kind).toLowerCase();
      return {
        assetId: str(row?.assetId || `asset-${String(idx + 1).padStart(3, "0")}`),
        kind: ASSET_KINDS.has(kind) ? kind : "image",
        relativePath: str(row?.relativePath),
        mimeType: str(row?.mimeType),
        intendedUse: str(row?.intendedUse || "picture_effect_texture"),
        recommendedSections: uniqueStrings(row?.recommendedSections),
        paletteRoles: uniqueStrings(row?.paletteRoles),
        motionUse: str(row?.motionUse),
        source: normalizeSource(row?.source)
      };
    })
    .filter((row) => row.assetId && row.relativePath);
}

function normalizePrompts(rows = []) {
  return arr(rows)
    .map((row, idx) => ({
      promptId: str(row?.promptId || `prompt-${String(idx + 1).padStart(3, "0")}`),
      model: str(row?.model || "gpt-image-2"),
      purpose: str(row?.purpose || "inspiration_board"),
      prompt: str(row?.prompt)
    }))
    .filter((row) => row.promptId && row.prompt);
}

export function buildVisualDesignAssetPack({
  sequenceId = "",
  trackIdentity = {},
  themeSummary = "",
  inspirationPrompt = "",
  palette = [],
  motifs = [],
  avoidances = [],
  displayAsset = {},
  sequenceAssets = [],
  prompts = [],
  handoff = {}
} = {}) {
  const normalizedDisplayAsset = normalizeDisplayAsset(displayAsset);
  const normalizedPrompts = normalizePrompts(prompts.length ? prompts : [{
    promptId: "prompt-001",
    model: "gpt-image-2",
    purpose: "inspiration_board",
    prompt: inspirationPrompt
  }]);

  return finalizeArtifact({
    artifactType: VISUAL_DESIGN_ASSET_PACK_CONTRACT,
    artifactVersion: VISUAL_DESIGN_ASSET_PACK_VERSION,
    sequenceId: str(sequenceId),
    trackIdentity: normalizeTrackIdentity(trackIdentity),
    creativeIntent: {
      themeSummary: str(themeSummary),
      inspirationPrompt: str(inspirationPrompt),
      palette: normalizePalette(palette),
      motifs: uniqueStrings(motifs),
      avoidances: uniqueStrings(avoidances)
    },
    displayAsset: normalizedDisplayAsset,
    sequenceAssets: normalizeSequenceAssets(sequenceAssets),
    prompts: normalizedPrompts,
    handoff: {
      sequencerUse: str(handoff?.sequencerUse || "optional"),
      requiresMediaEffects: handoff?.requiresMediaEffects !== false,
      artifactRefs: uniqueStrings(handoff?.artifactRefs)
    }
  });
}

export function validateVisualDesignAssetPack(payload = {}) {
  const errors = [];
  const obj = isPlainObject(payload) ? payload : {};

  if (str(obj.artifactType) !== VISUAL_DESIGN_ASSET_PACK_CONTRACT) {
    errors.push(`artifactType must be ${VISUAL_DESIGN_ASSET_PACK_CONTRACT}`);
  }
  if (Number(obj.artifactVersion) !== VISUAL_DESIGN_ASSET_PACK_VERSION) {
    errors.push(`artifactVersion must be ${VISUAL_DESIGN_ASSET_PACK_VERSION}`);
  }
  if (!str(obj.artifactId)) errors.push("artifactId is required");
  if (!str(obj.createdAt)) errors.push("createdAt is required");
  if (!isPlainObject(obj.trackIdentity)) errors.push("trackIdentity is required");
  if (!isPlainObject(obj.creativeIntent)) errors.push("creativeIntent is required");
  if (!str(obj.creativeIntent?.themeSummary)) errors.push("creativeIntent.themeSummary is required");
  if (!str(obj.creativeIntent?.inspirationPrompt)) errors.push("creativeIntent.inspirationPrompt is required");
  if (!Array.isArray(obj.creativeIntent?.palette) || !obj.creativeIntent.palette.length) {
    errors.push("creativeIntent.palette is required");
  }
  if (!isPlainObject(obj.displayAsset)) errors.push("displayAsset is required");
  if (!DISPLAY_ASSET_KINDS.has(str(obj.displayAsset?.kind))) {
    errors.push("displayAsset.kind must be inspiration_board");
  }
  if (!str(obj.displayAsset?.relativePath)) errors.push("displayAsset.relativePath is required");
  if (!Array.isArray(obj.sequenceAssets)) errors.push("sequenceAssets must be an array");
  if (!Array.isArray(obj.prompts) || !obj.prompts.length) errors.push("prompts is required");

  for (const [idx, asset] of arr(obj.sequenceAssets).entries()) {
    if (!str(asset?.assetId)) errors.push(`sequenceAssets[${idx}].assetId is required`);
    if (!ASSET_KINDS.has(str(asset?.kind))) errors.push(`sequenceAssets[${idx}].kind is invalid`);
    if (!str(asset?.relativePath)) errors.push(`sequenceAssets[${idx}].relativePath is required`);
  }

  return errors;
}

export function buildVisualInspirationRefs(assetPack = {}) {
  const obj = isPlainObject(assetPack) ? assetPack : {};
  const displayAsset = isPlainObject(obj.displayAsset) ? obj.displayAsset : {};
  const creativeIntent = isPlainObject(obj.creativeIntent) ? obj.creativeIntent : {};
  return {
    artifactId: str(obj.artifactId),
    displayAssetRef: str(displayAsset.relativePath),
    palette: normalizePalette(creativeIntent.palette),
    themeSummary: str(creativeIntent.themeSummary),
    motifs: uniqueStrings(creativeIntent.motifs)
  };
}
