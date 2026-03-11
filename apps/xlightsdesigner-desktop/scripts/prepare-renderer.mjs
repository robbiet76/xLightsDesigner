import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceDir = path.resolve(__dirname, "..", "..", "xlightsdesigner-ui");
const outDir = path.resolve(__dirname, "..", "renderer");
const desktopPackageJson = path.resolve(__dirname, "..", "package.json");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyUi() {
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`UI source directory not found: ${sourceDir}`);
  }
  ensureDir(outDir);
  fs.cpSync(sourceDir, outDir, { recursive: true, force: true });
}

function writeBuildInfo() {
  let version = "0.0.0";
  try {
    const pkgRaw = fs.readFileSync(desktopPackageJson, "utf8");
    const pkg = JSON.parse(pkgRaw);
    version = String(pkg?.version || "").trim() || version;
  } catch {
    // keep default
  }
  const buildInfo = {
    appVersion: version,
    buildTime: new Date().toISOString(),
    buildEpochMs: Date.now()
  };
  fs.writeFileSync(
    path.join(outDir, "build-info.json"),
    JSON.stringify(buildInfo, null, 2),
    "utf8"
  );
}

copyUi();
writeBuildInfo();
console.log(`[desktop-build] renderer prepared at ${outDir}`);
