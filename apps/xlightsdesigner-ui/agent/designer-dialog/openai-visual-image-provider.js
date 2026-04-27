export const OPENAI_VISUAL_IMAGE_PROVIDER = "openai";
export const DEFAULT_OPENAI_VISUAL_IMAGE_MODEL = "gpt-image-1.5";
export const DEFAULT_OPENAI_VISUAL_IMAGE_SIZE = "1536x1024";
export const DEFAULT_OPENAI_VISUAL_IMAGE_QUALITY = "medium";
export const DEFAULT_OPENAI_VISUAL_IMAGE_FORMAT = "png";

const OUTPUT_FORMAT_MIME_TYPES = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp"
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

function envValue(name = "") {
  if (typeof process === "undefined" || !process?.env) return "";
  return str(process.env[name]);
}

function normalizeBaseUrl(value = "") {
  return str(value || "https://api.openai.com/v1").replace(/\/+$/, "");
}

function normalizeOutputFormat(value = "") {
  const format = str(value || DEFAULT_OPENAI_VISUAL_IMAGE_FORMAT).toLowerCase();
  return OUTPUT_FORMAT_MIME_TYPES[format] ? format : DEFAULT_OPENAI_VISUAL_IMAGE_FORMAT;
}

function parseSize(size = "") {
  const raw = str(size || DEFAULT_OPENAI_VISUAL_IMAGE_SIZE).toLowerCase();
  const match = raw.match(/^(\d+)x(\d+)$/);
  if (!match) return { size: DEFAULT_OPENAI_VISUAL_IMAGE_SIZE, width: 1536, height: 1024 };
  return {
    size: `${Number(match[1])}x${Number(match[2])}`,
    width: Number(match[1]),
    height: Number(match[2])
  };
}

function imageMimeType(format = "") {
  return OUTPUT_FORMAT_MIME_TYPES[normalizeOutputFormat(format)];
}

function paletteLine(palette = []) {
  const rows = arr(palette)
    .map((color) => {
      const name = str(color?.name);
      const hex = str(color?.hex);
      const role = str(color?.role);
      return [name, hex, role ? `(${role})` : ""].filter(Boolean).join(" ");
    })
    .filter(Boolean);
  return rows.length ? `Palette: ${rows.join(", ")}.` : "";
}

export function buildVisualInspirationImagePrompt({
  themeSummary = "",
  basePrompt = "",
  palette = [],
  motifs = [],
  avoidances = [],
  includePaletteInImage = false,
  revisionRequest = ""
} = {}) {
  const lines = [
    str(basePrompt || themeSummary),
    str(themeSummary) ? `Theme: ${str(themeSummary)}.` : "",
    paletteLine(palette),
    arr(motifs).length ? `Motifs: ${arr(motifs).map((row) => str(row)).filter(Boolean).join(", ")}.` : "",
    str(revisionRequest) ? `Requested revision: ${str(revisionRequest)}.` : "",
    includePaletteInImage
      ? "Use the palette as color direction only; do not render palette strips, swatch labels, legends, or color chips inside the image."
      : "Do not include visible text, palette strips, labeled swatches, legends, or color chips.",
    "Create a custom original mood-board collage for sequence inspiration only.",
    "Do not depict the literal xLights display, controller layout, UI, timeline, or physical house preview.",
    arr(avoidances).length ? `Avoid: ${arr(avoidances).map((row) => str(row)).filter(Boolean).join(", ")}.` : ""
  ].filter(Boolean);
  return lines.join("\n");
}

export function buildOpenAIImageGenerationRequest({
  prompt = "",
  model = DEFAULT_OPENAI_VISUAL_IMAGE_MODEL,
  size = DEFAULT_OPENAI_VISUAL_IMAGE_SIZE,
  quality = DEFAULT_OPENAI_VISUAL_IMAGE_QUALITY,
  outputFormat = DEFAULT_OPENAI_VISUAL_IMAGE_FORMAT
} = {}) {
  return {
    model: str(model || DEFAULT_OPENAI_VISUAL_IMAGE_MODEL),
    prompt: str(prompt),
    size: parseSize(size).size,
    quality: str(quality || DEFAULT_OPENAI_VISUAL_IMAGE_QUALITY),
    output_format: normalizeOutputFormat(outputFormat)
  };
}

