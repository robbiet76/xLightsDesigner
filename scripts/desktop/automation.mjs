#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const argv = process.argv.slice(2);
let automationChannel = "packaged";
if (argv[0] === "--channel") {
  automationChannel = String(argv[1] || "").trim() || "packaged";
  if (!["packaged", "dev"].includes(automationChannel)) {
    console.error(`unsupported automation channel: ${automationChannel}`);
    process.exit(2);
  }
  argv.splice(0, 2);
}

const root = `/tmp/xld-automation-${automationChannel}`;
const requestsDir = path.join(root, "requests");
const responsesDir = path.join(root, "responses");
fs.mkdirSync(requestsDir, { recursive: true });
fs.mkdirSync(responsesDir, { recursive: true });
const launchRoot = "/tmp/xld-desktop-launch";
const launchRequestsDir = path.join(launchRoot, "requests");

function usage() {
  console.error("usage: automation.mjs [--channel packaged|dev] [--result-file path] ping | reset-automation-state | refresh-from-xlights | analyze-audio [prompt] | dispatch-prompt <prompt> | generate-proposal <json-payload|--payload-file path> | diagnose-current-proposal | apply-current-proposal | run-direct-sequence-validation <json-payload|--payload-file path> | run-design-concept-validation <json-payload|--payload-file path> | run-whole-sequence-apply-validation <json-payload|--payload-file path> | run-comparative-live-design-validation <json-payload|--payload-file path> | run-live-design-canary-validation <json-payload|--payload-file path> | run-live-design-validation-suite <json-payload|--payload-file path> | run-live-section-practical-sequence-validation-suite <json-payload|--payload-file path> | run-live-revision-practical-sequence-validation-suite <json-payload|--payload-file path> | run-live-design-canary-suite <json-payload|--payload-file path>");
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

function nudgeApp() {
  if (process.platform !== "darwin") return;
  if (automationChannel !== "packaged") return;
  try {
    const output = String(execFileSync("pgrep", ["-f", "/Applications/xLightsDesigner.app/Contents/MacOS/xLightsDesigner"], {
      stdio: ["ignore", "pipe", "ignore"]
    }) || "").trim();
    if (output) return;
  } catch {
    // No running packaged app detected; fall through to launch request.
  }
  try {
    fs.mkdirSync(launchRequestsDir, { recursive: true });
    const id = `launch-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const requestPath = path.join(launchRequestsDir, `${id}.json`);
    fs.writeFileSync(requestPath, JSON.stringify({ id, action: "launch" }, null, 2), "utf8");
  } catch {
    // best effort only
  }
}

let resultFile = "";
if (argv[0] === "--result-file") {
  resultFile = String(argv[1] || "").trim();
  if (!resultFile) usage();
  argv.splice(0, 2);
}
const [command, ...rest] = argv;
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
} else if (command === "reset-automation-state") {
  action = "resetAutomationState";
} else if (command === "refresh-from-xlights") {
  action = "refreshFromXLights";
} else if (command === "analyze-audio") {
  action = "analyzeAudio";
  payload = { prompt: rest.join(" ").trim() };
} else if (command === "generate-proposal") {
  action = "generateProposal";
  payload = readJsonPayload(rest);
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
} else if (command === "run-live-design-canary-validation") {
  action = "runLiveDesignCanaryValidation";
  payload = readJsonPayload(rest);
} else if (command === "run-live-design-validation-suite") {
  action = "runLiveDesignValidationSuite";
  payload = readJsonPayload(rest);
} else if (command === "run-live-section-practical-sequence-validation-suite") {
  action = "runLiveSectionPracticalSequenceValidationSuite";
  payload = readJsonPayload(rest);
} else if (command === "run-live-revision-practical-sequence-validation-suite") {
  action = "runLiveRevisionPracticalSequenceValidationSuite";
  payload = readJsonPayload(rest);
} else if (command === "run-live-design-canary-suite") {
  action = "runLiveDesignCanarySuite";
  payload = readJsonPayload(rest);
} else {
  usage();
}

const requestPath = path.join(requestsDir, `${id}.json`);
const responsePath = path.join(responsesDir, `${id}.json`);
fs.writeFileSync(requestPath, JSON.stringify({ id, action, payload }, null, 2), "utf8");
nudgeApp();

function computeTimeoutMs(currentAction = "", currentPayload = {}) {
  if (currentAction === "runLiveDesignValidationSuite") {
    const scenarioCount = Array.isArray(currentPayload?.scenarios) ? currentPayload.scenarios.length : 0;
    const baseMs = 300000;
    const perScenarioMs = 90000;
    return Math.max(baseMs, baseMs + (scenarioCount * perScenarioMs));
  }
  if (currentAction === "runLiveSectionPracticalSequenceValidationSuite") {
    const scenarioCount = Array.isArray(currentPayload?.scenarios) ? currentPayload.scenarios.length : 0;
    const baseMs = 300000;
    const perScenarioMs = 90000;
    return Math.max(baseMs, baseMs + (scenarioCount * perScenarioMs));
  }
  if (currentAction === "runLiveRevisionPracticalSequenceValidationSuite") {
    const scenarioCount = Array.isArray(currentPayload?.scenarios) ? currentPayload.scenarios.length : 0;
    const baseMs = 300000;
    const perScenarioMs = 120000;
    return Math.max(baseMs, baseMs + (scenarioCount * perScenarioMs));
  }
  if (currentAction === "runComparativeLiveDesignValidation") {
    return 300000;
  }
  if (currentAction === "runLiveDesignCanaryValidation") {
    return 180000;
  }
  if (currentAction === "runLiveDesignCanarySuite") {
    const scenarioCount = Array.isArray(currentPayload?.scenarios) ? currentPayload.scenarios.length : 0;
    const baseMs = 180000;
    const perScenarioMs = 45000;
    return Math.max(baseMs, baseMs + (scenarioCount * perScenarioMs));
  }
  return 120000;
}

const timeoutMs = computeTimeoutMs(action, payload);
const started = Date.now();
let lastNudgeAt = started;
for (;;) {
  if (fs.existsSync(responsePath)) {
    const raw = fs.readFileSync(responsePath, "utf8");
    if (resultFile) {
      fs.writeFileSync(path.resolve(resultFile), raw + "\n", "utf8");
    }
    process.stdout.write(raw + "\n");
    try {
      fs.unlinkSync(responsePath);
    } catch {}
    process.exit(0);
  }
  if (Date.now() - started > 2000 && Date.now() - lastNudgeAt > 3000) {
    nudgeApp();
    lastNudgeAt = Date.now();
  }
  if (Date.now() - started > timeoutMs) {
    console.error(JSON.stringify({ ok: false, id, action, error: "Timed out waiting for automation response" }));
    process.exit(1);
  }
  await new Promise((resolve) => setTimeout(resolve, 250));
}
