import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import electron from "electron";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const desktopDir = path.resolve(__dirname, "..");
const uiDir = path.resolve(desktopDir, "..", "xlightsdesigner-ui");
const uiServerScript = path.join(uiDir, "dev_server.py");
const port = Number.parseInt(process.env.PORT || "8080", 10);
const uiUrl = process.env.XLD_UI_URL || `http://127.0.0.1:${port}`;

let serverProc = null;
let electronProc = null;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function probe(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 500);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(1200, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForUi(url, maxMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    if (await probe(url)) return true;
    await wait(500);
  }
  return false;
}

async function maybeStartUiServer() {
  if (await probe(uiUrl)) {
    console.log(`[desktop-dev] UI server already running at ${uiUrl}`);
    return;
  }
  console.log(`[desktop-dev] starting UI dev server on ${uiUrl}`);
  serverProc = spawn("python3", [uiServerScript, "--port", String(port)], {
    cwd: uiDir,
    stdio: "inherit",
    env: { ...process.env, PORT: String(port) }
  });
  serverProc.on("exit", (code, signal) => {
    if (code !== 0 && signal == null) {
      console.error(`[desktop-dev] UI server exited with code ${code}`);
    }
  });
}

function shutdown() {
  if (electronProc && !electronProc.killed) {
    electronProc.kill("SIGTERM");
  }
  if (serverProc && !serverProc.killed) {
    serverProc.kill("SIGTERM");
  }
}

async function main() {
  await maybeStartUiServer();
  const ready = await waitForUi(uiUrl, 30000);
  if (!ready) {
    console.error(`[desktop-dev] UI server did not become ready at ${uiUrl}`);
    shutdown();
    process.exit(1);
  }

  electronProc = spawn(electron, [desktopDir], {
    cwd: desktopDir,
    stdio: "inherit",
    env: { ...process.env, XLD_UI_URL: uiUrl }
  });

  electronProc.on("exit", (code) => {
    shutdown();
    process.exit(code ?? 0);
  });
}

process.on("SIGINT", () => {
  shutdown();
  process.exit(130);
});

process.on("SIGTERM", () => {
  shutdown();
  process.exit(143);
});

main().catch((err) => {
  console.error(`[desktop-dev] fatal: ${err?.stack || err?.message || err}`);
  shutdown();
  process.exit(1);
});
