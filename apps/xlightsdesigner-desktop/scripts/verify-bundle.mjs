import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const desktopDir = path.resolve(__dirname, "..");
const distDir = path.join(desktopDir, "dist");
const unpackedApp = path.join(distDir, "mac", "xLightsDesigner.app");
const unpackedAlt = path.join(distDir, "mac-arm64", "xLightsDesigner.app");

function fail(message) {
  console.error(`[desktop-verify] FAIL: ${message}`);
  process.exit(1);
}

function findAppBundle() {
  if (fs.existsSync(unpackedApp)) return unpackedApp;
  if (fs.existsSync(unpackedAlt)) return unpackedAlt;
  const dirs = fs.existsSync(distDir) ? fs.readdirSync(distDir) : [];
  const candidate = dirs
    .map((name) => path.join(distDir, name, "xLightsDesigner.app"))
    .find((p) => fs.existsSync(p));
  return candidate || "";
}

if (!fs.existsSync(distDir)) {
  fail(`dist folder not found at ${distDir}. Run npm run dist:mac first.`);
}

const appBundle = findAppBundle();
if (!appBundle) {
  fail("No xLightsDesigner.app found under dist output.");
}

const contents = path.join(appBundle, "Contents");
const macosExec = path.join(contents, "MacOS", "xLightsDesigner");
const resources = path.join(contents, "Resources");
const appAsar = path.join(resources, "app.asar");

if (!fs.existsSync(contents)) fail(`Missing Contents folder in ${appBundle}`);
if (!fs.existsSync(resources)) fail(`Missing Resources folder in ${appBundle}`);
if (!fs.existsSync(macosExec)) fail(`Missing app executable at ${macosExec}`);
if (!fs.existsSync(appAsar)) fail(`Missing app.asar at ${appAsar}`);

console.log(`[desktop-verify] PASS: bundle verified at ${appBundle}`);