export function extractOpenAIImageResult(body = {}, { outputFormat = DEFAULT_OPENAI_VISUAL_IMAGE_FORMAT, size = DEFAULT_OPENAI_VISUAL_IMAGE_SIZE } = {}) {
  const parsedSize = parseSize(size);
  const data = Array.isArray(body?.data) ? body.data : [];
  const first = data.find((row) => str(row?.b64_json)) || data[0] || {};
  const b64 = str(first?.b64_json);
  if (!b64) {
    return { ok: false, error: "OpenAI image response did not include b64_json image data" };
  }
  const buffer = Buffer.from(b64, "base64");
  return {
    ok: true,
    image: buffer,
    mimeType: str(first?.mime_type || imageMimeType(outputFormat)),
    width: Number(first?.width) || parsedSize.width,
    height: Number(first?.height) || parsedSize.height,
    revisedPrompt: str(first?.revised_prompt),
    responseId: str(body?.id)
  };
}

export async function generateOpenAIVisualImage({
  apiKey = "",
  baseUrl = "https://api.openai.com/v1",
  prompt = "",
  model = DEFAULT_OPENAI_VISUAL_IMAGE_MODEL,
  size = DEFAULT_OPENAI_VISUAL_IMAGE_SIZE,
  quality = DEFAULT_OPENAI_VISUAL_IMAGE_QUALITY,
  outputFormat = DEFAULT_OPENAI_VISUAL_IMAGE_FORMAT,
  fetchImpl = globalThis.fetch
} = {}) {
  const key = str(apiKey || envValue("OPENAI_API_KEY"));
  if (!key) return { ok: false, code: "OPENAI_API_KEY_MISSING", error: "OpenAI API key is required for live image generation." };
  if (!str(prompt)) return { ok: false, code: "PROMPT_MISSING", error: "Prompt is required for image generation." };
  if (typeof fetchImpl !== "function") return { ok: false, code: "FETCH_UNAVAILABLE", error: "fetch is unavailable." };

  const request = buildOpenAIImageGenerationRequest({ prompt, model, size, quality, outputFormat });
  const response = await fetchImpl(`${normalizeBaseUrl(baseUrl)}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });
  const text = await response.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    return { ok: false, code: "OPENAI_IMAGE_RESPONSE_PARSE_FAILED", status: response.status, error: text };
  }
  if (!response.ok) {
    return {
      ok: false,
      code: "OPENAI_IMAGE_GENERATION_FAILED",
      status: response.status,
      error: str(body?.error?.message || body?.message || text)
    };
  }
  const extracted = extractOpenAIImageResult(body, { outputFormat, size });
  if (!extracted.ok) return { ...extracted, code: "OPENAI_IMAGE_DATA_MISSING", status: response.status };
  return {
    ok: true,
    provider: OPENAI_VISUAL_IMAGE_PROVIDER,
    model: request.model,
    prompt,
    size: request.size,
    quality: request.quality,
    outputFormat: request.output_format,
    ...extracted
  };
}

export function buildOpenAIImageEditFormData({
  prompt = "",
  image = null,
  imageFilename = "input.png",
  imageMimeType = "image/png",
  mask = null,
  maskFilename = "mask.png",
  maskMimeType = "image/png",
  model = DEFAULT_OPENAI_VISUAL_IMAGE_MODEL,
  size = DEFAULT_OPENAI_VISUAL_IMAGE_SIZE,
  quality = DEFAULT_OPENAI_VISUAL_IMAGE_QUALITY,
  outputFormat = DEFAULT_OPENAI_VISUAL_IMAGE_FORMAT
} = {}) {
  if (typeof FormData !== "function" || typeof Blob !== "function") {
    throw new Error("FormData and Blob are required for OpenAI image edits.");
  }
  const form = new FormData();
  form.append("model", str(model || DEFAULT_OPENAI_VISUAL_IMAGE_MODEL));
  form.append("prompt", str(prompt));
  form.append("size", parseSize(size).size);
  form.append("quality", str(quality || DEFAULT_OPENAI_VISUAL_IMAGE_QUALITY));
  form.append("output_format", normalizeOutputFormat(outputFormat));
  form.append("image", new Blob([image], { type: str(imageMimeType || "image/png") }), str(imageFilename || "input.png"));
  if (mask) {
    form.append("mask", new Blob([mask], { type: str(maskMimeType || "image/png") }), str(maskFilename || "mask.png"));
  }
  return form;
}

export async function editOpenAIVisualImage({
  apiKey = "",
  baseUrl = "https://api.openai.com/v1",
  prompt = "",
  image = null,
  imageFilename = "input.png",
  imageMimeType = "image/png",
  mask = null,
  maskFilename = "mask.png",
  maskMimeType = "image/png",
  model = DEFAULT_OPENAI_VISUAL_IMAGE_MODEL,
  size = DEFAULT_OPENAI_VISUAL_IMAGE_SIZE,
  quality = DEFAULT_OPENAI_VISUAL_IMAGE_QUALITY,
  outputFormat = DEFAULT_OPENAI_VISUAL_IMAGE_FORMAT,
  fetchImpl = globalThis.fetch
} = {}) {
  const key = str(apiKey || envValue("OPENAI_API_KEY"));
  if (!key) return { ok: false, code: "OPENAI_API_KEY_MISSING", error: "OpenAI API key is required for live image editing." };
  if (!str(prompt)) return { ok: false, code: "PROMPT_MISSING", error: "Prompt is required for image editing." };
  if (!image) return { ok: false, code: "IMAGE_MISSING", error: "Input image is required for image editing." };
  if (typeof fetchImpl !== "function") return { ok: false, code: "FETCH_UNAVAILABLE", error: "fetch is unavailable." };

  const form = buildOpenAIImageEditFormData({
    prompt,
    image,
    imageFilename,
    imageMimeType,
    mask,
    maskFilename,
    maskMimeType,
    model,
    size,
    quality,
    outputFormat
  });
  const response = await fetchImpl(`${normalizeBaseUrl(baseUrl)}/images/edits`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form
  });
  const text = await response.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    return { ok: false, code: "OPENAI_IMAGE_RESPONSE_PARSE_FAILED", status: response.status, error: text };
  }
  if (!response.ok) {
    return {
      ok: false,
      code: "OPENAI_IMAGE_EDIT_FAILED",
      status: response.status,
      error: str(body?.error?.message || body?.message || text)
    };
  }
  const extracted = extractOpenAIImageResult(body, { outputFormat, size });
  if (!extracted.ok) return { ...extracted, code: "OPENAI_IMAGE_DATA_MISSING", status: response.status };
  return {
    ok: true,
    provider: OPENAI_VISUAL_IMAGE_PROVIDER,
    model: str(model || DEFAULT_OPENAI_VISUAL_IMAGE_MODEL),
    prompt,
    size: parseSize(size).size,
    quality: str(quality || DEFAULT_OPENAI_VISUAL_IMAGE_QUALITY),
    outputFormat: normalizeOutputFormat(outputFormat),
    mode: mask ? "masked_edit" : "edit",
    ...extracted
  };
}

export function buildVisualImageFileFromOpenAIResult({
  result = {},
  relativePath = "inspiration-board.png"
} = {}) {
  const image = result?.image;
  if (!Buffer.isBuffer(image)) {
    return { ok: false, code: "IMAGE_BUFFER_MISSING", error: "OpenAI image result did not include an image buffer." };
  }
  return {
    ok: true,
    file: {
      relativePath: str(relativePath || "inspiration-board.png"),
      content: image
    },
    displayAsset: {
      relativePath: str(relativePath || "inspiration-board.png"),
      mimeType: str(result.mimeType || imageMimeType(result.outputFormat)),
      width: Number(result.width) || null,
      height: Number(result.height) || null
    },
    source: {
      provider: OPENAI_VISUAL_IMAGE_PROVIDER,
      model: str(result.model || DEFAULT_OPENAI_VISUAL_IMAGE_MODEL)
    }
  };
}

export function buildOpenAIVisualImageConfig(config = {}) {
  const obj = isPlainObject(config) ? config : {};
  return {
    provider: OPENAI_VISUAL_IMAGE_PROVIDER,
    model: str(obj.model || envValue("XLD_VISUAL_IMAGE_MODEL") || DEFAULT_OPENAI_VISUAL_IMAGE_MODEL),
    baseUrl: normalizeBaseUrl(obj.baseUrl || envValue("OPENAI_BASE_URL") || "https://api.openai.com/v1"),
    size: parseSize(obj.size || envValue("XLD_VISUAL_IMAGE_SIZE") || DEFAULT_OPENAI_VISUAL_IMAGE_SIZE).size,
    quality: str(obj.quality || envValue("XLD_VISUAL_IMAGE_QUALITY") || DEFAULT_OPENAI_VISUAL_IMAGE_QUALITY),
    outputFormat: normalizeOutputFormat(obj.outputFormat || envValue("XLD_VISUAL_IMAGE_FORMAT") || DEFAULT_OPENAI_VISUAL_IMAGE_FORMAT),
    enabled: Boolean(obj.enabled || envValue("XLD_ENABLE_LIVE_VISUAL_IMAGE_GENERATION") === "1")
  };
}
