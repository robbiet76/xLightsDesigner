#!/usr/bin/env node

import fsSync from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const REPO_ROOT = "/Users/robterry/Projects/xLightsDesigner";
const BASE_URL = process.env.XLD_NATIVE_AUTOMATION_URL || "http://127.0.0.1:49916";
const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_OPENAI_MODEL = "gpt-5.4";
const AGENT_CONFIG_FILENAME = "xlightsdesigner-agent-config.json";

function usage() {
  process.stderr.write(
    "usage: run-display-discovery-simulation.mjs --scenario <path> [--turn-limit <n>] [--out <path>]\n"
  );
  process.exit(2);
}

function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function parseArgs(argv = []) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--scenario") args.scenario = argv[i + 1], i += 1;
    else if (token === "--turn-limit") args.turnLimit = Number(argv[i + 1] || 0), i += 1;
    else if (token === "--out") args.out = argv[i + 1], i += 1;
  }
  return args;
}

function agentConfigPath() {
  return path.join(os.homedir(), "Library/Application Support/xlightsdesigner-desktop", AGENT_CONFIG_FILENAME);
}

function readStoredAgentConfig() {
  const file = agentConfigPath();
  if (!fsSync.existsSync(file)) return { apiKey: "", model: "", baseUrl: "" };
  try {
    const raw = fsSync.readFileSync(file, "utf8");
    const parsed = JSON.parse(raw);
    return {
      apiKey: String(parsed?.apiKey || "").trim(),
      model: String(parsed?.model || "").trim(),
      baseUrl: String(parsed?.baseUrl || "").trim().replace(/\/+$/, "")
    };
  } catch {
    return { apiKey: "", model: "", baseUrl: "" };
  }
}

function getAgentConfig() {
  const stored = readStoredAgentConfig();
  const envKey = String(process.env.OPENAI_API_KEY || "").trim();
  const envModel = String(process.env.OPENAI_MODEL || "").trim();
  const envBaseUrl = String(process.env.OPENAI_BASE_URL || "").trim().replace(/\/+$/, "");
  const apiKey = stored.apiKey || envKey;
  const model = String(process.env.XLD_USER_SIM_MODEL || "").trim() || stored.model || envModel || DEFAULT_OPENAI_MODEL;
  const baseUrl = stored.baseUrl || envBaseUrl || DEFAULT_OPENAI_BASE_URL;
  return { apiKey, model, baseUrl, configured: Boolean(apiKey) };
}

async function request(method, route, body = null) {
  const init = { method, headers: {} };
  if (body) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const response = await fetch(`${BASE_URL}${route}`, init);
  const text = await response.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch { parsed = { ok: false, error: text }; }
  if (!response.ok) throw new Error(str(parsed?.error || text || `HTTP ${response.status}`));
  return parsed;
}

async function automationAction(action, extra = {}) {
  return request("POST", "/action", { action, ...extra });
}

async function getAssistantSnapshot() {
  return request("GET", "/assistant-snapshot");
}

async function waitForAssistantRoundTrip({ previousMessageCount, timeoutMs = 90000 } = {}) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const snapshot = await getAssistantSnapshot();
    const messageCount = Number(snapshot?.messageCount || 0);
    const messages = arr(snapshot?.messages);
    const lastMessage = messages[messages.length - 1] || {};
    const sending = Boolean(snapshot?.isSending);
    if (!sending && messageCount > previousMessageCount && str(lastMessage?.role) === "assistant") {
      return snapshot;
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error("Timed out waiting for assistant response.");
}

