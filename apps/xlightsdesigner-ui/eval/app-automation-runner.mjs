import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

function str(value = "") {
  return String(value || "").trim();
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function runCommand(cmd, args, { cwd }) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: ["ignore", "pipe", "pipe"], env: process.env });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += String(chunk || ""); });
    child.stderr.on("data", (chunk) => { stderr += String(chunk || ""); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || stdout.trim() || `${cmd} exited with code ${code}`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function readPayloadArg(args = []) {
  const payloadIndex = args.indexOf("--payload-file");
  if (payloadIndex < 0) return {};
  const payloadPath = str(args[payloadIndex + 1]);
  if (!payloadPath) return {};
  return readJson(payloadPath);
}

function buildAppAutomationArgs(command, args = []) {
  switch (command) {
    case "get-automation-health-snapshot":
      return ["get-health-snapshot"];
    case "get-page-states-snapshot":
      return ["get-app-snapshot"];
    case "apply-current-proposal":
      return ["apply-review"];
    case "open-sequence": {
      const payload = readPayloadArg(args);
      return ["open-xlights-sequence", str(payload?.sequencePath || args[0])];
    }
    case "select-workflow":
      return ["select-workflow", str(args[0]).toLowerCase()];
    default:
      return [command, ...args];
  }
}

export async function runAppAutomation(repoRoot, channel, resultPath, command, args = []) {
  const script = path.join(repoRoot, "scripts", "app", "automation.mjs");
  const commandArgs = [script, ...buildAppAutomationArgs(command, args)];
  const { stdout } = await runCommand("node", commandArgs, { cwd: repoRoot });
  const parsed = JSON.parse(stdout);
  const wrapped = { ok: parsed?.ok !== false, channel, command, result: parsed };
  fs.writeFileSync(resultPath, `${JSON.stringify(wrapped, null, 2)}\n`, "utf8");
  return wrapped;
}
