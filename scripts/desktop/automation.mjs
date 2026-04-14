#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);

const NATIVE_BASE_URL = process.env.XLD_NATIVE_AUTOMATION_URL || "http://127.0.0.1:49916";
const UNSUPPORTED_LEGACY_ACTIONS = new Set([
  "set-show-folder",
  "set-audio-path",
  "reset-automation-state",
  "analyze-audio",
  "seed-timing-tracks-from-analysis",
  "set-render-observation",
  "generate-proposal",
  "diagnose-current-proposal",
  "run-direct-sequence-validation",
  "run-design-concept-validation",
  "run-whole-sequence-apply-validation",
  "run-comparative-live-design-validation",
  "run-live-design-canary-validation",
  "run-live-design-validation-suite",
  "run-live-section-practical-sequence-validation-suite",
  "run-live-revision-practical-sequence-validation-suite",
  "run-live-wholesequence-practical-validation-suite",
  "run-live-design-canary-suite"
]);

function str(value = "") {
  return String(value || "").trim();
}

function usage() {
  console.error("usage: automation.mjs [--channel dev|packaged] [--result-file path] ping | open-sequence <path> | get-automation-health-snapshot | get-agent-runtime-snapshot | get-page-states-snapshot | get-sequencer-validation-snapshot | get-render-feedback-snapshot | apply-current-proposal | dispatch-prompt <prompt> | refresh-from-xlights");
  process.exit(2);
}

function readJsonPayload(args = []) {
  const first = str(args[0]);
  if (!first) return {};
  if (first === "--payload-file") {
    const file = str(args[1]);
    if (!file) throw new Error("--payload-file requires a path");
    return JSON.parse(fs.readFileSync(path.resolve(file), "utf8"));
  }
  if (first.startsWith("@")) {
    return JSON.parse(fs.readFileSync(path.resolve(first.slice(1)), "utf8"));
  }
  return JSON.parse(args.join(" ").trim());
}

let channel = "dev";
if (argv[0] === "--channel") {
  channel = str(argv[1] || "dev") || "dev";
  if (!["dev", "packaged"].includes(channel)) {
    console.error(`unsupported automation channel: ${channel}`);
    process.exit(2);
  }
  argv.splice(0, 2);
}

let resultFile = "";
if (argv[0] === "--result-file") {
  resultFile = str(argv[1]);
  if (!resultFile) usage();
  argv.splice(0, 2);
}

const [command, ...rest] = argv;
if (!command) usage();

function emit(payload = {}, exitCode = 0) {
  const raw = `${JSON.stringify(payload, null, 2)}\n`;
  if (resultFile) {
    fs.writeFileSync(path.resolve(resultFile), raw, "utf8");
  }
  process.stdout.write(raw);
  process.exit(exitCode);
}

async function request(method, reqPath, body = null) {
  const init = { method, headers: {} };
  if (body) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const response = await fetch(`${NATIVE_BASE_URL}${reqPath}`, init);
  const text = await response.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { ok: false, error: text };
  }
  return {
    ok: response.ok,
    status: response.status,
    result: parsed
  };
}

function unsupportedLegacy(commandName = "") {
  emit({
    ok: false,
    error: `Unsupported legacy automation action for native app: ${commandName}`,
    details: "The Electron/file-queue automation transport has been removed from this CLI. Migrate this workflow to the native automation server on http://127.0.0.1:49916."
  }, 1);
}

if (UNSUPPORTED_LEGACY_ACTIONS.has(command)) {
  unsupportedLegacy(command);
}

let nativeCall = null;
if (command === "ping" || command === "get-automation-health-snapshot") {
  nativeCall = { method: "GET", path: "/health" };
} else if (command === "get-page-states-snapshot") {
  nativeCall = { method: "GET", path: "/snapshot" };
} else if (command === "get-agent-runtime-snapshot") {
  nativeCall = { method: "GET", path: "/snapshot" };
} else if (command === "get-sequencer-validation-snapshot") {
  nativeCall = { method: "GET", path: "/sequencer-validation-snapshot" };
} else if (command === "get-render-feedback-snapshot") {
  nativeCall = { method: "GET", path: "/render-feedback-snapshot" };
} else if (command === "open-sequence") {
  const first = str(rest[0]);
  const payload = (first === "--payload-file" || first.startsWith("@") || first.startsWith("{"))
    ? readJsonPayload(rest)
    : { sequencePath: rest.join(" ").trim() };
  nativeCall = {
    method: "POST",
    path: "/action",
    body: {
      action: "openXLightsSequence",
      filePath: str(payload?.sequencePath || payload?.filePath)
    }
  };
} else if (command === "dispatch-prompt") {
  nativeCall = {
    method: "POST",
    path: "/action",
    body: {
      action: "sendAssistantPrompt",
      prompt: rest.join(" ").trim()
    }
  };
} else if (command === "apply-current-proposal") {
  nativeCall = {
    method: "POST",
    path: "/action",
    body: { action: "applyReview" }
  };
} else if (command === "refresh-from-xlights") {
  nativeCall = {
    method: "POST",
    path: "/action",
    body: { action: "refreshAll" }
  };
} else {
  usage();
}

try {
  const out = await request(nativeCall.method, nativeCall.path, nativeCall.body || null);
  emit(
    {
      ok: out.ok,
      channel,
      transport: "native_http",
      baseUrl: NATIVE_BASE_URL,
      result: out.result
    },
    out.ok ? 0 : 1
  );
} catch (err) {
  emit({
    ok: false,
    channel,
    transport: "native_http",
    baseUrl: NATIVE_BASE_URL,
    error: String(err?.message || err)
  }, 1);
}
