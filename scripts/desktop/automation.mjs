#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

const root = "/tmp/xld-automation";
const requestsDir = path.join(root, "requests");
const responsesDir = path.join(root, "responses");
fs.mkdirSync(requestsDir, { recursive: true });
fs.mkdirSync(responsesDir, { recursive: true });

function usage() {
  console.error("usage: automation.mjs ping | refresh-from-xlights | analyze-audio [prompt] | dispatch-prompt <prompt> | diagnose-current-proposal | apply-current-proposal | run-direct-sequence-validation <json-payload> | run-design-concept-validation <json-payload> | run-whole-sequence-apply-validation <json-payload> | run-comparative-live-design-validation <json-payload> | run-live-design-validation-suite <json-payload>");
  process.exit(2);
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
  payload = {};
} else if (command === "refresh-from-xlights") {
  action = "refreshFromXLights";
  payload = {};
} else if (command === "analyze-audio") {
  action = "analyzeAudio";
  payload = { prompt: rest.join(" ").trim() };
} else if (command === "apply-current-proposal") {
  action = "applyCurrentProposal";
  payload = {};
} else if (command === "diagnose-current-proposal") {
  action = "diagnoseCurrentProposal";
  payload = {};
} else if (command === "run-direct-sequence-validation") {
  action = "runDirectSequenceValidation";
  const raw = rest.join(" ").trim();
  payload = raw ? JSON.parse(raw) : {};
} else if (command === "run-design-concept-validation") {
  action = "runDesignConceptValidation";
  const raw = rest.join(" ").trim();
  payload = raw ? JSON.parse(raw) : {};
} else if (command === "run-whole-sequence-apply-validation") {
  action = "runWholeSequenceApplyValidation";
  const raw = rest.join(" ").trim();
  payload = raw ? JSON.parse(raw) : {};
} else if (command === "run-comparative-live-design-validation") {
  action = "runComparativeLiveDesignValidation";
  const raw = rest.join(" ").trim();
  payload = raw ? JSON.parse(raw) : {};
} else if (command === "run-live-design-validation-suite") {
  action = "runLiveDesignValidationSuite";
  const raw = rest.join(" ").trim();
  payload = raw ? JSON.parse(raw) : {};
} else {
  usage();
}

const requestPath = path.join(requestsDir, `${id}.json`);
const responsePath = path.join(responsesDir, `${id}.json`);
fs.writeFileSync(requestPath, JSON.stringify({ id, action, payload }, null, 2), "utf8");

const timeoutMs = 300000;
const started = Date.now();
for (;;) {
  if (fs.existsSync(responsePath)) {
    const raw = fs.readFileSync(responsePath, "utf8");
    process.stdout.write(raw + "\n");
    try { fs.unlinkSync(responsePath); } catch {}
    process.exit(0);
  }
  if (Date.now() - started > timeoutMs) {
    console.error(JSON.stringify({ ok: false, id, action, error: "Timed out waiting for automation response" }));
    process.exit(1);
  }
  await new Promise((resolve) => setTimeout(resolve, 250));
}
