#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_API_MODE = process.env.XLIGHTS_PREVIEW_VIDEO_API_MODE || "owned";
const DEFAULT_XLIGHTS_ENDPOINT = process.env.XLIGHTS_ENDPOINT || "http://127.0.0.1:49915/xlightsdesigner/api";
const DEFAULT_XLIGHTS_BASE_URL = process.env.XLIGHTS_BASE_URL || "http://127.0.0.1:49914";
const DEFAULT_AUTOMATION_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_XLIGHTS_STAGING_DIR = process.env.XLIGHTS_PREVIEW_VIDEO_STAGING_DIR
  || (process.platform === "darwin"
    ? path.join(os.homedir(), "Library/Containers/org.xlights/Data/tmp/xld-preview-video")
    : "");

function str(value = "") {
  return String(value || "").trim();
}

function boolish(value) {
  if (value === true || value === false) return value;
  const text = str(value).toLowerCase();
  return text === "true" || text === "1" || text === "yes";
}

function resolvePath(value = "") {
  const text = str(value);
  return path.isAbsolute(text) ? text : path.resolve(text);
}

function parseArgs(argv = []) {
  const args = {
    apiMode: DEFAULT_API_MODE,
    xlightsEndpoint: DEFAULT_XLIGHTS_ENDPOINT,
    xlightsBaseUrl: DEFAULT_XLIGHTS_BASE_URL,
    sequence: "",
    out: "",
    artifact: "",
    xlightsStagingDir: DEFAULT_XLIGHTS_STAGING_DIR,
    skipOpen: false,
    skipRender: false,
    highdef: true,
    automationTimeoutMs: DEFAULT_AUTOMATION_TIMEOUT_MS
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = str(argv[index]);
    if (arg === "--api-mode") args.apiMode = str(argv[++index]);
    else if (arg === "--xlights-endpoint") args.xlightsEndpoint = str(argv[++index]);
    else if (arg === "--xlights-base-url") args.xlightsBaseUrl = str(argv[++index]);
    else if (arg === "--sequence") args.sequence = str(argv[++index]);
    else if (arg === "--out") args.out = str(argv[++index]);
    else if (arg === "--artifact") args.artifact = str(argv[++index]);
    else if (arg === "--xlights-staging-dir") args.xlightsStagingDir = str(argv[++index]);
    else if (arg === "--skip-open") args.skipOpen = true;
    else if (arg === "--skip-render") args.skipRender = true;
    else if (arg === "--highdef") args.highdef = boolish(argv[++index]);
    else if (arg === "--automation-timeout-ms") args.automationTimeoutMs = Number(argv[++index]);
    else if (arg === "--help") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return `Usage:
  node scripts/sequencer-render-training/tooling/export-xlights-preview-video.mjs \\
    --sequence /path/to/sequence.xsq \\
    --out var/benchmarks/sequence-preview.mp4 \\
    --artifact var/benchmarks/sequence-preview-video.json

Options:
  --api-mode owned|legacy   API path to use. Default: ${DEFAULT_API_MODE}
  --xlights-endpoint <url>  Owned xLightsDesigner API endpoint. Default: ${DEFAULT_XLIGHTS_ENDPOINT}
  --xlights-base-url <url>  xLights legacy automation base URL. Default: ${DEFAULT_XLIGHTS_BASE_URL}
  --skip-open              Export the currently open sequence.
  --skip-render            Export without running renderAll first.
  --highdef true|false     Pass highdef to renderAll. Default: true.
  --xlights-staging-dir <dir>
                            Directory xLights can write before copying to --out.
                            Default on macOS: ${DEFAULT_XLIGHTS_STAGING_DIR || "(disabled)"}
  --automation-timeout-ms <n>
                            Timeout per xLights automation command. Default: ${DEFAULT_AUTOMATION_TIMEOUT_MS}
`;
}

function normalizeAutomationBody(text) {
  const idx = String(text || "").indexOf("{");
  return idx >= 0 ? String(text).slice(idx) : String(text || "");
}

function parseAutomationResponse(text, command) {
  let json;
  try {
    json = JSON.parse(normalizeAutomationBody(text));
  } catch (error) {
    throw new Error(`${command} returned invalid JSON: ${error.message}`);
  }
  if (command === "openSequence" && str(json?.fullseq)) {
    return { res: 200, ...json };
  }
  if (command === "openSequence" && /^sequence already open\.?$/i.test(str(json?.msg))) {
    return { res: 200, alreadyOpen: true, ...json };
  }
  if (command === "renderAll" && /^rendered\.?$/i.test(str(json?.msg))) {
    return { res: 200, ...json };
  }
  if (command === "exportVideoPreview" && str(json?.output)) {
    return { res: 200, ...json };
  }
  if (Number(json?.res) !== 200) {
    throw new Error(`${command} failed (${json?.res || "UNKNOWN"}): ${json?.msg || JSON.stringify(json)}`);
  }
  return json;
}

export async function callXLightsAutomation(xlightsBaseUrl, payload, {
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_AUTOMATION_TIMEOUT_MS
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("fetch is unavailable");
  }
  const base = str(xlightsBaseUrl).replace(/\/+$/, "");
  if (!base) throw new Error("xLights base URL is required");
  const command = str(payload?.cmd);
  if (!command) throw new Error("xLights automation command is required");
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timeout = Number.isFinite(Number(timeoutMs)) && Number(timeoutMs) > 0
    ? setTimeout(() => controller?.abort(), Number(timeoutMs))
    : null;
  let response;
  try {
    response = await fetchImpl(`${base}/xlDoAutomation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller?.signal
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`${command} timed out after ${timeoutMs}ms; xLights may be blocked by a modal or long-running export.`);
    }
    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
  return parseAutomationResponse(await response.text(), command);
}

function normalizeEndpoint(endpoint = "") {
  const base = str(endpoint).replace(/\/+$/, "");
  if (!base) throw new Error("Owned xLightsDesigner API endpoint is required");
  return base;
}

async function callOwnedApi(endpoint, route, {
  method = "GET",
  body = null,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_AUTOMATION_TIMEOUT_MS,
  allowError = false
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("fetch is unavailable");
  }
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timeout = Number.isFinite(Number(timeoutMs)) && Number(timeoutMs) > 0
    ? setTimeout(() => controller?.abort(), Number(timeoutMs))
    : null;
  let response;
  try {
    response = await fetchImpl(`${normalizeEndpoint(endpoint)}${route}`, {
      method,
      headers: body == null ? undefined : { "Content-Type": "application/json" },
      body: body == null ? undefined : JSON.stringify(body),
      signal: controller?.signal
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`${method} ${route} timed out after ${timeoutMs}ms; xLights may be blocked by a modal or long-running export.`);
    }
    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
  const text = await response.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch (error) {
    throw new Error(`${method} ${route} returned invalid JSON: ${error.message}`);
  }
  if (!allowError && (!response.ok || json?.ok === false)) {
    const code = json?.error?.code || response.status;
    const message = json?.error?.message || response.statusText || "Request failed";
    throw new Error(`${method} ${route} failed (${code}): ${message}`);
  }
  return json;
}

function ownedJobState(payload = {}) {
  const state = str(payload?.data?.state || payload?.state).toLowerCase();
  return state === "succeeded" ? "completed" : state;
}

function ownedJobResult(payload = {}) {
  return payload?.data?.result || payload?.result || payload;
}

async function waitForOwnedJob(endpoint, jobId, {
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_AUTOMATION_TIMEOUT_MS
} = {}) {
  const started = Date.now();
  let last = null;
  for (;;) {
    const payload = await callOwnedApi(endpoint, `/jobs/get?jobId=${encodeURIComponent(jobId)}`, {
      fetchImpl,
      timeoutMs: Math.min(timeoutMs, 30000),
      allowError: true
    });
    last = payload;
    const state = ownedJobState(payload);
    const result = ownedJobResult(payload);
    if (state === "completed") {
      if (result?.ok === false) {
        throw new Error(`Owned API job ${jobId} completed with failed result: ${JSON.stringify(result)}`);
      }
      return { payload, result };
    }
    if (state === "failed") {
      throw new Error(`Owned API job ${jobId} failed: ${JSON.stringify(payload)}`);
    }
    if (Date.now() - started > timeoutMs) {
      throw new Error(`Timed out waiting for owned API job ${jobId}. Last response: ${JSON.stringify(last)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

async function postOwnedJob(endpoint, route, body, {
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_AUTOMATION_TIMEOUT_MS
} = {}) {
  const accepted = await callOwnedApi(endpoint, route, {
    method: "POST",
    body,
    fetchImpl,
    timeoutMs
  });
  const jobId = str(accepted?.data?.jobId);
  if (!jobId) throw new Error(`${route} returned no jobId: ${JSON.stringify(accepted)}`);
  const settled = await waitForOwnedJob(endpoint, jobId, { fetchImpl, timeoutMs });
  return { accepted, settled };
}

export async function exportXLightsPreviewVideo(options = {}) {
  const apiMode = str(options.apiMode || DEFAULT_API_MODE).toLowerCase();
  const xlightsEndpoint = normalizeEndpoint(options.xlightsEndpoint || DEFAULT_XLIGHTS_ENDPOINT);
  const xlightsBaseUrl = str(options.xlightsBaseUrl || DEFAULT_XLIGHTS_BASE_URL);
  const sequencePath = options.sequence ? resolvePath(options.sequence) : "";
  const outputPath = resolvePath(options.out);
  const artifactPath = options.artifact ? resolvePath(options.artifact) : "";
  const xlightsStagingDir = options.xlightsStagingDir ? resolvePath(options.xlightsStagingDir) : "";
  const xlightsOutputPath = xlightsStagingDir
    ? path.join(xlightsStagingDir, `${path.basename(outputPath, path.extname(outputPath))}-${Date.now()}${path.extname(outputPath) || ".mp4"}`)
    : outputPath;
  const automationTimeoutMs = Number(options.automationTimeoutMs || DEFAULT_AUTOMATION_TIMEOUT_MS);
  if (!options.skipOpen && !sequencePath) throw new Error("--sequence is required unless --skip-open is used");
  if (!outputPath) throw new Error("--out is required");
  if (!options.skipOpen && !fs.existsSync(sequencePath)) throw new Error(`Sequence file does not exist: ${sequencePath}`);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  if (artifactPath) fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  if (xlightsStagingDir) fs.mkdirSync(xlightsStagingDir, { recursive: true });

  const steps = [];
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (apiMode === "owned") {
    if (!options.skipOpen) {
      const response = await postOwnedJob(xlightsEndpoint, "/sequence/open", {
        file: sequencePath,
        force: true,
        promptIssues: false
      }, { fetchImpl, timeoutMs: automationTimeoutMs });
      steps.push({ command: "sequence.open", ok: true, response });
    }
    const response = await postOwnedJob(xlightsEndpoint, "/sequence/export-preview-video", {
      file: xlightsOutputPath,
      renderFirst: !options.skipRender
    }, { fetchImpl, timeoutMs: automationTimeoutMs });
    steps.push({ command: "sequence.exportPreviewVideo", ok: true, response });
  } else if (apiMode === "legacy") {
    if (!options.skipOpen) {
      const response = await callXLightsAutomation(xlightsBaseUrl, {
        cmd: "openSequence",
        seq: sequencePath,
        force: true,
        promptIssues: false
      }, { fetchImpl, timeoutMs: automationTimeoutMs });
      steps.push({ command: "openSequence", ok: true, response });
    }
    if (!options.skipRender) {
      const response = await callXLightsAutomation(xlightsBaseUrl, {
        cmd: "renderAll",
        highdef: options.highdef !== false
      }, { fetchImpl, timeoutMs: automationTimeoutMs });
      steps.push({ command: "renderAll", ok: true, response });
    }
    const exportResponse = await callXLightsAutomation(xlightsBaseUrl, {
      cmd: "exportVideoPreview",
      filename: xlightsOutputPath
    }, { fetchImpl, timeoutMs: automationTimeoutMs });
    steps.push({ command: "exportVideoPreview", ok: true, response: exportResponse });
  } else {
    throw new Error(`Unsupported --api-mode: ${apiMode}`);
  }
  if (xlightsOutputPath !== outputPath) {
    if (!fs.existsSync(xlightsOutputPath)) {
      throw new Error(`xLights export reported success but staged MP4 was not found: ${xlightsOutputPath}`);
    }
    fs.copyFileSync(xlightsOutputPath, outputPath);
    fs.rmSync(xlightsOutputPath, { force: true });
    steps.push({ command: "copyStagedPreviewVideo", ok: true, source: xlightsOutputPath, destination: outputPath });
  }

  const artifact = {
    artifactType: "xlights_preview_video_export_v1",
    artifactVersion: 1,
    generatedAt: new Date().toISOString(),
    readFormat: "house_preview_mp4_with_sequence_audio_when_present",
    source: {
      sequencePath,
      apiMode,
      xlightsEndpoint: apiMode === "owned" ? xlightsEndpoint : null,
      xlightsBaseUrl
    },
    output: {
      videoPath: outputPath,
      xlightsOutputPath,
      stagingDir: xlightsStagingDir || null,
      expectedContainer: "mp4",
      audioPolicy: "include_current_sequence_media_audio_when_present"
    },
    automation: {
      timeoutMs: automationTimeoutMs
    },
    steps
  };
  if (artifactPath) {
    fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);
  }
  return artifact;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help || !args.out || (!args.sequence && !args.skipOpen)) {
      process.stdout.write(usage());
      process.exit(args.help ? 0 : 1);
    }
    const artifact = await exportXLightsPreviewVideo(args);
    process.stdout.write(`${JSON.stringify({
      ok: true,
      artifactType: artifact.artifactType,
      videoPath: artifact.output.videoPath,
      artifactPath: resolvePath(args.artifact || "")
    }, null, 2)}\n`);
  } catch (error) {
    console.error(error?.stack || String(error));
    process.exit(1);
  }
}