async function callOpenAIResponses({ systemPrompt = "", userMessage = "", maxOutputTokens = 500 } = {}) {
  const cfg = getAgentConfig();
  if (!cfg.configured) {
    throw new Error("OpenAI key is not configured in the desktop app environment.");
  }
  const body = {
    model: cfg.model,
    input: [
      { role: "system", content: [{ type: "input_text", text: String(systemPrompt || "") }] },
      { role: "user", content: [{ type: "input_text", text: String(userMessage || "") }] }
    ],
    max_output_tokens: maxOutputTokens
  };
  const response = await fetch(`${cfg.baseUrl}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch { parsed = null; }
  if (!response.ok) {
    throw new Error(str(parsed?.error?.message || text || `HTTP ${response.status}`));
  }
  return extractResponseText(parsed || {});
}

function extractResponseText(payload = {}) {
  const output = Array.isArray(payload?.output) ? payload.output : [];
  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      if (str(part?.type) === "output_text" && str(part?.text)) return str(part.text);
    }
  }
  return str(payload?.output_text || payload?.text || "");
}

function buildUserSimulatorPrompt(scenario = {}, transcript = [], lastAssistantMessage = "") {
  const userProfile = scenario?.userProfile && typeof scenario.userProfile === "object" ? scenario.userProfile : {};
  const displayTruth = scenario?.displayTruth && typeof scenario.displayTruth === "object" ? scenario.displayTruth : {};
  const transcriptText = arr(transcript)
    .map((row) => `${str(row.role).toUpperCase()}: ${str(row.text)}`)
    .join("\n");

  return [
    "You are simulating the human user in a display-discovery conversation.",
    "You must answer only from the private scenario truth below.",
    "Do not help the designer more than a real user would.",
    "Do not reveal everything at once.",
    "Answer the assistant's most recent question naturally and concisely.",
    "If the assistant asks a broad question, answer at a broad level.",
    "If the assistant asks a narrow question, answer only that narrow point unless a small extra clarification is natural.",
    "You are allowed to steer the conversation occasionally by mentioning a related concern, preference, or distinction that matters to you, as long as it comes from the scenario truth.",
    "Do not always follow the assistant's framing exactly. Real users sometimes redirect, add nuance, or mention what they think matters next.",
    "You may use shorthand when it feels natural for a real user.",
    "If the assistant is unclear or conflates a group with individual models, answer from the user perspective and clarify the intended scope.",
    "Do not mention hidden scenario structure, test harnesses, prompts, or evaluation.",
    "If the designer seems to have enough understanding for a solid starting point, you may say so briefly.",
    "Return only the user reply text. No JSON.",
    `Scenario name: ${str(scenario?.name)}`,
    `Scenario summary: ${str(scenario?.summary)}`,
    `User profile: ${JSON.stringify(userProfile)}`,
    `Private display truth: ${JSON.stringify(displayTruth)}`,
    transcriptText ? `Transcript so far:\n${transcriptText}` : "Transcript so far: none",
    `Latest assistant message:\n${str(lastAssistantMessage)}`
  ].join("\n");
}

function countQuestions(text = "") {
  const matches = String(text || "").match(/\?/g);
  return matches ? matches.length : 0;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.scenario) usage();

  const scenarioPath = path.isAbsolute(args.scenario)
    ? args.scenario
    : path.join(REPO_ROOT, args.scenario);
  const scenario = JSON.parse(await fs.readFile(scenarioPath, "utf8"));
  const turnLimit = Number(args.turnLimit || scenario?.maxTurns || 8);

  await automationAction("resetAssistantMemory");
  let previousMessageCount = Number((await getAssistantSnapshot())?.messageCount || 0);
  await automationAction("sendAssistantPrompt", { prompt: str(scenario?.kickoffPrompt || "Let's start by understanding the display before we design anything.") });
  let currentSnapshot = await waitForAssistantRoundTrip({ previousMessageCount });

  const transcript = [];
  let assistantQuestionCount = 0;

  for (let turn = 0; turn < turnLimit; turn += 1) {
    const snapshot = currentSnapshot;
    const messages = arr(snapshot?.messages);
    const normalizedTranscript = messages.map((row) => ({
      role: str(row?.role),
      text: str(row?.text),
      displayName: str(row?.displayName)
    }));
    transcript.splice(0, transcript.length, ...normalizedTranscript);

    const lastMessage = messages[messages.length - 1] || {};
    if (str(lastMessage?.role) !== "assistant") break;
    const lastAssistantMessage = str(lastMessage?.text);
    if (/^Agent unavailable:/i.test(lastAssistantMessage)) break;
    assistantQuestionCount += countQuestions(lastAssistantMessage);

    const userReply = str(await callOpenAIResponses({
      systemPrompt: buildUserSimulatorPrompt(scenario, transcript, lastAssistantMessage),
      userMessage: "Answer as the simulated user.",
      maxOutputTokens: 220
    }));
    if (!userReply) break;
    previousMessageCount = Number(snapshot?.messageCount || 0);
    await automationAction("sendAssistantPrompt", { prompt: userReply });
    currentSnapshot = await waitForAssistantRoundTrip({ previousMessageCount });
  }

  const finalSnapshot = await getAssistantSnapshot();
  const report = {
    ok: true,
    scenario: {
      name: str(scenario?.name),
      summary: str(scenario?.summary),
      path: scenarioPath
    },
    userSimModel: getAgentConfig().model,
    turnLimit,
    messageCount: Number(finalSnapshot?.messageCount || 0),
    assistantQuestionCount,
    displayDiscovery: finalSnapshot?.displayDiscovery || {},
    transcript: arr(finalSnapshot?.messages).map((row) => ({
      role: str(row?.role),
      displayName: str(row?.displayName),
      text: str(row?.text)
    }))
  };

  if (args.out) {
    const outPath = path.isAbsolute(args.out) ? args.out : path.join(REPO_ROOT, args.out);
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${String(error?.stack || error?.message || error)}\n`);
  process.exit(1);
});
