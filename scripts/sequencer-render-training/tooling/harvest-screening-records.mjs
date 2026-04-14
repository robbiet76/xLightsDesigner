import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

function parseArgs(argv = []) {
  const out = {
    source: "",
    outDir: resolve("scripts/sequencer-render-training/catalog/effect-screening-records")
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = String(argv[i] || "").trim();
    if (arg === "--source") out.source = resolve(String(argv[i + 1] || "").trim());
    if (arg === "--out-dir") out.outDir = resolve(String(argv[i + 1] || "").trim());
  }
  return out;
}

function listRecordFiles(sourcePath = "") {
  if (!sourcePath || !existsSync(sourcePath)) return [];
  const output = execFileSync(
    "find",
    [sourcePath, "-type", "f", "-name", "*.record.json"],
    { encoding: "utf8" }
  );
  return output
    .split("\n")
    .map((row) => row.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

const args = parseArgs(process.argv.slice(2));
if (!args.source) {
  console.error("usage: node harvest-screening-records.mjs --source <screening-run-dir> [--out-dir <dir>]");
  process.exit(1);
}

const files = listRecordFiles(args.source);
mkdirSync(args.outDir, { recursive: true });
for (const filePath of files) {
  copyFileSync(filePath, join(args.outDir, basename(filePath)));
}

console.log(JSON.stringify({
  ok: true,
  source: args.source,
  outDir: args.outDir,
  copiedCount: files.length
}, null, 2));
