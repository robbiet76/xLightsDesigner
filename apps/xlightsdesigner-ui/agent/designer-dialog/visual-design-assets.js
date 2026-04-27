import { finalizeArtifact } from "../shared/artifact-ids.js";

export const VISUAL_DESIGN_ASSET_PACK_CONTRACT = "visual_design_asset_pack_v1";
export const VISUAL_DESIGN_ASSET_PACK_VERSION = 1;

const ASSET_KINDS = new Set(["image", "video", "thumbnail", "spritesheet"]);
const DISPLAY_ASSET_KINDS = new Set(["inspiration_board"]);
const PROVIDERS = new Set(["openai", "local_fixture", "user_supplied", "unknown"]);
const IMAGE_REVISION_MODES = new Set(["generate", "edit", "masked_edit", "manual_import"]);
const MEDIA_ASSET_PLAN_STATUSES = new Set(["planned", "generated", "approved", "rejected", "deferred"]);

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
    .filter((row) => row.name || row.hex || row.role)
    .slice(0, 8);
}

function normalizePaletteContract({ palette = [], paletteDisplay = {} } = {}) {
  const rows = normalizePalette(palette);
  const display = isPlainObject(paletteDisplay) ? paletteDisplay : {};
  return {
    required: true,
    displayMode: str(display.displayMode || display.mode || "separate_and_optional_in_image"),
    coordinationRule: str(display.coordinationRule || "Image colors must reflect or coordinate with the approved palette."),
    colors: rows
  };
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

function normalizeImageRevisions(rows = [], displayAsset = {}) {
  const sourceRows = arr(rows).length ? rows : [{
    revisionId: "board-r001",
    parentRevisionId: "",
    mode: "generate",
    relativePath: displayAsset.relativePath || "inspiration-board.png",
    promptRef: "prompt-001",
    userRequest: "",
    paletteLocked: true,
    paletteChangeSummary: "",
    changeSummary: "Initial inspiration board."
  }];
  return arr(sourceRows)
    .map((row, idx) => {
      const mode = str(row?.mode || (idx === 0 ? "generate" : "edit"));
      return {
        revisionId: str(row?.revisionId || `board-r${String(idx + 1).padStart(3, "0")}`),
        parentRevisionId: str(row?.parentRevisionId),
        mode: IMAGE_REVISION_MODES.has(mode) ? mode : "edit",
        relativePath: str(row?.relativePath || displayAsset.relativePath || "inspiration-board.png"),
        promptRef: str(row?.promptRef || `prompt-${String(idx + 1).padStart(3, "0")}`),
        maskRef: str(row?.maskRef),
        source: normalizeSource(row?.source || { provider: "unknown", model: "gpt-image-1.5", promptRef: row?.promptRef || `prompt-${String(idx + 1).padStart(3, "0")}` }),
        userRequest: str(row?.userRequest),
        changeSummary: str(row?.changeSummary),
        paletteLocked: row?.paletteLocked !== false,
        paletteChangeSummary: str(row?.paletteChangeSummary)
      };
    })
    .filter((row) => row.revisionId && row.relativePath);
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

function normalizeMediaAssetPlans(rows = []) {
  return arr(rows)
    .map((row, idx) => {
      const kind = str(row?.kind).toLowerCase();
      const status = str(row?.status || "planned").toLowerCase();
      return {
        assetId: str(row?.assetId || `planned-asset-${String(idx + 1).padStart(3, "0")}`),
        kind: ASSET_KINDS.has(kind) ? kind : "image",
        status: MEDIA_ASSET_PLAN_STATUSES.has(status) ? status : "planned",
        intendedUse: str(row?.intendedUse || "picture_effect_texture"),
        generationPrompt: str(row?.generationPrompt),
        recommendedSections: uniqueStrings(row?.recommendedSections),
        paletteRoles: uniqueStrings(row?.paletteRoles),
        motifs: uniqueStrings(row?.motifs),
        motionUse: str(row?.motionUse),
        promptRef: str(row?.promptRef),
        relativePath: str(row?.relativePath)
      };
    })
    .filter((row) => row.assetId && row.intendedUse);
}

function normalizePrompts(rows = []) {
  return arr(rows)
    .map((row, idx) => ({
      promptId: str(row?.promptId || `prompt-${String(idx + 1).padStart(3, "0")}`),
      model: str(row?.model || "gpt-image-1.5"),
      purpose: str(row?.purpose || "inspiration_board"),
      operation: str(row?.operation || (idx === 0 ? "generate" : "edit")),
      inputRevisionId: str(row?.inputRevisionId),
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
  paletteDisplay = {},
  motifs = [],
  avoidances = [],
  displayAsset = {},
  imageRevisions = [],
  sequenceAssets = [],
  mediaAssetPlans = [],
  prompts = [],
  handoff = {}
} = {}) {
  const normalizedDisplayAsset = normalizeDisplayAsset(displayAsset);
  const normalizedPalette = normalizePaletteContract({ palette, paletteDisplay });
  const normalizedImageRevisions = normalizeImageRevisions(imageRevisions, normalizedDisplayAsset);
  const currentImageRevisionId = str(
    displayAsset?.currentRevisionId ||
    normalizedImageRevisions[normalizedImageRevisions.length - 1]?.revisionId ||
    "board-r001"
  );
  const normalizedPrompts = normalizePrompts(prompts.length ? prompts : [{
    promptId: "prompt-001",
    model: "gpt-image-1.5",
    purpose: "inspiration_board",
    operation: "generate",
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
      palette: normalizedPalette.colors,
      motifs: uniqueStrings(motifs),
      avoidances: uniqueStrings(avoidances)
    },
    palette: normalizedPalette,
    displayAsset: {
      ...normalizedDisplayAsset,
      currentRevisionId: currentImageRevisionId
    },
    imageRevisions: normalizedImageRevisions,
    sequenceAssets: normalizeSequenceAssets(sequenceAssets),
    mediaAssetPlans: normalizeMediaAssetPlans(mediaAssetPlans),
    prompts: normalizedPrompts,
    handoff: {
      sequencerUse: str(handoff?.sequencerUse || "optional"),
      requiresMediaEffects: handoff?.requiresMediaEffects !== false,
      artifactRefs: uniqueStrings(handoff?.artifactRefs)
    }
  });
}

export function buildVisualDesignImageEditRevision({
  assetPack = null,
  userRequest = "",
  prompt = "",
  relativePath = "",
  maskRef = "",
  model = "gpt-image-1.5",
  displayAsset = {},
  palette = null,
  paletteChangeSummary = "",
  changeSummary = ""
} = {}) {
  const pack = isPlainObject(assetPack) ? assetPack : {};
  const currentRevisions = arr(pack.imageRevisions);
  const parent = currentRevisions[currentRevisions.length - 1] || null;
  const nextIndex = currentRevisions.length + 1;
  const revisionId = `board-r${String(nextIndex).padStart(3, "0")}`;
  const nextPromptId = `prompt-${String(arr(pack.prompts).length + 1).padStart(3, "0")}`;
  const nextPalette = palette == null ? (pack.palette?.colors || pack.creativeIntent?.palette || []) : palette;
  const outputPath = str(relativePath || `revisions/${revisionId}.png`);
  const editPrompt = str(prompt || userRequest);
  return buildVisualDesignAssetPack({
    sequenceId: pack.sequenceId,
    trackIdentity: pack.trackIdentity,
    themeSummary: pack.creativeIntent?.themeSummary,
    inspirationPrompt: pack.creativeIntent?.inspirationPrompt || editPrompt,
    palette: nextPalette,
    paletteDisplay: pack.palette,
    motifs: pack.creativeIntent?.motifs,
    avoidances: pack.creativeIntent?.avoidances,
    displayAsset: {
      ...(pack.displayAsset || {}),
      ...(isPlainObject(displayAsset) ? displayAsset : {}),
      relativePath: outputPath,
      currentRevisionId: revisionId
    },
    imageRevisions: [
      ...currentRevisions,
      {
        revisionId,
        parentRevisionId: str(parent?.revisionId),
        mode: maskRef ? "masked_edit" : "edit",
        relativePath: outputPath,
        promptRef: nextPromptId,
        maskRef,
        source: normalizeSource({ provider: "openai", model, promptRef: nextPromptId }),
        userRequest,
        changeSummary,
        paletteLocked: palette == null,
        paletteChangeSummary
      }
    ],
    sequenceAssets: pack.sequenceAssets,
    mediaAssetPlans: pack.mediaAssetPlans,
    prompts: [
      ...arr(pack.prompts),
      {
        promptId: nextPromptId,
        model,
        purpose: "inspiration_board_revision",
        operation: maskRef ? "masked_edit" : "edit",
        inputRevisionId: str(parent?.revisionId),
        prompt: editPrompt
      }
    ],
    handoff: pack.handoff
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
  if (!isPlainObject(obj.palette)) errors.push("palette is required");
  if (obj.palette?.required !== true) errors.push("palette.required must be true");
  if (!Array.isArray(obj.palette?.colors) || !obj.palette.colors.length) {
    errors.push("palette.colors is required");
  }
  if (Array.isArray(obj.palette?.colors) && obj.palette.colors.length > 8) {
    errors.push("palette.colors must not exceed 8 colors");
  }
  if (!isPlainObject(obj.displayAsset)) errors.push("displayAsset is required");
  if (!DISPLAY_ASSET_KINDS.has(str(obj.displayAsset?.kind))) {
    errors.push("displayAsset.kind must be inspiration_board");
  }
  if (!str(obj.displayAsset?.relativePath)) errors.push("displayAsset.relativePath is required");
  if (!str(obj.displayAsset?.currentRevisionId)) errors.push("displayAsset.currentRevisionId is required");
  if (!Array.isArray(obj.imageRevisions) || !obj.imageRevisions.length) errors.push("imageRevisions is required");
  if (!Array.isArray(obj.sequenceAssets)) errors.push("sequenceAssets must be an array");
  if (obj.mediaAssetPlans != null && !Array.isArray(obj.mediaAssetPlans)) errors.push("mediaAssetPlans must be an array");
  if (!Array.isArray(obj.prompts) || !obj.prompts.length) errors.push("prompts is required");

  for (const [idx, asset] of arr(obj.sequenceAssets).entries()) {
    if (!str(asset?.assetId)) errors.push(`sequenceAssets[${idx}].assetId is required`);
    if (!ASSET_KINDS.has(str(asset?.kind))) errors.push(`sequenceAssets[${idx}].kind is invalid`);
    if (!str(asset?.relativePath)) errors.push(`sequenceAssets[${idx}].relativePath is required`);
  }
  for (const [idx, plan] of arr(obj.mediaAssetPlans).entries()) {
    if (!str(plan?.assetId)) errors.push(`mediaAssetPlans[${idx}].assetId is required`);
    if (!ASSET_KINDS.has(str(plan?.kind))) errors.push(`mediaAssetPlans[${idx}].kind is invalid`);
    if (!MEDIA_ASSET_PLAN_STATUSES.has(str(plan?.status))) errors.push(`mediaAssetPlans[${idx}].status is invalid`);
    if (!str(plan?.intendedUse)) errors.push(`mediaAssetPlans[${idx}].intendedUse is required`);
  }
  const revisionIds = new Set();
  for (const [idx, revision] of arr(obj.imageRevisions).entries()) {
    const revisionId = str(revision?.revisionId);
    if (!revisionId) errors.push(`imageRevisions[${idx}].revisionId is required`);
    if (revisionIds.has(revisionId)) errors.push(`imageRevisions[${idx}].revisionId must be unique`);
    revisionIds.add(revisionId);
    if (!IMAGE_REVISION_MODES.has(str(revision?.mode))) errors.push(`imageRevisions[${idx}].mode is invalid`);
    if (!str(revision?.relativePath)) errors.push(`imageRevisions[${idx}].relativePath is required`);
    if (!isPlainObject(revision?.source)) errors.push(`imageRevisions[${idx}].source is required`);
    if (!str(revision?.source?.provider)) errors.push(`imageRevisions[${idx}].source.provider is required`);
    if (!str(revision?.source?.model)) errors.push(`imageRevisions[${idx}].source.model is required`);
    if (idx > 0 && !str(revision?.parentRevisionId)) {
      errors.push(`imageRevisions[${idx}].parentRevisionId is required`);
    }
  }
  if (str(obj.displayAsset?.currentRevisionId) && !revisionIds.has(str(obj.displayAsset.currentRevisionId))) {
    errors.push("displayAsset.currentRevisionId must reference imageRevisions");
  }

  return errors;
}

export function buildVisualInspirationRefs(assetPack = {}) {
  const obj = isPlainObject(assetPack) ? assetPack : {};
  const displayAsset = isPlainObject(obj.displayAsset) ? obj.displayAsset : {};
  const creativeIntent = isPlainObject(obj.creativeIntent) ? obj.creativeIntent : {};
  const palette = isPlainObject(obj.palette) ? obj.palette : {};
  return {
    artifactId: str(obj.artifactId),
    displayAssetRef: str(displayAsset.relativePath),
    currentRevisionId: str(displayAsset.currentRevisionId),
    palette: normalizePalette(palette.colors || creativeIntent.palette),
    paletteDisplayMode: str(palette.displayMode),
    paletteCoordinationRule: str(palette.coordinationRule),
    themeSummary: str(creativeIntent.themeSummary),
    motifs: uniqueStrings(creativeIntent.motifs),
    mediaAssetPlanCount: arr(obj.mediaAssetPlans).length
  };
}

export function buildDefaultVisualMediaAssetPlans({
  themeSummary = "",
  palette = [],
  motifs = [],
  sections = []
} = {}) {
  const paletteRoles = normalizePalette(palette).map((row) => row.role || row.name || row.hex).filter(Boolean);
  const motifRows = uniqueStrings(motifs);
  const sectionRows = uniqueStrings(sections);
  const theme = str(themeSummary || "active song visual theme");
  return [
    {
      assetId: "planned-asset-001",
      kind: "image",
      status: "planned",
      intendedUse: "picture_effect_texture",
      generationPrompt: `Generate an original high-resolution texture plate for ${theme}. It should coordinate with the approved palette and avoid depicting the physical xLights display.`,
      recommendedSections: sectionRows.slice(0, 2),
      paletteRoles: paletteRoles.slice(0, 3),
      motifs: motifRows.slice(0, 3),
      motionUse: "static_or_slow_pan"
    },
    {
      assetId: "planned-asset-002",
      kind: "image",
      status: "planned",
      intendedUse: "picture_effect_motif_overlay",
      generationPrompt: `Generate an original transparent or dark-background motif overlay for ${theme}, emphasizing ${motifRows.slice(0, 2).join(", ") || "the main visual motifs"}.`,
      recommendedSections: sectionRows,
      paletteRoles: paletteRoles.slice(0, 2),
      motifs: motifRows.slice(0, 4),
      motionUse: "overlay_or_masked_reveal"
    },
    {
      assetId: "planned-asset-003",
      kind: "video",
      status: "deferred",
      intendedUse: "video_effect_motion_loop",
      generationPrompt: `Generate a short seamless motion loop for ${theme} after video effect support is available. Keep motion readable at low display resolution.`,
      recommendedSections: sectionRows,
      paletteRoles: paletteRoles,
      motifs: motifRows,
      motionUse: "short_loop_or_slow_reveal"
    }
  ];
}
