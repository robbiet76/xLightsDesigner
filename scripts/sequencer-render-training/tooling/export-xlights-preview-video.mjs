#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_XLIGHTS_BASE_URL = process.env.XLIGHTS_BASE_URL || "http://127.0.0.1:49914";
const DEFAULT_AUTOMATION_TIMEOUT_MS = 5 * 60 * 1000;

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
    xlightsBaseUrl: DEFAULT_XLIGHTS_BASE_URL,
    sequence: "",
    out: "",
    artifact: "",
    skipOpen: false,
    skipRender: false,
    highdef: true,
    automationTimeoutMs: DEFAULT_AUTOMATION_TIMEOUT_MS
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = str(argv[index]);
    if (arg === "--xlights-base-url") args.xlightsBaseUrl = str(argv[++index]);
    else if (arg === "--sequence") args.sequence = str(argv[++index]);
    else if (arg === "--out") args.out = str(argv[++index]);
    else if (arg === "--artifact") args.artifact = str(argv[++index]);
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
  --xlights-base-url <url>  xLights legacy automation base URL. Default: ${DEFAULT_XLIGHTS_BASE_URL}
  --skip-open              Export the currently open sequence.
  --skip-render            Export without running renderAll first.
  --highdef true|false     Pass highdef to renderAll. Default: true.
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

export async function exportXLightsPreviewVideo(options = {}) {
  const xlightsBaseUrl = str(options.xlightsBaseUrl || DEFAULT_XLIGHTS_BASE_URL);
  const sequencePath = options.sequence ? resolvePath(options.sequence) : "";
  const outputPath = resolvePath(options.out);
  const artifactPath = options.artifact ? resolvePath(options.artifact) : "";
  const automationTimeoutMs = Number(options.automationTimeoutMs || DEFAULT_AUTOMATION_TIMEOUT_MS);
  if (!options.skipOpen && !sequencePath) throw new Error("--sequence is required unless --skip-open is used");
  if (!outputPath) throw new Error("--out is required");
  if (!options.skipOpen && !fs.existsSync(sequencePath)) throw new Error(`Sequence file does not exist: ${sequencePath}`);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  if (artifactPath) fs.mkdirSync(path.dirname(artifactPath), { recursive: true });

  const steps = [];
  const fetchImpl = options.fetchImpl || globalThis.fetch;
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
    filename: outputPath
  }, { fetchImpl, timeoutMs: automationTimeoutMs });
  steps.push({ command: "exportVideoPreview", ok: true, response: exportResponse });

  const artifact = {
    artifactType: "xlights_preview_video_export_v1",
    artifactVersion: 1,
    generatedAt: new Date().toISOString(),
    readFormat: "house_preview_mp4_with_sequence_audio_when_present",
    source: {
      sequencePath,
      xlightsBaseUrl
    },
    output: {
      videoPath: outputPath,
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
