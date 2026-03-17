#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const launchRoot = "/tmp/xld-desktop-launch";
const launchRequestsDir = path.join(launchRoot, "requests");
const launchResponsesDir = path.join(launchRoot, "responses");
const automationRoot = "/tmp/xld-automation";
const automationRequestsDir = path.join(automationRoot, "requests");
const automationResponsesDir = path.join(automationRoot, "responses");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requestId() {
  return `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
}

async function waitForFile(filePath, timeoutMs = 30000) {
  const started = Date.now();
  for (;;) {
    if (fs.existsSync(filePath)) return fs.readFileSync(filePath, "utf8");
    if (Date.now() - started > timeoutMs) {
      throw new Error(`Timed out waiting for ${filePath}`);
    }
    await sleep(250);
  }
}

async function requestLaunch() {
  ensureDir(launchRequestsDir);
  ensureDir(launchResponsesDir);
  const id = requestId();
  const reqPath = path.join(launchRequestsDir, `${id}.json`);
  const resPath = path.join(launchResponsesDir, `${id}.json`);
  writeJson(reqPath, { id, action: "launch", payload: {} });
  const raw = await waitForFile(resPath, 30000);
  try { fs.unlinkSync(resPath); } catch {}
  return JSON.parse(raw);
}

async function waitForAutomationPing() {
  ensureDir(automationRequestsDir);
  ensureDir(automationResponsesDir);
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    const id = requestId();
    const reqPath = path.join(automationRequestsDir, `${id}.json`);
    const resPath = path.join(automationResponsesDir, `${id}.json`);
    writeJson(reqPath, { id, action: "ping", payload: {} });
    const started = Date.now();
    while (Date.now() - started < 3000) {
      if (fs.existsSync(resPath)) {
        const raw = fs.readFileSync(resPath, "utf8");
        try { fs.unlinkSync(resPath); } catch {}
        return JSON.parse(raw);
      }
      await sleep(200);
    }
    try { fs.unlinkSync(reqPath); } catch {}
    await sleep(500);
  }
  throw new Error("Timed out waiting for xLightsDesigner automation ping");
}

const launch = await requestLaunch();
const ping = await waitForAutomationPing();
process.stdout.write(JSON.stringify({ launch, ping }, null, 2) + "\n");
