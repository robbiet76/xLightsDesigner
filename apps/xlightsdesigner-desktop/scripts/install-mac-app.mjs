import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const platform = process.platform;
if (platform !== "darwin") {
  console.log("[desktop-build] install-mac-app skipped (non-macOS platform)");
  process.exit(0);
}

if (String(process.env.NO_INSTALL_TO_APPLICATIONS || "").trim() === "1") {
  console.log("[desktop-build] install-mac-app skipped (NO_INSTALL_TO_APPLICATIONS=1)");
  process.exit(0);
}

const dryRun = process.argv.includes("--dry-run");
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, "..");
const sourceApp = path.resolve(appRoot, "dist", "mac-arm64", "xLightsDesigner.app");
const targetApp = "/Applications/xLightsDesigner.app";

if (!fs.existsSync(sourceApp)) {
  console.error(`[desktop-build] install-mac-app failed: built app not found at ${sourceApp}`);
  process.exit(1);
}

try {
  if (dryRun) {
    console.log(`[desktop-build] install-mac-app dry-run: would copy ${sourceApp} -> ${targetApp}`);
    process.exit(0);
  }
  if (fs.existsSync(targetApp)) {
    fs.rmSync(targetApp, { recursive: true, force: true });
  }
  fs.cpSync(sourceApp, targetApp, { recursive: true });
  const stat = fs.statSync(targetApp);
  console.log(
    `[desktop-build] install-mac-app updated ${targetApp} (${Math.round(stat.mtimeMs)} mtimeMs, user=${os.userInfo().username})`
  );
  process.exit(0);
} catch (err) {
  console.error(`[desktop-build] install-mac-app failed: ${String(err?.message || err)}`);
  process.exit(1);
}
