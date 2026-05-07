import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { exportXLightsPreviewVideo } from "./export-xlights-preview-video.mjs";

function writeFile(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text);
}

test("exportXLightsPreviewVideo opens, renders, and exports via xLights automation", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-preview-video-export-"));
  const sequencePath = path.join(root, "Sequence.xsq");
  const videoPath = path.join(root, "Sequence.mp4");
  const artifactPath = path.join(root, "preview-video.json");
  writeFile(sequencePath, "<xsequence/>");

  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), body: JSON.parse(String(options.body || "{}")) });
    return {
      text: async () => JSON.stringify({ res: 200, msg: "ok", output: videoPath })
    };
  };

  const artifact = await exportXLightsPreviewVideo({
    xlightsBaseUrl: "http://127.0.0.1:49914/",
    sequence: sequencePath,
    out: videoPath,
    artifact: artifactPath,
    fetchImpl
  });

  assert.equal(artifact.artifactType, "xlights_preview_video_export_v1");
  assert.equal(artifact.output.videoPath, videoPath);
  assert.equal(artifact.output.audioPolicy, "include_current_sequence_media_audio_when_present");
  assert.deepEqual(calls.map((call) => call.body.cmd), ["openSequence", "renderAll", "exportVideoPreview"]);
  assert.equal(calls[0].url, "http://127.0.0.1:49914/xlDoAutomation");
  assert.equal(calls[0].body.seq, sequencePath);
  assert.equal(calls[1].body.highdef, true);
  assert.equal(calls[2].body.filename, videoPath);

  const persisted = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  assert.equal(persisted.readFormat, "house_preview_mp4_with_sequence_audio_when_present");
  assert.equal(persisted.steps.length, 3);
});

test("exportXLightsPreviewVideo can export the currently open sequence", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-preview-video-current-"));
  const videoPath = path.join(root, "Current.mp4");
  const calls = [];
  const fetchImpl = async (_url, options = {}) => {
    calls.push(JSON.parse(String(options.body || "{}")));
    return { text: async () => JSON.stringify({ res: 200, msg: "ok" }) };
  };

  await exportXLightsPreviewVideo({
    xlightsBaseUrl: "http://127.0.0.1:49914",
    skipOpen: true,
    skipRender: true,
    out: videoPath,
    fetchImpl
  });

  assert.deepEqual(calls.map((call) => call.cmd), ["exportVideoPreview"]);
});

test("exportXLightsPreviewVideo accepts legacy openSequence metadata response", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-preview-video-legacy-open-"));
  const sequencePath = path.join(root, "Sequence.xsq");
  const videoPath = path.join(root, "Sequence.mp4");
  writeFile(sequencePath, "<xsequence/>");
  const fetchImpl = async (_url, options = {}) => {
    const body = JSON.parse(String(options.body || "{}"));
    if (body.cmd === "openSequence") {
      return { text: async () => JSON.stringify({ seq: "Sequence", fullseq: sequencePath }) };
    }
    return { text: async () => JSON.stringify({ res: 200, msg: "ok" }) };
  };

  const artifact = await exportXLightsPreviewVideo({
    xlightsBaseUrl: "http://127.0.0.1:49914",
    sequence: sequencePath,
    out: videoPath,
    fetchImpl
  });

  assert.equal(artifact.steps[0].response.res, 200);
  assert.equal(artifact.steps[0].response.fullseq, sequencePath);
});

test("exportXLightsPreviewVideo accepts legacy render and export success responses", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-preview-video-legacy-success-"));
  const sequencePath = path.join(root, "Sequence.xsq");
  const videoPath = path.join(root, "Sequence.mp4");
  writeFile(sequencePath, "<xsequence/>");
  const fetchImpl = async (_url, options = {}) => {
    const body = JSON.parse(String(options.body || "{}"));
    if (body.cmd === "openSequence") {
      return { text: async () => JSON.stringify({ seq: "Sequence", fullseq: sequencePath }) };
    }
    if (body.cmd === "renderAll") {
      return { text: async () => JSON.stringify({ msg: "Rendered." }) };
    }
    return { text: async () => JSON.stringify({ msg: "Export Video Preview.", output: videoPath }) };
  };

  const artifact = await exportXLightsPreviewVideo({
    xlightsBaseUrl: "http://127.0.0.1:49914",
    sequence: sequencePath,
    out: videoPath,
    fetchImpl
  });

  assert.equal(artifact.steps[1].response.res, 200);
  assert.equal(artifact.steps[2].response.res, 200);
  assert.equal(artifact.steps[2].response.output, videoPath);
});

test("exportXLightsPreviewVideo times out blocked automation calls", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-preview-video-timeout-"));
  const sequencePath = path.join(root, "Sequence.xsq");
  const videoPath = path.join(root, "Sequence.mp4");
  writeFile(sequencePath, "<xsequence/>");
  const fetchImpl = async (_url, options = {}) => {
    await new Promise((resolve, reject) => {
      options.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
    });
  };

  await assert.rejects(
    () => exportXLightsPreviewVideo({
      xlightsBaseUrl: "http://127.0.0.1:49914",
      sequence: sequencePath,
      out: videoPath,
      automationTimeoutMs: 5,
      fetchImpl
    }),
    /timed out after 5ms.*modal/i
  );
});
