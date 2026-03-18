#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = "/tmp/xld-automation";
const requestsDir = path.join(root, "requests");
const responsesDir = path.join(root, "responses");
fs.mkdirSync(requestsDir, { recursive: true });
fs.mkdirSync(responsesDir, { recursive: true });

function usage() {
  console.error("usage: automation.mjs ping | refresh-from-xlights | analyze-audio [prompt] | dispatch-prompt <prompt> | diagnose-current-proposal | apply-current-proposal | run-direct-sequence-validation <json-payload|--payload-file path> | run-design-concept-validation <json-payload|--payload-file path> | run-whole-sequence-apply-validation <json-payload|--payload-file path> | run-comparative-live-design-validation <json-payload|--payload-file path> | run-live-design-validation-suite <json-payload|--payload-file path>");
  process.exit(2);
}

function readJsonPayload(args = []) {
  const first = String(args[0] || "").trim();
  if (!first) return {};
  if (first === "--payload-file") {
    const file = String(args[1] || "").trim();
    if (!file) {
      throw new Error("--payload-file requires a path");
    }
    return JSON.parse(fs.readFileSync(path.resolve(file), "utf8"));
  }
  if (first.startsWith("@")) {
    return JSON.parse(fs.readFileSync(path.resolve(first.slice(1)), "utf8"));
  }
  return JSON.parse(args.join(" ").trim());
}

const [, , command, ...rest] = process.argv;
if (!command) usage();

const id = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
let payload = {};
let action = "";
if (command === "dispatch-prompt") {
  const prompt = rest.join(" ").trim();
  if (!prompt) usage();
  action = "dispatchPrompt";
  payload = { prompt };
} else if (command === "ping") {
  action = "ping";
} else if (command === "refresh-from-xlights") {
  action = "refreshFromXLights";
} else if (command === "analyze-audio") {
  action = "analyzeAudio";
  payload = { prompt: rest.join(" ").trim() };
} else if (command === "apply-current-proposal") {
  action = "applyCurrentProposal";
} else if (command === "diagnose-current-proposal") {
  action = "diagnoseCurrentProposal";
} else if (command === "run-direct-sequence-validation") {
  action = "runDirectSequenceValidation";
  payload = readJsonPayload(rest);
} else if (command === "run-design-concept-validation") {
  action = "runDesignConceptValidation";
  payload = readJsonPayload(rest);
} else if (command === "run-whole-sequence-apply-validation") {
  action = "runWholeSequenceApplyValidation";
  payload = readJsonPayload(rest);
} else if (command === "run-comparative-live-design-validation") {
  action = "runComparativeLiveDesignValidation";
  payload = readJsonPayload(rest);
} else if (command === "run-live-design-validation-suite") {
  action = "runLiveDesignValidationSuite";
  payload = readJsonPayload(rest);
} else {
  usage();
}

const requestPath = path.join(requestsDir, `${id}.json`);
const responsePath = path.join(responsesDir, `${id}.json`);
fs.writeFileSync(requestPath, JSON.stringify({ id, action, payload }, null, 2), "utf8");

function computeTimeoutMs(currentAction = "", currentPayload = {}) {
  if (currentAction === "runLiveDesignValidationSuite") {
    const scenarioCount = Array.isArray(currentPayload?.scenarios) ? currentPayload.scenarios.length : 0;
    const baseMs = 300000;
    const perScenarioMs = 90000;
    return Math.max(baseMs, baseMs + (scenarioCount * perScenarioMs));
  }
  if (currentAction === "runComparativeLiveDesignValidation") {
    return 300000;
  }
  return 120000;
}

const timeoutMs = computeTimeoutMs(action, payload);
const started = Date.now();
for (;;) {
  if (fs.existsSync(responsePath)) {
    const raw = fs.readFileSync(responsePath, "utf8");
    process.stdout.write(raw + "\n");
    try {
      fs.unlinkSync(responsePath);
    } catch {}
    process.exit(0);
  }
  if (Date.now() - started > timeoutMs) {
    console.error(JSON.stringify({ ok: false, id, action, error: "Timed out waiting for automation response" }));
    process.exit(1);
  }
  await new Promise((resolve) => setTimeout(resolve, 250));
}
