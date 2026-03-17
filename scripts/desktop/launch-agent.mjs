#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = "/tmp/xld-desktop-launch";
const REQUESTS_DIR = path.join(ROOT, "requests");
const RESPONSES_DIR = path.join(ROOT, "responses");
const LOG_PATH = "/tmp/xld-desktop-launch-agent.log";
const APP_PATH = "/Applications/xLightsDesigner.app";
const BUNDLE_ID = "org.xlightsdesigner.desktop";
const APP_BINARY_MATCH = "/Applications/xLightsDesigner.app/Contents/MacOS/xLightsDesigner";

function log(message) {
  try {
    fs.mkdirSync(ROOT, { recursive: true });
    fs.appendFileSync(LOG_PATH, `${new Date().toISOString()} ${message}\n`, "utf8");
  } catch {
    // ignore
  }
}

function ensureDirs() {
  fs.mkdirSync(REQUESTS_DIR, { recursive: true });
  fs.mkdirSync(RESPONSES_DIR, { recursive: true });
}

function responsePath(id = "") {
  return path.join(RESPONSES_DIR, `${String(id || "").trim()}.json`);
}

function isAppRunning() {
  const out = spawnSync("/usr/bin/pgrep", ["-f", APP_BINARY_MATCH], { encoding: "utf8" });
  return out.status === 0 && String(out.stdout || "").trim().length > 0;
}

function launchOrActivateApp() {
  const before = isAppRunning();
  const launchArgs = before ? ["-g", "-b", BUNDLE_ID] : ["-g", "-na", APP_PATH];
  const launch = spawnSync("/usr/bin/open", launchArgs, { encoding: "utf8" });
  if (launch.status !== 0) {
    return {
      ok: false,
      method: launchArgs.join(" "),
      wasRunning: before,
      error: String(launch.stderr || launch.stdout || `open exited with ${launch.status}`).trim()
    };
  }
  const after = isAppRunning();
  return {
    ok: true,
    method: launchArgs.join(" "),
    wasRunning: before,
    isRunning: after
  };
}

function processRequests() {
  ensureDirs();
  const files = fs.readdirSync(REQUESTS_DIR).filter((name) => name.endsWith(".json")).sort();
  for (const name of files) {
    const fullPath = path.join(REQUESTS_DIR, name);
    let request = null;
    try {
      request = JSON.parse(fs.readFileSync(fullPath, "utf8"));
      const id = String(request?.id || path.basename(name, ".json")).trim() || path.basename(name, ".json");
      const action = String(request?.action || "").trim();
      if (action !== "launch") {
        throw new Error(`Unknown launch action: ${action || "missing"}`);
      }
      const result = launchOrActivateApp();
      fs.writeFileSync(responsePath(id), JSON.stringify({ ok: result.ok, id, action, result }, null, 2), "utf8");
      log(`request id=${id} action=${action} ok=${result.ok} running=${result.isRunning === true}`);
    } catch (err) {
      const id = String(request?.id || path.basename(name, ".json")).trim() || path.basename(name, ".json");
      const action = String(request?.action || "").trim();
      fs.writeFileSync(responsePath(id), JSON.stringify({ ok: false, id, action, error: String(err?.message || err) }, null, 2), "utf8");
      log(`request_error id=${id} action=${action || "missing"} err=${String(err?.message || err)}`);
    } finally {
      try {
        fs.unlinkSync(fullPath);
      } catch {
        // ignore
      }
    }
  }
}

ensureDirs();
log("launcher:start");
setInterval(processRequests, 500);
processRequests();
