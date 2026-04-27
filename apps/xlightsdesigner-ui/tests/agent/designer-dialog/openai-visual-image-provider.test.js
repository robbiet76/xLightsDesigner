import test from "node:test";
import assert from "node:assert/strict";

import {
  buildOpenAIImageGenerationRequest,
  buildOpenAIVisualImageConfig,
  buildVisualImageFileFromOpenAIResult,
  buildVisualInspirationImagePrompt,
  editOpenAIVisualImage,
  extractOpenAIImageResult,
  generateOpenAIVisualImage
} from "../../../agent/designer-dialog/openai-visual-image-provider.js";

test("visual image prompt preserves palette and avoids literal xLights output", () => {
  const prompt = buildVisualInspirationImagePrompt({
    themeSummary: "icy choral tension with gold release",
    palette: [
      { name: "ice blue", hex: "#8fd8ff", role: "base" },
      { name: "warm gold", hex: "#ffd36a", role: "accent" }
    ],
    motifs: ["bell shimmer"],
    avoidances: ["literal roofline preview"]
  });

  assert.match(prompt, /Palette: ice blue #8fd8ff/);
  assert.match(prompt, /warm gold #ffd36a/);
  assert.match(prompt, /Do not include visible text, palette strips, labeled swatches, legends, or color chips/);
  assert.match(prompt, /Do not depict the literal xLights display/);
});

test("openai image generation request defaults to target resolution and gpt-image-1.5", () => {
  const request = buildOpenAIImageGenerationRequest({
    prompt: "Create an original holiday inspiration board."
  });

  assert.equal(request.model, "gpt-image-1.5");
  assert.equal(request.size, "1536x1024");
  assert.equal(request.quality, "medium");
  assert.equal(request.output_format, "png");
});

test("openai image response extraction returns binary image and metadata", () => {
  const out = extractOpenAIImageResult({
    id: "img-1",
    data: [{ b64_json: Buffer.from("image-bytes").toString("base64") }]
  }, { size: "1536x1024", outputFormat: "png" });

  assert.equal(out.ok, true);
  assert.equal(out.image.toString("utf8"), "image-bytes");
  assert.equal(out.mimeType, "image/png");
  assert.equal(out.width, 1536);
  assert.equal(out.height, 1024);
});

test("generateOpenAIVisualImage posts to images generation endpoint with injected fetch", async () => {
  const calls = [];
  const result = await generateOpenAIVisualImage({
    apiKey: "test-key",
    baseUrl: "https://api.openai.test/v1/",
    prompt: "Create an original board.",
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({ data: [{ b64_json: Buffer.from("generated").toString("base64") }] });
        }
      };
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.model, "gpt-image-1.5");
  assert.equal(result.image.toString("utf8"), "generated");
  assert.equal(calls[0].url, "https://api.openai.test/v1/images/generations");
  assert.equal(JSON.parse(calls[0].init.body).size, "1536x1024");
});

test("editOpenAIVisualImage posts multipart edits without content-type override", async () => {
  const calls = [];
  const result = await editOpenAIVisualImage({
    apiKey: "test-key",
    baseUrl: "https://api.openai.test/v1",
    prompt: "Soften the glow while preserving the palette.",
    image: Buffer.from("input"),
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({ data: [{ b64_json: Buffer.from("edited").toString("base64") }] });
        }
      };
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.mode, "edit");
  assert.equal(result.image.toString("utf8"), "edited");
  assert.equal(calls[0].url, "https://api.openai.test/v1/images/edits");
  assert.equal(calls[0].init.headers.Authorization, "Bearer test-key");
  assert.equal("Content-Type" in calls[0].init.headers, false);
});

test("visual image file adapter preserves display dimensions for store writes", () => {
  const out = buildVisualImageFileFromOpenAIResult({
    result: {
      image: Buffer.from("image"),
      mimeType: "image/png",
      width: 1536,
      height: 1024,
      model: "gpt-image-1.5"
    },
    relativePath: "inspiration-board.png"
  });

  assert.equal(out.ok, true);
  assert.equal(out.file.content.toString("utf8"), "image");
  assert.equal(out.displayAsset.width, 1536);
  assert.equal(out.source.provider, "openai");
});

test("openai visual image config requires explicit live enable flag", () => {
  const cfg = buildOpenAIVisualImageConfig({ model: "gpt-image-1.5" });
  assert.equal(cfg.enabled, false);
  assert.equal(cfg.model, "gpt-image-1.5");
});
