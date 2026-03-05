import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceDir = path.resolve(__dirname, "..", "..", "xlightsdesigner-ui");
const outDir = path.resolve(__dirname, "..", "renderer");

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

copyUi();
console.log(`[desktop-build] renderer prepared at ${outDir}`);
