import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

if (process.platform !== "darwin") {
  console.log("[desktop-build] install-launch-agent skipped (non-macOS platform)");
  process.exit(0);
}

const uid = String(process.getuid());
const label = "org.xlightsdesigner.desktop.launcher";
const plistPath = path.join(os.homedir(), "Library", "LaunchAgents", `${label}.plist`);
const scriptPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "scripts", "desktop", "launch-agent.mjs");

const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/env</string>
    <string>node</string>
    <string>${scriptPath}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/xld-desktop-launch-agent.stdout.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/xld-desktop-launch-agent.stderr.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
</dict>
</plist>
`;

fs.mkdirSync(path.dirname(plistPath), { recursive: true });
fs.writeFileSync(plistPath, plist, "utf8");

spawnSync("/bin/launchctl", ["bootout", `gui/${uid}`, plistPath], { stdio: "ignore" });
const bootstrap = spawnSync("/bin/launchctl", ["bootstrap", `gui/${uid}`, plistPath], { encoding: "utf8" });
if (bootstrap.status !== 0) {
  console.error(`[desktop-build] install-launch-agent bootstrap failed: ${String(bootstrap.stderr || bootstrap.stdout || "").trim()}`);
  process.exit(1);
}
const kickstart = spawnSync("/bin/launchctl", ["kickstart", "-k", `gui/${uid}/${label}`], { encoding: "utf8" });
if (kickstart.status !== 0) {
  console.error(`[desktop-build] install-launch-agent kickstart failed: ${String(kickstart.stderr || kickstart.stdout || "").trim()}`);
  process.exit(1);
}

console.log(`[desktop-build] install-launch-agent updated ${plistPath}`);
